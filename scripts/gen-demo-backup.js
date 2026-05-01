#!/usr/bin/env node
// gen-demo-backup.js — genereert een complete TradeJournal backup-JSON met
// realistic mock-data voor demo-doeleinden. 250 trades op BTC/USDT primair,
// ETH/USDT secundair, met playbooks, tags, missed/backtest/paper trades.
// Output: morani-demo-backup.json in repo root.

const fs = require('fs');
const path = require('path');

// ─── DETERMINISTIC RNG (zodat re-runs identieke output geven) ────────────────
let _seed = 42;
function rand() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickN(arr, n) {
  const c = [...arr], out = [];
  for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(rand() * c.length), 1)[0]);
  return out;
}
function rng(min, max) { return rand() * (max - min) + min; }
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function rndId(prefix) { return prefix + '_' + Math.floor(rand() * 1e9).toString(36); }

// ─── DATE HELPERS ────────────────────────────────────────────────────────────
const TODAY = new Date('2026-04-28T12:00:00');
function daysAgo(d, h = null, m = null) {
  const date = new Date(TODAY); date.setDate(date.getDate() - d);
  if (h !== null) date.setHours(h);
  if (m !== null) date.setMinutes(m);
  return date;
}
function fmtDate(d) { return d.toISOString().split('T')[0]; }
function fmtTime(d) { return d.toTimeString().slice(0, 5); }

// ─── BTC PRICE CURVE — realistic uptrend Sept 2025 → April 2026 ──────────────
function btcPrice(daysAgoVal) {
  // 90 days ago: ~$65k. Today: ~$98k. Sinusoidal noise op trendlijn.
  const trend = 98000 - (daysAgoVal / 90) * 33000;
  const noise = Math.sin(daysAgoVal * 0.7) * 2500 + (rand() - 0.5) * 1500;
  return Math.max(55000, trend + noise);
}
function ethPrice(daysAgoVal) {
  const trend = 3400 - (daysAgoVal / 90) * 900;
  const noise = Math.sin(daysAgoVal * 0.5) * 90 + (rand() - 0.5) * 60;
  return Math.max(2300, trend + noise);
}
function solPrice(daysAgoVal) {
  const trend = 220 - (daysAgoVal / 90) * 70;
  const noise = Math.sin(daysAgoVal * 0.9) * 12 + (rand() - 0.5) * 8;
  return Math.max(120, trend + noise);
}
function priceAt(pair, daysAgoVal) {
  if (pair === 'BTC/USDT') return btcPrice(daysAgoVal);
  if (pair === 'ETH/USDT') return ethPrice(daysAgoVal);
  if (pair === 'SOL/USDT') return solPrice(daysAgoVal);
  return btcPrice(daysAgoVal);
}

// ─── TAG POOLS ──────────────────────────────────────────────────────────────
const tagConfig = {
  setupTags: ['SFP', 'MSB', 'BOS', 'Liquidity Sweep', 'Reclaim', 'Range retest', 'FVG tap', 'OB tap', 'Asian Range Breakout', 'Funding-Flip Squeeze', 'Trend continuation', 'Failed breakdown'],
  confirmationTags: ['CVD divergentie', 'Volume spike', 'Funding flip', 'OI rising', 'Liquidaties zichtbaar', 'HTF trend aligned', 'EMA21 retest', 'OB level', 'FVG tap', 'Range respected', 'Open Interest expanding', 'Whale-bid'],
  timeframeTags: ['1D', '4H', '1H', '15M', '5M', '1M'],
  emotionTags: ['Geduldig', 'FOMO', 'Onzeker', 'Hebzuchtig', 'Gehaast', 'Kalm', 'Zelfverzekerd', 'Gefrustreerd', 'Twijfels', 'Gedisciplineerd', 'Tilt'],
  mistakeTags: ['Te vroeg in', 'SL te krap', 'SL te wijd', 'Geen plan', 'Overtrading', 'TP te vroeg', 'Positie te groot', 'Revenge trade', 'Tegen de trend', 'Lage volume genegeerd', 'Tegen funding ingegaan'],
  missedReasonTags: ['🧠 Durf', '📏 Buiten regels', '⏰ Te laat gespot', '💰 Kapitaal vol', '👀 Onduidelijk', '⏸ Bewuste skip', '🚪 Offline'],
};

