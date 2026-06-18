// ─────────────────────────────────────────────────────────────────────────────
// OKX v5 handler voor de Cloudflare Worker (TradeJournal proxy) — v12.236
//
// ⚠ Deze code hoort in JOUW Cloudflare Worker (extern beheerd), NIET in deze repo.
// Plak `handleOkx` + `okxHeaders` in worker.js en wire de dispatcher (zie onderaan).
// Pas dán werkt OKX API-sync in de app. Tot die tijd valt OKX terug op CSV-import.
//
// Contract met de client (ExchangeAPI.okx in work/tradejournal.html):
//   proxyCall({exchange:"okx", action, apiKey, apiSecret, passphrase, ...}) → JSON
//   - action "test"           → { success:true, balance:"<USDT equity>" }
//   - action "trades"         → { trades:[ ...raw positions-history records... ] }
//   - action "open_positions" → { positions:[ ...raw positions records... ] }
//   - action "fills"          → { fills:[ ...raw fills-history records... ] }
// De client normaliseert de raw OKX-velden zelf (contracts→base via ctVal, netto-PnL,
// direction). De Worker hoeft dus alleen te signen, te fetchen en door te geven.
// ─────────────────────────────────────────────────────────────────────────────

const OKX_BASE = "https://www.okx.com";

// OKX v5 signing: prehash = timestamp + METHOD + requestPath(+querystring) + body
// signature = Base64( HMAC-SHA256(prehash, secret) ). Timestamp = ISO8601 UTC ms.
async function okxHeaders(method, requestPath, body, apiKey, apiSecret, passphrase) {
  const ts = new Date().toISOString(); // bv. 2026-06-17T12:00:00.123Z (heeft ms)
  const prehash = ts + method + requestPath + (body || "");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(prehash));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sig,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
    // Demo trading: voeg "x-simulated-trading": "1" toe als je tegen de OKX-sandbox test.
  };
}

async function okxGet(requestPath, apiKey, apiSecret, passphrase) {
  const headers = await okxHeaders("GET", requestPath, "", apiKey, apiSecret, passphrase);
  const res = await fetch(OKX_BASE + requestPath, { method: "GET", headers });
  const data = await res.json();
  if (data.code && String(data.code) !== "0") {
    throw new Error(`OKX ${data.code}: ${data.msg || "onbekende fout"}`);
  }
  return data.data || [];
}

async function handleOkx(payload) {
  const { action, apiKey, apiSecret, passphrase, startTime, symbol } = payload;
  if (!apiKey || !apiSecret || !passphrase) {
    return { success: false, error: "OKX vereist API key, secret én passphrase" };
  }

  if (action === "test") {
    try {
      const rows = await okxGet("/api/v5/account/balance?ccy=USDT", apiKey, apiSecret, passphrase);
      // balance.totalEq = totale account equity in USD; details[].eq = per-ccy equity.
      const det = (rows[0] && rows[0].details) || [];
      const usdt = det.find(d => d.ccy === "USDT");
      const balance = usdt ? (usdt.eq || usdt.availBal || "0") : ((rows[0] && rows[0].totalEq) || "0");
      return { success: true, balance: String(balance) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === "open_positions") {
    const rows = await okxGet("/api/v5/account/positions?instType=SWAP", apiKey, apiSecret, passphrase);
    return { positions: rows };
  }

  if (action === "fills") {
    // fills-history (laatste 3 maanden). Cursor op billId; hier 1 pagina (100) — voldoende voor
    // TP-breakdown van één positie. Breid uit met `after`-paginatie indien nodig.
    let path = "/api/v5/trade/fills-history?instType=SWAP&limit=100";
    if (symbol) path += "&instId=" + encodeURIComponent(symbol);
    if (startTime) path += "&begin=" + startTime;
    const rows = await okxGet(path, apiKey, apiSecret, passphrase);
    return { fills: rows };
  }

  if (action === "trades") {
    // positions-history: 1 geaggregeerd record per gesloten positie (max 3 mnd terug).
    // Pagineer met `after` (= uTime van laatste record; OKX geeft records met uTime < after).
    const out = [];
    let after = "";
    const minTs = startTime ? Number(startTime) : 0;
    for (let guard = 0; guard < 20; guard++) {
      let path = "/api/v5/account/positions-history?instType=SWAP&limit=100";
      if (after) path += "&after=" + after;
      const rows = await okxGet(path, apiKey, apiSecret, passphrase);
      if (!rows.length) break;
      out.push(...rows);
      const last = rows[rows.length - 1];
      const lastTs = Number(last.uTime || last.cTime || 0);
      if (rows.length < 100) break;
      if (minTs && lastTs && lastTs < minTs) break; // ouder dan startTime → stop
      if (!lastTs || String(lastTs) === after) break;
      after = String(lastTs);
    }
    // Client-side filter op startTime (defensief — OKX `after` is cursor, geen harde grens).
    const trades = minTs ? out.filter(t => Number(t.uTime || t.cTime || 0) >= minTs) : out;
    return { trades };

    // ── OPTIONEEL (later): TP-breakdown per positie ──────────────────────────
    // Wil je multi-TP-niveaus tonen (community trade met meerdere take-profits), haal dan per
    // gesloten positie de close-fills op en bouw een tpLevels-array (pct is size-ratio, dus
    // ctVal valt weg). Plak vóór de `return` hierboven:
    //
    //   for (const t of trades.slice(0, 50)) {                 // cap: 50 recentste posities
    //     try {
    //       let fp = `/api/v5/trade/fills-history?instType=SWAP&instId=${t.instId}&limit=100`;
    //       if (t.cTime) fp += `&begin=${t.cTime}`;
    //       if (t.uTime) fp += `&end=${t.uTime}`;
    //       const fills = await okxGet(fp, apiKey, apiSecret, passphrase);
    //       const closeSide = (String(t.posSide).toLowerCase() === "short") ? "buy" : "sell";
    //       const closes = fills.filter(f => String(f.side).toLowerCase() === closeSide);
    //       const totalSz = closes.reduce((s, f) => s + Math.abs(parseFloat(f.fillSz) || 0), 0);
    //       if (totalSz > 0) {
    //         t.tpLevels = closes.map(f => ({
    //           price: String(f.fillPx),
    //           pct: ((Math.abs(parseFloat(f.fillSz) || 0) / totalSz) * 100).toFixed(1),
    //           status: "hit",
    //           actualPrice: String(f.fillPx),
    //           _source: "okx_fills",
    //         }));
    //       }
    //     } catch (e) { /* fills optioneel — positie blijft bruikbaar zonder TP-breakdown */ }
    //   }
    // ─────────────────────────────────────────────────────────────────────────
  }

  return { success: false, error: "Onbekende OKX-actie: " + action };
}

// ── Dispatcher-integratie ─────────────────────────────────────────────────────
// Voeg in de bestaande request-router van worker.js een tak toe, bv.:
//
//   if (payload.exchange === "okx") {
//     const result = await handleOkx(payload);
//     return new Response(JSON.stringify(result), {
//       headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
//     });
//   }
//
// (Houd dezelfde CORS-headers aan als de andere exchanges in jouw Worker.)
// ─────────────────────────────────────────────────────────────────────────────

// export { handleOkx, okxHeaders }; // indien je Worker ES-modules gebruikt
