#!/usr/bin/env node
// Maakt een distribueerbare kopie van work/syncjournal.html met een dataset
// vooraf ingebakken in het #sj-bundled JSON-blok. Andere gebruikers openen het
// bestand en zien bij een lege eerste-start meteen de meegeleverde trades.
//
// Gebruik:
//   node scripts/bundle-dataset.js <export.json> [uitvoer.html]
//   node scripts/bundle-dataset.js demo-dataset-1000.json dist/syncjournal-demo.html
//
// De export.json mag zowel een SyncJournal-export zijn ({app:'SyncJournal',...})
// als een oude TradeJournal-export ({version, trades:[...]}). De seed-logica in
// boot()/seedBundled() detecteert en migreert oude exports automatisch.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const dataArg = process.argv[2];
if (!dataArg) {
  console.error('Gebruik: node scripts/bundle-dataset.js <export.json> [uitvoer.html]');
  process.exit(1);
}
const dataPath = path.resolve(root, dataArg);
if (!fs.existsSync(dataPath)) {
  console.error('Dataset niet gevonden:', dataPath);
  process.exit(1);
}

const srcPath = path.join(root, 'work', 'syncjournal.html');
let html = fs.readFileSync(srcPath, 'utf8');

// Dataset inlezen + valideren dat er trades in zitten.
let data;
try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
catch (e) { console.error('Kon JSON niet parsen:', e.message); process.exit(1); }
const trades = Array.isArray(data) ? data : (data && data.trades);
if (!Array.isArray(trades) || !trades.length) {
  console.error('Geen trades gevonden in de dataset (verwacht een array of {trades:[...]}).');
  process.exit(1);
}
// Als het een kale trades-array is, verpak in minimaal export-object.
const bundle = Array.isArray(data) ? { trades: data } : data;

// JSON veilig in een <script>-blok zetten: geen "</script>" of HTML-comment-sluiters.
const json = JSON.stringify(bundle)
  .replace(/<\/script>/gi, '<\\/script>')
  .replace(/<!--/g, '<\\!--');

// Het #sj-bundled blok vervangen. Replacement als functie -> geen $-interpretatie.
const re = /(<script type="application\/json" id="sj-bundled">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) {
  console.error('Kon het #sj-bundled blok niet vinden in work/syncjournal.html.');
  process.exit(1);
}
html = html.replace(re, () => `<script type="application/json" id="sj-bundled">${json}</script>`);

const outArg = process.argv[3] || path.join('dist', 'syncjournal-bundled.html');
const outPath = path.resolve(root, outArg);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);

const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Gebundeld: ${trades.length} trades → ${path.relative(root, outPath)} (~${kb} KB).`);
console.log('Andere gebruikers openen dit bestand → dataset laadt bij lege eerste-start.');
