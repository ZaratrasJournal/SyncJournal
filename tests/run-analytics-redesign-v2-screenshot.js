const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  // Beginner mode (default)
  const page1 = await (await browser.newContext({ viewport: { width: 1680, height: 3000 } })).newPage();
  page1.on("pageerror", e => console.error("pageerror:", e.message));
  const fp = path.resolve(__dirname, "..", "demos", "analytics-redesign-v2-demo.html").split(path.sep).join("/");
  await page1.goto("file:///" + fp, { waitUntil: "networkidle" });
  await page1.waitForTimeout(400);
  await page1.screenshot({ path: "tests/screenshots/analytics-v2-beginner.png", fullPage: true });
  console.log("✓ beginner screenshot saved");
  // Advanced mode
  const page2 = await (await browser.newContext({ viewport: { width: 1680, height: 5000 } })).newPage();
  await page2.goto("file:///" + fp, { waitUntil: "networkidle" });
  await page2.waitForTimeout(200);
  await page2.click('.mode-btn[data-mode="advanced"]');
  await page2.waitForTimeout(400);
  await page2.screenshot({ path: "tests/screenshots/analytics-v2-advanced.png", fullPage: true });
  console.log("✓ advanced screenshot saved");
  await browser.close();
})();
