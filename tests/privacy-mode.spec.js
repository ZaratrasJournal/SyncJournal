// Privacy-modus (oog-knop rechtsboven): bedragen worden onleesbaar voor screenshots, de keuze
// blijft na herladen bewaard, en uitzetten maakt alles weer leesbaar.
//
// Herschreven in T2 (24-10-2026): de oude spec laadde de bevroren oude app.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const T0 = { time: '10:00', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', exchange: 'm_a' };
const DATA = {
  trades: [{ ...T0, id: 1, date: '2026-10-01', pnl: 1234.56, fees: 4.5 }, { ...T0, id: 2, date: '2026-10-02', pnl: -321.09 }],
  manual: [{ id: 'm_a', name: 'Prive', transactions: [{ id: 'x1', type: 'deposit', amount: '25000', date: '2026-09-01', note: '' }] }],
};

// Elk zichtbaar element met een bedrag ($ of € gevolgd door cijfers) in eigen tekst: is het gemaskeerd?
const BEDRAGEN = (waar = '#main *, #balVal') => {
  const uit = [];
  document.querySelectorAll(waar).forEach(el => {
    const eigen = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (!/[$€]\s?[\d.,]*\d/.test(eigen) || !el.getClientRects().length) return;
    const gemaskeerd = !!el.closest('.mask') && getComputedStyle(el.closest('.mask')).filter.includes('blur');
    uit.push({ t: eigen.trim().slice(0, 30), gemaskeerd, hbar: !!el.closest('.hbar .sub') });
  });
  return uit;
};

// Het uitklapdetail onder een trade-rij (normaal bij hover) zichtbaar maken en daar meten.
const BEDRAGEN_DETAIL = () => {
  const rijen = [...document.querySelectorAll('#main tr.drow')];
  rijen.forEach(r => { r.hidden = false; });
  const uit = [];
  rijen.forEach(rij => rij.querySelectorAll('*').forEach(el => {
    const eigen = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (!/[$€]\s?[\d.,]*\d/.test(eigen) || !el.getClientRects().length) return;
    uit.push({ t: eigen.trim().slice(0, 30), gemaskeerd: !!el.closest('.mask') && getComputedStyle(el.closest('.mask')).filter.includes('blur') });
  }));
  rijen.forEach(r => { r.hidden = true; });
  return uit;
};

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, DATA);

  for (const pg of ['dashboard', 'trades']) {
    await H.go(p, pg);
    const uit = await p.evaluate(BEDRAGEN);
    ok(`${pg}, privacy uit: bedragen staan leesbaar in beeld (${uit.length})`, uit.length >= 2 && uit.every(x => !x.gemaskeerd), JSON.stringify(uit.filter(x => x.gemaskeerd).slice(0, 3)));
  }
  ok('balans rechtsboven toont het bedrag', await p.evaluate(() => /\d/.test(document.getElementById('balVal').textContent) && !getComputedStyle(document.getElementById('balVal')).filter.includes('blur')));

  await p.click('#btnEye');
  ok('oog-knop zet privacy aan (body.priv) en bewaart het', await p.evaluate(() => STATE.priv && document.body.classList.contains('priv') && JSON.parse(localStorage.getItem('sj_state')).priv === true));
  // Elke pagina met geldbedragen, plus het uitklapdetail van een trade en het formulier; licht én donker.
  for (const thema of ['light', 'dark']) {
    await p.evaluate(t => setTheme(t), thema);
    for (const pg of ['dashboard', 'trades', 'analytics', 'tendencies', 'kalender', 'review']) {
      await H.go(p, pg);
      const uit = await p.evaluate(BEDRAGEN), open = uit.filter(x => !x.gemaskeerd);
      if (['dashboard', 'trades', 'analytics'].includes(pg)) ok(`${thema}, ${pg}: er staan bedragen in beeld (anders zegt de check niets)`, uit.length >= 2, String(uit.length));
      ok(`${thema}, ${pg}, privacy aan: elk bedrag is onleesbaar (${uit.length}, waarvan ${uit.filter(x => x.hbar).length} onder balkjes)`, open.length === 0, JSON.stringify(open.map(x => x.t).slice(0, 6)));
    }
    await H.go(p, 'trades');
    const detail = await p.evaluate(BEDRAGEN_DETAIL);
    ok(`${thema}, trade-detail (uitklaprij), privacy aan: elk bedrag is onleesbaar (${detail.length})`, detail.length >= 1 && detail.every(x => x.gemaskeerd), JSON.stringify(detail.filter(x => !x.gemaskeerd).map(x => x.t).slice(0, 6)));
    await p.evaluate(() => openForm(T.find(t => +t.pnl > 0).id));
    await p.waitForFunction(() => document.getElementById('modal').classList.contains('on'));
    const form = await p.evaluate(BEDRAGEN, '#modal *');
    ok(`${thema}, trade-formulier, privacy aan: elk bedrag in tekst is onleesbaar (${form.length})`, form.length >= 1 && form.every(x => x.gemaskeerd), JSON.stringify(form.filter(x => !x.gemaskeerd).map(x => x.t).slice(0, 6)));
    await p.evaluate(() => closeForm());
  }
  await p.evaluate(() => setTheme('light'));
  ok('balans rechtsboven is onleesbaar', await p.evaluate(() => getComputedStyle(document.getElementById('balVal')).filter.includes('blur')));

  await H.reload(p);
  ok('na herladen staat privacy nog aan', await p.evaluate(() => STATE.priv && document.body.classList.contains('priv')));

  await p.click('#btnEye');
  await H.go(p, 'dashboard');
  const terug = await p.evaluate(BEDRAGEN);
  ok('uitzetten: alles weer leesbaar', !(await p.evaluate(() => STATE.priv)) && terug.length >= 2 && terug.every(x => !x.gemaskeerd), JSON.stringify(terug.filter(x => x.gemaskeerd).slice(0, 3)));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Privacy-modus: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
