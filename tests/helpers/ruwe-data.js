// Plays back a "Ruwe gegevens downloaden" file (backlog W2, docs/w2-ruwe-data.md) in a journal page.
// The adapter calls (proxyCall for OKX/MEXC/Kraken, ExchangeAPI.blofin._direct, ExchangeAPI.hyperliquid._post)
// get the recorded answers instead of the network, so a sync runs the real adapter code over a member's data.
//
// Matching: per action, the first unused answer whose recorded request fits the live one (time fields
// ignored, they move with the clock); otherwise the next unused answer for that action. An action that was
// never recorded throws "niet vastgelegd: <actie>" and lands in window.__ruwGemist, just like a failing exchange.
const fs = require('fs');

function laad(bestand) {
  const d = typeof bestand === 'string' ? JSON.parse(fs.readFileSync(bestand, 'utf8')) : bestand;
  if (!d || d.soort !== 'syncjournal-ruwe-data' || !Array.isArray(d.aanroepen)) throw new Error('geen SyncJournal ruwe-data-bestand: ' + (typeof bestand === 'string' ? bestand : '(object)'));
  return d;
}

// opts.ctVal: {instId: contractwaarde} for OKX/Blofin — the public instrument list is not in the file
async function speelAf(p, bestand, opts) {
  const d = laad(bestand); opts = opts || {};
  // look back a year from the recording, so nothing in the file falls outside the first sync window
  const van = new Date(new Date(d.gemaakt).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  await p.evaluate(({ d, van, ctVal }) => {
    const rest = d.aanroepen.map(a => ({ ...a, gebruikt: false }));
    window.__ruwGemist = [];
    const TIJD = /time|before|after|begin|end|cursor/i;
    const past = (opgenomen, live) => Object.keys(opgenomen || {}).every(k => TIJD.test(k) || JSON.stringify(opgenomen[k]) === JSON.stringify((live || {})[k]));
    const pak = (actie, verzoek) => {
      const kand = rest.filter(a => !a.gebruikt && a.actie === actie);
      const a = kand.find(x => past(x.verzoek, verzoek)) || kand[0];
      if (!a) { window.__ruwGemist.push(actie); throw new Error('niet vastgelegd: ' + actie); }
      a.gebruikt = true;
      if (a.fout) throw new Error(a.fout);
      return JSON.parse(JSON.stringify(a.antwoord));
    };
    const ex = d.exchange;
    if (ex === 'blofin') ExchangeAPI.blofin._direct = async (k, s, pp, pad, params) => pak(pad, params);
    else if (ex === 'hyperliquid') ExchangeAPI.hyperliquid._post = async body => pak(body.type, body);
    else window.proxyCall = async pl => pak(pl.action, pl);
    if (ctVal && ExchangeAPI[ex] && '_ctvCache' in ExchangeAPI[ex]) { ExchangeAPI[ex]._ctvCache = { ...ctVal }; ExchangeAPI[ex]._ctvCacheTs = Date.now(); }
    CONNS[ex] = { connected: true, apiKey: 'nep', apiSecret: 'nep', passphrase: 'nep', wallet: '0x' + '0'.repeat(40), hint: 'nep', lastSync: 0, syncFrom: van };
    persistConns();
  }, { d, van, ctVal: opts.ctVal || null });
  return d;
}

module.exports = { laad, speelAf };
