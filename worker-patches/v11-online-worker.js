/**
 * Morani Trading Journal — Cloudflare Worker Proxy v11
 *
 * Changes vs v10 (alleen Kraken trades-action):
 *  - v10 leverde matchedCount=29 + correcte size, MAAR entry_price was
 *    fout (toonde 78307.29 ipv echte 79184). Vermoedelijk pakt mijn code
 *    `old_average_entry_price` uit de close-event maar dat veld bevat
 *    iets anders dan ik dacht.
 *
 *  - v11 wijzigingen:
 *    1. Diagnostic: `firstMatchedEvent` in _v11Debug toont ALLE keys +
 *       waarden van een matched event. Hiermee zien we welk veld de
 *       echte entry-prijs bevat.
 *    2. tpLevels per trade: voor élke trade-group bouwen we tpLevels
 *       array uit close-fills (1 TP per fill = correct voor partial-
 *       close trades). Lost de Kraken TP-coverage bug op zonder aparte
 *       fetchFills-call.
 *    3. originalSizeAsset toegevoegd zodat client correct partial-
 *       close pct kan berekenen.
 *
 * Veiligheids-net: bij 0 matches valt nog steeds terug op v6-pad.
 *
 * Actions per exchange: test, trades, open_positions, fills
 */

const ALLOWED_ORIGIN = '*';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return cors();
    if (request.method !== 'POST') return json({ error: 'Only POST allowed' }, 405);
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }
    const { exchange, action } = body;
    try {
      let result;
      if (exchange === 'mexc')        result = await handleMEXC(action, body);
      else if (exchange === 'blofin') result = await handleBlofin(action, body);
      else if (exchange === 'kraken') result = await handleKraken(action, body);
      else return json({ error: `Onbekende exchange: ${exchange}` }, 400);
      return json(result);
    } catch (e) {
      return json({ error: e.message || 'Onbekende fout' }, 500);
    }
  }
};

function cors() {
  return new Response(null, { headers: {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }});
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  }});
}

