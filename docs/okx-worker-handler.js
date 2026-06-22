// ─────────────────────────────────────────────────────────────────────────────
// OKX v5 handler voor de Cloudflare Worker (Morani proxy) — afgestemd op v18
//
// ⚠ Deze code hoort in JOUW Worker (extern beheerd), NIET in deze repo.
// Twee wijzigingen in worker.js:
//   (1) één dispatch-regel toevoegen in de fetch-handler
//   (2) de functie handleOKX(...) toevoegen tussen de andere handle<X>-functies
// Hergebruikt je bestaande helper hmacBase64() — OKX wil base64(HMAC-SHA256), exact wat die doet.
//
// Contract met de client (ExchangeAPI.okx): de Worker geeft RAW OKX-velden terug,
// de app normaliseert zelf (contracts→base, netto-PnL, direction). Dus alleen signen +
// fetchen + doorgeven — net als handleBlofin.
// ─────────────────────────────────────────────────────────────────────────────


// ── (1) DISPATCH-REGEL ────────────────────────────────────────────────────────
// In `export default { async fetch }`, bij de exchange-dispatch, vóór de
// `else return json({ error: `Onbekende exchange: ${exchange}` }, 400);`-regel:
//
//   else if (exchange === 'kraken') result = await handleKraken(action, body);
//   else if (exchange === 'okx')    result = await handleOKX(action, body);   // <── TOEVOEGEN
//   else return json({ error: `Onbekende exchange: ${exchange}` }, 400);


// ── (2) HANDLER-FUNCTIE ───────────────────────────────────────────────────────
// Plak deze functie tussen handleBlofin en handleKraken (of waar je wilt tussen
// de andere handle<X>-functies). Gebruikt de bestaande hmacBase64() helper.

// ═══════════════════════════════════════════════════════════════
// OKX v5 (USDT-margined SWAP) — direct HTTP + HMAC-SHA256 (base64), passphrase
// Signing: prehash = timestamp(ISO-ms) + METHOD + requestPath(+querystring) + body
//          OK-ACCESS-SIGN = base64( HMAC-SHA256(prehash, secret) )
// ═══════════════════════════════════════════════════════════════
async function handleOKX(action, { apiKey, apiSecret, passphrase, startTime, endTime, symbol, okxHost }) {
  // EEA-accounts (login op my.okx.com/en-eu) bestaan op de EEA API-host, NIET op www.okx.com.
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
    const rows = await get('/api/v5/account/positions?instType=SWAP');
    return { positions: rows };
  }

  if (action === 'fills') {
    let path = '/api/v5/trade/fills-history?instType=SWAP&limit=100';
    if (symbol)    path += '&instId=' + encodeURIComponent(symbol);
    if (startTime) path += '&begin=' + startTime;
    if (endTime)   path += '&end=' + endTime;
    const rows = await get(path);
    return { fills: rows };
  }

  // trades: positions-history = 1 geaggregeerd record per gesloten positie (max 3 mnd terug).
  // Eerste pagina (limit 100) dekt verreweg de meeste gebruikers. Pagineren via `after`-cursor
  // voor >100 trades; de cursor-semantiek (posId vs uTime) verifiëren we nog met echte data —
  // tot dan stopt de loop sowieso na 1 pagina als er <100 records zijn.
  const minTs = startTime ? Number(startTime) : 0;
  let out = [];
  let after = '';
  for (let page = 0; page < 20; page++) {
    let path = '/api/v5/account/positions-history?instType=SWAP&limit=100';
    if (after) path += '&after=' + after;
    const rows = await get(path);
    if (!rows.length) break;
    out = out.concat(rows);
    if (rows.length < 100) break;
    const last = rows[rows.length - 1];
    const lastTs = Number(last.uTime || last.cTime || 0);
    if (minTs && lastTs && lastTs < minTs) break;
    after = String(last.posId || lastTs || '');
    if (!after) break;
  }
  const trades = minTs ? out.filter(t => Number(t.uTime || t.cTime || 0) >= minTs) : out;
  return { source: 'positions-history', trades };
}