// ─── SESSION HELPER (Amsterdam-tijd, 8 buckets v12.37+) ──────────────────────
function getSessionAt(date) {
  // Note: deze gen-script draait in Node, geen tz-conversion. We gebruiken hours direct.
  const d = date.getDay(); const h = date.getHours(); const m = date.getMinutes();
  const hm = h * 60 + m;
  if (d === 0 || d === 6) return 'Weekend';
  if (hm >= 60 && hm < 300) return 'Asia AM';
  if (hm >= 300 && hm < 540) return 'Asia PM';
  if (hm >= 540 && hm < 690) return 'London AM';
  if (hm >= 690 && hm < 930) return 'London PM';
  if (hm >= 930 && hm < 1140) return 'US AM';
  if (hm >= 1140 && hm < 1320) return 'US PM';
  return 'US Late';
}

// ─── TRADE GENERATOR ─────────────────────────────────────────────────────────
function pickHourBySession(sess) {
  const map = {
    'Asia AM': [1, 2, 3, 4],
    'Asia PM': [5, 6, 7, 8],
    'London AM': [9, 10, 11],
    'London PM': [12, 13, 14, 15],
    'US AM': [16, 17, 18],
    'US PM': [19, 20, 21],
    'US Late': [22, 23, 0],
    'Weekend': [10, 14, 18],
  };
  return pick(map[sess] || [10]);
}

const TRADE_TEMPLATES = [
  {
    setups: ['SFP', 'Liquidity Sweep', 'Reclaim'],
    sessions: ['London AM'],
    tfs: ['4H', '1H', '15M'],
    confs: ['CVD divergentie', 'Volume spike', 'HTF trend aligned'],
    pair: 'BTC/USDT',
    wr: 0.66, avgRWin: 1.7, avgRLoss: -0.95,
    notes: ['Asian-low sweep + reclaim, volume confirm. London-open setup.', 'Sweep onder daily-low, snel reclaim met HTF trend.', 'Clean SFP execution, exited at TP1 + runner naar TP2.'],
  },
  {
    setups: ['BOS', 'Trend continuation'],
    sessions: ['US AM'],
    tfs: ['1D', '4H', '1H'],
    confs: ['HTF trend aligned', 'Volume spike', 'EMA21 retest'],
    pair: 'BTC/USDT',
    wr: 0.62, avgRWin: 1.9, avgRLoss: -0.9,
    notes: ['NY-open vol-spike, pullback naar 1H VWAP, continuation long.', 'BOS op 4H trend, retest gehouden, full target.', '15m pullback retest na NY-open, momentum sterk.'],
  },
  {
    setups: ['Liquidity Sweep', 'MSB'],
    sessions: ['London AM', 'US AM'],
    tfs: ['4H', '1H'],
    confs: ['Liquidaties zichtbaar', 'CVD divergentie', 'Funding flip'],
    pair: 'BTC/USDT',
    wr: 0.60, avgRWin: 1.8, avgRLoss: -1.0,
    notes: ['HTF liq-pool sweep, reclaim met volume confirm.', 'Equal-lows swept, daily MSB, scaled in op retest.', 'Coinglass liq-cluster zichtbaar, perfect reclaim setup.'],
  },
  {
    setups: ['Asian Range Breakout', 'Reclaim'],
    sessions: ['London AM'],
    tfs: ['1H', '15M'],
    confs: ['Volume spike', 'Range respected'],
    pair: 'BTC/USDT',
    wr: 0.55, avgRWin: 1.4, avgRLoss: -0.95,
    notes: ['Asia ranged 6u, London-open break + retest.', 'Range high broken op vol, retest hield.', '15m breakout, 5m retest confirmation.'],
  },
  {
    setups: ['Funding-Flip Squeeze'],
    sessions: ['US PM', 'US Late'],
    tfs: ['1H', '15M'],
    confs: ['Funding flip', 'OI rising', 'CVD divergentie'],
    pair: 'BTC/USDT',
    wr: 0.52, avgRWin: 1.3, avgRLoss: -1.0,
    notes: ['Funding extreem, OI rising, lower-highs op prijs, short squeeze setup.', 'Funding flip + OI expansion, classic squeeze.'],
  },
  {
    setups: ['MSB', 'BOS'],
    sessions: ['US AM', 'US PM'],
    tfs: ['1D', '4H'],
    confs: ['HTF trend aligned', 'EMA21 retest', 'Volume spike'],
    pair: 'ETH/USDT',
    wr: 0.64, avgRWin: 1.7, avgRLoss: -0.95,
    notes: ['ETH 4H BOS, NY pullback hit EMA21, continuation.', 'Daily MSB on ETH, full follow-through.'],
  },
  {
    setups: ['Failed breakdown', 'Reclaim'],
    sessions: ['London PM', 'US AM'],
    tfs: ['15M', '5M'],
    confs: ['CVD divergentie', 'Volume spike'],
    pair: 'BTC/USDT',
    wr: 0.45, avgRWin: 1.5, avgRLoss: -1.0,
    notes: ['Failed breakdown, fast reclaim above key.', 'Reclaim setup but volume dunner dan ideaal.'],
  },
  {
    setups: ['SFP'],
    sessions: ['London PM'],
    tfs: ['15M', '5M'],
    confs: [],
    pair: 'BTC/USDT',
    wr: 0.32, avgRWin: 1.2, avgRLoss: -1.05,
    notes: ['Late London SFP poging, dunner volume.', 'SFP zonder volume confirm — zwak signaal.', 'Twijfels op de entry, ging tegen mij in.'],
  },
];

