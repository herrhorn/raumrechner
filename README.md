# Planar

Floor plan area measurer. Upload a PDF, calibrate by clicking two points of known length, then draw polygons to get areas in m². Saves projects to Vercel Blob storage.

Live: [raumrechner.vercel.app](https://raumrechner.vercel.app)

## Stack

- **Frontend**: vanilla JS, no bundler. PDF.js renders the plan onto a canvas; an SVG overlay handles drawing and dragging.
- **Storage**: Vercel Blob (private store). PDFs and project JSONs are uploaded directly from the browser via a short-lived token.
- **Serverless API** (`api/`): five endpoints — `blob-upload` (token issuer for client uploads), `blob-get` (auth proxy for reads), `blob-list`, `blob-delete`, `blob-put` (small server-side writes for rename).

Coordinates are stored in PDF-space (independent of render scale), so projects load correctly at any zoom level.

## Local development

```bash
cd frontend && npm install   # vendors PDF.js, jsPDF, and bundles @vercel/blob/client into static/vendor/
cd ../static && python3 -m http.server 8080
```

The local server has no API, so cloud save/load won't work locally. Push to a Vercel preview branch to test those flows.

## Deployment

Push to `main` — Vercel rebuilds and deploys automatically. The `BLOB_READ_WRITE_TOKEN` env var must be set on the project (it is).

## Security model

All API endpoints are unauthenticated. The blob store is private at the storage layer (URLs require a token to read), but anyone who reaches the deployment URL can list, read, write, rename, and delete projects. Defense-in-depth in place: pathname allowlists (`projects/`, `pdfs/` only), content-type allowlists (PDF, JSON only), HTTP method restrictions, HTTPS-only, `nosniff` on reads.
