// Denny's echte Hyperliquid-account door de hele app: sync, positie open, invoer, sluiten, weergave.
//
// De andere specs bouwen trades met de hand. Deze speelt een opname van een echte wallet af
// (tests/_fixtures/hyperliquid-wallet.json, gitignored), zodat de bugs van 29-09-2026 getoetst
// worden tegen de cijfers die ze veroorzaakten: de prijs 83227.99999999999, drie verschillende R's,
// centen die als $0 in beeld kwamen, en setup-lagen die verdwenen toen de positie sloot.
// Alles wordt vergeleken met wat Hyperliquid zelf zegt (de ruwe fills), niet met de eigen rekensom
// van de app.
//
//   node tests/hl-echt.spec.js                          speel de opname af (offline, elke keer gelijk)
//   node tests/hl-echt.spec.js --live                   haal het account eerst vers op bij Hyperliquid
//   node tests/hl-echt.spec.js --opnemen                idem, en bewaar het als nieuwe opname
//   node tests/hl-echt.spec.js --opnemen --wallet=0x…   de eerste keer, of een andere wallet
//
// Geen opname (CI, een verse kloon): de spec slaat zichzelf over.
const { chromium } = require('playwright');
const path = require('path');
const hl = require('./helpers/hl-wallet');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const args = process.argv.slice(2);
const LIVE = args.includes('--live') || args.includes('--opnemen');
const argWallet = (args.find(a => a.startsWith('--wallet=')) || '').slice('--wallet='.length);
const STOP_AFSTAND = 0.01;   // de stop die de test invult: 1% tegen de richting in
// Wat je in het formulier invult, zoals Denny bij zijn trade van 28-09 (1H · Bullish · MSB)
const JOUW = { layers: [{ timeframe: '1H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }],
  emotions: ['Geduldig'], mistakes: ['Te vroeg in'], tags: ['nieuwsdag'], notes: 'retest van de range-low' };

const dag = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date(ms));
const getal = s => parseFloat(String(s).replace(/[^\d,.−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-'));
const heeftRuis = x => /\.\d{9,}/.test(String(x));   // 83227.99999999999 is rekenruis, geen prijs
const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const overslaan = reden => { console.log('  ⏭ ' + reden + ' — overgeslagen'); console.log('\n=== HL echt: overgeslagen ==='); process.exit(0); };

(async () => {
  let acc = process.env.SJ_GEEN_FIXTURES ? null : hl.leesOpname();
  if (LIVE) {
    const w = (argWallet || (acc && acc.wallet) || '').trim();
    if (!hl.isWallet(w)) { console.error('Geen wallet: geef de eerste keer --wallet=0x… mee, daarna staat hij in de opname.'); process.exit(1); }
    acc = await hl.haalAccount(w);
    if (args.includes('--opnemen')) { hl.bewaarOpname(acc); console.log('  opname ververst: ' + acc.fills.length + ' fills → ' + path.relative(process.cwd(), hl.OPNAME)); }
  }
  if (!acc) overslaan('geen opname van een echte wallet in deze kloon (tests/_fixtures/hyperliquid-wallet.json)');

  const { dicht, open } = hl.levenslopen(acc.fills);
  if (!dicht.length) overslaan('nog geen gesloten positie in dit account');
  const L = dicht[dicht.length - 1];             // de laatste positie die dichtging
  const nu1 = L.closes[0].time - 1;              // vlak vóór de eerste sluiting: de positie loopt nog
  const nu2 = Date.parse(acc.opgenomen);
  const vooraf = hl.levenslopen(acc.fills.filter(f => f.time <= nu1));
  const lopend = vooraf.open.find(x => x.coin === L.coin);
  const STOP = +(L.dir === 'long' ? L.entry * (1 - STOP_AFSTAND) : L.entry * (1 + STOP_AFSTAND)).toFixed(1);
  const rVerwacht = L.netto / (Math.abs(L.entry - STOP) * L.qty);   // netto P&L ÷ risico in $
  const syncFrom = dag(acc.fills[0].time - 864e5);
  console.log(`  account …${acc.wallet.slice(-4)}: ${acc.fills.length} fills, ${dicht.length} gesloten posities, ` +
    `opgenomen ${acc.opgenomen.slice(0, 10)}${LIVE ? ' (vers opgehaald)' : ''}`);

  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL', viewport: { width: 1600, height: 1100 } });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const klok = { nu: nu1 };
  const log = await hl.speelAf(p, acc, klok);   // later geregistreerd, dus gaat vóór de blokkade
  await p.clock.setFixedTime(new Date(nu1));
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const hlTrades = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, status: t.status, dir: t.dir,
    entry: t.entry, exit: t.exit, pnl: +t.pnl, fees: +t.fees, stop: +t.stop, openTime: +t.openTime, date: t.date, qty: +t.qtyAsset, realized: +t.realizedPnl || 0,
    layers: t.layers, emotions: t.emotions, mistakes: t.mistakes, tags: t.tags, notes: t.notes })));
  const invoerIntact = t => !!t && zelfde(t.layers, JOUW.layers) && zelfde(t.emotions, JOUW.emotions) && zelfde(t.mistakes, JOUW.mistakes)
    && zelfde(t.tags, JOUW.tags) && t.notes === JOUW.notes && Math.abs(t.stop - STOP) < 1e-9;

  console.log(`─── ${dag(nu1)}, vlak vóór de sluiting: je positie loopt ───`);
  const n1 = await p.evaluate(async ({ wallet, syncFrom }) => {
    CONNS.hyperliquid = { connected: true, wallet, hint: wallet.slice(-4), syncFrom }; persistConns();
    return syncExchange('hyperliquid', { quiet: true });
  }, { wallet: acc.wallet, syncFrom });
  const t1 = await hlTrades();
  const open1 = t1.find(t => t.status === 'open');
  ok('sync lukt', n1 >= 0, String(n1));
  ok('de lopende positie staat als open trade', !!open1 && open1.dir === L.dir, JSON.stringify(t1.filter(t => t.status !== 'closed')));
  ok(`entry van de open trade is de echte prijs (${+lopend.entry.toPrecision(12)}), zonder rekenruis`,
    !!open1 && Math.abs(open1.entry - lopend.entry) < 1e-6 && !heeftRuis(open1.entry), String(open1 && open1.entry));
  ok(`de ${vooraf.dicht.length} posities die toen al dicht waren staan als gesloten trade`,
    t1.filter(t => t.status === 'closed').length === vooraf.dicht.length, String(t1.filter(t => t.status === 'closed').length));

  // Jouw invoer, via het formulier zoals je hem invult
  await p.evaluate(async ({ id, JOUW, STOP }) => {
    openForm(id); await new Promise(r => setTimeout(r, 300));
    formLayers = JOUW.layers.map(l => ({ ...l, setups: [...l.setups], confirmations: [...l.confirmations] }));
    formEmotions = [...JOUW.emotions]; formMistakes = [...JOUW.mistakes]; formTags = [...JOUW.tags];
    document.getElementById('f_stop').value = String(STOP);
    document.getElementById('f_notes').value = JOUW.notes;
    submitForm(id);
  }, { id: open1 && open1.id, JOUW, STOP });
  ok('je invoer staat op de open trade', invoerIntact((await hlTrades()).find(t => t.status === 'open')));

  console.log(`─── ${dag(nu2)}: de positie is dicht ───`);
  klok.nu = null; await p.clock.setFixedTime(new Date(nu2));
  const n2 = await p.evaluate(() => syncExchange('hyperliquid', { quiet: true }));
  const t2 = await hlTrades();
  const Lt = t2.find(t => t.openTime === L.open);
  ok('sync lukt', n2 >= 0, String(n2));
  ok('de positie is gesloten', !!Lt && Lt.status === 'closed', JSON.stringify(Lt && Lt.status));
  ok(`entry ${+L.entry.toPrecision(12)} en exit ${+L.exit.toPrecision(12)}: de echte prijzen, zonder rekenruis`,
    !!Lt && Math.abs(Lt.entry - L.entry) < 1e-6 && Math.abs(Lt.exit - L.exit) < 1e-6 && !heeftRuis(Lt.entry) && !heeftRuis(Lt.exit),
    Lt && Lt.entry + ' / ' + Lt.exit);
  // de app bewaart P&L en fees op 4 decimalen
  ok(`P&L is wat Hyperliquid zegt, na fees (${L.netto.toFixed(4)})`, !!Lt && Math.abs(Lt.pnl - L.netto) < 1e-4, String(Lt && Lt.pnl));
  ok(`fees kloppen (${L.fees.toFixed(4)})`, !!Lt && Math.abs(Lt.fees - L.fees) < 1e-4, String(Lt && Lt.fees));
  ok('setup-lagen, emoties, fouten, tags, notitie en stop zijn er nog na het sluiten', invoerIntact(Lt),
    JSON.stringify(Lt && { layers: Lt.layers, stop: Lt.stop, tags: Lt.tags }));
  ok(`${dicht.length} gesloten trades, ${open.length} open — net als bij Hyperliquid`,
    t2.filter(t => t.status === 'closed').length === dicht.length && t2.filter(t => t.status !== 'closed').length === open.length,
    t2.map(t => t.status).join(','));
  // Melding 06-10-2026: een nieuwe positie op dezelfde coin kreeg de datum en de invoer van de vorige
  for (const O of open) {
    const r = t2.find(t => t.status !== 'closed' && t.openTime === O.open);
    ok(`de lopende positie van ${dag(O.open)} staat open op haar eigen datum, entry ${+O.entry.toPrecision(12)}, zonder je invoer van de vorige`,
      !!r && r.date === dag(O.open) && Math.abs(r.entry - O.entry) < 1e-6 && !(r.layers || []).length, JSON.stringify(r && { date: r.date, entry: r.entry, layers: r.layers }));
    // Melding 07-10-2026: een geraakte TP was onzichtbaar tot de hele positie dicht was
    if (O.closes.length) ok(`al deels dicht: partial, volle grootte ${+O.qty.toPrecision(12)}, geboekt ${O.netto.toFixed(2)} na fees`,
      !!r && r.status === 'partial' && Math.abs(r.qty - O.qty) < 1e-9 && Math.abs(r.realized - O.netto) < 1e-3, JSON.stringify(r && { status: r.status, qty: r.qty, realized: r.realized }));
  }
  const somApp = t2.filter(t => t.status === 'closed').reduce((s, t) => s + t.pnl, 0), somHl = dicht.reduce((s, x) => s + x.netto, 0);
  ok(`totale P&L ${somHl.toFixed(2)} = wat Hyperliquid zegt`, Math.abs(somApp - somHl) < 1e-4 * dicht.length, somApp.toFixed(6) + ' vs ' + somHl.toFixed(6));

  for (const [naam, reset] of [['nog een keer syncen', false], ['alles opnieuw ophalen', true]]) {
    await p.evaluate(async reset => {
      if (reset) { CONNS.hyperliquid = { ...CONNS.hyperliquid, lastSync: 0 }; persistConns(); }
      await syncExchange('hyperliquid', { quiet: true });
    }, reset);
    const t = await hlTrades();
    ok(naam + ': geen dubbele trades', t.filter(x => x.status === 'closed').length === dicht.length && new Set(t.map(x => x.id)).size === t.length, String(t.length));
    ok(naam + ': je invoer staat er nog', invoerIntact(t.find(x => x.openTime === L.open)));
  }
  ok('de app vroeg niets wat niet in de opname zit', log.onbekend.length === 0, log.onbekend.join(','));

  console.log('─── Trades-overzicht ───');
  const perId = Object.fromEntries((await hlTrades()).map(t => [t.id, t]));
  const rijen = (await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); go('trades');
    return [...document.querySelectorAll('tbody tr.mrow')].map(tr => {   // .mrow: de trade-rij, niet de uitklaprij eronder
      const c = k => ((tr.querySelector(`td[data-l="${k}"]`) || {}).textContent || '').trim();
      return { id: +((tr.getAttribute('onclick') || '').match(/openForm\((\d+)\)/) || [])[1], tekst: tr.textContent, entry: c('Entry'), exit: c('Exit'), pnl: c('P&L').split(/[▲▼]/)[0], r: c('R') };   // P&L zonder het percentage erachter
    }); })).filter(r => perId[r.id]);
  const mijn = rijen.map(r => ({ ...r, L: dicht.find(x => x.open === perId[r.id].openTime) })).filter(r => r.L);
  const rijL = mijn.find(r => r.L === L);
  ok('je trades staan in het overzicht', mijn.length > 0 && !!rijL, String(mijn.length));
  ok('geen "undefined", "NaN" of "Infinity" in je rijen', !mijn.some(r => /undefined|NaN|Infinity/.test(r.tekst)),
    (mijn.find(r => /undefined|NaN|Infinity/.test(r.tekst)) || {}).tekst);
  // de tabel toont hooguit 3 decimalen
  ok('Entry en Exit: de echte prijzen, geen "0"', mijn.every(r => Math.abs(getal(r.entry) - r.L.entry) < 1e-3 && Math.abs(getal(r.exit) - r.L.exit) < 1e-3),
    JSON.stringify(mijn.map(r => [r.entry, r.exit])));
  ok('P&L onder $100 in centen, met het goede bedrag',
    mijn.every(r => Math.abs(r.L.netto) >= 100 || (/\d,\d\d/.test(r.pnl) && Math.abs(getal(r.pnl) - r.L.netto) < 0.006)),
    JSON.stringify(mijn.map(r => [r.pnl, +r.L.netto.toFixed(4)])));
  ok('R zonder stop-loss: een streepje', mijn.filter(r => r !== rijL).every(r => r.r === '—'), JSON.stringify(mijn.map(r => r.r)));
  const marge = Math.abs(rVerwacht) < 1 ? 0.006 : 0.06;   // de tabel toont 2 decimalen onder 1R, anders 1
  ok(`R van je trade = netto P&L ÷ risico (${rVerwacht.toFixed(3)})`,
    !!rijL && Math.abs(getal(rijL.r) - rVerwacht) < marge && (rVerwacht < 0) === /−/.test(rijL.r), rijL && rijL.r);
  const veld = await p.evaluate(async id => { openForm(id); await new Promise(r => setTimeout(r, 300));
    const v = (document.getElementById('f_r') || {}).value; closeForm(); return v; }, Lt && Lt.id);
  ok('het R-veld in het formulier toont hetzelfde getal', Math.abs(parseFloat(veld) - rVerwacht) < 0.006, JSON.stringify(veld));

  console.log('─── Dashboard (live trades) ───');
  const dash = await p.evaluate(() => { setFilter('kind', 'live'); go('dashboard');
    const meta = ((document.querySelector('.panel.hero .meta') || {}).textContent || '').replace(/\s+/g, ' ');
    const tab = [...document.querySelectorAll('.panel')].find(x => /Recente trades/.test(x.textContent));
    const eerste = tab && tab.querySelector('tbody tr');
    return { meta, eerste: eerste ? [...eerste.children].map(td => td.textContent.trim()) : [] }; });
  // v1.5: wat een lopende positie al geboekt heeft (een geraakte TP) telt mee; zonder sluiting nog niets
  const geboekt = [...dicht, ...open.filter(x => x.closes.length)];
  const som = pre => geboekt.filter(x => dag(x.open).startsWith(pre)).reduce((s, x) => s + x.netto, 0);
  const bedrag = re => { const m = dash.meta.match(re); return m ? getal(m[1]) : NaN; };
  const maand = dag(nu2).slice(0, 7);
  ok(`gerealiseerd deze maand = ${som(maand).toFixed(2)}`, Math.abs(bedrag(/deze maand\s*([+−-]?\s*\$?\s*[\d.,]+)/) - som(maand)) < 0.006, dash.meta);
  const nieuwste = [...dicht, ...open].sort((x, y) => y.open - x.open)[0], d = dag(nieuwste.open);   // een lopende positie is nieuwer
  ok('Recente trades: je nieuwste trade bovenaan', !!dash.eerste[0] && dash.eerste[0].includes(nieuwste.coin) && dash.eerste[2] === d.slice(8) + '-' + d.slice(5, 7),
    JSON.stringify(dash.eerste));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== HL echt: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
