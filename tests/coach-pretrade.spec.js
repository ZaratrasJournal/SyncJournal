// AI-coach stap 7: "Check mijn trade-idee" (docs/research-ai-coach-2026-10-25.md, §8).
//
// Een kort formulier (pair, richting, setup, entry, stop, eventueel TP). De coach toetst het idee aan de eigen cijfers
// voor die setup en, als TradingPlan er is, aan de regels uit het plan. Geen koop- of verkoopadvies: hij zegt wat de
// eigen data en regels erover zeggen. De journal rekent de geplande R:R uit, niet het model.
// Nep-Anthropic uit helpers/coach-nep.js.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
const N = require('./helpers/coach-nep');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const tr = (id, date, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });
const TRADES = [tr(1, '2026-10-01', 40), tr(2, '2026-10-02', -20), tr(3, '2026-10-05', 30, { session: 'US AM' }), tr(4, '2026-10-06', -10, { setup: 'Trend-pullback', dir: 'short', pair: 'ETH/USDT' })];
const PB = { 'London SFP': { name: 'London SFP', criteria: [{ text: 'Sweep van de Asia-low', mandatory: true }], antiCriteria: [{ text: 'Vlak voor high-impact nieuws', mandatory: true }], stop: 'onder de sweep', target: 'volgende pool', minRR: '2' } };
// TradingPlan (v3) schrijft in localStorage tp3:*; wij lezen alleen. Het weekplan van deze ISO-week en de dag van vandaag (Amsterdam).
const vandaag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());
const isoWeek = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0'); };
const WID = isoWeek(vandaag), sc = (id, title, dir) => ({ id, title, pair: 'BTC', dir, pb: 'London SFP', grade: 'A', trigger: 'Als de Asia-low gesweept wordt', invalid: '15M close onder de sweep', entry: { tf: '15M', bias: '', setups: ['SFP'], confirmations: [] }, off: [], checked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] });
const PLAN = {
  'tp3:cfg': JSON.stringify({ stijl: 'daytrade', risk: { A: 2, B: 1, C: 0 }, pre: ['Nieuws gecheckt', 'Goed geslapen', ''] }),
  'tp3:plans': JSON.stringify({ v: 1, weeks: { [WID]: { id: WID, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }], levels: 'bullish boven 78k', noTrade: 'Binnen 2 minuten na nieuws · Na 2 verliezers op één dag', focus: 'Alleen A-setups', media: { imgs: [], links: [] }, les: '' } },
    days: { [vandaag]: { id: vandaag, week: WID, layers: [], levels: '', mental: 4, pre: [true, true, false], media: { imgs: [], links: [] }, les: '', scenarios: [sc('s_l', 'SFP onderzijde', 'long'), sc('s_s', 'SFP bovenzijde (mag NIET mee bij long)', 'short')] } } }),
};

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: TRADES, pbook: PB, settings: { currency: 'USD', theme: 'light' } });
  await N.installeer(p); await N.sleutel(p);
  await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); go('ai'); });
  const vul = async v => { for (const [id, x] of Object.entries(v)) { if (id === 'aiIdeeDir' || id === 'aiIdeeSetup') await p.selectOption('#' + id, x); else await p.fill('#' + id, x); } };
  const knopUit = () => p.evaluate(() => document.getElementById('aiIdeeBtn').disabled);
  const pakketUit = body => ((body.system || []).find(x => /Data van de trader/.test(x.text)) || { text: '' }).text;

  console.log('─── Het formulier ───');
  ok('knop "Check mijn trade-idee"', await p.locator('#aiIdeeOpen').count() === 1 && /Check mijn trade-idee/.test(await p.textContent('#aiIdeeOpen')));
  await p.click('#aiIdeeOpen');
  ok('velden: pair, richting, setup, entry, stop, TP', await p.evaluate(() => ['aiIdeePair', 'aiIdeeDir', 'aiIdeeSetup', 'aiIdeeEntry', 'aiIdeeStop', 'aiIdeeTp'].every(id => !!document.getElementById(id))));
  ok('de setups uit je playbook en je trades staan in de keuzelijst', await p.evaluate(() => { const o = [...document.querySelectorAll('#aiIdeeSetup option')].map(x => x.value); return o.includes('London SFP') && o.includes('Trend-pullback'); }));
  ok('leeg: versturen staat uit', await knopUit());
  await vul({ aiIdeePair: 'BTC/USDT', aiIdeeDir: 'long', aiIdeeSetup: 'London SFP', aiIdeeEntry: '100', aiIdeeStop: '102' });
  ok('stop boven de entry bij long: uit, met uitleg', await knopUit() && /stop.*onder.*entry/i.test(await p.textContent('#aiIdeeHint')), await p.textContent('#aiIdeeHint'));
  await vul({ aiIdeeStop: '98', aiIdeeTp: '106' });
  ok('alles klopt: versturen kan', !(await knopUit()));
  ok('de geplande R:R rekent de journal uit: 3,00R', /3,00R/.test(await p.textContent('#aiIdeeHint')), await p.textContent('#aiIdeeHint'));

  console.log('─── Zonder TradingPlan ───');
  await N.zet(p, N.tekst('Je London SFP heeft n=3 (uit je setuptabel).'));
  await p.click('#aiIdeeBtn'); await p.waitForTimeout(500);
  let body = (await N.verzoeken(p)).slice(-1)[0].body, pk = pakketUit(body);
  ok('het idee staat in het pakket', /# Trade-idee/.test(pk) && /BTC\/USDT long · setup London SFP · entry 100 · stop 98 · TP 106/.test(pk), pk.slice(0, 600));
  ok('met de R:R en stop-afstand van de journal', /Gepland R:R \(uitgerekend door de journal\): 3,00R/.test(pk) && /Stop-afstand: 2,00% van de entry/.test(pk));
  ok('de cijfers van deze setup, per sessie en richting', /## Deze setup \(London SFP\)\n- n=3 · /.test(pk) && /## Deze setup per sessie/.test(pk) && /- London: n=2/.test(pk), (pk.match(/## Deze setup[\s\S]{0,300}/) || [''])[0]);
  ok('de cijfers van dit symbool', /## Dit symbool \(BTC\/USDT\)\n- n=3 · /.test(pk));
  ok('de playbook-regels uit je journal', /Sweep van de Asia-low/.test(pk) && /Vlak voor high-impact nieuws/.test(pk) && /min R:R: 2/i.test(pk));
  ok('zegt dat er geen TradingPlan is', /Geen TradingPlan-gegevens/.test(pk));
  ok('opdracht: geen koop- of verkoopadvies', (body.system || []).some(x => /Opdracht voor deze vraag/.test(x.text) && /geen koop- of verkoopadvies/i.test(x.text)));
  ok('het idee staat als vraag in het gesprek', /Check mijn trade-idee: BTC\/USDT long/.test(await p.evaluate(() => document.getElementById('aiFeed').innerText)));
  ok('alleen het nodige: geen recente-tradeslijst', !/## Recente trades/.test(pk));

  console.log('─── Met TradingPlan ───');
  await p.evaluate(pl => { Object.entries(pl).forEach(([k, v]) => localStorage.setItem(k, v)); }, PLAN);
  await p.click('#aiIdeeOpen'); await vul({ aiIdeePair: 'BTC/USDT', aiIdeeDir: 'long', aiIdeeSetup: 'London SFP', aiIdeeEntry: '100', aiIdeeStop: '98', aiIdeeTp: '106' });
  await N.zet(p, N.tekst('Volgens je weekplan mag je er nog trades bij.'));
  await p.click('#aiIdeeBtn'); await p.waitForTimeout(500);
  pk = pakketUit((await N.verzoeken(p)).slice(-1)[0].body);
  ok('weekplan: lagen, levels, no-trade, focus', /## Regels uit TradingPlan/.test(pk) && /Weekly Bullish: BOS/.test(pk) && /bullish boven 78k/.test(pk) && /Na 2 verliezers op één dag/.test(pk) && /Alleen A-setups/.test(pk), (pk.match(/## Regels uit TradingPlan[\s\S]{0,500}/) || [''])[0]);
  ok('de scenario\'s van vandaag voor een long, niet die voor short', /SFP onderzijde/.test(pk) && !/mag NIET mee bij long/.test(pk));
  ok('risico per grade uit het plan', /Risico per grade: A 2%, B 1%, C niet traden/.test(pk));
  ok('de journal telt mee: trades deze week en verliezers vandaag', /Trades deze week in de journal: \d+/.test(pk) && /Verliezers vandaag in de journal: \d+/.test(pk));

  console.log('─── Licht en donker, 390px ───');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const th of ['light', 'dark']) {
    await p.evaluate(x => { setTheme(x); go('ai'); }, th);
    await p.click('#aiIdeeOpen');
    ok(th + ': formulier past op 390px', await p.evaluate(() => document.documentElement.scrollWidth <= 392 && !!document.getElementById('aiIdeeEntry')));
    await p.screenshot({ path: 'tests/screenshots/coach-idee-390-' + th + '.png' }).catch(() => {});
    await p.click('#aiIdeeSluit');
  }

  ok('geen JS-fouten', errs.length === 0 && !(await p.evaluate(() => ErrorCenter.log.some(e => e.ctx === 'crash'))), errs[0]);
  console.log(`\n=== Coach-pretrade: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
