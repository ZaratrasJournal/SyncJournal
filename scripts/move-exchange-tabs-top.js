// v12.80 — verplaats "Andere exchange?"-sectie van onderaan naar bovenaan elke lesson,
// als compacte tab-strip met active-state highlight voor de self-exchange.
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

function buildTabsForLesson(currentId) {
  const tabs = EXCHANGES.map(e => {
    if (e.id === currentId) {
      return `<button class="active" aria-current="page">${e.emoji} ${e.name}</button>`;
    }
    return `<button class="lesson-link" data-lesson-target="${e.id}">${e.emoji} ${e.name} →</button>`;
  }).join('');
  return `<div class="lesson-exchange-tabs">${tabs}</div>`;
}

function buildOldOtherExchangeSection(currentId) {
  const others = EXCHANGES.filter(e => e.id !== currentId);
  const chips = others.map(e =>
    `<button class="lesson-link" data-lesson-target="${e.id}" style="padding:8px 14px;border:1px solid var(--gold-border);background:var(--gold-dim);color:var(--gold);border-radius:6px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px">${e.emoji} ${e.name} →</button>`
  ).join('');
  return `<h2>Andere exchange?</h2><p>Snel naar een andere handleiding zonder via de Help-tab terug:</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 22px">${chips}</div>`;
}

let movedCount = 0;
for (const e of EXCHANGES) {
  const tabsHtml = buildTabsForLesson(e.id);
  const oldSection = buildOldOtherExchangeSection(e.id);

  // 1. Verwijder de onderaan-sectie (van vorige sprint v12.79)
  if (html.includes(oldSection)) {
    html = html.replace(oldSection, '');
  } else {
    console.error(`[${e.id}] old onderaan-section niet gevonden — overslaan, mogelijk al verplaatst`);
    continue;
  }

  // 2. Inserteer tabs vlak na content:` van deze lesson — eerste positie in body
  // Pattern: id:"l18",...content:`<div class="lesson-tldr">  →  ...content:`<TABS><div class="lesson-tldr">
  // Of voor l18 die geen TL;DR heeft: ...content:`<p>Twee manieren...
  // We pakken het generiek: zoek `id:"l18"` ... `content:\`` en insert tabs direct erna.
  const lessonStart = `id:"${e.id}",`;
  const idx = html.indexOf(lessonStart);
  if (idx < 0) {
    console.error(`[${e.id}] lesson-id niet gevonden!`);
    process.exit(1);
  }
  // Vind de eerstvolgende content:` na dit id
  const contentMarker = 'content:`';
  const contentIdx = html.indexOf(contentMarker, idx);
  if (contentIdx < 0) {
    console.error(`[${e.id}] content-marker niet gevonden!`);
    process.exit(1);
  }
  const insertAt = contentIdx + contentMarker.length;
  // Skip als tabs er al staan (idempotent)
  const lookahead = html.slice(insertAt, insertAt + 50);
  if (lookahead.includes('lesson-exchange-tabs')) {
    console.log(`[${e.id}] tabs al aanwezig — skip`);
    continue;
  }
  html = html.slice(0, insertAt) + tabsHtml + html.slice(insertAt);
  movedCount++;
  console.log(`[${e.id}] tabs ingevoegd bovenaan + onderaan-sectie verwijderd`);
}

fs.writeFileSync(FILE, html, 'utf8');
console.log(`\nDone — ${movedCount} lessons updated`);
