// SyncJournal — lokale proxy (CCXT)
// Vervangt tijdelijk de Cloudflare Worker totdat die werkt.
// Start met: node server.js → luistert op http://localhost:8787
//
// Request-shape (POST /):
//   { exchange: "kraken"|"blofin"|"mexc", action: "test"|"trades"|"open_positions"|"fills",
//     apiKey, apiSecret, [passphrase], [startTime], [endTime], [symbol], [positionId] }

import express from "express";
import cors from "cors";
import ccxt from "ccxt";
import crypto from "crypto";

const PORT = 8787;
const app = express();
app.use(cors());              // sta requests toe vanaf file:// én localhost
app.use(express.json({ limit: "1mb" }));

// ─── Mapping: onze exchange-keys → CCXT-klassen ───
// MEXC futures-API is dicht voor retail tot 31 maart 2026 → we gebruiken spot.
const CCXT_CLASS = {
  kraken: "krakenfutures",    // krijg het meeste uit futures PNL; val terug op "kraken" indien spot
  blofin: "blofin",
  mexc:   "mexc",
};

function makeClient(exchangeKey, { apiKey, apiSecret, passphrase }) {
  const cls = CCXT_CLASS[exchangeKey];
  if (!cls || !ccxt[cls]) throw new Error(`Onbekende exchange: ${exchangeKey}`);
  const opts = { apiKey, secret: apiSecret, enableRateLimit: true };
  if (passphrase) opts.password = passphrase;
  return new ccxt[cls](opts);
}

// ─── Action handlers ───
async function doTest(client) {
  const bal = await client.fetchBalance();
  const totals = bal.total || {};
  // Probeer eerst stablecoins; val terug op grootste niet-nul balance
  let balance = totals.USDT ?? totals.USDC ?? totals.USD ?? 0;
  if (!balance) {
    const nonZero = Object.entries(totals).filter(([, v]) => Number(v) > 0);
    if (nonZero.length) {
      const [ccy, amt] = nonZero.sort((a, b) => b[1] - a[1])[0];
      balance = `${Number(amt).toFixed(4)} ${ccy}`;
    }
  }
  return { success: true, balance: String(balance || "0") };
}

async function doTrades(client, { startTime }) {
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  // fetchClosedOrders eerst — geeft ordervolume + avgPrice; werkt zonder symbol op de meeste exchanges.
  // Val terug op fetchMyTrades als dat niet werkt.
  let fills = [];
  try {
    if (client.has.fetchClosedOrders) {
      fills = await client.fetchClosedOrders(undefined, since, 500);
      console.log(`[${client.id}/trades] fetchClosedOrders → ${fills.length}`);
    }
  } catch (e) {
    console.log(`[${client.id}/trades] fetchClosedOrders faalt: ${e.message}`);
  }
  if (!fills.length) {
    try {
      fills = await client.fetchMyTrades(undefined, since, 500);
      console.log(`[${client.id}/trades] fetchMyTrades → ${fills.length}`);
    } catch (e) {
      console.log(`[${client.id}/trades] fetchMyTrades faalt: ${e.message}`);
      throw e;
    }
  }
  if (fills.length) console.log(`[${client.id}/trades] sample:`, JSON.stringify(fills[0]).slice(0,500));
  const trades = (fills || []).map(t => {
    const info = t.info || {};
    // PNL extraction — probeer veel variaties
    const pnl = info.realizedPnl ?? info.realisedPnl ?? info.realized_pnl
              ?? info.pnl ?? info.profit ?? info.closedPnl ?? info.closed_pnl
              ?? t.pnl ?? "";
    const posType = (t.side === "buy" || t.side === "long") ? 1 : 2;
    const ts = t.timestamp || Date.now();
    return {
      positionId: t.order || t.id,
      symbol: (t.symbol || "").replace("/", "_"),
      positionType: posType,
      openTime: ts,
      updateTime: ts,
      closeTime: ts,
      openAvgPrice: t.price,
      closeAvgPrice: t.price,
      closeVol: t.amount,
      vol: t.amount,
      realised: String(pnl),
      fee: t.fee?.cost ?? t.fees?.[0]?.cost ?? 0,
      leverage: info.leverage ?? "",
    };
  }).filter(t => t.positionId && t.symbol);
  console.log(`[${client.id}/trades] na mapping → ${trades.length} trades (phantoms/lege weggefilterd)`);
  if (trades.length) console.log(`[${client.id}/trades] first mapped:`, JSON.stringify(trades[0]).slice(0,400));
  return { trades };
}

