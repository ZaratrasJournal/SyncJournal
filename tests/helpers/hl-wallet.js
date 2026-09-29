// Een echt Hyperliquid-account voor de tests: ophalen, opnemen en aan de app terugspelen.
//
// Wallet-data van Hyperliquid is openbaar, dus een test kan een echt account gebruiken zonder
// sleutels. De opname staat in tests/_fixtures/ (gitignored): deze repo is openbaar, en het
// walletadres zou het project koppelen aan een complete tradehistorie en een saldo.
const fs = require('fs');
const path = require('path');

const API = 'https://api.hyperliquid.xyz/info';
const OPNAME = path.resolve(__dirname, '../_fixtures/hyperliquid-wallet.json');
const MAX_BATCH = 2000;   // Hyperliquid geeft maximaal 2000 fills per userFillsByTime-aanroep
const isWallet = w => /^0x[0-9a-fA-F]{40}$/.test(String(w || '').trim());

async function post(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Hyperliquid HTTP ' + r.status + ' op ' + body.type);
  return r.json();
}

// Het hele account zoals de API het geeft: elke fill die er nog is (Hyperliquid bewaart de
// laatste 10k), plus de stand van dit moment.
async function haalAccount(wallet) {
  const fills = []; const gezien = new Set(); let cursor = 0;
  for (let i = 0; i < 20; i++) {
    const batch = await post({ type: 'userFillsByTime', user: wallet, startTime: cursor });
    if (!Array.isArray(batch) || !batch.length) break;
    batch.forEach(f => { const id = String(f.tid); if (!gezien.has(id)) { gezien.add(id); fills.push(f); } });
    if (batch.length < MAX_BATCH) break;
    cursor = batch[batch.length - 1].time + 1;
  }
  fills.sort((a, b) => a.time - b.time);
  return {
    wallet, opgenomen: new Date().toISOString(), fills,
    clearinghouseState: await post({ type: 'clearinghouseState', user: wallet }),
    spotClearinghouseState: await post({ type: 'spotClearinghouseState', user: wallet }),
  };
}

const leesOpname = () => fs.existsSync(OPNAME) ? JSON.parse(fs.readFileSync(OPNAME, 'utf8')) : null;
const bewaarOpname = acc => { fs.mkdirSync(path.dirname(OPNAME), { recursive: true }); fs.writeFileSync(OPNAME, JSON.stringify(acc, null, 1)); };

const EPS = 1e-9;
const voorVan = f => parseFloat(f.startPosition) || 0;
const naVan = f => voorVan(f) + (f.side === 'B' ? 1 : -1) * (parseFloat(f.sz) || 0);
const gewogen = fs => { const sz = fs.reduce((s, f) => s + (+f.sz), 0); return sz ? fs.reduce((s, f) => s + (+f.px) * (+f.sz), 0) / sz : 0; };

/* De levenslopen volgens de ruwe fills, los van de app: van vlak naar vlak per coin. Zo toetst
   een test de app tegen wat Hyperliquid zelf zegt, niet tegen zijn eigen rekenwerk. */
function levenslopen(fills) {
  const dicht = [], lopend = {};
  for (const f of [...fills].sort((a, b) => a.time - b.time)) {
    const voor = voorVan(f), na = naVan(f);
    if (Math.abs(voor) > EPS && Math.abs(na) > EPS && Math.sign(voor) !== Math.sign(na))
      throw new Error('omslag long/short in de opname (' + f.coin + ', ' + new Date(f.time).toISOString() + '): die kent deze helper nog niet');
    if (!lopend[f.coin]) {
      if (Math.abs(voor) > EPS) throw new Error('levensloop van ' + f.coin + ' begon vóór de opname');
      lopend[f.coin] = { coin: f.coin, dir: f.side === 'B' ? 'long' : 'short', open: f.time, opens: [], closes: [], fills: [] };
    }
    const L = lopend[f.coin];
    L.fills.push(f); (Math.abs(na) > Math.abs(voor) ? L.opens : L.closes).push(f);
    if (Math.abs(na) < EPS) { L.dicht = f.time; dicht.push(L); delete lopend[f.coin]; }
  }
  const maak = L => ({ ...L, entry: gewogen(L.opens), exit: gewogen(L.closes), qty: L.opens.reduce((s, f) => s + (+f.sz), 0),
    fees: L.fills.reduce((s, f) => s + (+f.fee), 0), netto: L.fills.reduce((s, f) => s + (+f.closedPnl) - (+f.fee), 0) });
  return { dicht: dicht.map(maak), open: Object.values(lopend).map(maak) };
}

/* Het account zoals het er op moment `nu` voor stond: alleen de fills tot dan, en de open
   posities herbouwd uit die fills. Zo ziet een test een positie opengaan en later sluiten, met
   de echte prijzen, zonder op de markt te wachten. Alleen de velden die de app leest. */
function staatOp(acc, nu) {
  if (nu == null) return acc.clearinghouseState;
  const { open } = levenslopen(acc.fills.filter(f => f.time <= nu));
  const assetPositions = open.map(L => {
    const szi = naVan(L.fills[L.fills.length - 1]);   // de stand na de laatste fill
    return { type: 'oneWay', position: { coin: L.coin, szi: String(szi), entryPx: String(L.entry), positionValue: String(Math.abs(szi) * L.entry),
      unrealizedPnl: '0', returnOnEquity: '0', liquidationPx: null, marginUsed: '0', leverage: { type: 'cross', value: 1 }, maxLeverage: 40 } };
  });
  return { ...acc.clearinghouseState, assetPositions };
}

/* Beantwoord de aanroepen van de app naar api.hyperliquid.xyz uit een opname, zoals de echte
   API dat doet: userFillsByTime geeft de fills in [startTime, endTime], oudste eerst, hooguit
   2000. `klok.nu` (optioneel) zet het account terug naar dat moment. Onbekende soorten
   aanroepen komen in `onbekend`: zo merkt een test het als de app iets gaat vragen wat niet in
   de opname zit. */
async function speelAf(page, acc, klok = {}) {
  const log = { calls: [], onbekend: [] };
  await page.route(API, async route => {
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    log.calls.push(body.type);
    const nu = klok.nu;
    let json;
    if (body.type === 'userFillsByTime') {
      const van = +body.startTime || 0, tot = body.endTime != null ? +body.endTime : Infinity;
      json = acc.fills.filter(f => f.time >= van && f.time <= tot && (nu == null || f.time <= nu)).slice(0, MAX_BATCH);
    } else if (body.type === 'clearinghouseState') json = staatOp(acc, nu);
    else if (body.type === 'spotClearinghouseState') json = acc.spotClearinghouseState;
    else { log.onbekend.push(body.type); return route.fulfill({ status: 400, body: 'niet opgenomen: ' + body.type }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  return log;
}

module.exports = { API, OPNAME, isWallet, haalAccount, leesOpname, bewaarOpname, levenslopen, staatOp, speelAf };
