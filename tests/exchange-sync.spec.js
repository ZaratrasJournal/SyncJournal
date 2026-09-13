// Borgt de geporte exchange-API (fase 1) in SyncJournal: adapters aanwezig, connect-UI
// per exchange-type (passphrase/wallet), creds-opslag, offline sync met de ECHTE MEXC-mapper
// over een echte API-snapshot, dedupe op bron-id, prullenbak-guard, testConnection-flow.
// Netwerk is volledig geblokkeerd — contract-size valt terug op de ingebouwde fallback-map.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const FIX = 'tests/_fixtures/mexc-snapshot.json';
(async () => {
  if (!fs.existsSync(FIX)) { console.log('SKIP: ' + FIX + ' ontbreekt (gitignored) — alleen structuur-checks'); }
  const mexcRows = fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, 'utf8')).positionsHistory : null;
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // blokkeer ALLE netwerk behalve de app zelf (offline-garantie)
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; persist(); persistTrash(); clearGFilter(); setFilter('kind', 'alle'); });
  ok('boot zonder JS-errors (71KB geporte code)', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Adapters & plumbing aanwezig ───');
  ok('ExchangeAPI met 6 adapters', await p.evaluate(() => ['mexc', 'blofin', 'kraken', 'hyperliquid', 'okx', 'ftmo'].every(k => ExchangeAPI[k])));
  ok('proxyCall + getProxyUrl + detectPartialFromSiblings', await p.evaluate(() => typeof proxyCall === 'function' && typeof detectPartialFromSiblings === 'function' && /workers\.dev/.test(getProxyUrl())));
  ok('proxy-URL onder sj_-prefix', await p.evaluate(() => !!localStorage.getItem('sj_proxy_url') && !localStorage.getItem('tj_proxy_url')));
  ok('blofin=passphrase · hyperliquid=wallet-only · ftmo=csvOnly', await p.evaluate(() => ExchangeAPI.blofin.needsPassphrase && ExchangeAPI.hyperliquid.walletOnly && ExchangeAPI.ftmo.csvOnly));

  console.log('─── Connect-UI per exchange-type ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('accounts'); connExpand('blofin'); }); await p.waitForTimeout(250);
  ok('blofin-formulier heeft passphrase-veld', await p.evaluate(() => !!document.getElementById('cp_blofin') && !!document.getElementById('ck_blofin')));
  await p.evaluate(() => connExpand('hyperliquid')); await p.waitForTimeout(250);
  ok('hyperliquid-formulier heeft wallet-veld (geen key)', await p.evaluate(() => !!document.getElementById('cw_hyperliquid') && !document.getElementById('ck_hyperliquid')));
  ok('sync-vanaf-datumveld aanwezig', await p.evaluate(() => !!document.getElementById('cf_hyperliquid')));
  await p.evaluate(() => { connExpand('mexc'); }); await p.waitForTimeout(200);
  await p.evaluate(() => { document.getElementById('ck_mexc').value = 'testkey-1234'; document.getElementById('cs_mexc').value = 'secret'; connectEx('mexc'); });
  ok('connectEx bewaart creds + hint', await p.evaluate(() => CONNS.mexc.connected && CONNS.mexc.apiKey === 'testkey-1234' && CONNS.mexc.hint === '1234'));

  if (mexcRows) {
    console.log('─── Offline sync: echte MEXC-mapper over echte snapshot (' + mexcRows.length + ' rijen) ───');
    await p.evaluate((rows) => { window.__fix = rows; window.proxyCall = async (pl) => { if (pl.action === 'trades') return { trades: window.__fix }; if (pl.action === 'test') return { balance: 1234.56 }; return {}; }; }, mexcRows);
    const n1 = await p.evaluate(() => syncExchange('mexc'));
    ok('sync importeert trades (' + n1 + ')', n1 > 0, 'n=' + n1);
    ok('trade-velden gevuld (pair/dir/entry/pnl/date/srcId)', await p.evaluate(() => { const t = T.find(x => x.srcId); return t && /\//.test(t.pair) && (t.dir === 'long' || t.dir === 'short') && t.entry > 0 && isFinite(t.pnl) && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.exchange === 'mexc' && t.kind === 'live'; }));
    ok('R + sessie afgeleid', await p.evaluate(() => T.filter(x => x.srcId).every(t => t.session && isFinite(t.r))));
    ok('alle gesyncte trades hebben een uniek id', await p.evaluate(() => new Set(T.map(t => t.id)).size === T.length));
    ok('lastSync gestempeld', await p.evaluate(() => CONNS.mexc.lastSync > Date.now() - 60e3));
    const n2 = await p.evaluate(() => syncExchange('mexc'));
    ok('re-sync: dedupe op bron-id → 0 nieuw', n2 === 0, 'n=' + n2);
    // prullenbak-guard: verwijderde synced trade komt niet terug
    const guard = await p.evaluate(async () => { const t = T.find(x => x.srcId); const sid = t.srcId; delTrade(t.id); const n = await syncExchange('mexc'); return { n, inTrash: TRASH.some(x => x.srcId === sid), back: T.some(x => x.srcId === sid) }; });
    ok('prullenbak-guard: verwijderd blijft verwijderd na sync', guard.n === 0 && guard.inTrash && !guard.back, JSON.stringify(guard));
    ok('testConn toont saldo-toast', await p.evaluate(async () => { await testConn('mexc'); const tx = document.getElementById('toasts').textContent; return /✓/.test(tx) && /1\.234/.test(tx); }));
    ok('Sync nu-knop zichtbaar bij verbonden exchange', await p.evaluate(() => { go('instellingen'); setSetTab('accounts'); return [...document.querySelectorAll('button')].some(x => /Sync nu/.test(x.textContent)); }));
    await p.evaluate(() => go('analytics')); await p.waitForTimeout(600);
    ok('analytics rendert met gesyncte trades', await p.evaluate(() => document.querySelectorAll('#main .panel').length > 5));
  }

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Exchange-sync (fase 1): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
