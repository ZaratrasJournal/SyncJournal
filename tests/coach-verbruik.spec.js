// AI-coach stap 4: verbruik en maandlimiet (docs/research-ai-coach-2026-10-25.md, §6.5).
//
// De app telt per maand de tokens uit `usage` (input, output, cache schrijven, cache lezen) en rekent die om naar
// dollars met de prijzen van Anthropic. Dat blijft lokaal: niet in export, back-up, Data overzetten of diagReport.
// Boven een eigen maandlimiet vraagt de coach om bevestiging vóór hij iets verstuurt. Het pakket wordt gecachet,
// zodat vervolgvragen goedkoper zijn. Nep-Anthropic uit helpers/coach-nep.js.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
const N = require('./helpers/coach-nep');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bijna = (a, b) => Math.abs(a - b) < 1e-9;

const tr = (id, date, pnl) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30 });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: [tr(1, '2026-10-01', 40), tr(2, '2026-10-02', -20)], settings: { currency: 'USD', theme: 'light' } });
  await N.installeer(p); await N.sleutel(p);
  await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); go('ai'); });
  const stuur = async (v, wacht) => { await p.fill('#aiInput', v); await p.click('#aiSendBtn'); await p.waitForTimeout(wacht || 400); };

  console.log('─── Kosten uit usage, met de prijzen van Anthropic ───');
  const U = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 2000, cache_read_input_tokens: 10000 };
  const k = await p.evaluate(u => ({ s: aiKosten('claude-sonnet-5-5', u), h: aiKosten('claude-haiku-5-5', u),
    hGroot: aiKosten('claude-haiku-5-5', { input_tokens: 90000, cache_read_input_tokens: 20000, output_tokens: 1000 }), datum: AI_PRIJZEN_DATUM }), U);
  // Sonnet 5.5: $2 in, $2,50 cache schrijven (5 min), $0,10 cache lezen, $10 uit, per miljoen tokens
  ok('Sonnet 5.5: (1000×2 + 2000×2,50 + 10000×0,10 + 500×10) / 1M = $0,013', bijna(k.s, 0.013), String(k.s));
  // Haiku 5.5 tot 100K prompt: $0,10 / $0,125 / $0,01 / $0,50
  ok('Haiku 5.5: $0,0007', bijna(k.h, 0.0007), String(k.h));
  // boven 100K prompt-tokens (input + cache) geldt het hogere tarief: $0,50 / $0,05 / $2,50
  ok('Haiku 5.5 boven 100K prompt: hoger tarief, (90000×0,50 + 20000×0,05 + 1000×2,50) / 1M', bijna(k.hGroot, (90000 * 0.5 + 20000 * 0.05 + 1000 * 2.5) / 1e6), String(k.hGroot));
  ok('de prijzen hebben een datum', /^\d{4}-\d{2}-\d{2}$/.test(k.datum), k.datum);

  console.log('─── Een antwoord telt mee ───');
  await p.evaluate(() => localStorage.removeItem('sj_ai_usage'));
  await N.zet(p, N.tekst('Kort antwoord.', { usage: { input_tokens: 1500, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0, output_tokens: 200 } }));
  await stuur('Waar lek ik geld?');
  const na1 = await p.evaluate(() => JSON.parse(localStorage.getItem('sj_ai_usage') || '{}'));
  const verwacht1 = (1500 * 2 + 3000 * 2.5 + 200 * 10) / 1e6;
  ok('tokens van deze maand opgeteld (input, output, cache)', na1.tokens && na1.tokens.input === 1500 && na1.tokens.output === 200 && na1.tokens.cacheSchrijven === 3000 && na1.tokens.cacheLezen === 0, JSON.stringify(na1));
  ok('in dollars: ' + verwacht1.toFixed(4), bijna(na1.usd, verwacht1), String(na1.usd));
  ok('één vraag geteld', na1.vragen === 1);
  ok('onder het antwoord: ≈ kosten', await p.evaluate(() => /≈ \$ 0,01/.test([...document.querySelectorAll('#aiFeed .aimsg.ai')].pop().innerText)));

  console.log('─── Prompt caching op het pakket ───');
  await N.zet(p, N.tekst('Vervolg.', { usage: { input_tokens: 40, cache_creation_input_tokens: 0, cache_read_input_tokens: 4500, output_tokens: 100 } }));
  await stuur('En mijn edge?');
  const vz = await N.verzoeken(p), v2 = vz[vz.length - 1].body;
  ok('het pakket in de systeemprompt heeft cache_control', (v2.system || []).some(x => /Data van de trader/.test(x.text) && x.cache_control && x.cache_control.type === 'ephemeral'));
  ok('en het gesprek wordt automatisch gecachet (cache_control bovenaan)', v2.cache_control && v2.cache_control.type === 'ephemeral', JSON.stringify(v2.cache_control));
  const na2 = await p.evaluate(() => JSON.parse(localStorage.getItem('sj_ai_usage')));
  ok('een vervolgvraag uit de cache is goedkoop: + (40×2 + 4500×0,10 + 100×10) / 1M', bijna(na2.usd - na1.usd, (40 * 2 + 4500 * 0.1 + 100 * 10) / 1e6), String(na2.usd - na1.usd));

  console.log('─── Instellingen toont het verbruik ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('ai'); });
  const inst = await p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
  ok('"deze maand ongeveer $ 0,01"', /deze maand ongeveer \$ 0,01/i.test(inst), inst.slice(inst.indexOf('Verbruik'), inst.indexOf('Verbruik') + 160));
  ok('met de uitleg dat het een schatting is', /schatting/i.test(inst));

  console.log('─── Verbruik blijft lokaal ───');
  const lekt = await p.evaluate(async () => {
    const s = JSON.stringify(snapshotPayload()) + JSON.stringify(dovBuildExport({}, true, null)) + JSON.stringify(await diagReport());
    return /ai_usage|cacheSchrijven|"vragen"/.test(s);
  });
  ok('niet in export, back-up, Data overzetten of diagReport', !lekt);

  console.log('─── Een nieuwe maand begint bij nul ───');
  await p.evaluate(() => { localStorage.setItem('sj_ai_usage', JSON.stringify({ maand: '2026-09', usd: 5, vragen: 40, tokens: { input: 1, output: 1, cacheSchrijven: 1, cacheLezen: 1 } })); });
  ok('vorige maand telt niet mee', await p.evaluate(() => aiVerbruik().usd === 0 && aiVerbruik().vragen === 0));

  console.log('─── Maandlimiet: eerst bevestigen ───');
  await p.evaluate(() => { localStorage.setItem('sj_ai_usage', JSON.stringify({ maand: aiMaand(), usd: 2.13, vragen: 9, tokens: { input: 0, output: 0, cacheSchrijven: 0, cacheLezen: 0 } })); go('instellingen'); setSetTab('ai'); });
  await p.fill('#aiLimiet', '2'); await p.dispatchEvent('#aiLimiet', 'change');
  ok('limiet bewaard', await p.evaluate(() => AIPREFS.limiet === 2));
  await p.evaluate(() => go('ai'));
  const voor = (await N.verzoeken(p)).length;
  await stuur('Boven de limiet?');
  const t = await p.evaluate(() => document.getElementById('aiFeed').innerText.replace(/\s+/g, ' '));
  ok('niets verstuurd zolang je niet bevestigt', (await N.verzoeken(p)).length === voor);
  ok('melding met verbruik en limiet', /\$ 2,13/.test(t) && /\$ 2,00/.test(t) && /limiet/i.test(t), t.slice(-240));
  ok('de vraag staat nog in het invoerveld', await p.inputValue('#aiInput') === 'Boven de limiet?');
  await N.zet(p, N.tekst('Toch beantwoord.'));
  await p.click('#aiLimietJa'); await p.waitForTimeout(400);
  ok('"Toch versturen" verstuurt hem alsnog', (await N.verzoeken(p)).length === voor + 1 && /Toch beantwoord/.test(await p.evaluate(() => document.getElementById('aiFeed').innerText)));
  await stuur('Nog een boven de limiet');
  await p.click('#aiLimietNee'); await p.waitForTimeout(150);
  ok('"Niet nu" verstuurt niets', (await N.verzoeken(p)).length === voor + 1 && await p.inputValue('#aiInput') === 'Nog een boven de limiet');

  console.log('─── Licht en donker, 390px ───');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const th of ['light', 'dark']) {
    await p.evaluate(x => { setTheme(x); go('ai'); }, th);
    await stuur('Limiet op een klein scherm', 200);
    ok(th + ': limiet-melding zonder zijwaarts scrollen', await p.evaluate(() => document.documentElement.scrollWidth <= 392 && !!document.getElementById('aiLimietJa')));
    await p.screenshot({ path: 'tests/screenshots/coach-limiet-390-' + th + '.png' }).catch(() => {});
    await p.click('#aiLimietNee');
    await p.evaluate(() => { go('instellingen'); setSetTab('ai'); });
    ok(th + ': Instellingen op 390px zonder zijwaarts scrollen', await p.evaluate(() => document.documentElement.scrollWidth <= 392));
  }

  // De app vangt crashes zelf op (foutbalk); die tellen ook. Een limiet invullen en wegklikken crashte eerst.
  await p.evaluate(() => { go('instellingen'); setSetTab('ai'); }); await p.fill('#aiLimiet', '3'); await p.click('h3, .setintro'); await p.waitForTimeout(150);
  ok('limiet invullen en wegklikken: geen crash', await p.evaluate(() => AIPREFS.limiet === 3 && !ErrorCenter.log.some(e => e.ctx === 'crash')), JSON.stringify(await p.evaluate(() => ErrorCenter.log[0] || null)));
  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Coach-verbruik: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
