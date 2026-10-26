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

  console.log('─── Nieuw in v1.18 t/m v1.18.4 ───');
  // [onderwerp-emoji, vraag-patroon, woorden die in het antwoord moeten staan]
  const NIEUW = [
    ['🔄', /funded modus is nog in testfase/, [/back-up/, /verborgen, niet gewist/]],
    ['🔄', /CSV ingelezen én mijn exchange gekoppeld/, [/koppeling is leidend/, /volgende sync/]],
    ['🔄', /hoe mijn stop liep/, [/break-even/, /strakker/, /verder weg/, /liquidatie/, /met de hand/]],
    ['🔄', /stop van mijn exchange klopt niet/, [/Zelf aanpassen/, /Terug naar Kraken Futures/]],
    ['📊', /Stop-management en uitvoering/, [/Eigen/, /Funded/, /Alles/]],
    ['✅', /Discord/, [/Alle beelden voor Discord/, /Playbook/, /Confirmaties/, /privacy-modus/]],
    ['✅', /Beeld op de Review-pagina/, [/nieuwste/i, /Geen afbeelding/, /tags/, /pijltjes/, /Esc/]],
    ['🛠️', /ruwe gegevens/, [/\?dev=1/, /Hulp bij problemen/, /Ruwe gegevens downloaden/, /walletadres/, /Zaratras/]],
  ];
  const plek = await p.evaluate(n => n.map(([ic, q, w]) => {
    const ci = FAQS.findIndex(c => c[0].startsWith(ic)), it = ci < 0 ? null : FAQS[ci][1].find(x => new RegExp(q[0], q[1]).test(x[0]));
    const tekst = it ? faqPlain(it[1]) : '';
    return { q: q[0], ok: !!it, mist: w.filter(([s, f]) => !new RegExp(s, f).test(tekst)).map(([s]) => s) };
  }), NIEUW.map(([ic, q, w]) => [ic, [q.source, q.flags], w.map(x => [x.source, x.flags])]));
  for (const x of plek) ok('nieuwe vraag onder het juiste onderwerp: ' + x.q, x.ok && !x.mist.length, x.ok ? 'mist: ' + x.mist.join(', ') : 'niet gevonden');
  const aangevuld = await p.evaluate(() => {
    const a = q => faqPlain((FAQS.flatMap(c => c[1]).find(x => x[0] === q) || [, ''])[1]);
    return {
      funded: /\+ Funded account/.test(a('Ik handel een challenge bij een prop firm (FTMO, Breakout). Hoe houd ik die bij?')) && /testfase/.test(a('Ik handel een challenge bij een prop firm (FTMO, Breakout). Hoe houd ik die bij?')),
      kaart: /Funded meetellen/.test(a('Telt het geld van mijn funded account mee in mijn balans?')) && /kaart/.test(a('Telt het geld van mijn funded account mee in mijn balans?')),
      csv: /waarschuwt/.test(a('Hoe importeer ik een CSV-bestand?')) && /FTMO-export/.test(a('Hoe importeer ik een CSV-bestand?')),
      stop: /geen stop-loss/.test(a('Komt mijn stop-loss vanzelf binnen?')) && /Zelf aanpassen/.test(a('Komt mijn stop-loss vanzelf binnen?')),
      vast: /Zelf aanpassen/.test(a('Waarom kan ik entry en exit niet aanpassen bij een gesyncte trade?')),
      priv: /Mori/.test(a('Kan ik mijn bedragen verbergen?')) && /coach-pakket/.test(a('Kan ik mijn bedragen verbergen?')),
      coach: /privacy-modus/.test(a('Ziet mijn coach mijn bedragen?')),
      mori: /privacy-modus/.test(a('Wat krijgt Mori van mij te zien?')),
    };
  });
  for (const [k, v] of Object.entries(aangevuld)) ok('aangevulde vraag: ' + k, v);
  const tegen = await p.evaluate(() => { const t = faqPlain(FAQS.flatMap(c => c[1].map(x => x[1])).join(' ')); return { beeld: /alleen trades met een screenshot/.test(t), dubbel: /kan een trade die via de koppeling binnenkomt dubbel/.test(t), sebasReview: (t.match(/Kopieer 2 van 3/g) || []).length }; });
  ok('niets spreekt de nieuwe functies tegen (Beeld zonder afbeelding, geen dubbele trades)', !tegen.beeld && !tegen.dubbel, JSON.stringify(tegen));
  ok('Discord één voor één staat op één plek uitgelegd', tegen.sebasReview === 1, JSON.stringify(tegen));
  await p.evaluate(() => faqHome());
  const zoek = async (q, re) => { await p.fill('#faqQ', q); return p.evaluate(s => [...document.querySelectorAll('details.faq')].some(d => d.offsetParent && new RegExp(s).test(d.querySelector('summary').textContent)), re); };
  ok('zoeken op "funded" vindt de testfase-vraag', await zoek('funded', 'testfase'));
  ok('zoeken op "dubbel" vindt de vraag over CSV + koppeling', await zoek('dubbel', 'Staan mijn trades nu dubbel'));
  ok('zoeken op "stop" vindt de vraag over een verkeerde exchange-stop', await zoek('stop', 'stop van mijn exchange klopt niet'));
  ok('zoeken op "Discord" vindt de Discord-vraag', await zoek('Discord', 'in Discord'));
  ok('zoeken op "ruwe" vindt de vraag over ruwe gegevens', await zoek('ruwe', 'ruwe gegevens'));
  ok('zoeken op "Beeld" vindt de Beeld-vraag', await zoek('Beeld', 'Beeld op de Review-pagina'));
  await p.fill('#faqQ', '');
  // De stappen in de FAQ bestaan in de app zelf
  const app = await p.evaluate(() => {
    go('instellingen'); STATE.setTab = 'data'; render(); const data = document.body.textContent;
    STATE.setTab = 'funded'; render(); const funded = document.body.textContent; go('faq');
    return { hulp: /Hulp bij problemen/.test(data) && /Diagnose-rapport/.test(data), testfase: /Funded modus/.test(funded) && /Nog in testfase/.test(funded) };
  });
  ok('Instellingen → Data heeft "Hulp bij problemen"', app.hulp);
  ok('Instellingen → Funded heeft "Funded modus" met "Nog in testfase"', app.testfase);

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
  for (const th of ['light', 'dark']) {
    const smal = await p.evaluate(([t, qs]) => { setTheme(t); go('faq'); return qs.map(q => {
      const ci = FAQS.findIndex(c => c[1].some(x => x[0].includes(q))); faqOpenCat(ci);
      const d = [...document.querySelectorAll('#faqc-' + ci + ' details.faq')].find(x => x.querySelector('.faqq').textContent.includes(q)); d.open = true;
      const r = d.getBoundingClientRect().width <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1 && d.querySelector('.faq-a').offsetHeight > 0; faqHome(); return r; }); },
      [th, ['testfase', 'Staan mijn trades nu dubbel', 'stop van mijn exchange', 'in Discord', 'Beeld op de Review', 'ruwe gegevens', 'Stop-management']]);
    ok('390px ' + th + ': nieuwe vragen open zonder horizontale scroll', smal.every(Boolean), JSON.stringify(smal));
  }
  await p.evaluate(() => setTheme('light'));
  await p.setViewportSize({ width: 1600, height: 1000 });

  ok('Mori-link in de lege staat navigeert', await p.evaluate(() => { go('faq'); faqFilter('xyzonzinwoord'); document.querySelector('#faqNone .linklike').click(); const r = STATE.page === 'ai'; go('faq'); faqFilter(''); return r; }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== FAQ: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
