// Borgt de vernieuwde FAQ-pagina: 8 categorieën beginner→gevorderd, live zoekveld
// (filtert vraag+antwoord, opent matches, verbergt lege categorieën), niets-gevonden-melding.
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
  ok('8 categorieën', await p.evaluate(() => document.querySelectorAll('.faqcat').length === 8));
  ok('≥ 30 vragen totaal', await p.evaluate(() => document.querySelectorAll('details.faq').length >= 30));
  ok('volgorde beginner → gevorderd (Aan de slag eerst, problemen laatst)', await p.evaluate(() => { const h = [...document.querySelectorAll('.faqcat-h')].map(x => x.textContent); return /Aan de slag/.test(h[0]) && /problemen/i.test(h[h.length - 1]); }));
  ok('nieuwe features gedekt (coach-pakket, TradingView, edge/lek, SQN)', await p.evaluate(() => { const t = document.querySelector('.faqwrap').textContent; return /coach-pakket/i.test(t) && /TradingView-link/i.test(t) && /lek/.test(t) && /SQN/.test(t); }));
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

  console.log('─── Interactie ───');
  ok('vraag openklappen werkt', await p.evaluate(() => { const d = document.querySelector('details.faq'); d.open = true; return d.querySelector('.faq-a').textContent.length > 20; }));
  ok('AI-coach-link navigeert', await p.evaluate(() => { document.querySelector('.faqhero .linklike').click(); return STATE.page === 'ai'; }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== FAQ: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
