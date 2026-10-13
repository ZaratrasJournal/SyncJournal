// Tijdframe-analytics (v1.8): entry-tijdframe, tijdframe-combinatie en HTF-bias in Tendencies, een
// HTF-bias-paneel in Analytics en lagen-patronen op de playbook-pagina.
// Plan: docs/plan-tijdframe-analytics-2026-10-13.md (besluiten Denny 13-10-2026).
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);

  console.log('─── Helpers ───');
  const h = await p.evaluate(() => {
    if (typeof tfCombo !== 'function' || typeof htfBias !== 'function' || typeof biasRelatie !== 'function' || typeof laagPatroon !== 'function') return { fout: 'helpers ontbreken' };
    const lg = (tf, bias, setups) => ({ timeframe: tf, bias: bias || '', setups: setups || [], confirmations: [] });
    const tr = (layers, dir) => ({ layers, dir: dir || 'long', timeframe: '' });
    return {
      combo: tfCombo(tr([lg('Daily'), lg('1H')])), comboLeeg: tfCombo(tr([])),
      bias1: htfBias(tr([lg('Daily', 'Bearish'), lg('4H', 'Bullish'), lg('15M')])), bias2: htfBias(tr([lg('Daily', 'Neutraal'), lg('4H', 'bullish')])), bias3: htfBias(tr([lg('1H')])),
      mee: biasRelatie(tr([lg('4H', 'Bullish'), lg('1H')], 'long')), tegen: biasRelatie(tr([lg('Daily', 'Bearish'), lg('4H', 'Bullish'), lg('15M')], 'long')),
      meeShort: biasRelatie(tr([lg('4H', 'Bearish'), lg('1H')], 'short')), geen: biasRelatie(tr([lg('1H')], 'long')),
      patroon: laagPatroon(tr([lg('4H', '', ['SFP']), lg('1H', '', ['BOS', 'MSB'])])), patroonLeegTf: laagPatroon(tr([lg('', '', ['SFP']), lg('15M')])), patroonGeen: laagPatroon(tr([])),
    };
  });
  ok('TF-combinatie: Daily > 1H, zonder lagen "—"', h.combo === 'Daily > 1H' && h.comboLeeg === '—', JSON.stringify(h));
  ok('HTF-bias = hoogste laag met Bullish/Bearish (Neutraal overgeslagen, hoofdletters maken niet uit)', h.bias1 === 'Bearish' && h.bias2 === 'Bullish' && h.bias3 === '', JSON.stringify([h.bias1, h.bias2, h.bias3]));
  ok('mee / tegen / geen', h.mee === 'mee' && h.tegen === 'tegen' && h.meeShort === 'mee' && h.geen === 'geen', JSON.stringify([h.mee, h.tegen, h.meeShort, h.geen]));
  ok('lagen-patroon: 4H SFP → 1H BOS+MSB; laag zonder tijdframe "?"; zonder lagen "—"', h.patroon === '4H SFP → 1H BOS+MSB' && h.patroonLeegTf === '? SFP → 15M' && h.patroonGeen === '—', JSON.stringify([h.patroon, h.patroonLeegTf, h.patroonGeen]));

  console.log('─── Tendencies ───');
  const td = await p.evaluate(() => {
    const lg = (tf, bias, setups) => ({ timeframe: tf, bias: bias || '', setups: setups || [], confirmations: [] });
    const rows = []; let id = 1;
    // 8 trades Daily > 1H mee met de bias, 8 trades 4H > 15M tegen de bias
    for (let i = 0; i < 8; i++) rows.push({ ...EMPTY_TRADE, id: id++, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: 'MSB', date: '2026-10-0' + (1 + (i % 8)), time: '10:00', entry: 100, stop: 95, exit: 110, size: '1000', pnl: 100, timeframe: '1H', layers: [lg('Daily', 'Bullish'), lg('1H', '', ['MSB'])] });
    for (let i = 0; i < 8; i++) rows.push({ ...EMPTY_TRADE, id: id++, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'short', setup: 'MSB', date: '2026-10-0' + (1 + (i % 8)), time: '14:00', entry: 100, stop: 105, exit: 103, size: '1000', pnl: -30, timeframe: '15M', layers: [lg('4H', 'Bullish'), lg('15M', '', ['MSB'])] });
    T = rows; persist(); STATE.tendRow = 'tfcombo'; STATE.tendCol = 'htf'; go('tendencies');
    const opts = [...document.querySelectorAll('select[aria-label="row dimensie"] option')].map(o => o.textContent);
    const main = document.getElementById('main').textContent.replace(/\s+/g, ' ');
    return { opts, combo: /Daily > 1H/.test(main) && /4H > 15M/.test(main), htf: /Mee met HTF/.test(main) && /Tegen HTF/.test(main), vals: tdimVals('tf') };
  });
  ok('keuzelijst heeft Tijdframe, TF-combinatie en HTF-bias', ['Tijdframe', 'TF-combinatie', 'HTF-bias'].every(x => td.opts.includes(x)), JSON.stringify(td.opts));
  ok('kruistabel TF-combinatie × HTF-bias toont "Daily > 1H", "4H > 15M", "Mee met HTF" en "Tegen HTF"', td.combo && td.htf, JSON.stringify(td));
  ok('tijdframes gesorteerd hoog → laag: 1H, 15M', JSON.stringify(td.vals) === '["1H","15M"]', JSON.stringify(td.vals));

  console.log('─── Analytics: HTF-bias mee of tegen ───');
  const paneel = () => p.evaluate(() => { STATE.currency = 'USD'; go('analytics');
    const pn = [...document.querySelectorAll('.panel')].find(x => /HTF-bias: mee of tegen/.test((x.querySelector('h3') || {}).textContent || ''));
    if (!pn) return null;
    return { tekst: pn.textContent.replace(/\s+/g, ' '), rijen: [...pn.querySelectorAll('.hbar')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), mask: !!pn.querySelector('.mask') }; });
  await p.evaluate(() => { const lg = (tf, bias) => ({ timeframe: tf, bias: bias || '', setups: [], confirmations: [] });
    T.push({ ...EMPTY_TRADE, id: 90, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date: '2026-10-09', time: '10:00', entry: 100, stop: 95, exit: 105, size: '1000', pnl: 50, layers: [lg('1H')] },
           { ...EMPTY_TRADE, id: 91, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date: '2026-10-09', time: '11:00', entry: 100, stop: 95, exit: 95, size: '1000', pnl: -50, layers: [] }); persist(); });
  const a1 = await paneel();
  ok('paneel "HTF-bias: mee of tegen" bestaat', !!a1, JSON.stringify(a1));
  const rij = (re) => ((a1 && a1.rijen) || []).find(r => re.test(r)) || '';
  ok('Mee met HTF: 8 trades, 100%, gem. +2,00R, netto +$ 800', [/Mee met HTF/, /100%/, /8 trades/, /\+2,00R/, /\+\$\s?800/].every(re => re.test(rij(/Mee/))), rij(/Mee/));
  ok('Tegen HTF: 8 trades, 0%, gem. −0,60R, netto −$ 240', [/ 0%|^Tegen HTF 0%/, /8 trades/, /−0,60R/, /−\$\s?240/].every(re => re.test(rij(/Tegen/))), rij(/Tegen/));
  ok('Geen bias: 2 trades (met en zonder lagen)', /2 trades/.test(rij(/Geen bias/)), rij(/Geen bias/));
  ok('bedragen gemaskeerd (privacy)', !!a1 && a1.mask);
  await p.evaluate(() => { T.forEach(t => (t.layers || []).forEach(l => { l.bias = ''; })); persist(); });
  const a2 = await paneel();
  ok('zonder enige bias: uitleg wat te doen, geen lege balken', !!a2 && /Nog geen bias in je lagen/.test(a2.tekst) && a2.rijen.length === 0, JSON.stringify(a2 && a2.tekst.slice(0, 160)));

  console.log('─── Playbook: lagen-patronen ───');
  const pbPaneel = (setup) => p.evaluate(s => { STATE.currency = 'USD'; PBOOK[s] = PBOOK[s] || { criteria: [] };
    const d = document.createElement('div'); d.innerHTML = playbookDetail(s);
    const pn = [...d.querySelectorAll('.panel')].find(x => /Lagen-patronen/.test((x.querySelector('h3') || {}).textContent || ''));
    return pn ? { tekst: pn.textContent.replace(/\s+/g, ' '), rijen: [...pn.querySelectorAll('[data-patroon]')].map(r => r.getAttribute('data-patroon') + ' | ' + r.textContent.replace(/\s+/g, ' ').trim()), img: !!pn.querySelector('img') } : null; }, setup);
  await p.evaluate(() => {
    const lg = (tf, setups) => ({ timeframe: tf, bias: '', setups: setups || [], confirmations: [] }); const rows = []; let id = 200;
    const tr = (layers, pnl, exit) => ({ ...EMPTY_TRADE, id: id++, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: 'MSB', date: '2026-10-05', time: '10:00', entry: 100, stop: 95, exit, size: '1000', pnl, layers });
    for (let i = 0; i < 5; i++) rows.push(tr([lg('4H', ['SFP']), lg('1H', ['MSB'])], 50, 105));     // +1R
    for (let i = 0; i < 3; i++) rows.push(tr([lg('Daily'), lg('15M', ['MSB'])], -25, 97.5));     // −0,5R
    rows.push(tr([lg('1H', ['MSB'])], 50, 105));
    for (let i = 0; i < 2; i++) rows.push({ ...tr([lg('4H', ['<img src=x onerror="window.__xss2=1">'])], 10, 101), setup: 'Gevaarlijk' });
    rows.push({ ...tr([], 10, 101), setup: 'Zonder lagen' }, { ...tr([lg('4H', ['A'])], 10, 101), setup: 'Te weinig' }, { ...tr([lg('1H', ['B'])], 10, 101), setup: 'Te weinig' });
    T = rows; persist(); render();
  });
  const pp = await pbPaneel('MSB');
  ok('paneel "Lagen-patronen" op de playbook-pagina', !!pp, JSON.stringify(pp));
  ok('twee patronen met ≥2 trades, beste (gem. R) bovenaan', !!pp && pp.rijen.length === 2 && /^4H SFP → 1H MSB \|/.test(pp.rijen[0]) && /^Daily → 15M MSB \|/.test(pp.rijen[1]), JSON.stringify(pp && pp.rijen));
  ok('per patroon: aantal, win-rate, gem. R en netto', !!pp && /5×/.test(pp.rijen[0]) && /100%/.test(pp.rijen[0]) && /\+1,00R/.test(pp.rijen[0]) && /3×/.test(pp.rijen[1]) && /0%/.test(pp.rijen[1]) && /−0,50R/.test(pp.rijen[1]), JSON.stringify(pp && pp.rijen));
  ok('label Beste en Zwakste', !!pp && /Beste/.test(pp.rijen[0]) && /Zwakste/.test(pp.rijen[1]), JSON.stringify(pp && pp.rijen));
  ok('het patroon met 1 trade staat er niet, wel de melding', !!pp && /1 patroon met te weinig trades/.test(pp.tekst), pp && pp.tekst.slice(-120));
  const pg = await pbPaneel('Gevaarlijk');
  ok('setup-naam met HTML wordt tekst, ook in het patroon-attribuut', !!pg && !pg.img && pg.rijen.length === 1 && pg.rijen[0].includes('<img src=x onerror="window.__xss2=1">'), JSON.stringify(pg));
  const pz = await pbPaneel('Zonder lagen');
  ok('zonder lagen: uitleg wat te doen', !!pz && /Nog geen setup-lagen/.test(pz.tekst), JSON.stringify(pz));
  const pw = await pbPaneel('Te weinig');
  ok('alleen patronen met 1 trade: "nog te weinig trades per patroon"', !!pw && /te weinig trades per patroon/i.test(pw.tekst) && pw.rijen.length === 0, JSON.stringify(pw));

  console.log('─── Review 13-10: klikken in de kruistabel, verdict zonder lagen ───');
  const kl = await p.evaluate(() => {
    const lg = (tf, bias) => ({ timeframe: tf, bias: bias || '', setups: [], confirmations: [] }); const rows = []; let id = 400;
    for (let i = 0; i < 9; i++) rows.push({ ...EMPTY_TRADE, id: id++, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: "R&D o'k", session: 'London', date: '2026-10-05', time: '10:00', entry: 100, stop: 95, exit: 105, size: '1000', pnl: 50,
      timeframe: '1H', layers: [lg("4H&#39;);window.__x=1;//", 'Bullish'), lg('1H')] });
    T = rows; persist(); render();
    STATE.tendRow = 'tfcombo'; STATE.tendCol = 'htf'; go('tendencies');
    const cel = document.querySelector('[data-t*="4H"]');
    const tfKlikbaar = !!(cel && cel.getAttribute('onclick'));
    if (cel) cel.click();
    STATE.tendRow = 'setup'; STATE.tendCol = 'session'; go('tendencies');
    const sc = [...document.querySelectorAll('[data-t]')].find(x => x.getAttribute('onclick'));
    if (sc) sc.click();
    return { x: !!window.__x, tfKlikbaar, filter: JSON.stringify(FILTER.setup), page: STATE.page };
  });
  ok('een vervalste tijdframe-tekst in een back-up draait geen code bij een klik', !kl.x, JSON.stringify(kl));
  ok('cellen met een tijdframe-dimensie zijn niet klikbaar (er is geen filter voor)', !kl.tfKlikbaar, JSON.stringify(kl));
  ok("setup × sessie blijft klikbaar en filtert exact op \"R&D o'k\"", kl.page === 'trades' && kl.filter === JSON.stringify(["R&D o'k"]), JSON.stringify(kl));
  const vd = await p.evaluate(() => {
    const rows = []; let id = 500; const ses = ['London', 'New York', 'Azië'];
    for (let i = 0; i < 12; i++) rows.push({ ...EMPTY_TRADE, id: id++, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: 'MSB', session: ses[i % 3], date: '2026-10-05', time: '10:00', entry: 100, stop: 95, exit: 101, size: '1000', pnl: 10, layers: [] });
    T = rows; persist(); clearGFilter(); go('tendencies'); return document.getElementById('main').textContent.replace(/\s+/g, ' ');
  });
  const kaart = re => ((vd.match(re) || [''])[0].match(/combinatie (.+?) gem\.|lek (.+?) gem\./) || [])[1] || ((vd.match(re) || [''])[0].match(/lek (.+?) gem\./) || [])[1] || '';
  const edge = kaart(/Jouw sterkste combinatie.{0,80}/), leak = kaart(/Structureel lek.{0,80}/);
  ok('sterkste combinatie en lek zijn nooit dezelfde combinatie', !edge || edge !== leak, JSON.stringify([edge, leak]));
  ok('zonder lagen geen "MSB · Geen bias" als sterkste combinatie én als lek', !/Geen bias/.test((vd.match(/Jouw sterkste combinatie.{0,80}/) || [''])[0]) && !/Geen bias/.test((vd.match(/Structureel lek.{0,80}/) || [''])[0]), (vd.match(/Jouw sterkste combinatie.{0,120}/) || [''])[0]);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Tijdframe-analytics: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
