// Voegt een "Andere exchange?"-sectie toe vóór de Open-Accounts CTA in elke
// exchange-lesson (l18-l22). Eenmalige migratie — script kan na gebruik
// gearchiveerd of verwijderd worden.
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../work/tradejournal.html');
let html = fs.readFileSync(FILE, 'utf8');

const EXCHANGES = [
  { id: 'l18', emoji: '🟣', name: 'Blofin' },
  { id: 'l19', emoji: '🟢', name: 'MEXC' },
  { id: 'l20', emoji: '🟠', name: 'Kraken Futures' },
  { id: 'l21', emoji: '🔵', name: 'Hyperliquid' },
  { id: 'l22', emoji: '🔴', name: 'FTMO (MT5)' },
];

function buildOtherExchangeSection(currentId) {
  const others = EXCHANGES.filter(e => e.id !== currentId);
  const chips = others.map(e =>
    `<button class="lesson-link" data-lesson-target="${e.id}" style="padding:8px 14px;border:1px solid var(--gold-border);background:var(--gold-dim);color:var(--gold);border-radius:6px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px">${e.emoji} ${e.name} →</button>`
  ).join('');
  return `<h2>Andere exchange?</h2><p>Snel naar een andere handleiding zonder via de Help-tab terug:</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 22px">${chips}</div>`;
}

// Voor elke lesson: zoek de Open-Accounts CTA en plak de sectie er direct vóór.
// Aangezien de Open-Accounts string in alle 5 lessons identiek is, identificeer
// ik per lesson via een uniek voorafgaand stuk uit de troubleshooting-list.
const REPLACEMENTS = [
  {
    id: 'l18',
    anchor: 'Lukt het echt niet? Plak een gesanitiseerde sample-CSV in de Morani Discord — we kijken mee.</li></ol><button class="lesson-link" data-target="accounts">Open Accounts →</button>',
  },
  {
    id: 'l19',
    anchor: 'Lukt het echt niet? Plak een gesanitiseerde sample-CSV in de Morani Discord.</li></ol><button class="lesson-link" data-target="accounts">Open Accounts →</button>',
  },
  {
    id: 'l20',
    anchor: 'Geen funding fees zichtbaar</strong>? Account Log bevat ze, maar SyncJournal toont ze als context — niet als trade. Geen bug.</li><li>Lukt het echt niet? Plak een sample in #syncjournal-feedback.</li></ol><button class="lesson-link" data-target="accounts">Open Accounts →</button>',
  },
  {
    id: 'l21',
    anchor: 'Trades stoppen plotseling</strong>? Hyperliquid API kan rate-limiten bij veel sync-cycles. Wacht 5 min en probeer opnieuw.</li><li>Lukt het echt niet? Plak een sample in #syncjournal-feedback.</li></ol><button class="lesson-link" data-target="accounts">Open Accounts →</button>',
  },
  {
    id: 'l22',
    anchor: 'Lukt het echt niet? Plak een sample in #syncjournal-feedback met je account-type erbij.</li></ol><button class="lesson-link" data-target="accounts">Open Accounts →</button>',
  },
];

let count = 0;
for (const r of REPLACEMENTS) {
  const section = buildOtherExchangeSection(r.id);
  // Vervang Open-Accounts-CTA met: section + zelfde CTA
  const before = r.anchor;
  // Nieuwe structuur: trouble-list-end + andere-exchange-section + Open-Accounts CTA
  const replaceFrom = before;
  const replaceTo = before.replace(
    '<button class="lesson-link" data-target="accounts">Open Accounts →</button>',
    section + '<button class="lesson-link" data-target="accounts">Open Accounts →</button>'
  );
  if (!html.includes(replaceFrom)) {
    console.error(`Anchor not found for ${r.id}!`);
    process.exit(1);
  }
  html = html.replace(replaceFrom, replaceTo);
  count++;
  console.log(`Patched ${r.id}`);
}

fs.writeFileSync(FILE, html, 'utf8');
console.log(`Done — ${count} lessons updated`);
