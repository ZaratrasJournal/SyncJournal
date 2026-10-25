// Playwright config for SyncJournal's runner-style specs (test()/expect from @playwright/test).
// tests/ also holds ~80 standalone Node specs that start their own browser and call
// process.exit(); if Playwright collects those they run during collection and can abort the
// whole run. So testMatch only lists specs that import @playwright/test.
// The release gate is `npm test` (node tests/run-release.js), not `npx playwright test`.
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs'), path = require('path');

const TESTS = path.join(__dirname, 'tests');
const RUNNER = /require\(['"]@playwright\/test['"]\)|from ['"]@playwright\/test['"]/; // same check as run-all-sj.js
const runnerSpecs = fs.readdirSync(TESTS)
  .filter((f) => f.endsWith('.spec.js') && RUNNER.test(fs.readFileSync(path.join(TESTS, f), 'utf8')));

module.exports = defineConfig({
  testDir: './tests',
  testMatch: runnerSpecs,
  fullyParallel: false, // single browser instance prevents file-lock issues
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 }, // moderne desktop, geen Cline-900x600 bug
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
});