function makeTrade(daysAgoVal, template, opts = {}) {
  const sess = pick(template.sessions);
  const hour = pickHourBySession(sess);
  const min = Math.floor(rand() * 60);
  const date = daysAgo(daysAgoVal, hour, min);
  const direction = rand() < 0.55 ? 'long' : 'short';
  const sign = direction === 'long' ? 1 : -1;
  const isWin = rand() < template.wr;
  const r = isWin ? rng(template.avgRWin * 0.6, template.avgRWin * 1.4) : rng(template.avgRLoss * 0.5, template.avgRLoss * 1.1);

  const entry = priceAt(template.pair, daysAgoVal);
  // Stop: ~0.6-1.2% afstand voor BTC, beetje meer voor ETH
  const stopPct = template.pair === 'BTC/USDT' ? rng(0.006, 0.012) : rng(0.008, 0.016);
  const stopLoss = entry - sign * entry * stopPct;
  const riskPerUnit = Math.abs(entry - stopLoss);
  const exitDist = riskPerUnit * Math.abs(r);
  const exit = entry + sign * (r >= 0 ? exitDist : -exitDist);
  const takeProfit = entry + sign * riskPerUnit * (1.5 + rand() * 1.5); // 1.5R-3R target
  const positionUsd = template.pair === 'BTC/USDT' ? rng(800, 3000) : rng(500, 2000);
  const positionAsset = positionUsd / entry;
  const pnl = (exit - entry) * sign * positionAsset;
  const fees = positionUsd * 0.0008; // 8 bps round-trip
  const netPnl = pnl - fees;
  const leverage = pick(['10', '10', '10', '20', '5']);
  const riskUsd = riskPerUnit * positionAsset;
  // accountSize voor riskPct: gebruik $5000 default
  const riskPct = (riskUsd / 5000) * 100;

  // Tags
  const setupTags = pickN(template.setups, 1 + (rand() < 0.3 ? 1 : 0));
  const confirmationTags = template.confs.length ? pickN(template.confs, Math.min(template.confs.length, 1 + Math.floor(rand() * 2))) : [];
  const timeframeTags = pickN(template.tfs, 1 + (rand() < 0.5 ? 1 : 0));
  let emotionTags = [];
  if (isWin) emotionTags = pickN(['Geduldig', 'Kalm', 'Zelfverzekerd', 'Gedisciplineerd'], 1 + (rand() < 0.4 ? 1 : 0));
  else if (rand() < 0.7) emotionTags = pickN(['FOMO', 'Onzeker', 'Hebzuchtig', 'Gehaast', 'Twijfels', 'Gefrustreerd'], 1 + (rand() < 0.3 ? 1 : 0));
  let mistakeTags = [];
  if (!isWin && rand() < 0.55) mistakeTags = pickN(['Te vroeg in', 'SL te krap', 'Geen plan', 'TP te vroeg', 'Tegen de trend', 'Lage volume genegeerd', 'Revenge trade'], 1 + (rand() < 0.25 ? 1 : 0));

  const noteIdx = Math.floor(rand() * template.notes.length);
  const entryNote = rand() < 0.65 ? template.notes[noteIdx] : '';
  const notes = (!isWin && rand() < 0.5) ? `Loss. ${mistakeTags[0] ? `Mistake: ${mistakeTags[0]}.` : 'Plan klopte, markt deed iets anders.'} Volgende keer letten op confluence.` : (isWin && rand() < 0.4 ? 'Plan correct uitgevoerd. Discipline op orde.' : '');

  return {
    id: rndId('t'),
    date: fmtDate(date),
    time: fmtTime(date),
    pair: template.pair,
    direction,
    entry: entry.toFixed(template.pair === 'BTC/USDT' ? 1 : template.pair === 'ETH/USDT' ? 2 : 3),
    stopLoss: stopLoss.toFixed(template.pair === 'BTC/USDT' ? 1 : template.pair === 'ETH/USDT' ? 2 : 3),
    takeProfit: takeProfit.toFixed(template.pair === 'BTC/USDT' ? 1 : template.pair === 'ETH/USDT' ? 2 : 3),
    exit: exit.toFixed(template.pair === 'BTC/USDT' ? 1 : template.pair === 'ETH/USDT' ? 2 : 3),
    leverage,
    positionSize: positionUsd.toFixed(2),
    positionSizeAsset: positionAsset.toFixed(template.pair === 'BTC/USDT' ? 5 : template.pair === 'ETH/USDT' ? 4 : 3),
    pnl: netPnl.toFixed(2),
    fees: fees.toFixed(2),
    setupTags, confirmationTags, timeframeTags, emotionTags, mistakeTags, customTags: [],
    missedReasonTags: [],
    rating: isWin ? (rand() < 0.5 ? 4 : 5) : (rand() < 0.5 ? 2 : 3),
    screenshot: null, screenshots: [],
    notes,
    links: [], layers: [],
    source: 'manual', positionId: '', openTime: '', closeTime: '',
    status: 'closed',
    manualOverrides: [], tpLevels: [],
    entryNote,
    riskUsd: riskUsd.toFixed(2),
    riskPct: riskPct.toFixed(2),
    hindsightExit: '',
    simType: '',
    ...opts,
  };
}

