// Borging voor backlog-bug (NielsB, 2026-04-30): "%-toggle laat PnL verdwijnen" op de
// oude MEXC-stijl share-card. Die kaart is in v12.64 vervangen door de 4-directions
// share-card v2. Deze spec verifieert dat het gemelde gedrag in de nieuwe kaarten NIET
// bestaat: met de %-toggle AAN blijft de PnL gewoon zichtbaar, en een trade zónder
// size-velden (waar return-% niet berekenbaar is) toont "—" i.p.v. een lege kaart.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test('share-card v2: %-toggle aan → PnL blijft zichtbaar; pct zonder size → "—"', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tj_welcomed', '1'));
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof tcDataFromTrade === 'function' && typeof tcRenderReactions16x9 === 'function', { timeout: 30_000 });

  const r = await page.evaluate(() => {
    const baseTrade = {
      id: 'mexc_x', pair: 'BTC/USDT', direction: 'short', status: 'closed', source: 'mexc',
      entry: '80282.5', exit: '79857.5', stopLoss: '81000', pnl: '14.27',
      positionSize: '336', positionSizeAsset: '0.004185',
      openTime: '1777000000000', closeTime: '1777003600000', setupTags: ['BOS'],
    };
    const fieldsOn = { tradenr: true, date: true, pnl: true, pct: true, rmult: true, hold: true, entryexit: true, stop: false, setup: true };
    const fieldsNoPct = { ...fieldsOn, pct: false };

    const reactKey = Object.keys(TC_REACT).find(k => !TC_REACT[k].isPreEntry) || Object.keys(TC_REACT)[0];
    const render = (trade, fields) => {
      const d = tcDataFromTrade(trade, fields);
      return {
        reactions: tcRenderReactions16x9(reactKey, d),
        monogram: tcRenderMonogram16x9(d),
        pct: d.pct,
      };
    };

    const withPct = render(baseTrade, fieldsOn);
    const withoutPct = render(baseTrade, fieldsNoPct);
    // MEXC-trade zonder size-velden → pct niet berekenbaar
    const noSize = render({ ...baseTrade, positionSize: '', positionSizeAsset: '' }, fieldsOn);

    return {
      pctValue: withPct.pct,
      // PnL (tcFmtMoney bevat het bedrag met komma) zichtbaar mét en zonder %-toggle:
      pnlVisibleWithPct: withPct.reactions.includes('+$14') && withPct.monogram.includes('+$14'),
      pnlVisibleWithoutPct: withoutPct.reactions.includes('+$14'),
      pctShownWithToggle: withPct.reactions.includes('%'),
      // Zonder size: pct → "—" maar PnL blijft staan (de gemelde bug was: PnL weg)
      noSizePnlVisible: noSize.reactions.includes('+$14'),
      noSizePctDash: noSize.reactions.includes('—'),
    };
  });

  // return% = pnl/notional: 14.27 / 336 ≈ +4.25%
  expect(r.pctValue).toBeCloseTo(4.247, 2);
  expect(r.pnlVisibleWithPct).toBe(true);
  expect(r.pnlVisibleWithoutPct).toBe(true);
  expect(r.pctShownWithToggle).toBe(true);
  expect(r.noSizePnlVisible).toBe(true);
  expect(r.noSizePctDash).toBe(true);
});
