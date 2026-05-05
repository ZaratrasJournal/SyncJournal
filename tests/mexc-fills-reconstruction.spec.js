// v12.89 — MEXC fills-reconstruction tests.
//
// Scenario: MEXC's order_deals endpoint geeft soms minder close-fills terug dan er
// daadwerkelijk waren (research: TP-trigger fills met category=3 kunnen propagatie-
// delay hebben naar order_deals tabel). Reconstructie via PnL-delta bouwt de
// ontbrekende TP terug uit (trade.pnl − Σ knownFillPnl, trade.size − Σ knownSize).
//
// Real-world data uit user-rapport 2026-05-04:
//   Positie 1360488693 (BTC short)
//     Entry: 80282.5, Exit avg: 79857.5, Size: 0.0336 BTC, PnL: +14.2777
//   Werkelijke fills (uit MEXC web "Closing Records"):
//     - 11:42:56 Close Short 0.0101 BTC @ 79805.1, PnL +4.8217
//     - 08:21:01 Close Short 0.0101 BTC @ 79738.1, PnL +5.4984
//     - 07:19:41 Close Short 0.0134 BTC @ 79987.1, PnL +3.9583
//     - 06:41:42 Sell Short (open) 0.0292 BTC @ 80282.5
//     - 06:41:42 Sell Short (open) 0.0044 BTC @ 80282.5
//   Maar order_deals geeft alleen 2 closes terug (79738 + 79987), 79805.1 ontbreekt.
const { test, expect } = require('@playwright/test');

// Pure JS-implementatie van de reconstructie-logica (gespiegeld uit refresh-handler in
// work/tradejournal.html). Aparte function maakt 'm unit-testbaar.
function buildTpsWithReconstruction({ trade, fills, ctSize = 0.0001, exchange = 'mexc' }) {
  const entryN = parseFloat(trade.entry) || 0;
  const dirSign = trade.direction === 'long' ? 1 : -1;

  // Filter close-fills: side-based + PnL fallback + price ≠ entry fallback
  const closeFills = fills.filter(f => {
    if (exchange === 'mexc') {
      const side = f.side;
      if (side === 2 || side === 4 || String(side) === '2' || String(side) === '4') return true;
      if (side === 1 || side === 3 || String(side) === '1' || String(side) === '3') return false;
    }
    const profit = parseFloat(f.profit || f.pnl || f.realisedPnl || '0');
    if (Math.abs(profit) > 0.0001) return true;
    const fp = parseFloat(f.price || f.tradePrice || f.closeAvgPrice || 0);
    if (entryN > 0 && fp > 0 && Math.abs(fp - entryN) / entryN > 0.0001) return true;
    return false;
  });

  // Resolve tradeSize met fallbacks
  let tradeSize = Math.abs(parseFloat(trade.positionSizeAsset) || 0);
  if (tradeSize <= 0) {
    const usd = parseFloat(trade.positionSize) || 0;
    if (usd > 0 && entryN > 0) tradeSize = usd / entryN;
  }

  // Smart unit-detect
  const sumRaw = closeFills.reduce((s, f) => s + Math.abs(parseFloat(f.vol || f.size || 0)), 0);
  const sumScaled = sumRaw * (ctSize || 1);
  const useScaled = ctSize > 0 && tradeSize > 0 && Math.abs(sumScaled - tradeSize) < Math.abs(sumRaw - tradeSize);
  const fillSizeBase = (f) => {
    const raw = Math.abs(parseFloat(f.vol || f.size || 0));
    return useScaled ? raw * ctSize : raw;
  };

  const knownSize = closeFills.reduce((s, f) => s + fillSizeBase(f), 0);
  const knownPnl = closeFills.reduce((s, f) => s + (parseFloat(f.profit || f.pnl || '0') || 0), 0);
  const totalPnl = parseFloat(trade.pnl) || 0;

  const tps = closeFills.map((f, i) => {
    const sz = fillSizeBase(f);
    const ts = Number(f.timestamp || f.dealTime || f.time || f.ms || f.createTime || f.t || f.ts || f.dealTimestamp || f.tradeTime || f.transactTime || f.executeTime || f.T || f.transTime || 0) || 0;
    const orderId = Number(f.orderId || f.id || f.dealId || 0) || 0;
    return {
      id: 'tp_' + trade.id + '_' + i,
      price: String(f.price || ''),
      pct: String(((sz / Math.max(tradeSize, knownSize)) * 100).toFixed(1)),
      status: 'hit',
      actualPrice: String(f.price || ''),
      ts,
      _orderId: orderId,
    };
  }).filter(tp => parseFloat(tp.price) > 0);

  // Missing-fill reconstruction: alleen als we WEL fills hebben (anders niets te reconstrueren)
  // én als tradeSize > knownSize én er is een valid trade.pnl OF trade.exit beschikbaar.
  const shouldReconstruct = closeFills.length > 0 && tradeSize > 0 && knownSize < tradeSize * 0.99;
  if (shouldReconstruct) {
    const missingSize = tradeSize - knownSize;
    const missingPnl = totalPnl - knownPnl;
    let missingPrice = 0;
    // Primary: gebruik trade.pnl voor accurate implied price
    if (Math.abs(totalPnl) > 0.0001 && entryN > 0 && missingSize > 0) {
      const implied = entryN + missingPnl / (missingSize * dirSign);
      if (implied > 0) missingPrice = implied;
    }
    // Fallback: gebruik trade.exit (gewogen gemiddelde close-prijs)
    if (missingPrice <= 0) missingPrice = parseFloat(trade.exit) || 0;
    if (missingPrice > 0) {
      tps.push({
        id: 'tp_' + trade.id + '_missing',
        price: String(missingPrice.toFixed(2)),
        pct: String(((missingSize / tradeSize) * 100).toFixed(1)),
        status: 'hit',
        actualPrice: String(missingPrice.toFixed(2)),
        ts: Number(trade.closeTime) || 0,
      });
    }
  }
  // Chronologisch sorteren met 3-tier fallback
  const realTPs = tps.filter(tp => !tp.id.endsWith('_missing'));
  const reconstructedTPs = tps.filter(tp => tp.id.endsWith('_missing'));
  const realHaveTs = realTPs.some(tp => tp.ts > 0);
  const realHaveIds = realTPs.some(tp => tp._orderId > 0);
  if (realHaveTs) realTPs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  else if (realHaveIds) realTPs.sort((a, b) => (a._orderId || 0) - (b._orderId || 0));
  else realTPs.reverse(); // assume MEXC sends newest-first
  const sortedTps = [...realTPs, ...reconstructedTPs];
  sortedTps.forEach(tp => delete tp._orderId);
  return { tps: sortedTps, knownSize, tradeSize, useScaled, missingTriggered: shouldReconstruct };
}

