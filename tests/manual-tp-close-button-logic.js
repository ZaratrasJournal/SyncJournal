// v12.107 logic-test voor close-button approach (vervangt v12.106 auto-close).
// Verifieert: closeData berekening + closeManualTrade handler.

function computeCloseData(trade) {
  const tps = trade.tpLevels || [];
  const isManualOpenable = trade.source === 'manual' && (trade.status === 'open' || trade.status === 'partial');
  const entryN = parseFloat(trade.entry);
  const sizeN = parseFloat(trade.positionSize);
  const isLong = trade.direction === 'long';
  if (!isManualOpenable || tps.length === 0 || !(entryN > 0) || !(sizeN > 0)) return null;
  const hitTps = tps.filter(tp => tp.status === 'hit' && parseFloat(tp.price) > 0);
  const hitPctSum = hitTps.reduce((s, tp) => s + (parseFloat(tp.pct) || 0), 0);
  if (hitPctSum < 99.99 || hitTps.length === 0) return null;
  const wExit = hitTps.reduce((s, tp) => s + parseFloat(tp.price) * parseFloat(tp.pct||0), 0) / hitPctSum;
  const grossPnl = hitTps.reduce((s, tp) => {
    const tpPrice = parseFloat(tp.price), pct = parseFloat(tp.pct) / 100;
    return s + (isLong ? (tpPrice - entryN) * sizeN * pct / entryN : (entryN - tpPrice) * sizeN * pct / entryN);
  }, 0);
  const fees = parseFloat(trade.fees) || 0;
  return { netPnl: grossPnl - fees, wExit, hitCount: hitTps.length };
}

function applyClose(trade, closeData) {
  if (!closeData) return trade;
  const ovr = trade.manualOverrides || [];
  const upd = { status: 'closed' };
  if (!ovr.includes('pnl')) upd.pnl = closeData.netPnl.toFixed(2);
  if (!ovr.includes('exit')) upd.exit = String(parseFloat(closeData.wExit.toFixed(8)));
  if (!trade.closeTime) upd.closeTime = String(Date.now());
  return { ...trade, ...upd };
}

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

t('closeData=null als <100% hit', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'hit' },
      { id: 'b', price: '72000', pct: '50', status: 'open' },
    ],
  };
  if (computeCloseData(trade) !== null) throw new Error('moet null zijn bij 50% hit');
});

t('closeData berekent correcte PnL bij 100% hit (long, 50/50)', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'hit' },
      { id: 'b', price: '72000', pct: '50', status: 'hit' },
    ],
  };
  const cd = computeCloseData(trade);
  if (!cd) throw new Error('closeData mag niet null zijn');
  // tp1: (71000-70000)*1000*0.5/70000 = 7.1428
  // tp2: (72000-70000)*1000*0.5/70000 = 14.2857
  // total = 21.4286 → "21.43"
  if (cd.netPnl.toFixed(2) !== '21.43') throw new Error(`PnL fout: ${cd.netPnl}`);
  if (cd.wExit !== 71500) throw new Error(`wExit fout: ${cd.wExit}`);
});

t('closeData=null voor exchange-trades', () => {
  const trade = {
    source: 'mexc', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'hit' },
      { id: 'b', price: '72000', pct: '50', status: 'hit' },
    ],
  };
  if (computeCloseData(trade) !== null) throw new Error('moet null zijn voor source=mexc');
});

t('closeData=null als trade al closed is', () => {
  const trade = {
    source: 'manual', status: 'closed', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    tpLevels: [
      { id: 'a', price: '71000', pct: '100', status: 'hit' },
    ],
  };
  if (computeCloseData(trade) !== null) throw new Error('moet null zijn als al closed');
});

t('applyClose update status, pnl, exit, closeTime', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', closeTime: '',
    manualOverrides: [],
    tpLevels: [{ id: 'a', price: '71000', pct: '100', status: 'hit' }],
  };
  const cd = computeCloseData(trade);
  const r = applyClose(trade, cd);
  if (r.status !== 'closed') throw new Error('status moet closed zijn');
  if (parseFloat(r.pnl).toFixed(2) !== '14.29') throw new Error(`PnL fout: ${r.pnl}`);
  if (parseFloat(r.exit) !== 71000) throw new Error(`exit fout: ${r.exit}`);
  if (!r.closeTime) throw new Error('closeTime moet gezet zijn');
});

t('applyClose respecteert manualOverrides[pnl]', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', pnl: '50.00',
    manualOverrides: ['pnl'],
    tpLevels: [{ id: 'a', price: '71000', pct: '100', status: 'hit' }],
  };
  const cd = computeCloseData(trade);
  const r = applyClose(trade, cd);
  if (r.status !== 'closed') throw new Error('status moet closed zijn');
  if (r.pnl !== '50.00') throw new Error(`pnl moet 50.00 blijven, kreeg ${r.pnl}`);
});

t('Reopen-by-remove werkt impliciet (closeData wordt null bij <100%)', () => {
  // Trade was closed via knop. User verwijdert TP → tps lijst kleiner → recompute closeData.
  // Knop verdwijnt automatisch (closeData=null) — geen reopen-state-mutatie nodig.
  const trade = {
    source: 'manual', status: 'closed', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', pnl: '21.43', exit: '71500',
    tpLevels: [{ id: 'a', price: '71000', pct: '50', status: 'hit' }],
  };
  // Status closed → computeCloseData retourneert null (button verdwijnt)
  // Geen reopen nodig — trade blijft closed met user's eigen PnL/exit, ze kunnen handmatig
  // her-openen via de status-toggle-knop bovenaan modal als gewenst.
  if (computeCloseData(trade) !== null) throw new Error('closed trade moet closeData=null geven');
});

t('Loss-trade (short → exit hoger dan entry) toont PnL als negatief', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'short',
    entry: '70000', positionSize: '1000', fees: '0',
    tpLevels: [{ id: 'a', price: '71000', pct: '100', status: 'hit' }],  // hypothetisch — gebruiker markeert "TP" hit ondanks dat 't loss is
  };
  const cd = computeCloseData(trade);
  if (!cd) throw new Error('closeData mag niet null zijn');
  // short: (70000-71000)*1000*1.0/70000 = -14.29
  if (cd.netPnl.toFixed(2) !== '-14.29') throw new Error(`PnL fout: ${cd.netPnl}`);
});

t('Fees worden afgetrokken', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '5',
    tpLevels: [{ id: 'a', price: '71000', pct: '100', status: 'hit' }],
  };
  const cd = computeCloseData(trade);
  // gross 14.2857 - 5 fees = 9.29
  if (cd.netPnl.toFixed(2) !== '9.29') throw new Error(`PnL fout: ${cd.netPnl}`);
});

let passed = 0, failed = 0;
for (const x of tests) {
  try { x.fn(); console.log(`✓ ${x.name}`); passed++; }
  catch (e) { console.error(`✗ ${x.name}: ${e.message}`); failed++; }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
