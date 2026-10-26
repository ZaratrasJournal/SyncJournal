// F14 stap 6 (26-10-2026): a three-step welcome for a brand-new journal, written for traders who
// do not know Morani: (1) what SyncJournal is, (2) pick a tag set, (3) first trades: connect an
// exchange (with "Hoe veilig is dit?"), import a CSV, or look around with demo data.
// Skipping is always possible and is remembered; an existing journal never sees it.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const URL = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const nieuw = async (vp = { width: 1400, height: 950 }) => { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); return [ctx, p]; };
  // A truly empty browser: nothing in localStorage or IndexedDB, then a fresh load.
  const leeg = async (p, q = '') => {
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.goto(URL + q, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  };
  const open = p => p.evaluate(() => document.getElementById('welcome').classList.contains('on'));
  const tekst = p => p.evaluate(() => document.getElementById('welcome').innerText);

  console.log('─── Lege journal: het welkom ───');
  {
    const [ctx, p] = await nieuw();
    await leeg(p);
    ok('een lege journal toont het welkom', await open(p));
    const t1 = await tekst(p);
    ok('stap 1: wat SyncJournal is, zonder voorkennis', /Stap 1 van 3/i.test(t1) && /trading journal/i.test(t1) && /browser/i.test(t1), t1.slice(0, 200));
    ok('stap 1: de community blijft genoemd, maar Morani kennen hoeft niet', /Morani/.test(t1) && /Zaratras/.test(t1));
    ok('overslaan staat er', /Overslaan/.test(t1));
    await p.click('#welcome [data-ob="volgende"]'); await p.waitForTimeout(150);
    const t2 = await tekst(p);
    ok('stap 2: kies je tags, Morani-set of algemeen', /Stap 2 van 3/i.test(t2) && /Morani-set/.test(t2) && /Algemene set/.test(t2) && /strategieën van Morani/.test(t2), t2.slice(0, 300));
    ok('stap 2: later aan te passen in Instellingen → Tags', /Instellingen → Tags/.test(t2));
    await p.click('#welcome [data-set="algemeen"]'); await p.waitForTimeout(150);
    ok('algemene set gekozen: setups zijn de neutrale set', await p.evaluate(() => tagConfig.setupTags.includes('Breakout') && !tagConfig.setupTags.includes('F2R') && DB.load('tagset', '') === 'algemeen'));
    const t3 = await tekst(p);
    ok('stap 3: koppel, CSV of voorbeelddata', /Stap 3 van 3/i.test(t3) && /Koppel een exchange/.test(t3) && /CSV/.test(t3) && /voorbeelddata/i.test(t3), t3.slice(0, 300));
    ok('stap 3: "Hoe veilig is dit?" linkt naar de veiligheidspagina', await p.evaluate(() => { const a = [...document.querySelectorAll('#welcome a')].find(x => /Hoe veilig is dit\?/.test(x.textContent)); return !!a && /veiligheid\.html$/.test(a.getAttribute('href')) && a.target === '_blank'; }));
    await p.click('#welcome [data-ob="terug"]'); await p.waitForTimeout(100);
    ok('terug naar stap 2 kan', /Stap 2 van 3/i.test(await tekst(p)));
    await p.click('#welcome [data-ob="volgende"]'); await p.waitForTimeout(100);
    await p.click('#welcome [data-ob="koppel"]'); await p.waitForTimeout(300);
    ok('"Koppel een exchange" sluit het welkom en opent Instellingen → Accounts', !(await open(p)) && await p.evaluate(() => STATE.page === 'instellingen' && STATE.setTab === 'accounts'));
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    ok('afgerond: komt niet terug na herladen', !(await open(p)));
    await ctx.close();
  }

  console.log('─── Overslaan onthoudt het ───');
  {
    const [ctx, p] = await nieuw();
    await leeg(p);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    ok('nog niet afgerond: na herladen staat het welkom er weer', await open(p));
    await p.click('#welcome [data-ob="overslaan"]'); await p.waitForTimeout(200);
    ok('overslaan sluit het welkom', !(await open(p)));
    ok('tags onaangeraakt bij overslaan (Morani-set)', await p.evaluate(() => !tagConfigEigen()));
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    ok('overgeslagen: komt niet terug', !(await open(p)));
    await leeg(p); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok('Escape slaat ook over', !(await open(p)) && await p.evaluate(() => DB.load('onboard', '') === 'klaar'));
    await ctx.close();
  }

  console.log('─── Voorbeelddata ───');
  {
    const [ctx, p] = await nieuw();
    await leeg(p);
    await p.click('#welcome [data-ob="volgende"]'); await p.click('#welcome [data-set="morani"]'); await p.waitForTimeout(100);
    ok('Morani-set gekozen', await p.evaluate(() => DB.load('tagset', '') === 'morani'));
    await p.click('#welcome [data-ob="demo"]'); await p.waitForTimeout(1500);
    ok('"Rondkijken met voorbeelddata" laadt trades en sluit het welkom', !(await open(p)) && await p.evaluate(() => T.length > 0));
    await leeg(p, '?demo=1'); await p.waitForTimeout(800);
    ok('via de landing met ?demo=1: geen welkom', !(await open(p)));
    await ctx.close();
  }

  console.log('─── Bestaande journal ziet het nooit ───');
  {
    const [ctx, p] = await nieuw();
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { localStorage.clear(); await IDB.clearAll(); localStorage.setItem('sj_schema', JSON.stringify(SCHEMA_VERSION));
      await IDB.set('trades', [{ id: 1, date: '2026-09-10', time: '10:00', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]); });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    ok('journal met trades: geen welkom', !(await open(p)));
    await p.evaluate(async () => { await IDB.set('trades', []); });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    ok('bestaande journal zonder trades (opslag van vóór deze versie): geen welkom', !(await open(p)));
    await p.evaluate(async () => { localStorage.clear(); await IDB.clearAll(); localStorage.setItem('sj_conns', JSON.stringify({ hyperliquid: { connected: true, wallet: '0xabc' } })); });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    ok('wel een koppeling, geen trades: geen welkom', !(await open(p)));
    await ctx.close();
  }

  console.log('─── Licht, donker en 390px ───');
  for (const th of ['light', 'dark']) {
    for (const vp of [{ width: 1400, height: 950 }, { width: 390, height: 844 }]) {
      const [ctx, p] = await nieuw(vp);
      await leeg(p);
      await p.evaluate(t => { setTheme(t); }, th); await p.waitForTimeout(700);
      for (const stap of [1, 2, 3]) {
        if (stap > 1) { await p.click('#welcome [data-ob="volgende"]'); await p.waitForTimeout(150); }
        const r = await p.evaluate(() => { const w = document.getElementById('welcome'); const btn = [...w.querySelectorAll('button')].every(x => x.getBoundingClientRect().right <= innerWidth + 1); return { sw: w.scrollWidth, cw: w.clientWidth, btn }; });
        ok(`${th} ${vp.width}px stap ${stap}: past in de breedte`, r.sw <= r.cw + 1 && r.btn, JSON.stringify(r));
        await p.screenshot({ path: `tests/screenshots/onboarding-${th}-${vp.width}-${stap}.png` });
      }
      ok(`${th}: thema actief`, await p.evaluate(t => document.body.classList.contains('dark') === (t === 'dark'), th));
      await ctx.close();
    }
  }

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Onboarding: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
