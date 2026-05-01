// Vervang oude TradeCardExport (v1) door nieuwe v2 met 4 directions.
// Markeert begin via "function TradeCardExport({trade,onClose}){"
// en eind via "function Section({title,storeKey,defaultOpen=true,hint,children}){".
//
// Run: node scripts/replace-trade-card-export.js
// Output: work/tradejournal.html (in-place edit)

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const MEMES_PATH = '/tmp/meme-base64.json';

const memes = JSON.parse(fs.readFileSync(MEMES_PATH, 'utf8'));

// Build het nieuwe blok — alles wat tussen de twee markers moet staan
const NEW_BLOCK = `// ============ TRADE CARD EXPORT (v2 — Share Card v2: 4 directions) ============
// Reactions / Cinema / Dossier / Monogram. Auto-suggest variant op R-multiple +
// side. Per-veld toggles voor wat op de card verschijnt. PNG-download via html2canvas.

// Base64-embedded meme images — 5 reaction-card backgrounds (Goodfellas/Giggling/
// OMG/FinalBoss/Pablo). ~1.8MB totaal. Houdt single-file HTML zelfstandig zonder
// externe assets/share-cards/ folder dependency.
const TC_GOODFELLAS_BG=${JSON.stringify(memes.goodfellas)};
const TC_GIGGLING_BG=${JSON.stringify(memes.giggling)};
const TC_OMG_BG=${JSON.stringify(memes.omg)};
const TC_FINALBOSS_BG=${JSON.stringify(memes.finalboss)};
const TC_PABLO_BG=${JSON.stringify(memes.pablo)};

// ── Format helpers (Dutch number format) ──
const tcFmtMoney=(n)=>{const sign=n<0?"−":"+";const abs=Math.abs(n);return sign+"$"+new Intl.NumberFormat("nl-NL",{minimumFractionDigits:0,maximumFractionDigits:0}).format(abs)};
const tcFmtMoneyDec=(n)=>{const sign=n<0?"−":"+";const abs=Math.abs(n);return sign+"$"+new Intl.NumberFormat("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2}).format(abs)};
const tcFmtPct=(n)=>{if(n==null||isNaN(n))return"—";const sign=n<0?"−":"+";return sign+new Intl.NumberFormat("nl-NL",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n))+"%"};
const tcFmtR=(n)=>{if(n==null||isNaN(n))return"—";const sign=n<0?"−":"+";return sign+new Intl.NumberFormat("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(n))+" R"};
const tcSideLabel=(d)=>d.side==="short"?"Short":"Long";
const tcSideArrow=(d)=>d.side==="short"?"▼":"▲";
const tcIsWin=(d)=>parseFloat(d.pnl)>=0;

// ── Auto-suggest reaction-variant op basis van R-multiple + side ──
const tcAutoVariant=(d)=>{const r=parseFloat(d.rmult);const s=d.side==="short";if(isNaN(r))return"omg";if(r>=5&&s)return"finalboss";if(r>=5)return"goodfellas";if(r>0&&r<1)return"giggling";if(r<0)return"pablo";return"goodfellas";};

// ── Auto-suggest direction op basis van trade-status ──
// Open trade → omg variant van Reactions (pre-entry vibe). Anders Reactions met R-mapped variant.
const tcAutoDirection=(d)=>"reactions";

// ── Reactions variant content ──
const TC_REACT={
  goodfellas:{img:TC_GOODFELLAS_BG,eyebrowPrefix:"▲ Closed",scream16:"I told<br/>you<em>so.</em>",scream1:"I told you <em>so.</em>",sticker16:{html:"when stoploss<br/>holds <em>perfectly</em>",style:"top:30px;left:30px;transform:rotate(-12deg)"},sticker1:{html:"stoploss<br/><em>held</em>",style:"top:18px;left:18px;font-size:22px;transform:rotate(-10deg)"},decoration16:'<div class="tc-confetti"><span style="background:#f97316;top:8%;left:10%;transform:rotate(15deg)"></span><span style="background:#22c55e;top:15%;left:80%;transform:rotate(-20deg)"></span><span style="background:#facc15;top:70%;left:6%;transform:rotate(40deg)"></span><span style="background:#ef4444;top:88%;left:45%;transform:rotate(-15deg)"></span><span style="background:#22c55e;top:30%;left:60%;transform:rotate(60deg);width:14px;height:14px"></span><span style="background:#facc15;top:55%;left:88%;transform:rotate(20deg)"></span></div>',decoration1:'<div class="tc-confetti"><span style="background:#f97316;top:12%;left:14%;transform:rotate(15deg)"></span><span style="background:#22c55e;top:22%;left:78%;transform:rotate(-20deg)"></span><span style="background:#facc15;top:70%;left:8%;transform:rotate(40deg)"></span></div>',tape16:"top:-6px;left:30%"},
  giggling:{img:TC_GIGGLING_BG,eyebrowPrefix:"▲ Scalp",scream16:"Tiny W,<br/>big <em>smile.</em>",scream1:"Tiny W, big <em>smile.</em>",sticker16:{html:"+0,5 R<br/><em>still counts!</em>",style:"top:24px;right:24px;transform:rotate(6deg)"},sticker1:{html:"still<br/><em>counts!</em>",style:"top:18px;right:18px;font-size:20px;transform:rotate(6deg)"},decoration16:'<div class="tc-hearts"><span style="top:12%;left:8%">♡</span><span style="top:25%;right:10%">♡</span><span style="bottom:14%;left:14%">♡</span><span style="top:55%;right:20%;font-size:18px">♡</span></div>',decoration1:'<div class="tc-hearts"><span style="top:14%;left:12%">♡</span><span style="top:60%;right:14%">♡</span></div>',tape16:"top:-6px;right:22%"},
  omg:{img:TC_OMG_BG,eyebrowPrefix:"⏵ Setup",scream16:"OMG<br/>this <em>is it.</em>",scream1:"OMG this <em>is it.</em>",sticker16:{html:"setup =<br/><em>chefs kiss</em>",style:"top:24px;right:24px;transform:rotate(8deg)"},sticker1:{html:"chefs<br/><em>kiss</em>",style:"top:18px;right:18px;font-size:20px;transform:rotate(8deg)"},decoration16:'<div class="tc-rays"></div><div class="tc-stars"><span style="top:14%;left:10%">★</span><span style="top:70%;right:12%;font-size:18px">★</span><span style="bottom:18%;left:18%;font-size:30px">✦</span></div>',decoration1:'<div class="tc-stars"><span style="top:18%;left:12%;font-size:18px">★</span><span style="top:64%;right:14%;font-size:22px">✦</span></div>',tape16:null,isPreEntry:true},
  finalboss:{img:TC_FINALBOSS_BG,eyebrowPrefix:"▼ Closed",scream16:"Final boss<br/><em>energy.</em>",scream1:"Final boss<em> energy.</em>",sticker16:{html:"no mercy<br/>no overstay",style:"bottom:24px;left:24px"},sticker1:{html:"no mercy",style:"bottom:18px;left:18px;font-size:14px"},decoration16:'<div class="tc-glint" style="top:10%;left:0;width:60%;height:2px"></div><div class="tc-glint" style="bottom:30%;right:0;width:40%;height:1px"></div>',decoration1:"",tape16:null},
  pablo:{img:TC_PABLO_BG,eyebrowPrefix:"▼ Stopped",scream16:"Took<br/>the<em>L.</em>",scream1:"Took the <em>L.</em>",sticker16:{html:"stops are<br/><em>tuition</em>",style:"top:30px;right:30px;transform:rotate(7deg)"},sticker1:{html:"stops =<br/><em>tuition</em>",style:"top:18px;right:18px;font-size:18px;transform:rotate(7deg)"},decoration16:'<div class="tc-rain"><span style="top:10%;left:14%"></span><span style="top:30%;left:42%"></span><span style="top:60%;left:72%"></span><span style="top:18%;left:78%"></span><span style="top:50%;left:24%"></span></div>',decoration1:"",tape16:"top:-6px;right:25%"},
};

// ── BRAND (vast, niet toggleable) ──
const TC_BRAND="moranitraden.nl";

// ── Render: Reactions ──
function tcRenderReactions16x9(variant,d){
  const v=TC_REACT[variant];const s=d.show;
  const eyebrow=v.eyebrowPrefix+" · "+tcSideLabel(d)+" · "+d.pair;
  const stickerHtml=v.sticker16?\`<div class="tc-sticker" style="\${v.sticker16.style}">\${v.sticker16.html}</div>\`:"";
  const tapeHtml=v.tape16?\`<div class="tc-tape" style="\${v.tape16}"></div>\`:"";
  const brandSub=v.isPreEntry?"Setup Alert · Vol. III":(s.tradenr?\`Trade Nº \${d.tradenr} · Vol. III\`:"Vol. III");
  const numPill=s.date?\`<div class="tc-num-pill">\${d.date}</div>\`:"";
  const statsRows=[];
  if(s.pct)statsRows.push(\`<div><b>\${tcFmtPct(d.pct)}</b> Return</div>\`);
  if(s.rmult)statsRows.push(\`<div><b>\${tcFmtR(d.rmult)}</b> Multiple</div>\`);
  if(s.hold)statsRows.push(\`<div><b>\${d.hold||"—"}</b> Hold</div>\`);
  const statsBlock=statsRows.length?\`<div class="tc-pnl-stats">\${statsRows.join("")}</div>\`:"";
  const metaParts=[\`<span class="tc-pair">\${d.pair} · \${tcSideLabel(d)}</span>\`];
  if(s.entryexit)metaParts.push(v.isPreEntry?\`<span>Setup: <b>\${s.setup?d.setup:"—"}</b></span>\`:\`<span>\${d.entry} → <b>\${d.exit}</b></span>\`);
  else if(s.setup&&!v.isPreEntry)metaParts.push(\`<span>\${d.setup}</span>\`);
  metaParts.push(\`<span>\${TC_BRAND}</span>\`);
  const pnlBlock=v.isPreEntry
    ?\`<div class="tc-pnl-block"><div class="tc-pnl-row" style="align-items:center"><div style="font-family:'Archivo Black';font-size:48px;line-height:.95;color:#facc15;letter-spacing:-.025em">PRE<br/>ENTRY</div><div class="tc-pnl-stats">\${s.entryexit?\`<div>Entry zone <b>\${d.entry}</b></div>\`:""}\${s.stop?\`<div>Stop <b>\${d.stop}</b></div>\`:""}\${s.entryexit&&s.rmult?\`<div>Target <b>\${d.exit}</b> · <b>\${tcFmtR(d.rmult).replace(/^[+−]/,"")}+</b></div>\`:""}</div></div><div class="tc-meta-row">\${metaParts.join("")}</div></div>\`
    :\`<div class="tc-pnl-block"><div class="tc-pnl-row">\${s.pnl?\`<div class="tc-pnl-num">\${tcFmtMoney(d.pnl)}</div>\`:""}\${statsBlock}</div><div class="tc-meta-row">\${metaParts.join("")}</div></div>\`;
  return \`<article class="tc-card tc-16x9 tc-v-\${variant}"><div class="tc-photo"><img src="\${v.img}" alt=""/>\${v.decoration16}\${stickerHtml}</div><div class="tc-content">\${tapeHtml}<div class="tc-top-row"><div><div class="tc-brand-mark">Sync<em>Journal</em></div><div class="tc-brand-sub">\${brandSub}</div></div>\${numPill}</div><div class="tc-scream"><div class="tc-scream-eyebrow">\${eyebrow}</div><div class="tc-scream-line">\${v.scream16}</div></div>\${pnlBlock}</div></article>\`;
}

function tcRenderReactions1x1(variant,d){
  const v=TC_REACT[variant];const s=d.show;
  const stickerHtml=v.sticker1?\`<div class="tc-sticker" style="\${v.sticker1.style}">\${v.sticker1.html}</div>\`:"";
  const pillContent=v.isPreEntry?"PRE-ENTRY":(s.rmult&&!isNaN(d.rmult)?tcFmtR(d.rmult):(s.date?d.date:""));
  const pillHtml=pillContent?\`<div class="tc-num-pill" style="font-size:9px">\${pillContent}</div>\`:"";
  const subParts=[];
  if(s.tradenr)subParts.push(\`Nº \${d.tradenr}\`);
  if(s.date)subParts.push(d.date);
  const brandSub=subParts.length?subParts.join(" · "):"Vol. III";
  const statsRows=[];
  if(s.pct)statsRows.push(\`<div><b>\${tcFmtPct(d.pct)}</b></div>\`);
  if(s.hold)statsRows.push(\`<div><b>\${d.hold||"—"}</b></div>\`);
  const statsBlock=statsRows.length?\`<div class="tc-pnl-stats">\${statsRows.join("")}</div>\`:"";
  const pnlBlock=v.isPreEntry
    ?\`<div class="tc-pnl-block"><div class="tc-pnl-row">\${s.entryexit?\`<div style="font-family:'Archivo Black';font-size:30px;color:#facc15;letter-spacing:-.025em">\${d.entry}<br/><span style="font-size:14px;color:rgba(253,244,255,.6)">entry zone</span></div>\`:""}<div class="tc-pnl-stats">\${s.entryexit?\`<div>TP <b>\${d.exit}</b></div>\`:""}\${s.rmult?\`<div><b>\${tcFmtR(d.rmult).replace(/^[+−]/,"")}+</b> target</div>\`:""}</div></div></div>\`
    :\`<div class="tc-pnl-block"><div class="tc-pnl-row">\${s.pnl?\`<div class="tc-pnl-num">\${tcFmtMoney(d.pnl)}</div>\`:""}\${statsBlock}</div></div>\`;
  return \`<article class="tc-card tc-1x1 tc-v-\${variant}"><div class="tc-photo"><img src="\${v.img}" alt=""/>\${v.decoration1}\${stickerHtml}</div><div class="tc-content"><div class="tc-top-row"><div><div class="tc-brand-mark" style="font-size:14px">Sync<em>Journal</em></div><div class="tc-brand-sub" style="font-size:8px">\${brandSub}</div></div>\${pillHtml}</div><div class="tc-scream"><div class="tc-scream-eyebrow" style="font-size:9px">\${tcSideArrow(d)} \${tcSideLabel(d)} · \${d.pair}</div><div class="tc-scream-line">\${v.scream1}</div></div>\${pnlBlock}</div></article>\`;
}

// ── Render: Cinema ──
const tcCinemaTitle=(d)=>tcIsWin(d)?\`A Clean Break<em>of \${(d.exit||"").toString().replace(/[\\.,].*$/,"")||"the level"}</em>\`:\`The Cost of <em>Conviction</em>\`;
function tcRenderCinema16x9(d){
  const s=d.show;const winClass=tcIsWin(d)?"":" loss";
  const sprockets=Array(9).fill('<div class="tc-sprocket"></div>').join("");
  const billing=\`Sync<em style="font-style:italic">Journal</em> presents · A Morani trade\${s.tradenr?" · No. "+d.tradenr:""}\`;
  const tagline=s.setup?\`\${d.setup}\${s.hold?", "+d.hold:""} — \${tcIsWin(d)?"and the levels held.":"the thesis broke."}\`:(tcIsWin(d)?"The levels held.":"The thesis broke; the stop did its job.");
  const metaParts=[];
  if(s.pct)metaParts.push(tcFmtPct(d.pct));
  if(s.rmult)metaParts.push(tcFmtR(d.rmult));
  const credits=[];
  credits.push(\`<div class="tc-credits-block"><div class="tc-credit-row"><div class="tc-credit-role">Featuring</div><div class="tc-credit-name">\${d.pair.replace("/"," <em>/</em> ")}</div></div></div>\`);
  credits.push(\`<div class="tc-credits-block"><div class="tc-credit-row"><div class="tc-credit-role">Direction</div><div class="tc-credit-name"><b>\${tcSideLabel(d)}</b></div></div></div>\`);
  if(s.setup)credits.push(\`<div class="tc-credits-block"><div class="tc-credit-row"><div class="tc-credit-role">Setup</div><div class="tc-credit-name">\${d.setup}</div></div></div>\`);
  const bottomLeftParts=[];
  if(s.entryexit)bottomLeftParts.push(\`Entry <b>\${d.entry}</b> · Exit <b>\${d.exit}</b>\`);
  if(s.stop)bottomLeftParts.push(\`Stop <b>\${d.stop}</b>\`);
  return \`<article class="tc-card tc-cinema-16x9"><div class="tc-sprockets tc-left">\${sprockets}</div><div class="tc-sprockets tc-right">\${sprockets}</div>\${s.tradenr?\`<div class="tc-reel"><span class="tc-reel-circle"></span> REEL \${d.tradenr} / SCENE IV</div>\`:""}<header class="tc-top"><div class="tc-studio">A film by <b>SYNC<em>JOURNAL</em></b></div>\${s.hold?\`<div class="tc-runtime">Running time · \${d.hold}</div>\`:""}</header><div class="tc-left-pane"><div class="tc-billing">\${billing}</div><h2 class="tc-title">\${tcCinemaTitle(d)}</h2><p class="tc-tagline">\${tagline}</p></div><div class="tc-vrule"></div><div class="tc-right-pane"><div>\${credits.join("")}</div><div class="tc-pnl-hero"><div class="tc-label">Realized P&amp;L</div>\${s.pnl?\`<div class="tc-num\${winClass}">\${tcFmtMoneyDec(d.pnl)}</div>\`:""}\${metaParts.length?\`<div class="tc-meta">\${metaParts.join(" · ")}</div>\`:""}</div></div><footer class="tc-bottom"><div class="tc-left">\${bottomLeftParts.join("<br/>")||""}</div><div class="tc-center">— a Morani picture —</div><div class="tc-right">\${s.date?d.date+"<br/>":""}\${TC_BRAND}</div></footer></article>\`;
}

function tcRenderCinema1x1(d){
  const s=d.show;const winClass=tcIsWin(d)?"":" loss";
  const sprockets=Array(8).fill('<div class="tc-sprocket"></div>').join("");
  const billingParts=["A Morani trade"];
  if(s.tradenr)billingParts.push(\`Nº \${d.tradenr}\`);
  if(s.date)billingParts.push(d.date);
  const tagline=s.setup?\`\${d.setup} — \${tcIsWin(d)?"levels held.":"thesis broke."}\`:(tcIsWin(d)?"The levels held.":"Thesis broke; stop did its job.");
  const stats=[];
  if(s.pct)stats.push(\`<div><span class="tc-k">Return</span><em>\${tcFmtPct(d.pct)}</em></div>\`);
  if(s.rmult)stats.push(\`<div><span class="tc-k">R</span><em>\${tcFmtR(d.rmult)}</em></div>\`);
  stats.push(\`<div><span class="tc-k">Pair</span>\${d.pair} · <b>\${tcSideLabel(d)}</b></div>\`);
  return \`<article class="tc-card tc-cinema-1x1"><div class="tc-sprockets tc-left">\${sprockets}</div><div class="tc-sprockets tc-right">\${sprockets}</div>\${s.tradenr?\`<div class="tc-reel"><span class="tc-reel-circle"></span> REEL \${d.tradenr}</div>\`:""}<header class="tc-top"><div class="tc-studio"><b>SYNC<em>JOURNAL</em></b></div>\${s.hold?\`<div class="tc-runtime">\${d.hold}</div>\`:""}</header><div class="tc-left-pane"><div class="tc-billing">\${billingParts.join(" · ")}</div><h2 class="tc-title">\${tcCinemaTitle(d)}</h2><p class="tc-tagline">\${tagline}</p><div class="tc-pnl-hero-1x1" style="margin-top:24px"><div><div class="tc-label">Realized P&amp;L</div>\${s.pnl?\`<div class="tc-num\${winClass}">\${tcFmtMoney(d.pnl)}</div>\`:""}</div><div class="tc-stats">\${stats.join("")}</div></div></div><footer class="tc-bottom"><div class="tc-left">\${s.entryexit?\`Entry <b>\${d.entry}</b> · Exit <b>\${d.exit}</b>\`:""}</div><div class="tc-center">— a Morani picture —</div><div class="tc-right">\${TC_BRAND}</div></footer></article>\`;
}

// ── Render: Dossier ──
function tcRenderDossier16x9(d){
  const s=d.show;const winClass=tcIsWin(d)?"win":"loss";
  const subParts=[\`<span class="tc-lede">\${d.pair}</span> opened\${s.entryexit?" at <b>"+d.entry+"</b>":""} and \${tcIsWin(d)?"was retired":"was stopped"}\${s.entryexit?" at <b>"+d.exit+"</b>":""}.\`];
  if(s.hold)subParts.push(\` Held \${d.hold}.\`);
  if(s.setup)subParts.push(\` Setup: \${d.setup}.\`);
  const factSideParts=[];
  if(s.pct)factSideParts.push(\`<b>\${tcFmtPct(d.pct)}</b> return\`);
  if(s.rmult)factSideParts.push(\`<b>\${tcFmtR(d.rmult)}</b> on risk\`);
  const headlineExit=s.entryexit&&d.exit?parseFloat(d.exit).toLocaleString("nl-NL").split(",")[0]:"the level";
  const tableRows=[];
  tableRows.push(\`<tr><td>Instrument</td><td>\${d.pair}</td></tr>\`);
  tableRows.push(\`<tr><td>Direction</td><td>\${tcSideLabel(d)}</td></tr>\`);
  if(s.entryexit){tableRows.push(\`<tr><td>Entry</td><td>\${d.entry}</td></tr>\`);tableRows.push(\`<tr><td>Exit</td><td>\${d.exit}</td></tr>\`);}
  if(s.stop)tableRows.push(\`<tr><td>Stop loss</td><td>\${d.stop}</td></tr>\`);
  if(s.setup)tableRows.push(\`<tr><td>Setup</td><td>\${d.setup}</td></tr>\`);
  if(s.hold)tableRows.push(\`<tr><td>Hold</td><td>\${d.hold}</td></tr>\`);
  return \`<article class="tc-card tc-dossier-16x9"><header class="tc-masthead"><div class="tc-mast-left"><div class="tc-mast-logo">Sync<em>Journal</em></div>\${s.tradenr?\`<div class="tc-mast-vol">Vol. III · Nº \${d.tradenr}</div>\`:\`<div class="tc-mast-vol">Vol. III</div>\`}</div><div class="tc-mast-right">\${s.date?d.date+"<br/>":""}\${d.pair} · <b>\${tcSideLabel(d)}</b></div></header><div class="tc-body-grid"><div class="tc-col-left"><div><div class="tc-kicker">\${tcIsWin(d)?"Closed Position":"Stopped Position"} · \${tcSideLabel(d)}</div><h2 class="tc-headline">\${tcIsWin(d)?\`A clean break of <em>\${headlineExit}</em>.\`:\`The thesis <em>did not hold</em>.\`}</h2><p class="tc-subhead">\${subParts.join("")}</p></div>\${s.pnl||factSideParts.length?\`<div class="tc-fact"><div><div class="tc-fact-label">Realized P&amp;L · net of fees</div>\${s.pnl?\`<div class="tc-fact-num \${winClass}">\${tcFmtMoneyDec(d.pnl)}</div>\`:""}</div>\${factSideParts.length?\`<div class="tc-fact-side">\${factSideParts.join("<br/>")}</div>\`:""}</div>\`:""}</div><div class="tc-vrule"></div><div class="tc-col-right"><div class="tc-tab-title">Trade record</div><table class="tc-data-table"><tbody>\${tableRows.join("")}</tbody></table></div></div><footer class="tc-colophon"><div class="tc-colophon-left"><span>\${TC_BRAND}</span><span>by Morani</span></div><div class="tc-colophon-right">— Discipline is the only edge.</div><div class="tc-folio">\${s.tradenr?d.tradenr:"III"}</div></footer></article>\`;
}

function tcRenderDossier1x1(d){
  const s=d.show;const winClass=tcIsWin(d)?"win":"loss";
  const subParts=[];
  if(s.setup)subParts.push(d.setup);
  if(s.hold)subParts.push(\`held \${d.hold}\`);
  const subText=subParts.length?subParts.join(" — ")+".":"";
  const factSideParts=[];
  if(s.pct)factSideParts.push(\`<b>\${tcFmtPct(d.pct)}</b>\`);
  if(s.rmult)factSideParts.push(\`<b>\${tcFmtR(d.rmult)}</b>\`);
  const tableRows=[];
  if(s.entryexit){tableRows.push(\`<tr><td>Entry</td><td>\${d.entry}</td></tr>\`);tableRows.push(\`<tr><td>Exit</td><td>\${d.exit}</td></tr>\`);}
  if(s.stop)tableRows.push(\`<tr><td>Stop</td><td>\${d.stop}</td></tr>\`);
  if(s.setup)tableRows.push(\`<tr><td>Setup</td><td>\${d.setup}</td></tr>\`);
  return \`<article class="tc-card tc-dossier-1x1"><header class="tc-masthead"><div class="tc-mast-left"><div class="tc-mast-logo" style="font-size:26px">Sync<em>Journal</em></div>\${s.tradenr?\`<div class="tc-mast-vol">Nº \${d.tradenr}</div>\`:""}</div><div class="tc-mast-right">\${s.date?d.date+"<br/>":""}<b>\${tcSideLabel(d)}</b> · \${d.pair}</div></header><div class="tc-body-grid"><div class="tc-col-left"><div><div class="tc-kicker">\${tcIsWin(d)?"Closed":"Stopped"} · \${tcSideLabel(d)} · \${d.pair}</div><h2 class="tc-headline">\${tcIsWin(d)?\`A clean break <em>held</em>.\`:\`Thesis <em>broke</em>.\`}</h2>\${subText?\`<p class="tc-subhead" style="max-width:none">\${subText}</p>\`:""}</div>\${s.pnl||factSideParts.length?\`<div class="tc-fact" style="margin-top:24px"><div><div class="tc-fact-label">Realized P&amp;L</div>\${s.pnl?\`<div class="tc-fact-num \${winClass}">\${tcFmtMoneyDec(d.pnl)}</div>\`:""}</div>\${factSideParts.length?\`<div class="tc-fact-side">\${factSideParts.join("<br/>")}</div>\`:""}</div>\`:""}\${tableRows.length?\`<div class="tc-col-right"><table class="tc-data-table" style="margin-top:0"><tbody>\${tableRows.join("")}</tbody></table></div>\`:""}</div></div><footer class="tc-colophon"><div class="tc-colophon-left"><span>\${TC_BRAND}</span></div><div class="tc-colophon-right">— Discipline is the only edge.</div><div class="tc-folio">\${s.tradenr?d.tradenr:"III"}</div></footer></article>\`;
}

// ── Render: Monogram ──
function tcRenderMonogram16x9(d){
  const s=d.show;const winClass=tcIsWin(d)?"win":"loss";
  const formatted=tcFmtMoneyDec(d.pnl);const parts=formatted.split(",");const mainPart=parts[0];const centsPart=parts[1]||"00";
  const subParts=[];
  if(s.setup)subParts.push(d.setup);
  if(s.hold)subParts.push(\`held \${d.hold}\`);
  const subText=subParts.length?subParts.join(" — ")+".":"";
  const facts=[];
  if(s.pct)facts.push(\`<div class="tc-fact-item"><div class="tc-k">Return</div><div class="tc-v \${tcIsWin(d)?"pos":"neg"}">\${tcFmtPct(d.pct)}</div></div>\`);
  if(s.rmult)facts.push(\`<div class="tc-fact-item"><div class="tc-k">R-Multiple</div><div class="tc-v accent">\${tcFmtR(d.rmult)}</div></div>\`);
  if(s.entryexit){facts.push(\`<div class="tc-fact-item"><div class="tc-k">Entry</div><div class="tc-v">\${d.entry}</div></div>\`);facts.push(\`<div class="tc-fact-item"><div class="tc-k">Exit</div><div class="tc-v \${tcIsWin(d)?"pos":"neg"}">\${d.exit}</div></div>\`);}
  if(s.hold)facts.push(\`<div class="tc-fact-item"><div class="tc-k">Hold</div><div class="tc-v">\${d.hold}</div></div>\`);
  return \`<article class="tc-card tc-mono-16x9"><div class="tc-watermark">M</div><header class="tc-hdr"><div><div class="tc-mark">Sync<em>Journal</em></div><div class="tc-mark-sub">By Morani · Vol. III\${s.tradenr?" · Nº "+d.tradenr:""}</div></div><div class="tc-hdr-meta">\${s.date?d.date+"<br/>":""}\${d.pair} · <b>\${tcSideLabel(d)}</b></div></header><div class="tc-center"><div class="tc-pretag">\${d.pair} <span>·</span> \${tcSideLabel(d)} <span>·</span> \${tcIsWin(d)?"Closed":"Stopped"}</div>\${s.pnl?\`<div class="tc-num \${winClass}">\${mainPart}<span class="tc-small">,\${centsPart}</span></div>\`:""}\${subText?\`<div class="tc-post">\${subText}</div>\`:""}\${facts.length?\`<div class="tc-facts">\${facts.join("")}</div>\`:""}</div><footer class="tc-ftr"><span>\${TC_BRAND}</span><span class="tc-ftr-mark">— \${tcIsWin(d)?"a cleared trade.":"a stopped trade."}</span><span>\${s.tradenr?"Nº "+d.tradenr:"Vol. III"}</span></footer></article>\`;
}

function tcRenderMonogram1x1(d){
  const s=d.show;const winClass=tcIsWin(d)?"win":"loss";
  const formatted=tcFmtMoneyDec(d.pnl);const parts=formatted.split(",");const mainPart=parts[0];const centsPart=parts[1]||"00";
  const subParts=[];
  if(s.setup)subParts.push(d.setup);
  if(s.hold)subParts.push(\`held \${d.hold}\`);
  const subText=subParts.length?subParts.join(" — ")+".":"";
  const headParts=[];
  if(s.tradenr)headParts.push(\`Nº \${d.tradenr}\`);
  if(s.date)headParts.push(d.date);
  const facts=[];
  if(s.pct)facts.push(\`<div class="tc-fact-item"><div class="tc-k">Return</div><div class="tc-v \${tcIsWin(d)?"pos":"neg"}">\${tcFmtPct(d.pct)}</div></div>\`);
  if(s.rmult)facts.push(\`<div class="tc-fact-item"><div class="tc-k">R</div><div class="tc-v accent">\${tcFmtR(d.rmult)}</div></div>\`);
  if(s.hold)facts.push(\`<div class="tc-fact-item"><div class="tc-k">Hold</div><div class="tc-v">\${d.hold}</div></div>\`);
  return \`<article class="tc-card tc-mono-1x1"><div class="tc-watermark">M</div><header class="tc-hdr"><div><div class="tc-mark" style="font-size:30px">Sync<em>Journal</em></div>\${headParts.length?\`<div class="tc-mark-sub">\${headParts.join(" · ")}</div>\`:""}</div><div class="tc-hdr-meta">\${tcSideLabel(d)} · \${d.pair}</div></header><div class="tc-center" style="padding:0"><div class="tc-pretag" style="margin-top:30px">Realized P&amp;L · net of fees</div>\${s.pnl?\`<div class="tc-num \${winClass}">\${mainPart}<span class="tc-small">,\${centsPart}</span></div>\`:""}\${subText?\`<div class="tc-post" style="font-size:17px">\${subText}</div>\`:""}\${facts.length?\`<div class="tc-facts">\${facts.join("")}</div>\`:""}</div><footer class="tc-ftr"><span>\${TC_BRAND}</span><span class="tc-ftr-mark" style="font-size:24px">— \${tcIsWin(d)?"cleared":"stopped"}.</span></footer></article>\`;
}

// ── Direction registry ──
const TC_DIRECTIONS={
  reactions:{label:"Reactions",desc:"5 moods · meme",hasMoods:true,size16:"1080×608",size1:"520×520",render16:(d,v)=>tcRenderReactions16x9(v,d),render1:(d,v)=>tcRenderReactions1x1(v,d)},
  cinema:{label:"Cinema",desc:"Filmposter · Bodoni",hasMoods:false,size16:"1200×675",size1:"760×760",render16:tcRenderCinema16x9,render1:tcRenderCinema1x1},
  dossier:{label:"Dossier",desc:"Editorial · GFS Didot",hasMoods:false,size16:"1200×675",size1:"760×760",render16:tcRenderDossier16x9,render1:tcRenderDossier1x1},
  monogram:{label:"Monogram",desc:"Catalogus · 1 number",hasMoods:false,size16:"1200×675",size1:"760×760",render16:tcRenderMonogram16x9,render1:tcRenderMonogram1x1},
};

// ── Trade-data → share-card data extraction ──
function tcDataFromTrade(trade,fields){
  const pnl=parseFloat(trade.pnl)||0;
  const entryP=parseFloat(trade.entry)||0;
  const exitP=parseFloat(trade.exit)||0;
  const sl=parseFloat(trade.stopLoss)||0;
  const direction=trade.direction||"long";
  const rmult=(()=>{if(!entryP||!sl||!exitP)return NaN;const r=Math.abs(entryP-sl);if(!r)return NaN;return Math.abs(exitP-entryP)/r*(pnl>=0?1:-1);})();
  const pct=(()=>{if(!entryP)return NaN;const qty=parseFloat(trade.positionSizeAsset||"")||0;const notionalUsdt=parseFloat(trade.positionSize||"")||0;const notional=qty>0?entryP*qty:notionalUsdt;if(!notional)return NaN;return pnl/notional*100;})();
  const holdMs=trade.openTime&&trade.closeTime?Math.abs(parseInt(trade.closeTime)-parseInt(trade.openTime)):0;
  const hold=holdMs?(holdMs>86400000?(holdMs/86400000).toFixed(1)+"d":holdMs>3600000?Math.floor(holdMs/3600000)+"h "+Math.floor((holdMs%3600000)/60000)+"m":Math.floor(holdMs/60000)+"m"):"";
  const setupTagJoin=(trade.setupTags||[]).slice(0,2).join(" · ");
  // Datum in IV style: 29 IV 2026
  const ROMAN=["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const dateRoman=(()=>{if(!trade.date)return"";const p=trade.date.split("-");if(p.length!==3)return trade.date;return parseInt(p[2])+" "+ROMAN[parseInt(p[1])]+" "+p[0];})();
  return{
    pair:trade.pair||"BTC/USDT",
    side:direction,
    tradenr:String((trade.id||"").toString().replace(/[^0-9]/g,"").slice(-3)||"—"),
    date:dateRoman,
    pnl,
    rmult:isNaN(rmult)?NaN:rmult,
    pct:isNaN(pct)?NaN:pct,
    hold,
    entry:entryP?entryP.toLocaleString("nl-NL"):"",
    exit:exitP?exitP.toLocaleString("nl-NL"):"",
    stop:sl?sl.toLocaleString("nl-NL"):"",
    setup:setupTagJoin,
    show:fields,
  };
}

// ============ TRADE CARD EXPORT (component) ============
function TradeCardExport({trade,onClose}){
  const [direction,setDirection]=useState(()=>{try{return localStorage.getItem("tj_card_direction_v2")||"reactions";}catch{return"reactions";}});
  const [variant,setVariant]=useState(()=>{try{return localStorage.getItem("tj_card_variant_v2")||"goodfellas";}catch{return"goodfellas";}});
  const [manualOverride,setManualOverride]=useState(false);
  const [fields,setFields]=useState(()=>{try{return JSON.parse(localStorage.getItem("tj_card_fields_v2")||"null")||{tradenr:true,date:true,pnl:true,pct:true,rmult:true,hold:true,entryexit:true,stop:false,setup:true};}catch{return{tradenr:true,date:true,pnl:true,pct:true,rmult:true,hold:true,entryexit:true,stop:false,setup:true};}});
  const [busy,setBusy]=useState(false);
  const [copyStatus,setCopyStatus]=useState("");
  const stage16Ref=useRef(null);
  const stage1Ref=useRef(null);

  useEffect(()=>{try{localStorage.setItem("tj_card_direction_v2",direction);localStorage.setItem("tj_card_variant_v2",variant);localStorage.setItem("tj_card_fields_v2",JSON.stringify(fields));}catch{}},[direction,variant,fields]);

  const data=tcDataFromTrade(trade,fields);
  // Auto-suggest variant op trade-data, tenzij user manueel een keuze maakte
  const suggestedVariant=tcAutoVariant(data);
  const activeVariant=manualOverride?variant:suggestedVariant;
  const dir=TC_DIRECTIONS[direction];

  // PNG download via html2canvas — render the card from the dataURI in dangerouslySetInnerHTML
  // We grab the rendered DOM element (first child of stage ref) and capture it.
  const downloadPNG=async(stageRef,suffix)=>{
    if(typeof html2canvas==="undefined"){alert("html2canvas niet geladen");return;}
    const card=stageRef.current?.querySelector(".tc-card");
    if(!card)return;
    setBusy(true);
    try{
      const canvas=await html2canvas(card,{scale:2,backgroundColor:null,logging:false,useCORS:true,imageTimeout:10000});
      const url=canvas.toDataURL("image/png");
      const a=document.createElement("a");
      a.href=url;
      a.download=\`syncjournal-\${data.tradenr}-\${direction}\${dir.hasMoods?"-"+activeVariant:""}-\${suffix}.png\`;
      a.click();
    }catch(e){alert("PNG export mislukt: "+e.message);}
    setBusy(false);
  };
  const copyImage=async(stageRef)=>{
    if(typeof html2canvas==="undefined"){setCopyStatus("html2canvas niet geladen");setTimeout(()=>setCopyStatus(""),3000);return;}
    if(!navigator.clipboard||!window.ClipboardItem){setCopyStatus("Browser ondersteunt geen clipboard-image");setTimeout(()=>setCopyStatus(""),3500);return;}
    const card=stageRef.current?.querySelector(".tc-card");
    if(!card)return;
    setBusy(true);setCopyStatus("");
    try{
      const canvas=await html2canvas(card,{scale:2,backgroundColor:null,logging:false,useCORS:true,imageTimeout:10000});
      const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
      if(!blob)throw new Error("Kon geen PNG blob maken");
      await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
      setCopyStatus("✓ Gekopieerd — plak in Discord met Ctrl+V");
      setTimeout(()=>setCopyStatus(""),3000);
    }catch(e){setCopyStatus("Kopiëren mislukt: "+(e.message||"onbekend"));setTimeout(()=>setCopyStatus(""),3500);}
    setBusy(false);
  };

  const Toggle=({k,label})=>(
    <label style={{display:"flex",alignItems:"center",gap:"7px",padding:"5px 9px",background:fields[k]?"rgba(46,170,111,.10)":"rgba(255,255,255,.02)",border:\`1px solid \${fields[k]?"rgba(46,170,111,.30)":"var(--border2)"}\`,borderRadius:"6px",cursor:"pointer",fontSize:"11px",color:"var(--text2)",userSelect:"none",fontFamily:"var(--mono)",letterSpacing:".02em"}}>
      <input type="checkbox" checked={!!fields[k]} onChange={()=>setFields(p=>({...p,[k]:!p[k]}))} style={{accentColor:"var(--gold)",width:"13px",height:"13px",cursor:"pointer",margin:0}}/>
      <span>{label}</span>
    </label>
  );

  return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px",overflow:"auto"}}>
    <div onClick={e=>e.stopPropagation()} style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:"16px",maxWidth:"1500px",width:"100%"}}>
      {/* Sidebar */}
      <aside style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"12px",padding:"16px",display:"flex",flexDirection:"column",gap:"12px",position:"sticky",top:0,maxHeight:"calc(100vh - 48px)",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"15px",letterSpacing:"-.01em"}}>Share Card <span style={{color:"var(--gold)"}}>v2</span></div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:"22px",lineHeight:1,padding:"0 4px"}}>×</button>
        </div>
        <div style={{fontSize:"11px",color:"var(--text3)",fontFamily:"var(--mono)",letterSpacing:".02em",lineHeight:1.5}}>4 designs. Auto-suggest variant. Brand: <b style={{color:"var(--text2)"}}>{TC_BRAND}</b>.</div>

        {/* Direction tiles */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
          {Object.entries(TC_DIRECTIONS).map(([k,v])=>(
            <button key={k} onClick={()=>{setDirection(k);setManualOverride(false);}} style={{padding:"10px 8px",border:\`2px solid \${direction===k?"var(--gold)":"var(--border3)"}\`,background:direction===k?"rgba(201,168,76,.10)":"transparent",borderRadius:"8px",cursor:"pointer",textAlign:"center",fontFamily:"var(--mono)"}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"12px",color:direction===k?"var(--gold)":"var(--text)",letterSpacing:"-.005em",textTransform:"uppercase"}}>{v.label}</div>
              <div style={{fontSize:"8px",color:"var(--text4)",letterSpacing:".12em",textTransform:"uppercase",marginTop:"3px"}}>{v.desc}</div>
            </button>
          ))}
        </div>

        {/* Mood-tiles (alleen voor reactions) */}
        {dir.hasMoods&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"4px"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:".18em",textTransform:"uppercase",color:"var(--text4)",fontWeight:600}}>Mood</div>
            <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:".10em",textTransform:"uppercase",color:"var(--gold)",fontWeight:700}}>auto: {suggestedVariant}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"5px"}}>
            {Object.keys(TC_REACT).map(k=>(
              <button key={k} onClick={()=>{setVariant(k);setManualOverride(true);}} title={k} style={{aspectRatio:"1/1",border:\`2px solid \${activeVariant===k?"var(--gold)":"transparent"}\`,borderRadius:"6px",overflow:"hidden",cursor:"pointer",padding:0,background:"#000",position:"relative"}}>
                <img src={TC_REACT[k].img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:k==="giggling"?"center 22%":k==="finalboss"?"center 25%":"center"}}/>
              </button>
            ))}
          </div>
        </>}

        {/* Field toggles */}
        <div style={{borderTop:"1px solid var(--border2)",paddingTop:"10px",marginTop:"4px"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:".18em",textTransform:"uppercase",color:"var(--text4)",fontWeight:600,marginBottom:"7px"}}>Toon op share-card</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
            <Toggle k="tradenr" label="Trade Nº"/>
            <Toggle k="date" label="Datum"/>
            <Toggle k="pnl" label="PnL ($)"/>
            <Toggle k="pct" label="Return %"/>
            <Toggle k="rmult" label="R-multiple"/>
            <Toggle k="hold" label="Hold time"/>
            <Toggle k="entryexit" label="Entry / Exit"/>
            <Toggle k="stop" label="Stop"/>
            <Toggle k="setup" label="Setup tag"/>
          </div>
        </div>

        {copyStatus&&<div style={{padding:"8px 10px",borderRadius:"6px",fontSize:"10px",fontFamily:"var(--mono)",letterSpacing:".04em",background:copyStatus.startsWith("✓")?"rgba(46,170,111,.10)":"rgba(224,85,85,.10)",color:copyStatus.startsWith("✓")?"var(--green)":"var(--red)",border:\`1px solid \${copyStatus.startsWith("✓")?"rgba(46,170,111,.30)":"rgba(224,85,85,.30)"}\`}}>{copyStatus}</div>}
      </aside>

      {/* Canvas */}
      <main style={{display:"flex",flexDirection:"column",gap:"16px",overflow:"hidden"}}>
        {/* 16:9 */}
        <section style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:".24em",color:"var(--text4)",textTransform:"uppercase",fontWeight:600}}>16:9 · {dir.size16} · X / Discord embed</div>
            <div style={{display:"flex",gap:"6px"}}>
              <button disabled={busy} onClick={()=>copyImage(stage16Ref)} style={{padding:"6px 10px",border:"1px solid var(--border3)",background:"transparent",color:"var(--text2)",borderRadius:"6px",cursor:busy?"wait":"pointer",fontFamily:"var(--mono)",fontSize:"10px",letterSpacing:".06em"}}>⧉ Kopieer</button>
              <button disabled={busy} onClick={()=>downloadPNG(stage16Ref,"16x9")} style={{padding:"6px 10px",border:"1px solid var(--gold)",background:"var(--gold)",color:"#000",borderRadius:"6px",cursor:busy?"wait":"pointer",fontFamily:"var(--mono)",fontSize:"10px",fontWeight:700,letterSpacing:".06em"}}>↓ Download PNG</button>
            </div>
          </div>
          <div ref={stage16Ref} style={{overflow:"auto",borderRadius:"12px"}}><div className={"tc-dir-"+direction} dangerouslySetInnerHTML={{__html:dir.render16(data,activeVariant)}}/></div>
        </section>

        {/* 1:1 */}
        <section style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:"9px",letterSpacing:".24em",color:"var(--text4)",textTransform:"uppercase",fontWeight:600}}>1:1 · {dir.size1} · X feed / Instagram</div>
            <div style={{display:"flex",gap:"6px"}}>
              <button disabled={busy} onClick={()=>copyImage(stage1Ref)} style={{padding:"6px 10px",border:"1px solid var(--border3)",background:"transparent",color:"var(--text2)",borderRadius:"6px",cursor:busy?"wait":"pointer",fontFamily:"var(--mono)",fontSize:"10px",letterSpacing:".06em"}}>⧉ Kopieer</button>
              <button disabled={busy} onClick={()=>downloadPNG(stage1Ref,"1x1")} style={{padding:"6px 10px",border:"1px solid var(--gold)",background:"var(--gold)",color:"#000",borderRadius:"6px",cursor:busy?"wait":"pointer",fontFamily:"var(--mono)",fontSize:"10px",fontWeight:700,letterSpacing:".06em"}}>↓ Download PNG</button>
            </div>
          </div>
          <div ref={stage1Ref} style={{overflow:"auto",borderRadius:"12px"}}><div className={"tc-dir-"+direction} dangerouslySetInnerHTML={{__html:dir.render1(data,activeVariant)}}/></div>
        </section>
      </main>
    </div>
  </div>);
}

`;

