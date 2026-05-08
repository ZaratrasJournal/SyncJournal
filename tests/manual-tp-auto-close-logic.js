// Pure-logica test voor v12.106 toggleStatus auto-close gedrag.
// Reproduceert de logica zoals 'ie in TradeForm zit.

function simulateToggleStatus(p, id, hasShowToast = false) {
  const newTps = (p.tpLevels || []).map(tp =>
    tp.id === id
      ? { ...tp, status: tp.status === 'hit' ? 'open' : tp.status === 'open' ? 'missed' : 'hit' }
      : tp
  );
  const isManualOpen = p.source === 'manual' && (p.status === 'open' || p.status === 'partial');
  if (isManualOpen) {
    const hitTps = newTps.filter(tp => tp.status === 'hit' && parseFloat(tp.price) > 0);
    const hitPctSum = hitTps.reduce((s, tp) => s + (parseFloat(tp.pct) || 0), 0);
    const entryN2 = parseFloat(p.entry), sizeN2 = parseFloat(p.positionSize), isLong2 = p.direction === 'long';
    if (hitPctSum >= 99.99 && entryN2 > 0 && sizeN2 > 0 && hitTps.length > 0) {
      const totalPct = hitTps.reduce((s, tp) => s + parseFloat(tp.pct || 0), 0);
      const wExit = hitTps.reduce((s, tp) => s + parseFloat(tp.price) * parseFloat(tp.pct || 0), 0) / totalPct;
      const grossPnl = hitTps.reduce((s, tp) => {
        const tpPrice = parseFloat(tp.price), pct = parseFloat(tp.pct) / 100;
        return s + (isLong2 ? (tpPrice - entryN2) * sizeN2 * pct / entryN2 : (entryN2 - tpPrice) * sizeN2 * pct / entryN2);
      }, 0);
      const fees = parseFloat(p.fees) || 0;
      const netPnl = grossPnl - fees;
      const ovr = p.manualOverrides || [];
      const updates = { tpLevels: newTps, status: 'closed' };
      if (!ovr.includes('pnl')) updates.pnl = netPnl.toFixed(2);
      if (!ovr.includes('exit')) updates.exit = String(parseFloat(wExit.toFixed(8)));
      if (!p.closeTime) updates.closeTime = String(Date.now());
      return { ...p, ...updates };
    }
  }
  return { ...p, tpLevels: newTps };
}

const tests = [];
const testCase = (name, fn) => tests.push({ name, fn });

// Helper: toggle-cyclus is open→missed→hit→open. Voor "open" naar "hit" zijn 2 clicks nodig.
function toHit(trade, id) {
  let r = simulateToggleStatus(trade, id); // open → missed
  r = simulateToggleStatus(r, id);          // missed → hit
  return r;
}

testCase('Long manual trade, beide TPs hit (50/50) → auto-close + winst-PnL', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', closeTime: '',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'open' },
      { id: 'b', price: '72000', pct: '50', status: 'open' },
    ],
  };
  let r = toHit(trade, 'a');
  if (r.status !== 'open') throw new Error(`Na 1e hit: status moet open blijven, kreeg ${r.status}`);
  if (r.pnl) throw new Error(`Na 1e hit: pnl moet leeg blijven, kreeg ${r.pnl}`);
  r = toHit(r, 'b');
  if (r.status !== 'closed') throw new Error(`Na 2e hit: status moet closed zijn, kreeg ${r.status}`);
  // tp1: (71000-70000)*1000*0.5/70000 = 7.142857
  // tp2: (72000-70000)*1000*0.5/70000 = 14.285714
  // total = 21.428571 → "21.43"
  if (parseFloat(r.pnl).toFixed(2) !== '21.43') throw new Error(`PnL fout: ${r.pnl}, expected 21.43`);
  if (parseFloat(r.exit) !== 71500) throw new Error(`Exit fout: ${r.exit}, expected 71500 (50/50 wavg)`);
});

testCase('Short manual trade, beide TPs hit → auto-close + winst-PnL', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'short',
    entry: '80000', positionSize: '1000', fees: '0', closeTime: '',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '79000', pct: '60', status: 'open' },
      { id: 'b', price: '78000', pct: '40', status: 'open' },
    ],
  };
  let r = toHit(trade, 'a');
  r = toHit(r, 'b');
  if (r.status !== 'closed') throw new Error(`status moet closed zijn, kreeg ${r.status}`);
  // tp1: (80000-79000)*1000*0.6/80000 = 7.5
  // tp2: (80000-78000)*1000*0.4/80000 = 10
  // total = 17.5
  if (parseFloat(r.pnl).toFixed(2) !== '17.50') throw new Error(`PnL fout: ${r.pnl}, expected 17.50`);
  if (parseFloat(r.exit) !== 78600) throw new Error(`Exit fout: ${r.exit}`);
});

testCase('Slechts 50% hit → trade blijft open', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'open' },
      { id: 'b', price: '72000', pct: '50', status: 'open' },
    ],
  };
  const r = toHit(trade, 'a');
  if (r.status !== 'open') throw new Error(`status moet open blijven, kreeg ${r.status}`);
  if (r.pnl) throw new Error(`pnl moet leeg blijven, kreeg ${r.pnl}`);
});

testCase('Exchange trade (source=mexc) → géén auto-close', () => {
  const trade = {
    source: 'mexc', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'hit' },
      { id: 'b', price: '72000', pct: '50', status: 'open' },
    ],
  };
  const r = toHit(trade, 'b');
  if (r.status !== 'open') throw new Error(`source=mexc: status moet open blijven, kreeg ${r.status}`);
  if (r.pnl) throw new Error(`source=mexc: pnl moet leeg blijven, kreeg ${r.pnl}`);
});

testCase('Manueel ingevoerde PnL wordt niet overschreven', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', pnl: '50.00',
    manualOverrides: ['pnl'],
    tpLevels: [
      { id: 'a', price: '71000', pct: '100', status: 'open' },
    ],
  };
  const r = toHit(trade, 'a');
  if (r.status !== 'closed') throw new Error(`status moet closed zijn (manual override behoudt PnL maar sluit wel)`);
  if (r.pnl !== '50.00') throw new Error(`pnl moet 50.00 blijven (manual override), kreeg ${r.pnl}`);
});

testCase('Toggle hit→open na auto-close: trade blijft closed (geen ongewenste re-open)', () => {
  // Trade is al closed. Toggle hit → open mag niet status terugzetten.
  const trade = {
    source: 'manual', status: 'closed', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '0', pnl: '21.43', exit: '71500',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '71000', pct: '50', status: 'hit' },
      { id: 'b', price: '72000', pct: '50', status: 'hit' },
    ],
  };
  const r = simulateToggleStatus(trade, 'a'); // hit → open
  if (r.status !== 'closed') throw new Error(`status moet closed blijven na toggle-off (was ${trade.status}, nu ${r.status})`);
});

testCase('Fees worden afgetrokken van auto-PnL', () => {
  const trade = {
    source: 'manual', status: 'open', direction: 'long',
    entry: '70000', positionSize: '1000', fees: '5.00',
    manualOverrides: [],
    tpLevels: [
      { id: 'a', price: '71000', pct: '100', status: 'open' },
    ],
  };
  const r = toHit(trade, 'a');
  // gross = (71000-70000)*1000*1.0/70000 = 14.2857
  // net = 14.2857 - 5 = 9.29
  if (parseFloat(r.pnl).toFixed(2) !== '9.29') throw new Error(`PnL fout: ${r.pnl}, expected 9.29`);
});

let passed = 0, failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`✓ ${t.name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${t.name}: ${e.message}`);
    failed++;
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
