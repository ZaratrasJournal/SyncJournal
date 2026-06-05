const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1320, height: 4500 } });
  page.on("pageerror", e => console.error("pageerror:", e.message));
  const fullPath = path.resolve(__dirname, "..", "demos", "layer-bias-demo.html").split(path.sep).join("/");
  const url = "file:///" + fullPath;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "tests/screenshots/layer-bias-demo.png", fullPage: true });
  console.log("✓ screenshot saved");
  await browser.close();
})();
