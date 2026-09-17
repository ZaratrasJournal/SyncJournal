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
  'exchange-sync', 'exchange-sync2', 'balance-sync', 'account-remove', 'tj-migrate', 'pnl-pct', 'possize',
  'matrix', 'yearheatmap', 'review-list', 'coach-share', 'tv-links',
  'heatmap-scaling', 'analytics-metrics', 'tendencies', 'faq', 'trash',
];

const filter = process.argv.slice(2);
const run = filter.length ? SPECS.filter(s => filter.some(f => s.includes(f))) : SPECS;
const env = { ...process.env, NODE_PATH: path.resolve(__dirname, '..', 'node_modules') };
const results = []; const t0 = Date.now();

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
  results.push({ s, okAll: r.ok, sum: r.sum, ms: Date.now() - st });
  console.log(`${r.ok ? (flaky ? '⚠️' : '✅') : '❌'} ${s.padEnd(22)} ${r.sum}${flaky ? '  (flaky: 2e poging groen)' : ''}  (${((Date.now() - st) / 1000).toFixed(1)}s)`);
  if (!r.ok) console.log(r.out.split('\n').filter(l => l.includes('✗')).map(l => '   ' + l.trim()).join('\n'));
}

const failed = results.filter(r => !r.okAll);
console.log(`\n═══ SyncJournal-suite: ${results.length - failed.length}/${results.length} specs groen · ${((Date.now() - t0) / 60000).toFixed(1)} min ═══`);
if (failed.length) { console.log('Gefaald: ' + failed.map(f => f.s).join(', ')); process.exit(1); }
