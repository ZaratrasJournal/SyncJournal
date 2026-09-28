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
  ok('er staan minstens 40 vragen in beeld', (zichtbaar.match(/\?/g) || []).length >= 40, 'gevonden: ' + (zichtbaar.match(/\?/g) || []).length);

  console.log('─── Onderwerpen die gedekt moeten zijn ───');
  for (const [naam, zoek] of [
    ['overzetten uit de oude TradeJournal', /oude TradeJournal/i],
    ['de Plan-pagina', /Plan-pagina/i],
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

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== FAQ-volledig: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