function makeMissedTrade(daysAgoVal, template, simType = 'missed') {
  const t = makeTrade(daysAgoVal, template);
  // Simulated trade: status missed, simType set, hindsightExit gevuld, geen real pnl
  const isWin = rand() < template.wr;
  const r = isWin ? rng(template.avgRWin * 0.6, template.avgRWin * 1.4) : rng(template.avgRLoss * 0.5, template.avgRLoss * 1.1);
  const entry = parseFloat(t.entry);
  const sl = parseFloat(t.stopLoss);
  const sign = t.direction === 'long' ? 1 : -1;
  const riskPerUnit = Math.abs(entry - sl);
  const hindsightExit = entry + sign * riskPerUnit * Math.abs(r) * (r >= 0 ? 1 : -1);
  return {
    ...t,
    status: 'missed',
    simType,
    pnl: '',
    fees: '',
    exit: '',
    hindsightExit: hindsightExit.toFixed(t.pair === 'BTC/USDT' ? 1 : 2),
    missedReasonTags: simType === 'missed' ? pickN(['🧠 Durf', '📏 Buiten regels', '⏰ Te laat gespot', '👀 Onduidelijk', '⏸ Bewuste skip'], 1) : [],
    notes: simType === 'backtest' ? 'Chart-replay analyse. Hindsight-bias potentieel hoog.' : simType === 'paper' ? 'Live paper-trade op demo-account. Geen geld op het spel.' : (rand() < 0.4 ? 'Spotte de setup, durfde niet. Volgende keer.' : ''),
    rating: 0,
  };
}