test.describe('MEXC fills-reconstruction (community-bug 2026-05-04)', () => {
  // De echte trade van de user na refresh
  const realTrade = {
    id: 'mexc_1360488693_1777938176000',
    positionId: '1360488693',
    pair: 'BTC/USDT',
    direction: 'short',
    entry: '80282.5',
    exit: '79857.5',
    positionSize: '2697.49',
    positionSizeAsset: '0.0336',
    pnl: '14.2777',
    fees: '0.0000',
    source: 'mexc',
    status: 'closed',
  };

  test('SCENARIO A: alle 3 fills aanwezig in order_deals → 3 TPs zonder reconstruction', () => {
    // MEXC's vol is in contracts: 0.0101 BTC = 101 contracts (contractSize=0.0001)
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, dealTime: 1777912781000 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, dealTime: 1777925661000 },
      { side: 2, vol: 101, price: 79805.1, profit: 4.8217, dealTime: 1777938176000 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    expect(r.tps.length).toBe(3);
    expect(r.missingTriggered).toBe(false); // geen reconstruction nodig
    expect(r.useScaled).toBe(true); // contracts → BTC scaling actief
    const prices = r.tps.map(t => parseFloat(t.price)).sort();
    expect(prices).toEqual([79738.1, 79805.1, 79987.1]);
  });

  test('SCENARIO B (BUG): 79805 mist in order_deals → reconstructie geeft 79805 terug', () => {
    // De situatie van de user: order_deals geeft maar 2 fills, 79805 mist
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, dealTime: 1777912781000 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, dealTime: 1777925661000 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    expect(r.tps.length).toBe(3); // 2 echt + 1 reconstructed
    expect(r.missingTriggered).toBe(true);

    // Sort by price for deterministic check
    const prices = r.tps.map(t => parseFloat(t.price)).sort((a, b) => a - b);
    // 79805 reconstructed via: entry + missingPnl/(missingSize*dirSign)
    //   entry=80282.5, missingSize=0.0336-0.0235=0.0101, dirSign=-1 (short)
    //   missingPnl = 14.2777 - (3.9583+5.4984) = 4.821
    //   implied = 80282.5 + 4.821/(0.0101*-1) = 80282.5 - 477.33 = 79805.17
    expect(prices[0]).toBeCloseTo(79738.1, 1);
    expect(prices[1]).toBeCloseTo(79805.17, 1); // reconstructed
    expect(prices[2]).toBeCloseTo(79987.1, 1);
  });

  test('SCENARIO C: opens worden uitgefilterd, alleen closes als TP', () => {
    // MEXC's order_deals geeft soms ook opens terug — deze moeten NIET als TP verschijnen
    const fills = [
      { side: 3, vol: 292, price: 80282.5, profit: 0, dealTime: 1777878102000 }, // open short
      { side: 3, vol: 44, price: 80282.5, profit: 0, dealTime: 1777878102000 },  // open short
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, dealTime: 1777912781000 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, dealTime: 1777925661000 },
      { side: 2, vol: 101, price: 79805.1, profit: 4.8217, dealTime: 1777938176000 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    expect(r.tps.length).toBe(3); // alleen 3 closes, geen opens
    const prices = r.tps.map(t => parseFloat(t.price)).sort();
    expect(prices).toEqual([79738.1, 79805.1, 79987.1]);
    // Geen prijs op exact entry
    expect(prices.includes(80282.5)).toBe(false);
  });

  test('SCENARIO D: missing fill → percentages tellen op tot ~100%', () => {
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    const totalPct = r.tps.reduce((s, tp) => s + parseFloat(tp.pct), 0);
    expect(totalPct).toBeGreaterThan(99);
    expect(totalPct).toBeLessThan(101);
  });

  test('SCENARIO E: positionSizeAsset leeg (legacy data) → fallback via positionSize/entry', () => {
    const tradeNoQty = { ...realTrade, positionSizeAsset: '' };
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984 },
    ];
    const r = buildTpsWithReconstruction({ trade: tradeNoQty, fills });

    // tradeSize moet via positionSize/entry zijn berekend: 2697.49 / 80282.5 = 0.0336
    expect(r.tradeSize).toBeCloseTo(0.0336, 3);
    expect(r.missingTriggered).toBe(true);
    expect(r.tps.length).toBe(3);
  });

  test('SCENARIO F: long trade — reconstructie met dirSign=+1', () => {
    const longTrade = {
      ...realTrade, id: 'mexc_long_test', positionId: '999',
      direction: 'long', entry: '70000', exit: '70500',
      positionSize: '700', positionSizeAsset: '0.01', pnl: '5.0',
    };
    // 0.01 BTC → 100 contracts. 70 contracts (= 0.007 BTC) bekend, 30 contracts mist
    const fills = [
      { side: 4, vol: 70, price: 70500, profit: 3.5 }, // 0.007 × (70500-70000) = 3.5
    ];
    const r = buildTpsWithReconstruction({ trade: longTrade, fills });

    expect(r.tps.length).toBe(2); // 1 echt + 1 reconstructed
    expect(r.missingTriggered).toBe(true);
    // Missing: size=0.003, pnl=5.0-3.5=1.5 → implied = 70000 + 1.5/(0.003*1) = 70500
    const reconstructedTP = r.tps.find(t => t.id.includes('missing'));
    expect(reconstructedTP).toBeTruthy();
    expect(parseFloat(reconstructedTP.price)).toBeCloseTo(70500, 0);
  });

  test('SCENARIO G: alle fills bekend, sum ≈ tradeSize → geen reconstructie', () => {
    const fills = [
      { side: 2, vol: 336, price: 79857.5, profit: 14.2777 }, // 1 fill = hele positie
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    expect(r.tps.length).toBe(1);
    expect(r.missingTriggered).toBe(false);
  });

  test('SCENARIO H: leg fills array → 0 TPs, geen crash', () => {
    const r = buildTpsWithReconstruction({ trade: realTrade, fills: [] });
    expect(r.tps.length).toBe(0);
  });

  test('SCENARIO J: TPs zijn chronologisch gesorteerd (TP1 = oudste fill)', () => {
    // Echte timestamps uit user-rapport: 07:19:41 < 08:21:01 < 11:42:56
    const T_0719 = new Date('2026-05-04T07:19:41Z').getTime();
    const T_0821 = new Date('2026-05-04T08:21:01Z').getTime();
    const T_1142 = new Date('2026-05-04T11:42:56Z').getTime();
    const fills = [
      // Bewust uit volgorde aangeleverd: late, early, mid
      { side: 2, vol: 101, price: 79805.1, profit: 4.8217, timestamp: T_1142 },
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, timestamp: T_0719 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, timestamp: T_0821 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });

    expect(r.tps.length).toBe(3);
    // Verwacht volgorde: 79987 (07:19) → 79738 (08:21) → 79805 (11:42)
    expect(parseFloat(r.tps[0].price)).toBeCloseTo(79987.1, 1);
    expect(parseFloat(r.tps[1].price)).toBeCloseTo(79738.1, 1);
    expect(parseFloat(r.tps[2].price)).toBeCloseTo(79805.1, 1);
    // Timestamps moeten oplopend zijn
    expect(r.tps[0].ts).toBeLessThan(r.tps[1].ts);
    expect(r.tps[1].ts).toBeLessThan(r.tps[2].ts);
  });

  test('SCENARIO K: zonder timestamp → orderId fallback geeft chronologisch', () => {
    // MEXC field-name niet bekend → ts=0. orderId is monotonisch increasing.
    const fills = [
      { side: 2, vol: 101, price: 79805.1, profit: 4.8217, orderId: 30003 }, // newest
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, orderId: 30001 }, // oldest
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, orderId: 30002 },
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });
    expect(r.tps.length).toBe(3);
    // Verwacht oudste orderId eerst: 30001 (79987) → 30002 (79738) → 30003 (79805)
    expect(parseFloat(r.tps[0].price)).toBeCloseTo(79987.1, 1);
    expect(parseFloat(r.tps[1].price)).toBeCloseTo(79738.1, 1);
    expect(parseFloat(r.tps[2].price)).toBeCloseTo(79805.1, 1);
  });

  test('SCENARIO L: zonder timestamp én zonder orderId → reverse insertion (newest-first assumption)', () => {
    // Geen ts, geen id velden → fallback: reverse de array (MEXC sendt typisch newest-first)
    const fills = [
      { side: 2, vol: 101, price: 79805.1, profit: 4.8217 }, // newest (geen tijd-info)
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984 },
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583 }, // oldest
    ];
    const r = buildTpsWithReconstruction({ trade: realTrade, fills });
    expect(r.tps.length).toBe(3);
    // Reverse → 79987 (was last) → 79738 → 79805 (was first)
    expect(parseFloat(r.tps[0].price)).toBeCloseTo(79987.1, 1);
    expect(parseFloat(r.tps[1].price)).toBeCloseTo(79738.1, 1);
    expect(parseFloat(r.tps[2].price)).toBeCloseTo(79805.1, 1);
  });

  test('SCENARIO M: reconstructed-TP komt na real-TPs ongeacht sort-mode', () => {
    // 2 echte fills met orderId, 1 reconstructed → reconstructed altijd laatst
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583, orderId: 30001 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984, orderId: 30002 },
      // 79805 mist → wordt reconstructed
    ];
    const r = buildTpsWithReconstruction({ trade: { ...realTrade, closeTime: '1777938176000' }, fills });
    expect(r.tps.length).toBe(3);
    expect(r.tps[2].id).toContain('_missing'); // reconstructed laatst
    expect(parseFloat(r.tps[0].price)).toBeCloseTo(79987.1, 1);
    expect(parseFloat(r.tps[1].price)).toBeCloseTo(79738.1, 1);
    expect(parseFloat(r.tps[2].price)).toBeCloseTo(79805.18, 1);
  });

  test('SCENARIO I: trade zonder pnl → fallback naar trade.exit voor missing-price', () => {
    const tradeNoPnl = { ...realTrade, pnl: '' };
    const fills = [
      { side: 2, vol: 134, price: 79987.1, profit: 3.9583 },
      { side: 2, vol: 101, price: 79738.1, profit: 5.4984 },
    ];
    const r = buildTpsWithReconstruction({ trade: tradeNoPnl, fills });
    // Reconstruction triggert, zonder pnl gebruiken we trade.exit (79857.5) als fallback
    expect(r.tps.length).toBe(3);
    const reconstructed = r.tps.find(t => t.id.includes('missing'));
    expect(parseFloat(reconstructed.price)).toBeCloseTo(79857.5, 0);
  });
});
