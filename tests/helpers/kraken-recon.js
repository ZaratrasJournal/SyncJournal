// Onafhankelijke reconstructie van Kraken Futures-posities uit de account-log CSV, plus de
// vergelijking met journal-trades. Zelfde logica als scripts/kraken-recon.js (de referentie
// uit docs/opdracht-kraken-fix-2026-09-26.md), hier als functies voor de specs.
// Bewust een andere aanpak dan de adapter (paring op dateTime+contract+prijs i.p.v.
// positioneel, geen funding), zodat de test niet dezelfde fout twee keer kan maken.
function reconstruct(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const hdr = lines[0].split(',');
  const rows = lines.slice(1).map(l => { const c = l.split(','); const o = {}; hdr.forEach((h, i) => o[h] = c[i]); return o; });
  const ft = rows.filter(r => r.type === 'futures trade');
  const contractRows = ft.filter(r => r.symbol === r.contract);
  const usdRows = ft.filter(r => r.symbol !== r.contract);
  const key = r => r.dateTime + '|' + r.contract + '|' + (+r['trade price']).toFixed(2);
  const usdBy = {}; for (const r of usdRows) { (usdBy[key(r)] = usdBy[key(r)] || []).push(r); }
  let unpaired = 0;
  const fills = contractRows.map(r => {
    const u = (usdBy[key(r)] || []).shift(); if (!u) unpaired++;
    return { t: Date.parse(r.dateTime.replace(' ', 'T') + 'Z'), contract: r.contract, qty: +r.change, bal: +r['new balance'],
      price: +r['trade price'], pnl: u ? +u['realized pnl'] || 0 : 0, fee: u ? +u.fee || 0 : 0, funding: u ? +u['realized funding'] || 0 : 0 };
  }).sort((a, b) => a.t - b.t || (Math.abs(a.bal) > Math.abs(b.bal) ? -1 : 1));
  const pos = []; const open = {};
  const finish = (p) => {
    const w = (arr) => { let q = 0, v = 0; for (const f of arr) { q += Math.abs(f.qty); v += Math.abs(f.qty) * f.price; } return q ? { qty: q, avg: v / q } : { qty: 0, avg: null }; };
    const o = w(p.opens), c = w(p.closes);
    pos.push({ contract: p.contract, dir: p.dir, openT: p.openT, closeT: p.closeT, qty: o.qty, entry: o.avg, exit: c.avg, notional: o.qty * (o.avg || 0),
      gross: p.pnl, fee: p.fee, funding: p.funding, net: p.pnl - p.fee, nOpens: p.opens.length, nCloses: p.closes.length, nFills: p.opens.length + p.closes.length, flip: p.flip });
  };
  for (const f of fills) {
    const c = f.contract; let p = open[c];
    const newBal = f.bal;
    if (!p) { p = open[c] = { contract: c, dir: f.qty > 0 ? 'long' : 'short', openT: f.t, opens: [], closes: [], fee: 0, pnl: 0, funding: 0, bal: 0, flip: false }; }
    const sameDir = (p.dir === 'long' && f.qty > 0) || (p.dir === 'short' && f.qty < 0);
    if (sameDir) { p.opens.push(f); } else { p.closes.push(f); p.pnl += f.pnl; }
    p.fee += f.fee; p.funding += f.funding; p.bal = newBal;
    if (Math.abs(newBal) < 1e-9) { p.closeT = f.t; finish(p); delete open[c]; }
    else if (Math.sign(newBal) !== (p.dir === 'long' ? 1 : -1)) {
      p.closeT = f.t; p.flip = true; finish(p); delete open[c];
      open[c] = { contract: c, dir: newBal > 0 ? 'long' : 'short', openT: f.t, opens: [{ ...f, qty: newBal }], closes: [], fee: 0, pnl: 0, funding: 0, bal: newBal, flip: true };
    }
  }
  for (const c in open) { const p = open[c]; p.closeT = null; finish(p); }
  // funding-regels (funding rate change) per positie, voor de netto-referentie mét funding
  const fr = rows.filter(r => r.type === 'funding rate change' && r.contract);
  let fundingRows = 0;
  for (const r of fr) {
    const t = Date.parse(r.dateTime.replace(' ', 'T') + 'Z');
    const p = pos.find(p => p.contract === r.contract && t >= p.openT && p.closeT != null && t <= p.closeT);
    if (p) { p.funding += +r['realized funding'] || 0; fundingRows++; }
  }
  return { positions: pos, fills: fills.length, unpaired, fundingRows };
}

// Vergelijk gereconstrueerde posities met journal-trades (SJ-vorm: dir/size/pnl/openTime/closeTime).
function compare(positions, trades) {
  const closed = positions.filter(p => p.closeT != null).sort((a, b) => a.openT - b.openT);
  const used = new Set();
  let matched = 0, dirMis = 0, sizeMis = 0, pnlMis = 0; const lines = [];
  for (const p of closed) {
    let best = null, bd = Infinity;
    for (const t of trades) { if (used.has(t.id)) continue; const d = Math.min(Math.abs(+t.closeTime - p.closeT), Math.abs(+t.openTime - p.openT)); if (d < bd) { bd = d; best = t; } }
    const ok = best && bd <= 3 * 60 * 1000;
    if (ok) {
      used.add(best.id); matched++;
      const flags = [];
      if (String(best.dir || '').toLowerCase() !== p.dir) { flags.push('DIR'); dirMis++; }
      if (Math.abs(+best.size - p.notional) / p.notional > 0.05) { flags.push('SIZE'); sizeMis++; }
      if (Math.abs(+best.pnl - p.net) > 0.5) { flags.push('PNL'); pnlMis++; }
      if (flags.length) lines.push(`MISMATCH ${flags.join(',')} | ${p.contract} ${p.dir} ${new Date(p.openT).toISOString()} qty ${p.qty} notional ${p.notional.toFixed(2)} net ${p.net.toFixed(2)} | #${best.id} ${best.dir} sz ${best.size} pnl ${best.pnl}`);
    } else lines.push(`MISSING | ${p.contract} ${p.dir} ${new Date(p.openT).toISOString()} → ${new Date(p.closeT).toISOString()}`);
  }
  const extra = trades.filter(t => !used.has(t.id)).map(t => `EXTRA | #${t.id} ${t.dir} ${t.openTime}→${t.closeTime} pnl ${t.pnl}`);
  return { closed: closed.length, journal: trades.length, matched, missing: closed.length - matched, dirMis, sizeMis, pnlMis, extra: extra.length,
    summary: `SUMMARY: csv closed positions ${closed.length}, journal ${trades.length}, matched ${matched}, missing ${closed.length - matched}, dir-mismatch ${dirMis}, size-mismatch ${sizeMis}, pnl-mismatch ${pnlMis}, extra ${extra.length}`,
    lines: [...lines, ...extra] };
}

module.exports = { reconstruct, compare };
