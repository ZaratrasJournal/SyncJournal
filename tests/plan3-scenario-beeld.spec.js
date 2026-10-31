// TradingPlan v3 ronde 4 — het plan breder, het opengeklapte scenario overzichtelijk, een grote afbeelding per scenario.
//  1. Breder: tot ± 1680 px; de trechter een smalle kolom links (± 300–320 px), de scenario's de rest.
//  2. Opengeklapt: links de afbeelding met daaronder "Plan" (lagen, confirmations, criteria); rechts één sticky kolom
//     met de kern (trigger, ongeldig als, Stop en TP's in één blok, klaar) en "Uitvoering & edge".
//     Onder ± 1100 px één kolom; op 390 geen horizontale scroll.
//  3. Afbeelding zoals de beeld-modus van de Review: de eerste groot (± 16:9, contain, donkere achtergrond), miniaturen
//     eronder (tik = wissel), tik op de grote = lightbox (pijltjes, Escape). Een TradingView-snapshot telt als beeld.
//     Zonder afbeelding: "Plak of sleep hier een chart (Ctrl+V)", en plakken werkt. Dicht: een miniatuurtje in de rij.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 scenario-beeld';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TV = 'https://www.tradingview.com/x/AbC123/', TVPNG = 'https://s3.tradingview.com/snapshots/a/AbC123.png';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'A', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
// Zoals Zaratras' playbook op de screenshot: veel criteria en "Niet als", zodat de linkerkolom lang wordt.
const PB = Object.assign({}, H.PBOOK, { 'Trend-pullback': Object.assign({}, H.PBOOK['Trend-pullback'], {
  criteria: ['HTF-trend mee', 'Liquidity gepakt', 'Pullback naar 50% van de impuls', 'FVG op de 15M', 'Geen nieuws binnen 30 min', 'London of NY open', 'R:R minstens 2', 'Volume boven gemiddeld']
    .map((text, i) => ({ text, mandatory: i < 3 })),
  antiCriteria: ['Vlak voor nieuws', 'Na drie verliezers', 'Range zonder richting', 'Tegen de daily bias'].map(text => ({ text, mandatory: true })) }) });

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  await ctx.route(TVPNG, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(srv.TP, { waitUntil: 'load' });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: PB });
  await p.evaluate(s => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id), P = { v: 1, weeks: {}, days: {} };
    P.weeks[wid] = { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }], levels: 'BTC 78.150 weekly high', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' };
    P.days[id] = { id, week: wid, layers: [{ tf: '4H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }], levels: 'BTC 76.200 Asia-low', emoties: [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: '', scenarios: s };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, [
    sc({ id: 's_a', title: 'BTC trend-pullback', pb: 'Trend-pullback', trigger: 'Als 15M een BOS zet boven 76.200', invalid: '4H close onder 75.000', entry: L('15M', ['BOS'], ['FVG', 'OB'], 'Bullish'), stop: '75.020', tps: ['77.400', '78.150'], note: 'Niet vóór London open', media: { imgs: [], links: [TV] } }),
    sc({ id: 's_b', title: 'ETH zonder chart', pair: 'ETH', pb: 'Trend-pullback', entry: L('15M', [], ['FVG']), stop: '3.410', tps: ['3.520'] })]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  // Twee echte afbeeldingen bij s_a, via de gewone weg (verkleinen + IndexedDB tp3/img). Een nep-chart, zodat de
  // screenshots iets laten zien.
  const chart = (doel, kleur) => p.evaluate(async ([doel, kleur]) => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#131722'; g.fillRect(0, 0, 1600, 900); let y = 600; for (let i = 0; i < 80; i++) { const n = y + (Math.sin(i / 5) * 40) - i * 3 + (i % 7) * 6; g.fillStyle = n < y ? kleur : '#ef5350'; g.fillRect(40 + i * 19, Math.min(y, n), 12, Math.max(4, Math.abs(n - y))); y = n; }
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); return __tp3.voegBeeldToe(new File([bl], 'chart.png', { type: 'image/png' }), doel); }, [doel, kleur]);
  const ids = [await chart('scen:s_a', '#26a69a'), await chart('scen:s_a', '#42a5f5')];
  ok('voorbereiding: twee afbeeldingen en een TradingView-link bij s_a', ids.every(Boolean) && await p.evaluate(() => { const s = __tp3.dayOf(__tp3.vandaag()).scenarios[0]; return s.media.imgs.length === 2 && s.media.links.length === 1; }));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const open = async sid => { if (!(await p.evaluate(sid => !!document.querySelector(`.ritem[data-s="${sid}"] .rdetail`), sid))) await p.click(`.ritem[data-s="${sid}"] .rrow`); await p.waitForTimeout(120); };
  const dicht = async sid => { if (await p.evaluate(sid => !!document.querySelector(`.ritem[data-s="${sid}"] .rdetail`), sid)) await p.click(`.ritem[data-s="${sid}"] .rrow`); await p.waitForTimeout(80); };
  const rect = (sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
  const breed = async w => { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(150); };

  console.log('--- 1. breder ---');
  await breed(1680);
  const kol = async () => p.evaluate(() => { const c = document.querySelector('.cockpit'), [a, b] = [...c.children].map(x => x.getBoundingClientRect()); return { links: Math.round(a.width), rechts: Math.round(b.width), pagina: Math.round(c.getBoundingClientRect().width) }; });
  let k = await kol();
  ok('1680: de pagina is ± 1650 breed, de trechter 300–320, de scenario\'s krijgen de rest', k.pagina >= 1600 && k.links >= 290 && k.links <= 330 && k.rechts >= 1250, JSON.stringify(k));
  for (const tab of ['week', 'afsluiting', 'log']) { await p.click(`nav.tabs [data-v="${tab}"]`); await p.waitForTimeout(80);
    ok(`1680, ${tab}: dezelfde breedte als Dag (ronde 8)`, await p.evaluate(() => { const w = document.querySelector('#app .pagehead').getBoundingClientRect().width; return w >= 1600; })); }
  await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(80);
  await breed(1280); k = await kol();
  ok('1280: trechter 300–320, scenario\'s ≥ 880', k.links >= 290 && k.links <= 330 && k.rechts >= 880, JSON.stringify(k));

  console.log('--- 2. opbouw van het opengeklapte scenario ---');
  await open('s_a');
  const opb = () => p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_a"] .rdetail'), q = s => r.querySelector(s), box = e => e && e.getBoundingClientRect();
    const blok = [...r.querySelectorAll('.niveaus')].find(x => /Stop/.test(x.textContent) && /TP's/.test(x.textContent));
    return { beeld: !!q('.sbeeld'), kern: !!q('.kern'), plan: !!q('.rplan'), uitv: !!q('.ruitv'), stoptp: !!blok, beeldTop: Math.round(box(q('.sbeeld')).top), planTop: Math.round(box(q('.rplan')).top),
      planR: Math.round(box(q('.rplan')).right), uitvL: Math.round(box(q('.ruitv')).left), uitvTop: Math.round(box(q('.ruitv')).top), planB: Math.round(box(q('.rplan')).bottom),
      sticky: getComputedStyle(q('.rside')).position, kernL: Math.round(box(q('.kern')).left), beeldR: Math.round(box(q('.sbeeld')).right), kernTop: Math.round(box(q('.kern')).top), inUitv: ['[data-a="status"]', '[data-a="convert"]', '.etable'].every(s => !!q('.ruitv ' + s)), inPlan: ['.lagen', '[data-a="chk"]', '[data-a="critOpen"]'].every(s => !!q('.rplan ' + s)),
      kernTxt: q('.kern') ? q('.kern').innerText : '' }; });
  let o = await opb();
  ok('links de afbeelding met Plan eronder; rechts de kern naast de afbeelding', o.beeld && o.kern && o.plan && o.uitv && o.beeldTop < o.planTop && o.kernL >= o.beeldR && Math.abs(o.kernTop - o.beeldTop) < 30, JSON.stringify(o));
  ok('de kern: trigger, ongeldig als, en Stop en TP\'s in één blok', o.stoptp && /Als 15M een BOS/.test(o.kernTxt) && /4H close onder 75\.000/.test(o.kernTxt) && /75\.020/.test(o.kernTxt) && /77\.400 · 78\.150/.test(o.kernTxt), o.kernTxt);
  ok('links Plan (lagen, confirmations, criteria), rechts Uitvoering & edge (status, Zet om in trade, edge-tabel)', o.inPlan && o.inUitv, JSON.stringify(o));
  ok('1280: Uitvoering & edge rechts naast Plan, onder de kern', o.uitvL >= o.planR - 1 && o.uitvTop > o.kernTop, JSON.stringify(o));
  ok('de edge-tabel past in de rechterkolom (niets afgekapt)', await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_a"] .rside'), t = r.querySelector('.etable'); return !!t && t.getBoundingClientRect().right <= r.getBoundingClientRect().right + 1 && r.scrollWidth <= r.clientWidth + 1; }));
  ok('de rechterkolom (kern + uitvoering & edge) is sticky', o.sticky === 'sticky', o.sticky);
  await p.click('.ritem[data-s="s_a"] [data-a="critOpen"]'); await p.waitForTimeout(100);
  o = await opb();
  ok('criteria open: de linkerkolom is lang (8 criteria, 4× "Niet als")', o.planB - o.planTop > 600, JSON.stringify(o));
  // halverwege de criteria gescrold: de rechterkolom blijft in beeld, onder de kop
  const kop = (await rect('.top')).b;
  // halfway through the open scenario (between its top passing the header and its end): the right column stays put
  const mid = await p.evaluate(() => { const d = document.querySelector('.ritem[data-s="s_a"] .rdetail'), r = d.querySelector('.rside'), H = d.getBoundingClientRect().height, h = r.getBoundingClientRect().height;
    window.scrollTo(0, d.getBoundingClientRect().top + scrollY - 104 + (H - h) / 2); return { H: Math.round(H), h: Math.round(h), vh: innerHeight }; });
  await p.waitForTimeout(150);
  const u = await rect('.ritem[data-s="s_a"] .rside'), dt = await rect('.ritem[data-s="s_a"] .rdetail');
  ok('de rechterkolom past op het scherm (± 900 hoog) en het scenario is langer dan hij', mid.h <= mid.vh - 100 && mid.H - mid.h >= 150, JSON.stringify(mid));
  ok('halverwege het scenario gescrold: de rechterkolom staat nog onder de kop in beeld', u.t >= kop - 1 && u.t <= kop + 30 && dt.t <= kop - 60, JSON.stringify({ u, dt, kop }));
  await p.evaluate(() => { document.querySelector('.wrap').style.paddingBottom = ''; window.scrollTo(0, 0); });

  console.log('--- 3. de afbeelding ---');
  const groot = () => p.evaluate(() => { const g = document.querySelector('.ritem[data-s="s_a"] .sbeeld .groot'), i = g && g.querySelector('img'), r = g && g.getBoundingClientRect();
    return g ? { src: i.getAttribute('src'), fit: getComputedStyle(i).objectFit, ratio: +(r.width / r.height).toFixed(2), w: Math.round(r.width), bg: getComputedStyle(g).backgroundColor,
      mini: [...document.querySelectorAll('.ritem[data-s="s_a"] .sbeeld .strip [data-a="beeldSel"]')].length } : null; });
  let gb = await groot();
  const IMG0 = await p.evaluate(id => __tp3.IMG && __tp3.IMG[id], ids[0]);
  ok('bij openen staat de eerste afbeelding groot', !!gb && gb.src === IMG0, JSON.stringify(gb && { ...gb, src: (gb.src || '').slice(0, 30) }));
  ok('± 16:9, object-fit contain, minstens 500 breed op 1280', !!gb && gb.ratio >= 1.7 && gb.ratio <= 1.8 && gb.fit === 'contain' && gb.w >= 500, JSON.stringify(gb && { ...gb, src: '' }));
  ok('donkere achtergrond, ook in licht thema', !!gb && (() => { const m = gb.bg.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3 < 60; })(), gb && gb.bg);
  ok('miniaturen eronder: twee afbeeldingen + het TradingView-voorbeeld', !!gb && gb.mini === 3, String(gb && gb.mini));
  await p.click('.ritem[data-s="s_a"] .sbeeld .strip [data-a="beeldSel"][data-v="2"]'); await p.waitForTimeout(150);
  ok('tik op een miniatuur: die staat groot (hier het TradingView-voorbeeld)', (await groot()).src === TVPNG);
  await p.click('.ritem[data-s="s_a"] .sbeeld .strip [data-a="beeldSel"][data-v="1"]'); await p.waitForTimeout(120);
  const IMG1 = await p.evaluate(id => __tp3.IMG[id], ids[1]);
  ok('en terug naar de tweede afbeelding', (await groot()).src === IMG1);
  await p.click('.ritem[data-s="s_a"] .sbeeld .groot'); await p.waitForTimeout(150);
  const lb = () => p.evaluate(() => { const i = document.querySelector('.lb img'); return i ? { src: i.getAttribute('src'), tel: (document.querySelector('.lb').innerText.match(/\d+ \/ \d+/) || [''])[0] } : null; });
  let l = await lb();
  ok('tik op de grote: schermvullend (lightbox) met dezelfde afbeelding', !!l && l.src === IMG1 && l.tel === '2 / 3', JSON.stringify(l && { ...l, src: l.src.slice(0, 20) }));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100); l = await lb();
  ok('pijltje rechts: de volgende (het TradingView-voorbeeld)', !!l && l.src === TVPNG && l.tel === '3 / 3', JSON.stringify(l));
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100); l = await lb();
  ok('pijltje links twee keer: de eerste', !!l && l.src === IMG0 && l.tel === '1 / 3');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('Escape sluit de lightbox, het scenario staat nog open', !(await lb()) && await p.evaluate(() => !!document.querySelector('.ritem[data-s="s_a"] .rdetail')));

  console.log('--- zonder afbeelding: plakken ---');
  await open('s_b');
  ok('zonder afbeelding: een plek "Plak of sleep hier een chart (Ctrl+V)" met kiezen', await p.evaluate(() => { const v = document.querySelector('.ritem[data-s="s_b"] .sbeeld.leeg');
    return !!v && /Plak of sleep hier een chart \(Ctrl\+V\)/.test(v.innerText) && !!v.querySelector('input[type=file][data-doel="scen:s_b"]') && !!v.closest('.media'); }));
  await p.evaluate(async () => { const dt = new DataTransfer(), c = document.createElement('canvas'); c.width = 64; c.height = 36; c.getContext('2d').fillRect(0, 0, 64, 36);
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); dt.items.add(new File([bl], 'chart.png', { type: 'image/png' }));
    document.querySelector('.ritem[data-s="s_b"] .sbeeld').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 400)); });
  ok('geplakt: de afbeelding hoort bij s_b en staat meteen groot', await p.evaluate(() => { const s = __tp3.dayOf(__tp3.vandaag()).scenarios.find(x => x.id === 's_b'), g = document.querySelector('.ritem[data-s="s_b"] .sbeeld .groot img');
    return s.media.imgs.length === 1 && !!g && g.getAttribute('src') === __tp3.IMG[s.media.imgs[0]]; }));

  console.log('--- dichte rij: miniatuurtje ---');
  await dicht('s_a'); await dicht('s_b');
  ok('dicht: een miniatuurtje in de rij als er een afbeelding is', await p.evaluate(() => { const m = document.querySelector('.ritem[data-s="s_a"] .rrow img.rmini'); return !!m && m.getAttribute('src') === __tp3.IMG[__tp3.dayOf(__tp3.vandaag()).scenarios[0].media.imgs[0]] && m.getBoundingClientRect().width <= 72; }));
  ok('open: geen miniatuurtje in de rij (de grote staat eronder)', await (async () => { await open('s_a'); return p.evaluate(() => !document.querySelector('.ritem[data-s="s_a"] .rrow img.rmini')); })());

  console.log('--- smal ---');
  await breed(1000); await open('s_a');
  o = await opb();
  ok('onder ± 1100 px: één kolom (afbeelding, kern, plan, uitvoering & edge onder elkaar)', o.kernTop >= o.beeldTop + 100 && o.planTop > o.kernTop && o.uitvTop >= o.planB - 1, JSON.stringify(o));
  await breed(390);
  ok('390: geen horizontale scroll, met het scenario open', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await breed(1280);

  console.log('--- screenshots: licht/donker × 1280/1680/390, met en zonder afbeelding, criteria open ---');
  const SHOT = async (naam, voor) => { for (const donker of [false, true]) { await H.thema(p, donker); for (const w of [1280, 1680, 390]) { await breed(w); await voor(); await p.waitForTimeout(200);
    await p.evaluate(sid => { const r = document.querySelector(`.ritem[data-s="${sid}"]`); window.scrollTo(0, r ? r.getBoundingClientRect().top + scrollY - 110 : 0); }, naam === 'zonder' ? 's_b' : 's_a');
    await p.screenshot({ path: `${H.SHOTS}/ronde4-${naam}-${donker ? 'donker' : 'licht'}-${w}.png` });
    if (w === 390) ok(`${donker ? 'donker' : 'licht'} 390 (${naam}): geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); } } await breed(1280); await H.thema(p, false); };
  await p.evaluate(() => { const s = __tp3.dayOf(__tp3.vandaag()).scenarios.find(x => x.id === 's_b'); s.media.imgs = []; __tp3.save(); });
  await SHOT('met', async () => { await open('s_a'); });
  await SHOT('zonder', async () => { await open('s_b'); });
  await SHOT('criteria', async () => { await open('s_a'); if (await p.evaluate(() => document.querySelector('.ritem[data-s="s_a"] [data-a="critOpen"]').getAttribute('aria-expanded') === 'false')) await p.click('.ritem[data-s="s_a"] [data-a="critOpen"]'); });

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
