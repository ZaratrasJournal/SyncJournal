const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1480, height: 3200 } });
  page.on("pageerror", e => console.error("pageerror:", e.message));
  const fp = path.resolve(__dirname, "..", "demos", "analytics-redesign-demo.html").split(path.sep).join("/");
  await page.goto("file:///" + fp, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/analytics-redesign-demo.png", fullPage: true });
  console.log("✓ screenshot saved");
  await browser.close();
})();
