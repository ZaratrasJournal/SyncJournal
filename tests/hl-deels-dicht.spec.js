// Hyperliquid: een positie die deels dicht is (TP geraakt) maar nog loopt.
//
// Melding Denny, 07-10-2026: zijn short van 05-10 raakte vannacht een TP (0,00174 van 0,00447 BTC),
// maar in de journal stond de trade nog gewoon open: geen stap, geen gerealiseerde P&L, en de grootte
// gekrompen tot wat er nog openstond (0,00273). Oorzaak: de levensloop-reconstructie gaf alleen
// afgesloten posities terug; een lopende positie kwam alleen als open rij binnen, en die kent alleen
// het restant. Zoals bij OKX hoort zo'n positie één rij met status partial te zijn: de volle grootte,
// de stappen, en het geboekte bedrag apart.
//
// Denny's cijfers (Trade History op Hyperliquid), als nagemaakte fills; draait ook op CI.
const { chromium } = require('playwright');
const path = require('path');
const hl = require('./helpers/hl-wallet');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol = 1e-3) => Math.abs(+a - b) <= tol;

const WALLET = '0x' + 'c'.repeat(40);
const ms = s => Date.parse(s);   // UTC; in Amsterdam (CEST) twee uur later
const fill = (t, dir, side, sz, px, start, pnl, fee, tid) => ({ coin: 'BTC', dir, side, px: String(px), sz: String(sz), startPosition: String(start),
  closedPnl: String(pnl), fee: String(fee), time: ms(t), tid, hash: '0x' + tid, oid: tid, crossed: true, feeToken: 'USDC' });
