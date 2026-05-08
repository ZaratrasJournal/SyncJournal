// v12.109 logic-tests voor calcTheoreticalR + calcTheoreticalPnl helpers.

function calcTheoreticalR(trade) {
  if (trade.status !== 'missed') return null;
  const entry = parseFloat(trade.entry);
  const sl = parseFloat(trade.stopLoss);
  const hx = parseFloat(trade.hindsightExit);
  if (!isFinite(entry) || !isFinite(sl) || !isFinite(hx) || entry <= 0 || sl === entry) return null;
  const dirSign = trade.direction === 'short' ? -1 : 1;
  const risk = Math.abs(entry - sl);
  if (risk <= 0) return null;
  return ((hx - entry) * dirSign) / risk;
}

function calcTheoreticalPnl(trade) {
  if (trade.status !== 'missed') return null;
  const entry = parseFloat(trade.entry);
  const hx = parseFloat(trade.hindsightExit);
  const size = parseFloat(trade.positionSize) || 0;
  if (!isFinite(entry) || !isFinite(hx) || entry <= 0 || size <= 0) return null;
  const dirSign = trade.direction === 'short' ? -1 : 1;
  return (hx - entry) * dirSign * size / entry;
}

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

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