// ─── PLAYBOOKS ──────────────────────────────────────────────────────────────
const playbooks = [
  {
    id: 'pb_sfp_london',
    name: 'London-Open SFP Reclaim',
    oneLiner: 'Sweep Asian-low/high + reclaim met volume tijdens London-Open. CVD-divergentie verplicht.',
    setupTags: ['SFP', 'Liquidity Sweep'],
    timeframes: ['4H', '1H', '15M'],
    confirmations: ['CVD divergentie', 'Volume spike', 'HTF trend aligned'],
    pairs: ['BTC/USDT'],
    sessions: ['London AM'],
    status: 'active',
    context: 'Top-down: 4H bias bull · 1H Asian range duidelijk gedefinieerd (≥ 4u) · 15M entry-trigger SFP+reclaim. NY-close zonder grote afwijking. Geen major news in komende 30 min. Funding rate neutraal (±0.01%).',
    criteria: [
      { text: 'Asian range ≥ 4u en duidelijk afgebakend', mandatory: true },
      { text: 'London-open vóór 11:30 NL-tijd', mandatory: true },
      { text: 'Sweep candle dipt onder/boven Asian extreme', mandatory: true },
      { text: 'Reclaim candle sluit terug binnen range', mandatory: true },
      { text: 'Volume sweep ≥ 1.5× average', mandatory: false },
      { text: 'CVD bearish/bullish divergence aanwezig', mandatory: false },
      { text: 'Geen FOMC / CPI / ETF-news komende 30 min', mandatory: true },
    ],
    stop: '2 ticks onder sweep-low (long) / boven sweep-high (short). Hard stop, geen mental.',
    target: 'Partial 50% bij 1R · runner naar nearest HTF liquidity pool of prior NY-high/low.',
    minRR: '1.5',
    mistake: '',
    mistakePatterns: ['Te vroeg in', 'SL te krap'],
    importedFrom: '',
    importedAt: '',
    createdAt: new Date('2026-02-01').toISOString(),
    updatedAt: new Date('2026-04-15').toISOString(),
  },
  {
    id: 'pb_msb_ny',
    name: 'NY-AM Trend-Day Pullback',
    oneLiner: 'London zet trend → NY-open vol-spike → pullback naar 1H VWAP/EMA21 op continuation.',
    setupTags: ['BOS', 'Trend continuation'],
    timeframes: ['1D', '4H', '1H', '15M'],
    confirmations: ['HTF trend aligned', 'Volume spike', 'EMA21 retest'],
    pairs: ['BTC/USDT', 'ETH/USDT'],
    sessions: ['US AM'],
    status: 'active',
    context: 'Top-down: 1D + 4H trend gelijk gericht · 1H BOS aanwezig · 15M pullback-trigger naar VWAP/EMA21. London produceerde duidelijke directional move (≥ 1.5× ATR). NY-cash open candle vol-spike bevestigt.',
    criteria: [
      { text: 'London ATR-move ≥ 1.5× 30-day avg', mandatory: true },
      { text: '1H + 4H trend gelijk gericht (BOS aanwezig)', mandatory: true },
      { text: 'Pullback raakt 1H VWAP of EMA21', mandatory: true },
      { text: 'Rejection candle (pin/engulf) op pullback-level', mandatory: true },
      { text: 'Funding rate niet extreem (binnen ±0.05%)', mandatory: false },
    ],
    stop: 'Onder/boven structure-low (15m) na rejection. Niet onder VWAP zelf.',
    target: 'Prior swing high/low · 2-3R typisch · trail op 15m HL/LH.',
    minRR: '2.0',
    mistake: '',
    mistakePatterns: ['SL te krap'],
    importedFrom: '', importedAt: '',
    createdAt: new Date('2026-02-10').toISOString(),
    updatedAt: new Date('2026-04-20').toISOString(),
  },
  {
    id: 'pb_liq_sweep',
    name: 'Liquidity Sweep + Reclaim (HTF)',
    oneLiner: 'Daily/4H liq-pool sweep → reclaim met volume + CVD. Mean-reversion van extreme.',
    setupTags: ['Liquidity Sweep', 'MSB', 'Reclaim'],
    timeframes: ['1D', '4H', '15M'],
    confirmations: ['Liquidaties zichtbaar', 'CVD divergentie', 'Funding flip'],
    pairs: ['BTC/USDT', 'ETH/USDT'],
    sessions: ['London AM', 'US AM'],
    status: 'active',
    context: 'Top-down: 1D bekende liquidity-cluster (equal highs/lows) · 4H confirmatie sweep+reclaim · 15M entry-trigger met volume. Liquidaties spike-zichtbaar via Coinglass.',
    criteria: [
      { text: 'HTF (4H+) liq-pool zichtbaar op chart', mandatory: true },
      { text: 'Sweep gaat door liq-niveau heen', mandatory: true },
      { text: 'Reclaim binnen 1-3 candles van sweep', mandatory: true },
      { text: 'Volume reclaim > volume sweep', mandatory: true },
      { text: 'CVD divergence (price LL, CVD HL of vice versa)', mandatory: false },
      { text: 'Funding flip naar tegengestelde kant zichtbaar', mandatory: false },
    ],
    stop: 'Onder sweep-low (long) — geen room voor 2e sweep, hard stop.',
    target: 'Mean-reversion naar volgend HTF level · 2R conservatief · 3-4R runner.',
    minRR: '2.0',
    mistake: '',
    mistakePatterns: ['Te vroeg in', 'SL te wijd'],
    importedFrom: '', importedAt: '',
    createdAt: new Date('2026-02-15').toISOString(),
    updatedAt: new Date('2026-04-25').toISOString(),
  },
  {
    id: 'pb_funding_flip',
    name: 'Funding-Flip Squeeze',
    oneLiner: 'Extreme funding (>+0.05%) + bearish CVD divergence → short squeeze setup richting mean.',
    setupTags: ['Funding-Flip Squeeze'],
    timeframes: ['4H', '1H', '15M'],
    confirmations: ['Funding flip', 'OI rising', 'CVD divergentie'],
    pairs: ['BTC/USDT', 'ETH/USDT'],
    sessions: ['US PM', 'US Late'],
    status: 'testing',
    context: 'Funding rate ≥ +0.05% (longs paying) of ≤ -0.05% (shorts paying). OI rising terwijl prijs stagneert = squeeze setup.',
    criteria: [
      { text: 'Funding rate ≥ +0.05% / ≤ -0.05%', mandatory: true },
      { text: 'OI rising > 5% in laatste 4u', mandatory: true },
      { text: 'Prijs stagneert / lower highs (longs trapped)', mandatory: true },
      { text: 'CVD divergence met prijs', mandatory: false },
      { text: 'Geen tegengestelde news catalyst', mandatory: true },
    ],
    stop: 'Boven recent high — vrij wijd, dus halve standaard size.',
    target: 'Mean-reversion naar 4H equilibrium · 1.5-3R range.',
    minRR: '1.5',
    mistake: '',
    mistakePatterns: ['Te vroeg in', 'Tegen funding ingegaan'],
    importedFrom: '', importedAt: '',
    createdAt: new Date('2026-03-12').toISOString(),
    updatedAt: new Date('2026-04-22').toISOString(),
  },
  {
    id: 'pb_asian_break',
    name: 'Asian Range Breakout (with retest filter)',
    oneLiner: 'Asia ranged → London-open break + retest. False-break filter via volume + retest-confirm.',
    setupTags: ['Asian Range Breakout', 'Reclaim'],
    timeframes: ['1H', '15M', '5M'],
    confirmations: ['Volume spike', 'Range respected'],
    pairs: ['BTC/USDT'],
    sessions: ['London AM'],
    status: 'active',
    context: 'Asia range ≤ 1.2× ATR (echt rangebound, geen trend). Range high/low duidelijk gerespecteerd ≥ 3 keer.',
    criteria: [
      { text: 'Asia range ≤ 1.2× 30-day ATR', mandatory: true },
      { text: 'Range high/low ≥ 3 touches', mandatory: true },
      { text: 'Breakout candle volume ≥ 1.5× avg', mandatory: true },
      { text: 'Retest van break-level binnen 30 min', mandatory: true },
      { text: 'Retest sluit boven (long) / onder (short) break-level', mandatory: true },
    ],
    stop: 'Terug onder/boven break-level (mid-range).',
    target: 'Range-height projected vanaf break · typisch 1.5-2R.',
    minRR: '1.5',
    mistake: '',
    mistakePatterns: ['Te vroeg in'],
    importedFrom: '', importedAt: '',
    createdAt: new Date('2026-02-20').toISOString(),
    updatedAt: new Date('2026-04-18').toISOString(),
  },
  {
    id: 'pb_us_late_fade',
    name: 'US Late Range Fade',
    oneLiner: 'Range-fade tijdens US-late session (22-01 NL). Retired — negatief expectancy.',
    setupTags: ['Range retest'],
    timeframes: ['15M', '5M'],
    confirmations: [],
    pairs: ['BTC/USDT', 'ETH/USDT'],
    sessions: ['US Late'],
    status: 'retired',
    context: 'Lage volume periode na NY close. Range-fade van extreme. Theoretisch zou mean-reversion werken — in praktijk niet.',
    criteria: [
      { text: 'NY-close zonder strong directional follow-through', mandatory: true },
      { text: 'Range gevormd in NY-PM', mandatory: true },
      { text: 'Test van range-extreme met rejection', mandatory: true },
    ],
    stop: 'Buiten range-extreme — vaak gestopt door 1 grote async-volume candle.',
    target: 'Mid-range of opposite-extreme. Onbetrouwbaar in lage liquidity.',
    minRR: '1.0',
    mistake: '',
    mistakePatterns: ['Lage volume genegeerd', 'Tegen de trend'],
    importedFrom: '', importedAt: '',
    createdAt: new Date('2026-01-15').toISOString(),
    updatedAt: new Date('2026-04-01').toISOString(),
  },
];

