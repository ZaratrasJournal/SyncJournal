// AI-coach stap 5: vier vaste vragen als knoppen (docs/research-ai-coach-2026-10-25.md, §6.8).
//
// Elke knop stuurt alleen het deel van het pakket dat die vraag nodig heeft (minder tokens). "Review mijn week"
// geeft een vast schema: wat ging goed, wat kostte geld, één ding om volgende week anders te doen. De cijfers
// daarboven zet de app er zelf neer; het model schrijft alleen de tekst. Nep-Anthropic uit helpers/coach-nep.js.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
const N = require('./helpers/coach-nep');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Datums ten opzichte van vandaag in Amsterdam, zoals de app rekent.
const vandaag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());
const dag = n => { const d = new Date(vandaag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const tr = (id, n, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date: dag(n), time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });
const TRADES = [
  tr(1, 1, 30, { notes: 'deze week, winst' }), tr(2, 2, -20, { emotions: ['FOMO'], session: 'US AM' }), tr(3, 3, 10, { setup: 'Trend-pullback' }),   // deze week
  tr(4, 9, -40, { emotions: ['FOMO'] }), tr(5, 10, 25),                                                                                               // week ervoor
  tr(6, 40, -60, { emotions: ['FOMO'], session: 'US AM', mistakes: ['Te vroeg in'] }), tr(7, 45, 80, { setup: 'Trend-pullback' }), tr(8, 50, -15),     // ouder
];
const WEEK = { goed: 'Je London SFP-trades liepen volgens plan.', kostte: 'De FOMO-trade in US AM kostte je de meeste R.', anders: 'Geen instap in US AM zonder retest.' };

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: TRADES, settings: { currency: 'USD', theme: 'light' } });
  await N.installeer(p); await N.sleutel(p);
  await p.evaluate(() => { STATE.unit = 'val'; clearGFilter(); setFilter('kind', 'alle'); go('ai'); });
  const knop = async (tekst, antwoord, wacht) => { if (antwoord) await N.zet(p, antwoord); await p.click('[data-ai-knop="' + tekst + '"]'); await p.waitForTimeout(wacht || 500); };
  const laatsteVerzoek = async () => { const v = await N.verzoeken(p); return v[v.length - 1].body; };
  const pakketUit = body => ((body.system || []).find(x => /Data van de trader/.test(x.text)) || { text: '' }).text;
  const alles = await p.evaluate(() => coachPakket({}).tekst);

  console.log('─── Vier vaste knoppen ───');
  const knoppen = await p.evaluate(() => [...document.querySelectorAll('[data-ai-knop]')].map(x => x.textContent.trim()));
  ok('precies de vier vragen', JSON.stringify(knoppen) === JSON.stringify(['Waar lek ik geld?', 'Waar zit mijn edge?', 'Review mijn week', 'Hoe ging mijn laatste trade?']), JSON.stringify(knoppen));

  console.log('─── Waar lek ik geld? ───');
  await knop('Waar lek ik geld?', N.tekst('Lek: FOMO.'));
  let body = await laatsteVerzoek(), pk = pakketUit(body);
  ok('de vraag gaat als bericht mee', body.messages.slice(-1)[0].content === 'Waar lek ik geld?');
  const eersteEmotie = (pk.split('## Emotie-tag')[1] || '').split('\n').find(l => l.startsWith('- ')) || '';
  ok('groepen met de grootste verliezen eerst (FOMO bovenaan)', /^- FOMO: /.test(eersteEmotie), eersteEmotie);
  ok('de slechtste trades, niet de recente lijst', /## Slechtste trades/.test(pk) && !/## Recente trades/.test(pk));
  ok('kleiner dan het hele pakket', pk.length < alles.length + 40, pk.length + ' vs ' + alles.length);
  ok('een opdracht voor deze vraag in de systeemprompt', (body.system || []).some(x => /Opdracht voor deze vraag/.test(x.text) && /lek/i.test(x.text)));

  console.log('─── Waar zit mijn edge? ───');
  await knop('Waar zit mijn edge?', N.tekst('Edge: Trend-pullback.'));
  pk = pakketUit(await laatsteVerzoek());
  const eersteSetup = (pk.split('## Setup / playbook')[1] || '').split('\n').find(l => l.startsWith('- ')) || '';
  ok('groepen met de grootste winst eerst (Trend-pullback bovenaan)', /^- Trend-pullback: /.test(eersteSetup), eersteSetup);
  ok('de beste trades', /## Beste trades/.test(pk) && !/## Recente trades/.test(pk));

  console.log('─── Hoe ging mijn laatste trade? ───');
  await knop('Hoe ging mijn laatste trade?', N.tekst('Je laatste trade was winst.'));
  pk = pakketUit(await laatsteVerzoek());
  ok('de nieuwste trade staat in focus', /## Trade in focus\n- #\d+ · /.test(pk) && pk.includes('deze week, winst'), pk.slice(pk.indexOf('## Trade in focus'), pk.indexOf('## Trade in focus') + 160));
  ok('met de cijfers van zijn setup', /Zijn setup \(London SFP\): n=/.test(pk));
  ok('zonder groepen en zonder lijst: veel kleiner', !/## Sessie/.test(pk) && !/## Recente trades/.test(pk) && pk.length < alles.length / 2, pk.length + ' vs ' + alles.length);

  console.log('─── Review mijn week ───');
  await knop('Review mijn week', N.tekst(JSON.stringify(WEEK), { stukjes: 3 }), 700);
  body = await laatsteVerzoek(); pk = pakketUit(body);
  ok('vast schema gevraagd (json_schema met goed, kostte, anders)', body.output_config && body.output_config.format && body.output_config.format.type === 'json_schema'
    && JSON.stringify(body.output_config.format.schema.required) === JSON.stringify(['goed', 'kostte', 'anders']), JSON.stringify(body.output_config));
  ok('het pakket gaat over deze week en de week ervoor', /^- Deze week \(/m.test(pk) && /^- Week ervoor \(/m.test(pk), (pk.match(/^- (Deze week|Week ervoor).*$/gm) || []).join(' | '));
  ok('alleen de trades van deze week in de lijst', (pk.split('## Trades deze week')[1] || '').split('\n').filter(l => /^- #/.test(l)).length === 3);
  const kaart = await p.evaluate(() => { const m = [...document.querySelectorAll('#aiFeed .aimsg.ai')].pop(); return m ? m.innerText.replace(/\s+/g, ' ') : ''; });
  ok('drie kopjes met de tekst van de coach', /Wat ging goed/.test(kaart) && kaart.includes(WEEK.goed) && /Wat kostte geld/.test(kaart) && kaart.includes(WEEK.kostte) && /Eén ding om volgende week anders te doen/.test(kaart) && kaart.includes(WEEK.anders), kaart.slice(0, 400));
  // De cijfers erboven komen uit de app: deze week = trades 1, 2, 3 → netto +$ 20,00, winrate 67%, 3 trades.
  const app = await p.evaluate(() => { const c = coachWeekCijfers(CLOSED); return { n: c.week.n, net: eurS(c.week.net), wr: Math.round(c.week.wr) + '%' }; });
  ok('de app rekende deze week: 3 trades, +$ 20,00, 67%', app.n === 3 && app.net === '+$ 20,00' && app.wr === '67%', JSON.stringify(app));
  ok('en die cijfers staan boven de review', kaart.includes('3 trades') && kaart.includes(app.net) && kaart.includes(app.wr), kaart.slice(0, 200));
  ok('geen ruwe JSON in beeld', !/"goed"/.test(kaart));

  console.log('─── Week zonder trades ───');
  const voor = (await N.verzoeken(p)).length;
  // alleen trades ouder dan 8 dagen over
  await p.evaluate(() => { T = T.filter(t => { const d = new Date(t.date + 'T12:00:00Z'); return (Date.now() - d) / 864e5 > 8; }); persist(); render(); go('ai'); });
  await knop('Review mijn week', null, 300);
  const t = await p.evaluate(() => document.getElementById('aiFeed').innerText.replace(/\s+/g, ' '));
  ok('geen verzoek, wel een melding wat je kunt doen', (await N.verzoeken(p)).length === voor && /Geen gesloten trades in de afgelopen 7 dagen/.test(t), t.slice(-200));

  console.log('─── Licht en donker, 390px ───');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const th of ['light', 'dark']) {
    await p.evaluate(x => { setTheme(x); go('ai'); }, th);
    ok(th + ': knoppen passen op 390px', await p.evaluate(() => document.documentElement.scrollWidth <= 392 && document.querySelectorAll('[data-ai-knop]').length === 4));
    await p.screenshot({ path: 'tests/screenshots/coach-knoppen-390-' + th + '.png' }).catch(() => {});
  }

  ok('geen JS-fouten', errs.length === 0 && !(await p.evaluate(() => ErrorCenter.log.some(e => e.ctx === 'crash'))), errs[0]);
  console.log(`\n=== Coach-knoppen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
