// AI-coach stap 6: tools in plaats van meer context (docs/research-ai-coach-2026-10-25.md, §6.2).
//
// Het model kan twee functies aanroepen die de app uitvoert: groep_stats(dimensie, filter) en zoek_trades(filter, max).
// De app rekent met dezelfde helpers als Analytics; het model krijgt alleen het resultaat. Maximaal 3 tool-rondes per
// vraag. Binnen één vraag gaan de thinking-blokken ongewijzigd terug (Sonnet 5.5 controleert dat).
// Nep-Anthropic uit helpers/coach-nep.js.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
const N = require('./helpers/coach-nep');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const tr = (id, date, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });
const TRADES = [
  tr(1, '2026-10-01', 40, { notes: 'eerste trade' }), tr(2, '2026-10-02', -20, { emotions: ['FOMO'] }), tr(3, '2026-10-05', 30, { session: 'US AM' }),
  tr(4, '2026-10-06', -10, { session: 'US AM', setup: 'Trend-pullback', dir: 'short' }), tr(5, '2026-10-07', 12.5, { stop: '', pair: 'ETH/USDT' }),
  tr(6, '2026-10-08', -7.25, { pair: 'ETH/USDT', session: 'London' }),
];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: TRADES, settings: { currency: 'USD', theme: 'light' } });
  await N.installeer(p); await N.sleutel(p);
  await p.evaluate(() => { STATE.unit = 'val'; clearGFilter(); setFilter('kind', 'alle'); render(); });

  console.log('─── groep_stats: dezelfde cijfers als Analytics ───');
  const ana = await p.evaluate(() => { go('analytics'); const o = {};
    document.querySelectorAll('.kpis .kpi').forEach(k => { o[k.querySelector('.k').textContent.trim()] = k.querySelector('.v').textContent.trim(); }); return o; });
  const alles = await p.evaluate(() => aiToolUitvoeren({ name: 'groep_stats', input: { dimensie: 'alles' } }).tekst);
  const regel = (alles.match(/^- Alles.*$/m) || [''])[0];
  for (const [veld, kpi] of [['netto', 'Netto P&L'], ['winrate', 'Win-rate'], ['profit factor', 'Profit factor'], ['expectancy', 'Expectancy']])
    ok(veld + ' = Analytics (' + ana[kpi] + ')', (regel.match(new RegExp(veld + ' (.+?) ·')) || [])[1] === ana[kpi], regel);

  const londen = await p.evaluate(() => aiToolUitvoeren({ name: 'groep_stats', input: { dimensie: 'setup', filter: { sessie: 'London' } } }).tekst);
  // London: trades 1, 2, 5 en 6, allemaal London SFP: 4 trades, 2 winst (1 en 5) → winrate 50%
  ok('filter sessie=London, per setup: London SFP n=4, winrate 50%', /^- London SFP: n=4 · .*winrate 50%/m.test(londen), londen);
  ok('het filter staat in het resultaat', /sessie=London/.test(londen));
  ok('zelfde regel als coachStats op dezelfde trades', await p.evaluate(t => { const rs = CLOSED.filter(x => sessionOf(x) === 'London' && x.setup === 'London SFP');
    return t.includes('- London SFP: n=' + rs.length + ' · ' + coachStats(rs, { hideAmounts: false })); }, londen));
  ok('een onbekende dimensie geeft een fout terug, geen crash', await p.evaluate(() => { const r = aiToolUitvoeren({ name: 'groep_stats', input: { dimensie: 'maanstand' } }); return r.fout && /dimensie/i.test(r.tekst); }));
  ok('geen trades met dit filter: dat staat er', /Geen gesloten trades/.test(await p.evaluate(() => aiToolUitvoeren({ name: 'groep_stats', input: { dimensie: 'alles', filter: { setup: 'Bestaat niet' } } }).tekst)));

  console.log('─── zoek_trades ───');
  const verlies = await p.evaluate(() => aiToolUitvoeren({ name: 'zoek_trades', input: { filter: { resultaat: 'verlies' }, max: 2 } }).tekst);
  const rij = verlies.split('\n').filter(l => /^- #/.test(l));
  ok('2 verliezen, nieuwste eerst', rij.length === 2 && /08-10-2026/.test(rij[0]) && /06-10-2026/.test(rij[1]), verlies);
  ok('trade zonder stop-loss: "geen R"', /geen R/.test(await p.evaluate(() => aiToolUitvoeren({ name: 'zoek_trades', input: { filter: { symbool: 'ETH/USDT', resultaat: 'winst' } } }).tekst)));
  await p.evaluate(() => { AIPREFS.hideAmounts = true; });
  ok('bedragen verbergen geldt ook voor tools', !/\$/.test(await p.evaluate(() => aiToolUitvoeren({ name: 'zoek_trades', input: {} }).tekst + aiToolUitvoeren({ name: 'groep_stats', input: { dimensie: 'sessie' } }).tekst)));
  await p.evaluate(() => { AIPREFS.hideAmounts = false; });
  ok('max wordt begrensd op 30', await p.evaluate(() => aiToolUitvoeren({ name: 'zoek_trades', input: { max: 999 } }).tekst.split('\n').filter(l => /^- #/.test(l)).length === 6));

  console.log('─── De lus met nep-Anthropic ───');
  await p.evaluate(() => go('ai'));
  await N.zet(p, N.tools([{ name: 'groep_stats', input: { dimensie: 'sessie', filter: { setup: 'London SFP' } } }]), N.tekst('In London verdien je het meest (uit groep_stats).'));
  await p.fill('#aiInput', 'In welke sessie werkt London SFP het best?'); await p.click('#aiSendBtn'); await p.waitForTimeout(700);
  let vz = await N.verzoeken(p);
  ok('twee verzoeken: één tool-ronde en het antwoord', vz.length === 2, String(vz.length));
  ok('de tools gaan mee', JSON.stringify((vz[0].body.tools || []).map(t => t.name)) === JSON.stringify(['groep_stats', 'zoek_trades']));
  const m2 = (vz[1] || { body: { messages: [] } }).body.messages, asst = m2[m2.length - 2], res = m2[m2.length - 1];
  ok('de assistent-beurt gaat ongewijzigd terug, met thinking en signature', asst && asst.role === 'assistant' && asst.content[0].type === 'thinking' && asst.content[0].signature === 'sig_nep_0' && asst.content.some(x => x.type === 'tool_use' && x.name === 'groep_stats'), JSON.stringify(asst).slice(0, 300));
  ok('het tool-resultaat komt van de app', res && res.role === 'user' && res.content[0].type === 'tool_result' && res.content[0].tool_use_id === asst.content.find(x => x.type === 'tool_use').id && /- London: n=4 · /.test(res.content[0].content), JSON.stringify(res).slice(0, 300));
  ok('het systeem en de tools blijven gelijk binnen de vraag', JSON.stringify(vz[0].body.system) === JSON.stringify(vz[1].body.system) && JSON.stringify(vz[0].body.tools) === JSON.stringify(vz[1].body.tools));
  const feed = await p.evaluate(() => [...document.querySelectorAll('#aiFeed .aimsg.ai')].pop().innerText);
  ok('het antwoord staat er', /In London verdien je het meest/.test(feed));
  ok('"Wat is er verstuurd?" toont ook wat de coach opzocht', await p.evaluate(() => { const pre = [...document.querySelectorAll('#aiFeed details pre')].pop(); return !!pre && /Opgezocht door de coach/.test(pre.textContent) && /groep_stats/.test(pre.textContent) && /- London: n=4/.test(pre.textContent); }));
  ok('een vervolgvraag stuurt alleen tekst mee, geen oude thinking-blokken', await (async () => {
    await N.zet(p, N.tekst('Vervolg.')); await p.fill('#aiInput', 'En US AM?'); await p.click('#aiSendBtn'); await p.waitForTimeout(500);
    const v = await N.verzoeken(p), ms = v[v.length - 1].body.messages; return ms.length === 3 && ms.every(x => typeof x.content === 'string'); })());

  console.log('─── Maximaal 3 tool-rondes ───');
  await p.evaluate(() => { AIMSGS = []; render(); });
  const zoek = N.tools([{ name: 'zoek_trades', input: { max: 1 } }]);
  await N.zet(p, zoek, zoek, zoek, N.tekst('Na drie rondes geef ik antwoord.'));
  await p.fill('#aiInput', 'Zoek maar raak'); await p.click('#aiSendBtn'); await p.waitForTimeout(1200);
  vz = (await N.verzoeken(p)).slice(-4);
  ok('vier verzoeken: drie tool-rondes en het antwoord', vz.length === 4 && vz.slice(0, 3).every(v => !v.body.tool_choice), JSON.stringify(vz.map(v => v.body.tool_choice || null)));
  ok('de vierde mag geen tool meer aanroepen (tool_choice none)', vz[3].body.tool_choice && vz[3].body.tool_choice.type === 'none');
  ok('en het antwoord staat er', /Na drie rondes/.test(await p.evaluate(() => document.getElementById('aiFeed').innerText)));
  const voor = (await N.verzoeken(p)).length;
  await N.zet(p, zoek, zoek, zoek, zoek);
  await p.fill('#aiInput', 'Blijf zoeken'); await p.click('#aiSendBtn'); await p.waitForTimeout(1200);
  ok('blijft het model toch tools vragen: geen vijfde verzoek', (await N.verzoeken(p)).length === voor + 4);
  ok('maar een melding, en de vraag terug in het invoerveld', /kwam er niet uit/i.test(await p.evaluate(() => document.getElementById('aiFeed').innerText)) && await p.inputValue('#aiInput') === 'Blijf zoeken');

  ok('geen JS-fouten', errs.length === 0 && !(await p.evaluate(() => ErrorCenter.log.some(e => e.ctx === 'crash'))), errs[0]);
  console.log(`\n=== Coach-tools: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
