// Funded modus (F11), stap 4: funded in de CSV-pop-up en in het trade-formulier, en de melding voor bestaande
// FTMO-trades zonder account. Alleen verzonnen CSV's.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const FTMO = ['Ticket,Open,Type,Volume,Symbol,Price,SL,TP,Close,Price,Swap,Commissions,Profit,Pips,Trade duration in seconds',
  '1001,2026-09-03 10:00:00,buy,1,EURUSD,1.1000,1.0950,1.1100,2026-09-03 12:00:00,1.1050,0,-5,500,50,7200',
  '1002,2026-09-04 10:00:00,sell,1,US30,42000,42100,41800,2026-09-04 12:00:00,41900,0,-5,1000,100,7200'].join('\n');
const ALG = 'date,symbol,side,entry,exit,pnl\n2026-09-10,BTCUSDT,long,60000,61000,1000\n2026-09-11,ETHUSDT,short,2500,2450,500';
const ITEMS = [
  { id: 'fdA', kind: 'challenge', firm: 'Breakout', name: '25k #1', size: 25000, status: 'bezig', stop: null, logins: [], start: '2026-10-01' },
  { id: 'fdB', kind: 'challenge', firm: 'FTMO', name: '100k #1', size: 100000, status: 'niet', stop: null, logins: [], start: '2026-08-01' },
  { id: 'fdC', kind: 'funded', firm: 'FTMO', name: '100k #2', size: 100000, status: 'actief', stop: null, logins: [], start: '2026-09-29', payouts: [] },
];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const reset = (o) => p.evaluate((o) => { closeForm(); T = (o.trades || []); TRASH = []; MANUAL = o.manual || []; CONNS = {}; FUNDED = JSON.parse(JSON.stringify(o.items || []));
    STATE.funded = !!o.fm; STATE.fundedMee = false; EXMAP.blofin.val = 1000; persistExMeta(); persistManual(); persistConns(); persistFunded(); persist(); try { DB.save('funded_wees', null); } catch (e) {} render(); }, o || {});
  const open = (t) => p.evaluate((t) => csvKeuze(t, 'x.csv'), t);
  const modal = () => p.evaluate(() => { const m = document.getElementById('modal');
    return { tekst: m.innerText.replace(/\s+/g, ' '), keuze: (m.querySelector('input[name="csvk"]:checked') || {}).value || '', opties: [...m.querySelectorAll('input[name="csvk"]')].map(i => i.value),
      groepen: [...m.querySelectorAll('.csvk-g')].map(g => g.textContent), go: !!m.querySelector('#csvkGo') && !m.querySelector('#csvkGo').disabled }; });
  const importeer = () => p.evaluate(async () => { csvKImport(); await new Promise(r => setTimeout(r, 400)); });

  console.log('─── Zonder funded modus geen funded-keuze ───');
  await reset({ items: ITEMS, fm: false }); await open(ALG); let m = await modal();
  ok('modus uit: geen challenges, funded accounts of "+ Challenge toevoegen" in de lijst', !m.opties.some(o => /^fd/.test(o) || /^nieuw-/.test(o)) && !/Challenge toevoegen|100k #2/.test(m.tekst) && m.opties.includes('nieuw'), JSON.stringify(m.opties));

  console.log('─── Met funded modus ───');
  await reset({ items: ITEMS, fm: true }); await open(ALG); m = await modal();
  const fd = m.opties.filter(o => /^fd/.test(o));
  ok('lopende en actieve bovenaan, afgeronde eronder', fd.join() === 'fdA,fdC,fdB', fd.join());
  ok('"+ Challenge toevoegen" en "+ Funded account toevoegen" erbij', m.opties.includes('nieuw-challenge') && m.opties.includes('nieuw-funded') && /\+ Challenge toevoegen/.test(m.tekst) && /\+ Funded account toevoegen/.test(m.tekst));
  await p.click('#modal input[value="fdA"]'); m = await modal();
  ok('een challenge kiezen: geen waarschuwing, Importeren aan', !/Dit is een/.test(m.tekst) && m.go);
  await importeer();
  const opA = await p.evaluate(() => ({ n: T.filter(t => t.exchange === 'fdA').length, bal: totalBalance(), pnl: acctPnl('fdA') }));
  ok('CSV op de challenge: 2 trades daar, eigen balans blijft 1000', opA.n === 2 && Math.abs(opA.bal - 1000) < 0.01 && opA.pnl === 1500, JSON.stringify(opA));

  console.log('─── "+ Challenge toevoegen" vanuit de pop-up ───');
  await reset({ items: [], fm: true }); await open(ALG); await p.click('#modal input[value="nieuw-challenge"]');
  ok('formulier: Importeren uit tot firm, naam en grootte er staan', !(await modal()).go);
  await p.fill('#csvkFirm', 'Breakout'); await p.fill('#csvkNaam', '50k #1'); await p.fill('#csvkGrootte', '50.000');
  ok('… ingevuld: aan', (await modal()).go);
  await importeer();
  ok('challenge aangemaakt (bezig, 50.000) en de trades staan erop', await p.evaluate(() => FUNDED.length === 1 && FUNDED[0].kind === 'challenge' && FUNDED[0].status === 'bezig' && FUNDED[0].size === 50000 && T.length === 2 && T.every(t => t.exchange === FUNDED[0].id)));
  await reset({ items: [], fm: true }); await open(ALG); await p.click('#modal input[value="nieuw-funded"]');
  await p.fill('#csvkFirm', 'FTMO'); await p.fill('#csvkNaam', '200k'); await p.fill('#csvkGrootte', '200000'); await importeer();
  ok('"+ Funded account toevoegen": funded account (actief) met de trades', await p.evaluate(() => FUNDED.length === 1 && FUNDED[0].kind === 'funded' && FUNDED[0].status === 'actief' && Array.isArray(FUNDED[0].payouts) && T.every(t => t.exchange === FUNDED[0].id)));

  console.log('─── FTMO MetriX ───');
  await reset({ items: ITEMS, fm: true }); await open(FTMO);
  ok('FTMO-bestand met een actief FTMO funded account: dat account voorgesteld', (await modal()).keuze === 'fdC', (await modal()).keuze);
  await reset({ items: [ITEMS[1]], fm: true, manual: [{ id: 'mFT', name: 'FTMO oud', transactions: [] }] }); await open(FTMO);
  ok('alleen een afgeronde FTMO-challenge: toch die voorgesteld (bestaand)', (await modal()).keuze === 'fdB', (await modal()).keuze);
  await reset({ items: [ITEMS[0]], fm: true }); await open(FTMO);
  m = await modal();
  ok('geen FTMO-item: "+ Challenge toevoegen" met firm FTMO voorgevuld', m.keuze === 'nieuw-challenge' && await p.evaluate(() => document.getElementById('csvkFirm').value === 'FTMO'), m.keuze);
  await reset({ items: [], fm: false }); await open(FTMO);
  ok('modus uit: FTMO-bestand stelt "+ Nieuw account" voor (handmatig)', (await modal()).keuze === 'nieuw');

  console.log('─── Trade-formulier ───');
  const formOpties = () => p.evaluate(async () => { openForm(null); await new Promise(r => setTimeout(r, 200)); const s = document.getElementById('f_exchange');
    const r = { groepen: [...s.querySelectorAll('optgroup')].map(g => g.label + ':' + [...g.children].map(o => o.value).join('|')), alle: [...s.options].map(o => o.value) }; formDirty = false; closeForm(); return r; });
  await reset({ items: ITEMS, fm: false, trades: [] });
  let f = await formOpties();
  ok('modus uit: geen funded-items bij "Exchange"', !f.alle.some(v => /^fd/.test(v)), JSON.stringify(f));
  await reset({ items: ITEMS, fm: true, trades: [] });
  f = await formOpties();
  ok('modus aan: lopende/actieve bovenaan, afgeronde eronder', f.groepen.some(g => g === 'Challenges en funded accounts:fdA|fdC') && f.groepen.some(g => g === 'Afgerond:fdB'), JSON.stringify(f.groepen));
  const opgeslagen = await p.evaluate(async () => { openForm(null); await new Promise(r => setTimeout(r, 200));
    const z = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
    z('f_exchange', 'fdA'); z('f_pair', 'BTC/USDT'); z('f_entry', '60000'); z('f_exit', '61000'); z('f_pnl', '250'); z('f_date', '2026-10-20');
    try { submitForm(null); } catch (e) { return 'fout: ' + e.message; } await new Promise(r => setTimeout(r, 200));
    const t = T.find(x => x.exchange === 'fdA'); return t ? { ex: t.exchange, pnl: t.pnl, bal: totalBalance() } : 'geen trade';
  });
  ok('een handmatige trade op een challenge: opgeslagen op het item, eigen balans blijft 1000', opgeslagen && opgeslagen.ex === 'fdA' && Math.abs(opgeslagen.bal - 1000) < 0.01, JSON.stringify(opgeslagen));

  console.log('─── Bestaande FTMO-trades zonder account ───');
  const base = { time: '10:00', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', entry: 1, exit: 1.1, stop: 0.95, size: '1000', pair: 'EURUSD', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
  const wees = [{ ...base, id: 1, date: '2026-08-01', exchange: 'ftmo', pnl: 300 }, { ...base, id: 2, date: '2026-08-02', exchange: 'ftmo', pnl: -100 }, { ...base, id: 3, date: '2026-08-03', exchange: 'blofin', pnl: 50 }, { ...base, id: 4, date: '2026-08-04', exchange: '', kind: 'backtest', pnl: 10 }];
  await reset({ items: [], fm: false, trades: wees }); await p.evaluate(() => { STATE.setTab = 'funded'; go('instellingen'); });
  await p.click('#swFunded'); await p.waitForTimeout(250); m = await modal();
  ok('modus aanzetten met FTMO-trades zonder account: één melding met twee keuzes', /2 trades/.test(m.tekst) && /Zet ze in een nieuwe challenge/.test(m.tekst) && /Laat ze als eigen geld staan/.test(m.tekst), m.tekst.slice(0, 260));
  ok('… er is nog niets verplaatst', await p.evaluate(() => T.filter(t => t.exchange === 'ftmo').length === 2));
  await p.click('#modal button:text-is("Laat ze als eigen geld staan")');
  ok('"Laat staan": niets verplaatst, modus aan, niet opnieuw gevraagd', await p.evaluate(async () => { const n = T.filter(t => t.exchange === 'ftmo').length; setFundedModus(false); setFundedModus(true); await new Promise(r => setTimeout(r, 150)); return n === 2 && STATE.funded && !document.getElementById('modal').classList.contains('on'); }));
  await reset({ items: [], fm: false, trades: wees }); await p.evaluate(() => { STATE.setTab = 'funded'; go('instellingen'); });
  await p.click('#swFunded'); await p.waitForTimeout(250);
  ok('"Zet ze in een nieuwe challenge": uit totdat de grootte is ingevuld', await p.evaluate(() => document.getElementById('weesGo').disabled));
  await p.fill('#weesGrootte', '100000'); await p.click('#weesGo'); await p.waitForTimeout(200);
  ok('… daarna: nieuwe FTMO-challenge met precies de 2 FTMO-trades; Blofin en backtest ongemoeid', await p.evaluate(() => FUNDED.length === 1 && FUNDED[0].firm === 'FTMO' && FUNDED[0].size === 100000 && T.filter(t => t.exchange === FUNDED[0].id).length === 2 && T.find(t => t.id === 3).exchange === 'blofin' && T.find(t => t.id === 4).exchange === ''));
  await reset({ items: [], fm: false, trades: wees.filter(t => t.exchange !== 'ftmo') }); await p.evaluate(() => { STATE.setTab = 'funded'; go('instellingen'); });
  await p.click('#swFunded'); await p.waitForTimeout(200);
  ok('zonder zulke trades: geen melding', await p.evaluate(() => !document.getElementById('modal').classList.contains('on') && STATE.funded));

  ok('geen JS-fouten', !errs.length, errs.join(' | '));
  await b.close();
  console.log(`\n=== Funded-import: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
