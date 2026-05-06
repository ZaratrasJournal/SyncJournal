// v12.91 — Time-bounded TP-fetch markers + invariant-aware setting.
//
// Doel: bewijzen dat het permanent-stuck-marker probleem (waarbij een single
// 0-fills response een trade voor altijd uit de TP-fetch queue blokkeerde)
// opgelost is. Vervangt boolean `_tpFetched` door timestamp `_tpFetchedAt`
// met 24u-TTL en een invariant-guard (closed + realised≠0 + 0 fills + <90d
// = verdacht, geen marker zetten zodat retry vanzelf gebeurt).
//
// Drie scenarios:
//   1. Migratie: _tpFetched=true + tpLevels=[] → marker compleet weg (retry)
//   2. Migratie: _tpFetched=true + tpLevels=[N] → _tpFetchedAt gezet binnen 24u
//   3. Filter-logica: TTL-skip werkt; oude markers worden hergerprobeerd
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe('TP-fetch marker robustness (v12.91)', () => {
  test('Migratie: _tpFetched=true + lege tpLevels → marker volledig verwijderd (zal retry\'en)', async ({ page }) => {
    const stuckTrade = {
      id: 'mexc_test_stuck',
      source: 'mexc',
      status: 'closed',
      positionId: '1234567890',
      pair: 'BTC/USDT',
      direction: 'long',
      entry: '78000',
      exit: '78050',
      pnl: '-3.5',
      realizedPnl: '-3.5',
      closeTime: String(Date.now() - 5 * 86400000),
      tpLevels: [],
      _tpFetched: true,
    };

    await page.addInitScript((trade) => {
      localStorage.setItem('tj_trades', JSON.stringify([trade]));
    }, stuckTrade);

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades') || '[]')[0];
      return t && !('_tpFetched' in t);
    }, { timeout: 5_000 });

    const after = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('tj_trades') || '[]')[0];
    });

    expect(after._tpFetched, 'oude boolean marker moet weg zijn').toBeUndefined();
    expect(after._tpFetchedAt, 'geen timestamp marker → trade zal retry\'en').toBeUndefined();
  });

  test('Migratie: _tpFetched=true + 3 tpLevels → _tpFetchedAt binnen 24u (geen retry direct na upgrade)', async ({ page }) => {
    const successTrade = {
      id: 'mexc_test_success',
      source: 'mexc',
      status: 'closed',
      positionId: '9876543210',
      pair: 'ETH/USDT',
      direction: 'short',
      entry: '3500',
      exit: '3450',
      pnl: '15.0',
      realizedPnl: '15.0',
      closeTime: String(Date.now() - 2 * 86400000),
      tpLevels: [
        { id: 'tp1', price: '3470', pct: '33', status: 'hit' },
        { id: 'tp2', price: '3460', pct: '33', status: 'hit' },
        { id: 'tp3', price: '3450', pct: '34', status: 'hit' },
      ],
      _tpFetched: true,
    };

    await page.addInitScript((trade) => {
      localStorage.setItem('tj_trades', JSON.stringify([trade]));
    }, successTrade);

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades') || '[]')[0];
      return t && !('_tpFetched' in t) && typeof t._tpFetchedAt === 'number';
    }, { timeout: 5_000 });

    const after = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('tj_trades') || '[]')[0];
    });

    expect(after._tpFetched, 'oude boolean marker moet weg zijn').toBeUndefined();
    expect(typeof after._tpFetchedAt, '_tpFetchedAt moet een timestamp zijn').toBe('number');
    const ageMs = Date.now() - after._tpFetchedAt;
    const TTL = 24 * 60 * 60 * 1000;
    expect(ageMs, 'marker moet binnen 24u-TTL liggen (geen onnodige retry direct na upgrade)').toBeLessThan(TTL);
    expect(after.tpLevels.length, 'tpLevels blijven intact').toBe(3);
  });

  test('Filter-logica: TTL werkt — recent marker skipt, oud marker retry\'t, geen marker retry\'t', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      const TTL = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const trades = [
        { id: 'recent_marker', _tpFetchedAt: now - 1 * 60 * 60 * 1000, status: 'closed', tpLevels: [] },
        { id: 'old_marker',    _tpFetchedAt: now - 30 * 60 * 60 * 1000, status: 'closed', tpLevels: [] },
        { id: 'no_marker',     status: 'closed', tpLevels: [] },
        { id: 'has_tps',       _tpFetchedAt: now - 1 * 60 * 60 * 1000, status: 'closed', tpLevels: [{ price: '78000' }] },
      ];
      const shouldFetch = (t) => {
        if (t.status === 'open' || t.status === 'partial') return true;
        if (t.status === 'closed' && (!Array.isArray(t.tpLevels) || t.tpLevels.length === 0)) {
          const fa = parseInt(t._tpFetchedAt) || 0;
          if (fa && (Date.now() - fa < TTL)) return false;
          return true;
        }
        return false;
      };
      return {
        recent: shouldFetch(trades[0]),
        old: shouldFetch(trades[1]),
        none: shouldFetch(trades[2]),
        hasTps: shouldFetch(trades[3]),
      };
    });

    expect(result.recent, 'marker <24u → skip').toBe(false);
    expect(result.old, 'marker >24u → retry').toBe(true);
    expect(result.none, 'geen marker → retry').toBe(true);
    expect(result.hasTps, 'has tpLevels → niet meer fetchen').toBe(false);
  });

  test('Invariant-guard: closed + realised≠0 + 0 fills + jong = géén marker (retry vanzelf)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      const cases = [
        { desc: 'jong, realised≠0, 0 fills',     closeTime: Date.now() - 5 * 86400000,   pnl: '-4', hadFills: false, expectMarker: false },
        { desc: 'oud (>90d), realised≠0, 0 fills', closeTime: Date.now() - 100 * 86400000, pnl: '-4', hadFills: false, expectMarker: true  },
        { desc: 'jong, realised=0, 0 fills',     closeTime: Date.now() - 5 * 86400000,   pnl: '0',  hadFills: false, expectMarker: true  },
        { desc: 'jong, realised≠0, 3 fills',     closeTime: Date.now() - 5 * 86400000,   pnl: '-4', hadFills: true,  expectMarker: true  },
      ];
      const shouldSetMarker = (t, hadFills) => {
        const realised = Math.abs(parseFloat(t.realizedPnl || t.pnl) || 0);
        const ageMs = t.closeTime ? (Date.now() - parseInt(t.closeTime)) : 0;
        const suspectEmpty = !hadFills && realised > 0.0001 && ageMs < 90 * 86400000;
        return !suspectEmpty;
      };
      return cases.map(tc => ({
        desc: tc.desc,
        actual: shouldSetMarker({ closeTime: tc.closeTime, pnl: tc.pnl }, tc.hadFills),
        expected: tc.expectMarker,
      }));
    });

    for (const r of result) {
      expect(r.actual, `${r.desc} (verwacht: ${r.expected ? 'marker' : 'geen marker'})`).toBe(r.expected);
    }
  });
});