async function doOpenPositions(client) {
  if (!client.has.fetchPositions) return { positions: [] };
  const positions = await client.fetchPositions();
  const mapped = (positions || [])
    .filter(p => parseFloat(p.contracts || p.info?.positionAmt || 0) !== 0)
    .map(p => ({
      positionId: p.id || p.info?.positionIdx || p.symbol,
      symbol: (p.symbol || "").replace("/", "_"),
      positionType: (p.side === "long") ? 1 : 2,
      createTime: p.timestamp || Date.now(),
      openAvgPrice: p.entryPrice,
      holdAvgPrice: p.entryPrice,
      holdVol: p.contracts,
      holdFee: p.info?.fee || 0,
      leverage: p.leverage || "",
      unrealized: p.unrealizedPnl || 0,
      liquidatePrice: p.liquidationPrice || "",
      realised: 0,
    }));
  return { positions: mapped };
}

async function doFills(client, { symbol, startTime, endTime }) {
  const since = startTime ? Number(startTime) : undefined;
  const ccxtSymbol = symbol ? symbol.replace("_", "/") : undefined;
  const raw = await client.fetchMyTrades(ccxtSymbol, since, 200);
  const filtered = endTime
    ? raw.filter(t => t.timestamp <= Number(endTime))
    : raw;
  return { fills: filtered, total: filtered.length };
}

