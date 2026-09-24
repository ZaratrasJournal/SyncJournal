// Denny 24-09-2026: "worden handmatige trades goed meegenomen in de statistieken, bij toevoegen en
// verwijderen, gaan de balansen goed?" Eén rode draad: dashboard, tradelijst-totaal, kalender,
// analytics en de accountbalans moeten hetzelfde zeggen - bij toevoegen, wijzigen, prullenbak,
// terugzetten, definitief weg, stortingen/opnames, oefentrades, open en deels gesloten trades,
// twee accounts naast elkaar, een app-brede filter, en het verwijderen van het account zelf.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const VANDAAG = new Date().toISOString().slice(0, 10);

(async () => {
  const b = await chromium.launch(); const errs = []; let antwoord = true;
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => antwoord ? d.accept() : d.dismiss());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);

  const reset = () => p.evaluate(() => { T = []; TRASH = []; persist(); persistTrash(); CONNS = {}; persistConns(); EXCHANGES.forEach(e => { e.val = 0; }); MANUAL = [{ id: 'm1', name: 'Eigen boek', transactions: [{ id: 1, type: 'deposit', amount: 10000, date: '2026-01-01' }] }, { id: 'm2', name: 'Tweede boek', transactions: [{ id: 2, type: 'deposit', amount: 5000, date: '2026-01-01' }] }]; persistManual(); clearGFilter(); STATE.page = 'trades'; render(); });
  // een handmatige trade via het formulier, zoals een gebruiker dat doet
  const voeg = (v) => p.evaluate((v) => {
    openForm(null); const s = (k, x) => { const el = document.getElementById('f_' + k); if (el) { el.value = x; } };
    s('exchange', v.exchange || 'm1'); s('pair', v.pair || 'BTC/USDC'); s('date', v.date); s('time', v.time || '10:00'); s('dir', v.dir || 'long'); s('status', v.status || 'closed'); s('kind', v.kind || 'live');
    s('entry', v.entry); s('exit', v.exit || ''); s('size', v.size); s('fees', v.fees || ''); s('stop', v.stop || '');
    if (v.tps) { formTPs = v.tps.map(x => ({ price: x.price, pct: x.pct, r: '', hit: !!x.hit, tsTime: x.t || '' })); renderTPs(); }
    calcTrade(true); if (v.pnl != null) document.getElementById('f_pnl').value = v.pnl;
    submitForm(null); return T[0].id;
  }, v);
  // de rode draad: alle plekken die iets over netto/aantal/balans zeggen
  const stand = () => p.evaluate((VANDAAG) => {
    const num = s => +String(s).replace(/[^\d,−-]/g, '').replace('−', '-').replace(',', '.');
    go('dashboard'); const kEl = document.querySelector('.kpis'); const kpis = kEl ? kEl.innerText.replace(/\s+/g, ' ') : '';
    STATE.page = 'trades'; STATE.tradeTab = 'all'; render();
    const foot = document.querySelector('tfoot'); const footTxt = foot ? foot.innerText.replace(/\s+/g, ' ') : '';
    const rijen = document.querySelectorAll('tbody tr.mrow').length;
    go('kalender'); const kal = document.getElementById('main').innerText.replace(/\s+/g, ' ');
    go('analytics'); const an = document.getElementById('main').innerText.replace(/\s+/g, ' ');
    const net = T.filter(t => t.status !== 'open' && (!t.kind || t.kind === 'live')).reduce((s, t) => s + (+t.pnl || 0), 0);
    return { kpis: kpis.slice(0, 160), footTxt: footTxt.slice(0, 80), rijen, kalDag: kal, an: an.slice(0, 120),
      net: +net.toFixed(2), closedN: CLOSED.length, openN: T.filter(t => t.status === 'open').length,
      bal1: manualBalance(MANUAL[0]), bal2: MANUAL[1] ? manualBalance(MANUAL[1]) : null, totaal: totalBalance(), pnl1: acctPnl('m1'), pnl2: acctPnl('m2'), trash: TRASH.length, n: T.length };
  }, VANDAAG);
  const heeft = (txt, re) => re.test(txt);

  console.log('─── Basis: één winst, één verlies ───');
  {
    await reset();
    let s = await stand();
    ok('leeg: balans = inleg (10.000 / 5.000), totaal 15.000, geen trades', s.bal1 === 10000 && s.bal2 === 5000 && s.totaal === 15000 && s.n === 0, JSON.stringify(s));
    const idWin = await voeg({ date: VANDAAG, entry: '100', exit: '110', size: '1000', fees: '5' });   // +95
    s = await stand();
    ok('+95: dashboard, lijst-totaal en balans 10.095', heeft(s.kpis, /95/) && heeft(s.footTxt, /95/) && s.bal1 === 10095 && s.totaal === 15095 && s.rijen === 1, JSON.stringify(s));
    ok('kalender toont de dag met +95', heeft(s.kalDag, /95/), s.kalDag.slice(0, 100));
    const idLoss = await voeg({ date: VANDAAG, entry: '100', exit: '90', size: '1000', fees: '5', pair: 'ETH/USDC' });   // −105
    s = await stand();
    ok('−105 erbij: netto −10, 2 trades, win-rate 50%, balans 9.990', s.net === -10 && s.closedN === 2 && heeft(s.kpis, /50%/) && s.bal1 === 9990 && s.totaal === 14990, JSON.stringify(s));

    console.log('─── Wijzigen: de exit van het verlies aanpassen ───');
    await p.evaluate((id) => { openForm(id); document.getElementById('f_exit').value = '100'; calcTrade(true); submitForm(id); }, idLoss);   // −5
    s = await stand();
    ok('exit 90→100: netto 90, balans 10.090, nog steeds 2 trades', s.net === 90 && s.bal1 === 10090 && s.n === 2, JSON.stringify(s));

    console.log('─── Prullenbak: weg, terug, definitief ───');
    await p.evaluate((id) => delTrade(id), idLoss);
    s = await stand();
    ok('verwijderen: 1 trade, netto 95, balans 10.095, 1 in de prullenbak', s.n === 1 && s.net === 95 && s.bal1 === 10095 && s.trash === 1, JSON.stringify(s));
    await p.evaluate((id) => trashRestoreOne(id), idLoss);
    s = await stand();
    ok('terugzetten: exact terug (netto 90, balans 10.090, prullenbak leeg)', s.n === 2 && s.net === 90 && s.bal1 === 10090 && s.trash === 0, JSON.stringify(s));
    await p.evaluate((id) => { trashDelete([id]); TRASH = TRASH.filter(t => t.id !== id); persistTrash(); }, idLoss);   // definitief
    s = await stand();
    ok('definitief weg: netto 95, balans 10.095, prullenbak leeg', s.n === 1 && s.net === 95 && s.bal1 === 10095 && s.trash === 0, JSON.stringify(s));
    await p.evaluate((id) => delTrade(id), idWin);
    s = await stand();
    ok('laatste trade weg: alles op nul, balans weer de inleg', s.n === 0 && s.net === 0 && s.bal1 === 10000 && s.totaal === 15000, JSON.stringify(s));
  }

  console.log('─── Open, deels gesloten en oefentrades ───');
  {
    await reset();
    await voeg({ date: VANDAAG, status: 'open', entry: '100', size: '1000' });
    let s = await stand();
    ok('open trade: telt niet in netto of balans, wel als open', s.net === 0 && s.bal1 === 10000 && s.openN === 1 && s.closedN === 0, JSON.stringify(s));
    // deels gesloten via TP1: gerealiseerd 4,17, rest loopt
    await voeg({ date: VANDAAG, pair: 'ETH/USDC', entry: '2400', size: '1000', tps: [{ price: '2420', pct: 50, hit: true, t: '11:00' }, { price: '2450', pct: 50 }] });
    s = await stand();
    ok('deels gesloten (partial, +4,17 geboekt): telt in netto én balans', bij(s.net, 4.17, 0.005) && bij(s.bal1, 10004.17, 0.005) && s.closedN === 1, JSON.stringify({ net: s.net, bal: s.bal1, closedN: s.closedN }));
    // oefentrades horen niet in je echte cijfers
    await voeg({ date: VANDAAG, pair: 'SOL/USDC', kind: 'paper', entry: '100', exit: '150', size: '1000' });   // +500 paper
    await voeg({ date: VANDAAG, pair: 'SOL/USDC', kind: 'backtest', entry: '100', exit: '200', size: '1000' });   // +1000 backtest
    s = await stand();
    ok('paper/backtest: niet in netto, niet in balans, niet in het gesloten-aantal', bij(s.net, 4.17, 0.005) && bij(s.bal1, 10004.17, 0.005) && s.closedN === 1, JSON.stringify({ net: s.net, bal: s.bal1, closedN: s.closedN, kpis: s.kpis }));
    const oefen = await p.evaluate(() => { FILTER.kind = 'oefen'; render(); const r = { n: CLOSED.length, net: CLOSED.reduce((s, t) => s + t.pnl, 0), bal: manualBalance(MANUAL[0]) }; FILTER.kind = 'live'; render(); return r; });
    ok('filter "oefen": 2 oefentrades, netto 1.500, maar de balans blijft de echte', oefen.n === 2 && oefen.net === 1500 && bij(oefen.bal, 10004.17, 0.005), JSON.stringify(oefen));
  }

  console.log('─── Stortingen en opnames op het account ───');
  {
    await reset();
    await voeg({ date: VANDAAG, entry: '100', exit: '110', size: '1000' });   // +100
    await p.evaluate(() => { MANUAL[0].transactions.push({ id: 9, type: 'withdrawal', amount: 3000, date: '2026-06-01' }); persistManual(); render(); });
    let s = await stand();
    ok('opname 3.000: balans 7.100 (inleg 7.000 + 100 P&L)', s.bal1 === 7100 && s.totaal === 12100, JSON.stringify({ bal: s.bal1, tot: s.totaal }));
    await p.evaluate(() => { MANUAL[0].transactions.push({ id: 10, type: 'deposit', amount: 500, date: '2026-07-01' }); persistManual(); render(); });
    s = await stand();
    ok('storting 500: balans 7.600, statistieken onveranderd (netto 100)', s.bal1 === 7600 && s.net === 100, JSON.stringify({ bal: s.bal1, net: s.net }));
    await p.evaluate(() => { MANUAL[0].transactions.push({ id: 11, type: 'withdrawal', amount: 20000, date: '2026-08-01' }); persistManual(); render(); });
    s = await stand();
    ok('opname groter dan de inleg: kapitaal niet onder 0, balans = 0 + P&L = 100', s.bal1 === 100, JSON.stringify(s.bal1));
  }

  console.log('─── Twee accounts naast elkaar ───');
  {
    await reset();
    await voeg({ date: VANDAAG, exchange: 'm1', entry: '100', exit: '110', size: '1000' });   // +100 op m1
    await voeg({ date: VANDAAG, exchange: 'm2', entry: '100', exit: '95', size: '1000', pair: 'ETH/USDC' });   // −50 op m2
    let s = await stand();
    ok('per account: m1 +100 → 10.100, m2 −50 → 4.950, totaal 15.050, netto 50', s.pnl1 === 100 && s.pnl2 === -50 && s.bal1 === 10100 && s.bal2 === 4950 && s.totaal === 15050 && s.net === 50, JSON.stringify(s));
    // trade van account wisselen
    await p.evaluate(() => { const t = T.find(x => x.pair === 'ETH/USDC'); openForm(t.id); document.getElementById('f_exchange').value = 'm1'; submitForm(t.id); });
    s = await stand();
    ok('trade verhuist m2 → m1: m1 +50 → 10.050, m2 terug op 5.000, totaal gelijk', s.pnl1 === 50 && s.pnl2 === 0 && s.bal1 === 10050 && s.bal2 === 5000 && s.totaal === 15050, JSON.stringify(s));
    // app-brede filter: statistieken volgen, balans niet (A1)
    const f = await p.evaluate(() => { setFilter('pair', 'BTC/USDC'); const r = { closedN: CLOSED.length, net: CLOSED.reduce((s, t) => s + t.pnl, 0), bal: manualBalance(MANUAL[0]), tot: totalBalance() }; clearGFilter(); return r; });
    ok('filter op BTC/USDC: 1 trade, netto 100 — balans blijft 10.050', f.closedN === 1 && f.net === 100 && f.bal === 10050 && f.tot === 15050, JSON.stringify(f));
  }

  console.log('─── Handmatige trade op een API-exchange ───');
  {
    await reset();
    await p.evaluate(() => { CONNS = { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0 } }; persistConns(); EXMAP.okx.val = 2000; persistExMeta(); render(); });
    await voeg({ date: VANDAAG, exchange: 'okx', entry: '100', exit: '110', size: '1000' });   // +100 (na bevestiging)
    const s = await stand();
    ok('telt in de statistieken (netto 100) en in de OKX-P&L, maar het OKX-saldo komt van de exchange (blijft 2.000)', s.net === 100 && await p.evaluate(() => acctPnl('okx')) === 100 && await p.evaluate(() => EXMAP.okx.val) === 2000 && s.totaal === 17000, JSON.stringify({ net: s.net, tot: s.totaal }));
  }

  console.log('─── Het account zelf verwijderen ───');
  {
    await reset();
    const id = await voeg({ date: VANDAAG, exchange: 'm2', entry: '100', exit: '110', size: '1000' });
    // keuze "trades meenemen naar de prullenbak"
    await p.evaluate(() => { window.acctTradeChoice = () => true; });
    antwoord = true; await p.evaluate(() => removeManual('m2'));
    let s = await stand();
    ok('account weg mét trades: 1 account over, trade in de prullenbak, totaal 10.000', s.n === 0 && s.trash === 1 && await p.evaluate(() => MANUAL.length) === 1 && s.totaal === 10000, JSON.stringify(s));
    await p.evaluate((id) => trashRestoreOne(id), id);
    s = await stand();
    ok('teruggezet uit de prullenbak: telt weer in netto, balans van het weggehaalde account is er niet meer', s.net === 100 && s.totaal === 10000 && s.n === 1, JSON.stringify({ net: s.net, tot: s.totaal }));
    const r = await p.evaluate((id) => { openForm(id); const v = document.getElementById('f_exchange').value; const txt = document.getElementById('f_exchange').selectedOptions[0].textContent; formDirty = false; closeForm(); return { v, txt }; }, id);
    ok('het formulier houdt hem op het (verwijderde) account', r.v === 'm2' && /verwijderd/.test(r.txt), JSON.stringify(r));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Handmatig — statistieken & balans: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
