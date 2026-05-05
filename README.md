# Planar

Floor plan area measurer. Upload a PDF, calibrate by clicking two points of known length, then draw polygons to get areas in m². Saves projects to Vercel Blob storage.

Live: [raumrechner.vercel.app](https://raumrechner.vercel.app)

## Stack

- **Frontend**: vanilla JS, no bundler. PDF.js renders the plan onto a canvas; an SVG overlay handles drawing and dragging.
- **Storage**: Vercel Blob (private store). PDFs and project JSONs are uploaded directly from the browser via a short-lived token.
- **Auth**: magic-link via Resend; JWT in httpOnly cookie (30-day expiry). `userId` is derived deterministically as `SHA256(email)[:16]` — no user database. Project pathnames are partitioned per user: `projects/<userId>/…` and `pdfs/<userId>/…`.
- **Serverless API** (`api/`):
  - `auth/send`, `auth/verify`, `auth/me`, `auth/logout` — magic-link flow + session
  - `blob-upload` — issues short-lived tokens for client uploads (validates pathname + content-type per user)
  - `blob-get` — auth proxy for reads
  - `blob-list` — lists the caller's own projects only
  - `blob-delete` — deletes the caller's own projects only
  - `blob-put` — small server-side writes (used by rename)

Coordinates are stored in PDF-space (independent of render scale), so projects load correctly at any zoom level.

## Local development

```bash
cd frontend && npm install   # vendors PDF.js, jsPDF, and bundles @vercel/blob/client into static/vendor/
cd ../static && python3 -m http.server 8080
```

The local server has no API, so auth and cloud save/load won't work locally. Push to a Vercel preview branch to test those flows.

## Deployment

Push to `main` — Vercel rebuilds and deploys automatically. Required env vars:

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob store token
- `JWT_SECRET` — random 32+ byte hex string (signs session and magic-link JWTs)
- `RESEND_API_KEY` — Resend API key
- `MAIL_FROM` — sender address (e.g. `onboarding@resend.dev`, or a verified custom-domain address)
- `APP_URL` — deployment origin used to build magic-link URLs (e.g. `https://raumrechner.vercel.app`)

## Security model

Every API endpoint requires a valid session cookie. Each user only sees and can mutate blobs under their own `userId` prefix. Defense-in-depth: pathname allowlists, content-type allowlists, HTTP method restrictions, HTTPS-only, `X-Content-Type-Options: nosniff` on reads. Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.

Known gaps (acceptable for current scale, fix when needed):

- **No rate limiting** on `/api/auth/send` — would allow Resend quota or inbox spam by an attacker. Add KV-backed per-IP/per-email throttle when relevant.
- **Magic-link tokens are stateless** — within their 15-minute window they're technically reusable. Single-use enforcement needs the same KV.
- **No revocation** — logging out clears the cookie locally but the JWT remains valid until expiry (30d). Rotate `JWT_SECRET` to force-logout everyone.

## Migration

`scripts/migrate.js` moves root-level `projects/<x>.json` and `pdfs/<x>.pdf` blobs under a given user's prefix. Idempotent — already-migrated blobs are skipped. Run once locally per legacy user:

```bash
BLOB_READ_WRITE_TOKEN=<token> node scripts/migrate.js <email>
```
