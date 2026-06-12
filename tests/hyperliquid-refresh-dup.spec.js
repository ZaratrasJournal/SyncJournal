// v12.235: Hyperliquid/Kraken refresh-duplicaten (jordy, Discord 2026-06-12).
//
// Ketting vóór de fix:
//  1. fetchOpenPositions maakt een open-PLACEHOLDER met date/time = sync-moment.
//  2. Na sluiting consumeerde de finalize-flow de échte fills-round-trip (verwijderd!)
//     en promoveerde de placeholder → closed record met niet-bestaande open-tijd en
//     geaggregeerde (dubbele) size.
//  3. De volgende fetchTrades bracht dezelfde round-trip opnieuw binnen → het
//     geconsumeerde id bestond niet meer → permanent duplicaat.
//
// Fix: openIsPlaceholder-exchanges laten de placeholder vallen en behouden de
// fills-trade (stabiel id → re-fetch dedupt), met overname van user-velden.
// Deze spec drijft het importTrades-pad via de backup-import (zelfde code-pad als
// een handmatige refresh-import).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const ACC = { id: 'acc_hl', type: 'hyperliquid', label: 'Swing', walletAddress: '0xabc', transactions: [] };

// De open-placeholder zoals fetchOpenPositions + scopeToAccount 'm maken:
// id genamespaced, date/time = moment van syncen (NIET de echte open-tijd), user-velden gezet.
const PLACEHOLDER = {
  id: 'acc_hl_hyperliquid_open_BTC', positionId: 'BTC', source: 'acc_hl', status: 'open',
  pair: 'BTC/USDC', direction: 'long', entry: '62100', exit: '', stopLoss: '61000', takeProfit: '',
  positionSize: '14.90', positionSizeAsset: '0.00024', pnl: '', fees: '0',
  date: '2026-06-10', time: '19:03', openTime: '', closeTime: '',
  notes: 'placeholder-notitie van de member', setupTags: ['BOS'],
  confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  tpLevels: [], layers: [], links: [], screenshots: [], rating: 0,
};

// De échte round-trip zoals _reconstructTrades 'm uit de fills bouwt (echte tijden uit
// Hyperliquid: open 18:46:24, close 23:12:47 — vgl. member-screenshots + snapshot-format).
const FILLS_TRADE = {
  id: 'hyperliquid_660402961272300', positionId: '660402961272300', source: 'acc_hl', status: 'closed',
  pair: 'BTC/USDC', direction: 'long', entry: '62100', exit: '61491',
  positionSize: '14.90', positionSizeAsset: '0.00024', pnl: '-0.1602', fees: '0.0100',
  date: '2026-06-10', time: '18:46', openTime: '1781109984000', closeTime: '1781125967000',
  notes: '', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [],
  mistakeTags: [], customTags: [], tpLevels: [], layers: [], links: [], screenshots: [], rating: 0,
};

test('placeholder + fills-import → één trade met fills-id, user-velden overgenomen, re-import dedupt', async ({ page }) => {
  await page.addInitScript(seedLocalStorage, {
    trades: [PLACEHOLDER],
    accounts: [ACC],
    config: { defaultQuote: 'USDT', exchanges: {}, theme: 'sync', accountsSchema: 2 },
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { location.hash = '#/accounts'; });
  await page.waitForTimeout(1200);

  const tmp = path.join(os.tmpdir(), 'tj-hl-fills.json');
  fs.writeFileSync(tmp, JSON.stringify({ trades: [FILLS_TRADE] }));
  const input = page.locator('input[type="file"][accept=".json"]').first();
  await input.setInputFiles(tmp);
  await page.waitForTimeout(1800);

  const after1 = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    const btc = trades.filter(t => t.pair === 'BTC/USDC' && t.direction === 'long');
    return btc.map(t => ({ id: t.id, status: t.status, time: t.time, notes: t.notes, setupTags: t.setupTags, stopLoss: t.stopLoss, pnl: t.pnl }));
  });
  console.log('na import:', JSON.stringify(after1));

  // Eén trade — de fills-versie (stabiel id, echte tijd, echte pnl) — geen placeholder meer
  expect(after1.length).toBe(1);
  expect(after1[0].id).toBe('hyperliquid_660402961272300');
  expect(after1[0].status).toBe('closed');
  expect(after1[0].time).toBe('18:46');
  expect(parseFloat(after1[0].pnl)).toBeCloseTo(-0.1602, 4);
  // User-velden van de placeholder zijn meegekomen
  expect(after1[0].notes).toBe('placeholder-notitie van de member');
  expect(after1[0].setupTags).toEqual(['BOS']);
  expect(after1[0].stopLoss).toBe('61000');

  // Re-import van dezelfde fills (= volgende refresh) → dedup op id, nog steeds één trade
  await input.setInputFiles(tmp);
  await page.waitForTimeout(1500);
  const after2 = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return trades.filter(t => t.pair === 'BTC/USDC' && t.direction === 'long').length;
  });
  expect(after2).toBe(1);
  fs.unlinkSync(tmp);
});
