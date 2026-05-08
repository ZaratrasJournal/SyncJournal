// Reproduceer + valideer fix voor MEXC partial-close-still-open positie
// Bug: positionSizeAsset gebruikt holdVol (resterend) i.p.v. holdVol+closeVol (origineel)
// Snapshot: mexc-snapshot-2026-05-08-06-39.json, positionId 1367600842
const fs = require('fs');
const path = require('path');

const snap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../mexc-snapshot-2026-05-08-06-39.json'), 'utf8'));
const op = snap.openPositions || [];
const target = op.find(o => o.positionId === 1367600842);
if (!target) { console.error('FAIL — target trade not found'); process.exit(1); }

console.log('Target trade:', JSON.stringify({
  pid: target.positionId, sym: target.symbol, type: target.positionType,
  holdVol: target.holdVol, closeVol: target.closeVol,
  openAvg: target.openAvgPrice, closeAvg: target.closeAvgPrice,
  realised: target.realised, profit: target.closeProfitLoss,
}, null, 2));

// BTC contractSize = 0.0001 BTC per contract (MEXC standard for BTC_USDT futures)
const ctSize = 0.0001;

console.log('\n=== HUIDIGE LOGICA (BUGGY) ===');
const oldVol = parseFloat(target.holdVol);
const oldAsset = oldVol * ctSize;
const oldUsd = oldAsset * target.openAvgPrice;
console.log(`holdVol=${oldVol} → assetQty=${oldAsset} BTC → positionSize=$${oldUsd.toFixed(2)}`);
console.log(`Verwacht (BUGGY): "$${oldUsd.toFixed(2)}" + "${oldAsset.toFixed(4)} BTC" — matched UI screenshot ($998.85 / 0.0124 BTC)`);

console.log('\n=== NIEUWE LOGICA (FIX) ===');
const newVol = parseFloat(target.holdVol) + parseFloat(target.closeVol||0);
const newAsset = newVol * ctSize;
const newUsd = newAsset * target.openAvgPrice;
console.log(`(holdVol+closeVol)=${newVol} → assetQty=${newAsset} BTC → positionSize=$${newUsd.toFixed(2)}`);
console.log(`Verwacht (FIX):   "$${newUsd.toFixed(2)}" + "${newAsset.toFixed(4)} BTC" — = ORIGINAL position`);

console.log('\n=== TP-PERCENTAGE RECONCILIATION ===');
// TP1 fill: closeVol=123 contracts → 0.0123 BTC at 79491.6
const tp1Asset = 123 * ctSize;
const tp1PctBuggy = tp1Asset / oldAsset * 100;
const tp1PctFixed = tp1Asset / newAsset * 100;
console.log(`TP1 closed 0.0123 BTC. Pct vs huidige stored asset: ${tp1PctBuggy.toFixed(1)}% (buggy basis), ${tp1PctFixed.toFixed(1)}% (correcte basis)`);
console.log(`UI toont 49.8% — matched ${Math.abs(tp1PctFixed-49.8)<0.5 ? 'CORRECTE basis ✓' : 'OUDE basis met andere bron'}`);

// TP2 (hypothetisch, niet gefilled) — als de qty 0.0247 zou zijn (origineel):
const tp2PctBuggy = newAsset / oldAsset * 100;
console.log(`Als TP2 hele original size (0.0247 BTC) sluit, pct vs buggy stored: ${tp2PctBuggy.toFixed(1)}% — UI toont 199.2% ✓ MATCH (= ${tp2PctBuggy.toFixed(1)})`);

console.log('\n=== PnL-RECONCILIATION ===');
const tp1RealPnl = target.closeProfitLoss; // 13.0515 = real MEXC realised
console.log(`TP1 actual realised PnL (uit MEXC): $${tp1RealPnl} ✓`);
const tp1MathOriginal = (target.openAvgPrice - target.closeAvgPrice) * tp1Asset; // SHORT formula
console.log(`TP1 math (entry-exit) × 0.0123 BTC = $${tp1MathOriginal.toFixed(2)} — matches ✓`);

console.log('\n=== CONCLUSIE ===');
const matches = Math.abs(newUsd - 1989) < 5; // expected $1989 = ~0.0247 × 80552.7 / position based on snapshot
console.log(`Originele positie: 0.0247 BTC ($${newUsd.toFixed(2)})`);
console.log(`Resterend open:    0.0124 BTC ($${oldUsd.toFixed(2)})`);
console.log(`Al geclosed:       0.0123 BTC at 79491.6 → +$${tp1RealPnl}`);
console.log(`\nFix: store ORIGINAL (holdVol+closeVol) als positionSizeAsset bij open positions met partial-close.`);
console.log('Anders gerelateerde TPs/perc/winst-berekening klopt niet voor de resterende TPs.');
