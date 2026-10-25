// AI-coach: de eigen Anthropic-sleutel en één echte vraag (docs/research-ai-coach-2026-10-25.md, §5–§7).
//
// Er gaat NOOIT een echte sleutel of een echte aanroep door deze spec: https://api.anthropic.com/v1/messages
// wordt onderschept en beantwoord met een nep-antwoord. Wat we toetsen:
//  - de aanroep zelf: juiste URL, headers, model, en het pakket uit coachPakket() als bron;
//  - de sleutel blijft op het apparaat: niet in exportJSON, de back-up (snapshotPayload + snapshot in
//    IndexedDB), "Data overzetten" (dovBuildExport) of diagReport; "alleen deze sessie" schrijft niets in
//    localStorage;
//  - het antwoord wordt ge-escaped (geen HTML uit het model in de pagina), met simpele markdown;
//  - de toestanden: geen sleutel, testen, ongeldige sleutel (401), bezig, geen netwerk, geen trades,
//    filter laat niets over; in licht én donker.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const API = 'https://api.anthropic.com/v1/messages';
const NEP = 'sk-ant-api03-NEPSLEUTEL-alleen-voor-deze-spec-WXYZ';   // geen echte sleutel
const NOTITIE = 'Wachtte niet op de retest bij de London open';
const tr = (id, date, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });
const TRADES = [tr(1, '2026-10-01', 40), tr(2, '2026-10-02', -20, { notes: NOTITIE, emotions: ['FOMO'] }), tr(3, '2026-10-05', 30, { session: 'US AM' })];
const antwoord = (tekst, extra) => ({ id: 'msg_nep', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: tekst }], usage: { input_tokens: 900, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...extra });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  // Nep-Anthropic. `gedrag` bepaalt het volgende antwoord; elk verzoek wordt bewaard.
  const verzoeken = []; let gedrag = { status: 200, body: antwoord('OK') }, vertraging = 0;
  await p.route(API, async r => {
    verzoeken.push({ url: r.request().url(), method: r.request().method(), headers: r.request().headers(), body: JSON.parse(r.request().postData() || '{}') });
    if (vertraging) await new Promise(res => setTimeout(res, vertraging));
    if (gedrag.abort) return r.abort('internetdisconnected');
    return r.fulfill({ status: gedrag.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(gedrag.body) });
  });
  await H.seed(p, { app: 'SyncJournal', trades: TRADES, settings: { currency: 'USD', theme: 'light' } });
  await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); go('ai'); });
  const main = () => p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
  const koppel = async (sleutel, sessie) => { await p.fill('#aiKeyInput', sleutel); if (sessie) await p.check('#aiKeySessie'); await p.click('#aiKeyBtn'); };
  const vraag = async (tekst) => { await p.fill('#aiInput', tekst); await p.click('#aiSendBtn'); await p.waitForTimeout(400); };

  console.log('─── Geen sleutel ───');
  let t = await main();
  ok('stappenplan en kostenindicatie', /Zet je echte coach aan/.test(t) && /30 cent tot een dollar per maand/.test(t) && /console\.anthropic\.com/.test(t), t.slice(0, 200));
  ok('één gemarkeerd voorbeeldgesprek', /voorbeeld · zo ziet een gesprek eruit/i.test(t) && await p.locator('.aivb').count() === 1);
  ok('de regel over wat er meegaat', t.includes('Je cijfers en notities gaan mee naar de coach. Uitzetten kan in Instellingen.'));
  ok('geen invoerveld voor vragen zonder sleutel', await p.locator('#aiInput').count() === 0);
  ok('geen "Vraag de coach" bij een trade zonder sleutel', await p.evaluate(() => { go('review'); const n = document.querySelectorAll('[data-ai-vraag]').length; go('ai'); return n === 0; }));

  console.log('─── Ongeldige sleutel (401) ───');
  gedrag = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
  await koppel('sk-ant-fout'); await p.waitForTimeout(400);
  t = await main();
  ok('melding: Anthropic herkent de sleutel niet', /Anthropic herkent deze sleutel niet/.test(t), t.slice(0, 300));
  ok('een ongeldige sleutel wordt niet bewaard', await p.evaluate(() => !localStorage.getItem('sj_ai_key') && !sessionStorage.getItem('sj_ai_key')));

  gedrag = { abort: true };
  await koppel('sk-ant-zonder-netwerk'); await p.waitForTimeout(400);
  ok('geen netwerk bij koppelen: melding, niets bewaard', /Geen verbinding met Anthropic/.test(await main()) && await p.evaluate(() => !localStorage.getItem('sj_ai_key')));

  console.log('─── Sleutel testen en koppelen (op dit apparaat) ───');
  gedrag = { status: 200, body: antwoord('OK') }; vertraging = 600; verzoeken.length = 0;
  await koppel(NEP); await p.waitForTimeout(150);
  ok('tijdens het testen: knop uit en "testen…"', await p.evaluate(() => { const b = document.getElementById('aiKeyBtn'); return !!b && b.disabled && /testen/i.test(document.getElementById('main').innerText); }));
  await p.waitForTimeout(800); vertraging = 0;
  const test = verzoeken[0] || { headers: {}, body: {} };
  ok('testaanroep naar ' + API, test.url === API && test.method === 'POST', test.url);
  ok('header x-api-key = de ingevulde sleutel', test.headers['x-api-key'] === NEP);
  ok('header anthropic-version = 2026-10-21', test.headers['anthropic-version'] === '2026-10-21', test.headers['anthropic-version']);
  ok('header anthropic-dangerous-direct-browser-access = true', test.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  ok('content-type json', /application\/json/.test(test.headers['content-type'] || ''));
  ok('model claude-sonnet-5-5 (standaard)', test.body.model === 'claude-sonnet-5-5', test.body.model);
  ok('geen temperature (de API-versie weigert die)', !('temperature' in test.body));
  ok('sleutel lokaal bewaard', await p.evaluate(k => localStorage.getItem('sj_ai_key') === k, NEP));
  t = await main();
  ok('na koppelen: invoerveld en "gekoppeld …WXYZ"', await p.locator('#aiInput').count() === 1 && /…WXYZ/.test(t), t.slice(0, 200));
  ok('de volledige sleutel staat niet in de pagina', !(await p.content()).includes(NEP));

  console.log('─── Een echte vraag, met het pakket ───');
  gedrag = { status: 200, body: antwoord('Je grootste lek is **FOMO** (uit je emotietabel: n=1).\n\n- eerste punt\n- tweede punt\n\n<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>') };
  verzoeken.length = 0;
  await vraag('Waar lek ik geld?');
  const v = verzoeken[0] || { headers: {}, body: {} };
  const pakket = await p.evaluate(() => coachPakket({}).tekst);
  const sys = JSON.stringify(v.body.system || '');
  ok('de vraag gaat als laatste bericht mee', (v.body.messages || []).slice(-1)[0]?.content === 'Waar lek ik geld?', JSON.stringify(v.body.messages));
  ok('het pakket staat in de systeemprompt', sys.includes(JSON.stringify(pakket).slice(1, -1)));
  ok('de systeemprompt zegt: niet zelf rekenen', /reken niet zelf/i.test(sys));
  ok('notities gaan standaard mee', sys.includes(NOTITIE));
  ok('vet wordt <b>', await p.evaluate(() => [...document.querySelectorAll('#aiFeed .aimsg.ai b')].some(x => x.textContent === 'FOMO')));
  ok('lijstje wordt <li>', await p.evaluate(() => document.querySelectorAll('#aiFeed .aimsg.ai li').length === 2));
  ok('HTML uit het antwoord wordt tekst, geen element', await p.evaluate(() => !window.__xss && !document.querySelector('#aiFeed img, #aiFeed script') && /<script>/.test(document.getElementById('aiFeed').innerText)));
  ok('"Wat is er verstuurd?" toont precies het pakket', await p.evaluate(pk => { const d = [...document.querySelectorAll('#aiFeed details')].pop(); return !!d && /Wat is er verstuurd/.test(d.querySelector('summary').textContent) && d.querySelector('pre').textContent === pk; }, pakket));

  console.log('─── Bezig met antwoorden ───');
  vertraging = 600;
  await p.fill('#aiInput', 'Review mijn week'); await p.click('#aiSendBtn'); await p.waitForTimeout(150);
  ok('typ-indicator, invoer uit en een knop Stop', await p.evaluate(() => /Coach denkt na/.test((document.querySelector('#aiFeed .ailive') || {}).innerText || '') && document.getElementById('aiInput').disabled && !!document.getElementById('aiStopBtn')));
  await p.waitForTimeout(800); vertraging = 0;
  ok('vervolgvraag stuurt het eerdere gesprek mee', (verzoeken.slice(-1)[0].body.messages || []).length === 3, JSON.stringify((verzoeken.slice(-1)[0].body.messages || []).map(m => m.role)));

  console.log('─── Sleutel niet in export, back-up, Data overzetten of diagReport ───');
  const lekt = await p.evaluate(async k => {
    let blobTekst = ''; const echt = URL.createObjectURL; URL.createObjectURL = bl => { bl.text().then(x => { blobTekst = x; }); return 'blob:nep'; };
    exportJSON(); URL.createObjectURL = echt; await new Promise(r => setTimeout(r, 200));
    await Snapshots.create('spec'); const snaps = []; for (const m of SNAP_META) snaps.push(JSON.stringify(await IDB.get('snap_' + m.id)));
    return { export: blobTekst.length > 100 && blobTekst.includes(k), exportLeeg: blobTekst.length < 100, backup: JSON.stringify(snapshotPayload()).includes(k), snapshot: snaps.some(s => s.includes(k)),
      dov: JSON.stringify(dovBuildExport({}, true, null)).includes(k), diag: JSON.stringify(await diagReport()).includes(k) };
  }, NEP);
  ok('exportJSON bevat de sleutel niet', !lekt.exportLeeg && !lekt.export, JSON.stringify(lekt));
  ok('de back-up (snapshotPayload) bevat hem niet', !lekt.backup);
  ok('de veiligheidskopie in IndexedDB bevat hem niet', !lekt.snapshot);
  ok('"Data overzetten" bevat hem niet, ook niet met sleutels aan', !lekt.dov);
  ok('diagReport bevat hem niet', !lekt.diag);

  console.log('─── Instellingen: model en notities ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('ai'); });
  t = await main();
  ok('Instellingen toont de sleutel (…WXYZ) en "Vergeet sleutel"', /…WXYZ/.test(t) && /Vergeet sleutel/.test(t), t.slice(0, 400));
  await p.click('[data-ai-model="claude-haiku-5-5"]');
  await p.click('[data-ai-notes]');
  await p.evaluate(() => go('ai')); verzoeken.length = 0;
  await vraag('En mijn discipline?');
  const v2 = verzoeken[0] || { body: {} };
  ok('model claude-haiku-5-5 na de keuze in Instellingen', v2.body.model === 'claude-haiku-5-5', v2.body.model);
  ok('notities uit: notitie gaat niet mee', !JSON.stringify(v2.body.system || '').includes(NOTITIE));
  await p.evaluate(() => { AIPREFS.hideAmounts = true; persistAIPrefs(); render(); }); verzoeken.length = 0;
  await vraag('Hoe ging het?');
  ok('bedragen verbergen: geen $ in wat er verstuurd wordt', !/\$/.test(JSON.stringify((verzoeken[0] || { body: {} }).body.system || '')));
  await p.evaluate(() => { AIPREFS.hideAmounts = false; AIPREFS.notes = true; AIPREFS.model = 'claude-sonnet-5-5'; persistAIPrefs(); render(); });

  console.log('─── Fouten tijdens een vraag ───');
  gedrag = { abort: true };
  await vraag('Wat ging er mis?');
  t = await main();
  ok('geen netwerk: melding en vraag terug in het invoerveld', /Geen verbinding/.test(t) && await p.inputValue('#aiInput') === 'Wat ging er mis?', t.slice(-300));
  gedrag = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
  await vraag('Nog een keer');
  ok('401 tijdens een vraag: sleutel niet (meer) geldig', /Anthropic herkent deze sleutel niet/.test(await main()));
  gedrag = { status: 200, body: antwoord('OK') };

  console.log('─── Geen trades / filter laat niets over ───');
  await p.evaluate(() => { setFilter('kind', 'backtest'); go('ai'); });
  t = await main();
  ok('filter laat niets over: eigen melding, geen invoer', /In je huidige filter staan geen gesloten trades/.test(t) && await p.locator('#aiInput').count() === 0, t.slice(0, 300));
  await p.evaluate(() => { setFilter('kind', 'alle'); });
  const bewaard = await p.evaluate(() => JSON.stringify(T));
  await p.evaluate(() => { T = []; persist(); render(); go('ai'); });
  t = await main();
  ok('geen trades: "Nog geen trades", geen invoer', /Nog geen trades/.test(t) && await p.locator('#aiInput').count() === 0, t.slice(0, 300));
  await p.evaluate(s => { T = JSON.parse(s); persist(); render(); }, bewaard);

  console.log('─── "Vraag de coach" bij een trade ───');
  const knop = await p.evaluate(() => { go('review'); const k = document.querySelector('[data-ai-vraag]'); if (!k) return null; const id = k.dataset.aiVraag; k.click(); return id; });
  ok('knop staat in het trade-detail als er een sleutel is', knop != null);
  ok('opent de coach met de trade klaargezet', await p.evaluate(() => STATE.page === 'ai' && /Trade in focus/.test(document.getElementById('main').innerText) && !!document.getElementById('aiInput').value));
  verzoeken.length = 0; await p.click('#aiSendBtn'); await p.waitForTimeout(400);
  ok('de vraag stuurt het pakket met die trade in focus', /## Trade in focus\\n- #/.test(JSON.stringify((verzoeken[0] || { body: {} }).body.system || '')));

  console.log('─── Licht en donker ───');
  for (const th of ['light', 'dark']) {
    await p.evaluate(x => { setTheme(x); go('ai'); }, th); await p.waitForTimeout(200);
    ok('coach-pagina in ' + th + ' zonder fouten', await p.evaluate(() => !!document.getElementById('aiFeed')) && errs.length === 0, errs[0]);
    await p.screenshot({ path: 'tests/screenshots/coach-chat-' + th + '.png' }).catch(() => {});
  }

  console.log('─── Een achtergrond-render wist niet wat je typt ───');
  await p.evaluate(() => go('ai')); await p.fill('#aiInput', 'half getypte vraag');
  await p.evaluate(() => render()); await p.waitForTimeout(50);
  ok('vraag in wording blijft staan na render()', await p.inputValue('#aiInput') === 'half getypte vraag');
  await p.fill('#aiInput', '');

  console.log('─── Alleen deze sessie ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('ai'); });
  await p.click('[data-ai-vergeet]');
  ok('"Vergeet sleutel" wist hem', await p.evaluate(() => !localStorage.getItem('sj_ai_key') && !sessionStorage.getItem('sj_ai_key')));
  await p.evaluate(() => go('ai'));
  await p.fill('#aiKeyInput', NEP); await p.evaluate(() => render()); await p.waitForTimeout(50);
  ok('sleutel in wording blijft staan na render(), maar niet in de HTML', await p.inputValue('#aiKeyInput') === NEP && !(await p.content()).includes(NEP));
  await p.fill('#aiKeyInput', '');
  await koppel(NEP, true); await p.waitForTimeout(400);
  const opslag = await p.evaluate(k => ({ ls: Object.keys(localStorage).some(x => (localStorage.getItem(x) || '').includes(k)), ss: sessionStorage.getItem('sj_ai_key') === k, chat: !!document.getElementById('aiInput') }), NEP);
  ok('"alleen deze sessie": niets met de sleutel in localStorage', !opslag.ls);
  ok('wel in sessionStorage, en de coach werkt', opslag.ss && opslag.chat, JSON.stringify(opslag));

  console.log('─── Coach uitgezet in Instellingen ───');
  await p.evaluate(() => { toggleAICoach(); go('ai'); });
  ok('"AI-coach staat uit", geen invoer, en de keuze blijft bewaard', /AI-coach staat uit/.test(await main()) && await p.locator('#aiInput').count() === 0 && await p.evaluate(() => JSON.parse(localStorage.getItem('sj_ai_prefs')).enabled === false));
  ok('dan ook geen 🤖-knop bij een trade', await p.evaluate(() => { go('review'); return document.querySelectorAll('[data-ai-vraag]').length === 0; }));
  await p.evaluate(() => { toggleAICoach(); });

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Coach-sleutel: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
