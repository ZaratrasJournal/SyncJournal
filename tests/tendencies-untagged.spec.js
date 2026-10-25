// Tendencies zonder tags: wie geen playbook, emotie of tags invult, krijgt toch patronen te zien
// uit wat elke trade heeft (tijd, dag, sessie, richting). Geen leeg scherm, geen lege tabel.
//
// Herschreven in T2 (24-10-2026): de oude spec toetste de vijf tag-loze detectoren en de
// "tag je trades"-hint van de oude app. SyncJournal haalt sessie, dag en uur uit de tijd.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

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
    leeg: [...document.querySelectorAll('#main .empty-h')].some(h => /Nog geen patronen|Geen trades gevonden/.test(h.textContent)),   // the page's own empty state, not a panel's
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

  // De kruis-analyse: elke toestand, licht en donker. Een lege tabel (alleen een kopregel) is nooit goed.
  const kruis = () => p.evaluate(() => {
    const pnl = [...document.querySelectorAll('#main .panel')].find(x => /Kruis-analyse/.test((x.querySelector('h3') || {}).textContent || ''));
    const leeg = pnl && pnl.querySelector('.empty'), knop = leeg && leeg.querySelector('button');
    return { paneel: !!pnl, rijen: pnl ? pnl.querySelectorAll('.thm th.rowh').length : 0, tabel: !!(pnl && pnl.querySelector('table.thm')),
      kiezers: pnl ? pnl.querySelectorAll('.crossctrl select').length : 0, kop: leeg ? leeg.querySelector('.empty-h').textContent : '',
      uitleg: leeg ? leeg.querySelector('.empty-d').textContent : '', knop: knop ? knop.textContent : '',
      kleur: leeg ? getComputedStyle(leeg.querySelector('.empty-d')).color : '', bg: getComputedStyle(document.body).backgroundColor };
  });
  const ZONDER_COMBI = Array.from({ length: 12 }, (_, i) => ({ ...SET[i], id: 100 + i, ...(i % 2 ? { setup: 'Breakout' } : { grade: 'A' }) }));
  for (const thema of ['light', 'dark']) {
    await p.evaluate(t => setTheme(t), thema);
    // 1. wel trades, geen playbooks: de standaard Playbook × Sessie heeft geen rijen
    await H.seedTrades(p, SET); await p.evaluate(() => { STATE.tendRow = 'setup'; STATE.tendCol = 'session'; }); await H.go(p, 'tendencies');
    let k = await kruis();
    ok(`${thema}, geen playbooks: kruis-analyse toont een lege staat, geen tabel met alleen een kopregel`, k.paneel && !k.tabel && /playbook/i.test(k.kop + k.uitleg), JSON.stringify(k));
    ok(`${thema}, geen playbooks: zegt wat de volgende stap is (playbook koppelen of andere dimensie) en houdt de kiezers`, /koppel|kies/i.test(k.uitleg) && /dimensie/i.test(k.uitleg) && k.kiezers === 2 && !!k.knop, JSON.stringify(k));
    ok(`${thema}, lege staat leesbaar in dit thema (tekstkleur ≠ achtergrond)`, k.kleur && k.kleur !== k.bg, k.kleur + ' op ' + k.bg);
    await p.evaluate(() => [...document.querySelectorAll('#main .panel .empty button')].find(b => /Dag/.test(b.textContent)).click());
    k = await kruis();
    ok(`${thema}, knop in de lege staat schakelt naar een combinatie met cellen`, k.tabel && k.rijen >= 2, JSON.stringify(k));
    // 2. een dimensie die bij geen enkele trade een waarde heeft (hier: emotie)
    await p.evaluate(() => setCrossDim('row', 'emo')); k = await kruis();
    ok(`${thema}, lege dimensie (Emotie): lege staat die een andere dimensie voorstelt`, !k.tabel && /dimensie/i.test(k.uitleg) && !!k.knop, JSON.stringify(k));
    // 3. beide dimensies hebben waarden, maar nooit op dezelfde trade
    await H.seedTrades(p, ZONDER_COMBI); await p.evaluate(() => { STATE.tendRow = 'setup'; STATE.tendCol = 'grade'; }); await H.go(p, 'tendencies');
    k = await kruis();
    ok(`${thema}, Playbook × Grade zonder trade met allebei: lege staat "geen combinatie"`, k.paneel && !k.tabel && /allebei|beide|combinatie/i.test(k.kop + k.uitleg), JSON.stringify(k));
    // 4. nooit trades: de hele pagina heeft een lege staat, geen losse kruis-analyse
    await H.seedTrades(p, []); await H.go(p, 'tendencies');
    const nooit = await p.evaluate(() => ({ leeg: ((document.querySelector('#main .empty-h') || {}).textContent || ''), kruis: /Kruis-analyse/.test(document.getElementById('main').innerText) }));
    ok(`${thema}, nooit trades: één lege staat voor de pagina, geen kruis-analyse`, /Nog geen patronen/.test(nooit.leeg) && !nooit.kruis, JSON.stringify(nooit));
  }
  await H.seedTrades(p, SET); await p.evaluate(() => { setTheme('light'); STATE.tendRow = 'setup'; STATE.tendCol = 'session'; }); await H.go(p, 'tendencies');
  await p.evaluate(() => { setCrossDim('row', 'dow'); });
  const k = await p.evaluate(() => ({ rijen: document.querySelectorAll('.thm th.rowh').length, cellen: document.querySelectorAll('.thm td[data-t]').length }));
  ok('kruis-analyse op Dag × Sessie toont wel cellen', k.rijen >= 2 && k.cellen >= 2, JSON.stringify(k));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Tendencies zonder tags: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
