#!/usr/bin/env node
// Draait de SyncJournal-testsuite in één commando en vat samen.
//   node tests/run-all-sj.js             → alle specs in tests/, behalve UITGESLOTEN
//   node tests/run-all-sj.js --release   → alleen de release-poort (tests/release-set.js)
//   node tests/run-all-sj.js e2e trash   → alleen specs waarvan de naam matcht
//   node tests/run-all-sj.js --jobs=1    → serieel (standaard 4 tegelijk)
//   node tests/run-all-sj.js --lijst     → toon wat er zou draaien, draai niets
// De e2e-doorloop (tests/e2e-doorloop.spec.js) is de "alles-in-samenhang"-test:
// accounts, saldo-mutaties, trades CRUD, tags, TP's, prullenbak + cross-page-consistentie.
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// De suite leest de map, in plaats van een lijst bij te houden die je moet onthouden.
// Dat was precies het probleem: op 27-09-2026 stonden er 76 namen in de hand-lijst terwijl
// tests/ er 173 bevatte — 97 specs draaiden dus nooit, waaronder de hele MEXC-cluster, alle
// sync-specs en smoke. Een INsluitlijst loopt achter; een UITsluitlijst niet.
//
// Voor een RELEASE geldt het omgekeerde: daar wil je juist een vaste, bewust gekozen set,
// want ongeveer de helft van de map beschrijft nog de oude journal en staat rood zonder dat
// de app stuk is. Die set staat in release-set.js en draait met --release.
const UITGESLOTEN = [
  'design-review',        // pixel-diff over de thema's x 3 schermen — eigen, tragere poort
  'a11y',                 // axe-core over 18 combinaties, ~3 min — idem
  'ux-audit-screenshots', // maakt alleen screenshots, toetst niets
];
// De grote doorloop eerst én alleen: die vangt integratie-breuken meteen, dus daar wil je
// niet op wachten en je wilt hem ook niet laten concurreren met vijftien andere browsers.
const EERST = ['e2e-doorloop'];

const RELEASE = process.argv.includes('--release');
const bestaat = (n) => fs.existsSync(path.join(__dirname, n + '.spec.js'));

const ALLE = RELEASE
  ? require('./release-set.js').filter((n) => !UITGESLOTEN.includes(n))
  : fs.readdirSync(__dirname)
      .filter((f) => f.endsWith('.spec.js'))
      .map((f) => f.slice(0, -'.spec.js'.length))
      .filter((n) => !UITGESLOTEN.includes(n))
      .sort();

// Een release-set die naar een verdwenen spec wijst is stil kapot: de poort lijkt te slagen
// terwijl er minder draait dan je denkt. Daarom hard stoppen in plaats van overslaan.
const ONTBREEKT = ALLE.filter((n) => !bestaat(n));
if (ONTBREEKT.length) {
  console.log(`✗ ${ONTBREEKT.length} spec(s) uit ${RELEASE ? 'release-set.js' : 'de map'} bestaan niet: ${ONTBREEKT.join(', ')}`);
  process.exit(1);
}

const SPECS = [...EERST.filter((n) => ALLE.includes(n)), ...ALLE.filter((n) => !EERST.includes(n))];

const filter = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const run = filter.length ? SPECS.filter((s) => filter.some((f) => s.includes(f))) : SPECS;
const JOBS = Math.max(1, +((process.argv.find((a) => a.startsWith('--jobs=')) || '').split('=')[1]) || 4);

if (process.argv.includes('--lijst')) {
  console.log(run.join('\n'));
  console.log(`\n${run.length} specs${RELEASE ? ' · release-poort' : ''} · ${JOBS} tegelijk${UITGESLOTEN.length ? ' · uitgesloten: ' + UITGESLOTEN.join(', ') : ''}`);
  process.exit(0);
}
const env = { ...process.env, NODE_PATH: path.resolve(__dirname, '..', 'node_modules') };
const results = []; const t0 = Date.now();

// CI-preflight: één kale browser-start met zichtbare fout. Faalt dit, dan verklaart
// deze ene regel waarom álle specs rood zijn (bv. browser-binary of systeemlib mist).
console.log('Node', process.version, '· Playwright', (() => { try { return require('playwright/package.json').version; } catch (e) { return 'ONTBREEKT: ' + e.message; } })());
const pre = spawnSync(process.execPath, ['-e', "const{chromium}=require('playwright');chromium.launch().then(b=>b.close()).then(()=>console.log('browser-start OK')).catch(e=>{console.log('BROWSER-START FAALT:',String(e).split('\\n').slice(0,8).join(' · '));process.exit(1)})"], { env, encoding: 'utf8', timeout: 120000 });
console.log(((pre.stdout || '') + (pre.stderr || '')).trim().split('\n').slice(0, 8).join(' · ') || 'preflight: geen output');
console.log(`${run.length} specs${RELEASE ? ' · release-poort' : ''} · ${JOBS} tegelijk\n`);