// ═══════════════════════════════════════════════════════════════
// MEXC Futures (Contract V1) — direct HTTP + HMAC-SHA256 signing
// ONGEWIJZIGD vs v6/v7
// ═══════════════════════════════════════════════════════════════
async function handleMEXC(action, { apiKey, apiSecret, startTime, symbol, positionId, endTime }) {
  const base = 'https://contract.mexc.com';
  const buildQs = (params) => Object.keys(params || {})
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const get = async (path, params = {}) => {
    const qs = buildQs(params);
    const ts = Date.now().toString();
    const signature = await hmacHex(apiSecret, apiKey + ts + qs);
    const res = await fetch(`${base}${path}${qs ? '?' + qs : ''}`, {
      headers: {
        'ApiKey': apiKey,
        'Request-Time': ts,
        'Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); }
    catch { throw new Error(`MEXC ${path}: geen JSON (HTTP ${res.status}): ${txt.slice(0, 200)}`); }
    if (!data.success) throw new Error(`MEXC ${path}: ${data.message || data.code || 'unknown'} (HTTP ${res.status})`);
    return data;
  };

  if (action === 'test') {
    const d = await get('/api/v1/private/account/assets');
    const usdt = (d.data || []).find(a => a.currency === 'USDT');
    return { success: true, balance: usdt ? String(usdt.equity || usdt.availableBalance || '0') : '0' };
  }
  if (action === 'open_positions') {
    const d = await get('/api/v1/private/position/open_positions');
    return { positions: d.data || [] };
  }
  if (action === 'fills') {
    const q = {};
    if (symbol) q.symbol = symbol.replace('/', '_');
    if (startTime) q.start_time = startTime;
    if (endTime) q.end_time = endTime;
    q.page_num = 1;
    q.page_size = 100;
    const ordersResp = await get('/api/v1/private/order/list/history_orders', q);
    const allOrders = ordersResp.data || [];
    const matchingOrders = positionId
      ? allOrders.filter(o => String(o.positionId) === String(positionId))
      : allOrders;
    const orderFills = matchingOrders
      .filter(o => o.state === 3 || String(o.state) === '3')
      .map(o => ({
        id: String(o.orderId || o.id || ''),
        orderId: String(o.orderId || o.id || ''),
        symbol: o.symbol,
        side: o.side,
        vol: o.dealVol,
        price: o.dealAvgPrice,
        profit: o.profit,
        fee: o.totalFee,
        timestamp: o.updateTime || o.createTime || 0,
        positionId: o.positionId,
        state: o.state,
        _fromHistoryOrder: true,
      }));

    let pendingTPs = [];
    try {
      const pendQ = { is_finished: 0, page_num: 1, page_size: 100 };
      if (symbol) pendQ.symbol = symbol.replace('/', '_');
      const pendResp = await get('/api/v1/private/stoporder/list/orders', pendQ);
      pendingTPs = (pendResp.data || [])
        .filter(s => s.state === 1)
        .filter(s => !positionId || String(s.positionId) === String(positionId))
        .map(s => ({
          _pending: true,
          _triggerSide: s.triggerSide,
          positionId: s.positionId,
          symbol: s.symbol,
          price: s.triggerSide === 1 ? s.takeProfitPrice : (s.triggerSide === 2 ? s.stopLossPrice : (s.takeProfitPrice || s.stopLossPrice)),
          vol: s.vol,
          side: s.positionType === 1 ? 4 : 2,
          orderId: s.id || s.placeOrderId,
        }));
    } catch { /* pending fetch mag falen */ }

    const allFills = [...orderFills, ...pendingTPs];
    return {
      fills: allFills,
      total: allFills.length,
      _sources: { orders: orderFills.length, pending: pendingTPs.length, _endpoint: 'history_orders' },
    };
  }
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  const d = await get('/api/v1/private/position/list/history_positions', { page_num: 1, page_size: 500 });
  const positions = (d.data || []).filter(p => Number(p.updateTime || p.closeTime || 0) >= since);
  return { trades: positions };
}

// ═══════════════════════════════════════════════════════════════
// Blofin — direct HTTP + HMAC-SHA256 (base64 van hex-digest)
// ONGEWIJZIGD vs v6/v7
// ═══════════════════════════════════════════════════════════════
async function handleBlofin(action, { apiKey, apiSecret, passphrase, startTime, endTime, symbol }) {
  const base = 'https://openapi.blofin.com';
  const get = async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const pathWithQs = path + (qs ? '?' + qs : '');
    const ts = new Date().toISOString();
    const signature = await hmacBase64(apiSecret, ts + 'GET' + pathWithQs);
    const res = await fetch(`${base}${pathWithQs}`, {
      headers: {
        'ACCESS-KEY': apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': ts,
        'ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (SyncJournal)',
        'Accept': 'application/json',
      },
    });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); }
    catch { throw new Error(`Blofin gaf geen JSON (HTTP ${res.status}): ${txt.slice(0, 120)}`); }
    if (data.code && String(data.code) !== '0') throw new Error(`Blofin ${path}: ${data.msg || data.code}`);
    return data;
  };

  if (action === 'test') {
    const d = await get('/api/v1/asset/balances', { accountType: 'futures' });
    const usdt = (d.data || []).find(a => a.currency === 'USDT');
    return { success: true, balance: usdt ? String(usdt.balance || usdt.equity || '0') : '0' };
  }
  if (action === 'open_positions') {
    const d = await get('/api/v1/account/positions');
    return { positions: d.data || [] };
  }
  if (action === 'fills') {
    const q = { limit: 100 };
    if (symbol) q.instId = String(symbol).replace('_', '-').replace('/', '-');
    if (startTime) q.begin = startTime;
    if (endTime) q.end = endTime;
    const d = await get('/api/v1/trade/fills-history', q);
    return { fills: d.data || [], total: (d.data || []).length };
  }
  const d = await get('/api/v1/account/positions-history', { limit: 100 });
  return { source: 'positions-history', trades: d.data || [] };
}

