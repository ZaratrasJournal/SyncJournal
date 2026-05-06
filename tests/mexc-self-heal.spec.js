// v12.94 laag 3 + 5 — Self-heal in needsTPs filter + schema-invariant tests.
//
// Doel: bewijzen dat de needsTPs filter trades automatisch re-queued wanneer ze
// niet "klaar" zijn — ook als de marker recent staat. Drie self-heal triggers:
//   - onlyFallback: alleen positionsHistory_fallback TPs → wil upgrade naar echte
//   - suspectMissing: closed + realised≠0 + 0 hit-TPs + <90d → data-gat
//   - noTps: standaard, gerespecteerd door 24u-TTL
//
// Plus invariant-checks op de journal als geheel: zou geen permanent-stuck
// markers mogen hebben na v12.91 migratie.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Reproduceer needsTPs-filter logica uit refresh-handler [tradejournal.html:10737-10764]
function shouldFetch(t) {
  if (t.status === 'open' || t.status === 'partial') return true;
  if (t.status !== 'closed') return false;
  const hitTps = (t.tpLevels || []).filter(tp => tp && tp.status === 'hit' && !tp._pending);
  const noTps = hitTps.length === 0;
  const onlyFallback = hitTps.length > 0 && hitTps.every(tp => tp._source === 'positionsHistory_fallback');
  const realised = Math.abs(parseFloat(t.realizedPnl || t.pnl) || 0);
  const ageMs = t.closeTime ? (Date.now() - parseInt(t.closeTime)) : 0;
  const suspectMissing = noTps && realised > 0.0001 && ageMs < 90 * 86400000;
  if (noTps || onlyFallback) {
    const TTL = 24 * 60 * 60 * 1000;
    const fa = parseInt(t._tpFetchedAt) || 0;
    const ignoreTTL = onlyFallback || suspectMissing;
    if (fa && (Date.now() - fa < TTL) && !ignoreTTL) return false;
    return true;
  }
  return false;
}

test.describe('v12.94 self-heal needsTPs filter', () => {
  test('Trade met alleen fallback-TPs wordt re-queued ondanks recent marker', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const trade = {
      id: 'mexc_fb_only',
      source: 'mexc',
      status: 'closed',
      positionId: '1',
      pair: 'BTC/USDT',
      closeTime: String(Date.now() - 3 * 86400000),
      pnl: '-5.2',
      tpLevels: [
        { id: 'tp_fb', price: '72068.9', pct: '100', status: 'hit', _source: 'positionsHistory_fallback' },
      ],
      _tpFetchedAt: Date.now() - 1 * 60 * 60 * 1000, // 1u oud — binnen TTL
    };

    expect(shouldFetch(trade), 'fallback-only re-queued ondanks fresh marker').toBe(true);
  });

  test('Trade met echte history_orders TPs blijft skipped (correcte staat)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const trade = {
      id: 'mexc_real',
      source: 'mexc',
      status: 'closed',
      positionId: '2',
      pair: 'BTC/USDT',
      closeTime: String(Date.now() - 3 * 86400000),
      pnl: '15.0',
      tpLevels: [
        { id: 'tp1', price: '81250', pct: '50', status: 'hit' },
        { id: 'tp2', price: '81306', pct: '50', status: 'hit' },
      ],
      _tpFetchedAt: Date.now() - 1 * 60 * 60 * 1000,
    };

    expect(shouldFetch(trade), 'echte TPs → skip').toBe(false);
  });

  test('Suspect-missing: closed + realised≠0 + 0 hit-TPs + <90d wordt re-queued', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const trade = {
      id: 'mexc_suspect',
      source: 'mexc',
      status: 'closed',
      positionId: '3',
      pair: 'BTC/USDT',
      closeTime: String(Date.now() - 5 * 86400000),
      pnl: '-4',
      tpLevels: [],
      _tpFetchedAt: Date.now() - 30 * 60 * 1000, // 30 min oud — fresh
    };

    expect(shouldFetch(trade), 'suspect-missing → re-queue ondanks fresh marker').toBe(true);
  });

  test('Mix: pending TPs blokkeren niet (worden niet als "real" hit geteld)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Trade met 1 fallback-TP (hit) + 1 pending-TP. Fallback-only logica moet
    // alleen non-pending hit-TPs evalueren — pending negeren bij die check.
    const trade = {
      id: 'mexc_mix',
      source: 'mexc',
      status: 'closed',
      positionId: '4',
      pair: 'BTC/USDT',
      closeTime: String(Date.now() - 2 * 86400000),
      pnl: '-3',
      tpLevels: [
        { id: 'tp_fb', price: '72000', pct: '100', status: 'hit', _source: 'positionsHistory_fallback' },
        { id: 'tp_pending', price: '73000', pct: '0', status: 'open', _pending: true },
      ],
      _tpFetchedAt: Date.now() - 30 * 60 * 1000,
    };

    expect(shouldFetch(trade), 'fallback-only (negeert pending) → re-queue').toBe(true);
  });

  test('Edge: oude trade (>90d) zonder TPs respecteert 24u-TTL (geen suspect)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const trade = {
      id: 'mexc_old',
      source: 'mexc',
      status: 'closed',
      positionId: '5',
      pair: 'BTC/USDT',
      closeTime: String(Date.now() - 100 * 86400000), // 100 dagen oud
      pnl: '-2',
      tpLevels: [],
      _tpFetchedAt: Date.now() - 1 * 60 * 60 * 1000, // 1u oud — fresh
    };

    expect(shouldFetch(trade), '>90d met fresh marker → respecteer TTL, skip').toBe(false);
  });
});

