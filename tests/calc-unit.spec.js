// Fase 2 (review/journal-audit): unit-tests voor financiële berekeningen.
// Strategie: laad de app één keer (Babel-compile ~5s) en roep de pure functies
// direct aan via page.evaluate — ze staan in global scope van het inline script.
// Alle verwachtingswaardes zijn HANDMATIG narekend (zie comments per case).
//
// Bron-functies (work/tradejournal.html, regelnrs v12.232):
//   netPnl                      ±2005   calcRMultiple        ±1564
//   computeFtmoMedianLoserSlPct ±1546   calcTheoreticalR/Pnl ±1641/1654
//   calcExpectancy              ±1664   computeAccountCapital ±2934
//   computeTradeRisk            ±3110   sourceTypeOf          ±2940
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe.configure({ mode: 'serial' });

let page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('tj_welcomed', '1'));
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => typeof netPnl === 'function' && typeof calcRMultiple === 'function'
      && typeof calcExpectancy === 'function' && typeof computeAccountCapital === 'function'
      && typeof computeTradeRisk === 'function' && typeof calcTheoreticalR === 'function',
    { timeout: 30_000 }
  );
});
test.afterAll(async () => { if (page) await page.close(); });

// ───────────────────────── netPnl ─────────────────────────
test('netPnl: manual trade trekt fees af (bruto − fees)', async () => {
  // 100 − 2 = 98 ; −50 − 2.5 = −52.5
  const r = await page.evaluate(() => [
    netPnl({ status: 'closed', source: 'manual', pnl: '100', fees: '2' }),
    netPnl({ status: 'closed', source: 'manual', pnl: '-50', fees: '2.5' }),
  ]);
  expect(r[0]).toBeCloseTo(98, 10);
  expect(r[1]).toBeCloseTo(-52.5, 10);
});

test('netPnl: exchange-trade is al netto — fees NIET nogmaals aftrekken', async () => {
  const r = await page.evaluate(() =>
    netPnl({ status: 'closed', source: 'blofin', pnl: '100', fees: '2' }));
  expect(r).toBe(100);
});

test('netPnl: onbekende source (legacy manual-accountnaam) gedraagt zich als manual', async () => {
  // v12.232-semantiek: sourceTypeOf("Mijn Account") === "manual" → fees eraf: 10 − 1 = 9
  const r = await page.evaluate(() =>
    netPnl({ status: 'closed', source: 'Mijn Account', pnl: '10', fees: '1' }));
  expect(r).toBeCloseTo(9, 10);
});

test('netPnl: lege/ongeldige pnl → 0 (geen NaN-lek in aggregaten)', async () => {
  const r = await page.evaluate(() => [
    netPnl({ status: 'closed', source: 'manual', pnl: '', fees: '3' }),
    netPnl({ status: 'closed', source: 'manual', pnl: 'abc', fees: '3' }),
    netPnl(null),
  ]);
  expect(r).toEqual([0, 0, 0]);
});

test('netPnl: missed-trade valt terug op theoretische PnL uit exit', async () => {
  // long, entry 100 → exit 110, size $1000: (110−100)/100 × 1000 = +100
  const r = await page.evaluate(() =>
    netPnl({ status: 'missed', direction: 'long', entry: '100', exit: '110', positionSize: '1000', pnl: '' }));
  expect(r).toBeCloseTo(100, 10);
});

// ───────────────────────── calcRMultiple — crypto-pad ─────────────────────────
test('calcRMultiple crypto: long winst = pnl / (|entry−sl|·size/entry)', async () => {
  // risk = 5 × 1000 / 100 = $50 ; R = 100/50 = 2
  const r = await page.evaluate(() =>
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '95', positionSize: '1000', pnl: '100' }));
  expect(r).toBeCloseTo(2, 10);
});

test('calcRMultiple crypto: short — zelfde risico-afstand, zelfde R', async () => {
  // |100−105| × 1000/100 = $50 ; R = 100/50 = 2 (verlies −75 → −1.5)
  const r = await page.evaluate(() => [
    calcRMultiple({ source: 'blofin', direction: 'short', entry: '100', stopLoss: '105', positionSize: '1000', pnl: '100' }),
    calcRMultiple({ source: 'blofin', direction: 'short', entry: '100', stopLoss: '105', positionSize: '1000', pnl: '-75' }),
  ]);
  expect(r[0]).toBeCloseTo(2, 10);
  expect(r[1]).toBeCloseTo(-1.5, 10);
});

