// Denny 24-09-2026: "bedenk goede en foute scenario's" voor de handmatige trade met TP-afrekening.
// Goed: short met 3 TP's, size in de asset, bestaande trade bijwerken, TP verwijderen, stop geraakt
// na TP1, heropenen en ongewijzigd opslaan, entry wijzigen ná de hits, tabel/dashboard kloppen.
// Fout: lege TP-prijs, 0%, meer dan 100% verdeeld, onzin-tijden, lege entry, hit aan/uit,
// handmatig account dat niet meer bestaat, trade op gekoppelde exchange bewerken.
// Invariant: de opgeslagen P&L == som van de afgeleide stappen − fees.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = []; let dialogs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);

  const reset = () => p.evaluate(() => { T = []; TRASH = []; persist(); CONNS = { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0 } }; persistConns(); MANUAL = [{ id: 'm1', name: 'Eigen boek', transactions: [] }]; persistManual(); STATE.page = 'trades'; render(); });
  const g = id => p.evaluate(id => { const el = document.getElementById(id); return el ? el.value : null; }, id);
  const set = (id, v) => p.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, [id, v]);
  const nieuw = async (velden) => { await p.evaluate(() => openForm(null)); await p.waitForTimeout(80); for (const [k, v] of Object.entries(velden)) await set('f_' + k, v); };
  const tps = (lijst) => p.evaluate(lijst => { formTPs = lijst.map(x => ({ price: x.price, pct: x.pct, r: '', hit: !!x.hit, tsTime: x.t || '' })); renderTPs(); calcTrade(true); }, lijst);
  const prev = () => p.evaluate(() => document.getElementById('calcPrev').innerText.replace(/\s+/g, ' '));
  const bewaar = () => p.evaluate(() => { submitForm(null); return T[0]; });
  // invariant: som van de afgeleide stappen − fees == opgeslagen P&L
  const invariant = (t) => p.evaluate(id => { const t = T.find(x => x.id === id); const st = stappenVan(t); if (!st.length) return { ok: false, reden: 'geen stappen' }; const som = st.reduce((a, x) => a + (x.pnl || 0), 0) - Math.abs(+t.fees || 0); return { ok: Math.abs(som - t.pnl) < 0.02, som: +som.toFixed(2), pnl: t.pnl, n: st.length }; }, t.id);

  console.log('─── GOED: short, drie TP\'s (40/30/30), tijden door elkaar getypt ───');
  {
    await reset();
    await nieuw({ pair: 'BTC/USDC', date: '2026-09-20', time: '08:00', dir: 'short', entry: '80000', stop: '80800', size: '4000', fees: '2' });
    await tps([{ price: '79600', pct: 40, hit: true, t: '09:10' }, { price: '79200', pct: 30, hit: true, t: '12:40' }, { price: '78800', pct: 30, hit: true, t: '10:05' }]);
    // 400/80000·4000·0,4 = 8 · 800/80000·4000·0,3 = 12 · 1200/80000·4000·0,3 = 18 → 38 − 2 = 36
    ok('P&L 36,00 · exit gewogen 79.240 · gesloten', bij(+await g('f_pnl'), 36, 0.005) && await g('f_exit') === '79240' && await g('f_status') === 'closed', JSON.stringify({ pnl: await g('f_pnl'), exit: await g('f_exit'), st: await g('f_status') }));
    ok('sluittijd = de laatste tijd (12:40), niet de laatste TP-regel', await g('f_closeTime') === '12:40', JSON.stringify(await g('f_closeTime')));
    ok('R = 36 / (800/80000·4000 = 40) = 0,9', bij(+await g('f_r'), 0.9, 0.01), JSON.stringify(await g('f_r')));
    const t = await bewaar(); const inv = await invariant(t);
    ok('opgeslagen: stappen (open + 3 af) tellen op tot de P&L', inv.ok && inv.n === 4, JSON.stringify(inv));
    const volgorde = await p.evaluate(id => stappenVan(T.find(x => x.id === id)).map(x => ts2time(x.ts)), t.id);
    ok('stappen staan op tijd: 08:00, 09:10, 10:05, 12:40', volgorde.join(',') === '08:00,09:10,10:05,12:40', JSON.stringify(volgorde));
  }

  console.log('─── GOED: size in de asset (0,05 BTC) ───');
  {
    await reset();
    await nieuw({ pair: 'BTC/USDC', date: '2026-09-20', time: '08:00', entry: '80000', stop: '79000' });
    await p.evaluate(() => setSizeUnit('asset')); await set('f_size', '0.05');
    await tps([{ price: '81000', pct: 50, hit: true, t: '09:00' }, { price: '82000', pct: 50, hit: true, t: '10:00' }]);
    // size $ 4000: 1000/80000·4000·0,5 = 25 + 2000/80000·4000·0,5 = 50 → 75
    ok('P&L 75,00 met size omgerekend via entry', bij(+await g('f_pnl'), 75, 0.005), JSON.stringify(await g('f_pnl')));
    const t = await bewaar(); const inv = await invariant(t);
    ok('opgeslagen als 0,05 BTC / $ 4000, stappen kloppen', t.qty === 0.05 && t.size === '4000' && inv.ok, JSON.stringify({ qty: t.qty, size: t.size, inv }));
  }

  console.log('─── GOED: bestaande trade later bijwerken (TP2 alsnog gehaald) ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', date: '2026-09-20', time: '08:00', entry: '2400', stop: '2380', size: '1000' });
    await tps([{ price: '2420', pct: 50, hit: true, t: '09:00' }, { price: '2450', pct: 50 }]);
    let t = await bewaar();
    ok('eerst: partial met 4,17 en zonder exit', t.status === 'partial' && bij(t.pnl, 4.17, 0.005) && !t.exit, JSON.stringify({ s: t.status, pnl: t.pnl, exit: t.exit }));
    await p.evaluate(id => { openForm(id); }, t.id); await p.waitForTimeout(80);
    ok('heropend: TP1 hit met tijd 09:00, TP2 open', await p.evaluate(() => formTPs.map(x => [x.hit, x.tsTime]).join(';')) === 'true,09:00;false,', await p.evaluate(() => JSON.stringify(formTPs)));
    await p.evaluate(() => { toggleTPHit(1); formTPs[1].tsTime = '11:00'; calcTrade(true); });
    ok('TP2 hit: exit 2435, P&L 14,58, gesloten om 11:00', await g('f_exit') === '2435' && bij(+await g('f_pnl'), 14.58, 0.005) && await g('f_status') === 'closed' && await g('f_closeTime') === '11:00', JSON.stringify({ e: await g('f_exit'), p: await g('f_pnl'), s: await g('f_status'), c: await g('f_closeTime') }));
    t = await p.evaluate(id => { submitForm(id); return T.find(x => x.id === id); }, t.id);
    const inv = await invariant(t);
    ok('bijgewerkt opgeslagen, één trade, stappen kloppen', await p.evaluate(() => T.length) === 1 && t.status === 'closed' && inv.ok && inv.n === 3, JSON.stringify(inv));
  }

  console.log('─── GOED: heropenen en ongewijzigd opslaan verandert niets ───');
  {
    const voor = await p.evaluate(() => JSON.stringify({ ...T[0], id: 0 }));
    await p.evaluate(() => { openForm(T[0].id); }); await p.waitForTimeout(80);
    await p.evaluate(() => { calcTrade(true); submitForm(T[0].id); });
    const na = await p.evaluate(() => JSON.stringify({ ...T[0], id: 0 }));
    ok('idempotent: P&L, exit, status, TP-tijden en sluittijd gelijk', voor === na, voor === na ? '' : (voor.slice(0, 200) + ' ≠ ' + na.slice(0, 200)));
  }

  console.log('─── GOED: TP1 gehaald, daarna gestopt (rest op de stop) ───');
  {
    await reset();
    await nieuw({ pair: 'SOL/USDC', date: '2026-09-20', time: '08:00', entry: '200', stop: '196', size: '1000' });
    await tps([{ price: '204', pct: 50, hit: true, t: '09:00' }, { price: '208', pct: 50 }]);
    await set('f_exit', '196'); await set('f_closeTime', '10:30');
    // +2%·1000·0,5 = 10 · −2%·1000·0,5 = −10 → 0
    ok('P&L 0,00: winst TP1 weggeveegd door de stop · gesloten', bij(+await g('f_pnl'), 0, 0.005) && await g('f_status') === 'closed', JSON.stringify({ p: await g('f_pnl'), s: await g('f_status') }));
    ok('preview zegt dat het restant op je exit ging', /restant 50% op je exit/.test(await prev()), await prev());
    const t = await bewaar(); const inv = await invariant(t);
    ok('stappen: open, TP1 op 09:00, rest op 196 om 10:30', inv.ok && inv.n === 3, JSON.stringify(inv));
  }

  console.log('─── GOED: entry wijzigen ná de hits rekent opnieuw ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', entry: '2400', size: '1000' });
    await tps([{ price: '2424', pct: 100, hit: true }]);
    ok('entry 2400 → +10,00', bij(+await g('f_pnl'), 10, 0.005), JSON.stringify(await g('f_pnl')));
    await set('f_entry', '2000');
    ok('entry 2000 → (424/2000)·1000 = +212,00', bij(+await g('f_pnl'), 212, 0.005), JSON.stringify(await g('f_pnl')));
    await set('f_dir', 'short');
    ok('richting short → −212,00', bij(+await g('f_pnl'), -212, 0.005), JSON.stringify(await g('f_pnl')));
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── GOED: tabel en dashboard tonen wat het formulier zei ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', date: '2026-09-20', time: '08:00', entry: '2400', size: '1000' });
    await tps([{ price: '2420', pct: 50, hit: true, t: '09:00' }, { price: '2450', pct: 50, hit: true, t: '10:00' }]);
    const t = await bewaar();
    const r = await p.evaluate(() => { STATE.page = 'trades'; STATE.tradeTab = 'all'; render(); const cel = document.querySelector('td[data-l="P&L"]'); const s = document.querySelector('td[data-l="Status"], .stb'); go('dashboard'); const k = document.querySelector('.kpis').textContent; return { cel: cel && cel.innerText.replace(/\s+/g, ' ').trim(), kpi: /\$ 15\b/.test(k) }; });   // het dashboard rondt op hele dollars
    ok('tabel: +$ 14,58 · dashboard netto $ 15', /\+\$ 14,58/.test(r.cel || '') && r.kpi, JSON.stringify(r));
  }

  console.log('─── FOUT: lege TP-prijs of 0% op "hit" telt niet mee ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', entry: '2400', exit: '2410', size: '1000' });
    await tps([{ price: '', pct: 50, hit: true }, { price: '2450', pct: 0, hit: true }]);
    ok('valt terug op de exit: (10/2400)·1000 = 4,17', bij(+await g('f_pnl'), 4.17, 0.005), JSON.stringify(await g('f_pnl')));
    ok('geen TP-regel in de preview', !/TP's/.test(await prev()), await prev());
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── FOUT: meer dan 100% verdeeld (60 + 60, beide hit) ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', date: '2026-09-20', time: '08:00', entry: '2400', size: '1000' });
    await tps([{ price: '2420', pct: 60, hit: true, t: '09:00' }, { price: '2450', pct: 60, hit: true, t: '10:00' }]);
    // naar rato teruggeschaald naar 100%: 50/50 → exit 2435 → 14,58 (niet 120% van de positie)
    ok('wordt naar rato op 100% gezet: P&L 14,58, niet 17,50', bij(+await g('f_pnl'), 14.58, 0.005), JSON.stringify(await g('f_pnl')));
    ok('de verdeling blijft rood: "moet samen 100% zijn"', /moet samen 100%/.test(await p.evaluate(() => document.getElementById('tpbuilder').innerText)));
    const t = await bewaar(); const inv = await invariant(t);
    ok('en de stappen doen hetzelfde (open + 2 af, geen 120% positie)', inv.ok && inv.n === 3, JSON.stringify(inv));
  }

  console.log('─── FOUT: onzin-tijden ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', date: '2026-09-20', time: '08:00', entry: '2400', size: '1000' });
    await tps([{ price: '2420', pct: 50, hit: true, t: 'straks' }, { price: '2450', pct: 50, hit: true, t: '25:99' }]);
    ok('geen geldige tijd → sluittijd blijft leeg, P&L wel berekend', await g('f_closeTime') === '' && bij(+await g('f_pnl'), 14.58, 0.005), JSON.stringify({ c: await g('f_closeTime'), p: await g('f_pnl') }));
    await p.evaluate(() => { formTPs[1].tsTime = '9:5'; calcTrade(true); });
    ok('"9:5" is geen tijd → nog steeds leeg', await g('f_closeTime') === '', JSON.stringify(await g('f_closeTime')));
    await p.evaluate(() => { formTPs[1].tsTime = '9:05'; calcTrade(true); });
    ok('"9:05" wel → 09:05', await g('f_closeTime') === '09:05', JSON.stringify(await g('f_closeTime')));
    await bewaar();
    const tijden = await p.evaluate(() => T[0].tps.map(x => x.ts ? ts2time(+x.ts) : '').join(','));
    ok('opgeslagen zonder fout; de onzin-tijd is weg, 09:05 bewaard', tijden === ',09:05', JSON.stringify(tijden));
  }

  console.log('─── FOUT: lege entry met een gehaalde TP ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', size: '1000' });
    await tps([{ price: '2420', pct: 100, hit: true }]);
    ok('geen P&L zonder entry, geen fout', await g('f_pnl') === '' && errs.length === 0, JSON.stringify(await g('f_pnl')));
    await p.evaluate(() => submitForm(null));
    const fe = await p.evaluate(() => document.getElementById('formErr').textContent);
    ok('opslaan geweigerd: "vul minimaal een entry of P&L in"', /entry of P&L/.test(fe) && await p.evaluate(() => T.length) === 0, fe);
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── FOUT: hit aan en weer uit zet de status terug ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', entry: '2400', size: '1000', status: 'open' });
    await tps([{ price: '2420', pct: 50, hit: true }, { price: '2450', pct: 50 }]);
    ok('hit: status partial', await g('f_status') === 'partial', JSON.stringify(await g('f_status')));
    await p.evaluate(() => toggleTPHit(0));
    ok('hit terug: status weer open (zoals hij stond), P&L leeg', await g('f_status') === 'open' && await g('f_pnl') === '', JSON.stringify({ s: await g('f_status'), p: await g('f_pnl') }));
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── FOUT: handmatig account dat niet meer bestaat ───');
  {
    await reset();
    await nieuw({ pair: 'ETH/USDC', entry: '2400', exit: '2410', size: '1000' });
    let t = await bewaar();
    await p.evaluate(() => { MANUAL = []; persistManual(); });
    await p.evaluate(id => openForm(id), t.id); await p.waitForTimeout(80);
    ok('het formulier houdt de trade op zijn (verwijderde) account', await g('f_exchange') === 'm1', JSON.stringify(await g('f_exchange')));
    t = await p.evaluate(id => { submitForm(id); return T.find(x => x.id === id); }, t.id);
    ok('opslaan verhuist hem niet stilletjes naar OKX', t.exchange === 'm1', JSON.stringify(t.exchange));
  }

  console.log('─── FOUT: gesynct kan niet, CSV-trade op gekoppelde exchange wel, zonder gezeur ───');
  {
    await reset();
    await p.evaluate(() => { T = [{ id: 1, srcId: 'okx_csv_1', exchange: 'okx', status: 'closed', pair: 'BTC/USDC', dir: 'long', entry: 100, exit: 110, size: '1000', pnl: 100, r: 0, fees: 0, date: '2026-09-20', time: '08:00', openTime: String(+new Date('2026-09-20T08:00')), closeTime: '', tps: [], tags: [], notes: '' }]; persist(); });
    dialogs = [];
    await p.evaluate(() => { openForm(1); }); await p.waitForTimeout(80);
    const w = await p.evaluate(() => { const b = document.getElementById('exWarn'); return b && !b.hidden ? b.innerText : ''; });
    ok('waarschuwing zichtbaar (het is een handmatig-achtige trade op OKX)', /gekoppeld/.test(w), w);
    await p.evaluate(() => submitForm(1));
    ok('bewerken van een bestaande trade vraagt geen bevestiging', dialogs.length === 0, JSON.stringify(dialogs));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Handmatig — scenario's: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
