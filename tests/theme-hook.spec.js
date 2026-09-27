// Bewaakt de theme-token-hook zelf (.claude/hooks/check-theme-tokens.js).
//
// Aanleiding (27-09-2026): de hook keek alleen naar work/tradejournal.html — de BEVROREN app.
// Sinds de naamswijziging naar syncjournal.html blokkeerde hij dus niets meer, en dat viel
// nergens op: een stille guardrail ziet er precies zo uit als een werkende. Deze spec toetst
// alle drie de padvormen die langs kunnen komen (absoluut, relatief, Windows-backslashes).
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'check-theme-tokens.js');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

/** Draait de hook met één Edit-payload en geeft de exitcode terug. 2 = geblokkeerd. */
const draai = (filePath, tekst) => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: filePath, new_string: tekst } }),
  encoding: 'utf8',
}).status;

/** Zelfde geval, maar langs elk padformaat dat de hook in het echt kan krijgen. */
const padvormen = (rel) => [
  ['absoluut', path.join(ROOT, rel)],
  ['relatief', rel],
  ['backslash', (ROOT + '\\' + rel).replace(/\//g, '\\')],
];

const toets = (naam, rel, tekst, verwacht) => {
  for (const [vorm, p] of padvormen(rel)) {
    const code = draai(p, tekst);
    ok(`${naam} · ${vorm}`, code === verwacht, `exit=${code}, verwacht ${verwacht}`);
  }
};

console.log('─── Blokkeert hardgecodeerde kleuren in de journal ───');
toets('live app · #fff', 'work/syncjournal.html', '<div style={{color:"#fff"}}>x</div>', 2);
toets('live app · #000', 'work/syncjournal.html', '<div style={{background:"#000"}}>x</div>', 2);
toets('live app · goud', 'work/syncjournal.html', '<div style={{color:"#C9A84C"}}>x</div>', 2);
toets('live app · rgb wit', 'work/syncjournal.html', '<div style={{color:"rgb(255,255,255)"}}>x</div>', 2);
toets('bevroren app · #fff', 'work/tradejournal.html', '<div style={{color:"#fff"}}>x</div>', 2);

console.log('─── Laat door wat mag ───');
toets('theme-token', 'work/syncjournal.html', '<div style={{color:"var(--text)"}}>x</div>', 0);
toets('CSS-override in style-blok', 'work/syncjournal.html', 'body.theme-light .x { color: #fff; }', 0);
toets('ander bestand', 'demos/iets.html', '<div style={{color:"#fff"}}>x</div>', 0);

console.log('─── Raakt niets anders ───');
ok('geen Edit/Write → altijd door', spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo #fff' } }), encoding: 'utf8',
}).status === 0);
ok('lege payload → altijd door', spawnSync(process.execPath, [HOOK], { input: '{}', encoding: 'utf8' }).status === 0);

console.log(`\n=== Theme-hook: ${pass}/${pass + fail} ===`);
process.exit(fail ? 1 : 0);
