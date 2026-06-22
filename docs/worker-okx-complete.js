/**
 * Morani Trading Journal — Cloudflare Worker Proxy v19
 *
 * Changes vs v18 (OKX toegevoegd):
 *  - Nieuwe exchange 'okx' (USDT-margined perpetual SWAP). Dispatch-regel +
 *    handleOKX(). Acties: test, open_positions, fills, trades (positions-history).
 *  - OKX v5 signing: prehash = timestamp(ISO-ms) + METHOD + requestPath(+qs) + body,
 *    OK-ACCESS-SIGN = base64(HMAC-SHA256(prehash, secret)). Hergebruikt hmacBase64().
 *  - Passphrase vereist (zoals Blofin). Worker geeft RAW OKX-velden terug; de app
 *    (ExchangeAPI.okx) normaliseert zelf (contracts→base via ctVal, netto-PnL, direction).
 *  - MEXC/Blofin/Kraken byte-voor-byte gelijk aan v18.
 *
 * Original v18 docstring:
 * Morani Trading Journal — Cloudflare Worker Proxy v18
 *
 * Changes vs v17 (Kraken trades-action — scaling-in false-positive fix):
 *  - v17 leverde 24 trades vs 21 ground truth. Waarvan 1 trade met
 *    1 extra fragment (size 0.0161 vs CSV 0.0156). Onderzoek wees uit:
 *    scaling-in false positive — increase-events met zelfde fillTime
 *    werden per ongeluk als close-fragment geteld.
 *
 *  - v18 fix: extra check in close-event filter:
 *      Math.abs(newPosition) < Math.abs(oldPosition)
 *    Pakt alleen events waar positie ECHT verkleind werd (= TradesViz
 *    "flat-position" methode equivalent). Increase-events (scaling-in)
 *    worden nu correct geskipt.
 *
 *  - v17 features behouden: pagination, CLOSE_LIKE label-set, histograms.
 *
 * Actions per exchange: test, trades, open_positions, fills
 *   + Kraken: position_events (debug)
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
      else if (exchange === 'okx')    result = await handleOKX(action, body);
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
// OKX v5 (USDT-margined SWAP) — direct HTTP + HMAC-SHA256 (base64), passphrase
// Signing: prehash = timestamp(ISO-ms) + METHOD + requestPath(+querystring) + body
//          OK-ACCESS-SIGN = base64( HMAC-SHA256(prehash, secret) )
// Worker geeft RAW OKX-records terug; ExchangeAPI.okx in de app normaliseert zelf.
// ═══════════════════════════════════════════════════════════════
async function handleOKX(action, { apiKey, apiSecret, passphrase, startTime, endTime, symbol, okxHost }) {
  // EEA-accounts (login op my.okx.com/en-eu) bestaan op de EEA API-host, NIET op www.okx.com.
  // Default = eea.okx.com (Morani-community is EU). Global-users kunnen later okxHost meesturen.
  const base = okxHost || 'https://eea.okx.com';
  const get = async (path) => {
    const ts = new Date().toISOString(); // bv. 2026-06-19T12:00:00.123Z (heeft ms)
    const signature = await hmacBase64(apiSecret, ts + 'GET' + path);
    const res = await fetch(`${base}${path}`, {
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': ts,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json',
        // Demo trading? voeg toe: 'x-simulated-trading': '1'
      },
    });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); }
    catch { throw new Error(`OKX ${path}: geen JSON (HTTP ${res.status}): ${txt.slice(0, 160)}`); }
    if (data.code && String(data.code) !== '0') throw new Error(`OKX ${path}: ${data.msg || data.code}`);
    return data.data || [];
  };

  if (action === 'test') {
    const rows = await get('/api/v5/account/balance?ccy=USDT');
    const det = (rows[0] && rows[0].details) || [];
    const usdt = det.find(d => d.ccy === 'USDT');
    const balance = usdt ? (usdt.eq || usdt.availBal || '0') : ((rows[0] && rows[0].totalEq) || '0');
    return { success: true, balance: String(balance) };
  }
  if (action === 'open_positions') {
    // OKX EEA "X-Perp" = instType=FUTURES (Expiry), niet SWAP. Geen instType-filter →
    // zowel SWAP- als FUTURES-posities komen mee.
    const rows = await get('/api/v5/account/positions');
    return { positions: rows };
  }
  if (action === 'fills') {
    // X-Perps = FUTURES, gewone perps = SWAP → query beide + merge (faalt stil per instType).
    const safeGet2 = async (p) => { try { return await get(p); } catch (e) { return []; } };
    const build = (it) => {
      let p = `/api/v5/trade/fills-history?instType=${it}&limit=100`;
      if (symbol)    p += '&instId=' + encodeURIComponent(symbol);
      if (startTime) p += '&begin=' + startTime;
      if (endTime)   p += '&end=' + endTime;
      return p;
    };
    const fut = await safeGet2(build('FUTURES'));
    const swap = await safeGet2(build('SWAP'));
    const rows = [...(Array.isArray(fut) ? fut : []), ...(Array.isArray(swap) ? swap : [])];
    return { fills: rows };
  }
  // trades: OKX EEA "X-Perps" (bv. BTCUSD UM X-Perp) zijn instType=FUTURES, NIET SWAP
  // (OKX changelog 2026-03-31; instFamily BTC-USD_UM, instId bv. BTC-USD_UM_XPERP-040431).
  // Gewone perps (niet-EEA) zijn SWAP. Daarom: query BEIDE + merge. _okxDebug.sample bevat het
  // ruwe record zodat de clientnormalisatie tegen echte data te verifiëren is.
  const minTs = startTime ? Number(startTime) : 0;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const safeGet = async (p) => { try { return await get(p); } catch (e) { return { __err: String(e.message || e).slice(0, 200) }; } };
  const phFut  = await safeGet('/api/v5/account/positions-history?instType=FUTURES&limit=100');
  const phSwap = await safeGet('/api/v5/account/positions-history?instType=SWAP&limit=100');
  const merged = [...arr(phFut), ...arr(phSwap)];
  const trades = minTs ? merged.filter(t => Number(t.uTime || t.cTime || 0) >= minTs) : merged;
  return {
    source: 'positions-history',
    trades,
    _okxDebug: {
      futures: arr(phFut).length, err_fut: phFut.__err,
      swap: arr(phSwap).length, err_swap: phSwap.__err,
      sample: (arr(phFut)[0] || arr(phSwap)[0] || null),
    },
  };
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

  // v14: experimentele action — probeer /positions endpoint paths.
  if (action === 'position_events') {
    const extractFirstSample = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (Array.isArray(v) && v.length > 0) return { key: k, length: v.length, item: v[0] };
        if (typeof v === 'object' && v !== null) {
          const nested = extractFirstSample(v);
          if (nested) return nested;
        }
      }
      return null;
    };
    const candidatePaths = [
      '/api/history/v2/positions',
      '/api/history/v3/positions',
      '/api/history/v2/positionupdates',
      '/api/history/v3/positionupdates',
      '/api/history/v2/positionevents',
      '/api/history/v3/positionevents',
      '/derivatives/api/v3/historicpositions',
      '/derivatives/api/v3/positionhistory',
    ];
    const results = {};
    for (const path of candidatePaths) {
      try {
        const data = await krakenGet(path);
        results[path] = {
          ok: !!data && data.result !== 'error',
          status: data?.result || 'unknown',
          keys: data ? Object.keys(data) : [],
          sample: extractFirstSample(data),
          rawBytes: JSON.stringify(data || {}).length,
        };
      } catch (e) {
        results[path] = { ok: false, error: String(e.message || e).slice(0, 200) };
      }
    }
    return { source: 'position_events_probe', candidates: results };
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

  // v15 trades flow: gebruik /api/history/v3/positions endpoint.
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  const cleanPair = (sym) => {
    let s = (sym || '').toUpperCase().replace('PF_', '').replace('PI_', '').replace('FF_', '').replace('FI_', '').replace('XBT', 'BTC');
    if (s.includes('/')) return s;
    if (s.endsWith('USDC')) return s.slice(0, -4) + '/USDC';
    if (s.endsWith('USDT')) return s.slice(0, -4) + '/USDT';
    if (s.endsWith('USD'))  return s.slice(0, -3) + '/USD';
    return s + '/USD';
  };

  // v17: pagination via continuationToken + uitgebreide debug
  let allElements = [];
  let firstResponseKeys = [];
  let firstResponseBytes = 0;
  let firstResponseLen = 0;
  let pagesFetched = 0;
  try {
    let continuationToken = null;
    for (let page = 0; page < 20; page++) {
      const params = continuationToken ? { continuationToken: String(continuationToken) } : {};
      const data = await krakenGet('/api/history/v3/positions', params);
      pagesFetched++;
      if (page === 0) {
        firstResponseKeys = data ? Object.keys(data) : [];
        firstResponseBytes = JSON.stringify(data || {}).length;
        firstResponseLen = data?.len || 0;
      }
      const elements = (data && Array.isArray(data.elements)) ? data.elements : [];
      if (!elements.length) break;
      allElements = allElements.concat(elements);
      const oldestTs = elements.reduce((min, el) => {
        const ts = parseFloat(el?.timestamp || 0);
        return (ts > 0 && ts < min) ? ts : min;
      }, Infinity);
      if (oldestTs > 0 && oldestTs < since) break;
      continuationToken = data?.continuationToken;
      if (!continuationToken) break;
    }
  } catch (e) {
    return {
      source: 'position_updates_error',
      trades: [],
      _v18Debug: { errorTrace: String(e?.message || e).slice(0, 500), stage: 'fetch_positions',
                   firstResponseKeys, firstResponseBytes, firstResponseLen, pagesFetched, totalElements: allElements.length },
    };
  }

  let closeEvents;
  const eventTypeCounts = {};
  const positionChangeCounts = {};
  let inWindowCount = 0;
  for (const el of allElements) {
    const eventKey = Object.keys(el?.event || {})[0] || 'unknown';
    eventTypeCounts[eventKey] = (eventTypeCounts[eventKey] || 0) + 1;
    const u = el?.event?.PositionUpdate;
    if (!u) continue;
    const ts = parseFloat(el.timestamp || u.timestamp || 0);
    if (ts >= since) inWindowCount++;
    const pc = u.positionChange || '<empty>';
    positionChangeCounts[pc] = (positionChangeCounts[pc] || 0) + 1;
  }

  try {
  const CLOSE_LIKE = new Set(['close', 'decrease', 'partialClose', 'positionDecrease']);
  let skippedNotShrinking = 0;
  closeEvents = allElements
    .filter(el => {
      const u = el?.event?.PositionUpdate;
      if (!u) return false;
      const pc = String(u.positionChange || '');
      if (!CLOSE_LIKE.has(pc)) return false;
      const ts = parseFloat(el.timestamp || u.timestamp || 0);
      if (ts < since) return false;
      const oldAbs = Math.abs(parseFloat(u.oldPosition || 0));
      const newAbs = Math.abs(parseFloat(u.newPosition || 0));
      if (!(newAbs < oldAbs)) {
        skippedNotShrinking++;
        return false;
      }
      return true;
    })
    .map(el => el.event.PositionUpdate);
  positionChangeCounts._skippedNotShrinking = skippedNotShrinking;
  } catch (e) {
    return {
      source: 'position_updates_error',
      trades: [],
      _v18Debug: { errorTrace: String(e?.message || e).slice(0, 500), stage: 'filter_close_events',
                   totalElements: allElements.length, firstResponseKeys, firstResponseBytes,
                   eventTypeCounts, positionChangeCounts, inWindowCount, pagesFetched },
    };
  }

  const groups = new Map();
  for (const u of closeEvents) {
    const oldPos = parseFloat(u.oldPosition || 0);
    const direction = oldPos < 0 ? 'short' : 'long';
    const key = `${u.tradeable}|${u.fillTime}|${direction}`;
    if (!groups.has(key)) groups.set(key, {
      tradeable: u.tradeable,
      direction,
      fillTime: u.fillTime,
      events: [],
    });
    groups.get(key).events.push(u);
  }

  const trades = [...groups.values()].map(g => {
    let totalSize = 0, weightedExit = 0, totalPnl = 0, totalFee = 0, totalFunding = 0;
    let lastTimestamp = 0;
    let entryPrice = 0;
    g.events.forEach(u => {
      const sz = Math.abs(parseFloat(u.executionSize || 0));
      const px = parseFloat(u.executionPrice || 0);
      const pnl = parseFloat(u.realizedPnL || 0);
      const fee = Math.abs(parseFloat(u.fee || 0));
      const funding = parseFloat(u.realizedFunding || 0);
      const ts = parseFloat(u.timestamp || 0);
      totalSize += sz;
      weightedExit += px * sz;
      totalPnl += pnl;
      totalFee += fee;
      totalFunding += funding;
      if (ts > lastTimestamp) lastTimestamp = ts;
      if (!entryPrice) entryPrice = parseFloat(u.oldAverageEntryPrice || 0);
    });
    const avgExit = totalSize > 0 ? weightedExit / totalSize : 0;
    const tradeId = `${g.tradeable}_${g.fillTime}_${g.direction}`;

    const tpLevels = g.events
      .map((u, i) => {
        const sz = Math.abs(parseFloat(u.executionSize || 0));
        const px = parseFloat(u.executionPrice || 0);
        if (!(sz > 0) || !(px > 0)) return null;
        const pct = totalSize > 0 ? (sz / totalSize * 100) : 0;
        return {
          id: `tp_${tradeId}_${i}`,
          price: String(px),
          pct: String(pct.toFixed(1)),
          status: 'hit',
          actualPrice: String(px),
          ts: parseFloat(u.timestamp || 0),
          _source: 'kraken_position_update',
          _executionUid: u.executionUid,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));

    return {
      fill_id: tradeId,
      pair_clean: cleanPair(g.tradeable),
      symbol: g.tradeable,
      direction: g.direction,
      entry_price: String(entryPrice || avgExit),
      exit_price: String(avgExit),
      size: String(totalSize.toFixed(8)),
      pnl: String((totalPnl - totalFee + totalFunding).toFixed(4)),
      fee: Math.abs(totalFee),
      funding: totalFunding,
      fillTime: new Date(parseInt(g.fillTime) || 0).toISOString(),
      status: 'closed',
      tpLevels,
      originalSizeAsset: String(totalSize.toFixed(8)),
    };
  }).filter(t => t.pair_clean);

  return {
    source: 'position_updates',
    trades,
    _v18Debug: {
      pagesFetched,
      totalElements: allElements.length,
      firstResponseLen,
      inWindowCount,
      eventTypeCounts,
      positionChangeCounts,
      closeEventsCount: closeEvents.length,
      tradesGrouped: trades.length,
      partialCloseTrades: trades.filter(t => (t.tpLevels || []).length > 1).length,
      firstResponseKeys,
      firstResponseBytes,
      sinceUsed: since,
    },
  };

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
