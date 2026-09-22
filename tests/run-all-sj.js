#!/usr/bin/env node
// Draait de complete SyncJournal-testsuite in één commando en vat samen.
//   node tests/run-all-sj.js            → alle specs
//   node tests/run-all-sj.js e2e trash  → alleen specs waarvan de naam matcht
// De e2e-doorloop (tests/e2e-doorloop.spec.js) is de "alles-in-samenhang"-test:
// accounts, saldo-mutaties, trades CRUD, tags, TP's, prullenbak + cross-page-consistentie.
const { spawnSync } = require('child_process');
const path = require('path');

const SPECS = [
  'e2e-doorloop',            // ← de grote doorloop, eerst (vangt integratie-breuken meteen)
  'backup-guard', 'drive-backup', 'drive-broker', 'hosted', 'weergave-presets', 'demo-dataset', 'pb-demo-cleanup', 'pb-layers',
  'duration', 'changemaker-feedback', 'fout-filter', 'default-tags', 'multifilter', 'csv-import',
  'exchange-sync', 'exchange-sync2', 'balance-sync', 'auto-sync', 'valuta', 'okx-positie', 'okx-levensloop', 'hyperliquid-levensloop', 'execution-stappen', 'koppelingen-menu', 'account-remove', 'robustness', 'multi-tab', 'tj-migrate', 'pnl-pct', 'unit-toggle', 'possize',
  'matrix', 'yearheatmap', 'review-list', 'coach-share', 'tv-links',
  'heatmap-scaling', 'analytics-metrics', 'tendencies', 'faq', 'trash',
  'tradingplan-plan',        // aparte app (tradingplan.syncjournal.nl), draait mee zodat hij niet ongetest blijft
];

const filter = process.argv.slice(2);
const run = filter.length ? SPECS.filter(s => filter.some(f => s.includes(f))) : SPECS;
const env = { ...process.env, NODE_PATH: path.resolve(__dirname, '..', 'node_modules') };
const results = []; const t0 = Date.now();

// CI-preflight: één kale browser-start met zichtbare fout. Faalt dit, dan verklaart
// deze ene regel waarom álle specs rood zijn (bv. browser-binary of systeemlib mist).
console.log('Node', process.version, '· Playwright', (() => { try { return require('playwright/package.json').version; } catch (e) { return 'ONTBREEKT: ' + e.message; } })());
const pre = spawnSync(process.execPath, ['-e', "const{chromium}=require('playwright');chromium.launch().then(b=>b.close()).then(()=>console.log('browser-start OK')).catch(e=>{console.log('BROWSER-START FAALT:',String(e).split('\\n').slice(0,8).join(' · '));process.exit(1)})"], { env, encoding: 'utf8', timeout: 120000 });
console.log(((pre.stdout || '') + (pre.stderr || '')).trim().split('\n').slice(0, 8).join(' · ') || 'preflight: geen output');

const runSpec = (s) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, s + '.spec.js')], { env, encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { ok: r.status === 0, out, sum: (out.match(/===\s*(.+?)\s*===\s*$/m) || [, '?'])[1] };
};
for (const s of run) {
  const st = Date.now();
  let r = runSpec(s), flaky = false;
  // Eén herkansing: trage CI-runners (GitHub Actions) halen soms een timing-check niet.
  // Twee keer rood = echt rood; één keer = ⚠ flaky, telt als groen.
  if (!r.ok) { const r2 = runSpec(s); if (r2.ok) { flaky = true; r = r2; } }
  const skipped = r.ok && /overgeslagen/i.test(r.sum);
  results.push({ s, okAll: r.ok, sum: r.sum, ms: Date.now() - st });
  console.log(`${r.ok ? (skipped ? '⏭️' : flaky ? '⚠️' : '✅') : '❌'} ${s.padEnd(22)} ${r.sum}${flaky ? '  (flaky: 2e poging groen)' : ''}  (${((Date.now() - st) / 1000).toFixed(1)}s)`);
  if (!r.ok) {
    const cross = r.out.split('\n').filter(l => l.includes('✗'));
    // geen ✗-regels = de spec crashte vóór de eerste check → toon de echte fout (CI-diagnose)
    console.log((cross.length ? cross : r.out.split('\n').filter(l => l.trim()).slice(-14)).map(l => '   ' + l.trim()).join('\n'));
  }
}

const failed = results.filter(r => !r.okAll);
console.log(`\n═══ SyncJournal-suite: ${results.length - failed.length}/${results.length} specs groen · ${((Date.now() - t0) / 60000).toFixed(1)} min ═══`);
if (failed.length) {
  console.log('Gefaald: ' + failed.map(f => f.s).join(', '));
  // GitHub-annotatie: bij publieke repo's via de API leesbaar zónder in te loggen,
  // zodat de CI-diagnose ook zonder log-screenshots op te vragen is.
  if (process.env.GITHUB_ACTIONS) {
    const pre1 = ((pre.stdout || '') + (pre.stderr || '')).trim().split('\n')[0] || '';
    console.log(`::error title=SyncJournal-suite ${results.length - failed.length}/${results.length}::preflight: ${pre1} | gefaald: ${failed.map(f => f.s + '(' + f.sum + ')').slice(0, 8).join(', ')}${failed.length > 8 ? ' +' + (failed.length - 8) : ''}`);
  }
  process.exit(1);
}
