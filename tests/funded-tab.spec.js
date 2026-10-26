// Funded modus (F11), stap 2: Instellingen → Funded. Alle toestanden uit demo v4 (modus uit, leeg, lopend, gehaald
// vóór/ná omzetten, niet gehaald, funded met uitbetaling, gestopt), in licht en donker en op 390px breed.
// Plus: statusmenu, één kaart tegelijk open, formulier uitgeschakeld tot het klopt, en een export → import-rondje.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const SHOTS = path.resolve('tests/screenshots/funded'); fs.mkdirSync(SHOTS, { recursive: true });

// Twee FTMO-challenges (één gehaald en omgezet, één niet gehaald), één lopende Breakout-challenge, eigen trades op Blofin.
const ITEMS = [
  { id: 'fdc1', kind: 'challenge', firm: 'FTMO', name: '100k #1', size: 100000, status: 'niet', stop: null, logins: [], start: '2026-08-03' },
  { id: 'fdc2', kind: 'challenge', firm: 'FTMO', name: '100k #2', size: 100000, status: 'gehaald', stop: null, logins: [], start: '2026-08-24', funded: 'fdf1' },
  { id: 'fdf1', kind: 'funded', firm: 'FTMO', name: '100k #2', size: 100000, status: 'actief', stop: null, logins: [], start: '2026-09-29', from: 'fdc2', payouts: [{ amount: 2480, date: '2026-10-13' }] },
  { id: 'fdc3', kind: 'challenge', firm: 'Breakout', name: '25k #1', size: 25000, status: 'bezig', stop: null, logins: [], start: '2026-10-01' },
];
const TR = [['2026-09-01', 'blofin', 80], ['2026-09-05', 'blofin', -30], ['2026-08-05', 'fdc1', -4000], ['2026-08-10', 'fdc1', -6400],
  ['2026-08-26', 'fdc2', 6000], ['2026-09-10', 'fdc2', 9600], ['2026-10-02', 'fdf1', 2500], ['2026-10-09', 'fdf1', 1500], ['2026-10-07', 'fdc3', 475]];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const zet = (o) => p.evaluate(({ items, tr, o }) => {
    const base = { time: '10:00', dir: 'long', setup: 'London SFP', session: 'London', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', pair: 'EURUSD', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    FUNDED = JSON.parse(JSON.stringify(o.leeg ? [] : items));
    T = tr.filter(r => !o.leeg || r[1] === 'blofin').map((r, i) => ({ ...base, id: i + 1, date: r[0], exchange: r[1], pnl: r[2] }));
    if (o.voor) { FUNDED = FUNDED.filter(f => f.id !== 'fdf1'); delete FUNDED.find(f => f.id === 'fdc2').funded; T = T.filter(t => t.exchange !== 'fdf1'); }
    if (o.gestopt) { const f = FUNDED.find(x => x.id === 'fdf1'); f.status = 'gestopt'; f.stop = 'eruit'; }
    EXMAP.blofin.val = 1000; persistExMeta(); persistFunded(); persist();
    STATE.funded = o.fm !== false; STATE.fundedMee = false; STATE.fdOpen = o.open || null; STATE.fdAfOpen = !!o.af; STATE.fdMenu = null; STATE.fdForm = null;
    STATE.theme = o.theme || 'light'; document.body.classList.toggle('dark', STATE.theme === 'dark');
    STATE.setTab = 'funded'; go('instellingen');
  }, { items: ITEMS, tr: TR, o });
  const tekst = () => p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
  // wait for the page's own fade-in (main: rise .34s) before taking the picture
  const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true }); };

  console.log('─── Toestanden ───');
  const TOESTANDEN = {
    uit: { fm: false }, leeg: { leeg: true }, lopend: { open: 'fdc3' }, voor: { voor: true, open: 'fdc2' },
    na: { open: 'fdf1', af: true }, niet: { open: 'fdc1', af: true }, payout: { open: 'fdf1' }, gestopt: { gestopt: true, open: 'fdf1', af: true },
  };
  for (const [k, o] of Object.entries(TOESTANDEN)) for (const theme of ['light', 'dark']) { await zet({ ...o, theme }); await shot(`${k}-${theme}`); }
  await zet(TOESTANDEN.uit); let t = await tekst();
  ok('modus uit: alleen de schakelaar en "4 challenges en funded accounts met 7 trades zijn verborgen, niet gewist."', /4 challenges en funded accounts met 7 trades zijn verborgen, niet gewist\./.test(t) && !/Funded meetellen/.test(t) && !/100k #1/.test(t), t.slice(0, 300));
  await zet(TOESTANDEN.leeg); t = await tekst();
  ok('leeg: "Nog geen challenges" met "Challenge toevoegen"', /Nog geen challenges/.test(t) && await p.evaluate(() => !!document.querySelector('[data-empty="funded-leeg"]')), t.slice(0, 200));
  await zet({}); t = await tekst();
  ok('bovenaan twee getallen: Funded P&L en Uitbetaald', /FUNDED P&L/i.test(t) && /UITBETAALD/i.test(t) && /\$ 2\.480/.test(t));
  const lijst = await p.evaluate(() => ({ top: [...document.querySelectorAll('#main .fd-list')][0] ? [...[...document.querySelectorAll('#main .fd-list')][0].children].map(e => e.id) : [], af: [...document.querySelectorAll('details.fd-done .fd-card')].map(e => e.id), afOpen: !!(document.querySelector('details.fd-done') || {}).open }));
  ok('lopend bovenaan (actief funded, bezig), de rest onder een ingeklapt "Afgerond (2)"', lijst.top.join() === 'fd-fdf1,fd-fdc3' && lijst.af.join() === 'fd-fdc1,fd-fdc2' && !lijst.afOpen && /Afgerond \(2\)/.test(t), JSON.stringify(lijst));
  const dicht = await p.evaluate(() => document.getElementById('fd-fdf1').innerText.replace(/\s+/g, ' '));
  ok('dichte kaart: naam, firm, label funded, één pil en de P&L met % (geen grootte, login of uitbetaling)', /100k #2 FTMO funded actief/.test(dicht) && /\+\$ 4\.000/.test(dicht) && /\+4,00%/.test(dicht) && !/100\.000|Uitbetal/.test(dicht), dicht);
  await zet(TOESTANDEN.lopend); t = await tekst();
  ok('lopende challenge open: grootte, trades, login "nog niet bekend", geen uitbetaling-knop', /Grootte \$ 25\.000/.test(t) && /Trades 1/.test(t) && /nog niet bekend/.test(t) && !/Uitbetaling toevoegen/.test(t), t.slice(t.indexOf('25k #1'), t.indexOf('25k #1') + 160));
  await zet(TOESTANDEN.voor); t = await tekst();
  ok('gehaald, vóór omzetten: bovenaan, met "Omzetten naar funded account"', /Omzetten naar funded account/.test(t) && await p.evaluate(() => !!document.querySelector('.fd-list > #fd-fdc2')));
  await p.click('#fd-fdc2 button:text-is("Omzetten naar funded account")'); await p.fill('#fdConvName', '100k #2 live'); await p.click('#fdConvGo');
  const na = await p.evaluate(() => { const f = FUNDED.find(x => x.from === 'fdc2'); return { f, c: FUNDED.find(x => x.id === 'fdc2'), tr: T.filter(t => t.exchange === 'fdc2').length, opgeslagen: JSON.parse(localStorage.getItem('sj_funded')).length }; });
  ok('omzetten: funded account met firm en grootte, koppeling twee kanten op, trades blijven bij de challenge', na.f && na.f.firm === 'FTMO' && na.f.size === 100000 && na.f.name === '100k #2 live' && na.c.funded === na.f.id && na.tr === 2 && na.opgeslagen === 4, JSON.stringify(na).slice(0, 200));
  t = await tekst();
  ok('ná omzetten: funded account open met "uit challenge 100k #2"; challenge onder Afgerond met "→ funded"', /uit challenge 100k #2/.test(t) && await p.evaluate(() => /→ funded/.test(document.querySelector('details.fd-done #fd-fdc2').textContent)));
  await zet(TOESTANDEN.niet); t = await tekst();
  ok('niet gehaald: onder Afgerond, P&L −$ 10.400', await p.evaluate(() => !!document.querySelector('details.fd-done #fd-fdc1')) && /−\$ 10\.400/.test(t));
  await zet(TOESTANDEN.payout);
  await p.click('#fd-fdf1 button:text-is("Uitbetaling toevoegen")');
  ok('uitbetaling: Toevoegen is uitgeschakeld zolang er geen bedrag staat', await p.evaluate(() => document.getElementById('fdPayGo').disabled));
  await p.fill('#fdPayAmt', '1.200'); await p.click('#fdPayGo');
  const pay = await p.evaluate(() => ({ paid: fdPaid(fundedItem('fdf1')), bal: totalBalance() }));
  ok('uitbetaling van $ 1.200 opgeteld (2.480 + 1.200), eigen balans ongemoeid (Blofin-saldo $ 1.000)', pay.paid === 3680 && Math.abs(pay.bal - 1000) < 0.01, JSON.stringify(pay));
  await zet(TOESTANDEN.gestopt); t = await tekst();
  ok('gestopt: onder Afgerond, pil "gestopt", reden "eruit gezet", uitbetalen kan nog', await p.evaluate(() => !!document.querySelector('details.fd-done #fd-fdf1')) && /Reden eruit gezet/.test(t) && /Uitbetaling toevoegen/.test(t));

  console.log('─── Statusmenu en kaarten ───');
  await zet({});
  await p.click('#fd-fdc3 .fd-pill'); ok('pil opent een menu', await p.evaluate(() => !!document.querySelector('.fd-menu')));
  await p.click('.fd-menu button:has-text("gehaald")');
  ok('status via de pil: Breakout op gehaald', await p.evaluate(() => fundedItem('fdc3').status === 'gehaald' && !document.querySelector('.fd-menu')));
  await p.click('#fd-fdf1 .fd-pill'); await p.click('.fd-menu button:has-text("zelf gestopt")');
  ok('funded op gestopt · zelf gestopt', await p.evaluate(() => fundedItem('fdf1').status === 'gestopt' && fundedItem('fdf1').stop === 'zelf'));
  await p.click('#fd-fdc1 .fd-pill').catch(() => {});
  await zet({}); await p.click('#fd-fdc3 .fd-pill'); await p.click('h1#ptitle').catch(() => p.mouse.click(5, 5));
  ok('menu sluit bij een klik ernaast', await p.evaluate(() => !document.querySelector('.fd-menu')));
  await p.click('#fd-fdc3 .fd-head'); await p.click('#fd-fdf1 .fd-head');
  ok('één kaart tegelijk open', await p.evaluate(() => document.querySelectorAll('.fd-card.open').length === 1 && STATE.fdOpen === 'fdf1'));

  console.log('─── Toevoegen ───');
  await zet({ leeg: true });
  await p.click('[data-empty="funded-leeg"] button:text-is("Challenge toevoegen")');
  ok('formulier: Toevoegen uitgeschakeld tot firm, naam en grootte er staan', await p.evaluate(() => document.getElementById('fdAddGo').disabled));
  await p.fill('#fdF', 'FTMO'); await p.fill('#fdN', '100k #3'); await p.fill('#fdS', '100.000');
  ok('… en daarna ingeschakeld', await p.evaluate(() => !document.getElementById('fdAddGo').disabled));
  await p.click('#fdAddGo');
  ok('challenge toegevoegd met grootte 100.000 en status bezig, kaart open', await p.evaluate(() => FUNDED.length === 1 && FUNDED[0].size === 100000 && FUNDED[0].status === 'bezig' && Array.isArray(FUNDED[0].logins) && STATE.fdOpen === FUNDED[0].id));
  ok('een lege challenge kan weer weg', await p.evaluate(() => { const id = FUNDED[0].id; fdToggle(id); fdToggle(id); return !!document.querySelector('.fd-del'); }));

  console.log('─── Export → import ───');
  await zet({});
  const rond = await p.evaluate(async () => {
    STATE.fundedMee = true; persistState();
    const file = JSON.parse(JSON.stringify(snapshotPayload(false)));
    FUNDED = []; persistFunded(); STATE.funded = false; STATE.fundedMee = false;
    await applyBackup(file);
    const terug = { n: FUNDED.length, payout: fdPaid(fundedItem('fdf1')), fm: STATE.funded, mee: STATE.fundedMee, ls: JSON.parse(localStorage.getItem('sj_funded') || '[]').length };
    const oud = JSON.parse(JSON.stringify(file)); delete oud.funded; delete oud.settings.funded; delete oud.settings.fundedMee;
    await applyBackup(oud);
    const desc = dovDescribe(file).manual;
    return { terug, naOud: FUNDED.length, desc: desc.sub, dovKeys: DOV_PARTS.find(x => x.k === 'manual').keys.join() };
  });
  ok('back-up bevat de items en de schakelaars; terugzetten herstelt ze', rond.terug.n === 4 && rond.terug.payout === 2480 && rond.terug.fm && rond.terug.mee && rond.terug.ls === 4, JSON.stringify(rond.terug));
  ok('een oude back-up zonder funded laadt zonder fout en laat de items staan', rond.naOud === 4);
  ok('Data overzetten: funded reist mee met Handmatige accounts', rond.dovKeys === 'manual,funded' && /4 challenges en funded accounts/.test(rond.desc), rond.desc);

  console.log('─── Telefoon (390px) ───');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const [k, o] of Object.entries(TOESTANDEN)) { await zet(o); await shot(`${k}-390`); }
  await zet({ open: 'fdf1' });
  ok('390px: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  ok('geen JS-fouten', !errs.length, errs.join(' | '));
  await b.close();
  console.log(`\n=== Funded-tab: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
