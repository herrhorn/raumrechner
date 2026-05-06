// End-to-end smoke tests for the project lifecycle.
// Auth is bypassed by signing a session JWT directly (see _auth.js).
// All test data lives under the e2e@planar.test user's blob prefix.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { loginAs } = require('./_auth');

const FIXTURE_PDF = path.join(__dirname, '..', 'fixtures', 'sample.pdf');

async function deleteAllProjects(page) {
  // Use the API directly — fastest way to start each test from a clean slate.
  const blobs = await page.evaluate(async () => {
    const res = await fetch('/api/blob-list');
    return res.ok ? await res.json() : [];
  });
  for (const blob of blobs) {
    await page.evaluate(async (url) => {
      await fetch('/api/blob-delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    }, blob.url);
  }
}

test.beforeEach(async ({ page, baseURL }) => {
  // Surface API failures in the test output so regressions are easy to diagnose.
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      console.error(`[HTTP ${r.status()}] ${r.request().method()} ${r.url()}`);
    }
  });
  await loginAs(page.context(), baseURL);
  await page.goto('/');
  // /api/auth/me must succeed before the app fires loadProjectList.
  await page.waitForFunction(() => !document.getElementById('userMenu').hidden);
  await deleteAllProjects(page);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('userMenu').hidden);
});

test('save → rename → delete', async ({ page }) => {
  // Upload the fixture PDF.
  await page.setInputFiles('#fileInput', FIXTURE_PDF);
  // Wait for PDF.js to render — canvas gets dimensions when render completes.
  // Default canvas size is 300x150 — wait for PDF.js to set its own dimensions.
  await page.waitForFunction(() => {
    const c = document.getElementById('pdfCanvas');
    return c && c.width !== 300;
  }, null, { timeout: 15_000 });

  // Save.
  await page.click('#saveCloud');
  await expect(page.locator('#saveCloud')).toContainText('Saved', { timeout: 15_000 });

  // The project should now appear in the list with the fixture name.
  const row = page.locator('#projectList > div').first();
  await expect(row).toBeVisible();
  await expect(row.locator('div').first()).toContainText('sample');

  // Rename via the ✎ button. Use a dialog handler since the rename uses prompt().
  page.once('dialog', d => d.accept('Renamed Project'));
  await row.locator('button[title="Rename"]').click();

  // Wait for the list to refresh with the new name.
  await expect(page.locator('#projectList')).toContainText('Renamed Project', { timeout: 10_000 });

  // Delete via the 🗑️ button — confirm dialog.
  page.once('dialog', d => d.accept());
  await page.locator('#projectList > div').first().locator('button[title="Delete"]').click();

  // List should empty out.
  await expect(page.locator('#projectList')).toContainText('No saved projects', { timeout: 10_000 });
});

test('reload preserves session and project list', async ({ page }) => {
  // Save a project, then reload, and verify it survives.
  await page.setInputFiles('#fileInput', FIXTURE_PDF);
  // Default canvas size is 300x150 — wait for PDF.js to set its own dimensions.
  await page.waitForFunction(() => {
    const c = document.getElementById('pdfCanvas');
    return c && c.width !== 300;
  }, null, { timeout: 15_000 });
  await page.click('#saveCloud');
  await expect(page.locator('#saveCloud')).toContainText('Saved', { timeout: 15_000 });

  await page.reload();
  await page.waitForFunction(() => !document.getElementById('userMenu').hidden);

  // User menu shows the test user's email; project list shows our save.
  await expect(page.locator('#userEmail')).toContainText('e2e@planar.test');
  await expect(page.locator('#projectList')).toContainText('sample', { timeout: 10_000 });

  await deleteAllProjects(page);
});