// ═══════════════════════════════════════════════════════════════
// Kraken Futures — fills + account-log gekoppeld (v8 match-fix)
// ═══════════════════════════════════════════════════════════════
async function handleKraken(action, { apiKey, apiSecret, startTime }) {
  const base = 'https://futures.kraken.com';

  const signKraken = async (basePath, nonce, postData = '') => {
    const endpointPath = basePath.replace('/derivatives', '');
    const msg = (postData || '') + (nonce || '') + endpointPath;
    const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    const secretBytes = base64ToBytes(apiSecret);
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, hashBytes);
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  };
  const krakenGet = async (basePath, params = {}) => {
    const nonce = Date.now().toString();
    const qs = Object.keys(params).length
      ? Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    const url = qs ? `${base}${basePath}?${qs}` : `${base}${basePath}`;
    const authent = await signKraken(basePath, nonce, qs);
    const res = await fetch(url, { headers: { 'APIKey': apiKey, 'Nonce': nonce, 'Authent': authent } });
    return res.json();
  };

  // -- ONGEWIJZIGD vs v6/v7 --
  if (action === 'test') {
    const d = await krakenGet('/derivatives/api/v3/accounts');
    if (d.result !== 'success') throw new Error(d.error || 'Kraken verbinding mislukt');
    let balance = '0';
    try {
      const accts = d.accounts || {};
      for (const name of Object.keys(accts)) {
        const a = accts[name];
        const bal = a?.auxiliary?.pv ?? a?.balanceValue ?? a?.balances?.USD;
        if (bal) { balance = String(bal); break; }
      }
    } catch {}
    return { success: true, balance };
  }

  if (action === 'open_positions') {
    const d = await krakenGet('/derivatives/api/v3/openpositions');
    return { positions: d.openPositions || [] };
  }

  if (action === 'fills') {
    const since = startTime ? parseInt(startTime) : Date.now() - 90 * 86400000;
    const fromISO = new Date(since).toISOString();
    let allFills = [];
    let lastTime = fromISO;
    for (let page = 0; page < 20; page++) {
      const d = await krakenGet('/derivatives/api/v3/fills', { lastFillTime: lastTime });
      if (d.result !== 'success') throw new Error(d.error || 'Kraken fills mislukt');
      const fills = d.fills || [];
      if (!fills.length) break;
      allFills = allFills.concat(fills);
      if (fills.length < 100) break;
      const nt = fills[fills.length - 1].fillTime || fills[fills.length - 1].time;
      if (!nt || nt === lastTime) break;
      lastTime = nt;
    }
    return { fills: allFills, total: allFills.length };
  }

  // -- v8 trades flow --
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  const cleanPair = (sym) => {
    let s = (sym || '').toUpperCase().replace('PF_', '').replace('PI_', '').replace('FF_', '').replace('FI_', '').replace('XBT', 'BTC');
    if (s.includes('/')) return s;
    if (s.endsWith('USDC')) return s.slice(0, -4) + '/USDC';
    if (s.endsWith('USDT')) return s.slice(0, -4) + '/USDT';
    if (s.endsWith('USD'))  return s.slice(0, -3) + '/USD';
    return s + '/USD';
  };

  // Stap 1: fills paginated. v10 pagination-fix:
  // Kraken's `lastFillTime` filtert fills VÓÓR dat tijdstip (= oudere).
  // Voor recent fills: start zonder param (= meest recent), paginer terug
  // in tijd via oudste fillTime van de vorige batch totdat oldest < since.
  let allFills = [];
  try {
    let lastTime = null; // null = geen filter, krijgt nieuwste fills
    for (let page = 0; page < 20; page++) {
      const params = lastTime ? { lastFillTime: lastTime } : {};
      const d = await krakenGet('/derivatives/api/v3/fills', params);
      if (d.result !== 'success') break;
      const fills = d.fills || [];
      if (!fills.length) break;
      allFills = allFills.concat(fills);
      // Vind oudste fillTime in deze batch
      let oldestTs = Infinity;
      let oldestFillTime = null;
      for (const f of fills) {
        const t = new Date(f.fillTime || f.time || 0).getTime();
        if (t > 0 && t < oldestTs) {
          oldestTs = t;
          oldestFillTime = f.fillTime || f.time;
        }
      }
      // Stop als oudste fill in deze batch al voor since is
      if (oldestTs <= since) break;
      if (fills.length < 100) break;
      if (!oldestFillTime || oldestFillTime === lastTime) break;
      lastTime = oldestFillTime;
    }
    // Defensief: filter alleen in-window fills
    allFills = allFills.filter(f => {
      const t = new Date(f.fillTime || f.time || 0).getTime();
      return t >= since;
    });
  } catch (e) {
    allFills = [];
  }

  // Stap 2: account-log paginated
  const logs = [];
  let before = undefined;
  for (let page = 0; page < 20; page++) {
    const params = { count: 1000 };
    if (before) params.before = before;
    const res = await krakenGet('/api/history/v3/account-log', params);
    const batch = res?.logs || [];
    if (!batch.length) break;
    logs.push(...batch);
    const oldest = batch[batch.length - 1];
    const oldestTs = new Date(oldest.date || oldest.dateTime || 0).getTime();
    if (oldestTs <= since) break;
    if (batch.length < 1000) break;
    before = oldestTs;
  }

  // Stap 3: filter trade-events met PnL
  const tradeEvents = logs.filter(e => {
    const pnl = parseFloat(e.realized_pnl || e.realizedPnl || 0);
    const ts = new Date(e.date || e.dateTime || 0).getTime();
    return Math.abs(pnl) > 0.0001 && ts >= since;
  });

  // Stap 4 — v8 fix: case-insensitive contract lookup, ruimer window.
  // Lookup-key: lowercase contract + minute. Bij match accepteren we ook
  // contract-naam variaties (bv. PF_XBTUSD vs pf_xbtusd).
  const eventLookup = new Map();
  for (const e of tradeEvents) {
    const ts = new Date(e.date || e.dateTime || 0).getTime();
    const contract = String(e.contract || '').toLowerCase();
    if (!contract) continue;
    const minute = Math.floor(ts / 60000);
    const key = `${contract}|${minute}`;
    if (!eventLookup.has(key)) eventLookup.set(key, []);
    eventLookup.get(key).push({ event: e, ts });
  }

  // v9: window 30s → 5 min (account-log settlement-delay), scan ±5 minuten
  const MATCH_WINDOW_MS = 5 * 60 * 1000;
  const SCAN_MINUTES = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];
  const findMatchingEvent = (fill) => {
    const fillTs = new Date(fill.fillTime || 0).getTime();
    if (!fillTs) return { event: null, bestDelta: null, candidatesScanned: 0 };
    const minute = Math.floor(fillTs / 60000);
    const symbol = String(fill.symbol || '').toLowerCase();
    if (!symbol) return { event: null, bestDelta: null, candidatesScanned: 0 };
    let best = null;
    let bestDelta = Infinity;
    let nearestDelta = Infinity; // closest event regardless of window
    let candidatesScanned = 0;
    for (const offset of SCAN_MINUTES) {
      const key = `${symbol}|${minute + offset}`;
      const candidates = eventLookup.get(key) || [];
      candidatesScanned += candidates.length;
      for (const c of candidates) {
        const delta = Math.abs(c.ts - fillTs);
        if (delta < nearestDelta) nearestDelta = delta;
        if (delta <= MATCH_WINDOW_MS && delta < bestDelta) {
          best = c.event;
          bestDelta = delta;
        }
      }
    }
    return { event: best, bestDelta: best ? bestDelta : nearestDelta, candidatesScanned };
  };

  // Stap 5: groep close-fills
  const groups = new Map();
  let matchedCount = 0;
  let inWindowFillsCount = 0;
  let firstInWindowFillSample = null;
  const deltaSamples = []; // eerste 3 in-window fills: hun nearest-event-delta
  const sideCounts = { sell: 0, buy: 0, other: 0 };
  for (const fill of allFills) {
    const fillTs = new Date(fill.fillTime || 0).getTime();
    if (!fillTs || fillTs < since) continue;
    inWindowFillsCount++;
    const sd = String(fill.side || '').toLowerCase();
    if (sd === 'sell') sideCounts.sell++;
    else if (sd === 'buy') sideCounts.buy++;
    else sideCounts.other++;

    if (!firstInWindowFillSample) {
      firstInWindowFillSample = {
        symbol: fill.symbol,
        fillTime: fill.fillTime,
        side: fill.side,
        size: fill.size,
        price: fill.price,
        fill_id: fill.fill_id,
      };
    }

    const matchResult = findMatchingEvent(fill);
    const event = matchResult.event;

    if (deltaSamples.length < 3) {
      deltaSamples.push({
        fillTime: fill.fillTime,
        symbol: fill.symbol,
        side: fill.side,
        candidatesScanned: matchResult.candidatesScanned,
        nearestEventDeltaMs: matchResult.bestDelta === Infinity ? null : matchResult.bestDelta,
        matched: !!event,
      });
    }

    if (!event) continue;
    matchedCount++;
    const direction = sd === 'sell' ? 'long' : (sd === 'buy' ? 'short' : null);
    if (!direction) continue;
    const minute = Math.floor(fillTs / 60000);
    const key = `${String(fill.symbol).toLowerCase()}|${minute}|${direction}`;
    if (!groups.has(key)) groups.set(key, { fills: [], events: [], contract: fill.symbol, direction, firstTs: fillTs });
    const g = groups.get(key);
    g.fills.push(fill);
    g.events.push(event);
    if (fillTs < g.firstTs) g.firstTs = fillTs;
  }

  // Stap 6: aggregeer + bouw tpLevels per fill (v11: lost TP-coverage bug op
  // zonder aparte fetchFills-call. Kraken trades hebben geen positionId zodat
  // de standaard TP-fetch flow werkt niet — daarom doen we het hier inline.)
  // v11 ook: capture `firstMatchedEvent` met ALLE keys voor diagnose van
  // entry-prijs (v10 leverde 78307 ipv echte 79184, dus old_average_entry_price
  // is mogelijk niet het juiste veld).
  let firstMatchedEvent = null;
  const trades = [...groups.values()].map(g => {
    let totalSize = 0, weightedPrice = 0;
    g.fills.forEach(f => {
      const size = Math.abs(parseFloat(f.size || 0));
      const price = parseFloat(f.price || 0);
      totalSize += size;
      weightedPrice += price * size;
    });
    let totalPnl = 0, totalFee = 0, entryPrice = 0;
    g.events.forEach(e => {
      totalPnl += parseFloat(e.realized_pnl || 0);
      totalFee += Math.abs(parseFloat(e.fee || 0));
      if (!entryPrice) {
        entryPrice = parseFloat(e.old_average_entry_price || e.new_average_entry_price || e.mark_price || 0);
      }
      // Capture sample voor diagnose: eerste matched event met ALLE keys.
      if (!firstMatchedEvent) {
        firstMatchedEvent = { ...e }; // alle velden voor diagnose
      }
    });
    const avgExit = totalSize > 0 ? weightedPrice / totalSize : 0;
    const tradeId = `${g.contract}_${g.firstTs}_${g.direction}`;

    // v11 nieuw: bouw tpLevels uit close-fills. Eén fill = één TP-niveau.
    // Voor single-close trades: 1 TP met pct=100. Voor partial closes:
    // meerdere TPs met pct = sub-size / totalSize × 100.
    const tpLevels = g.fills
      .map((f, i) => {
        const fSize = Math.abs(parseFloat(f.size || 0));
        const fPrice = parseFloat(f.price || 0);
        if (!(fSize > 0) || !(fPrice > 0)) return null;
        const pct = totalSize > 0 ? (fSize / totalSize * 100) : 0;
        return {
          id: `tp_${tradeId}_${i}`,
          price: String(fPrice),
          pct: String(pct.toFixed(1)),
          status: 'hit',
          actualPrice: String(fPrice),
          ts: new Date(f.fillTime || 0).getTime() || g.firstTs,
          _source: 'kraken_fills',
        };
      })
      .filter(Boolean)
      // Sorteer chronologisch: oudste TP eerst (= TP1)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));

    return {
      fill_id: tradeId,
      pair_clean: cleanPair(g.contract),
      symbol: g.contract,
      direction: g.direction,
      entry_price: String(entryPrice || avgExit),
      exit_price: String(avgExit),
      size: String(totalSize.toFixed(8)),
      pnl: String((totalPnl - totalFee).toFixed(4)),
      fee: Math.abs(totalFee),
      fillTime: new Date(g.firstTs).toISOString(),
      status: 'closed',
      tpLevels, // v11: nieuw veld
      originalSizeAsset: String(totalSize.toFixed(8)), // = totale gesloten size
    };
  }).filter(t => t.pair_clean);

  // Diagnostic: samples van eerste fill + log-entry zodat we kunnen zien
  // waarom matching niet werkt als matchedCount 0 blijft.
  const firstFillSample = allFills[0] ? {
    symbol: allFills[0].symbol,
    fillTime: allFills[0].fillTime,
    side: allFills[0].side,
    size: allFills[0].size,
    price: allFills[0].price,
    fill_id: allFills[0].fill_id,
  } : null;
  const firstLogSample = tradeEvents[0] ? {
    contract: tradeEvents[0].contract,
    date: tradeEvents[0].date,
    info: tradeEvents[0].info,
    realized_pnl: tradeEvents[0].realized_pnl,
    fee: tradeEvents[0].fee,
    keys: Object.keys(tradeEvents[0]),
  } : null;
  const debug = {
    fillsCount: allFills.length,
    logsCount: logs.length,
    tradeEventsCount: tradeEvents.length,
    inWindowFillsCount,
    matchedCount,
    eventLookupKeys: eventLookup.size,
    matchWindowMs: MATCH_WINDOW_MS,
    sideCounts,
    firstFillSample,
    firstInWindowFillSample,
    firstLogSample,
    firstMatchedEvent, // v11: ALLE keys van een matched event voor entry-prijs diagnose
    sampleEventLookupKeys: [...eventLookup.keys()].slice(0, 5),
    deltaSamples,
  };

  // Veiligheids-net: als 0 matches, val terug op v6-pad (account-log only)
  if (trades.length === 0) {
    const closes = logs.filter(e => {
      const pnl = parseFloat(e.realized_pnl || e.realizedPnl || 0);
      const ts = new Date(e.date || e.dateTime || 0).getTime();
      return Math.abs(pnl) > 0.0001 && ts >= since;
    });
    const groupsLegacy = new Map();
    closes.forEach(c => {
      const ts = new Date(c.date || c.dateTime).getTime();
      const minuteKey = Math.floor(ts / 60000);
      const chg = parseFloat(c.change || 0);
      const direction = chg < 0 ? 'long' : 'short';
      const key = `${c.contract}|${minuteKey}|${direction}`;
      if (!groupsLegacy.has(key)) groupsLegacy.set(key, { fills: [], contract: c.contract, direction, firstTs: ts });
      groupsLegacy.get(key).fills.push(c);
      if (ts < groupsLegacy.get(key).firstTs) groupsLegacy.get(key).firstTs = ts;
    });
    const fallbackTrades = [...groupsLegacy.values()].map(g => {
      let totalSize = 0, totalPnl = 0, totalFee = 0, weightedExit = 0;
      let entryPrice = 0;
      g.fills.forEach(f => {
        const size = Math.abs(parseFloat(f.change || 0));
        const price = parseFloat(f.trade_price || f.price || 0);
        totalSize += size;
        totalPnl += parseFloat(f.realized_pnl || 0);
        totalFee += Math.abs(parseFloat(f.fee || 0));
        weightedExit += price * size;
        if (!entryPrice) {
          entryPrice = parseFloat(f.old_average_entry_price || f.new_average_entry_price || f.mark_price || 0);
        }
      });
      const avgExit = totalSize > 0 ? weightedExit / totalSize : 0;
      return {
        fill_id: `${g.contract}_${g.firstTs}_${g.direction}`,
        pair_clean: cleanPair(g.contract),
        symbol: g.contract,
        direction: g.direction,
        entry_price: String(entryPrice || avgExit),
        exit_price: String(avgExit),
        size: String(totalSize.toFixed(8)),
        pnl: String((totalPnl - totalFee).toFixed(4)),
        fee: Math.abs(totalFee),
        fillTime: new Date(g.firstTs).toISOString(),
        status: 'closed',
      };
    }).filter(t => t.pair_clean);
    return { source: 'account_log_fallback', trades: fallbackTrades, _v11Debug: debug };
  }

  return { source: 'fills+account_log', trades, _v11Debug: debug };
}

// ═══════════════════════════════════════════════════════════════
// Crypto helpers (WebCrypto — geen Node)
// ONGEWIJZIGD
// ═══════════════════════════════════════════════════════════════
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacBase64(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
function base64ToBytes(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
