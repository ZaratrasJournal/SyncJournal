// Auto-sync stopt bij een fout die vanzelf niet overgaat, en gaat verder zodra de koppeling weer werkt.
//
// Gevonden 30-09-2026 bij het ontwerp van het dagrapport: alleen een rate-limit zette een pauze.
// Een IP-whitelist of een ongeldige sleutel bleef auto-sync elke 15 minuten opnieuw proberen, met
// minstens twee Worker-verzoeken per poging — tot ~190 kansloze verzoeken per dag per lid, en een
// sync die elke keer stil mislukte. Opnieuw proberen verandert daar niets aan; een nieuwe sleutel wel.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Zo komt de fout van OKX via de Worker binnen (Worker v19: `OKX ${path}: ${data.msg}`, status 500)
const IP_FOUT = "OKX /api/v5/account/balance: Your IP 2a06:98c0:3600::103 is not included in your API key's IP whitelist.";
const SLEUTEL_FOUT = 'OKX /api/v5/account/balance: Invalid OK-ACCESS-KEY';
const TIJDELIJK = 'OKX /api/v5/account/positions-history: System busy. Please try again later.';

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // de Worker: antwoordt wat `worker.antwoord` op dat moment zegt, en telt de verzoeken
  const worker = { n: 0, antwoord: { status: 500, body: { error: IP_FOUT } } };
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    if (r.request().method() === 'POST' && /workers\.dev/.test(u)) {
      worker.n++;
      return r.fulfill({ status: worker.antwoord.status, contentType: 'application/json', body: JSON.stringify(worker.antwoord.body) });
    }
    return r.abort();
  });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {}
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', hint: 'k' }; persistConns();
    SYNC.auto = true; persistSync(); });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const rondes = async n => { const voor = worker.n; for (let i = 0; i < n; i++) await p.evaluate(() => autoSyncRun(false)); return worker.n - voor; };
  const kaart = () => p.evaluate(() => { STATE.setTab = 'accounts'; STATE.connOpen = 'okx'; go('instellingen');
    return [...document.querySelectorAll('.connerr')].map(x => x.textContent).join(' | '); });

  for (const [naam, fout] of [['IP-whitelist', IP_FOUT], ['ongeldige sleutel', SLEUTEL_FOUT]]) {
    console.log(`─── ${naam}: auto-sync stopt ───`);
    worker.antwoord = { status: 500, body: { error: fout } };
    await p.evaluate(() => { delete CONN_ERR.okx; });
    const eerste = await rondes(1);
    const daarna = await rondes(4);   // een uur auto-sync bij het standaard-interval van 15 minuten
    ok('de eerste poging gaat naar de Worker', eerste > 0, String(eerste));
    ok('daarna geen enkel kansloos verzoek meer', daarna === 0, daarna + ' verzoeken in 4 rondes');
    const k = await kaart();
    ok('de koppeling toont de fout', /whitelist|sleutel|KEY/i.test(k), k);
    ok('en zegt dat auto-sync stilstaat tot je het oplost', /auto-sync staat stil/i.test(k), k);
  }

  console.log('─── Zelf op Sync drukken probeert het wél ───');
  const hand = worker.n; await p.evaluate(() => syncNow());
  ok('Sync nu gaat gewoon naar de Worker', worker.n > hand, String(worker.n - hand));

  console.log('─── Sleutel gerepareerd: auto-sync loopt weer ───');
  worker.antwoord = { status: 200, body: { success: true, balance: '100' } };
  await p.evaluate(() => testConn('okx'));
  ok('de foutmelding is weg', !(await kaart()), await kaart());
  ok('auto-sync gaat weer naar de Worker', (await rondes(1)) > 0);

  console.log('─── Een tijdelijke fout: auto-sync blijft proberen ───');
  worker.antwoord = { status: 500, body: { error: TIJDELIJK } };
  await rondes(1);
  const tijdelijk = await rondes(2);
  ok('bij "System busy" blijft auto-sync het proberen', tijdelijk > 0, String(tijdelijk));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Auto-sync pauze: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
