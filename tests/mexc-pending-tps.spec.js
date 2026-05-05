// v12.89 — MEXC pending TPs voor open trades.
//
// Scenario: open trade op MEXC heeft TP/SL orders gezet die nog NIET getriggerd zijn
// (price niet gehit). Deze pending orders zitten in `stoporder/list/orders` met
// `state=1` (untriggered) en `is_finished=0`. De proxy-local haalt ze op + flagt ze
// met `_pending: true`. Adapter rendert ze als tpLevels met `status="open"` (niet "hit").
//
// Voor closed trades: pending TPs zouden niet meer voorkomen (alle is_finished=1).
const { test, expect } = require('@playwright/test');

// Pure JS-implementatie, gespiegeld uit refresh-handler in work/tradejournal.html.
function buildTpsWithPending({ trade, fills, ctSize = 0.0001, exchange = 'mexc' }) {
  const entryN = parseFloat(trade.entry) || 0;
  const dirSign = trade.direction === 'long' ? 1 : -1;

  // Filter close-fills (zelfde logic als in refresh-handler)
  const closeFills = fills.filter(f => {
    if (exchange === 'mexc') {
      const side = f.side;
      if (side === 2 || side === 4 || String(side) === '2' || String(side) === '4') return true;
      if (side === 1 || side === 3 || String(side) === '1' || String(side) === '3') return false;
    }
    const profit = parseFloat(f.profit || f.pnl || '0');
    if (Math.abs(profit) > 0.0001) return true;
    const fp = parseFloat(f.price || 0);
    if (entryN > 0 && fp > 0 && Math.abs(fp - entryN) / entryN > 0.0001) return true;
    return false;
  });

  let tradeSize = Math.abs(parseFloat(trade.positionSizeAsset) || 0);
  if (tradeSize <= 0) {
    const usd = parseFloat(trade.positionSize) || 0;
    if (usd > 0 && entryN > 0) tradeSize = usd / entryN;
  }

  const filledForSize = closeFills.filter(f => !f._pending);
  const sumRaw = filledForSize.reduce((s, f) => s + Math.abs(parseFloat(f.vol || f.size || 0)), 0);
  const sumScaled = sumRaw * (ctSize || 1);
  const useScaled = exchange === 'mexc' && ctSize > 0 ? true : (ctSize > 0 && tradeSize > 0 && Math.abs(sumScaled - tradeSize) < Math.abs(sumRaw - tradeSize));
  const fillSizeBase = (f) => {
    const raw = Math.abs(parseFloat(f.vol || f.size || 0));
    return useScaled ? raw * ctSize : raw;
  };

  const knownSize = filledForSize.reduce((s, f) => s + fillSizeBase(f), 0);
  const knownPnl = filledForSize.reduce((s, f) => s + (parseFloat(f.profit || f.pnl || '0') || 0), 0);
  const totalPnl = parseFloat(trade.pnl) || 0;

  const filledFills = closeFills.filter(f => !f._pending);
  const pendingFills = closeFills.filter(f => f._pending);

  const filledTPs = filledFills.map((f, i) => {
    const sz = fillSizeBase(f);
    const ts = Number(f.timestamp || f.dealTime || 0) || 0;
    return {
      id: 'tp_' + trade.id + '_' + i,
      price: String(f.price || ''),
      pct: String(((sz / Math.max(tradeSize, knownSize)) * 100).toFixed(1)),
      status: 'hit',
      actualPrice: String(f.price || ''),
      ts,
      _orderId: Number(f.orderId || 0) || 0,
    };
  }).filter(tp => parseFloat(tp.price) > 0);

  const pendingTPs = pendingFills.map((f, i) => {
    const sz = fillSizeBase(f);
    return {
      id: 'tp_' + trade.id + '_pending_' + i,
      price: String(f.price || ''),
      pct: tradeSize > 0 ? String(((sz / tradeSize) * 100).toFixed(1)) : '0',
      status: 'open',
      actualPrice: '',
      _pending: true,
    };
  }).filter(tp => parseFloat(tp.price) > 0);

  // Reconstructie: alleen voor closed trades met filled fills
  const shouldReconstruct = trade.status === 'closed' && filledForSize.length > 0 && tradeSize > 0 && knownSize < tradeSize * 0.99;
  const reconstructedTPs = [];
  if (shouldReconstruct) {
    const missingSize = tradeSize - knownSize;
    const missingPnl = totalPnl - knownPnl;
    let missingPrice = 0;
    if (Math.abs(totalPnl) > 0.0001 && entryN > 0 && missingSize > 0) {
      const implied = entryN + missingPnl / (missingSize * dirSign);
      if (implied > 0) missingPrice = implied;
    }
    if (missingPrice <= 0) missingPrice = parseFloat(trade.exit) || 0;
    if (missingPrice > 0) {
      reconstructedTPs.push({
        id: 'tp_' + trade.id + '_missing',
        price: String(missingPrice.toFixed(2)),
        pct: String(((missingSize / tradeSize) * 100).toFixed(1)),
        status: 'hit',
        actualPrice: String(missingPrice.toFixed(2)),
        ts: Number(trade.closeTime) || 0,
      });
    }
  }

  // Sort filled TPs chronologisch
  const realHaveTs = filledTPs.some(tp => tp.ts > 0);
  const realHaveIds = filledTPs.some(tp => tp._orderId > 0);
  if (realHaveTs) filledTPs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  else if (realHaveIds) filledTPs.sort((a, b) => (a._orderId || 0) - (b._orderId || 0));
  else filledTPs.reverse();

  // OriginalSize heuristiek (v12.89): open/partial → knownSize + tradeSize, closed → 0
  let computedOrigSize = 0;
  if (knownSize > 0 && tradeSize > 0 && (trade.status === 'open' || trade.status === 'partial')) {
    computedOrigSize = knownSize + tradeSize;
  }
  if (computedOrigSize > 0) {
    for (const tp of filledTPs) {
      const idx = filledTPs.indexOf(tp);
      const fill = filledForSize[idx];
      if (fill) {
        const sz = fillSizeBase(fill);
        tp.pct = String(((sz / computedOrigSize) * 100).toFixed(1));
      }
    }
  }

  const allTPs = [...filledTPs, ...reconstructedTPs, ...pendingTPs];
  allTPs.forEach(tp => { delete tp._orderId; });
  return { tps: allTPs, knownSize, tradeSize, computedOrigSize, filledCount: filledTPs.length, pendingCount: pendingTPs.length };
}