// Read tradejournal.html
let html = fs.readFileSync(HTML_PATH, 'utf8');

// Find markers
// File uses CRLF line endings on Windows
const NL = html.includes('\r\n') ? '\r\n' : '\n';
const startMarker = '// ============ TRADE FORM ============' + NL + '// ═══ Trade Card Export — 4 designs + veld-toggles + PNG download ═══' + NL + 'function TradeCardExport({trade,onClose}){';
const endMarker = NL + 'function Section({title,storeKey,defaultOpen=true,hint,children}){';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker, startIdx);

if (startIdx === -1) {
  console.error('ERROR: kon start-marker niet vinden');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('ERROR: kon end-marker niet vinden');
  process.exit(1);
}

console.log(`Start marker at byte ${startIdx}`);
console.log(`End marker at byte ${endIdx}`);
console.log(`Old block size: ${endIdx - startIdx} bytes (${((endIdx - startIdx) / 1024).toFixed(1)} KB)`);
console.log(`New block size: ${NEW_BLOCK.length} bytes (${(NEW_BLOCK.length / 1024).toFixed(1)} KB)`);

// Replace
const before = html.slice(0, startIdx);
const after = html.slice(endIdx); // start vanaf "\nfunction Section"
const newHtml = before + NEW_BLOCK + after;

fs.writeFileSync(HTML_PATH, newHtml);
console.log(`\nReplacement done. New file size: ${(newHtml.length / 1024).toFixed(1)} KB (${(newHtml.length / 1024 / 1024).toFixed(2)} MB)`);