// ─── GENERATE TRADES ─────────────────────────────────────────────────────────
const trades = [];
const TOTAL_REAL = 200;
const TOTAL_MISSED = 25;
const TOTAL_BACKTEST = 18;
const TOTAL_PAPER = 14;

// Real trades — verspreid over 90 dagen, biased richting actieve playbooks
for (let i = 0; i < TOTAL_REAL; i++) {
  // Spread evenly maar laatste 30 dagen iets dichter
  const daysAgoVal = i < TOTAL_REAL * 0.5 ? Math.floor(rand() * 90) : Math.floor(rand() * 30);
  const tpl = pick(TRADE_TEMPLATES);
  trades.push(makeTrade(daysAgoVal, tpl));
}
// Missed trades — last 60 days
for (let i = 0; i < TOTAL_MISSED; i++) {
  const daysAgoVal = Math.floor(rand() * 60);
  const tpl = pick(TRADE_TEMPLATES.slice(0, 5));// alleen de eerste 5 templates (geen failed-breakdown / weak SFP missed)
  trades.push(makeMissedTrade(daysAgoVal, tpl, 'missed'));
}
// Backtest trades — last 30 days (veel chart-replay van active playbooks)
for (let i = 0; i < TOTAL_BACKTEST; i++) {
  const daysAgoVal = Math.floor(rand() * 30);
  const tpl = pick(TRADE_TEMPLATES.slice(0, 3));
  trades.push(makeMissedTrade(daysAgoVal, tpl, 'backtest'));
}
// Paper trades — last 14 days
for (let i = 0; i < TOTAL_PAPER; i++) {
  const daysAgoVal = Math.floor(rand() * 14);
  const tpl = pick(TRADE_TEMPLATES.slice(0, 4));
  trades.push(makeMissedTrade(daysAgoVal, tpl, 'paper'));
}
// Sort by date asc
trades.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
console.log(`Generated ${trades.length} trades:`);
console.log(`  ${trades.filter(t => t.status !== 'missed').length} real (closed)`);
console.log(`  ${trades.filter(t => t.simType === 'missed').length} missed`);
console.log(`  ${trades.filter(t => t.simType === 'backtest').length} backtest`);
console.log(`  ${trades.filter(t => t.simType === 'paper').length} paper`);

