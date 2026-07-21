// Shared helpers for the project-lifecycle and recovery specs. Mirrors the
// small helper functions smoke.spec.js defines inline; pulled out here only
// because two new spec files need the exact same boilerplate and smoke.spec.js
// itself is left untouched to avoid any risk to the existing baseline.
const { expect } = require('@playwright/test');

async function gotoApp(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => window.THREE !== undefined, { timeout: 15000 }).catch(() => {});
  return { pageErrors, consoleErrors };
}

function expectNoErrors({ pageErrors, consoleErrors }) {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
}

function dirtyIndicator(page) {
  return page.locator('#dirty-indicator');
}

// Fresh page always starts in Viewer; only call this once, before any other
// mode-dependent action.
async function enterEditor(page) {
  await page.click('#app-mode-toggle-btn', { force: true });
}

// Builds a small, fully fictional project ZIP in memory (Node-side, via the
// jszip devDependency) for tests that need to feed a ZIP into the app
// without going through the app's own export first. Kept separate from the
// committed PNG/JSON fixtures because the ZIP's byte layout only needs to
// satisfy _doImportZipPackage()'s reader, not exist as a reviewable file.
async function buildZipFixtureBuffer() {
  const JSZip = require('jszip');
  const fs = require('fs');
  const path = require('path');
  const zip = new JSZip();
  const imgBuf = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'fixture-c.png'));
  const projectJson = {
    appVersion: '2.22.0',
    exportedAt: new Date().toISOString(),
    projectName: '架空プロジェクト：ZIPマージテスト',
    projectInfo: { client: '', author: '', date: '', notes: '' },
    scenes: [{
      id: 'fixlc-zip-scene', name: '架空ZIPシーン', fileName: 'fixture-c.png',
      flipped: false, floorplanId: null, groupId: null,
    }],
    groups: [], floorplans: [], markers: [], compareSets: [],
  };
  zip.file('project.json', JSON.stringify(projectJson, null, 2));
  zip.file('panoramas/fixture-c.png', imgBuf);
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = { gotoApp, expectNoErrors, dirtyIndicator, enterEditor, buildZipFixtureBuffer };