test('calcRMultiple crypto: break-even pnl 0 → R = 0', async () => {
  const r = await page.evaluate(() =>
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '95', positionSize: '1000', pnl: '0' }));
  expect(r).toBe(0);
});

test('calcRMultiple crypto: geen SL of SL==entry → null (niet berekenbaar)', async () => {
  const r = await page.evaluate(() => [
    calcRMultiple({ source: 'blofin', entry: '100', positionSize: '1000', pnl: '100' }),
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '100', positionSize: '1000', pnl: '100' }),
    calcRMultiple({ source: 'blofin', entry: '', stopLoss: '95', positionSize: '1000', pnl: '100' }),
  ]);
  expect(r).toEqual([null, null, null]);
});

test('calcRMultiple crypto: ontbrekende positionSize → null (géén size=1 fallback)', async () => {
  // Met de oude `size || 1`-fallback zou dit R = 100 / (5×1/100) = 2000 geven —
  // een absurde waarde die analytics/playbook-stats vervuilt. Zonder size is R
  // niet berekenbaar → null ("—" in de tabel) is het enige eerlijke antwoord.
  const r = await page.evaluate(() => [
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '95', pnl: '100' }),
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '95', positionSize: '', pnl: '100' }),
    calcRMultiple({ source: 'blofin', entry: '100', stopLoss: '95', positionSize: '0', pnl: '100' }),
  ]);
  expect(r).toEqual([null, null, null]);
});

// ───────────────────────── calcRMultiple — FTMO-pad ─────────────────────────
test('calcRMultiple FTMO: dollars-per-point afleiding met geldige CSV-SL', async () => {
  // entry 100 → exit 110, pnl +100 ⇒ $10/punt. SL 99 (1% afstand, >0.1% drempel)
  // ⇒ risico = 1 punt × $10 = $10 ⇒ R = 100/10 = 10
  const r = await page.evaluate(() =>
    calcRMultiple({ source: 'ftmo', entry: '100', exit: '110', stopLoss: '99', pnl: '100' }));
  expect(r).toBeCloseTo(10, 10);
});

test('calcRMultiple FTMO: verlies exact op SL → R = −1', async () => {
  // entry 100 → exit 99 (=SL), pnl −10 ⇒ $10/punt; risico $10 ⇒ R = −10/10 = −1
  const r = await page.evaluate(() =>
    calcRMultiple({ source: 'ftmo', entry: '100', exit: '99', stopLoss: '99', pnl: '-10' }));
  expect(r).toBeCloseTo(-1, 10);
});

test('calcRMultiple FTMO: getrailde SL (<0.1%) → mediaan-fallback uit ctx', async () => {
  // SL 99.95 = 0.05% afstand → genegeerd; ctx mediaan 1% ⇒ slDistance 1 punt;
  // $10/punt ⇒ risico $10 ⇒ R = 10
  const r = await page.evaluate(() =>
    calcRMultiple(
      { source: 'ftmo', entry: '100', exit: '110', stopLoss: '99.95', pnl: '100' },
      { medianLoserSlPct: 0.01 }
    ));
  expect(r).toBeCloseTo(10, 10);
});

test('calcRMultiple FTMO: geen SL én geen ctx → 0.4%-default fallback', async () => {
  // slDistance = 100 × 0.004 = 0.4 punt; $10/punt ⇒ risico $4 ⇒ R = 100/4 = 25
  const r = await page.evaluate(() =>
    calcRMultiple({ source: 'ftmo', entry: '100', exit: '110', stopLoss: '', pnl: '100' }));
  expect(r).toBeCloseTo(25, 10);
});

test('calcRMultiple FTMO: geen exit of exit==entry → null', async () => {
  const r = await page.evaluate(() => [
    calcRMultiple({ source: 'ftmo', entry: '100', exit: '', stopLoss: '99', pnl: '100' }),
    calcRMultiple({ source: 'ftmo', entry: '100', exit: '100', stopLoss: '99', pnl: '100' }),
  ]);
  expect(r).toEqual([null, null]);
});

// ───────────────────────── computeFtmoMedianLoserSlPct ─────────────────────────
test('mediaan loser-SL%: oneven aantal → middelste; <3 losers → null', async () => {
  const r = await page.evaluate(() => {
    const mk = (sl, pnl) => ({ source: 'ftmo', status: 'closed', entry: '100', stopLoss: String(sl), pnl: String(pnl) });
    return [
      // losers met SL-afstand 0.5% / 1% / 2% → mediaan 1% = 0.01
      computeFtmoMedianLoserSlPct([mk(99.5, -5), mk(99, -5), mk(98, -5), mk(99, +5) /* winner telt niet */]),
      // slechts 2 losers → null
      computeFtmoMedianLoserSlPct([mk(99.5, -5), mk(99, -5)]),
      // outlier >5% wordt uitgefilterd → blijft 2 over → null
      computeFtmoMedianLoserSlPct([mk(99.5, -5), mk(99, -5), mk(90, -5)]),
    ];
  });
  expect(r[0]).toBeCloseTo(0.01, 10);
  expect(r[1]).toBeNull();
  expect(r[2]).toBeNull();
});

