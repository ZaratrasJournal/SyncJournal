// Quick headless check of demos/trades-merge-demo.html
// Walks through the full flow: select 4 -> open modal -> confirm -> open detail -> demerge.

const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  const url = "file:///" + path.resolve("demos/trades-merge-demo.html").replace(/\\/g, "/");
  await page.goto(url);
  await page.waitForTimeout(200);

  // Step 1: initial render
  const step1Count = await page.locator("#vis-count").textContent();
  console.log("Step 1 - visible:", step1Count);
  await page.screenshot({ path: "tests/screenshots/merge-demo-1-initial.png" });

  // Step 2: select all 4 mergeable
  await page.click("#btn-toggle-all");
  await page.waitForTimeout(150);
  const selCount = await page.locator("#sel-count").textContent();
  console.log("Step 2 - selected:", selCount);
  await page.screenshot({ path: "tests/screenshots/merge-demo-2-selected.png" });

  // Step 3: open merge modal
  await page.click("#btn-merge");
  await page.waitForTimeout(200);
  const modalVisible = await page.locator("#merge-modal").isVisible();
  console.log("Step 3 - merge modal visible:", modalVisible);
  await page.screenshot({ path: "tests/screenshots/merge-demo-3-modal.png", fullPage: true });

  // Inspect master preview
  const previewValue = await page.locator("#master-preview .stat:nth-child(1) .value").textContent();
  console.log("Step 3 - master entry preview:", previewValue);
  const pnlValue = await page.locator("#master-preview .stat:nth-child(4) .value").textContent();
  console.log("Step 3 - master PnL preview:", pnlValue);
  const conflicts = await page.locator(".conflict").count();
  console.log("Step 3 - conflicts detected:", conflicts);

  // Step 4: confirm merge
  await page.click("#merge-modal .btn-primary");
  await page.waitForTimeout(300);
  const visAfter = await page.locator("#vis-count").textContent();
  console.log("Step 4 - visible after merge:", visAfter, "(expect 11: 10 history + 1 master)");
  const mergedBadge = await page.locator(".merged-badge").count();
  console.log("Step 4 - merged-badge count:", mergedBadge);
  await page.screenshot({ path: "tests/screenshots/merge-demo-4-merged.png" });

  // Step 5: open detail modal of master
  await page.click(".merged-badge");
  await page.waitForTimeout(200);
  const detailVisible = await page.locator("#detail-modal").isVisible();
  console.log("Step 5 - detail modal visible:", detailVisible);
  const tpRows = await page.locator(".tp-row").count();
  console.log("Step 5 - TP rows shown:", tpRows);
  await page.screenshot({ path: "tests/screenshots/merge-demo-5-detail.png", fullPage: true });

  // Step 6: demerge (auto-confirm)
  page.on("dialog", async d => await d.accept());
  await page.click(".btn-danger");
  await page.waitForTimeout(300);
  const visEnd = await page.locator("#vis-count").textContent();
  console.log("Step 6 - visible after demerge:", visEnd, "(expect 14)");
  await page.screenshot({ path: "tests/screenshots/merge-demo-6-demerged.png" });

  console.log("\nErrors:", errors.length === 0 ? "none ✓" : errors);

  await browser.close();
})();