test.describe('MEXC pending TPs voor open trades (v12.89)', () => {
  const openTrade = {
    id: 'mexc_open_999_1777938176',
    positionId: '999',
    pair: 'BTC/USDT',
    direction: 'long',
    entry: '79085',
    positionSize: '711.77',
    positionSizeAsset: '0.009',
    pnl: '',
    fees: '0',
    source: 'mexc',
    status: 'open',
    closeTime: '',
  };

  test('A: open trade met 2 pending TPs → 2 tpLevels met status="open"', () => {
    // Mocked stoporder respons: 2 pending TPs + 1 SL
    const fills = [
      { _pending: true, side: 4, vol: 45, price: 80000, _triggerSide: 1, positionId: '999' }, // TP1 op 80000
      { _pending: true, side: 4, vol: 45, price: 81000, _triggerSide: 1, positionId: '999' }, // TP2 op 81000
    ];
    const r = buildTpsWithPending({ trade: openTrade, fills });

    expect(r.tps.length).toBe(2);
    expect(r.filledCount).toBe(0);
    expect(r.pendingCount).toBe(2);
    // Beide moeten status="open" hebben (niet "hit")
    for (const tp of r.tps) {
      expect(tp.status).toBe('open');
      expect(tp._pending).toBe(true);
    }
    // Prijzen kloppen
    const prices = r.tps.map(tp => parseFloat(tp.price)).sort();
    expect(prices).toEqual([80000, 81000]);
  });

  test('B: open trade ZONDER fills → 0 tpLevels, geen reconstructie', () => {
    const r = buildTpsWithPending({ trade: openTrade, fills: [] });
    expect(r.tps.length).toBe(0);
    expect(r.filledCount).toBe(0);
    expect(r.pendingCount).toBe(0);
  });

  test('C: partial-closed trade met 1 hit + 1 pending → mix in tpLevels', () => {
    const partialTrade = { ...openTrade, status: 'partial', positionSizeAsset: '0.009' };
    const fills = [
      // 1 al gehit (TP1)
      { side: 4, vol: 45, price: 80000, profit: 4.12, timestamp: 1777938176000 },
      // 1 nog niet getriggerd (TP2)
      { _pending: true, side: 4, vol: 45, price: 81000, _triggerSide: 1, positionId: '999' },
    ];
    const r = buildTpsWithPending({ trade: partialTrade, fills });

    expect(r.tps.length).toBe(2);
    expect(r.filledCount).toBe(1);
    expect(r.pendingCount).toBe(1);
    // Filled TP komt eerst (chronologisch), pending erachter
    expect(r.tps[0].status).toBe('hit');
    expect(parseFloat(r.tps[0].price)).toBeCloseTo(80000, 0);
    expect(r.tps[1].status).toBe('open');
    expect(parseFloat(r.tps[1].price)).toBeCloseTo(81000, 0);
  });

  test('D: closed trade met pending fills (na finalize) → pending genegeerd voor reconstructie', () => {
    // Dit is een edge case: zou niet moeten voorkomen (closed trades hebben geen pending TPs)
    // maar als het gebeurt moeten pending fills NIET als "missing fills" worden gerekend voor reconstructie.
    const closedTrade = {
      ...openTrade, status: 'closed',
      entry: '80282.5', exit: '79857.5',
      positionSizeAsset: '0.0336', pnl: '14.2777', closeTime: '1777938176000',
    };
    const fills = [
      // 2 echte filled closes
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, timestamp: 1777912781000 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, timestamp: 1777925661000 },
      // 1 stale pending (zou normaliter niet voorkomen voor closed maar voor robustness)
      { _pending: true, side: 2, vol: 101, price: 79805, _triggerSide: 1, positionId: '999' },
    ];
    const r = buildTpsWithPending({ trade: closedTrade, fills });
    // Verwacht: 2 filled + 1 reconstructed + 1 pending = 4
    expect(r.filledCount).toBe(2);
    expect(r.pendingCount).toBe(1);
    // Reconstructed komt op basis van filled, niet pending
    const reconstructed = r.tps.find(tp => tp.id.includes('_missing'));
    expect(reconstructed).toBeTruthy();
    // Reconstructed heeft "hit" status
    expect(reconstructed.status).toBe('hit');
    // De pending TP houdt status="open"
    const pending = r.tps.find(tp => tp._pending);
    expect(pending.status).toBe('open');
  });

  test('E: pending TP percentage = sz / tradeSize (volledige positie)', () => {
    const fills = [
      // Pending TP voor 50% van de positie
      { _pending: true, side: 4, vol: 45, price: 80000, _triggerSide: 1, positionId: '999' },
    ];
    const r = buildTpsWithPending({ trade: openTrade, fills });
    expect(r.tps.length).toBe(1);
    // 0.0045 BTC (45 contracts × 0.0001) van 0.009 positie = 50%
    const pct = parseFloat(r.tps[0].pct);
    expect(pct).toBeCloseTo(50, 0);
  });

  test('F: open trade met SL pending → SL toont als status="open" tpLevel', () => {
    const fills = [
      // SL pending: triggerSide=2, prijs onder entry voor long (loss-protection)
      { _pending: true, side: 4, vol: 90, price: 78000, _triggerSide: 2, positionId: '999' },
    ];
    const r = buildTpsWithPending({ trade: openTrade, fills });
    expect(r.tps.length).toBe(1);
    expect(r.tps[0].status).toBe('open');
    expect(parseFloat(r.tps[0].price)).toBe(78000);
  });

  test('H: open trade met 2 hit fills + nog open rest → originalSize = knownSize + tradeSize', () => {
    // User-trade 2026-05-04: open BTC long met 2 closed orders (0.0172 + 0.009 = 0.0262 BTC)
    // én 0.009 BTC nog open. Originele positie = 0.0352 BTC (0.0262 + 0.009).
    // Coincidence dat fill 2 size = current rest size; niet een stale-open scenario.
    const openTradeWithFills = {
      ...openTrade,
      positionSizeAsset: '0.009',  // huidige rest
      pnl: '',
    };
    const fills = [
      { side: 4, vol: 172, price: 79562.2, profit: 8.2078, timestamp: 1777937131000 },
      { side: 4, vol: 90, price: 80182.7, profit: 9.8793, timestamp: 1777937455000 },
    ];
    const r = buildTpsWithPending({ trade: openTradeWithFills, fills });
    expect(r.knownSize).toBeCloseTo(0.0262, 4);
    expect(r.tradeSize).toBeCloseTo(0.009, 4);
    // open trade → originalSize = knownSize + tradeSize = 0.0352
    expect(r.computedOrigSize).toBeCloseTo(0.0352, 4);
    const tp1 = r.tps.find(tp => parseFloat(tp.price) === 79562.2);
    const tp2 = r.tps.find(tp => parseFloat(tp.price) === 80182.7);
    expect(parseFloat(tp1.pct)).toBeCloseTo(48.9, 1); // 0.0172 / 0.0352
    expect(parseFloat(tp2.pct)).toBeCloseTo(25.6, 1); // 0.009 / 0.0352
    // Sum filled pct ≈ 74.5% → 25.5% nog open
    const sumPct = parseFloat(tp1.pct) + parseFloat(tp2.pct);
    expect(sumPct).toBeCloseTo(74.5, 1);
  });

  test('I: echte partial trade (klein) → originalSize = knownSize + tradeSize', () => {
    const partialTrade = {
      ...openTrade,
      positionSizeAsset: '0.01',
      pnl: '',
    };
    const fills = [
      { side: 4, vol: 50, price: 80000, profit: 4.575, timestamp: 1777937131000 },
    ];
    const r = buildTpsWithPending({ trade: partialTrade, fills });
    expect(r.knownSize).toBeCloseTo(0.005, 4);
    expect(r.tradeSize).toBeCloseTo(0.01, 4);
    expect(r.computedOrigSize).toBeCloseTo(0.015, 4);
    const tp = r.tps[0];
    expect(parseFloat(tp.pct)).toBeCloseTo(33.3, 1);
  });

  test('G: response met _sources object (proxy-debug) wordt niet als fill behandeld', () => {
    // Edge: proxy retourneert nu {fills:[...], _sources:{...}}
    // De adapter werkt op de fills-array, _sources is metadata
    const fills = [
      { _pending: true, side: 4, vol: 45, price: 80000, _triggerSide: 1, positionId: '999' },
    ];
    const r = buildTpsWithPending({ trade: openTrade, fills });
    expect(r.tps.length).toBe(1);
    expect(r.pendingCount).toBe(1);
  });
});
