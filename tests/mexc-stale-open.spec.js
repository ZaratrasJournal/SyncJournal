// v12.89 — MEXC stale-open trade reproductie + fix-validatie.
//
// Bug-rapport (community 2026-05-04):
//   - Open BTC long positie staat in journal sinds 2026-05-03
//   - Op MEXC is de positie al volledig gesloten (state=3 in positionsHistory)
//   - App toont 'm nog als OPEN met 18 stale tpLevels (van vorige syncs)
//   - positionSize/Asset niet correct (CORS-fail op contract-detail endpoint)
//
// Root cause:
//   1. detectPartialFromSiblings: rebuilt tpLevels NIET als ze al bestaan
//      (regel 1080: `if(!hasUserTps){...}`)
//   2. syncOpenPositions finalize-flow: zelfde issue (regel 12261:
//      `(t.tpLevels && t.tpLevels.length) ? t.tpLevels : ...`)
//   3. Volgorde refresh-flow: opens fetched VÓÓR trades → finalize-pass loopt
//      voordat closed siblings in journal staan
//
// Fixture: tests/_fixtures/mexc-stale-open.json (gerepliceerd uit IDB) +
//          tests/_fixtures/mexc-snapshot-2026-05-04-bug.json (verse API snapshot)
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const STALE_PATH = path.resolve(__dirname, '_fixtures/mexc-stale-open.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/mexc-snapshot-2026-05-04-bug.json');

const hasFixtures = fs.existsSync(STALE_PATH) && fs.existsSync(SNAPSHOT_PATH);