// ─── ACCOUNTS — manual met capital tracking ─────────────────────────────────
const accounts = [
  {
    id: 'acc_demo',
    name: 'Demo Capital',
    type: 'manual',
    label: 'Daytrade',
    transactions: [
      { id: 'tx1', type: 'deposit', amount: 5000, date: '2026-01-15', note: 'Initiële inleg' },
      { id: 'tx2', type: 'deposit', amount: 1000, date: '2026-02-20', note: 'Top-up na goeie maand' },
      { id: 'tx3', type: 'withdraw', amount: 500, date: '2026-03-10', note: 'Profit-taking' },
    ],
  },
];

// ─── TRADING RULES ──────────────────────────────────────────────────────────
const tradingRules = [
  { id: 'r1', name: 'Max 2% risk per trade', type: 'max_risk_pct', value: 2, enabled: true },
  { id: 'r2', name: 'Altijd stop-loss bij entry', type: 'require_sl', value: null, enabled: true },
  { id: 'r3', name: 'Max 5 trades per dag', type: 'max_trades_per_day', value: 5, enabled: true },
  { id: 'r4', name: 'Pauze na 2 losses op dag', type: 'max_losses_per_day', value: 2, enabled: true },
  { id: 'r5', name: 'Pre-trade notitie ingevuld', type: 'require_entry_note', value: null, enabled: true },
];

