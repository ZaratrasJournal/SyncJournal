// v12.211: merge-feature uitgebreid naar handmatige accounts + generieke "manual" source.
// Verifieert dat:
//   - Seed met 3 trades zelfde manual-account → helper canMergeSource = true
//   - Seed met cross-source (manual + blofin) → canMergeSource = false
//   - Seed met cross-account (account A + account B) → één source check faalt
//   - Account verwijderd → merge geblocked (zombie-protect)
//
// Geen UI-click-flow — die zat al in tests/merge-trades.spec.js (FTMO).
// Hier valideren we alleen de source-gate via window-helpers.

const { test, expect } = require("@playwright/test");
const path = require("path");

const url = "file:///" + path.resolve(__dirname, "..", "work", "tradejournal.html").replace(/\\/g, "/");

const baseTrade = (overrides) => ({
  id: "t_" + Math.random().toString(36).slice(2, 8),
  date: "2026-06-06", time: "10:00",
  pair: "BTC/USDT", direction: "long",
  entry: "68000", exit: "68500",
  stopLoss: "67800",
  positionSize: "6800", positionSizeAsset: "0.1",
  pnl: "45.00", fees: "5.00",
  status: "closed",
  source: "manual",
  setupTags: [], confirmationTags: [], timeframeTags: [],
  emotionTags: [], mistakeTags: [], customTags: [], layers: [],
  ...overrides,
});

test.describe("v12.211 manual-account merge source-gate", () => {
  test("3 manual trades zelfde account → canMergeSource true", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

    const trades = [
      baseTrade({ source: "MyDemoAccount", pnl: "45.00" }),
      baseTrade({ source: "MyDemoAccount", pnl: "62.00" }),
      baseTrade({ source: "MyDemoAccount", pnl: "30.00" }),
    ];
    const accounts = [{ id: "a1", name: "MyDemoAccount", transactions: [] }];

    await page.addInitScript(({ t, a }) => {
      localStorage.setItem("tj_trades", JSON.stringify(t));
      localStorage.setItem("tj_accounts", JSON.stringify(a));
      localStorage.setItem("tj_welcomed", "1");
      localStorage.setItem("tj_onboarded", "1");
      localStorage.setItem("tj_milestones_seen", JSON.stringify(["10","25","50","100","250","500","1000"]));
    }, { t: trades, a: accounts });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15000 });
    await page.waitForTimeout(600);

    // Check helpers in window-scope
    const result = await page.evaluate(() => {
      const accounts = JSON.parse(localStorage.getItem("tj_accounts"));
      return {
        canMerge: canMergeSource("MyDemoAccount", accounts),
        label: getSourceLabel("MyDemoAccount", accounts),
      };
    });
    expect(result.canMerge).toBe(true);
    expect(result.label).toBe("MyDemoAccount");

    expect(errors.filter(e => !/favicon/.test(e) && !/\[BABEL\] Note/.test(e))).toEqual([]);
  });

  test("cross-account (A vs B) → één source check faalt voor zelfde-source eis", async ({ page }) => {
    const trades = [
      baseTrade({ source: "AccountA", pnl: "20" }),
      baseTrade({ source: "AccountB", pnl: "30" }),
    ];
    const accounts = [
      { id: "a", name: "AccountA", transactions: [] },
      { id: "b", name: "AccountB", transactions: [] },
    ];

    await page.addInitScript(({ t, a }) => {
      localStorage.setItem("tj_trades", JSON.stringify(t));
      localStorage.setItem("tj_accounts", JSON.stringify(a));
      localStorage.setItem("tj_welcomed", "1");
    }, { t: trades, a: accounts });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // Beide accounts kunnen INDIVIDUEEL mergen, maar gate vereist één unique source
    const result = await page.evaluate(() => {
      const accs = JSON.parse(localStorage.getItem("tj_accounts"));
      const ts = JSON.parse(localStorage.getItem("tj_trades"));
      const sources = new Set(ts.map(t => t.source));
      return {
        bothSourcesAllowed: canMergeSource("AccountA", accs) && canMergeSource("AccountB", accs),
        uniqueSourceCount: sources.size,
        gateBlocksCrossAccount: sources.size > 1,
      };
    });
    expect(result.bothSourcesAllowed).toBe(true); // beide accounts zijn whitelist
    expect(result.uniqueSourceCount).toBe(2);     // maar 2 verschillende sources
    expect(result.gateBlocksCrossAccount).toBe(true); // dus gate blokkeert (in UI-code)
  });

  test("manual + crypto-exchange → gate blokkeert (blofin niet whitelist)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tj_trades", JSON.stringify([]));
      localStorage.setItem("tj_welcomed", "1");
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => ({
      manualOk: canMergeSource("manual", []),
      blofinBlocked: canMergeSource("blofin", []) === false,
      mexcBlocked: canMergeSource("mexc", []) === false,
      krakenBlocked: canMergeSource("kraken", []) === false,
      hyperliquidBlocked: canMergeSource("hyperliquid", []) === false,
    }));
    expect(result.manualOk).toBe(true);
    expect(result.blofinBlocked).toBe(true);
    expect(result.mexcBlocked).toBe(true);
    expect(result.krakenBlocked).toBe(true);
    expect(result.hyperliquidBlocked).toBe(true);
  });

  test("account verwijderd → merge geblocked (zombie-protect)", async ({ page }) => {
    await page.addInitScript(() => {
      // Trade verwijst naar "OldAccount" maar account bestaat niet meer
      const trades = [
        { id: "z1", date: "2026-06-06", time: "10:00", pair: "BTC/USDT", direction: "long",
          entry: "68000", exit: "68500", stopLoss: "67800", positionSize: "6800",
          pnl: "20", status: "closed", source: "OldAccount",
          setupTags: [], confirmationTags: [], timeframeTags: [],
          emotionTags: [], mistakeTags: [], customTags: [], layers: [] },
      ];
      localStorage.setItem("tj_trades", JSON.stringify(trades));
      localStorage.setItem("tj_accounts", JSON.stringify([])); // accounts leeg
      localStorage.setItem("tj_welcomed", "1");
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const blocked = await page.evaluate(() => canMergeSource("OldAccount", []) === false);
    expect(blocked).toBe(true);
  });
});
