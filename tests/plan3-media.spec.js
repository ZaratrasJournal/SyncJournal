// TradingPlan v3, taak 5: afbeeldingen en links in dag, week en scenario.
//  (a) plakken op het Dag-scherm → bij het openstaande scenario, anders bij de dag; op het Week-scherm bij de week
//  (b) "+ Afbeelding" (bestand kiezen) en slepen werken ook
//  (c) een TradingView-snapshotlink krijgt een voorbeeldplaatje; lukt laden niet, dan een chip met het korte adres
//  (d) javascript: en tekst zonder http(s) worden geweigerd met een melding
//  (e) de 9e afbeelding of link op een dag, of de 5e op een scenario: "Hooguit 8 …" / "Hooguit 4 …"
//  (f) klik → lightbox; weghalen wist het plaatje ook uit IndexedDB tp3 · (g) na herladen staat alles er nog
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 media';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TV = 'https://www.tradingview.com/x/AbC123/', TV2 = 'https://www.tradingview.com/x/ZzZ999/';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  const snap = []; await p.route('https://s3.tradingview.com/snapshots/a/AbC123.png', r => { snap.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await p.goto(srv.TP, { waitUntil: 'load' });
  await p.evaluate(() => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id), P = __tp3.load(), m = () => ({ imgs: [], links: [] });
    P.weeks[wid] = { id: wid, layers: [], levels: '', noTrade: '', focus: '', media: m(), les: '' };
    P.days[id] = { id, week: wid, layers: [], levels: '', mental: null, pre: [false, false, false], media: m(), les: '', scenarios: [
      { id: 's_a', title: 'Scenario A', pair: 'BTC', dir: 'long', pb: '', grade: 'A', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], stop: '', tps: [], media: m(), note: '', status: 'open', statusTs: null, trades: [] }] };
    __tp3.save(P); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  // plak-event met een afbeelding of tekst, zoals Ctrl/Cmd+V het stuurt
  const plak = (wat, sel) => p.evaluate(async ([wat, sel]) => { const dt = new DataTransfer();
    if (wat === 'beeld') { const c = document.createElement('canvas'); c.width = 60; c.height = 40; c.getContext('2d').fillRect(0, 0, 60, 40); const bl = await new Promise(r => c.toBlob(r, 'image/png')); dt.items.add(new File([bl], 'chart.png', { type: 'image/png' })); }
    else dt.setData('text/plain', wat);
    (sel ? document.querySelector(sel) : document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 250)); }, [wat, sel || null]);
  const dag = () => p.evaluate(() => __tp3.dayOf(__tp3.vandaag()));
  const wk = () => p.evaluate(() => __tp3.load().weeks[__tp3.isoWeek(__tp3.vandaag())]);
  const melding = () => p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');

  console.log('--- (a) plakken ---');
  await plak('beeld');
  let d = await dag();
  ok('plakken zonder open scenario → bij de dag', d.media.imgs.length === 1 && d.scenarios[0].media.imgs.length === 0, JSON.stringify(d.media));
  ok('id "i_…", in de dag alleen het id', /^i_[0-9a-z]+$/.test(d.media.imgs[0]));
  ok('het plaatje staat verkleind als JPEG in IndexedDB tp3/img', await p.evaluate(id => __tp3.imgLees(id).then(v => typeof v === 'string' && v.startsWith('data:image/jpeg')), d.media.imgs[0]));
  await p.click('.ritem[data-s="s_a"] .rrow'); await p.waitForTimeout(100);
  await plak('beeld');
  d = await dag();
  ok('plakken met een open scenario → bij dat scenario', d.scenarios[0].media.imgs.length === 1 && d.media.imgs.length === 1);
  ok('plakken in een tekstveld plakt gewoon tekst', await p.evaluate(async () => { const t = document.getElementById('d-levels'); t.focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'https://example.com'); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); t.dispatchEvent(ev); await new Promise(r => setTimeout(r, 100)); return !ev.defaultPrevented && __tp3.dayOf(__tp3.vandaag()).media.links.length === 0; }));
  await p.click('nav.tabs [data-v="week"]'); await p.waitForTimeout(100);
  await plak('beeld');
  ok('plakken op het Week-scherm → bij de week', (await wk()).media.imgs.length === 1);

  console.log('--- (b) knop en slepen ---');
  await p.setInputFiles('.media[data-doel^="week"] input[type=file]', { name: 'b.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(300);
  ok('"+ Afbeelding" op de week', (await wk()).media.imgs.length === 2);
  await p.evaluate(async () => { const dt = new DataTransfer(); const c = document.createElement('canvas'); c.width = 10; c.height = 10; const bl = await new Promise(r => c.toBlob(r, 'image/png')); dt.items.add(new File([bl], 'd.png', { type: 'image/png' }));
    const el = document.querySelector('.media[data-doel^="week"]'); el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 300)); });
  ok('slepen op de week', (await wk()).media.imgs.length === 3);
  await p.setInputFiles('.media[data-doel^="week"] input[type=file]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hoi') }); await p.waitForTimeout(200);
  ok('geen afbeelding (tekstbestand) → geweigerd met melding', (await wk()).media.imgs.length === 3 && /afbeelding/i.test(await melding()), await melding());
  await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(100);
  await p.setInputFiles('.media[data-doel^="dag"] input[type=file]', { name: 'c.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(300);
  ok('"+ Afbeelding" op de dag', (await dag()).media.imgs.length === 2);

  console.log('--- (c) links ---');
  await p.click('.ritem[data-s="s_a"] .rrow'); await p.waitForTimeout(80);   // scenario dicht → plakken gaat naar de dag
  await plak(TV); await p.waitForTimeout(400);
  d = await dag();
  ok('TradingView-link bij de dag', d.media.links.join() === TV, JSON.stringify(d.media.links));
  ok('tvSnapshot geeft het voorbeeldplaatje', await p.evaluate(u => __tp3.tvSnapshot(u), TV) === 'https://s3.tradingview.com/snapshots/a/AbC123.png');
  ok('tvSnapshot van een gewone link: null', await p.evaluate(() => __tp3.tvSnapshot('https://example.com/x/AbC123/')) === null);
  const prev = await p.evaluate(() => { const i = document.querySelector('.media[data-doel^="dag"] .tvprev img'); return i && { src: i.getAttribute('src'), w: i.naturalWidth }; });
  ok('voorbeeldplaatje geladen', prev && prev.src === 'https://s3.tradingview.com/snapshots/a/AbC123.png' && prev.w > 0 && snap.length >= 1, JSON.stringify(prev));
  await p.fill('.media[data-doel^="dag"] .linkinp', TV2); await p.click('.media[data-doel^="dag"] [data-a="linkToe"]'); await p.waitForTimeout(500);
  const chip = await p.evaluate(() => [...document.querySelectorAll('.media[data-doel^="dag"] .lchip')].map(x => x.textContent.trim()));
  ok('laden mislukt → chip met tradingview.com/x/ZzZ999/', chip.some(t => /tradingview\.com\/x\/ZzZ999\//.test(t)), JSON.stringify(chip));
  await p.fill('.media[data-doel^="dag"] .linkinp', 'https://example.com/a"onmouseover="alert(1)'); await p.click('.media[data-doel^="dag"] [data-a="linkToe"]'); await p.waitForTimeout(150);
  ok('gewone link: chip met het korte adres, aanhalingstekens ge-escaped', await p.evaluate(() => !document.querySelector('[onmouseover]') && [...document.querySelectorAll('.lchip')].some(x => /example\.com\/a/.test(x.textContent))));

  console.log('--- (d) weigeren ---');
  const voor = (await dag()).media.links.length;
  await plak('javascript:alert(1)');
  ok('javascript: geweigerd met melding', (await dag()).media.links.length === voor && /http/i.test(await melding()), await melding());
  await plak('gewoon wat tekst');
  ok('tekst zonder http(s) geweigerd met melding', (await dag()).media.links.length === voor && /http/i.test(await melding()));
  await p.fill('.media[data-doel^="dag"] .linkinp', '<script>alert(1)</script>'); await p.click('.media[data-doel^="dag"] [data-a="linkToe"]'); await p.waitForTimeout(100);
  ok('<script> in het linkveld geweigerd', (await dag()).media.links.length === voor);

  console.log('--- (e) grenzen ---');
  for (let i = (await dag()).media.imgs.length; i < 8; i++) await plak('beeld');
  ok('8 afbeeldingen op de dag', (await dag()).media.imgs.length === 8);
  await plak('beeld');
  ok('de 9e geweigerd: "Hooguit 8 afbeeldingen"', (await dag()).media.imgs.length === 8 && /Hooguit 8 afbeeldingen/.test(await melding()), await melding());
  for (let i = (await dag()).media.links.length; i < 8; i++) await plak('https://example.com/' + i);
  await plak('https://example.com/negen');
  ok('de 9e link geweigerd: "Hooguit 8 links"', (await dag()).media.links.length === 8 && /Hooguit 8 links/.test(await melding()), await melding());
  await p.click('.ritem[data-s="s_a"] .rrow'); await p.waitForTimeout(80);
  for (let i = 1; i < 4; i++) await plak('beeld');
  ok('4 afbeeldingen op het scenario', (await dag()).scenarios[0].media.imgs.length === 4);
  await plak('beeld');
  ok('de 5e op een scenario geweigerd: "Hooguit 4 afbeeldingen"', (await dag()).scenarios[0].media.imgs.length === 4 && /Hooguit 4 afbeeldingen/.test(await melding()), await melding());
  for (let i = 0; i < 4; i++) await plak('https://example.com/s' + i);
  await plak('https://example.com/s5');
  ok('de 5e link op een scenario geweigerd: "Hooguit 4 links"', (await dag()).scenarios[0].media.links.length === 4 && /Hooguit 4 links/.test(await melding()));
  await H.vierShots(p, 'media', async q => { await q.click('.ritem[data-s="s_a"] .rrow'); await q.waitForTimeout(250); });

  console.log('--- (f) lightbox en weghalen ---');
  await p.click('.ritem[data-s="s_a"] .rrow'); await p.waitForTimeout(150);
  const eerste = (await dag()).scenarios[0].media.imgs[0];
  // round 4: an open scenario shows its first image big (plan3-scenario-beeld); a click on it opens the lightbox
  await p.click('.ritem[data-s="s_a"] .sbeeld .groot'); await p.waitForTimeout(120);
  ok('klik → lightbox met het plaatje', await p.evaluate(() => { const i = document.querySelector('.lb img'); return !!i && i.src.startsWith('data:image/'); }));
  await p.screenshot({ path: H.SHOTS + '/media-lightbox-licht-1280.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok('Escape sluit de lightbox', await p.evaluate(() => !document.querySelector('.lb')));
  await p.click('.ritem[data-s="s_a"] .sbeeld .groot'); await p.waitForTimeout(100);
  await p.click(`.lb [data-a="rmBeeld"][data-v="${eerste}"]`); await p.waitForTimeout(250);   // "Haal weg" in the lightbox
  ok('weghalen: uit het scenario', !(await dag()).scenarios[0].media.imgs.includes(eerste));
  ok('weghalen: ook uit IndexedDB', await p.evaluate(id => __tp3.imgLees(id).then(v => v === undefined), eerste));
  const link0 = (await dag()).scenarios[0].media.links[0];
  await p.click(`.ritem[data-s="s_a"] [data-a="rmLink"][data-v="${link0}"]`); await p.waitForTimeout(100);
  ok('link weghalen', !(await dag()).scenarios[0].media.links.includes(link0));

  console.log('--- (g) na herladen ---');
  const voorH = await dag();
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const na = await dag();
  ok('na herladen: zelfde aantallen', na.media.imgs.length === voorH.media.imgs.length && na.scenarios[0].media.imgs.length === 3 && na.media.links.length === 8);
  ok('na herladen: de plaatjes van de dag staan in beeld', await p.evaluate(() => [...document.querySelectorAll('.media[data-doel^="dag"] .thumb img')].filter(i => i.src.startsWith('data:image/jpeg')).length === 8));
  await p.click('.ritem[data-s="s_a"] .rrow'); await p.click('.ritem[data-s="s_a"] [data-a="editScen"]'); await p.click('#modal [data-a="delScen"]'); await p.waitForTimeout(300);
  ok('scenario verwijderen wist ook zijn plaatjes uit IndexedDB', await p.evaluate(ids => Promise.all(ids.map(__tp3.imgLees)).then(v => v.every(x => x === undefined)), na.scenarios[0].media.imgs));
  const sc = await H.vierShots(p, 'media-dag', null);
  ok('390 breed: geen horizontale scroll (licht en donker)', !sc.licht && !sc.donker, JSON.stringify(sc));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