// ─── GOALS ──────────────────────────────────────────────────────────────────
const goals = {
  items: [
    { id: 'g1', name: '4 winning days per week', metric: 'winningDays', period: 'week', target: 4, enabled: true },
    { id: 'g2', name: 'Expectancy ≥ +0.4R per maand', metric: 'expectancy', period: 'month', target: 0.4, enabled: true },
    { id: 'g3', name: 'Net +20R dit kwartaal', metric: 'avgR', period: 'quarter', target: 20, enabled: true },
  ],
};

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const config = {
  theme: 'sync',
  layout: 'standard',
  quoteAsset: 'USDT',
  syncInterval: 'off',
  trackMissedTrades: true,
  displayName: 'Demo Trader',
  showCoachNote: true,
  exchanges: {},
};

// ─── BUILD PAYLOAD ──────────────────────────────────────────────────────────
const payload = {
  version: 12,
  schemaVersion: 1,
  exportDate: new Date().toISOString(),
  trades,
  tagConfig,
  accounts,
  config,
  playbooks,
  tradingRules,
  goals,
};

const outPath = path.join(__dirname, '..', 'morani-demo-backup.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`\n✅ Backup written to: ${outPath}`);
console.log(`   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
console.log(`   ${playbooks.length} playbooks, ${tradingRules.length} rules, ${goals.items.length} goals\n`);
