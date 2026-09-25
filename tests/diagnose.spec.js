// Diagnose-rapport (docs/opdracht-data-overzetten.md §3.3): panel altijd zichtbaar, rapport met alle
// blokken, zonder gevoelige gegevens, signalen (dubbele bron-id, geen datum), klembord en download,
// foutbalk-Details gebruikt hetzelfde rapport.
const { chromium } = require('playwright');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const b = await chromium.launch(); const { ctx, p, errs } = await H.openJournal(b, { clipboard: true });
  await H.seed(p, DS.volledig());

  console.log('─── Panel in Instellingen → Data ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('data'); });
  const panel = await p.evaluate(() => document.getElementById('diagPanel').innerText.replace(/\s+/g, ' '));
  ok('panel met Kopieer en Download, altijd zichtbaar', /Diagnose-rapport/.test(panel) && /Kopieer/.test(panel) && /Download/.test(panel));
  ok('samenvatting: versie + schema, aantallen, laatste sync per koppeling', /v0\.9\.\d+ geladen/.test(panel) && /schema 8/.test(panel) && /40 trades · 4 open · 4 playbooks/.test(panel) && /Blofin \d\d-\d\d/.test(panel) && /Hyperliquid nooit/.test(panel), panel.slice(0, 400));

  console.log('─── Het rapport ───');
  const rep = await p.evaluate(async () => { const r = await diagReport(); return { r, json: JSON.stringify(r) }; });
  const r = rep.r;
  ok('alle blokken aanwezig', ['app', 'opslag', 'data', 'sync', 'backup', 'tradingplan', 'zelfcontrole', 'fouten'].every(k => k in r), Object.keys(r).join());
  ok('geen sleutels, wallet, notities of screenshots in het rapport', !/BLOFIN-SECRET|BLOFIN-KEY|apiKey|apiSecret|passphrase|0x1d14aabb|data:image|Notitie \d|ünïcödé/.test(rep.json));
  ok('app: versie, schema, host, browser, tijdzone', r.app.loaded === (await p.evaluate(() => APP_VERSION)) && r.app.schema === 8 && typeof r.app.host === 'string' && /Chrome|Edge|Chromium|browser/.test(r.app.browser) && !!r.app.tz, JSON.stringify(r.app).slice(0, 200));
  ok('opslag: schatting, persisted, IndexedDB- en localStorage-omvang, tp2 aanwezig, geen oude app', typeof r.opslag.idb.trades === 'number' && r.opslag.idb.trades > 10000 && Object.keys(r.opslag.localStorage).some(k => /^sj_/.test(k)) && r.opslag.tp2.aanwezig === true && r.opslag.tj_oud_aanwezig === false, JSON.stringify(r.opslag).slice(0, 300));
  ok('data: aantallen per status/kind/exchange, met srcId/fills/tps/screenshots, datumbereik, prullenbak, snapshots', r.data.trades === 40 && r.data.status.open === 4 && r.data.status.partial === 4 && r.data.kind.paper === 7 && r.data.exchange.blofin === 6 && r.data.met_fills > 0 && r.data.met_tps === 40 && r.data.met_screenshots === 8 && Array.isArray(r.data.datumbereik) && r.data.trash === 2 && Array.isArray(r.data.snapshots), JSON.stringify(r.data).slice(0, 400));
  ok('sync: per koppeling verbonden/hint (laatste 4)/lastSync/backoff, worker-blok, interval', r.sync.conns.blofin.connected === true && r.sync.conns.blofin.hint === '5533' && /^2026-/.test(r.sync.conns.blofin.lastSync || '') && r.sync.conns.hyperliquid.lastSync === null && 'reachable' in r.sync.worker && r.sync.interval === '30m', JSON.stringify(r.sync).slice(0, 300));
  ok('worker-url ingekort (geen volledige url)', !r.sync.worker.url || /…/.test(r.sync.worker.url), r.sync.worker.url);
  ok('backup, tradingplan (1 plan, 1 record, gekoppeld), zelfcontrole zonder signalen, fouten-lijst', r.backup && 'choice' in r.backup && r.tradingplan.plans === 1 && r.tradingplan.records === 1 && r.tradingplan.gekoppeld === 6 && r.zelfcontrole.signalen.length === 0 && Array.isArray(r.fouten), JSON.stringify([r.tradingplan, r.zelfcontrole]));

  console.log('─── Signalen op kapotte data ───');
  await H.seed(p, DS.randen());
  await p.evaluate(() => { T[0].date = ''; persist(); go('instellingen'); setSetTab('data'); });
  const sig = await p.evaluate(async () => { const r = await diagReport(); return { s: r.zelfcontrole.signalen, dup: r.data.dubbele_srcId, zd: r.data.zonder_datum, panel: document.getElementById('diagPanel').innerText.replace(/\s+/g, ' ') }; });
  ok('signalen: trade zonder datum, dubbele bron-id okx_1_1, dubbele handmatige trade', sig.s.some(x => /1 trades zonder datum/.test(x)) && sig.dup.includes('okx_1_1') && sig.s.some(x => /dubbele bron-id/.test(x)) && sig.s.some(x => /dubbele handmatige/.test(x)) && sig.zd === 1, JSON.stringify(sig.s));
  ok('panel toont de signalen in mensentaal', /signalen:/.test(sig.panel) && /dubbele bron-id/.test(sig.panel), sig.panel.slice(0, 300));

  console.log('─── Kopieer, download, foutbalk ───');
  await p.evaluate(() => diagCopy()); await p.waitForTimeout(400);
  const clip = await p.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e; } });
  let parsed = null; try { parsed = JSON.parse(clip); } catch (e) {}
  ok('klembord bevat het rapport als JSON (compact)', parsed && parsed.app && parsed.data && parsed.data.trades === 6, clip.slice(0, 80));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => diagDownload())]);
  ok('download: syncjournal-diagnose-<datum>.json', /^syncjournal-diagnose-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => ErrorCenter.diagnostics())]);
  ok('foutbalk "Details" gebruikt hetzelfde rapport', /^syncjournal-diagnose-/.test(dl2.suggestedFilename()), dl2.suggestedFilename());

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Diagnose: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
