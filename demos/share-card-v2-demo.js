// Share Card v2 — Demo logic
// 6 directions × live data binding. Brand: moranitraden.nl (hardcoded).

const BRAND = 'moranitraden.nl';

const STATE = {
  direction: 'reactions',
  variant: null,        // alleen relevant voor reactions
  manualOverride: false // user heeft mood-tile gekozen
};

// ─────────────────────────────────────────────────────────────
// Helpers — Dutch number formatting + auto-suggest
// ─────────────────────────────────────────────────────────────
const fmtMoney = n => {
  const sign = n < 0 ? '−' : '+';
  const abs = Math.abs(n);
  return `${sign}$${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs)}`;
};
const fmtMoneyDecimal = n => {
  const sign = n < 0 ? '−' : '+';
  const abs = Math.abs(n);
  return `${sign}$${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)}`;
};
const fmtPct = n => {
  if (isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '+';
  return `${sign}${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}%`;
};
const fmtR = n => {
  if (isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '+';
  return `${sign}${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(n))} R`;
};
const sideLabel = d => d.side === 'short' ? 'Short' : 'Long';
const sideArrow = d => d.side === 'short' ? '▼' : '▲';
const isWin = d => parseFloat(d.pnl) >= 0;

function autoSuggestVariant(d){
  const r = parseFloat(d.rmult);
  const isShort = d.side === 'short';
  if (isNaN(r)) return 'omg';
  if (r >= 5 && isShort) return 'finalboss';
  if (r >= 5) return 'goodfellas';
  if (r > 0 && r < 1) return 'giggling';
  if (r < 0) return 'pablo';
  return 'goodfellas';
}

function readForm(){
  const show = {};
  document.querySelectorAll('input[data-show]').forEach(cb => {
    show[cb.dataset.show] = cb.checked;
  });
  return {
    pair: document.getElementById('i-pair').value || 'BTC/USDT',
    side: document.getElementById('i-side').value,
    tradenr: document.getElementById('i-tradenr').value,
    date: document.getElementById('i-date').value,
    pnl: parseFloat(document.getElementById('i-pnl').value) || 0,
    rmult: parseFloat(document.getElementById('i-rmult').value),
    pct: parseFloat(document.getElementById('i-pct').value),
    hold: document.getElementById('i-hold').value,
    entry: document.getElementById('i-entry').value,
    exit: document.getElementById('i-exit').value,
    stop: document.getElementById('i-stop').value,
    setup: document.getElementById('i-setup').value,
    show,
  };
}

// ─────────────────────────────────────────────────────────────
// Reactions — variant content
// ─────────────────────────────────────────────────────────────
const REACT_VARIANTS = {
  goodfellas: {
    img: '../assets/share-cards/goodfellas.png',
    eyebrowPrefix: '▲ Closed',
    scream16: `I told<br/>you<em>so.</em>`,
    scream1: `I told you <em>so.</em>`,
    sticker16: { html: 'when stoploss<br/>holds <em>perfectly</em>', style: 'top:30px;left:30px;transform:rotate(-12deg)' },
    sticker1:  { html: 'stoploss<br/><em>held</em>', style: 'top:18px;left:18px;font-size:22px;transform:rotate(-10deg)' },
    decoration16: `<div class="confetti"><span style="background:#f97316;top:8%;left:10%;transform:rotate(15deg)"></span><span style="background:#22c55e;top:15%;left:80%;transform:rotate(-20deg)"></span><span style="background:#facc15;top:70%;left:6%;transform:rotate(40deg)"></span><span style="background:#ef4444;top:88%;left:45%;transform:rotate(-15deg)"></span><span style="background:#22c55e;top:30%;left:60%;transform:rotate(60deg);width:14px;height:14px"></span><span style="background:#facc15;top:55%;left:88%;transform:rotate(20deg)"></span></div>`,
    decoration1: `<div class="confetti"><span style="background:#f97316;top:12%;left:14%;transform:rotate(15deg)"></span><span style="background:#22c55e;top:22%;left:78%;transform:rotate(-20deg)"></span><span style="background:#facc15;top:70%;left:8%;transform:rotate(40deg)"></span></div>`,
    tape16: 'top:-6px;left:30%',
  },
  giggling: {
    img: '../assets/share-cards/giggling.png',
    eyebrowPrefix: '▲ Scalp',
    scream16: `Tiny W,<br/>big <em>smile.</em>`,
    scream1: `Tiny W, big <em>smile.</em>`,
    sticker16: { html: '+0,5 R<br/><em>still counts!</em>', style: 'top:24px;right:24px;transform:rotate(6deg)' },
    sticker1:  { html: 'still<br/><em>counts!</em>', style: 'top:18px;right:18px;font-size:20px;transform:rotate(6deg)' },
    decoration16: `<div class="hearts"><span style="top:12%;left:8%">♡</span><span style="top:25%;right:10%">♡</span><span style="bottom:14%;left:14%">♡</span><span style="top:55%;right:20%;font-size:18px">♡</span></div>`,
    decoration1: `<div class="hearts"><span style="top:14%;left:12%">♡</span><span style="top:60%;right:14%">♡</span></div>`,
    tape16: 'top:-6px;right:22%',
  },
  omg: {
    img: '../assets/share-cards/omg.png',
    eyebrowPrefix: '⏵ Setup',
    scream16: `OMG<br/>this <em>is it.</em>`,
    scream1: `OMG this <em>is it.</em>`,
    sticker16: { html: 'setup =<br/><em>chefs kiss</em>', style: 'top:24px;right:24px;transform:rotate(8deg)' },
    sticker1:  { html: 'chefs<br/><em>kiss</em>', style: 'top:18px;right:18px;font-size:20px;transform:rotate(8deg)' },
    decoration16: `<div class="rays"></div><div class="stars"><span style="top:14%;left:10%">★</span><span style="top:70%;right:12%;font-size:18px">★</span><span style="bottom:18%;left:18%;font-size:30px">✦</span></div>`,
    decoration1: `<div class="stars"><span style="top:18%;left:12%;font-size:18px">★</span><span style="top:64%;right:14%;font-size:22px">✦</span></div>`,
    tape16: null,
    isPreEntry: true,
  },
  finalboss: {
    img: '../assets/share-cards/finalboss.png',
    eyebrowPrefix: '▼ Closed',
    scream16: `Final boss<br/><em>energy.</em>`,
    scream1: `Final boss<em> energy.</em>`,
    sticker16: { html: 'no mercy<br/>no overstay', style: 'bottom:24px;left:24px' },
    sticker1:  { html: 'no mercy', style: 'bottom:18px;left:18px;font-size:14px' },
    decoration16: `<div class="glint" style="top:10%;left:0;width:60%;height:2px"></div><div class="glint" style="bottom:30%;right:0;width:40%;height:1px"></div>`,
    decoration1: '',
    tape16: null,
  },
  pablo: {
    img: '../assets/share-cards/pablo.png',
    eyebrowPrefix: '▼ Stopped',
    scream16: `Took<br/>the<em>L.</em>`,
    scream1: `Took the <em>L.</em>`,
    sticker16: { html: 'stops are<br/><em>tuition</em>', style: 'top:30px;right:30px;transform:rotate(7deg)' },
    sticker1:  { html: 'stops =<br/><em>tuition</em>', style: 'top:18px;right:18px;font-size:18px;transform:rotate(7deg)' },
    decoration16: `<div class="rain"><span style="top:10%;left:14%"></span><span style="top:30%;left:42%"></span><span style="top:60%;left:72%"></span><span style="top:18%;left:78%"></span><span style="top:50%;left:24%"></span></div>`,
    decoration1: '',
    tape16: 'top:-6px;right:25%',
  },
};

// ─────────────────────────────────────────────────────────────
// Reactions render
// ─────────────────────────────────────────────────────────────
function renderReactions16x9(variant, d){
  const v = REACT_VARIANTS[variant];
  const s = d.show;
  const eyebrow = `${v.eyebrowPrefix} · ${sideLabel(d)} · ${d.pair}`;
  const stickerHtml = v.sticker16 ? `<div class="sticker" style="${v.sticker16.style}">${v.sticker16.html}</div>` : '';
  const tapeHtml = v.tape16 ? `<div class="tape" style="${v.tape16}"></div>` : '';

  // Brand-sub: "Trade Nº X · Vol. III" of fallback
  const brandSub = v.isPreEntry ? 'Setup Alert · Vol. III'
                   : (s.tradenr ? `Trade Nº ${d.tradenr} · Vol. III` : 'Vol. III');
  const numPill = s.date ? `<div class="num-pill">${d.date}</div>` : '';

  // Stats rij: alleen tonen wat aan staat
  const statsRows = [];
  if (s.pct)   statsRows.push(`<div><b>${fmtPct(d.pct)}</b> Return</div>`);
  if (s.rmult) statsRows.push(`<div><b>${fmtR(d.rmult)}</b> Multiple</div>`);
  if (s.hold)  statsRows.push(`<div><b>${d.hold || '—'}</b> Hold</div>`);
  const statsBlock = statsRows.length ? `<div class="pnl-stats">${statsRows.join('')}</div>` : '';

  // Meta-row componenten
  const metaParts = [];
  metaParts.push(`<span class="pair">${d.pair} · ${sideLabel(d)}</span>`);
  if (s.entryexit) metaParts.push(v.isPreEntry ? `<span>Setup: <b>${s.setup ? d.setup : '—'}</b></span>` : `<span>${d.entry} → <b>${d.exit}</b></span>`);
  else if (s.setup && !v.isPreEntry) metaParts.push(`<span>${d.setup}</span>`);
  metaParts.push(`<span>${BRAND}</span>`);

  const pnlBlock = v.isPreEntry
    ? `<div class="pnl-block"><div class="pnl-row" style="align-items:center">
        <div style="font-family:'Archivo Black';font-size:48px;line-height:.95;color:#facc15;letter-spacing:-.025em">PRE<br/>ENTRY</div>
        <div class="pnl-stats">
          ${s.entryexit ? `<div>Entry zone <b>${d.entry}</b></div>` : ''}
          ${s.stop ? `<div>Stop <b>${d.stop}</b></div>` : ''}
          ${s.entryexit && s.rmult ? `<div>Target <b>${d.exit}</b> · <b>${fmtR(d.rmult).replace(/^[+−]/, '')}+</b></div>` : ''}
        </div>
      </div><div class="meta-row">${metaParts.join('')}</div></div>`
    : `<div class="pnl-block"><div class="pnl-row">
        ${s.pnl ? `<div class="pnl-num">${fmtMoney(d.pnl)}</div>` : ''}
        ${statsBlock}
      </div><div class="meta-row">${metaParts.join('')}</div></div>`;

  return `<article class="card card-16x9 v-${variant}" id="card-16x9-render">
    <div class="photo"><img src="${v.img}" alt=""/>${v.decoration16}${stickerHtml}</div>
    <div class="content">${tapeHtml}
      <div class="top-row">
        <div><div class="brand-mark">Sync<em>Journal</em></div><div class="brand-sub">${brandSub}</div></div>
        ${numPill}
      </div>
      <div class="scream"><div class="scream-eyebrow">${eyebrow}</div><div class="scream-line">${v.scream16}</div></div>
      ${pnlBlock}
    </div>
  </article>`;
}

function renderReactions1x1(variant, d){
  const v = REACT_VARIANTS[variant];
  const s = d.show;
  const stickerHtml = v.sticker1 ? `<div class="sticker" style="${v.sticker1.style}">${v.sticker1.html}</div>` : '';

  // Pill: PRE-ENTRY (omg) of R-multiple of date als R uit
  const pillContent = v.isPreEntry ? 'PRE-ENTRY'
                       : (s.rmult && !isNaN(d.rmult)) ? fmtR(d.rmult)
                       : (s.date ? d.date : '');
  const pillHtml = pillContent ? `<div class="num-pill" style="font-size:9px">${pillContent}</div>` : '';

  // Brand-sub: Nº X · datum, beide afhankelijk van toggles
  const subParts = [];
  if (s.tradenr) subParts.push(`Nº ${d.tradenr}`);
  if (s.date)    subParts.push(d.date);
  const brandSub = subParts.length ? subParts.join(' · ') : 'Vol. III';

  // Stats — voor 1:1 max 2 items voor space
  const statsRows = [];
  if (s.pct)  statsRows.push(`<div><b>${fmtPct(d.pct)}</b></div>`);
  if (s.hold) statsRows.push(`<div><b>${d.hold || '—'}</b></div>`);
  const statsBlock = statsRows.length ? `<div class="pnl-stats">${statsRows.join('')}</div>` : '';

  const pnlBlock = v.isPreEntry
    ? `<div class="pnl-block"><div class="pnl-row">
        ${s.entryexit ? `<div style="font-family:'Archivo Black';font-size:30px;color:#facc15;letter-spacing:-.025em">${d.entry}<br/><span style="font-size:14px;color:rgba(253,244,255,.6)">entry zone</span></div>` : ''}
        <div class="pnl-stats">
          ${s.entryexit ? `<div>TP <b>${d.exit}</b></div>` : ''}
          ${s.rmult ? `<div><b>${fmtR(d.rmult).replace(/^[+−]/, '')}+</b> target</div>` : ''}
        </div>
      </div></div>`
    : `<div class="pnl-block"><div class="pnl-row">
        ${s.pnl ? `<div class="pnl-num">${fmtMoney(d.pnl)}</div>` : ''}
        ${statsBlock}
      </div></div>`;

  return `<article class="card card-1x1 v-${variant}" id="card-1x1-render">
    <div class="photo"><img src="${v.img}" alt=""/>${v.decoration1}${stickerHtml}</div>
    <div class="content">
      <div class="top-row">
        <div><div class="brand-mark" style="font-size:14px">Sync<em>Journal</em></div><div class="brand-sub" style="font-size:8px">${brandSub}</div></div>
        ${pillHtml}
      </div>
      <div class="scream"><div class="scream-eyebrow" style="font-size:9px">${sideArrow(d)} ${sideLabel(d)} · ${d.pair}</div><div class="scream-line">${v.scream1}</div></div>
      ${pnlBlock}
    </div>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Cinema render
// ─────────────────────────────────────────────────────────────
function makeCinemaTitle(d){
  // "A Clean Break of Seventy-Two" template — vervang waar mogelijk met data
  return isWin(d)
    ? `A Clean Break<em>of ${(parseFloat(d.exit) >= 1 ? d.exit.replace(/[\.,].*$/, '') : d.exit)}</em>`
    : `The Cost of <em>Conviction</em>`;
}
function renderCinema16x9(d){
  const s = d.show;
  const winClass = isWin(d) ? '' : ' loss';
  const sprockets = Array(9).fill('<div class="sprocket"></div>').join('');
  const billing = `Sync<em style="font-style:italic">Journal</em> presents · A Morani trade${s.tradenr ? ` · No. ${d.tradenr}` : ''}`;
  const tagline = s.setup
    ? `${d.setup}${s.hold ? ', ' + d.hold : ''} — ${isWin(d) ? 'and the levels held.' : 'the thesis broke.'}`
    : (isWin(d) ? 'The levels held.' : 'The thesis broke; the stop did its job.');
  const metaParts = [];
  if (s.pct) metaParts.push(fmtPct(d.pct));
  if (s.rmult) metaParts.push(fmtR(d.rmult));
  const credits = [];
  credits.push(`<div class="credits-block"><div class="credit-row"><div class="credit-role">Featuring</div><div class="credit-name">${d.pair.replace('/', ' <em>/</em> ')}</div></div></div>`);
  credits.push(`<div class="credits-block"><div class="credit-row"><div class="credit-role">Direction</div><div class="credit-name"><b>${sideLabel(d)}</b></div></div></div>`);
  if (s.setup) credits.push(`<div class="credits-block"><div class="credit-row"><div class="credit-role">Setup</div><div class="credit-name">${d.setup}</div></div></div>`);
  const bottomLeftParts = [];
  if (s.entryexit) bottomLeftParts.push(`Entry <b>${d.entry}</b> · Exit <b>${d.exit}</b>`);
  if (s.stop) bottomLeftParts.push(`Stop <b>${d.stop}</b>`);
  return `<article class="card card-16x9" id="card-16x9-render">
    <div class="sprockets left">${sprockets}</div>
    <div class="sprockets right">${sprockets}</div>
    ${s.tradenr ? `<div class="reel"><span class="reel-circle"></span> REEL ${d.tradenr} / SCENE IV</div>` : ''}
    <header class="top">
      <div class="studio">A film by <b>SYNC<em>JOURNAL</em></b></div>
      ${s.hold ? `<div class="runtime">Running time · ${d.hold}</div>` : ''}
    </header>
    <div class="left-pane">
      <div class="billing">${billing}</div>
      <h2 class="title">${makeCinemaTitle(d)}</h2>
      <p class="tagline">${tagline}</p>
    </div>
    <div class="vrule"></div>
    <div class="right-pane">
      <div>${credits.join('')}</div>
      <div class="pnl-hero">
        <div class="label">Realized P&amp;L</div>
        ${s.pnl ? `<div class="num${winClass}">${fmtMoneyDecimal(d.pnl)}</div>` : ''}
        ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
      </div>
    </div>
    <footer class="bottom">
      <div class="left">${bottomLeftParts.join('<br/>') || ''}</div>
      <div class="center">— a Morani picture —</div>
      <div class="right">${s.date ? d.date + '<br/>' : ''}${BRAND}</div>
    </footer>
  </article>`;
}
function renderCinema1x1(d){
  const s = d.show;
  const winClass = isWin(d) ? '' : ' loss';
  const sprockets = Array(8).fill('<div class="sprocket"></div>').join('');
  const billingParts = ['A Morani trade'];
  if (s.tradenr) billingParts.push(`Nº ${d.tradenr}`);
  if (s.date) billingParts.push(d.date);
  const tagline = s.setup
    ? `${d.setup} — ${isWin(d) ? 'levels held.' : 'thesis broke.'}`
    : (isWin(d) ? 'The levels held.' : 'Thesis broke; stop did its job.');
  const stats = [];
  if (s.pct) stats.push(`<div><span class="k">Return</span><em>${fmtPct(d.pct)}</em></div>`);
  if (s.rmult) stats.push(`<div><span class="k">R</span><em>${fmtR(d.rmult)}</em></div>`);
  stats.push(`<div><span class="k">Pair</span>${d.pair} · <b>${sideLabel(d)}</b></div>`);
  return `<article class="card card-1x1" id="card-1x1-render">
    <div class="sprockets left">${sprockets}</div>
    <div class="sprockets right">${sprockets}</div>
    ${s.tradenr ? `<div class="reel"><span class="reel-circle"></span> REEL ${d.tradenr}</div>` : ''}
    <header class="top"><div class="studio"><b>SYNC<em>JOURNAL</em></b></div>${s.hold ? `<div class="runtime">${d.hold}</div>` : ''}</header>
    <div class="left-pane">
      <div class="billing">${billingParts.join(' · ')}</div>
      <h2 class="title">${makeCinemaTitle(d)}</h2>
      <p class="tagline">${tagline}</p>
      <div class="pnl-hero-1x1" style="margin-top:24px">
        <div><div class="label">Realized P&amp;L</div>${s.pnl ? `<div class="num${winClass}">${fmtMoney(d.pnl)}</div>` : ''}</div>
        <div class="stats">${stats.join('')}</div>
      </div>
    </div>
    <footer class="bottom"><div class="left">${s.entryexit ? `Entry <b>${d.entry}</b> · Exit <b>${d.exit}</b>` : ''}</div><div class="center">— a Morani picture —</div><div class="right">${BRAND}</div></footer>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Dossier render
// ─────────────────────────────────────────────────────────────
function renderDossier16x9(d){
  const s = d.show;
  const winClass = isWin(d) ? 'win' : 'loss';
  const subParts = [`<span class="lede">${d.pair}</span> opened${s.entryexit ? ` at <b>${d.entry}</b>` : ''} and ${isWin(d) ? 'was retired' : 'was stopped'}${s.entryexit ? ` at <b>${d.exit}</b>` : ''}.`];
  if (s.hold) subParts.push(` Held ${d.hold}.`);
  if (s.setup) subParts.push(` Setup: ${d.setup}.`);
  const factSideParts = [];
  if (s.pct) factSideParts.push(`<b>${fmtPct(d.pct)}</b> return`);
  if (s.rmult) factSideParts.push(`<b>${fmtR(d.rmult)}</b> on risk`);
  const headlineExit = s.entryexit ? parseFloat(d.exit).toLocaleString('nl-NL').split(',')[0] : 'the level';
  // Build optional table rows
  const tableRows = [];
  tableRows.push(`<tr><td>Instrument</td><td>${d.pair}</td></tr>`);
  tableRows.push(`<tr><td>Direction</td><td>${sideLabel(d)}</td></tr>`);
  if (s.entryexit) {
    tableRows.push(`<tr><td>Entry</td><td>${d.entry}</td></tr>`);
    tableRows.push(`<tr><td>Exit</td><td>${d.exit}</td></tr>`);
  }
  if (s.stop) tableRows.push(`<tr><td>Stop loss</td><td>${d.stop}</td></tr>`);
  if (s.setup) tableRows.push(`<tr><td>Setup</td><td>${d.setup}</td></tr>`);
  if (s.hold) tableRows.push(`<tr><td>Hold</td><td>${d.hold}</td></tr>`);
  return `<article class="card card-16x9" id="card-16x9-render">
    <header class="masthead">
      <div class="mast-left">
        <div class="mast-logo">Sync<em>Journal</em></div>
        ${s.tradenr ? `<div class="mast-vol">Vol. III · Nº ${d.tradenr}</div>` : `<div class="mast-vol">Vol. III</div>`}
      </div>
      <div class="mast-right">${s.date ? d.date + '<br/>' : ''}${d.pair} · <b>${sideLabel(d)}</b></div>
    </header>
    <div class="body-grid">
      <div class="col-left">
        <div>
          <div class="kicker">${isWin(d) ? 'Closed Position' : 'Stopped Position'} · ${sideLabel(d)}</div>
          <h2 class="headline">${isWin(d) ? `A clean break of <em>${headlineExit}</em>.` : `The thesis <em>did not hold</em>.`}</h2>
          <p class="subhead">${subParts.join('')}</p>
        </div>
        ${s.pnl || factSideParts.length ? `<div class="fact">
          <div><div class="fact-label">Realized P&amp;L · net of fees</div>${s.pnl ? `<div class="fact-num ${winClass}">${fmtMoneyDecimal(d.pnl)}</div>` : ''}</div>
          ${factSideParts.length ? `<div class="fact-side">${factSideParts.join('<br/>')}</div>` : ''}
        </div>` : ''}
      </div>
      <div class="vrule"></div>
      <div class="col-right">
        <div class="tab-title">Trade record</div>
        <table class="data-table"><tbody>${tableRows.join('')}</tbody></table>
      </div>
    </div>
    <footer class="colophon">
      <div class="colophon-left"><span>${BRAND}</span><span>by Morani</span></div>
      <div class="colophon-right">— Discipline is the only edge.</div>
      <div class="folio">${s.tradenr ? d.tradenr : 'III'}</div>
    </footer>
  </article>`;
}
function renderDossier1x1(d){
  const s = d.show;
  const winClass = isWin(d) ? 'win' : 'loss';
  const subParts = [];
  if (s.setup) subParts.push(d.setup);
  if (s.hold) subParts.push(`held ${d.hold}`);
  const subText = subParts.length ? subParts.join(' — ') + '.' : '';
  const factSideParts = [];
  if (s.pct) factSideParts.push(`<b>${fmtPct(d.pct)}</b>`);
  if (s.rmult) factSideParts.push(`<b>${fmtR(d.rmult)}</b>`);
  const tableRows = [];
  if (s.entryexit) {
    tableRows.push(`<tr><td>Entry</td><td>${d.entry}</td></tr>`);
    tableRows.push(`<tr><td>Exit</td><td>${d.exit}</td></tr>`);
  }
  if (s.stop) tableRows.push(`<tr><td>Stop</td><td>${d.stop}</td></tr>`);
  if (s.setup) tableRows.push(`<tr><td>Setup</td><td>${d.setup}</td></tr>`);
  return `<article class="card card-1x1" id="card-1x1-render">
    <header class="masthead">
      <div class="mast-left"><div class="mast-logo" style="font-size:26px">Sync<em>Journal</em></div>${s.tradenr ? `<div class="mast-vol">Nº ${d.tradenr}</div>` : ''}</div>
      <div class="mast-right">${s.date ? d.date + '<br/>' : ''}<b>${sideLabel(d)}</b> · ${d.pair}</div>
    </header>
    <div class="body-grid">
      <div class="col-left">
        <div>
          <div class="kicker">${isWin(d) ? 'Closed' : 'Stopped'} · ${sideLabel(d)} · ${d.pair}</div>
          <h2 class="headline">${isWin(d) ? `A clean break <em>held</em>.` : `Thesis <em>broke</em>.`}</h2>
          ${subText ? `<p class="subhead" style="max-width:none">${subText}</p>` : ''}
        </div>
        ${s.pnl || factSideParts.length ? `<div class="fact" style="margin-top:24px">
          <div><div class="fact-label">Realized P&amp;L</div>${s.pnl ? `<div class="fact-num ${winClass}">${fmtMoneyDecimal(d.pnl)}</div>` : ''}</div>
          ${factSideParts.length ? `<div class="fact-side">${factSideParts.join('<br/>')}</div>` : ''}
        </div>` : ''}
        ${tableRows.length ? `<div class="col-right"><table class="data-table" style="margin-top:0"><tbody>${tableRows.join('')}</tbody></table></div>` : ''}
      </div>
    </div>
    <footer class="colophon">
      <div class="colophon-left"><span>${BRAND}</span></div>
      <div class="colophon-right">— Discipline is the only edge.</div>
      <div class="folio">${s.tradenr ? d.tradenr : 'III'}</div>
    </footer>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Monogram render
// ─────────────────────────────────────────────────────────────
function renderMonogram16x9(d){
  const s = d.show;
  const winClass = isWin(d) ? 'win' : 'loss';
  const formatted = fmtMoneyDecimal(d.pnl);
  const [mainPart, centsPart] = formatted.split(',');
  const subParts = [];
  if (s.setup) subParts.push(d.setup);
  if (s.hold) subParts.push(`held ${d.hold}`);
  const subText = subParts.length ? subParts.join(' — ') + '.' : '';
  const facts = [];
  if (s.pct) facts.push(`<div class="fact-item"><div class="k">Return</div><div class="v ${isWin(d) ? 'pos' : 'neg'}">${fmtPct(d.pct)}</div></div>`);
  if (s.rmult) facts.push(`<div class="fact-item"><div class="k">R-Multiple</div><div class="v accent">${fmtR(d.rmult)}</div></div>`);
  if (s.entryexit) {
    facts.push(`<div class="fact-item"><div class="k">Entry</div><div class="v">${d.entry}</div></div>`);
    facts.push(`<div class="fact-item"><div class="k">Exit</div><div class="v ${isWin(d) ? 'pos' : 'neg'}">${d.exit}</div></div>`);
  }
  if (s.hold) facts.push(`<div class="fact-item"><div class="k">Hold</div><div class="v">${d.hold}</div></div>`);
  return `<article class="card card-16x9" id="card-16x9-render">
    <div class="watermark">M</div>
    <header class="hdr">
      <div><div class="mark">Sync<em>Journal</em></div><div class="mark-sub">By Morani · Vol. III${s.tradenr ? ' · Nº ' + d.tradenr : ''}</div></div>
      <div class="hdr-meta">${s.date ? d.date + '<br/>' : ''}${d.pair} · <b>${sideLabel(d)}</b></div>
    </header>
    <div class="center">
      <div class="pretag">${d.pair} <span>·</span> ${sideLabel(d)} <span>·</span> ${isWin(d) ? 'Closed' : 'Stopped'}</div>
      ${s.pnl ? `<div class="num ${winClass}">${mainPart}<span class="small">,${centsPart || '00'}</span></div>` : ''}
      ${subText ? `<div class="post">${subText}</div>` : ''}
      ${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}
    </div>
    <footer class="ftr">
      <span>${BRAND}</span>
      <span class="ftr-mark">— ${isWin(d) ? 'a cleared trade.' : 'a stopped trade.'}</span>
      <span>${s.tradenr ? 'Nº ' + d.tradenr : 'Vol. III'}</span>
    </footer>
  </article>`;
}
function renderMonogram1x1(d){
  const s = d.show;
  const winClass = isWin(d) ? 'win' : 'loss';
  const formatted = fmtMoneyDecimal(d.pnl);
  const [mainPart, centsPart] = formatted.split(',');
  const subParts = [];
  if (s.setup) subParts.push(d.setup);
  if (s.hold) subParts.push(`held ${d.hold}`);
  const subText = subParts.length ? subParts.join(' — ') + '.' : '';
  const headParts = [];
  if (s.tradenr) headParts.push(`Nº ${d.tradenr}`);
  if (s.date) headParts.push(d.date);
  const facts = [];
  if (s.pct) facts.push(`<div class="fact-item"><div class="k">Return</div><div class="v ${isWin(d) ? 'pos' : 'neg'}">${fmtPct(d.pct)}</div></div>`);
  if (s.rmult) facts.push(`<div class="fact-item"><div class="k">R</div><div class="v accent">${fmtR(d.rmult)}</div></div>`);
  if (s.hold) facts.push(`<div class="fact-item"><div class="k">Hold</div><div class="v">${d.hold}</div></div>`);
  return `<article class="card card-1x1" id="card-1x1-render">
    <div class="watermark">M</div>
    <header class="hdr">
      <div><div class="mark" style="font-size:30px">Sync<em>Journal</em></div>${headParts.length ? `<div class="mark-sub">${headParts.join(' · ')}</div>` : ''}</div>
      <div class="hdr-meta">${sideLabel(d)} · ${d.pair}</div>
    </header>
    <div class="center" style="padding:0">
      <div class="pretag" style="margin-top:30px">Realized P&amp;L · net of fees</div>
      ${s.pnl ? `<div class="num ${winClass}">${mainPart}<span class="small">,${centsPart || '00'}</span></div>` : ''}
      ${subText ? `<div class="post" style="font-size:17px">${subText}</div>` : ''}
      ${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}
    </div>
    <footer class="ftr">
      <span>${BRAND}</span>
      <span class="ftr-mark" style="font-size:24px">— ${isWin(d) ? 'cleared' : 'stopped'}.</span>
    </footer>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Portrait render
// ─────────────────────────────────────────────────────────────
function renderPortrait16x9(d){
  const winClass = isWin(d) ? '' : 'loss';
  const dirClass = d.side === 'short' ? 'short' : '';
  const pnlAbs = Math.abs(parseFloat(d.pnl) || 0);
  const pnlInt = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(pnlAbs);
  const sign = parseFloat(d.pnl) >= 0 ? '+' : '−';
  return `<article class="card card-16x9" id="card-16x9-render">
    <div class="misreg"></div>
    <div class="topstrip">
      <div class="badge">SyncJournal</div>
      <div class="title">
        <div class="title-num">${d.tradenr}</div>
        <div class="title-label"><b>${isWin(d) ? 'Closed Position' : 'Stopped Position'}</b>BY MORANI · VOL. III</div>
      </div>
      <div class="meta">${d.date}<br/>${d.pair}</div>
    </div>
    <div class="poster">
      <div class="hero">
        <div>
          <div class="hero-tag">Realized P&amp;L · net of fees</div>
          <div class="hero-num ${winClass}"><span class="sign">${sign}</span><span class="currency">$</span>${pnlInt}</div>
        </div>
        <div class="hero-bottom">
          <div class="stat"><div class="stat-label">Return</div><div class="stat-val ${isWin(d) ? 'win' : 'loss'}">${fmtPct(d.pct)}</div></div>
          <div class="stat"><div class="stat-label">R-Multiple</div><div class="stat-val accent">${fmtR(d.rmult)}</div></div>
          <div class="stat"><div class="stat-label">Hold</div><div class="stat-val">${d.hold}</div></div>
          <div class="stat"><div class="stat-label">Pair</div><div class="stat-val">${d.pair.replace('/', '/')}</div></div>
        </div>
      </div>
      <aside class="side">
        <div>
          <div class="side-pair">${d.pair.split('/')[0]}<br/>${d.pair.split('/')[1] || ''}</div>
          <span class="side-dir ${dirClass}">${sideArrow(d)} ${sideLabel(d).toUpperCase()}</span>
          <div class="side-grid">
            <div class="side-cell"><div class="side-key">Entry</div><div class="side-val">${d.entry}</div></div>
            <div class="side-cell"><div class="side-key">Exit</div><div class="side-val ${isWin(d) ? 'pos' : 'neg'}">${d.exit}</div></div>
            <div class="side-cell"><div class="side-key">Stop</div><div class="side-val neg">${d.stop}</div></div>
            <div class="side-cell"><div class="side-key">Setup</div><div class="side-val" style="font-size:14px;font-family:'Archivo Black';letter-spacing:.04em;text-transform:uppercase">${d.setup.split('·')[0].trim()}</div></div>
          </div>
        </div>
      </aside>
    </div>
    <div class="footer">
      <div class="left"><span>Nº <b>${d.tradenr}</b></span></div>
      <div class="right">${BRAND}<em>by Morani · Trader Nº III</em></div>
    </div>
  </article>`;
}
function renderPortrait1x1(d){
  const winClass = isWin(d) ? '' : 'loss';
  const dirClass = d.side === 'short' ? 'short' : '';
  const pnlAbs = Math.abs(parseFloat(d.pnl) || 0);
  const pnlInt = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(pnlAbs);
  const sign = parseFloat(d.pnl) >= 0 ? '+' : '−';
  return `<article class="card card-1x1" id="card-1x1-render">
    <div class="misreg"></div>
    <div class="topstrip">
      <div class="badge">SyncJournal</div>
      <div class="title">
        <div class="title-num">${d.tradenr}</div>
        <div class="title-label"><b>${isWin(d) ? 'Closed' : 'Stopped'} · ${sideLabel(d)}</b>${d.date} · ${d.pair}</div>
      </div>
    </div>
    <div class="poster">
      <div class="hero">
        <div>
          <div class="hero-tag">Realized P&amp;L</div>
          <div class="hero-num ${winClass}"><span class="sign">${sign}</span><span class="currency">$</span>${pnlInt}</div>
        </div>
        <div class="hero-bottom" style="gap:12px">
          <div class="stat"><div class="stat-label">Return</div><div class="stat-val ${isWin(d) ? 'win' : 'loss'}" style="font-size:30px">${fmtPct(d.pct)}</div></div>
          <div class="stat"><div class="stat-label">R-Mult</div><div class="stat-val accent" style="font-size:30px">${fmtR(d.rmult)}</div></div>
          <div class="stat"><div class="stat-label">Hold</div><div class="stat-val" style="font-size:30px">${d.hold}</div></div>
        </div>
      </div>
      <aside class="side">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px">
          <div class="side-pair" style="font-size:32px;margin-bottom:0">${d.pair}</div>
          <span class="side-dir ${dirClass}">${sideArrow(d)} ${sideLabel(d).toUpperCase()}</span>
        </div>
        <div class="side-grid" style="margin-top:14px;grid-template-columns:repeat(4,1fr);gap:0">
          <div class="side-cell" style="border-right:1px solid rgba(10,10,10,.18);padding:10px 12px"><div class="side-key">Entry</div><div class="side-val">${d.entry}</div></div>
          <div class="side-cell" style="border-right:1px solid rgba(10,10,10,.18);padding:10px 12px"><div class="side-key">Exit</div><div class="side-val ${isWin(d) ? 'pos' : 'neg'}">${d.exit}</div></div>
          <div class="side-cell" style="border-right:1px solid rgba(10,10,10,.18);padding:10px 12px"><div class="side-key">Stop</div><div class="side-val neg">${d.stop}</div></div>
          <div class="side-cell" style="padding:10px 12px"><div class="side-key">Setup</div><div class="side-val" style="font-size:13px;font-family:'Archivo Black';letter-spacing:.04em;text-transform:uppercase">${d.setup.split('·')[0].trim()}</div></div>
        </div>
      </aside>
    </div>
    <div class="footer">
      <div class="left"><span>Nº <b>${d.tradenr}</b></span></div>
      <div class="right">${BRAND}</div>
    </div>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Archive render
// ─────────────────────────────────────────────────────────────
function fileNumber(d){
  return `SJ-${(new Date()).getFullYear()}-${String(d.tradenr).padStart(4, '0')}`;
}
function renderArchive16x9(d){
  const winClass = isWin(d) ? '' : 'loss';
  return `<article class="card card-16x9" id="card-16x9-render">
    <div class="holes"><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div></div>
    <div class="crease"></div>
    <div class="banner">${isWin(d) ? 'Closed · Confidential' : 'Stopped · Confidential'}</div>
    <header class="head">
      <div><div class="agency">SYNC<em>JOURNAL</em></div><div class="agency-sub">Trader Records Bureau · Vol. III</div></div>
      <div class="file-no"><div class="k">File №</div><div class="v">${fileNumber(d)}</div></div>
      <div class="head-meta">
        <div><span class="k">Date</span> ${d.date}</div>
        <div><span class="k">Pair</span> ${d.pair}</div>
        <div><span class="k">Side</span> ${sideLabel(d).toUpperCase()}</div>
        <div><span class="k">Officer</span> Morani, J.</div>
      </div>
    </header>
    <div class="body">
      <div class="typed-row big">
        <div class="k">Subject</div>
        <div class="v"><b>${d.pair}</b> &nbsp;·&nbsp; Direction: <b>${sideLabel(d).toUpperCase()}</b> &nbsp;·&nbsp; Status: <b style="background:rgba(${isWin(d) ? '38,74,42' : '150,35,35'},.12)">${isWin(d) ? 'CLOSED' : 'STOPPED'}</b></div>
      </div>
      <div class="typed-row"><div class="k">Entry</div><div class="v">Position opened at <b>${d.entry}</b></div></div>
      <div class="typed-row"><div class="k">Exit</div><div class="v">Position cleared at <b>${d.exit}</b> after <b>${d.hold}</b></div></div>
      <div class="typed-row"><div class="k">Risk</div><div class="v">Stop placed at <b>${d.stop}</b></div></div>
      <div class="typed-row"><div class="k">Setup</div><div class="v">Tagged: <b>${d.setup}</b></div></div>
    </div>
    <aside class="stamps">
      <div class="pnl-stamp ${winClass}">
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
        <div class="label">P&amp;L · ${isWin(d) ? 'CLEARED' : 'STOPPED'}</div>
        <div class="num">${fmtMoneyDecimal(d.pnl)}</div>
        <div class="sub">${fmtPct(d.pct)} &nbsp;·&nbsp; ${fmtR(d.rmult)}</div>
      </div>
      <div class="stamp-rect">${isWin(d) ? 'Approved' : 'Reviewed'}</div>
      <div class="seal">Authorized<b>SJ</b>by Morani</div>
    </aside>
    <footer class="ftr">
      <div>${BRAND} &nbsp;·&nbsp; <b>Page 1/1</b></div>
      <div class="sig">— signed, <em>J. Morani</em><small>Trader Nº III</small></div>
      <div style="text-align:right">Filed: ${d.date}</div>
    </footer>
  </article>`;
}
function renderArchive1x1(d){
  const winClass = isWin(d) ? '' : 'loss';
  return `<article class="card card-1x1" id="card-1x1-render">
    <div class="holes"><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div><div class="hole"></div></div>
    <div class="crease"></div>
    <div class="banner">${isWin(d) ? 'Confidential' : 'Stopped'}</div>
    <header class="head" style="grid-template-columns:auto auto;gap:18px">
      <div><div class="agency" style="font-size:24px">SYNC<em>JOURNAL</em></div><div class="agency-sub">File · ${fileNumber(d)}</div></div>
      <div class="head-meta" style="font-size:11px">
        <div><span class="k">Date</span> ${d.date}</div>
        <div><span class="k">Pair</span> ${d.pair}</div>
        <div><span class="k">Side</span> ${sideLabel(d).toUpperCase()}</div>
      </div>
    </header>
    <div class="body">
      <div class="typed-row" style="grid-template-columns:110px 1fr"><div class="k">Entry</div><div class="v">Opened at <b>${d.entry}</b></div></div>
      <div class="typed-row" style="grid-template-columns:110px 1fr"><div class="k">Exit</div><div class="v">${isWin(d) ? 'Cleared' : 'Stopped'} at <b>${d.exit}</b> after <b>${d.hold}</b></div></div>
      <div class="typed-row" style="grid-template-columns:110px 1fr"><div class="k">Stop</div><div class="v">At <b>${d.stop}</b></div></div>
      <div class="typed-row" style="grid-template-columns:110px 1fr"><div class="k">Setup</div><div class="v"><b>${d.setup}</b></div></div>
      <div class="pnl-stamp-inline">
        <div class="pnl-stamp ${winClass}">
          <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
          <div class="label">P&amp;L · ${isWin(d) ? 'CLEARED' : 'STOPPED'}</div>
          <div class="num">${fmtMoney(d.pnl)}</div>
          <div class="sub">${fmtPct(d.pct)} · ${fmtR(d.rmult)}</div>
        </div>
        <div>
          <div class="stamp-rect">${isWin(d) ? 'Approved' : 'Reviewed'}</div>
          <div class="seal" style="margin-top:18px;margin-left:30px">Authorized<b>SJ</b>by Morani</div>
        </div>
      </div>
    </div>
    <footer class="ftr" style="grid-template-columns:1fr auto">
      <div>${BRAND}</div>
      <div class="sig" style="font-size:15px">— <em>J. Morani</em> · Vol. III</div>
    </footer>
  </article>`;
}

// ─────────────────────────────────────────────────────────────
// Direction registry
// ─────────────────────────────────────────────────────────────
const DIRECTIONS = {
  reactions: { hasMoods: true,  size16: '1080×608', size1: '520×520', render16: (d) => renderReactions16x9(STATE.variant, d), render1: (d) => renderReactions1x1(STATE.variant, d) },
  cinema:    { hasMoods: false, size16: '1200×675', size1: '760×760', render16: renderCinema16x9, render1: renderCinema1x1 },
  dossier:   { hasMoods: false, size16: '1200×675', size1: '760×760', render16: renderDossier16x9, render1: renderDossier1x1 },
  monogram:  { hasMoods: false, size16: '1200×675', size1: '760×760', render16: renderMonogram16x9, render1: renderMonogram1x1 },
  portrait:  { hasMoods: false, size16: '1200×675', size1: '760×760', render16: renderPortrait16x9, render1: renderPortrait1x1 },
  archive:   { hasMoods: false, size16: '1200×675', size1: '760×760', render16: renderArchive16x9, render1: renderArchive1x1 },
};

// ─────────────────────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────────────────────
function render(){
  const data = readForm();
  const dir = DIRECTIONS[STATE.direction];

  // Direction-tile active state
  document.querySelectorAll('.direction-tile').forEach(t => {
    t.classList.toggle('active', t.dataset.direction === STATE.direction);
  });

  // Mood-row visibility (alleen voor reactions)
  document.getElementById('moodRow').style.display = dir.hasMoods ? 'grid' : 'none';
  document.getElementById('autoPill').style.display = dir.hasMoods ? 'inline-flex' : 'none';

  // Auto-suggest variant (reactions)
  if (dir.hasMoods) {
    const suggested = autoSuggestVariant(data);
    document.getElementById('autoPill').textContent = `Auto-suggest mood: ${suggested}`;
    if (!STATE.manualOverride) STATE.variant = suggested;
    document.querySelectorAll('.mood-tile').forEach(t => {
      t.classList.toggle('active', t.dataset.variant === STATE.variant);
    });
  }

  // Stage labels
  document.getElementById('size-label-16x9').textContent = `16:9 · ${dir.size16} · Discord embed / X link preview`;
  document.getElementById('size-label-1x1').textContent  = `1:1 · ${dir.size1} · Twitter / X feed / Instagram`;

  // Wrap render output in a dir-* container
  document.getElementById('stage-16x9').innerHTML = `<div class="dir-${STATE.direction}">${dir.render16(data)}</div>`;
  document.getElementById('stage-1x1').innerHTML  = `<div class="dir-${STATE.direction}">${dir.render1(data)}</div>`;
}

// ─────────────────────────────────────────────────────────────
// Event wiring
// ─────────────────────────────────────────────────────────────
document.getElementById('directionRow').addEventListener('click', e => {
  const tile = e.target.closest('.direction-tile');
  if (!tile) return;
  STATE.direction = tile.dataset.direction;
  STATE.manualOverride = false; // reset mood-override bij direction-switch
  render();
});

document.getElementById('moodRow').addEventListener('click', e => {
  const tile = e.target.closest('.mood-tile');
  if (!tile) return;
  STATE.variant = tile.dataset.variant;
  STATE.manualOverride = true;
  render();
});

['i-pair','i-side','i-tradenr','i-date','i-pnl','i-rmult','i-pct','i-hold','i-entry','i-exit','i-stop','i-setup'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (id === 'i-rmult' || id === 'i-side') STATE.manualOverride = false;
    render();
  });
});

// Show-toggle checkboxes → re-render
document.querySelectorAll('input[data-show]').forEach(cb => {
  cb.addEventListener('change', render);
});

// ─────────────────────────────────────────────────────────────
// PNG download via html-to-image
// ─────────────────────────────────────────────────────────────
async function downloadCard(selectorId, suffix){
  const node = document.getElementById(selectorId);
  if (!node || !window.htmlToImage) { alert('html-to-image niet geladen'); return; }
  try {
    const dataUrl = await window.htmlToImage.toPng(node, { pixelRatio: 2, cacheBust: true, quality: 1 });
    const data = readForm();
    const variantSuffix = STATE.direction === 'reactions' ? `-${STATE.variant}` : '';
    const link = document.createElement('a');
    link.download = `syncjournal-${data.tradenr || 'trade'}-${STATE.direction}${variantSuffix}-${suffix}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download mislukt — open via localhost (npx serve .) niet file://. Error: ' + err.message);
  }
}
document.getElementById('dl-16x9').addEventListener('click', () => downloadCard('card-16x9-render', '16x9'));
document.getElementById('dl-1x1').addEventListener('click', () => downloadCard('card-1x1-render', '1x1'));

// Initial
render();
