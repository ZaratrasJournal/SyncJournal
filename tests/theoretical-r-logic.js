// v12.109 logic-tests voor calcTheoreticalR + calcTheoreticalPnl helpers.

// v12.113: derive exit uit hit-TPs eerst, hindsightExit als fallback.
function _simTradeExit(trade) {
  if (trade.status !== 'missed') return null;
  const tps = trade.tpLevels || [];
  const hitTps = tps.filter(tp => tp && tp.status === 'hit' && parseFloat(tp.price) > 0);
  const hitPctSum = hitTps.reduce((s, tp) => s + (parseFloat(tp.pct) || 0), 0);
  if (hitPctSum >= 99.99 && hitTps.length > 0) {
    const wExit = hitTps.reduce((s, tp) => s + parseFloat(tp.price) * parseFloat(tp.pct||0), 0) / hitPctSum;
    return { exit: wExit, source: 'tps' };
  }
  const hx = parseFloat(trade.hindsightExit);
  if (isFinite(hx) && hx > 0) return { exit: hx, source: 'hindsight' };
  return null;
}

function calcTheoreticalR(trade) {
  if (trade.status !== 'missed') return null;
  const entry = parseFloat(trade.entry);
  const sl = parseFloat(trade.stopLoss);
  if (!isFinite(entry) || !isFinite(sl) || entry <= 0 || sl === entry) return null;
  const exitInfo = _simTradeExit(trade);
  if (!exitInfo) return null;
  const dirSign = trade.direction === 'short' ? -1 : 1;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  return ((exitInfo.exit - entry) * dirSign) / risk;
}

function calcTheoreticalPnl(trade) {
  if (trade.status !== 'missed') return null;
  const entry = parseFloat(trade.entry);
  const size = parseFloat(trade.positionSize) || 0;
  if (!isFinite(entry) || entry <= 0 || size <= 0) return null;
  const exitInfo = _simTradeExit(trade);
  if (!exitInfo) return null;
  const dirSign = trade.direction === 'short' ? -1 : 1;
  return (exitInfo.exit - entry) * dirSign * size / entry;
}

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

t('v12.113: BT LONG met 100% hit TPs → R afgeleid uit weighted exit', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000', positionSize: '1000',
    tpLevels: [
      { price: '71000', pct: '50', status: 'hit' },
      { price: '72000', pct: '50', status: 'hit' },
    ]
  };
  const r = calcTheoreticalR(trade);
  // weighted exit = (71000*50 + 72000*50)/100 = 71500
  // R = (71500-70000)/1000 = 1.5
  if (r.toFixed(1) !== '1.5') throw new Error(`R fout uit TPs: ${r}`);
  // PnL: (71500-70000)*1000/70000 = 21.43
  const p = calcTheoreticalPnl(trade);
  if (p.toFixed(2) !== '21.43') throw new Error(`PnL uit TPs: ${p}`);
});

t('v12.113: BT met partial-hit TPs (50%) → null (sample niet compleet)', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000',
    tpLevels: [
      { price: '71000', pct: '50', status: 'hit' },
      { price: '72000', pct: '50', status: 'open' },
    ]
  };
  // Partial hit + geen hindsightExit → null
  if (calcTheoreticalR(trade) !== null) throw new Error('moet null zijn bij partial-hit zonder hindsightExit');
});

t('v12.113: hit-TPs PRIOR boven hindsightExit (TPs winnen)', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000',
    hindsightExit: '99999', // wild value, moet GENEGEERD worden
    tpLevels: [
      { price: '72000', pct: '100', status: 'hit' },
    ]
  };
  const r = calcTheoreticalR(trade);
  // Uit TPs: R = (72000-70000)/1000 = 2.0 (NIET uit 99999)
  if (r.toFixed(1) !== '2.0') throw new Error(`Hit-TPs moeten priority hebben: ${r}`);
});

t('v12.113: geen TPs → fallback naar hindsightExit', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000', hindsightExit: '72000' };
  const r = calcTheoreticalR(trade);
  if (r.toFixed(1) !== '2.0') throw new Error(`hindsightExit fallback: ${r}`);
});

t('Backtest LONG win: entry 70k, SL 69k, hindsightExit 72k → +2R', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000', hindsightExit: '72000', positionSize: '1000' };
  const r = calcTheoreticalR(trade);
  if (r.toFixed(1) !== '2.0') throw new Error(`R fout: ${r}`);
  // PnL: (72000-70000)*1000/70000 = 28.57
  const p = calcTheoreticalPnl(trade);
  if (p.toFixed(2) !== '28.57') throw new Error(`PnL fout: ${p}`);
});

t('Backtest SHORT win: entry 80k, SL 81k, hindsightExit 78k → +2R', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'short', entry: '80000', stopLoss: '81000', hindsightExit: '78000', positionSize: '1000' };
  const r = calcTheoreticalR(trade);
  if (r.toFixed(1) !== '2.0') throw new Error(`R fout: ${r}`);
});

t('Paper LOSS LONG: entry 70k, SL 69k, hindsightExit 68500 → -1.5R', () => {
  const trade = { status: 'missed', simType: 'paper', direction: 'long', entry: '70000', stopLoss: '69000', hindsightExit: '68500' };
  const r = calcTheoreticalR(trade);
  if (r.toFixed(1) !== '-1.5') throw new Error(`R fout: ${r}`);
});

t('Missed (legacy/no simType) werkt ook', () => {
  const trade = { status: 'missed', direction: 'long', entry: '100', stopLoss: '99', hindsightExit: '102' };
  const r = calcTheoreticalR(trade);
  if (r.toFixed(1) !== '2.0') throw new Error(`R fout voor legacy missed: ${r}`);
});

t('Ontbrekende hindsightExit → null', () => {
  const trade = { status: 'missed', simType: 'backtest', direction: 'long', entry: '70000', stopLoss: '69000', hindsightExit: '' };
  if (calcTheoreticalR(trade) !== null) throw new Error('moet null zijn als hindsightExit leeg');
});

t('Real trade (status closed) → null (alleen voor missed)', () => {
  const trade = { status: 'closed', direction: 'long', entry: '70000', stopLoss: '69000', hindsightExit: '72000' };
  if (calcTheoreticalR(trade) !== null) throw new Error('moet null zijn voor closed trades');
});

t('SL=entry (geen risk) → null', () => {
  const trade = { status: 'missed', direction: 'long', entry: '70000', stopLoss: '70000', hindsightExit: '72000' };
  if (calcTheoreticalR(trade) !== null) throw new Error('moet null zijn als geen risk');
});

t('PnL ontbreekt size → null', () => {
  const trade = { status: 'missed', direction: 'long', entry: '70000', hindsightExit: '72000', positionSize: '0' };
  if (calcTheoreticalPnl(trade) !== null) throw new Error('moet null zijn als size 0');
});

let passed = 0, failed = 0;
for (const x of tests) {
  try { x.fn(); console.log(`✓ ${x.name}`); passed++; }
  catch (e) { console.error(`✗ ${x.name}: ${e.message}`); failed++; }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
