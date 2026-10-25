// AI-coach stap 3: foutstaten en streaming (docs/research-ai-coach-2026-10-25.md, §7).
//
// Elke fout krijgt een melding in gewone taal met een volgende stap, en de vraag blijft in het invoerveld staan.
// Het antwoord verschijnt terwijl het binnenkomt (stream: true, server-sent events), met een knop Stop.
// Nep-Anthropic uit helpers/coach-nep.js: geen echte sleutel, geen echte aanroep.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
const N = require('./helpers/coach-nep');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const tr = (id, date, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: [tr(1, '2026-10-01', 40), tr(2, '2026-10-02', -20, { emotions: ['FOMO'] })], settings: { currency: 'USD', theme: 'light' } });
  await N.installeer(p); await N.sleutel(p);
  await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); go('ai'); });
  const feed = () => p.evaluate(() => document.getElementById('aiFeed').innerText.replace(/\s+/g, ' '));
  const stuur = async (v) => { await p.fill('#aiInput', v); await p.click('#aiSendBtn'); };

  console.log('─── Een gestreamd antwoord, in stukjes ───');
  const ANTWOORD = 'Je grootste lek is **FOMO** (uit je emotietabel: n=1). Actie voor volgende week: geen instap zonder retest.';
  await N.zet(p, N.tekst(ANTWOORD, { stukjes: 8, pauze: 120 }));
  await stuur('Waar lek ik geld?');
  await p.waitForTimeout(1100);   // ~6 events before the first text, 120 ms apart
  const halverwege = await p.evaluate(() => (document.querySelector('#aiFeed .aimsg.ai.ailive .aibub') || {}).innerText || '');
  ok('tijdens het streamen staat er al een deel', halverwege.length > 5 && halverwege.length < ANTWOORD.length - 10, JSON.stringify(halverwege));
  ok('met een knop Stop, en geen Stuur', await p.locator('#aiStopBtn').count() === 1 && await p.locator('#aiSendBtn').count() === 0);
  await p.waitForTimeout(1600);
  ok('daarna het hele antwoord, met markdown', await p.evaluate(() => [...document.querySelectorAll('#aiFeed .aimsg.ai b')].some(x => x.textContent === 'FOMO')) && /geen instap zonder retest/.test(await feed()));
  ok('het verzoek vraagt om streaming', (await N.verzoeken(p))[0].body.stream === true);
  ok('na afloop weer Stuur en een leeg invoerveld', await p.locator('#aiSendBtn').count() === 1 && await p.inputValue('#aiInput') === '');

  console.log('─── Stop ───');
  await N.zet(p, N.tekst('Eerste zin van een lang antwoord. Tweede zin die je nooit gaat zien omdat je op Stop drukt.', { stukjes: 12, pauze: 150 }));
  await stuur('Waar zit mijn edge?');
  await p.waitForTimeout(1300);
  await p.click('#aiStopBtn'); await p.waitForTimeout(300);
  const gestopt = await p.evaluate(() => { const m = [...document.querySelectorAll('#aiFeed .aimsg.ai')].pop(); return m ? m.innerText : ''; });
  ok('het deel dat er was blijft staan, gemarkeerd als gestopt', /Eerste zin/.test(gestopt) && /gestopt/i.test(gestopt) && !/nooit gaat zien/.test(gestopt), gestopt);
  ok('na Stop kun je weer typen', await p.locator('#aiSendBtn').count() === 1 && !(await p.evaluate(() => document.getElementById('aiInput').disabled)));

  console.log('─── Fouten: melding, volgende stap, vraag blijft staan ───');
  const gevallen = [
    ['401 ongeldige sleutel', N.fout(401, 'authentication_error', 'invalid x-api-key'), /Anthropic herkent deze sleutel niet.*Vergeet sleutel/],
    ['400 geen tegoed', N.fout(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'), /tegoed bij Anthropic is op/],
    ['400 limiet bij Anthropic', N.fout(400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01.'), /limiet bij Anthropic bereikt/],
    ['403 geen rechten', N.fout(403, 'permission_error', 'Your API key does not have permission to use the specified resource.'), /mag dit niet/],
    ['429 te veel verzoeken', N.fout(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit'), /over een minuut/],
    ['529 overbelast', N.fout(529, 'overloaded_error', 'Overloaded'), /overbelast/],
    ['500 storing', N.fout(500, 'api_error', 'Internal server error'), /niet bij jou/],
    ['geen netwerk', { netwerk: true }, /Geen verbinding/],
    ['fout midden in de stream', { sse: [N.ev('message_start', { message: { usage: { input_tokens: 10, output_tokens: 1 } } }), N.ev('error', { error: { type: 'overloaded_error', message: 'Overloaded' } })] }, /overbelast/],
  ];
  for (const [naam, antwoord, re] of gevallen) {
    await N.zet(p, antwoord);
    const v = 'Vraag bij ' + naam;
    await stuur(v); await p.waitForTimeout(350);
    const laatste = await p.evaluate(() => { const m = [...document.querySelectorAll('#aiFeed .aimsg')].pop(); return m ? m.className + ' | ' + m.innerText.replace(/\s+/g, ' ') : ''; });
    ok(naam + ': melding', /fout/.test(laatste) && re.test(laatste), laatste);
    ok(naam + ': vraag terug in het invoerveld', await p.inputValue('#aiInput') === v, await p.inputValue('#aiInput'));
  }

  console.log('─── Time-out ───');
  await p.evaluate(() => { AI_TIMEOUT_MS = 600; });
  await N.zet(p, { hangt: true });
  await stuur('Blijft dit hangen?'); await p.waitForTimeout(1200);
  ok('geen antwoord binnen de tijd: melding', /reageert niet/.test(await feed()), (await feed()).slice(-200));
  ok('en de vraag staat er nog', await p.inputValue('#aiInput') === 'Blijft dit hangen?');
  await p.evaluate(() => { AI_TIMEOUT_MS = 45000; });

  console.log('─── 390px breed, licht en donker ───');
  await p.setViewportSize({ width: 390, height: 844 });
  for (const th of ['light', 'dark']) {
    await p.evaluate(x => { setTheme(x); go('ai'); }, th);
    await N.zet(p, N.tekst('Kort antwoord op een smal scherm, met een lange regel die netjes moet afbreken in de bubbel zonder dat de pagina zijwaarts gaat schuiven.', { stukjes: 6, pauze: 120 }));
    await stuur('Hoe ging mijn laatste trade?'); await p.waitForTimeout(250);
    ok(th + ': streaming op 390px zonder zijwaarts scrollen', await p.evaluate(() => document.documentElement.scrollWidth <= 392), String(await p.evaluate(() => document.documentElement.scrollWidth)));
    await p.screenshot({ path: 'tests/screenshots/coach-stream-390-' + th + '.png' }).catch(() => {});
    await p.waitForTimeout(900);
  }

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Coach-stream: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
