// Borgt de FAQ-pagina (variant B "tegels", demos/faq-demo.html): zoekveld + tegels per onderwerp,
// één onderwerp tegelijk met een weg terug, live zoeken over alle onderwerpen (vraag + antwoord,
// ook "Mori" én "AI-coach"), een lege zoekstaat, het blok "Van de maker" (Zaratras), de
// "Lees mijn visie"-links, leesbare antwoorden (alinea's, kort antwoord), dat de tekst van FAQS
// woord voor woord in beeld komt, en dat elk "Instellingen → X" uit de FAQ als tab bestaat.
// Licht, donker en 390px.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} go('faq'); });
  await p.waitForTimeout(300);
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));
  const zichtbaar = sel => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null).length, sel);

  console.log('─── Overzicht: zoekveld + tegels ───');
  const telling = await p.evaluate(() => ({ cats: FAQS.length, vragen: FAQS.reduce((n, c) => n + c[1].length, 0), dom: document.querySelectorAll('details.faq').length, secties: document.querySelectorAll('.faqcat').length }));
  ok('10 categorieën en alle vragen in de DOM (gelijk aan FAQS)', telling.cats === 10 && telling.secties === 10 && telling.dom === telling.vragen && telling.vragen >= 55, JSON.stringify(telling));
  ok('zoekveld zichtbaar', await zichtbaar('.faqhero #faqQ') === 1);
  const tegels = await p.evaluate(() => [...document.querySelectorAll('.faqtile')].map(t => ({ ci: +t.dataset.ci, n: t.querySelector('.tc').textContent, naam: t.querySelector('.tn').textContent, uitleg: t.querySelector('.td').textContent })));
  ok('9 tegels: elk onderwerp behalve de visie', tegels.length === 9 && !tegels.some(t => /visie/i.test(t.naam)), tegels.map(t => t.naam).join(', '));
  ok('elke tegel toont het juiste aantal vragen', await p.evaluate(t => t.every(x => x.n.startsWith(FAQS[x.ci][1].length + ' vragen')), tegels));
  ok('elke tegel heeft een korte uitleg', tegels.every(t => t.uitleg.length > 10));
  ok('volgorde: Aan de slag eerst, problemen laatst', /Aan de slag/.test(tegels[0].naam) && /problemen/i.test(tegels[8].naam));
  ok('populaire vragen: 6 stuks', await zichtbaar('.faqpop li button') === 6);
  ok('in het overzicht zijn de vragen zelf nog dicht en verborgen', await zichtbaar('details.faq') === 0);

  console.log('─── Tegel → onderwerp → terug ───');
  await p.click('.faqtile[data-ci="5"]'); await p.waitForTimeout(150);
  const cat = await p.evaluate(() => ({ kop: document.activeElement.textContent, zichtbaar: [...document.querySelectorAll('.faqcat')].filter(s => !s.hidden).map(s => s.dataset.ci), rijen: [...document.querySelectorAll('#faqc-5 details.faq')].filter(d => d.offsetParent).length, tegels: document.getElementById('faqHome').hidden }));
  ok('klik op tegel toont alleen die categorie, met al zijn vragen', cat.zichtbaar.join() === '5' && cat.rijen === await p.evaluate(() => FAQS[5][1].length) && cat.tegels, JSON.stringify(cat));
  ok('focus springt naar de kop van het onderwerp', /Analytics begrijpen/.test(cat.kop), cat.kop);
  await p.click('#faqc-5 .faqback'); await p.waitForTimeout(150);
  ok('"Alle onderwerpen" brengt je terug naar de tegels, focus op de tegel van waar je kwam', await p.evaluate(() => !document.getElementById('faqHome').hidden && [...document.querySelectorAll('.faqcat')].every(s => s.hidden) && document.activeElement.dataset.ci === '5'));
  await p.focus('.faqtile[data-ci="2"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('toetsenbord: Enter op een tegel opent het onderwerp', await p.evaluate(() => !document.getElementById('faqc-2').hidden));
  await p.focus('#faqc-2 details.faq summary'); await p.keyboard.press('Enter');
  ok('toetsenbord: Enter op een vraag klapt hem open', await p.evaluate(() => document.querySelector('#faqc-2 details.faq').open));
  await p.click('#faqc-2 .faqother .faqchip'); await p.waitForTimeout(100);
  ok('"Andere onderwerpen" wisselt van onderwerp', await p.evaluate(() => [...document.querySelectorAll('.faqcat')].filter(s => !s.hidden).length === 1 && document.getElementById('faqc-2').hidden));
  await p.evaluate(() => faqHome());
  await p.click('.faqpop li button'); await p.waitForTimeout(150);
  ok('populaire vraag opent het onderwerp mét die vraag open', await p.evaluate(() => { const d = document.querySelector('details.faq[open]'); return !!d && /eerste trade/.test(d.textContent) && !d.closest('.faqcat').hidden; }));
  await p.evaluate(() => faqHome());

  console.log('─── Leesbare antwoorden ───');
  const fmt = await p.evaluate(() => {
    const maker = FAQS.findIndex(c => c[1].some(x => (x[2] || '').startsWith('visie-')));
    const help = [...document.querySelectorAll('.faqcat')].filter(s => +s.dataset.ci !== maker).flatMap(s => [...s.querySelectorAll('.faq-a')]);
    return { brs: document.querySelectorAll('.faq-a br').length, zonderKort: help.filter(a => !a.firstElementChild || !a.firstElementChild.classList.contains('faqkort')).length, n: help.length,
      grootte: getComputedStyle(help[0]).fontSize, kleur: getComputedStyle(help[0]).color === getComputedStyle(document.body).color };
  });
  ok('geen <br> meer in de antwoorden: echte alinea\'s', fmt.brs === 0, fmt.brs + ' gevonden');
  ok('elk helpdesk-antwoord begint met een vet kort antwoord', fmt.zonderKort === 0, fmt.zonderKort + ' van ' + fmt.n);
  ok('antwoordtekst 15px in de gewone tekstkleur', fmt.grootte === '15px' && fmt.kleur, JSON.stringify(fmt));
  ok('inline stappen "(1) … (2) …" worden een genummerde lijst', await p.evaluate(() => [...document.querySelectorAll('.faq-a ol')].some(o => /Doe/.test(o.textContent) && /Vermijd/.test(o.textContent))));
  const woorden = await p.evaluate(() => {
    const norm = h => faqPlain(h).replace(/\(\d\)/g, ' ').replace(/\s+/g, ' ').trim();
    const mis = [];
    FAQS.forEach(([, items], ci) => items.forEach(([q, a], qi) => {
      const d = [...document.querySelectorAll(`#faqc-${ci} details.faq`)][qi];
      const vis = d.querySelector('.faq-a').textContent.replace(/\(\d\)/g, ' ').replace(/\s+/g, ' ').trim();
      const want = norm(a).replace(/ /g, ''), got = vis.replace(/ /g, '');
      if (d.querySelector('.faqq').textContent !== q || got !== want) mis.push(q);
    }));
    return mis;
  });
  ok('elke vraag en elk antwoord staat woord voor woord zoals in FAQS', woorden.length === 0, woorden.slice(0, 3).join(' | '));

  console.log('─── Van de maker ───');
  const mk = await p.evaluate(() => ({ teaser: document.querySelector('#faqHome .faqmaker')?.textContent || '', ids: ['visie-waarom', 'visie-voorwie', 'visie-tags', 'visie-playbook', 'visie-review'].every(id => !!document.getElementById('faq-' + id)) }));
  ok('overzicht heeft het blok "Van de maker", ondertekend Zaratras', /Van de maker/.test(mk.teaser) && /Zaratras/.test(mk.teaser));
  ok('visie-categorie heeft de vijf waarom-vragen', mk.ids);
  await p.click('#faqHome .faqmaker .linklike'); await p.waitForTimeout(150);
  ok('"Lees mijn visie" opent het visie-onderwerp als maker-blok', await p.evaluate(() => { const s = document.getElementById('faq-visie-waarom').closest('.faqcat'); return !s.hidden && !!s.querySelector('.faqmaker blockquote') && /Zaratras/.test(s.textContent); }));
  ok('nergens "Denny" in de zichtbare FAQ', await p.evaluate(() => !/Denny/.test(document.querySelector('.faqwrap').textContent)));
  await p.evaluate(() => faqHome());

  console.log('─── Zoeken ───');
  await p.fill('#faqQ', 'back-up');
  ok('zoeken toont matches uit meerdere onderwerpen', await p.evaluate(() => { const vis = [...document.querySelectorAll('details.faq')].filter(d => d.offsetParent); const cats = new Set(vis.map(d => d.closest('.faqcat').dataset.ci)); return vis.length > 1 && vis.length < document.querySelectorAll('details.faq').length && cats.size > 1; }));
  ok('tijdens zoeken zijn de tegels weg en lege onderwerpen verborgen', await p.evaluate(() => document.getElementById('faqHome').hidden && [...document.querySelectorAll('.faqcat')].some(c => c.hidden)));
  await p.fill('#faqQ', 'reservesleutel');
  ok('zoekt ook in antwoordtekst, met een stukje antwoord onder de vraag', await p.evaluate(() => { const vis = [...document.querySelectorAll('details.faq')].filter(d => d.offsetParent); return vis.length >= 1 && vis.every(d => d.open) && /reservesleutel/i.test(vis[0].querySelector('.faqsnip')?.textContent || ''); }));
  const vind = async q => { await p.fill('#faqQ', q); return p.evaluate(() => [...document.querySelectorAll('details.faq')].some(d => d.offsetParent && /Wat is Mori/.test(d.querySelector('summary').textContent))); };
  ok('zoeken op "Mori" vindt de vraag over Mori', await vind('Mori'));
  ok('zoeken op "AI-coach" vindt de vraag over Mori', await vind('AI-coach'));
  ok('zoeken op "ai coach" (zonder streepje) ook', await vind('aicoach'));
  await p.fill('#faqQ', '');   // a search snippet may quote the answer once more
  ok('Mori wordt één keer uitgelegd', await p.evaluate(() => (document.querySelector('.faqwrap').textContent.match(/Mori is de AI-coach van SyncJournal/g) || []).length === 1));
  await p.fill('#faqQ', 'wirwar');
  ok('zoeken vindt een woord uit de visie ("wirwar" → vaste set tags)', await p.evaluate(() => { const d = document.getElementById('faq-visie-tags'); return !!d.offsetParent && d.open; }));
  await p.fill('#faqQ', 'xyzonzinwoord');
  const leeg = await p.evaluate(() => { const n = document.getElementById('faqNone'); return { zichtbaar: !n.hidden && !!n.offsetParent, tekst: n.textContent }; });
  ok('niets gevonden → lege staat zichtbaar', leeg.zichtbaar);
  ok('lege staat zegt wat je kunt doen (ander woord, Mori, Morani Discord)', /Niets gevonden/.test(leeg.tekst) && /ander woord/.test(leeg.tekst) && /Mori/.test(leeg.tekst) && /Morani Discord/.test(leeg.tekst), leeg.tekst);
  await p.click('#faqNone .faqchip'); await p.waitForTimeout(100);
  ok('suggestie-knop zoekt op dat woord', await p.evaluate(() => document.getElementById('faqQ').value === 'back-up' && document.getElementById('faqNone').hidden));
  await p.fill('#faqQ', '');
  ok('leegmaken herstelt het overzicht', await p.evaluate(() => !document.getElementById('faqHome').hidden && [...document.querySelectorAll('.faqcat')].every(s => s.hidden) && document.getElementById('faqNone').hidden && ![...document.querySelectorAll('details.faq')].some(d => d.open)));

  console.log('─── Lees mijn visie ↗ ───');
  await p.fill('#faqQ', 'Hoe werken tags');
  ok('"Lees mijn visie" opent de juiste vraag in de visie-categorie, ook vanuit een zoekopdracht', await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.faq-a .linklike')].find(x => /Lees mijn visie/.test(x.textContent) && x.offsetParent);
    if (!btn) return false; btn.click();
    const d = document.getElementById('faq-visie-tags');
    return d.open && !!d.offsetParent && [...document.querySelectorAll('.faqcat')].filter(s => !s.hidden).length === 1 && document.getElementById('faqQ').value === '';
  }));
  ok('faqGoto vanuit een ander onderwerp opent de juiste vraag', await p.evaluate(() => { faqOpenCat(7); faqGoto('visie-review'); const d = document.getElementById('faq-visie-review'); return d.open && !!d.offsetParent && document.getElementById('faqc-7').hidden; }));

  console.log('─── Paden in de FAQ bestaan ───');
  const paden = await p.evaluate(() => [...new Set([...document.querySelector('.faqwrap').textContent.matchAll(/Instellingen → ([A-Za-z-]+)/g)].map(m => m[1]))]);
  const tabs = await p.evaluate(() => { go('instellingen'); const t = [...document.querySelectorAll('#setTabs button')].map(x => x.lastChild.textContent.trim()); go('faq'); return t; });
  ok('de FAQ noemt Instellingen-paden', paden.length >= 5, paden.join(', '));
  for (const pd of paden) ok('Instellingen → ' + pd + ' is een tab', tabs.includes(pd), 'tabs: ' + tabs.join(', '));
  ok('features gedekt (coach-pakket, TradingView-link, lek, SQN, sync-geschiedenis, ECB, diagnose-rapport)', await p.evaluate(() => { const t = document.querySelector('.faqwrap').textContent; return /coach-pakket/i.test(t) && /TradingView-link/i.test(t) && /lek/.test(t) && /SQN/.test(t) && /Sync-geschiedenis/.test(t) && /ECB/.test(t) && /Diagnose-rapport/.test(t); }));

  console.log('─── Thema\'s en 390px ───');
  for (const th of ['light', 'dark']) {
    ok('FAQ rendert in ' + th, await p.evaluate(t => { setTheme(t); go('faq'); return document.body.classList.contains('dark') === (t === 'dark') && document.querySelectorAll('.faqtile').length === 9; }, th));
    ok('zoekopdracht overleeft een re-render (' + th + ')', await p.evaluate(async t => { faqFilter('SQN'); setTheme(t); await new Promise(r => setTimeout(r, 0)); return document.getElementById('faqQ').value === 'SQN' && document.getElementById('faqHome').hidden; }, th));
    await p.evaluate(() => { faqFilter(''); faqHome(); });
  }
  await p.evaluate(() => setTheme('light'));
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  const mob = await p.evaluate(() => { const t = [...document.querySelectorAll('.faqtile')]; return { kol: new Set(t.map(x => x.getBoundingClientRect().left)).size, scroll: document.documentElement.scrollWidth <= innerWidth + 1, uitleg: getComputedStyle(t[0].querySelector('.td')).display }; });
  ok('390px: tegels in 2 kolommen, geen horizontale scroll', mob.kol === 2 && mob.scroll, JSON.stringify(mob));
  ok('390px: onderwerp openen en antwoord lezen werkt', await p.evaluate(() => { faqOpenQ('faq-backup'); const d = document.getElementById('faq-backup'); return d.open && d.getBoundingClientRect().width <= innerWidth; }));
  await p.setViewportSize({ width: 1600, height: 1000 });

  ok('Mori-link in de lege staat navigeert', await p.evaluate(() => { go('faq'); faqFilter('xyzonzinwoord'); document.querySelector('#faqNone .linklike').click(); const r = STATE.page === 'ai'; go('faq'); faqFilter(''); return r; }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== FAQ: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