// ───────────────────────── theoretische R / PnL (missed/BT) ─────────────────────────
test('calcTheoreticalR: 100% hit-TPs → gewogen exit', async () => {
  // long entry 100, SL 95 (risk 5). TPs 50%@110 + 50%@120 ⇒ wExit 115 ⇒ R = 15/5 = 3
  const r = await page.evaluate(() =>
    calcTheoreticalR({
      status: 'missed', direction: 'long', entry: '100', stopLoss: '95',
      tpLevels: [
        { price: '110', pct: '50', status: 'hit' },
        { price: '120', pct: '50', status: 'hit' },
      ],
    }));
  expect(r).toBeCloseTo(3, 10);
});

test('calcTheoreticalR: alle TPs missed → exit op SL → R = −1', async () => {
  const r = await page.evaluate(() =>
    calcTheoreticalR({
      status: 'missed', direction: 'long', entry: '100', stopLoss: '95',
      tpLevels: [
        { price: '110', pct: '60', status: 'missed' },
        { price: '120', pct: '40', status: 'missed' },
      ],
    }));
  expect(r).toBeCloseTo(-1, 10);
});

test('calcTheoreticalR: mix hit/missed → gewogen tussen TP en SL', async () => {
  // 50%@110 hit + 50% missed→SL 95 ⇒ wExit = (110×50 + 95×50)/100 = 102.5 ⇒ R = 2.5/5 = 0.5
  const r = await page.evaluate(() =>
    calcTheoreticalR({
      status: 'missed', direction: 'long', entry: '100', stopLoss: '95',
      tpLevels: [
        { price: '110', pct: '50', status: 'hit' },
        { price: '120', pct: '50', status: 'missed' },
      ],
    }));
  expect(r).toBeCloseTo(0.5, 10);
});

test('calcTheoreticalPnl: short-richting en directe exit', async () => {
  // short entry 100 → exit 90, size $1000 ⇒ (90−100)×(−1)×1000/100 = +100
  const r = await page.evaluate(() =>
    calcTheoreticalPnl({ status: 'missed', direction: 'short', entry: '100', exit: '90', positionSize: '1000' }));
  expect(r).toBeCloseTo(100, 10);
});

// ───────────────────────── calcExpectancy ─────────────────────────
test('calcExpectancy: 50/50 winst/verlies — klassieke formule', async () => {
  // [+100, −50]: WR 0.5, avgWin 100, avgLoss 50 ⇒ 0.5×100 − 0.5×50 = 25
  const r = await page.evaluate(() => calcExpectancy([
    { status: 'closed', source: 'blofin', pnl: '100' },
    { status: 'closed', source: 'blofin', pnl: '-50' },
  ]));
  expect(r).toBeCloseTo(25, 10);
});

test('calcExpectancy: 0 trades / alleen lege pnl → null; 1 winnaar → die waarde', async () => {
  const r = await page.evaluate(() => [
    calcExpectancy([]),
    calcExpectancy(null),
    calcExpectancy([{ status: 'closed', source: 'blofin', pnl: '' }]),
    calcExpectancy([{ status: 'closed', source: 'blofin', pnl: '100' }]),
  ]);
  expect(r[0]).toBeNull();
  expect(r[1]).toBeNull();
  expect(r[2]).toBeNull();
  expect(r[3]).toBeCloseTo(100, 10);
});

test('calcExpectancy: break-even trades vervalsen het gemiddelde niet', async () => {
  // [+100, 0, −50]: expectancy = "gemiddelde PnL per trade" (zie GOAL_METRICS-hint)
  // = (100 + 0 − 50)/3 = 16.67. De klassieke formule met (1−WR)×avgLoss telt de
  // break-even mee als verliezer (⇒ 0) — dat wijkt af van de gedocumenteerde betekenis.
  const r = await page.evaluate(() => calcExpectancy([
    { status: 'closed', source: 'blofin', pnl: '100' },
    { status: 'closed', source: 'blofin', pnl: '0' },
    { status: 'closed', source: 'blofin', pnl: '-50' },
  ]));
  expect(r).toBeCloseTo(16.67, 2);
});

