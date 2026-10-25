// Tendencies zonder tags: wie geen playbook, emotie of tags invult, krijgt toch patronen te zien
// uit wat elke trade heeft (tijd, dag, sessie, richting). Geen leeg scherm, geen lege tabel.
//
// Herschreven in T2 (24-10-2026): de oude spec toetste de vijf tag-loze detectoren en de
// "tag je trades"-hint van de oude app. SyncJournal haalt sessie, dag en uur uit de tijd.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0, fixmes = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
// FIXME-check: bekende bug in de app (docs/plan-t2-specs.md, Gevonden bugs). Telt niet als rood zolang hij faalt.
const fixme = (n, c, e) => { fixmes++; console.log(c ? '  ⚠ FIXME lijkt opgelost, maak er weer ok() van: ' + n : '  ⚠ FIXME (bekende bug): ' + n + (e ? ' → ' + e : '')); };

// 64 gesloten trades zonder playbook/tags/emoties. Ochtend (09u, London) wint, nacht (02u, Asia) verliest.
const SET = Array.from({ length: 64 }, (_, i) => {
  const ochtend = i % 2 === 0, dag = 1 + (i % 28);
  // sessie zoals sync en formulier hem uit de tijd afleiden (sessionFromTime)
  return { id: i, date: '2026-09-' + String(dag).padStart(2, '0'), time: ochtend ? '09:15' : '02:30', session: ochtend ? 'London' : 'Asia', pair: 'BTC/USDT', dir: i % 3 ? 'long' : 'short',
    status: 'closed', kind: 'live', entry: 100, exit: ochtend ? 102 : 99, stop: 99, size: '1000', pnl: ochtend ? 20 : -10, exchange: '', setup: '' };
});

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seedTrades(p, SET);
  await H.go(p, 'tendencies');

  const r = await p.evaluate(() => ({
    leeg: !!document.querySelector('#main .empty'),
    edge: (document.querySelector('.vcard.edge .vcombo') || {}).textContent || '',
    leak: (document.querySelector('.vcard.leak .vcombo') || {}).textContent || '',
    whm: [...document.querySelectorAll('.whm .whm-cell')].filter(c => +c.dataset.n > 0).length,
    hbars: [...document.querySelectorAll('#main .hbar .lbl')].map(x => x.textContent),
    kruisRijen: document.querySelectorAll('.thm th.rowh').length,
    kruisCellen: document.querySelectorAll('.thm td[data-t]').length,
    kruisTekst: ((document.querySelector('.thm-wrap') || {}).innerText || '').trim().slice(0, 120),
  }));
  ok('geen lege staat: er zijn gesloten trades', !r.leeg, JSON.stringify(r));
  ok('sterkste combinatie gevonden zonder tags (sessie × dag of uur)', r.edge && r.edge !== '—', r.edge);
  ok('en een lek', r.leak && r.leak !== '—' && r.leak !== r.edge, r.leak);
  ok('weekdag × uur-heatmap heeft gevulde cellen', r.whm >= 2, String(r.whm));
  ok('breakdown per sessie heeft balkjes (London en Asia)', r.hbars.length >= 2 && r.hbars.some(x => /London/i.test(x)) && r.hbars.some(x => /Asia/i.test(x)), JSON.stringify(r.hbars));

  // De kruis-analyse start op Playbook × Sessie. Zonder playbooks zijn er geen rijen.
  fixme('kruis-analyse zonder playbooks: geen lege tabel (rijen, of een lege-staat-melding)', r.kruisRijen > 0 || /nog geen|geen playbook|kies/i.test(r.kruisTekst), JSON.stringify({ rijen: r.kruisRijen, tekst: r.kruisTekst }));
  await p.evaluate(() => { setCrossDim('row', 'dow'); });
  const k = await p.evaluate(() => ({ rijen: document.querySelectorAll('.thm th.rowh').length, cellen: document.querySelectorAll('.thm td[data-t]').length }));
  ok('kruis-analyse op Dag × Sessie toont wel cellen', k.rijen >= 2 && k.cellen >= 2, JSON.stringify(k));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Tendencies zonder tags: ${pass}/${pass + fail}${fixmes ? ' · ' + fixmes + ' fixme' : ''} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