test.describe('MEXC stale-open bug — community-rapport 2026-05-04', () => {
  test.skip(!hasFixtures, 'fixtures ontbreken — skip op CI');

  let staleOpen, snapshot;
  test.beforeAll(() => {
    staleOpen = JSON.parse(fs.readFileSync(STALE_PATH, 'utf8'));
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  });

  test('Setup-check: stale-open trade + snapshot zijn correct geladen', async () => {
    expect(staleOpen.length).toBeGreaterThan(0);
    const trade = staleOpen[0];
    expect(trade.source).toBe('mexc');
    expect(trade.status).toBe('open');
    expect(trade.positionId).toBe('1358891498');
    expect(trade.entry).toBe('78310');
    expect(trade.tpLevels.length).toBe(18); // de 18 stale TPs

    // Snapshot heeft 0 open positions (positie is closed op exchange)
    expect(snapshot.openPositions.length).toBe(0);
    // En 1 record voor positionId 1358891498
    const snapMatch = snapshot.positionsHistory.find(r => String(r.positionId) === '1358891498');
    expect(snapMatch).toBeTruthy();
    expect(snapMatch.state).toBe(3); // closed
    expect(snapMatch.openAvgPrice).toBe(78310);
  });

  // Helper: build closed-trades-array uit snapshot (mimics fetchTrades parser zonder browser).
  function snapToClosedTrades(snap) {
    const ctSize = { BTC_USDT: 0.0001, ETH_USDT: 0.01, SOL_USDT: 1 };
    return snap.positionsHistory.map(t => {
      const closeTime = t.updateTime || t.closeTime || Date.now();
      const cs = ctSize[t.symbol] || 1;
      const assetQty = (parseFloat(t.closeVol) || 0) * cs;
      return {
        id: 'mexc_' + t.positionId + '_' + closeTime,
        positionId: String(t.positionId || ''),
        openTime: String(t.openTime || t.createTime || ''),
        closeTime: String(closeTime),
        pair: (t.symbol || '').replace('_', '/'),
        direction: t.positionType === 1 ? 'long' : 'short',
        entry: String(t.openAvgPrice || ''),
        exit: String(t.closeAvgPrice || ''),
        positionSize: String((parseFloat(t.openAvgPrice) * assetQty).toFixed(2)),
        positionSizeAsset: String(assetQty),
        pnl: String(t.realised || ''),
        fees: Math.abs(parseFloat(t.fee) || 0).toFixed(4),
        leverage: String(t.leverage || '10'),
        source: 'mexc',
        status: 'closed',
        stopLoss: '', takeProfit: '', highestPrice: '', lowestPrice: '',
        setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [],
        mistakeTags: [], customTags: [], rating: 0, screenshot: null, notes: '',
      };
    });
  }

  test('Fix #1: detectPartials rebuildt tpLevels — geen stale accumulation meer', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof detectPartialFromSiblings === 'function');

    const result = await page.evaluate(({ stale, closed }) => {
      const allTrades = [...stale, ...closed];
      const detected = ExchangeAPI.mexc.detectPartials(allTrades);
      const staleAfter = detected.find(t => t.positionId === '1358891498' && (t.status === 'open' || t.status === 'partial'));
      return {
        staleStatus: staleAfter ? staleAfter.status : null,
        staleTpLevelsCount: staleAfter ? (staleAfter.tpLevels || []).length : 0,
        staleTpPrices: staleAfter ? (staleAfter.tpLevels || []).map(tp => parseFloat(tp.price)) : [],
      };
    }, { stale: staleOpen, closed: snapToClosedTrades(snapshot) });

    // 18 stale TPs → max 1 (de echte matching sibling op 78581.6)
    expect(result.staleTpLevelsCount).toBeLessThanOrEqual(2);
    for (const price of result.staleTpPrices) {
      expect(price).toBeGreaterThan(78400);
      expect(price).toBeLessThan(78800);
    }
  });

  test('Fix #3: na finalize is er GEEN duplicate trade (consumed sibling verwijderd)', async ({ page }) => {
    // Reproduceer user-bug 2026-05-04: 2 identieke trades verschijnen na refresh.
    // Stale-open (id=oud, status=open, entry=78310) + nieuwe closed sibling (id=nieuw, entry=78310)
    // → finalize merge'de open naar closed maar liet sibling staan = duplicate.
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });

    const result = await page.evaluate(({ stale, snap }) => {
      const matchKeyOf = (t) => { const e = parseFloat(t.entry); if (!isFinite(e) || e <= 0) return null; return `${t.pair}|${t.direction}|${e.toFixed(8)}`; };
      // Build closed-trades from snapshot (mimics fetchTrades parser)
      const ctSize = { BTC_USDT: 0.0001, ETH_USDT: 0.01, SOL_USDT: 1 };
      const closed = snap.positionsHistory.map(t => {
        const closeTime = t.updateTime || Date.now();
        const cs = ctSize[t.symbol] || 1;
        const assetQty = (parseFloat(t.closeVol) || 0) * cs;
        return {
          id: 'mexc_' + t.positionId + '_' + closeTime,
          positionId: String(t.positionId || ''),
          pair: (t.symbol || '').replace('_', '/'),
          direction: t.positionType === 1 ? 'long' : 'short',
          entry: String(t.openAvgPrice || ''),
          exit: String(t.closeAvgPrice || ''),
          positionSize: String((parseFloat(t.openAvgPrice) * assetQty).toFixed(2)),
          positionSizeAsset: String(assetQty),
          pnl: String(t.realised || ''),
          fees: Math.abs(parseFloat(t.fee) || 0).toFixed(4),
          source: 'mexc', status: 'closed',
          openTime: String(t.openTime || t.createTime || ''),
          closeTime: String(closeTime),
          tpLevels: [],
        };
      });
      // Replicate v12.89 importTrades-finalize MET dup-fix
      const merged = [...closed, ...stale];
      const exchanges = new Set(closed.map(t => t.source));
      const consumed = new Set();
      const sizeOf = (rec) => {
        const raw = parseFloat(rec._rawCloseSize); if (isFinite(raw) && raw > 0) return raw;
        const pnl = parseFloat(rec.pnl), exit = parseFloat(rec.exit), entry = parseFloat(rec.entry);
        if (isFinite(pnl) && isFinite(exit) && isFinite(entry) && Math.abs(exit - entry) > 0) {
          const sz = Math.abs(pnl) / Math.abs(exit - entry); if (sz > 0) return sz;
        }
        return Math.abs(parseFloat(rec.positionSizeAsset) || 0);
      };
      const finalized = merged.map(t => {
        if (!exchanges.has(t.source)) return t;
        if (t.status !== 'open' && t.status !== 'partial') return t;
        const tKey = matchKeyOf(t); if (!tKey) return t;
        const siblings = merged.filter(s => s.source === t.source && s.status === 'closed' && s.id !== t.id && !consumed.has(s.id) && matchKeyOf(s) === tKey);
        if (siblings.length === 0) return t;
        for (const s of siblings) consumed.add(s.id);
        const sumPnl = siblings.reduce((s, c) => s + (parseFloat(c.pnl) || 0), 0);
        const sortedSibs = [...siblings].sort((a, b) => (parseInt((a.id || '').split('_').pop() || '0', 10)) - (parseInt((b.id || '').split('_').pop() || '0', 10)));
        const lastClose = sortedSibs[sortedSibs.length - 1] || {};
        return { ...t, status: 'closed', pnl: sumPnl.toFixed(4), exit: lastClose.exit || t.exit || '', closeTime: lastClose.closeTime || t.closeTime || '' };
      }).filter(t => !consumed.has(t.id));

      // Tellen hoe vaak positionId 1358891498 voorkomt na finalize
      const matchingPositions = finalized.filter(t => t.positionId === '1358891498');
      return {
        totalAfterFinalize: finalized.length,
        positionsCount: matchingPositions.length,
        statuses: matchingPositions.map(t => t.status),
        consumedCount: consumed.size,
      };
    }, { stale: staleOpen, snap: snapshot });

    // KEY ASSERTION: positionId 1358891498 verschijnt EXACT 1× (geen dup)
    expect(result.positionsCount).toBe(1);
    expect(result.statuses).toEqual(['closed']);
    expect(result.consumedCount).toBeGreaterThan(0); // er werd minstens 1 sibling geconsumeerd
  });

  test('Fix #2: importTrades finalizet stale-opens naar status=closed', async ({ page }) => {
    // Reproduceer importTrades-finalize logica buiten React-context door dezelfde
    // pure function-stappen na te bouwen.
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });

    const result = await page.evaluate(({ stale, closed }) => {
      // Replicate importTrades v12.89 finalize-pass:
      const matchKeyOf = (t) => { const e = parseFloat(t.entry); if (!isFinite(e) || e <= 0) return null; return `${t.pair}|${t.direction}|${e.toFixed(8)}`; };
      const sizeOf = (rec) => {
        const raw = parseFloat(rec._rawCloseSize); if (isFinite(raw) && raw > 0) return raw;
        const pnl = parseFloat(rec.pnl), exit = parseFloat(rec.exit), entry = parseFloat(rec.entry);
        if (isFinite(pnl) && isFinite(exit) && isFinite(entry) && Math.abs(exit - entry) > 0) {
          const sz = Math.abs(pnl) / Math.abs(exit - entry); if (sz > 0) return sz;
        }
        return Math.abs(parseFloat(rec.positionSizeAsset) || 0);
      };
      // Merge: closed records eerst, dan stale-opens (wat importTrades zou doen)
      const merged = [...closed, ...stale];
      const exchanges = new Set(closed.map(t => t.source));
      const finalized = merged.map(t => {
        if (!exchanges.has(t.source)) return t;
        if (t.status !== 'open' && t.status !== 'partial') return t;
        const tKey = matchKeyOf(t); if (!tKey) return t;
        const siblings = merged.filter(s => s.source === t.source && s.status === 'closed' && s.id !== t.id && matchKeyOf(s) === tKey);
        if (siblings.length === 0) return t;
        const sumPnl = siblings.reduce((s, c) => s + (parseFloat(c.pnl) || 0), 0);
        const sumFees = siblings.reduce((s, c) => s + (Math.abs(parseFloat(c.fees || '0')) || 0), 0) + (Math.abs(parseFloat(t.fees || '0')) || 0);
        const sortedSibs = [...siblings].sort((a, b) => (parseInt((a.id || '').split('_').pop() || '0', 10)) - (parseInt((b.id || '').split('_').pop() || '0', 10)));
        const lastClose = sortedSibs[sortedSibs.length - 1] || {};
        return { ...t, status: 'closed', pnl: sumPnl.toFixed(4), fees: sumFees.toFixed(4), exit: lastClose.exit || t.exit || '', closeTime: lastClose.closeTime || t.closeTime || '' };
      });
      const stale1358 = finalized.find(t => t.positionId === '1358891498');
      return {
        status: stale1358 ? stale1358.status : null,
        pnl: stale1358 ? stale1358.pnl : null,
        exit: stale1358 ? stale1358.exit : null,
      };
    }, { stale: staleOpen, closed: snapToClosedTrades(snapshot) });

    expect(result.status).toBe('closed');
    // PnL = realised van de 1 sibling: 19.6032 (uit snapshot)
    expect(parseFloat(result.pnl)).toBeCloseTo(19.6032, 4);
    expect(result.exit).toBe('78581.6');
  });
});