test('calcExpectancy: manual fees beïnvloeden win/verlies-classificatie', async () => {
  // manual +1 met 2 fees ⇒ netto −1 (verliezer); manual +100 / 0 fees winnaar.
  // [netto +100, netto −1]: 0.5×100 − 0.5×1 = 49.5
  const r = await page.evaluate(() => calcExpectancy([
    { status: 'closed', source: 'manual', pnl: '100', fees: '0' },
    { status: 'closed', source: 'manual', pnl: '1', fees: '2' },
  ]));
  expect(r).toBeCloseTo(49.5, 10);
});

// ───────────────────────── computeAccountCapital ─────────────────────────
test('computeAccountCapital: deposits/withdrawals/correcties', async () => {
  const r = await page.evaluate(() => [
    computeAccountCapital([{ type: 'deposit', amount: '1000' }, { type: 'withdrawal', amount: '200' }]), // 800
    computeAccountCapital([{ type: 'deposit', amount: '1000' }, { type: 'correction', amount: '5000' }, { type: 'deposit', amount: '100' }]), // 5100
    computeAccountCapital([{ type: 'deposit', amount: '1000' }, { type: 'correction', amount: '500' }]), // correctie omlaag → 500
    computeAccountCapital([]),   // 0
    computeAccountCapital(null), // 0
    computeAccountCapital([{ type: 'deposit', amount: 'abc' }]), // ongeldige amount → 0
  ]);
  expect(r).toEqual([800, 5100, 500, 0, 0, 0]);
});

// ───────────────────────── computeTradeRisk ─────────────────────────
test('computeTradeRisk: riskUsd = |entry−SL|×size/entry; riskPct via account-kapitaal', async () => {
  const r = await page.evaluate(() => {
    const accounts = [{ id: 'a1', type: 'manual', transactions: [{ type: 'deposit', amount: '10000' }] }];
    return [
      // long: |100−95|×1000/100 = $50 ; 50/10000 = 0.50%
      computeTradeRisk({ entry: '100', stopLoss: '95', positionSize: '1000', source: 'a1' }, {}, accounts),
      // short: |100−105| zelfde afstand → zelfde risk
      computeTradeRisk({ entry: '100', stopLoss: '105', positionSize: '1000', source: 'a1' }, {}, accounts),
      // geen kapitaal bekend → wel riskUsd, geen riskPct
      computeTradeRisk({ entry: '100', stopLoss: '95', positionSize: '1000', source: 'manual' }, {}, []),
      // ontbrekende velden → leeg object
      computeTradeRisk({ entry: '', stopLoss: '95', positionSize: '1000', source: 'a1' }, {}, accounts),
    ];
  });
  expect(r[0]).toEqual({ riskUsd: '50.00', riskPct: '0.50' });
  expect(r[1]).toEqual({ riskUsd: '50.00', riskPct: '0.50' });
  expect(r[2]).toEqual({ riskUsd: '50.00' });
  expect(r[3]).toEqual({});
});

// ───────────────────────── sourceTypeOf (fundament v12.232) ─────────────────────────
test('sourceTypeOf: type-strings, onbekend → manual, registry-lookup', async () => {
  const r = await page.evaluate(() => {
    registerAccountsRegistry([{ id: 'acc_x', type: 'kraken' }]);
    const out = [
      sourceTypeOf('ftmo'), sourceTypeOf('blofin'), sourceTypeOf('acc_x'),
      sourceTypeOf('Onbekend Account'), sourceTypeOf(''), sourceTypeOf('manual'),
    ];
    registerAccountsRegistry([]); // niet lekken naar andere tests
    return out;
  });
  expect(r).toEqual(['ftmo', 'blofin', 'kraken', 'manual', 'manual', 'manual']);
});