// De suite kent twee soorten specs en ze starten niet hetzelfde:
//   - Node-stijl: een gewoon script met een eigen ok()-teller  -> node <spec>
//   - runner-stijl: test()-blokken van @playwright/test        -> playwright test <spec>
// Een runner-spec met node starten faalt meteen ("test.describe() was not expected here").
// Dat gebeurde tot 27-09-2026 niet, omdat die specs simpelweg niet in de hand-lijst stonden.
const isRunnerSpec = (() => {
  const cache = new Map();
  return (s) => {
    if (!cache.has(s)) {
      let bron = '';
      try { bron = fs.readFileSync(path.join(__dirname, s + '.spec.js'), 'utf8'); } catch (e) {}
      cache.set(s, /require\(['"]@playwright\/test['"]\)|from ['"]@playwright\/test['"]/.test(bron));
    }
    return cache.get(s);
  };
})();

const samenvatting = (out) => {
  // Node-specs sluiten af met "=== Naam: n/n ==="; playwright met "N passed (12.3s)".
  const eigen = (out.match(/===\s*(.+?)\s*===\s*$/m) || [, ''])[1];
  if (eigen) return eigen;
  const geslaagd = (out.match(/(\d+) passed/) || [, null])[1];
  const gezakt = (out.match(/(\d+) failed/) || [, null])[1];
  const overgeslagen = (out.match(/(\d+) skipped/) || [, null])[1];
  return geslaagd || gezakt
    ? `${geslaagd || 0} geslaagd${gezakt ? ', ' + gezakt + ' gefaald' : ''}${overgeslagen ? ', ' + overgeslagen + ' overgeslagen' : ''}`
    : '?';
};

const runSpec = (s) => new Promise((klaar) => {
  // --workers=1: playwright parallelliseert anders zélf óók, en dan draaien er JOBS x N
  // browsers tegelijk. De pool hieronder bepaalt de gelijktijdigheid, niet playwright.
  const [cmd, args, opts] = isRunnerSpec(s)
    // Playwright leest het argument als patroon op het bestandspad; een absoluut Windows-pad
    // met backslashes matcht niet ("No tests found"). Daarom relatief, met schuine strepen.
    ? ['npx', ['playwright', 'test', 'tests/' + s + '.spec.js', '--reporter=line', '--workers=1', '--timeout=' + (process.env.SPEC_TIMEOUT || '30000')],
       { env, shell: true, cwd: path.resolve(__dirname, '..') }]
    : [process.execPath, [path.join(__dirname, s + '.spec.js')], { env }];
  const p = spawn(cmd, args, opts);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  const kap = setTimeout(() => { try { p.kill(); } catch (e) {} out += '\n[afgekapt na 300s]'; }, 300000);
  p.on('error', (e) => { out += '\nspawn-fout: ' + e.message; });
  p.on('close', (code) => { clearTimeout(kap); klaar({ ok: code === 0, out, sum: samenvatting(out) }); });
});

const doeSpec = async (s) => {
  const st = Date.now();
  let r = await runSpec(s), flaky = false;
  // Eén herkansing: trage CI-runners (GitHub Actions) halen soms een timing-check niet.
  // Twee keer rood = echt rood; één keer = ⚠ flaky, telt als groen.
  // GEEN_HERKANSING=1 slaat de tweede poging over: bij een diagnose-ronde wil je snel
  // weten wát er rood is, niet of het toevallig de tweede keer wel lukt.
  if (!r.ok && !process.env.GEEN_HERKANSING) { const r2 = await runSpec(s); if (r2.ok) { flaky = true; r = r2; } }
  const skipped = r.ok && /overgeslagen/i.test(r.sum);
  results.push({ s, okAll: r.ok, sum: r.sum, ms: Date.now() - st });
  // Eén blok per spec, in één keer geschreven: bij parallel draaien lopen losse regels
  // van verschillende specs anders door elkaar heen.
  let blok = `${r.ok ? (skipped ? '⏭️' : flaky ? '⚠️' : '✅') : '❌'} ${s.padEnd(24)} ${r.sum}${flaky ? '  (flaky: 2e poging groen)' : ''}  (${((Date.now() - st) / 1000).toFixed(1)}s)`;
  if (!r.ok) {
    const cross = r.out.split('\n').filter((l) => l.includes('✗'));
    // geen ✗-regels = de spec crashte vóór de eerste check → toon de echte fout (CI-diagnose)
    blok += '\n' + (cross.length ? cross : r.out.split('\n').filter((l) => l.trim()).slice(-14)).map((l) => '   ' + l.trim()).join('\n');
  }
  console.log(blok);
};

// Werkerspool: zoveel specs tegelijk als JOBS toestaat. De specs zijn onafhankelijk —
// elke spec start zijn eigen browser en wist zijn eigen localStorage — dus er is niets
// dat serieel moet. Serieel duurde de release-poort ~55 min, met 4 tegelijk ~15.
const pool = async (lijst) => {
  const wacht = lijst.slice();
  const werker = async () => { while (wacht.length) await doeSpec(wacht.shift()); };
  await Promise.all(Array.from({ length: Math.min(JOBS, lijst.length) }, werker));
};

(async () => {
  const eerst = run.filter((s) => EERST.includes(s));
  const rest = run.filter((s) => !EERST.includes(s));
  for (const s of eerst) await doeSpec(s);   // alleen, zonder concurrentie
  await pool(rest);

  const failed = results.filter((r) => !r.okAll);
  console.log(`\n═══ SyncJournal-suite${RELEASE ? ' (release-poort)' : ''}: ${results.length - failed.length}/${results.length} specs groen · ${((Date.now() - t0) / 60000).toFixed(1)} min ═══`);
  if (failed.length) {
    console.log('Gefaald: ' + failed.map((f) => f.s).sort().join(', '));
    // GitHub-annotatie: bij publieke repo's via de API leesbaar zónder in te loggen,
    // zodat de CI-diagnose ook zonder log-screenshots op te vragen is.
    if (process.env.GITHUB_ACTIONS) {
      const pre1 = ((pre.stdout || '') + (pre.stderr || '')).trim().split('\n')[0] || '';
      console.log(`::error title=SyncJournal-suite ${results.length - failed.length}/${results.length}::preflight: ${pre1} | gefaald: ${failed.map((f) => f.s + '(' + f.sum + ')').slice(0, 8).join(', ')}${failed.length > 8 ? ' +' + (failed.length - 8) : ''}`);
    }
    process.exit(1);
  }
})();
