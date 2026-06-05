// Quick screenshot van layer-colors-demo.html voor visuele validatie.
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 4000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const url = "file:///" + path.resolve("demos/layer-colors-demo.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  await page.screenshot({
    path: "tests/screenshots/layer-colors-all-themes.png",
    fullPage: true,
  });
  console.log("Errors:", errors.length === 0 ? "none ✓" : errors);
  await browser.close();
})();
