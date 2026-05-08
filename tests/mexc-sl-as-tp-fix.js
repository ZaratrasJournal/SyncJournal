// Reproduceer + valideer fix voor MEXC SL-orders die als TP getoond worden
// Snapshot toont positionId 1367600842 met SL=81000 (triggerSide=2)
// Bug: client behandelt _pending fills als TP zonder triggerSide te checken
// Fix: filter _triggerSide===2 uit pending-TPs, route naar trade.stopLoss

// Simulate worker output for the trade
const sample = [
  // Real fill (TP1 hit at 79491.6)
  { _pending: false, price: '79491.6', vol: 123, profit: 13.05, positionId: 1367600842 },
  // Pending TP (triggerSide=1)
  { _pending: true, _triggerSide: 1, price: '79000', vol: 124, positionId: 1367600842 },
  // Pending SL (triggerSide=2) — should NOT be a TP
  { _pending: true, _triggerSide: 2, price: '81000', vol: 247, positionId: 1367600842 },
];

// Simulate OLD client behavior
const oldFilledFills = sample.filter(f => !f._pending);
const oldPendingFills = sample.filter(f => f._pending);
const oldPendingTPs = oldPendingFills.map(f => ({ price: f.price, status: 'open' }));
console.log('=== OLD BEHAVIOR (BUGGY) ===');
console.log('Filled fills:', oldFilledFills.length);
console.log('Pending fills (treated as TPs):', oldPendingFills.length);
console.log('  TPs that should be TPs:', oldPendingTPs.filter(tp => parseFloat(tp.price) < 80552.7).length);
console.log('  TPs that should NOT be TPs (= SLs):', oldPendingTPs.filter(tp => parseFloat(tp.price) > 80552.7).length, '← BUG');

// Simulate NEW client behavior
const newFilledFills = sample.filter(f => !f._pending);
const newPendingFills = sample.filter(f => f._pending && f._triggerSide !== 2);
const newPendingSLs = sample.filter(f => f._pending && f._triggerSide === 2);
const newInferredSL = newPendingSLs.length ? newPendingSLs.reduce((best, f) => {
  const v = Math.abs(parseFloat(f.vol || 0));
  return v > best._v ? { p: f.price, _v: v } : best;
}, { p: '', _v: 0 }).p : '';

console.log('\n=== NEW BEHAVIOR (FIX) ===');
console.log('Filled fills:', newFilledFills.length);
console.log('Pending TPs (only triggerSide=1):', newPendingFills.length);
console.log('Pending SLs (separated):', newPendingSLs.length);
console.log('Inferred trade.stopLoss:', newInferredSL);

// Expectations
const ok1 = newPendingFills.length === 1 && newPendingFills[0].price === '79000';
const ok2 = newInferredSL === '81000';
const ok3 = !newPendingFills.some(f => f._triggerSide === 2);

console.log('\n=== ASSERTIONS ===');
console.log(`Pending TPs only contains TP-orders (triggerSide=1): ${ok1 ? '✓' : '✗'}`);
console.log(`Inferred stopLoss = 81000: ${ok2 ? '✓' : '✗'}`);
console.log(`No SL-orders in pendingTPs list: ${ok3 ? '✓' : '✗'}`);

process.exit(ok1 && ok2 && ok3 ? 0 : 1);
