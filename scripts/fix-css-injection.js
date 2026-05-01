// Fix: verplaats ten onrechte ge-injecteerde CSS van Babel-script naar head <style>.
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '../work/tradejournal.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');
const NL = html.includes('\r\n') ? '\r\n' : '\n';

// Find injected CSS block via begin/end markers
const startMarker = '/* ════════════════════════════════════════════════════════════' + NL + '   SHARE CARD v2 — 4 directions (Reactions/Cinema/Dossier/Monogram)';
const endMarker = '/* END SHARE CARD v2 */';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) { console.error('Markers not found'); process.exit(1); }

// Extract block including any leading/trailing whitespace + the end-marker
const blockEndIdx = endIdx + endMarker.length;
const block = html.slice(startIdx, blockEndIdx);
console.log('Block size:', block.length, 'bytes');

// Remove from current location
html = html.slice(0, startIdx) + html.slice(blockEndIdx).replace(/^[\r\n\s]+/, NL);

// Insert before FIRST </style> (head stylesheet)
const firstStyleEnd = html.indexOf('</style>');
if (firstStyleEnd === -1) { console.error('No </style> found'); process.exit(1); }
console.log('First </style> at byte:', firstStyleEnd);

html = html.slice(0, firstStyleEnd) + NL + block + NL + html.slice(firstStyleEnd);

fs.writeFileSync(HTML_PATH, html);
console.log('Done. New size:', (html.length / 1024 / 1024).toFixed(2), 'MB');