// ─── MEXC Contract V1 — directe API call (CCXT ondersteunt alleen spot) ───
// Endpoint geeft geaggregeerde positions terug met entry/exit/pnl — geen aggregatie nodig.
async function doTradesMexc(apiKey, apiSecret, { startTime, action }) {
  const base = "https://contract.mexc.com";
  const sign = (timestamp, paramString) => {
    const target = apiKey + timestamp + paramString;
    return crypto.createHmac("sha256", apiSecret).update(target).digest("hex");
  };
  const callGet = async (path, query = {}) => {
    const qs = new URLSearchParams(query).toString();
    const timestamp = String(Date.now());
    const signature = sign(timestamp, qs);
    const url = base + path + (qs ? "?" + qs : "");
    const res = await fetch(url, { headers: { "ApiKey": apiKey, "Request-Time": timestamp, "Signature": signature, "Content-Type": "application/json" } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || `MEXC ${path} gaf geen success`);
    return data;
  };

  if (action === "test") {
    const d = await callGet("/api/v1/private/account/assets");
    const usdt = (d.data || []).find(a => a.currency === "USDT");
    return { success: true, balance: usdt ? String(usdt.equity || usdt.availableBalance || "0") : "0" };
  }
  if (action === "open_positions") {
    const d = await callGet("/api/v1/private/position/open_positions");
    return { positions: d.data || [] };
  }
  if (action === "fills") {
    const { symbol, positionId, startTime: st, endTime } = arguments[2] || {};
    const q = {};
    if (symbol) q.symbol = symbol.replace("/", "_");
    if (positionId) q.position_id = positionId;
    if (st) q.start_time = st;
    if (endTime) q.end_time = endTime;
    const d = await callGet("/api/v1/private/order/list/order_deals", q);
    return { fills: d.data || [], total: (d.data||[]).length };
  }
  // trades: history_positions
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  const d = await callGet("/api/v1/private/position/list/history_positions", { page_num: 1, page_size: 500 });
  const positions = (d.data || []).filter(p => Number(p.updateTime || p.closeTime || 0) >= since);
  console.log(`[mexc/trades] history_positions → ${(d.data||[]).length}, na filter: ${positions.length}`);
  return { trades: positions };
}

// ─── Blofin — directe API call naar /api/v1/account/positions-history ───
async function doTradesBlofin(apiKey, apiSecret, passphrase, { startTime, action }) {
  const base = "https://openapi.blofin.com";
  const sign = (timestamp, method, path, body = "") => {
    // Blofin: prehash = path + method + timestamp + nonce + body; nonce = timestamp
    const prehash = path + method + timestamp + timestamp + body;
    const hex = crypto.createHmac("sha256", apiSecret).update(prehash).digest("hex");
    return Buffer.from(hex).toString("base64");
  };
  const callGet = async (path, query = {}) => {
    const qs = new URLSearchParams(query).toString();
    const pathWithQs = path + (qs ? "?" + qs : "");
    const timestamp = String(Date.now());
    const signature = sign(timestamp, "GET", pathWithQs);
    const url = base + pathWithQs;
    const res = await fetch(url, {
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-SIGN": signature,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-NONCE": timestamp,
        "ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (data.code && String(data.code) !== "0") throw new Error(`Blofin ${path}: ${data.msg || data.code}`);
    return data;
  };

  if (action === "test") {
    const d = await callGet("/api/v1/asset/balances", { accountType: "futures" });
    const usdt = (d.data || []).find(a => a.currency === "USDT");
    return { success: true, balance: usdt ? String(usdt.balance || usdt.equity || "0") : "0" };
  }
  if (action === "open_positions") {
    const d = await callGet("/api/v1/account/positions");
    return { positions: d.data || [] };
  }
  if (action === "fills") {
    const { symbol, startTime: st, endTime } = arguments[3] || {};
    const q = { limit: 100 };
    if (symbol) q.instId = String(symbol).replace("_", "-").replace("/", "-");
    if (st) q.begin = st;
    if (endTime) q.end = endTime;
    const d = await callGet("/api/v1/trade/fills-history", q);
    return { fills: d.data || [], total: (d.data||[]).length };
  }
  // trades: positions-history
  const d = await callGet("/api/v1/account/positions-history", { limit: 100 });
  console.log(`[blofin/trades] positions-history → ${(d.data||[]).length}`);
  if ((d.data||[]).length) console.log(`[blofin/trades] sample:`, JSON.stringify(d.data[0]).slice(0,400));
  return { source: "positions-history", trades: d.data || [] };
}

// ─── Kraken Futures specifiek: position-level trades uit account log ───
// Kraken's account log bevat entries zoals "futures trade" met realized PNL.
// Elke close-event koppelen we met z'n open-event (zelfde tradeable, omgekeerde richting)
// om entry+exit prijs te krijgen.
async function doTradesKraken(client, { startTime }) {
  const since = startTime ? Number(startTime) : Date.now() - 90 * 86400000;
  console.log(`[kraken/trades] since=${new Date(since).toISOString()}`);

  // PRIMARY: raw call naar Kraken Futures /api/history/v3/account-log
  // CCXT's history-namespace endpoints zijn niet als methode exposed,
  // dus we gebruiken client.request() met het 'history' API type.
  try {
    // Paginering: Kraken geeft max 1000 per call. Loop met "before=<oudste date>" tot buiten "since".
    const logs = [];
    let before = undefined;
    for (let page = 0; page < 20; page++) { // max 20k entries
      const params = { count: 1000 };
      if (before) params.before = before;
      const res = await client.request("account-log", "history", "GET", params);
      const batch = res?.logs || [];
      console.log(`[kraken/trades] page ${page+1} → ${batch.length} entries`);
      if (!batch.length) break;
      logs.push(...batch);
      const oldest = batch[batch.length - 1];
      const oldestTs = new Date(oldest.date || oldest.dateTime || 0).getTime();
      if (oldestTs <= since) break;
      if (batch.length < 1000) break;
      before = oldestTs; // Kraken verwacht milliseconds
    }
    console.log(`[kraken/trades] totaal → ${logs.length} entries`);
    if (logs.length) console.log(`[kraken/trades] sample:`, JSON.stringify(logs[0]).slice(0,500));

    const cleanPair = (sym) => {
      let s = (sym || "").toUpperCase().replace("PF_", "").replace("PI_", "");
      s = s.replace("XBT", "BTC");
      if (s.includes("/")) return s;
      if (s.endsWith("USDC")) return s.slice(0, -4) + "/USDC";
      if (s.endsWith("USDT")) return s.slice(0, -4) + "/USDT";
      if (s.endsWith("USD"))  return s.slice(0, -3) + "/USD";
      return s + "/USD";
    };

    // Filter alleen "futures trade" entries (niet funding/transfer/etc)
    const fills = logs.filter(e => (e.info||"").toLowerCase().includes("trade")).reverse(); // oudste eerst
    console.log(`[kraken/trades] trade-fills: ${fills.length}`);

    // Positie-lifecycle tracking: open → partial closes (=TPs) → full close.
    // Per contract volgen we de lopende positie. Elke partial close wordt 1 TP-level.
    const positions = {}; // contract -> openPosition
    const trades = [];
    const uidShort = () => Math.random().toString(36).slice(2, 10);

    const emitTrade = (pos, finalFill) => {
      const exitWeighted = pos.tps.reduce((s, tp) => s + tp.price * tp.sizeClose, 0);
      const totalClosed = pos.tps.reduce((s, tp) => s + tp.sizeClose, 0);
      const avgExit = totalClosed > 0 ? exitWeighted / totalClosed : 0;
      trades.push({
        fill_id: `kraken_${pos.contract}_${pos.openTs}`,
        pair_clean: cleanPair(pos.contract),
        symbol: pos.contract,
        direction: pos.direction,
        entry_price: String(pos.entryPrice),
        exit_price: String(avgExit),
        size: String(pos.openSize.toFixed(8)),
        pnl: String(pos.totalPnl.toFixed(4)),
        fee: Math.abs(pos.totalFee),
        fillTime: new Date(pos.openTs).toISOString(),
        status: "closed",
        // TP-niveaus die SyncJournal's TP-editor vult
        tpLevels: pos.tps.map(tp => ({
          id: uidShort(),
          price: String(tp.price),
          pct: String(((tp.sizeClose / pos.openSize) * 100).toFixed(1)),
          status: "hit",
          actualPrice: String(tp.price),
        })),
      });
    };

    for (const f of fills) {
      const contract = f.contract;
      if (!contract) continue;
      const oldBal = parseFloat(f.old_balance || 0);
      const newBal = parseFloat(f.new_balance || 0);
      const change = parseFloat(f.change || (newBal - oldBal));
      const tradePrice = parseFloat(f.trade_price || f.price || 0);
      const fee = parseFloat(f.fee || 0);
      const pnl = parseFloat(f.realized_pnl || 0);
      const ts = new Date(f.date).getTime();
      const absOld = Math.abs(oldBal), absNew = Math.abs(newBal);

      let pos = positions[contract];

      // Nieuwe positie opent
      if (absOld < 1e-9 && absNew > 1e-9) {
        positions[contract] = {
          contract,
          direction: newBal > 0 ? "long" : "short",
          openTs: ts,
          entryPrice: parseFloat(f.new_average_entry_price) || tradePrice,
          openSize: absNew,
          tps: [],
          totalPnl: 0,
          totalFee: fee,
        };
        continue;
      }

      if (!pos) continue; // close zonder open (history te kort), skip

      // Flip (long↔short): sluit oude, open nieuwe
      if (oldBal * newBal < 0) {
        pos.tps.push({ price: tradePrice, sizeClose: absOld, ts, pnl });
        pos.totalPnl += pnl;
        pos.totalFee += fee;
        emitTrade(pos, f);
        positions[contract] = {
          contract,
          direction: newBal > 0 ? "long" : "short",
          openTs: ts,
          entryPrice: parseFloat(f.new_average_entry_price) || tradePrice,
          openSize: absNew,
          tps: [],
          totalPnl: 0,
          totalFee: 0,
        };
        continue;
      }

      // Partial close (absolute size neemt af)
      if (absNew < absOld - 1e-9) {
        const closedAmt = absOld - absNew;
        pos.tps.push({ price: tradePrice, sizeClose: closedAmt, ts, pnl });
        pos.totalPnl += pnl;
        pos.totalFee += fee;
        if (absNew < 1e-9) {
          emitTrade(pos, f);
          delete positions[contract];
        }
        continue;
      }

      // Added to position (absolute size neemt toe) — herbereken avg entry + grotere openSize
      if (absNew > absOld + 1e-9) {
        pos.openSize += (absNew - absOld);
        pos.entryPrice = parseFloat(f.new_average_entry_price) || pos.entryPrice;
        pos.totalFee += fee;
      }
    }

    // Filter phantom trades: geen PnL én entry==exit = geen echte trade
    const realTrades = trades.filter(t => {
      const pnl = Math.abs(parseFloat(t.pnl));
      const entry = parseFloat(t.entry_price);
      const exit = parseFloat(t.exit_price);
      // Houd alleen: PnL merkbaar OF prijs bewoog
      return pnl > 0.01 || Math.abs(entry - exit) > 0.01;
    });
    console.log(`[kraken/trades] na positie-tracking: ${trades.length} → ${realTrades.length} (phantoms weg)`);
    return { source: "account_log", trades: realTrades };
  } catch (e) {
    console.log(`[kraken/trades] account-log faalt: ${e.message}`);
    throw new Error(`Kraken account-log onbereikbaar: ${e.message}`);
  }

  // (onbereikbare code hieronder weggehaald)
  /* eslint-disable */
  try {
    const positions = await client.fetchPositionsHistory(undefined, since, 500);
    console.log(`[kraken/trades] fetchPositionsHistory → ${positions.length} posities`);
    if (positions.length) console.log(`[kraken/trades] sample:`, JSON.stringify(positions[0]).slice(0,600));

    const cleanPair = (sym) => {
      let s = (sym || "").toUpperCase().replace("PF_", "").replace("PI_", "").split(":")[0];
      s = s.replace("XBT", "BTC");
      if (s.includes("/")) return s;
      if (s.endsWith("USDC")) return s.slice(0, -4) + "/USDC";
      if (s.endsWith("USDT")) return s.slice(0, -4) + "/USDT";
      if (s.endsWith("USD"))  return s.slice(0, -3) + "/USD";
      return s + "/USD";
    };

    const trades = positions.map(p => {
      const info = p.info || {};
      const pnl = p.realizedPnl ?? info.realizedPnl ?? info.realised_pnl ?? info.pnl ?? 0;
      const entry = p.entryPrice ?? info.entryPrice ?? info.avgEntryPrice ?? info.averageEntryPrice ?? 0;
      const exit = p.markPrice ?? info.exitPrice ?? info.avgExitPrice ?? info.closePrice ?? info.lastPrice ?? 0;
      const side = p.side || info.side || (parseFloat(info.size||0) > 0 ? "long" : "short");
      const ft = p.timestamp || info.lastUpdateTimestamp || info.closeTime || Date.now();
      return {
        fill_id: p.id || info.tradeId || `${p.symbol}_${ft}`,
        pair_clean: cleanPair(p.symbol || info.symbol || info.instrument),
        symbol: p.symbol,
        direction: String(side).toLowerCase().startsWith("long") || String(side).toLowerCase().startsWith("buy") ? "long" : "short",
        entry_price: String(entry),
        exit_price: String(exit),
        size: String(p.contracts || info.size || 0),
        pnl: String(pnl),
        fee: parseFloat(p.fee?.cost || info.fee || 0),
        fillTime: new Date(ft).toISOString(),
        status: "closed",
      };
    }).filter(t => t.pair_clean && parseFloat(t.pnl) !== 0);

    if (trades.length) return { source: "account_log", trades };
    console.log(`[kraken/trades] fetchPositionsHistory gaf 0 bruikbare posities, val terug op fetchLedger`);
  } catch (e) {
    console.log(`[kraken/trades] fetchPositionsHistory faalt: ${e.message}`);
  }

  // FALLBACK: fetchLedger
  let logs = [];
  try {
    const ledger = await client.fetchLedger(undefined, since, 2000);
    console.log(`[kraken/trades] fetchLedger → ${ledger.length} entries`);
    if (ledger.length) console.log(`[kraken/trades] sample:`, JSON.stringify(ledger[0]).slice(0,500));
    logs = ledger.map(l => ({ ...l.info, _ccxt: l }));
  } catch (e) {
    console.log(`[kraken/trades] fetchLedger faalt: ${e.message}`);
    throw new Error(`Kraken account-log onbereikbaar: ${e.message}`);
  }

  // Filter op realized PnL
  const closes = logs.filter(e => {
    const pnl = parseFloat(e.realized_pnl || e.realizedPnl || 0);
    const ts = new Date(e.date || e.dateTime || 0).getTime();
    return Math.abs(pnl) > 0.0001 && ts >= since;
  });

  // Ook de andere fills (open events) voor matching entry prices
  const fillsByContract = {};
  logs.forEach(e => {
    const c = e.contract || e.asset || "";
    if (!c) return;
    if (!fillsByContract[c]) fillsByContract[c] = [];
    fillsByContract[c].push(e);
  });

  const cleanPair = (sym) => {
    let s = (sym || "").toUpperCase().replace("PF_", "").replace("PI_", "");
    s = s.replace("XBT", "BTC");
    if (s.endsWith("USDC")) return s.slice(0, -4) + "/USDC";
    if (s.endsWith("USDT")) return s.slice(0, -4) + "/USDT";
    if (s.endsWith("USD"))  return s.slice(0, -3) + "/USD";
    return s.includes("/") ? s : s + "/USD";
  };

  const trades = closes.map(c => {
    const pnl = parseFloat(c.realized_pnl || c.realizedPnl || 0);
    const size = Math.abs(parseFloat(c.change || c.size || 0));
    const exitPrice = parseFloat(c.trade_price || c.tradePrice || c.price || 0);
    // direction: entry op contracts>0 = long, dus close met change<0 sloot een long
    const chg = parseFloat(c.change || 0);
    const direction = chg < 0 ? "long" : "short";
    // zoek recente open-fill voor entry_price (avg price van laatste pos-opbouw)
    const pool = fillsByContract[c.contract] || [];
    const newAvg = parseFloat(c.new_average_entry_price || c.newAverageEntryPrice || 0);
    const entryPrice = newAvg || pool.find(f => (f.contract===c.contract) && parseFloat(f.new_average_entry_price||0)>0 && new Date(f.date).getTime() < new Date(c.date).getTime())?.new_average_entry_price || exitPrice;
    const fillTime = c.date || c.dateTime || new Date().toISOString();
    return {
      fill_id: c.uid || c.id || `${c.contract}_${fillTime}`,
      pair_clean: cleanPair(c.contract || c.asset),
      symbol: c.contract || c.asset,
      direction,
      entry_price: String(entryPrice),
      exit_price: String(exitPrice),
      size: String(size),
      pnl: String(pnl.toFixed(4)),
      fee: parseFloat(c.fee || 0),
      fillTime,
      status: "closed",
    };
  }).filter(t => t.pair_clean && parseFloat(t.pnl) !== 0);

  return { source: "account_log", trades };
}

// ─── Main handler ───
app.post("/", async (req, res) => {
  const { exchange, action, apiKey, apiSecret } = req.body || {};
  try {
    if (!exchange || !action) throw new Error("Mist exchange of action");

    // MEXC gebruikt directe HTTP-call (CCXT ondersteunt alleen spot)
    if (exchange === "mexc") {
      const result = await doTradesMexc(apiKey, apiSecret, { ...req.body, action });
      return res.json(result);
    }
    // Blofin — directe call voor positions-history (CCXT geeft alleen orders)
    if (exchange === "blofin") {
      const result = await doTradesBlofin(apiKey, apiSecret, req.body.passphrase, { ...req.body, action });
      return res.json(result);
    }

    const client = makeClient(exchange, req.body);

    let result;
    if (action === "test")                result = await doTest(client);
    else if (action === "trades")         result = (exchange === "kraken")
                                                    ? await doTradesKraken(client, req.body)
                                                    : await doTrades(client, req.body);
    else if (action === "open_positions") result = await doOpenPositions(client);
    else if (action === "fills")          result = await doFills(client, req.body);
    else throw new Error(`Onbekende action: ${action}`);

    res.json(result);
  } catch (e) {
    console.error(`[${exchange}/${action}]`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "SyncJournal local proxy",
    usage: "POST / met { exchange, action, apiKey, apiSecret, ... }",
    supported: Object.keys(CCXT_CLASS),
  });
});

app.listen(PORT, () => {
  console.log(`SyncJournal proxy listening on http://localhost:${PORT}`);
  console.log(`Plak deze URL in SyncJournal → Instellingen → Worker URL.`);
});
