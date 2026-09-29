#!/usr/bin/env node
// De release-poort: `node tests/run-release.js` moet groen zijn vóór er iets vertrekt.
//
// Bestaat als eigen commando omdat een vlag te makkelijk vergeten wordt op het moment dat
// het ertoe doet. Welke specs meedoen staat in release-set.js; het draaien zelf doet
// run-all-sj.js. Argumenten (bv. --jobs=1) gaan gewoon door.
//
// Standaard draait de poort in een WORKTREE: een losse kopie van de laatste commit, waar
// niemand aan zit. Op 28-09-2026 werd een meting twee keer waardeloos doordat
// work/syncjournal.html halverwege een lopende suite werd verwisseld. In een worktree kan dat
// niet, en je test precies wat je gaat vrijgeven: de commit, niet je werkmap.
//   --hier  draai in de huidige map. CI doet dat: die checkout is al een losse kopie.
const { spawnSync } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');

if (process.argv.includes('--hier')) {
  process.argv.push('--release');
  require('./run-all-sj.js');
} else {
  const repo = path.resolve(__dirname, '..');
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  const sha = git('rev-parse', '--short', 'HEAD').stdout.trim();

  // Wat niet gecommit is, zit niet in de kopie. Dat is de bedoeling, maar zeg het wel.
  const open = git('status', '--porcelain', '--', 'work', 'site', 'tests').stdout.trim();
  if (open) {
    console.log('⚠ Niet-gecommitte wijzigingen in work/, site/ of tests/ worden NIET getest:');
    console.log(open.split('\n').slice(0, 8).map((l) => '   ' + l).join('\n') + '\n');
  }

  const wt = path.join(os.tmpdir(), `sj-poort-${sha}-${Date.now()}`);
  // core.autocrlf=false: check de bytes uit zoals ze in git staan (LF), net als CI op Linux.
  // Met de Windows-standaard (true) krijgt de kopie CRLF, en dan faalde landing.spec op
  // robots.txt terwijl de site en CI gewoon LF hebben.
  const add = git('-c', 'core.autocrlf=false', 'worktree', 'add', '--detach', wt, 'HEAD');
  if (add.status !== 0) { console.log('✗ worktree maken mislukt:\n' + add.stderr); process.exit(1); }

  // node_modules is gitignored en zit dus niet in de kopie; een junction wijst naar de echte.
  const nm = path.join(wt, 'node_modules');
  let code = 1;
  try {
    fs.symlinkSync(path.join(repo, 'node_modules'), nm, 'junction');
    console.log(`Release-poort op commit ${sha}, in een losse kopie.\n`);
    const r = spawnSync(process.execPath, [path.join(wt, 'tests', 'run-release.js'), '--hier', ...process.argv.slice(2)],
      { cwd: wt, stdio: 'inherit' });
    code = r.status == null ? 1 : r.status;
  } finally {
    // Eerst de junction los (zonder recursive: alleen de koppeling, nooit de echte
    // node_modules), pas dan de worktree weg.
    try { fs.rmSync(nm); } catch (e) {}
    git('worktree', 'remove', '--force', wt);
  }
  process.exit(code);
}
