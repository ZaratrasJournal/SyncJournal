// Borgt de FAQ-pagina: 9 categorieën beginner→gevorderd met Denny's visie direct na "Aan de slag",
// live zoekveld (filtert vraag+antwoord, opent matches, verbergt lege categorieën), niets-gevonden-melding,
// "Lees mijn visie"-links, en dat elk "Instellingen → X" uit de FAQ als tab bestaat (audit 25-10-2026).
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

  console.log('─── Structuur ───');
  ok('9 categorieën', await p.evaluate(() => document.querySelectorAll('.faqcat').length === 9));
  ok('≥ 55 vragen totaal', await p.evaluate(() => document.querySelectorAll('details.faq').length >= 55));
  ok('volgorde beginner → gevorderd (Aan de slag eerst, visie tweede, problemen laatst)', await p.evaluate(() => { const h = [...document.querySelectorAll('.faqcat-h')].map(x => x.textContent); return /Aan de slag/.test(h[0]) && /mijn visie/i.test(h[1]) && /problemen/i.test(h[h.length - 1]); }));
  ok('visie-categorie heeft de vijf waarom-vragen', await p.evaluate(() => ['visie-waarom', 'visie-voorwie', 'visie-tags', 'visie-playbook', 'visie-review'].every(id => !!document.getElementById('faq-' + id))));
  ok('features gedekt (coach-pakket, TradingView-link, lek, SQN, sync-geschiedenis, ECB, diagnose-rapport)', await p.evaluate(() => { const t = document.querySelector('.faqwrap').textContent; return /coach-pakket/i.test(t) && /TradingView-link/i.test(t) && /lek/.test(t) && /SQN/.test(t) && /Sync-geschiedenis/.test(t) && /ECB/.test(t) && /Diagnose-rapport/.test(t); }));
  ok('zoekveld aanwezig in hero', await p.evaluate(() => !!document.querySelector('.faqhero .faqsearch')));

  console.log('─── Zoeken ───');
  await p.evaluate(() => faqFilter('back-up'));
  ok('zoeken toont alleen matches', await p.evaluate(() => { const vis = [...document.querySelectorAll('details.faq')].filter(d => d.style.display !== 'none'); return vis.length > 0 && vis.length < document.querySelectorAll('details.faq').length; }));
  ok('matches klappen open', await p.evaluate(() => [...document.querySelectorAll('details.faq')].filter(d => d.style.display !== 'none').every(d => d.open)));
  ok('lege categorieën verdwijnen', await p.evaluate(() => [...document.querySelectorAll('.faqcat')].some(c => c.style.display === 'none')));
  await p.evaluate(() => faqFilter('xyzonzinwoord'));
  ok('niets gevonden → melding zichtbaar', await p.evaluate(() => document.getElementById('faqNone').style.display !== 'none'));
  await p.evaluate(() => faqFilter(''));
  ok('leegmaken herstelt alles (dicht + zichtbaar)', await p.evaluate(() => { const all = [...document.querySelectorAll('details.faq')]; return all.every(d => d.style.display !== 'none' && !d.open) && document.getElementById('faqNone').style.display === 'none'; }));
  ok('zoekt ook in antwoordtekst', await p.evaluate(() => { faqFilter('reservesleutel'); const vis = [...document.querySelectorAll('details.faq')].filter(d => d.style.display !== 'none'); faqFilter(''); return vis.length >= 1; }));
  ok('zoeken op "Mori" én op "AI-coach" vindt de vraag over Mori', await p.evaluate(() => {
    const vind = q => { faqFilter(q); const r = [...document.querySelectorAll('details.faq')].some(d => d.style.display !== 'none' && /Wat kan Mori/.test(d.querySelector('summary').textContent)); faqFilter(''); return r; };
    return vind('Mori') && vind('AI-coach');
  }));
  ok('Mori wordt één keer uitgelegd', await p.evaluate(() => (document.querySelector('.faqwrap').textContent.match(/Mori is de AI-coach van SyncJournal/g) || []).length === 1));
  ok('zoeken vindt een woord uit de visie ("wirwar" → vaste set tags)', await p.evaluate(() => { faqFilter('wirwar'); const d = document.getElementById('faq-visie-tags'); const r = d.style.display !== 'none' && d.open; faqFilter(''); return r; }));

  console.log('─── Interactie ───');
  ok('vraag openklappen werkt', await p.evaluate(() => { const d = document.querySelector('details.faq'); d.open = true; return d.querySelector('.faq-a').textContent.length > 20; }));
  ok('"Lees mijn visie" opent de visie-vraag, ook vanuit een zoekopdracht', await p.evaluate(() => {
    faqFilter('Hoe werken tags'); const inp = document.querySelector('.faqsearch'); inp.value = 'Hoe werken tags';
    const btn = [...document.querySelectorAll('.faq-a .linklike')].find(x => /Lees mijn visie/.test(x.textContent) && x.closest('details').style.display !== 'none');
    if (!btn) return false; btn.click();
    const d = document.getElementById('faq-visie-tags'); return d.open && d.style.display !== 'none' && inp.value === '';
  }));

  console.log('─── Paden in de FAQ bestaan ───');
  const paden = await p.evaluate(() => [...new Set([...document.querySelector('.faqwrap').textContent.matchAll(/Instellingen → ([A-Za-z-]+)/g)].map(m => m[1]))]);
  const tabs = await p.evaluate(() => { go('instellingen'); const t = [...document.querySelectorAll('#setTabs button')].map(x => x.lastChild.textContent.trim()); go('faq'); return t; });
  ok('de FAQ noemt Instellingen-paden', paden.length >= 5, paden.join(', '));
  for (const pd of paden) ok('Instellingen → ' + pd + ' is een tab', tabs.includes(pd), 'tabs: ' + tabs.join(', '));

  console.log('─── Thema\'s ───');
  for (const th of ['light', 'dark']) {
    ok('FAQ rendert in ' + th, await p.evaluate(t => { setTheme(t); go('faq'); return document.body.classList.contains('dark') === (t === 'dark') && document.querySelectorAll('.faqcat').length === 9; }, th));
  }
  await p.evaluate(() => setTheme('light'));

  ok('AI-coach-link navigeert', await p.evaluate(() => { go('faq'); document.querySelector('.faqhero .linklike').click(); return STATE.page === 'ai'; }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== FAQ: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