const OPEN = fill('2026-10-05T14:24:15Z', 'Open Short', 'A', 0.00447, 86303, 0, 0, 0.17, 11);            // 05-10 16:24
const TP = fill('2026-10-07T02:00:59Z', 'Close Short', 'B', 0.00174, 84282, -0.00447, 3.51654, 0.07, 12); // 07-10 04:00
const REST = fill('2026-10-08T08:00:00Z', 'Close Short', 'B', 0.00273, 83500, -0.00273, 7.65219, 0.10, 13); // later: helemaal dicht
const GEREALISEERD = 3.51654 - 0.17 - 0.07;            // na de TP: wat geboekt is, min de fees tot nu toe
const TOTAAL = 3.51654 + 7.65219 - 0.17 - 0.07 - 0.10;  // na de laatste sluiting
const ACC = { wallet: WALLET, fills: [OPEN, TP, REST], clearinghouseState: { marginSummary: { accountValue: '111' }, assetPositions: [] }, spotClearinghouseState: { balances: [] } };
const S = { voorTP: ms('2026-10-06T19:16:00Z'), naTP: ms('2026-10-07T04:26:00Z'), later: ms('2026-10-07T10:00:00Z'), dicht: ms('2026-10-08T11:00:00Z') };
const JOUW = { layers: [{ timeframe: '4H', bias: 'Bearish', setups: ['MSB'], confirmations: [] }], stop: 87000 };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const klok = { nu: S.voorTP };
  await hl.speelAf(p, ACC, klok);
  const naar = async nu => { klok.nu = nu; await p.clock.setFixedTime(new Date(nu)); };
  await naar(S.voorTP);
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });

  const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, status: t.status, srcId: t.srcId, date: t.date, time: t.time,
    entry: +t.entry, exit: +t.exit, qty: +t.qtyAsset, pnl: +t.pnl, realized: +t.realizedPnl || 0, stappen: (t.fills || []).map(f => [f.kind, +f.price, +f.qty]),
    layers: t.layers || [], stop: +t.stop || 0 })));
  const sync = () => p.evaluate(async w => {
    CONNS.hyperliquid = { ...(CONNS.hyperliquid || {}), connected: true, wallet: w, hint: w.slice(-4), syncFrom: '2026-10-01' }; persistConns();
    return syncExchange('hyperliquid', { quiet: true });
  }, WALLET);
  const invoer = r => !!r && JSON.stringify(r.layers) === JSON.stringify(JOUW.layers) && r.stop === JOUW.stop;

  console.log('─── 06-10: de short loopt, je vult je setup en stop in ───');
  await sync();
  const open1 = (await rijen()).find(r => r.status === 'open');
  ok('de short staat open: 05-10 16:24, 0,00447 BTC', !!open1 && open1.date === '2026-10-05' && open1.time === '16:24' && bij(open1.qty, 0.00447, 1e-9), JSON.stringify(open1));
  await p.evaluate(({ id, J }) => { const t = T.find(x => x.id === id); t.layers = J.layers; t.stop = J.stop; persist(); }, { id: open1 && open1.id, J: JOUW });

  for (const [naam, nu] of [['07-10 06:26, na de TP van 04:00', S.naTP], ['07-10 12:00, nog een keer syncen', S.later]]) {
    console.log(`─── ${naam} ───`);
    await naar(nu); await sync();
    const t = await rijen(), lopend = t.filter(r => r.status !== 'closed'), r = lopend[0];
    ok('precies één rij voor de positie, deels dicht (partial)', lopend.length === 1 && r.status === 'partial', JSON.stringify(lopend.map(x => [x.status, x.qty])));
    ok('de volle grootte: 0,00447 BTC, niet het restant 0,00273', !!r && bij(r.qty, 0.00447, 1e-9), String(r && r.qty));
    ok(`de TP staat erin: stappen open @86.303 en TP @84.282`, !!r && r.stappen.length === 2 && r.stappen[0][1] === 86303 && r.stappen[1][1] === 84282, JSON.stringify(r && r.stappen));
    ok(`gerealiseerd ${GEREALISEERD.toFixed(2)} (na fees), P&L van de trade nog 0`, !!r && bij(r.realized, GEREALISEERD) && r.pnl === 0, JSON.stringify(r && [r.realized, r.pnl]));
    ok('datum blijft 05-10 16:24, entry 86.303', !!r && r.date === '2026-10-05' && r.time === '16:24' && r.entry === 86303, JSON.stringify(r && [r.date, r.time, r.entry]));
    ok('je setup-lagen en stop zijn er nog', invoer(r), JSON.stringify(r && [r.layers, r.stop]));
  }
  // In het formulier: de regel "Samen" onder de stappen toonde de P&L van de trade, en die is bij een
  // partial bewust 0 - dus +$ 0,00 onder een TP van +$ 3,52.
  const samen = await p.evaluate(async () => { STATE.currency = 'USD'; const t = T.find(x => x.exchange === 'hyperliquid' && x.status === 'partial');
    openForm(t.id); await new Promise(r => setTimeout(r, 300));
    const voet = document.querySelector('.extab tfoot'); const v = voet ? voet.innerText.replace(/\s+/g, ' ') : ''; closeForm(); return v; });
  ok(`stappen in het formulier: "Samen" toont het geboekte bedrag (+$ ${GEREALISEERD.toFixed(2).replace('.', ',')})`, samen.includes(GEREALISEERD.toFixed(2).replace('.', ',')), samen);

  console.log('─── 08-10: de rest gaat dicht ───');
  await naar(S.dicht); await sync();
  const t4 = await rijen(), dicht = t4.filter(r => r.status === 'closed' && r.entry === 86303);
  ok('geen open of partial rij meer', !t4.some(r => r.status !== 'closed'), JSON.stringify(t4.filter(r => r.status !== 'closed')));
  ok('één gesloten trade, met alle drie de stappen', dicht.length === 1 && dicht[0].stappen.length === 3, JSON.stringify(dicht.map(x => x.stappen)));
  ok(`P&L ${TOTAAL.toFixed(2)}, en niets meer apart "gerealiseerd"`, dicht.length === 1 && bij(dicht[0].pnl, TOTAAL) && !dicht[0].realized, JSON.stringify(dicht[0] && [dicht[0].pnl, dicht[0].realized]));
  ok('je setup-lagen en stop zijn er nog', invoer(dicht[0]), JSON.stringify(dicht[0] && [dicht[0].layers, dicht[0].stop]));

  console.log('─── Een journal die het al mis had (Denny\'s export van 07-10) herstelt na de update ───');
  await naar(S.naTP);
  await p.evaluate(async ({ J, naTP }) => {
    T = [{ ...EMPTY_TRADE, id: 81, exchange: 'hyperliquid', kind: 'live', srcId: 'hyperliquid_open_BTC', status: 'open', placeholder: true, pair: 'BTC/USDC', dir: 'short',
      positionId: 'BTC', date: '2026-10-05', time: '16:24', openTime: '1791210255000', entry: 86303, size: '235.61', qtyAsset: 0.00273, layers: J.layers, stop: J.stop }];
    persist(); CONNS.hyperliquid = { ...CONNS.hyperliquid, lastSync: naTP }; persistConns();
    DB.save('schema', 8);   // de stand van v1.3.5: de opruimstap moet nog lopen
    await IDB.set('trades', T);   // persist() schrijft asynchroon; zonder wachten laadt de reload soms de vorige stand
  }, { J: JOUW, naTP: S.naTP });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await naar(S.naTP + 3600e3); await sync();
  const h = (await rijen()).filter(r => r.status !== 'closed');
  ok('na de update: één partial-rij met de volle grootte en de TP', h.length === 1 && h[0].status === 'partial' && bij(h[0].qty, 0.00447, 1e-9) && h[0].stappen.length === 2,
    JSON.stringify(h.map(x => [x.status, x.qty, x.stappen.length])));
  ok('met je invoer erop', invoer(h[0]), JSON.stringify(h[0] && [h[0].layers, h[0].stop]));

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== HL deels dicht: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
