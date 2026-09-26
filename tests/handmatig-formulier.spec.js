// Denny 24-09-2026, handmatige trades in het formulier:
//  1. is er een handmatig account, dan is dat de standaardkeuze
//  2. is er géén handmatig account, dan een waarschuwing om er eerst een te maken
//  3. een handmatige trade op een gekoppelde exchange: waarschuwing én bevestiging bij opslaan
//  4. TP "hit" rekent alles uit: P&L, R, exit (alle TP's gehaald), status en sluittijd
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = []; let dialogs = [], antwoord = true;
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => { dialogs.push(d.message()); antwoord ? d.accept() : d.dismiss(); });
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);

  const reset = (conns, manual) => p.evaluate(([c, m]) => { T = []; TRASH = []; persist(); CONNS = c; persistConns(); MANUAL = m; persistManual(); STATE.page = 'trades'; render(); }, [conns, manual]);
  const g = id => p.evaluate(id => { const el = document.getElementById(id); return el ? el.value : null; }, id);
  const warn = () => p.evaluate(() => { const b = document.getElementById('exWarn'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const set = (id, v) => p.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, [id, v]);

  console.log('─── 1. handmatig account is de standaardkeuze ───');
  {
    await reset({ okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0 } }, [{ id: 'm1', name: 'Eigen boek', transactions: [] }]);
    await p.evaluate(() => openForm(null));
    ok('nieuwe trade opent op "Eigen boek (handmatig)"', await g('f_exchange') === 'm1', JSON.stringify(await g('f_exchange')));
    const opties = await p.evaluate(() => [...document.querySelectorAll('#f_exchange option')].map(o => o.value));
    ok('en het handmatige account staat bovenaan de lijst', opties[0] === 'm1' && opties.includes('okx'), JSON.stringify(opties));
    ok('geen waarschuwing bij het handmatige account', await warn() === '', await warn());
    await p.evaluate(() => closeForm());
  }

  console.log('─── 2. zonder handmatig account: waarschuwing ───');
  {
    await reset({}, []);
    await p.evaluate(() => openForm(null));
    const w = await warn();
    ok('waarschuwing: nog geen handmatig account, met knop', /nog geen handmatig account/i.test(w) && /Account toevoegen/.test(w), w);
    await p.evaluate(() => naarHandmatigAccount());
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ page: STATE.page, tab: STATE.setTab, focus: document.activeElement && document.activeElement.id, open: document.getElementById('modal').classList.contains('on') }));
    ok('de knop brengt je naar Instellingen → Accounts, cursor in het naamveld', r.page === 'instellingen' && r.tab === 'accounts' && r.focus === 'ma_name' && !r.open, JSON.stringify(r));
  }

  console.log('─── 3. handmatige trade op een gekoppelde exchange ───');
  {
    await reset({ okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0 } }, [{ id: 'm1', name: 'Eigen boek', transactions: [] }]);
    await p.evaluate(() => openForm(null));
    await set('f_exchange', 'okx');
    const w = await warn();
    ok('OKX kiezen: waarschuwing dat het gekoppeld is', /OKX/.test(w) && /gekoppeld/.test(w) && /handmatige account/.test(w), w);
    await set('f_exchange', 'm1');
    ok('terug naar het handmatige account: waarschuwing weg', await warn() === '', await warn());
    await set('f_exchange', 'okx'); await set('f_pair', 'BTC/USDC'); await set('f_entry', '100'); await set('f_exit', '110'); await set('f_size', '1000');
    dialogs = []; antwoord = false;
    await p.evaluate(() => submitForm(null));
    ok('opslaan vraagt bevestiging; "annuleren" slaat niets op', dialogs.length === 1 && /OKX/.test(dialogs[0]) && /Toch opslaan/.test(dialogs[0]) && await p.evaluate(() => T.length) === 0, JSON.stringify(dialogs));
    dialogs = []; antwoord = true;
    await p.evaluate(() => submitForm(null));
    ok('bevestigen slaat wel op', dialogs.length === 1 && await p.evaluate(() => T.length === 1 && T[0].exchange === 'okx'), JSON.stringify(dialogs));
    // bewerken van diezelfde trade: geen gezeur meer
    dialogs = [];
    await p.evaluate(() => { openForm(T[0].id); submitForm(T[0].id); });
    ok('een bestaande trade bewerken vraagt niet opnieuw', dialogs.length === 0, JSON.stringify(dialogs));
    // op het handmatige account: geen bevestiging
    dialogs = [];
    await p.evaluate(() => openForm(null)); await set('f_pair', 'ETH/USDC'); await set('f_entry', '100'); await set('f_exit', '101'); await set('f_size', '100');
    await p.evaluate(() => submitForm(null));
    ok('op het handmatige account gewoon opslaan, zonder vraag', dialogs.length === 0 && await p.evaluate(() => T.length) === 2, JSON.stringify(dialogs));
    // een oefentrade (backtest/paper/gemist) zit nergens aan vast: geen waarschuwing, geen vraag
    dialogs = [];
    await p.evaluate(() => openForm(null)); await set('f_exchange', 'okx');
    ok('live op OKX: waarschuwing staat er', /gekoppeld/.test(await warn()), await warn());
    const oefen = await p.evaluate(() => Object.keys(KINDS).find(k => k !== 'live'));
    await set('f_kind', oefen);
    ok('soort op oefentrade (' + oefen + '): waarschuwing weg', await warn() === '', await warn());
    await set('f_pair', 'SOL/USDC'); await set('f_entry', '100'); await set('f_exit', '105'); await set('f_size', '100');
    await p.evaluate(() => submitForm(null));
    ok('opslaan van een oefentrade op een gekoppelde exchange vraagt niets', dialogs.length === 0 && await p.evaluate(() => T.length) === 3, JSON.stringify(dialogs));
    await p.evaluate(() => openForm(null)); await set('f_exchange', 'okx'); await set('f_kind', oefen); await set('f_kind', 'live');
    ok('terug naar live: waarschuwing komt terug', /gekoppeld/.test(await warn()), await warn());
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── 4. TP hit rekent alles uit ───');
  {
    await reset({}, [{ id: 'm1', name: 'Eigen boek', transactions: [] }]);
    // long 2400, size $ 1000, TP1 2420 50%, TP2 2450 50%
    await p.evaluate(() => { openForm(null); }); await p.waitForTimeout(100);   // openForm zet na 40 ms de cursor in Pair
    await set('f_pair', 'ETH/USDC'); await set('f_date', '2026-09-15'); await set('f_time', '09:30'); await set('f_entry', '2400'); await set('f_stop', '2380'); await set('f_size', '1000'); await set('f_status', 'open');
    await p.evaluate(() => { addTP(); addTP(); formTPs[0].price = '2420'; formTPs[1].price = '2450'; renderTPs(); calcTrade(true); });
    ok('zonder hits: geen P&L (exit is leeg)', await g('f_pnl') === '', JSON.stringify(await g('f_pnl')));
    await p.evaluate(() => toggleTPHit(0));
    const prev1 = await p.evaluate(() => document.getElementById('calcPrev').innerText.replace(/\s+/g, ' '));
    ok('TP1 hit: P&L van het gehaalde deel: (20/2400)·1000·50% = 4,17', bij(+await g('f_pnl'), 4.17, 0.005), JSON.stringify(await g('f_pnl')));
    ok('status open → partial, restant benoemd in de preview', await g('f_status') === 'partial' && /50%/.test(prev1) && /restant 50% loopt nog/.test(prev1), prev1);
    ok('exit blijft leeg zolang het restant loopt', await g('f_exit') === '', JSON.stringify(await g('f_exit')));
    ok('cursor staat in het tijdveld van TP1', await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('tptime')));
    await p.evaluate(() => { formTPs[0].tsTime = '10:15'; });
    await p.evaluate(() => toggleTPHit(1));
    await p.evaluate(() => { formTPs[1].tsTime = '11:30'; calcTrade(true); });
    ok('TP2 ook hit: exit = gewogen 2435', await g('f_exit') === '2435', JSON.stringify(await g('f_exit')));
    ok('P&L = (35/2400)·1000 = 14,58', bij(+await g('f_pnl'), 14.58, 0.005), JSON.stringify(await g('f_pnl')));
    ok('R = 14,58 / (20/2400·1000) = 1,75', bij(+await g('f_r'), 1.75, 0.01), JSON.stringify(await g('f_r')));
    ok('status → gesloten, sluittijd = laatste TP (11:30) op dezelfde dag', await g('f_status') === 'closed' && await g('f_closeTime') === '11:30' && await g('f_closeDate') === '2026-09-15', JSON.stringify({ s: await g('f_status'), t: await g('f_closeTime'), d: await g('f_closeDate') }));
    ok('tijd in trade: 120 min', await g('f_durationMin') === '120', JSON.stringify(await g('f_durationMin')));
    // fees gaan eraf
    await set('f_fees', '1');
    ok('fees eraf: 13,58', bij(+await g('f_pnl'), 13.58, 0.005), JSON.stringify(await g('f_pnl')));
    await p.evaluate(() => submitForm(null));
    const t = await p.evaluate(() => { const t = T[0]; return { pnl: t.pnl, exit: t.exit, status: t.status, tps: t.tps.map(x => [x.price, x.pct, x.hit, ts2time(+x.ts)]), stappen: stappenVan(t).map(x => x.kind + ':' + x.qty) }; });
    ok('opgeslagen: P&L 13,58, exit 2435, gesloten, TP-tijden bewaard', bij(t.pnl, 13.58, 0.005) && t.exit === 2435 && t.status === 'closed' && JSON.stringify(t.tps) === JSON.stringify([[2420, 50, true, '10:15'], [2450, 50, true, '11:30']]), JSON.stringify(t));
    ok('en de stappentabel leidt open + 2 afbouwstappen af', t.stappen.length === 3 && t.stappen[0].startsWith('open'), JSON.stringify(t.stappen));
  }
  console.log('─── 4b. deels gehaald, rest op je exit ───');
  {
    await p.evaluate(() => { openForm(null); });
    await set('f_pair', 'SOL/USDC'); await set('f_entry', '100'); await set('f_size', '500'); await set('f_dir', 'short');
    await p.evaluate(() => { addTP(); addTP(); formTPs[0].price = '95'; formTPs[1].price = '90'; renderTPs(); toggleTPHit(0); });
    ok('short, TP1 hit (95, 50%): +12,50', bij(+await g('f_pnl'), 12.5, 0.005), JSON.stringify(await g('f_pnl')));
    ok('zonder exit loopt het restant nog: status partial (ook al stond hij op gesloten)', await g('f_status') === 'partial', JSON.stringify(await g('f_status')));
    await set('f_exit', '102');
    const prev = await p.evaluate(() => document.getElementById('calcPrev').innerText.replace(/\s+/g, ' '));
    ok('exit 102 voor het restant: 12,50 − 5,00 = 7,50', bij(+await g('f_pnl'), 7.5, 0.005) && /restant 50% op je exit/.test(prev), JSON.stringify({ pnl: await g('f_pnl'), prev }));
    ok('met het restant op je exit is de trade dicht', await g('f_status') === 'closed', JSON.stringify(await g('f_status')));
    // hit weer uitzetten: terug naar de gewone berekening op exit
    await p.evaluate(() => toggleTPHit(0));
    ok('hit terugzetten: P&L weer puur op exit: −10,00', bij(+await g('f_pnl'), -10, 0.005), JSON.stringify(await g('f_pnl')));
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }
  console.log('─── 4c. sluittijd vóór de open-tijd = volgende dag; eigen sluittijd blijft staan ───');
  {
    await p.evaluate(() => { openForm(null); });
    await set('f_date', '2026-09-15'); await set('f_time', '23:30'); await set('f_entry', '100'); await set('f_size', '100');
    await p.evaluate(() => { addTP(); formTPs[0].price = '101'; formTPs[0].tsTime = '00:45'; renderTPs(); toggleTPHit(0); });
    ok('TP om 00:45 na een instap om 23:30 → sluitdatum 16-09', await g('f_closeDate') === '2026-09-16' && await g('f_closeTime') === '00:45', JSON.stringify({ d: await g('f_closeDate'), t: await g('f_closeTime') }));
    await set('f_closeTime', '01:00');
    await p.evaluate(() => { formTPs[0].tsTime = '00:50'; calcTrade(true); });
    ok('een zelf ingevulde sluittijd wordt niet overschreven', await g('f_closeTime') === '01:00', JSON.stringify(await g('f_closeTime')));
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Handmatig formulier: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