// ───────────────────────── detectPartialFromSiblings — aggregatie-math ─────────────────────────
test('detectPartialFromSiblings: realizedPnl/fees/TP-percentages handmatig narekenbaar', async () => {
  // Open long BTC 100, rest-size 0.6. Twee closed siblings op zelfde entry:
  //   sib1: exit 110, pnl +10, fees 0.5, _rawCloseSize 0.25
  //   sib2: exit 120, pnl −4,  fees 0.5, _rawCloseSize 0.15
  // ⇒ realizedPnl = 6.00 ; fees = 0.5+0.5+1(eigen) = 2.0000
  // ⇒ closed (0.4) < rest (0.6) → geen ghost ⇒ totalAsset = 0.6+0.4 = 1.0
  // ⇒ TP-pcts = 25% / 15%
  const r = await page.evaluate(() => {
    const base = { pair: 'BTC/USDT', direction: 'long', entry: '100', source: 'blofin' };
    const trades = [
      { ...base, id: 'open1', status: 'open', positionSizeAsset: '0.6', fees: '1', tpLevels: [] },
      { ...base, id: 'c_1', status: 'closed', exit: '110', pnl: '10', fees: '0.5', _rawCloseSize: '0.25' },
      { ...base, id: 'c_2', status: 'closed', exit: '120', pnl: '-4', fees: '0.5', _rawCloseSize: '0.15' },
    ];
    const out = detectPartialFromSiblings(trades, 'blofin', 'blofin');
    const t = out.find(x => x.id === 'open1');
    return { status: t.status, realizedPnl: t.realizedPnl, fees: t.fees, originalSizeAsset: t.originalSizeAsset, tpPcts: (t.tpLevels || []).map(tp => tp.pct) };
  });
  expect(r.status).toBe('partial');
  expect(parseFloat(r.realizedPnl)).toBeCloseTo(6, 6);
  expect(parseFloat(r.fees)).toBeCloseTo(2, 6);
  expect(parseFloat(r.originalSizeAsset)).toBeCloseTo(1.0, 6);
  expect(r.tpPcts.map(p => parseFloat(p))).toEqual([25, 15]);
});

test('detectPartialFromSiblings: >50% gesloten met runner → runner NIET weggenuld', async () => {
  // Denny's standaard multi-TP stijl: TP1 50% + TP2 25% hit, 25% runner nog open.
  // rest 0.25, closes 0.5 + 0.25 ⇒ closed 0.75 > rest → vóór v12.233 vuurde de
  // ghost-heuristiek (closed ≥ rest×0.99) en werd de runner weggenuld:
  // originalSize 0.75 (echt: 1.0) en TP-pcts 66.7/33.3 (echt: 50/25).
  const r = await page.evaluate(() => {
    const base = { pair: 'BTC/USDT', direction: 'long', entry: '100', source: 'blofin' };
    const trades = [
      { ...base, id: 'open1', status: 'open', positionSizeAsset: '0.25', fees: '0', tpLevels: [] },
      { ...base, id: 'c_1', status: 'closed', exit: '110', pnl: '5', fees: '0', _rawCloseSize: '0.5' },
      { ...base, id: 'c_2', status: 'closed', exit: '120', pnl: '5', fees: '0', _rawCloseSize: '0.25' },
    ];
    const out = detectPartialFromSiblings(trades, 'blofin', 'blofin');
    const t = out.find(x => x.id === 'open1');
    return { originalSizeAsset: t.originalSizeAsset, tpPcts: (t.tpLevels || []).map(tp => parseFloat(tp.pct)) };
  });
  expect(parseFloat(r.originalSizeAsset)).toBeCloseTo(1.0, 6);
  expect(r.tpPcts).toEqual([50, 25]);
});

test('detectPartialFromSiblings: ghost (closed ≈ stale open-size) → rest = 0', async () => {
  // Volledig gesloten positie waarvan de API nog een stale open-record toont met de
  // originele size: closed (0.5) ≈ rest (0.5) → ghost: totalAsset = closed = 0.5,
  // TP-pcts over de closes = 60%/40%. (Inherent ambigu met "exact 50% dicht" —
  // ghost-interpretatie is de bewuste status-quo, zie comment bij de heuristiek.)
  const r = await page.evaluate(() => {
    const base = { pair: 'BTC/USDT', direction: 'long', entry: '100', source: 'blofin' };
    const trades = [
      { ...base, id: 'open1', status: 'open', positionSizeAsset: '0.5', fees: '0', tpLevels: [] },
      { ...base, id: 'c_1', status: 'closed', exit: '110', pnl: '3', fees: '0', _rawCloseSize: '0.3' },
      { ...base, id: 'c_2', status: 'closed', exit: '120', pnl: '4', fees: '0', _rawCloseSize: '0.2' },
    ];
    const out = detectPartialFromSiblings(trades, 'blofin', 'blofin');
    const t = out.find(x => x.id === 'open1');
    return { originalSizeAsset: t.originalSizeAsset, tpPcts: (t.tpLevels || []).map(tp => parseFloat(tp.pct)) };
  });
  expect(parseFloat(r.originalSizeAsset)).toBeCloseTo(0.5, 6);
  expect(r.tpPcts).toEqual([60, 40]);
});
