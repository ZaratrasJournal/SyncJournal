// Auto-sync moet daadwerkelijk lopen zodra de schakelaar in Instellingen aan staat.
// Aanleiding (ChangeMaker, 18-09-2026): schakelaar aan, interval 15 min, Hyperliquid
// verbonden — en na een kwartier open staan nog steeds niets gesynct. Oorzaak: er was
// een tweede, verborgen schakelaar per account die standaard uit stond.
// We tellen echte netwerkpogingen naar de exchange: dat is het enige harde bewijs dat
// er gesynct wordt, los van hoe de code intern in elkaar zit.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const URL_APP = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
const WALLET = '0x' + '1'.repeat(36) + '7448';
const verbonden = (extra = {}) => ({ connected: true, hint: '7448', wallet: WALLET, lastSync: Date.now(), ...extra });

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // Eén scenario = een verse browsercontext met eigen opslag, neptijd en een teller
  // van de sync-verzoeken. Extern verkeer wordt geblokkeerd, ook in de test.
  async function scenario(conn, sync, fn) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    const hits = [];
    await p.route('**/*', r => {
      const u = r.request().url();
      if (/api\.hyperliquid\.xyz/.test(u)) { hits.push(u); return r.abort(); }
      return /^https?:/.test(u) ? r.abort() : r.continue();
    });
    await p.addInitScript(([c, s]) => {
      localStorage.setItem('sj_conns', JSON.stringify({ hyperliquid: c }));
      localStorage.setItem('sj_sync', JSON.stringify(s));
      localStorage.setItem('sj_welcomed', 'true');
    }, [conn, sync]);
    await p.clock.install();
    await p.goto(URL_APP, { waitUntil: 'domcontentloaded' });
    await p.clock.runFor(3000);
    // De neptijd springt vooruit, maar het verzoek zelf kost echte tijd.
    const wachtOpSync = async (ms = 4000) => { const t = Date.now(); while (!hits.length && Date.now() - t < ms) await p.waitForTimeout(100); return hits.length; };
    const blijftStil = async () => { await p.waitForTimeout(1200); return hits.length === 0; };
    await fn({ p, hits, wachtOpSync, blijftStil });
    await ctx.close();
  }

  console.log('─── De melding zelf: schakelaar aan, nooit een tweede schakelaar aangeraakt ───');
  await scenario(verbonden({ autoSync: false }), { auto: true, interval: '15m' }, async ({ p, hits, wachtOpSync }) => {
    ok('vlak na openen nog niets (laatste sync is vers)', hits.length === 0, JSON.stringify(hits));
    await p.clock.runFor(16 * 60 * 1000);
    ok('na 16 minuten is er wél gesynct', (await wachtOpSync()) > 0);
  });

  console.log('─── Achterstand inhalen bij openen ───');
  await scenario(verbonden({ lastSync: Date.now() - 2 * 864e5 }), { auto: true, interval: '15m' }, async ({ wachtOpSync }) => {
    ok('twee dagen oude sync wordt direct ingehaald', (await wachtOpSync()) > 0);
  });

  console.log('─── De schakelaars doen wat ze beloven ───');
  await scenario(verbonden({ lastSync: 0 }), { auto: false, interval: '15m' }, async ({ p, blijftStil }) => {
    await p.clock.runFor(61 * 60 * 1000);
    ok('uit = niets, ook niet na een uur', await blijftStil());
  });
  await scenario(verbonden({ noAuto: true, lastSync: 0 }), { auto: true, interval: '15m' }, async ({ p, blijftStil }) => {
    await p.clock.runFor(31 * 60 * 1000);
    ok('per account uit te zetten', await blijftStil());
  });

  console.log('─── Randgevallen ───');
  await scenario(verbonden(), { auto: true, interval: '15m' }, async ({ p }) => {
    const gesynct = await p.evaluate(async () => {
      TAB_STALE = true; const v = []; const echt = window.syncExchange;
      window.syncExchange = id => { v.push(id); return Promise.resolve(0); };
      await autoSyncRun(false); window.syncExchange = echt; return v;
    });
    ok('een verouderd tabblad synct niet (het mag toch niet schrijven)', gesynct.length === 0, JSON.stringify(gesynct));
  });
  await scenario(verbonden({ autoSync: false }), { auto: true, interval: '15m' }, async ({ p }) => {
    const r = await p.evaluate(() => { go('instellingen'); return { tekst: document.body.innerText, oudVeld: 'autoSync' in CONNS.hyperliquid }; });
    ok('het account toont "auto-sync aan"', r.tekst.includes('auto-sync aan'));
    ok('de schakelaar zegt voor hoeveel accounts hij geldt', r.tekst.includes('actief voor 1 account'));
    ok('het oude opt-in-veld is uit de opslag verdwenen', r.oudVeld === false);
  });
  await scenario({ connected: false }, { auto: true, interval: '15m' }, async ({ p, blijftStil }) => {
    await p.clock.runFor(31 * 60 * 1000);
    ok('een niet-verbonden account wordt niet gesynct', await blijftStil());
    ok('en de schakelaar zegt dat er niets te syncen valt', (await p.evaluate(() => { go('instellingen'); return document.body.innerText; })).includes('nog geen enkel account verbonden'));
  });

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Auto-sync: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