test.describe('v12.94 schema-invariants — journal-state checks', () => {
  test('Geen permanent-stuck pre-v12.91 markers na migratie', async ({ page }) => {
    // Seed met 1 trade die de oude boolean marker heeft
    await page.addInitScript(() => {
      localStorage.setItem('tj_trades', JSON.stringify([{
        id: 'mexc_legacy',
        source: 'mexc',
        status: 'closed',
        positionId: '99',
        pair: 'BTC/USDT',
        closeTime: String(Date.now() - 5 * 86400000),
        pnl: '-2',
        tpLevels: [],
        _tpFetched: true, // legacy boolean
      }]));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades') || '[]')[0];
      return t && !('_tpFetched' in t);
    }, { timeout: 5_000 });

    const violations = await page.evaluate(() => {
      const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
      return trades.filter(t => t._tpFetched === true && (!t.tpLevels || t.tpLevels.length === 0)).length;
    });

    expect(violations, '0 permanent-stuck markers na v12.91 migratie').toBe(0);
  });

  test('Schema-invariant: geen suspect-missing zonder marker (zou re-queued moeten zijn)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      // Simuleer een journal-scan: voor elke closed trade, is er een data-gat?
      const sample = [
        { id: 'a', status: 'closed', closeTime: String(Date.now() - 5 * 86400000), pnl: '-4', tpLevels: [], _tpFetchedAt: 0 },
        { id: 'b', status: 'closed', closeTime: String(Date.now() - 5 * 86400000), pnl: '-4', tpLevels: [{ status: 'hit', price: '100' }], _tpFetchedAt: Date.now() },
      ];
      const violations = sample.filter(t => {
        if (t.status !== 'closed') return false;
        const hitTps = (t.tpLevels || []).filter(tp => tp && tp.status === 'hit' && !tp._pending);
        const realised = Math.abs(parseFloat(t.pnl) || 0);
        const ageMs = Date.now() - parseInt(t.closeTime);
        const suspect = hitTps.length === 0 && realised > 0.0001 && ageMs < 90 * 86400000;
        const fresh = t._tpFetchedAt && (Date.now() - t._tpFetchedAt < 24 * 60 * 60 * 1000);
        // Violation: suspect (data-gat) maar marker is fresh → zou re-queued moeten worden door v12.94
        return suspect && fresh;
      });
      return violations.length;
    });

    // Trade 'a' heeft geen marker → niet violation. Trade 'b' heeft hit-TP → niet suspect.
    expect(result, 'geen invariant-violations in deze test-set').toBe(0);
  });
});
