// Minimal Playwright config voor TradeJournal — single-file HTML, file:// URL.
// Geen webServer nodig (geen build-step). Tests draaien tegen file:///.../work/tradejournal.html.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Match alleen *.spec.js — overige .js files in tests/ zijn helpers/runners
  testMatch: '**/*.spec.js',
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
