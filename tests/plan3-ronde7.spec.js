// TradingPlan v3 ronde 7 (docs/plan-v3-ronde7-2026-10-31.md): charts al in het scenario-venster.
//  - Nieuw scenario: afbeelding kiezen en plakken (ook met de cursor in een tekstveld) en een link toevoegen; pas bij
//    Bewaar hangen ze aan het scenario. Annuleer laat niets achter, ook niet in IndexedDB tp3.
//  - Bewerken: weghalen + Annuleer = niets weg; weghalen + Bewaar = weg, ook uit IndexedDB.
//  - De grens van een scenario (4) en een link zonder http(s) worden geweigerd; vol = knop uit met uitleg.
//  - Daarna "Zet om in trade" → Nieuwe trade invullen neemt ze mee.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 ronde 7';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TV = 'https://www.tradingview.com/x/AbC123/';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' });
  const DAG = await p.evaluate(() => __tp3.vandaag());
  await H.zaaiJournal(p, { trades: [], pbook: H.PBOOK });
  await p.evaluate(d => { const P = { v: 1, weeks: {}, days: {} };
    P.days[d] = { id: d, week: __tp3.isoWeek(d), layers: [], levels: '', emoties: [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: '', scenarios: [], volgorde: [], eigen: false };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, DAG);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const sleutels = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('tp3', 1); r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => { const q = r.result.transaction('img', 'readonly').objectStore('img').getAllKeys(); q.onsuccess = () => { r.result.close(); res(q.result.map(String).sort()); }; }; }));
  const scens = () => p.evaluate(() => __tp3.load().days[__tp3.vandaag()].scenarios);
  const teller = () => p.evaluate(() => ((document.querySelector('#modal .scenvorm .media .enote') || {}).textContent || '').trim());
  const melding = () => p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  const kies = async (n = 1) => { await p.setInputFiles('#modal input[type="file"][data-doel="draft"]', Array.from({ length: n }, (_, i) => ({ name: `c${i}.png`, mimeType: 'image/png', buffer: PNG }))); await p.waitForTimeout(250 + n * 80); };
  const plakBeeld = sel => p.evaluate(async sel => { const dt = new DataTransfer(), c = document.createElement('canvas'); c.width = 64; c.height = 36; c.getContext('2d').fillRect(0, 0, 64, 36);
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); dt.items.add(new File([bl], 'chart.png', { type: 'image/png' }));
    const el = document.querySelector(sel); el.focus(); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 300)); }, sel);
  const link = async u => { await p.fill('#modal .scenvorm .linkinp', u); await p.press('#modal .scenvorm .linkinp', 'Enter'); await p.waitForTimeout(100); };

  console.log('--- nieuw scenario: charts in het venster ---');
  const voor = await sleutels();
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(120);
  const blok = await p.evaluate(() => { const m = document.querySelector('#modal .scenvorm .media'), note = document.getElementById('sc-note');
    return { er: !!m, onderNotitie: !!m && !!note && !!(note.compareDocumentPosition(m) & 4), kop: !!m && /Charts/.test(m.closest('.full').textContent), knop: !!(m && m.querySelector('label.btn input[type=file]')) }; });
  ok('blok Charts in de linkerkolom, onder Notitie, met "+ Afbeelding", linkveld en "+ Link"', blok.er && blok.onderNotitie && blok.kop && blok.knop, JSON.stringify(blok));
  ok('teller: "0/4 afbeeldingen · 0/4 links"', /^0\/4 afbeeldingen · 0\/4 links/.test(await teller()), await teller());
  await p.fill('#sc-title', 'Met charts'); await kies(1);
  await plakBeeld('#sc-title');
  ok('afbeelding plakken met de cursor in een tekstveld: naar Charts, de titel blijft', await p.evaluate(() => document.getElementById('sc-title').value) === 'Met charts' && /^2\/4 afbeeldingen/.test(await teller()), await teller());
  await link(TV);
  ok('link plakken in het linkveld en Enter: erbij', /^2\/4 afbeeldingen · 1\/4 links/.test(await teller()), await teller());
  ok('miniaturen met × en de link met × in het venster', await p.evaluate(() => document.querySelectorAll('#modal .scenvorm .thumb [data-a="rmBeeld"]').length === 2 && document.querySelectorAll('#modal .scenvorm [data-a="rmLink"]').length === 1));
  ok('nog niets aan een scenario gehangen (concept)', (await scens()).length === 0);
  await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(200);
  let s = (await scens())[0];
  ok('Bewaar: het scenario heeft 2 afbeeldingen en 1 link', !!s && s.media.imgs.length === 2 && JSON.stringify(s.media.links) === JSON.stringify([TV]), JSON.stringify(s && s.media));
  ok('en ze staan in IndexedDB tp3', JSON.stringify(await sleutels()) === JSON.stringify([...voor, ...s.media.imgs].sort()));
  await p.click(`.ritem[data-s="${s.id}"] .rrow`); await p.waitForTimeout(120);
  ok('opengeklapt: de eerste groot in de chart-plek', await p.evaluate(id => { const g = document.querySelector(`.ritem[data-s="${id}"] .sbeeld .groot img`); return !!g && g.getAttribute('src') === __tp3.IMG[__tp3.load().days[__tp3.vandaag()].scenarios[0].media.imgs[0]]; }, s.id));
  const naBewaar = await sleutels();

  console.log('--- Annuleer laat niets achter ---');
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(100); await kies(2); await link('https://example.com/x');
  ok('in het concept: 2 afbeeldingen (al verkleind in IndexedDB)', /^2\/4 afbeeldingen/.test(await teller()), await teller());
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(250);
  ok('Annuleer: geen scenario erbij en geen nieuwe sleutels in tp3', (await scens()).length === 1 && JSON.stringify(await sleutels()) === JSON.stringify(naBewaar), JSON.stringify((await sleutels()).length));
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(100); await kies(1); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok('Escape: idem', (await scens()).length === 1 && JSON.stringify(await sleutels()) === JSON.stringify(naBewaar));
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(100); await kies(1); await p.mouse.click(5, 5); await p.waitForTimeout(250);
  ok('klik naast het venster: idem', (await scens()).length === 1 && JSON.stringify(await sleutels()) === JSON.stringify(naBewaar));

  console.log('--- bewerken ---');
  s = (await scens())[0]; const eerste = s.media.imgs[0];
  await p.click(`.ritem[data-s="${s.id}"] .rtools [data-a="editScen"]`); await p.waitForTimeout(120);
  ok('bewerken: de bestaande afbeeldingen en link staan in het venster', /^2\/4 afbeeldingen · 1\/4 links/.test(await teller()), await teller());
  await p.click(`#modal .scenvorm .thumb[data-i="${eerste}"] [data-a="rmBeeld"]`); await p.click('#modal .scenvorm [data-a="rmLink"]'); await p.waitForTimeout(100);
  ok('weghalen in het venster: de teller zakt', /^1\/4 afbeeldingen · 0\/4 links/.test(await teller()), await teller());
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(200);
  s = (await scens())[0];
  ok('weghalen + Annuleer: niets weg (scenario en IndexedDB)', s.media.imgs.length === 2 && s.media.links.length === 1 && (await sleutels()).includes(eerste));
  await p.click(`.ritem[data-s="${s.id}"] .rtools [data-a="editScen"]`); await p.waitForTimeout(120);
  await p.click(`#modal .scenvorm .thumb[data-i="${eerste}"] [data-a="rmBeeld"]`); await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(250);
  s = (await scens())[0];
  ok('weghalen + Bewaar: weg uit het scenario en uit IndexedDB', s.media.imgs.length === 1 && !s.media.imgs.includes(eerste) && !(await sleutels()).includes(eerste));

  console.log('--- grenzen en fouten ---');
  await p.click(`.ritem[data-s="${s.id}"] .rtools [data-a="editScen"]`); await p.waitForTimeout(120);
  await kies(3);
  ok('vol (4/4): "+ Afbeelding" staat uit, met uitleg', await p.evaluate(() => { const m = document.querySelector('#modal .scenvorm .media'), i = m.querySelector('input[type=file]'); return i.disabled && /hooguit 4 afbeeldingen per scenario/i.test(m.textContent); }) && /^4\/4 afbeeldingen/.test(await teller()), await teller());
  await plakBeeld('#sc-note');
  ok('een vijfde (plakken) wordt geweigerd met een melding', /^4\/4 afbeeldingen/.test(await teller()) && /Hooguit 4 afbeeldingen/.test(await melding()), await melding());
  await link('javascript:alert(1)');
  ok('een link zonder http(s) wordt geweigerd met een melding', /^4\/4 afbeeldingen · 1\/4 links/.test(await teller()) && /Alleen http\(s\)-links/.test(await melding()), await melding());
  await p.setInputFiles('#modal .scenvorm input[type="file"]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('geen beeld') }).catch(() => {});
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(250);
  ok('na Annuleer: de drie nieuwe zijn weer weg uit IndexedDB', (await scens())[0].media.imgs.length === 1 && (await sleutels()).length === naBewaar.length - 1, String((await sleutels()).length));
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(100);
  await p.setInputFiles('#modal input[type="file"][data-doel="draft"]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('geen beeld') }); await p.waitForTimeout(150);
  ok('geen afbeelding gekozen: de bestaande melding', /Alleen afbeeldingen/.test(await melding()), await melding());
  await p.click('#modal [data-a="close"]');

  console.log('--- daarna: Zet om in trade → Nieuwe trade invullen ---');
  s = (await scens())[0];
  await p.click(`.ritem[data-s="${s.id}"] [data-a="convert"]`); await p.waitForTimeout(100); await p.click('#modal [data-a="convWeg"][data-v="hand"]'); await p.waitForTimeout(80);
  ok('het venster zegt wat er meegaat', /^1 afbeelding en 1 link gaan mee naar de trade/.test(await p.evaluate(() => (document.querySelector('#modal .meeregel') || {}).textContent || '')));
  await p.evaluate(() => localStorage.setItem('sj_welcomed', 'true'));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#modal [data-a="naarFormulier"]')]); await p.waitForTimeout(1500);
  const f = await p.evaluate(() => ({ shots: formShots.length, links: formTvLinks.slice() }));
  ok('de nieuwe trade krijgt de afbeelding en de link', f.shots === 1 && JSON.stringify(f.links) === JSON.stringify([TV]), JSON.stringify(f));
  await p.goto(srv.TP, { waitUntil: 'load' }); await p.waitForTimeout(400);

  console.log('--- telefoon en screenshots ---');
  await p.setViewportSize({ width: 390, height: 860 });
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(120);
  const tel = await p.evaluate(() => { const m = document.querySelector('#modal .modal'), k = document.querySelector('#modal .scenvorm .media label.btn').getBoundingClientRect(), l = document.querySelector('#modal .scenvorm [data-a="linkToe"]').getBoundingClientRect();
    return { scroll: m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1, k: Math.round(k.height), l: Math.round(l.height) }; });
  ok('390: geen horizontale scroll, knoppen minstens 36 px hoog', !tel.scroll && tel.k >= 36 && tel.l >= 36, JSON.stringify(tel));
  await p.click('#modal [data-a="close"]'); await p.setViewportSize({ width: 1280, height: 900 });
  const VENSTER = async (naam, open) => { for (const donker of [false, true]) { await H.thema(p, donker); for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(120); await open();
    await p.waitForTimeout(150); if (w === 390) await p.evaluate(() => { const m = document.querySelector('#modal .modal'); const c = m.querySelector('.scenvorm .media'); if (c) m.scrollTop = c.getBoundingClientRect().top + m.scrollTop - 220; });
    await p.screenshot({ path: `${H.SHOTS}/ronde7-${naam}-${donker ? 'donker' : 'licht'}-${w}.png` }); await p.click('#modal [data-a="close"]').catch(() => {}); await p.waitForTimeout(150); } } await p.setViewportSize({ width: 1280, height: 900 }); await H.thema(p, false); };
  await VENSTER('leeg', async () => { await p.click('[data-a="newScen"]'); });
  await VENSTER('met', async () => { await p.click('[data-a="newScen"]'); await p.fill('#sc-title', 'Met twee charts'); await kies(2); await link(TV); });
  await VENSTER('bewerken', async () => { const id = (await scens())[0].id; if (!(await p.evaluate(id => !!document.querySelector(`.ritem[data-s="${id}"] .rdetail`), id))) await p.click(`.ritem[data-s="${id}"] .rrow`); await p.click(`.ritem[data-s="${id}"] .rtools [data-a="editScen"]`); });
  ok('na alle screenshots (telkens Annuleer): niets achtergebleven in tp3', (await sleutels()).length === naBewaar.length - 1, String((await sleutels()).length));

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
