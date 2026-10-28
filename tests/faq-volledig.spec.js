// De FAQ moet de onderwerpen dekken die in het menu staan. Aanleiding (28-09-2026): bij het
// nalopen bleken vier gaten — het overzetten uit de oude TradeJournal (wat leden juist nú doen),
// de Plan-pagina (een menu-item zonder één woord uitleg), handmatige accounts, en updates.
// Deze spec houdt ze aanwezig en bewaakt dat de paden erin naar bestaande UI verwijzen.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} go('faq'); });
  await p.waitForTimeout(500);
  ok('FAQ opent zonder JS-fouten', errs.length === 0, errs[0]);

  // De antwoorden staan ingeklapt, dus innerText geeft alleen de vragen. De tekst zelf staat
  // wél in de DOM — daarom innerHTML voor de inhoud en innerText voor wat de gebruiker ziet.
  const zichtbaar = await p.evaluate(() => document.getElementById('main').innerText);
  const tekst = await p.evaluate(() => document.getElementById('main').innerHTML);
  ok('de FAQ heeft inhoud', tekst.length > 20000, 'lengte: ' + tekst.length);
  // Since the tiles layout (faq-tegels) one topic shows at a time; every question is still in the DOM
  // and the overview shows a tile per topic.
  const vragen = await p.evaluate(() => document.querySelectorAll('#main details.faq summary').length);
  ok('er staan minstens 40 vragen in de FAQ', vragen >= 40, 'gevonden: ' + vragen);
  ok('het overzicht toont de onderwerpen als tegels', /Kies een onderwerp/i.test(zichtbaar) && (zichtbaar.match(/\d+ vragen/g) || []).length >= 9);

  console.log('─── Onderwerpen die gedekt moeten zijn ───');
  for (const [naam, zoek] of [
    ['overzetten uit de oude TradeJournal', /oude TradeJournal/i],
    ['het Trading Plan', /Trading Plan/],
    ['handmatige accounts', /Handmatige accounts/],
    ['updates', /nieuwe versie/i],
    ['back-ups', /back-?up/i],
    ['API-keys', /API-key/i],
    ['R-multiple', /R-multiple/i],
  ]) ok(naam, zoek.test(tekst));

  console.log('─── De paden in de FAQ bestaan ook echt ───');
  // Een FAQ die naar een knop wijst die niet bestaat is erger dan geen FAQ (v0.9.152).
  const bestaat = await p.evaluate(() => {
    const body = document.body.innerHTML;
    return {
      verbinden: /Verbinden/.test(body) || /exlist/.test(body),
      toevoegen: /\+ Toevoegen/.test(body) || /maadd/.test(body),
      geenOudeKnop: !/\+ Account toevoegen/.test(document.getElementById('main').innerHTML),
    };
  });
  ok('de knop "Verbinden" bestaat in de app', bestaat.verbinden);
  ok('de knop "+ Toevoegen" bestaat in de app', bestaat.toevoegen);
  ok('de FAQ noemt "+ Account toevoegen" niet meer', bestaat.geenOudeKnop);

  console.log('─── 🗓️ Je trading plan (TradingPlan v3 en Mori in het plan) ───');
  const plan = await p.evaluate(() => { const ci = FAQS.findIndex(c => c[0] === '🗓️ Je trading plan'), ts = FAQS.findIndex(c => /Trades bijhouden/.test(c[0]));
    const items = ci < 0 ? [] : FAQS[ci][1]; return { ci, ts, desc: FAQ_DESC['🗓️'] || '', vragen: items.map(x => x[0]), tekst: items.map(x => x[0] + ' ' + faqPlain(x[1])).join(' '),
      alles: faqPlain(FAQS.flatMap(c => c[1].map(x => x[1])).join(' ')), populair: FAQ_POPULAR.some(q => items.some(x => x[0] === q)), suggestie: FAQ_SUGGEST.includes('scenario') }; });
  ok('de categorie bestaat, direct na "Trades bijhouden", met een korte uitleg', plan.ci > 0 && plan.ci === plan.ts + 1 && plan.desc.length > 10, JSON.stringify({ ci: plan.ci, ts: plan.ts }));
  for (const re of [/^Wat is het Trading Plan\?$/, /^Wat zeggen de cijfers bij een scenario\?$/, /^Hoe koppel ik een trade aan een scenario\?$/, /^Kan Mori mijn plan bekijken\?$/])
    ok('vraag aanwezig: ' + re.source, plan.vragen.some(q => re.test(q)), plan.vragen.join(' | '));
  ok('geen antwoord zegt meer dat de journal zelf koppelt', !/koppelt de journal zelf|binnen 45 minuten|het kortst vóór ligt/.test(plan.alles));
  ok('"nooit vanzelf gekoppeld" staat erin', /nooit vanzelf gekoppeld/.test(plan.tekst));
  ok('één plan-vraag is populair, "scenario" is een zoeksuggestie', plan.populair && plan.suggestie);
  // Elke knop of melding die de nieuwe antwoorden noemen, bestaat in het plan of in de journal.
  const fs = require('fs'), bron = { plan: fs.readFileSync(path.resolve('tradingplan/tradingplan.html'), 'utf8'), journal: fs.readFileSync(path.resolve('work/syncjournal.html'), 'utf8') };
  const UI = [['plan', 'Maak dagplan'], ['plan', 'Gisteren overnemen'], ['plan', "label:'Swing'"], ['plan', "label:'Daytrade'"], ['plan', "label:'Scalp'"], ['plan', 'Zet om in trade'], ['plan', 'Uit je journal'],
    ['plan', 'Nieuwe trade invullen'], ['plan', 'Alle pairs en richtingen'], ['plan', '+ dag erna'], ['plan', 'Koppel trade'], ['plan', '+ Afbeelding'], ['plan', '+ Link'], ['plan', 'Klaar om te nemen'],
    ['plan', 'Overweeg alleen A-setups'], ['plan', 'weinig data'], ['plan', 'redelijk wat data'], ['plan', 'genoeg data'], ['plan', 'sterkste'], ['plan', '🤖 Vraag Mori</button>'], ['plan', '🤖 Vraag Mori over mijn dagplan'],
    ['plan', 'Mori instellen'], ['plan', 'Niet als: '], ['plan', "'Niet uit'"], ['plan', "'Ongeldig'"], ['journal', 'Koppel aan scenario'], ['journal', 'Backtest-trade'], ['journal', 'Geen exchange'], ['journal', 'Mori ingeschakeld'],
    ['journal', 'Wat is er verstuurd?'], ['journal', "['plan','Plan']"], ['journal', "t:'TradingPlan'"],
    // ronde 3: Dagstart, Gevoel, lagen als regels, Charts, criteria ingeklapt, Mori in een zijpaneel
    ['plan', '<h3>Dagstart</h3>'], ['plan', '<h3>Gevoel</h3>'], ['plan', '<h3>Charts</h3>'], ['plan', 'Bewerk</'], ['plan', '+ Tijdframe'], ['plan', 'Laag weghalen'],
    ['plan', 'Je dagstart-gevoel'], ['journal', 'Je dagstart-gevoel'], ['plan', 'verplichte criteria'], ['plan', '🤖 Mori</button>']];
  const mist = UI.filter(([f, l]) => !bron[f].includes(l)).map(x => x.join(': '));
  ok('de knoppen en meldingen uit de nieuwe antwoorden bestaan in de app', mist.length === 0, mist.join(', '));
  const label = l => l.replace(/^label:'|'$|<\/button>$|<\/?h3>|<\/$|^t:'|^\['plan','|'\]$|^'/g, '').replace(/^Plan'?\]?$/, 'Plan').trim();
  const nietGenoemd = UI.map(([, l]) => label(l)).filter(l => !plan.tekst.includes(l) && !plan.alles.includes(l));
  ok('en de FAQ noemt ze ook echt (de lijst blijft eerlijk)', nietGenoemd.length === 0, nietGenoemd.join(', '));
  console.log('─── ronde 3: wat er veranderde, en wat er niet meer staat ───');
  ok('geen "pre-flight" meer in de FAQ: het heet Dagstart', !/pre-?flight/i.test(plan.alles), (plan.alles.match(/.{40}pre-?flight.{40}/i) || [''])[0]);
  ok('geen mentaal-cijfer meer als iets wat je kiest (alleen "mentaal 4/5 (oud)" bij oude dagen)', !/mentaal/i.test(plan.alles.replace(/mentaal \d\/5 \(oud\)/g, '')), (plan.alles.match(/.{40}mentaal.{40}/i) || [''])[0]);
  ok('geen "voeg een tag toe in het plan" of "Ontbreekt er een?"', !/(voeg|maak)[^.]{0,40}(tag|tijdframe)[^.]{0,30}(toe )?in het plan|Ontbreekt er een/i.test(plan.alles));
  ok('tags en tijdframes alleen via Instellingen → Tags', /alleen[^.]*Instellingen → Tags|Instellingen → Tags[^.]*alleen/.test(plan.tekst));
  ok('Dagstart: vrije lijst van hooguit 8 punten, met Bewerk en het tandwiel', /Dagstart/.test(plan.tekst) && /hooguit 8/.test(plan.tekst) && /Bewerk/.test(plan.tekst));
  ok('Gevoel: emoties uit je journal, meer dan één mag, negatief → Overweeg alleen A-setups', /Gevoel/.test(plan.tekst) && /emoties/i.test(plan.tekst) && /negatie(f|ve)[^.]*Overweeg alleen A-setups|Overweeg alleen A-setups[^.]*negatie/i.test(plan.tekst));
  ok('Gevoel: per emotie je trades uit de journal, en "Je dagstart-gevoel" in de Log en Tendencies → Plan, op aantal dagen', /Je dagstart-gevoel/.test(plan.tekst) && /Tendencies → Plan/.test(plan.tekst) && /dagen/.test(plan.tekst) && /niet[^.]*naar je trades|niet[^.]*bij je trades/i.test(plan.tekst));
  ok('Mori in een paneel naast je plan (telefoon: schermvullend), doorvragen, gesprek blijft', /paneel/.test(plan.tekst) && /doorvragen/i.test(plan.tekst) && /telefoon/i.test(plan.tekst));
  ok('criteria standaard ingeklapt, amber als verplichte nog open staan', /ingeklapt/i.test(plan.tekst) && /verplichte criteria nog open/.test(plan.tekst));
  ok('lagen: één regel per tijdframe, tik om te bewerken, + Tijdframe, Laag weghalen', /\+ Tijdframe/.test(plan.tekst) && /Laag weghalen/.test(plan.tekst) && /gestippeld/i.test(plan.tekst));
  await p.evaluate(() => { faqFilter('scenario'); });
  ok('zoeken op "scenario" vindt de plan-categorie', await p.evaluate(ci => { const c = document.getElementById('faqc-' + ci); return !!c && !c.hidden && [...c.querySelectorAll('details.faq')].some(d => d.offsetParent); }, plan.ci));
  await p.evaluate(() => { faqFilter(''); });
  // Screenshots van de plan-categorie (licht en donker, 1280 en 390) voor het rapport
  for (const th of ['light', 'dark']) for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: w === 390 ? 1800 : 1300 });   // hoog genoeg: een vaste balk gaf in fullPage een naad op de viewportrand
    await p.evaluate(([t, ci]) => { setTheme(t); go('faq'); faqOpenCat(ci); const d = document.querySelector('#faqc-' + ci + ' details.faq'); if (d) d.open = true; window.scrollTo(0, 0); }, [th, plan.ci]); await p.waitForTimeout(300);
    if (w === 390) ok('390 ' + th + ': plan-categorie zonder horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await p.screenshot({ path: `tests/screenshots/faq-plan-${th === 'dark' ? 'donker' : 'licht'}-${w}.png`, fullPage: true });
  }
  await p.evaluate(() => { setTheme('light'); faqHome(); });

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== FAQ-volledig: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
