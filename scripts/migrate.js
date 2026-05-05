// One-shot migration: move root-level projects/ and pdfs/ blobs under
// projects/<userId>/ and pdfs/<userId>/ respectively.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=<token> node scripts/migrate.js <email>
//
// Idempotent: blobs already under a userId prefix are skipped.

const { list, copy, put, del } = require('@vercel/blob');
const { createHash } = require('crypto');

const email = process.argv[2];
if (!email) {
  console.error('Usage: BLOB_READ_WRITE_TOKEN=<token> node scripts/migrate.js <email>');
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN not set in environment');
  process.exit(1);
}

const userId = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
console.log(`Migrating to userId=${userId} (email=${email})`);

const isAlreadyMigrated = (pathname, prefix) => new RegExp(`^${prefix}/[0-9a-f]{16}/`).test(pathname);

async function migratePdfs() {
  const { blobs } = await list({ prefix: 'pdfs/' });
  const map = {};
  for (const blob of blobs) {
    if (isAlreadyMigrated(blob.pathname, 'pdfs')) continue;
    const filename = blob.pathname.replace(/^pdfs\//, '');
    const newPath = `pdfs/${userId}/${filename}`;
    console.log(`  PDF: ${blob.pathname} → ${newPath}`);
    const result = await copy(blob.url, newPath, { access: 'private' });
    map[blob.url] = result.url;
    await del(blob.url);
  }
  return map;
}

async function migrateProjects(pdfUrlMap) {
  const { blobs } = await list({ prefix: 'projects/' });
  for (const blob of blobs) {
    if (isAlreadyMigrated(blob.pathname, 'projects')) continue;
    const filename = blob.pathname.replace(/^projects\//, '');
    const newPath = `projects/${userId}/${filename}`;
    console.log(`  Project: ${blob.pathname} → ${newPath}`);

    const res = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) {
      console.warn(`    (skipping; could not fetch: ${res.status})`);
      continue;
    }
    const project = await res.json();
    if (project.pdfBlobUrl && pdfUrlMap[project.pdfBlobUrl]) {
      project.pdfBlobUrl = pdfUrlMap[project.pdfBlobUrl];
    } else if (project.pdfBlobUrl) {
      console.warn(`    (warn) no pdf migration mapping for ${project.pdfBlobUrl}`);
    }

    await put(newPath, JSON.stringify(project, null, 2), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });
    await del(blob.url);
  }
}

(async () => {
  console.log('Migrating PDFs…');
  const pdfMap = await migratePdfs();
  console.log(`Migrated ${Object.keys(pdfMap).length} PDF(s).`);

  console.log('Migrating projects…');
  await migrateProjects(pdfMap);

  console.log('Done.');
})().catch(err => { console.error(err); process.exit(1); });
