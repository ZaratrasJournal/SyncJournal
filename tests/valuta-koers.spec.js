// A euro balance is an estimate, and says so (Denny 24-10-2026: two members saw € 9.500 in the journal and
// € 9.491,50 at OKX; in dollars both matched). The exchange holds dollars; the journal converts with the ECB rate,
// the exchange with its own live rate. So in euro view a balance shows "≈ €", with the rate and its date on hover;
// a rate older than 3 working days turns the balance amber; Settings shows the rate in use. Dollars stay exact.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const ZA = Date.parse('2026-10-24T19:00:00Z');   // Saturday: the latest ECB rate is Friday's

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(new Date(ZA));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {}
    FX.latest = 0.89342; FX.latestDate = '2026-10-23'; FX.rates['2026-10-23'] = 0.89342; FX.ts = Date.now(); fxSave();
    EXCHANGES.find(e => e.id === 'okx').val = 10633.30; CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', hint: 'abcd', lastSync: Date.now() }; persistConns();
    T = []; persist(); });
  const lees = () => p.evaluate(() => { go('dashboard');
    const bv = document.getElementById('balVal'), hero = document.querySelector('.panel.hero .big');
    const side = [...document.querySelectorAll('.sc-v')].map(e => ({ t: e.textContent.trim(), title: e.title }))[0] || {};
    STATE.setTab = 'weergave'; go('instellingen');
    const val = [...document.querySelectorAll('.setrow')].find(r => /^Valuta/.test((r.querySelector('b') || {}).textContent || ''));
    const uit = { pil: bv.textContent, pilTitel: bv.title, pilOud: bv.classList.contains('oud'), hero: hero && hero.textContent.trim(), heroTitel: hero && hero.title, side, valuta: val ? val.querySelector('small').textContent.replace(/\s+/g, ' ') : '' };
    go('dashboard'); return uit; });

  console.log('─── Dollars: exact, geen omrekening ───');
  await p.evaluate(() => { STATE.currency = 'USD'; persistState(); render(); });
  let s = await lees();
  ok('balans $ 10.633, zonder ≈ en zonder koersuitleg', s.pil === '$ 10.633' && !s.pilTitel, JSON.stringify(s));
  ok('dashboard-balans zonder ≈', s.hero && !/≈/.test(s.hero), s.hero);

  console.log('─── Euro: een schatting, en dat staat erbij ───');
  await p.evaluate(() => { STATE.currency = 'EUR'; persistState(); render(); });
  s = await lees();
  ok('balans ≈ € 9.500', s.pil === '≈ € 9.500', s.pil);
  ok('bij de muis: ECB-koers van vr 23-10 (0,8934), eigen live koers van de exchange, kies $ voor exact', /ECB-koers van vr 23-10 \(0,8934\)/.test(s.pilTitel) && /eigen live koers/.test(s.pilTitel) && /kies dan \$/.test(s.pilTitel), s.pilTitel);
  ok('niet oranje: de koers van vrijdag is op zaterdag actueel', !s.pilOud, JSON.stringify(s));
  ok('dashboard-balans ≈ € 9.500, met dezelfde uitleg', /^≈ € 9\.500/.test(s.hero) && /ECB-koers/.test(s.heroTitel), JSON.stringify([s.hero, s.heroTitel]));
  ok('zijbalk OKX ≈ € 9.500, met uitleg', /^≈ € 9\.500/.test(s.side.t) && /ECB-koers/.test(s.side.title), JSON.stringify(s.side));
  ok('Instellingen → Valuta: welke koers er nu gebruikt wordt', /ECB-koers van vr 23-10: 0,8934/.test(s.valuta), s.valuta);

  console.log('─── Een oude koers wordt gemeld ───');
  await p.clock.setFixedTime(new Date(Date.parse('2026-10-26T09:00:00Z')));   // Monday morning: Friday's rate is fine
  await p.evaluate(() => render());
  s = await lees();
  ok('maandagochtend, koers van vrijdag: niet oranje', !s.pilOud, JSON.stringify(s));
  await p.clock.setFixedTime(new Date(Date.parse('2026-10-29T09:00:00Z')));   // Thursday: Mon, Tue, Wed missing
  await p.evaluate(() => render());
  s = await lees();
  ok('donderdag, koers nog van vrijdag (3 werkdagen gemist): oranje, met waarschuwing', s.pilOud && /⚠ Koers van vr 23-10/.test(s.pilTitel), JSON.stringify([s.pilOud, s.pilTitel]));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Euro-koers zichtbaar: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
