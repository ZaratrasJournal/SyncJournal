// B3: telt dezelfde positie dubbel als hij via een CSV-import én via de API-sync binnenkomt?
// De import ontdubbelt op het bron-id, en een CSV-rij heeft een ander id dan dezelfde trade via de API
// (<exchange>_csv_<vingerafdruk> tegenover het id van de adapter). Daardoor verdubbelde je P&L zonder melding.
//
// Per exchange met een API-koppeling die rijen kan overlappen (Blofin, OKX, Hyperliquid) en in beide
// volgordes. De API wordt nagebootst op de laag waar de adapter praat (Blofin _direct, OKX proxyCall,
// Hyperliquid _post), zodat de echte adapter de respons verwerkt, zoals bij een echte sync.
//   A  eerst CSV, dan sync: één rij, die van de API; je notitie, tags en screenshot van de CSV-rij gaan mee,
//      de CSV-rij is weg en staat niet in de prullenbak
//   B  eerst sync, dan CSV: de CSV-rij komt er niet bij
//   C  een CSV in een andere tijdzone (OKX en Hyperliquid schrijven lokale tijd, Blofin UTC): toch één rij
//   D  een andere positie (zelfde pair, richting, prijs en grootte, een dag later) blijft een eigen rij
//   E  ligt de API-rij in de prullenbak, dan komt de CSV-rij er ook niet bij (verwijderd blijft verwijderd)
// Kraken staat hier niet in: CSV en API geven daar hetzelfde id, en met een koppeling weigert de app de
// Kraken-CSV (tests/kraken-csv-api.spec.js). MEXC (geen sync meer) en FTMO (geen API) kunnen niet dubbel.
//
// Draai: node tests/csv-api-dubbel.spec.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const lees = f => fs.readFileSync(path.join('tests', 'fixtures-csv', f), 'utf8');
const DAG = 864e5;

// De positie die in de CSV én bij de API staat; de tweede positie in elk bestand staat alleen in de CSV.
// Tijden in UTC; de spec draait in Europe/Amsterdam (UTC+2 in september).
const EX = {
  blofin: { csv: lees('blofin-orderhistorie.csv'), pair: 'BTC/USDT', dir: 'long', anderePair: 'ETH/USDT',
    // Blofin's orderhistorie staat in UTC (minuten), de API heeft milliseconden
    api: dag => [{ positionId: '9000000000001', instId: 'BTC-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'long',
      closePositions: '0.01', maxPositions: '0.01', liquidationPositions: '0', openAveragePrice: '60000', closeAveragePrice: '60750',
      createTime: String(Date.UTC(2026, 8, 3, 8, 15, 23, 456) + dag * DAG), updateTime: String(Date.UTC(2026, 8, 3, 11, 30, 41, 120) + dag * DAG),
      leverage: '10', realizedPnl: '6.78', fee: '0.72' }] },
  okx: { csv: lees('okx-positiehistorie.csv'), pair: 'BTC/USDT', dir: 'short', anderePair: 'ETH/USDT', tzVrij: true,
    // de CSV-tijd 09:00 is lokale tijd (Amsterdam) = 07:00 UTC
    api: dag => [{ instId: 'BTC-USDT-SWAP', posId: '5000000000001', posSide: 'short', direction: 'short', mgnMode: 'cross', lever: '10', settleCcy: 'USDT', type: '2',
      cTime: String(Date.UTC(2026, 8, 8, 7, 0, 0, 512) + dag * DAG), uTime: String(Date.UTC(2026, 8, 8, 11, 45, 0, 87) + dag * DAG),
      openAvgPx: '61000', closeAvgPx: '60500', closeTotalPos: '2', openMaxPos: '2', realizedPnl: '9.3', pnl: '10', fee: '-0.6', fundingFee: '-0.1' }] },
  hyperliquid: { csv: lees('hyperliquid-fills.csv'), pair: 'SOL/USDC', dir: 'long', anderePair: 'ETH/USDC', tzVrij: true,
    // de CSV-tijden zijn lokaal (Amsterdam): 08:00:10 = 06:00:10 UTC
    api: dag => [
      { coin: 'SOL', px: '150.00', sz: '10', side: 'B', dir: 'Open Long', startPosition: '0', closedPnl: '0', fee: '0.60', tid: 7001, oid: 8001, time: Date.UTC(2026, 8, 12, 6, 0, 10, 321) + dag * DAG },
      { coin: 'SOL', px: '153.00', sz: '4', side: 'A', dir: 'Close Long', startPosition: '10', closedPnl: '12.0', fee: '0.25', tid: 7002, oid: 8002, time: Date.UTC(2026, 8, 12, 7, 30, 0, 50) + dag * DAG },
      { coin: 'SOL', px: '154.00', sz: '6', side: 'A', dir: 'Close Long', startPosition: '6', closedPnl: '24.0', fee: '0.37', tid: 7003, oid: 8003, time: Date.UTC(2026, 8, 12, 8, 15, 45, 900) + dag * DAG }] },
};

// De "server" van elke exchange; alles wat de spec niet nadoet geeft een lege, geldige respons.
function server(arg) {
  const [ex, api] = arg; window.__API = api;
  if (ex === 'blofin') {
    ExchangeAPI.blofin._ctvCache = {}; ExchangeAPI.blofin._ctvCacheTs = Date.now();
    ExchangeAPI.blofin._direct = async (k, s, pp, pad) => /positions-history/.test(pad) ? { data: window.__API } : /asset\/balances/.test(pad) ? { data: [{ currency: 'USDT', balance: '100' }] } : { data: [] };
    CONNS.blofin = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '2026-09-01' };
  } else if (ex === 'okx') {
    ExchangeAPI.okx._ctvCache = { 'BTC-USDT-SWAP': 0.01, 'ETH-USDT-SWAP': 0.1 }; ExchangeAPI.okx._ctvCacheTs = Date.now();
    proxyCall = async q => q.action === 'trades' ? { trades: window.__API } : q.action === 'open_positions' ? { positions: [] } : q.action === 'fills' ? { fills: [] } : {};
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '2026-09-01' };
  } else {
    ExchangeAPI.hyperliquid._post = async body => body.type === 'userFillsByTime' ? window.__API.filter(f => f.time >= (body.startTime || 0) && (!body.endTime || f.time <= body.endTime))
      : body.type === 'clearinghouseState' ? { assetPositions: [], marginSummary: { accountValue: '100' } } : [];
    CONNS.hyperliquid = { connected: true, wallet: '0x0000000000000000000000000000000000000001', lastSync: 0, syncFrom: '2026-09-01' };
  }
  persistConns();
}
const rijen = (p, ex) => p.evaluate(e => T.filter(t => t.exchange === e).map(t => ({ id: t.id, srcId: t.srcId, pair: t.pair, dir: t.dir, status: t.status, pnl: +t.pnl,
  notes: t.notes || '', tags: t.tags || [], shots: (t.screenshots || []).length, gesynct: isGesynct(t) })), ex);

// de CSV met alle tijden verschoven (een export in een andere tijdzone)
const verschuif = (ex, tekst, uur) => {
  const pad = n => String(n).padStart(2, '0');
  if (ex === 'okx') return tekst.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/g, (m, y, mo, d, h, mi, s) => {
    const x = new Date(Date.UTC(+y, +mo - 1, +d, +h + uur, +mi, +s)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`; });
  return tekst.replace(/(\d{2})-(\d{2})-(\d{4}) - (\d{2}):(\d{2}):(\d{2})/g, (m, d, mo, y, h, mi, s) => {
    const x = new Date(Date.UTC(+y, +mo - 1, +d, +h + uur, +mi, +s)); return `${pad(x.getUTCDate())}-${pad(x.getUTCMonth() + 1)}-${x.getUTCFullYear()} - ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`; });
};

(async () => {
  const b = await chromium.launch(); const alleFouten = [];
  const open = async () => { const o = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam' }); await o.p.evaluate(() => setFilter('kind', 'alle')); return o; };
  const sync = (p, ex) => p.evaluate(e => syncExchange(e, { quiet: true }), ex);
  const csv = (p, ex, tekst) => p.evaluate(([e, t]) => sjImportCsvText(t, e), [ex, tekst]);

  for (const [ex, d] of Object.entries(EX)) {
    const doel = r => r.filter(x => x.pair === d.pair && x.dir === d.dir);

    console.log(`─── ${ex}: A · eerst CSV, dan de sync ───`);
    { const { ctx, p, errs } = await open();
      await p.evaluate(server, [ex, d.api(0)]);
      ok(`${ex} A: CSV leest 2 trades in`, await csv(p, ex, d.csv) === 2);
      // je invoer op de CSV-rij, vóór de koppeling hem ook levert
      await p.evaluate(([e, pr, di]) => { const t = T.find(x => x.exchange === e && x.pair === pr && x.dir === di);
        t.notes = 'mijn notitie'; t.tags = ['A+ setup']; t.screenshots = ['data:image/png;base64,iVBORw0KGgo=']; persist(); }, [ex, d.pair, d.dir]);
      const s = await sync(p, ex);
      const r = await rijen(p, ex), dd = doel(r);
      ok(`${ex} A: de sync slaagt`, s !== -1, 's=' + s + ' ' + await p.evaluate(e => CONN_ERR[e] || '', ex));
      ok(`${ex} A: de positie staat er één keer, als rij van de koppeling`, dd.length === 1 && dd[0].gesynct, JSON.stringify(dd));
      ok(`${ex} A: notitie, tag en screenshot van de CSV-rij zijn meegegaan`, dd.length === 1 && dd[0].notes === 'mijn notitie' && dd[0].tags.includes('A+ setup') && dd[0].shots === 1, JSON.stringify(dd));
      ok(`${ex} A: de CSV-rij staat niet in de prullenbak`, await p.evaluate(() => !TRASH.some(t => /_csv_/.test(String(t.srcId || '')))));
      ok(`${ex} A: de positie die alleen in de CSV staat blijft`, r.filter(x => x.pair === d.anderePair).length === 1, JSON.stringify(r));
      ok(`${ex} A: nog een sync verandert niets`, (await sync(p, ex)) !== -1 && (await rijen(p, ex)).length === r.length);
      alleFouten.push(...errs); await ctx.close(); }

    console.log(`─── ${ex}: B · eerst de sync, dan CSV ───`);
    { const { ctx, p, errs } = await open();
      await p.evaluate(server, [ex, d.api(0)]);
      await sync(p, ex);
      const voor = await rijen(p, ex);
      ok(`${ex} B: de sync levert de positie`, doel(voor).length === 1, JSON.stringify(voor));
      const n = await csv(p, ex, d.csv);
      const r = await rijen(p, ex);
      ok(`${ex} B: de CSV voegt alleen de andere positie toe`, n === 1 && doel(r).length === 1 && r.filter(x => x.pair === d.anderePair).length === 1, 'n=' + n + ' ' + JSON.stringify(r));
      ok(`${ex} B: nog een keer inlezen voegt niets toe`, await csv(p, ex, d.csv) === 0 && (await rijen(p, ex)).length === r.length);
      alleFouten.push(...errs); await ctx.close(); }

    if (d.tzVrij) {
      console.log(`─── ${ex}: C · CSV in een andere tijdzone ───`);
      for (const uur of [6, -2]) {
        const { ctx, p, errs } = await open();
        await p.evaluate(server, [ex, d.api(0)]);
        await csv(p, ex, verschuif(ex, d.csv, uur));
        await sync(p, ex);
        const r = await rijen(p, ex);
        ok(`${ex} C: CSV ${uur > 0 ? '+' : ''}${uur} uur verschoven, toch één rij`, doel(r).length === 1 && doel(r)[0].gesynct, JSON.stringify(doel(r)));
        alleFouten.push(...errs); await ctx.close();
      }
    }

    console.log(`─── ${ex}: D · een andere positie blijft een eigen rij ───`);
    { const { ctx, p, errs } = await open();
      await p.evaluate(server, [ex, d.api(1)]);   // zelfde pair, richting, prijzen en grootte, een dag later
      await csv(p, ex, d.csv); await sync(p, ex);
      const r = await rijen(p, ex);
      ok(`${ex} D: CSV-positie en API-positie van een dag later staan er allebei`, doel(r).length === 2, JSON.stringify(doel(r)));
      alleFouten.push(...errs); await ctx.close(); }

    console.log(`─── ${ex}: E · API-rij in de prullenbak ───`);
    { const { ctx, p, errs } = await open();
      await p.evaluate(server, [ex, d.api(0)]);
      await sync(p, ex);
      await p.evaluate(([e, pr, di]) => delTrade(T.find(x => x.exchange === e && x.pair === pr && x.dir === di).id), [ex, d.pair, d.dir]);
      await csv(p, ex, d.csv);
      const r = await rijen(p, ex);
      ok(`${ex} E: de weggegooide positie komt niet terug via de CSV`, doel(r).length === 0 && r.filter(x => x.pair === d.anderePair).length === 1, JSON.stringify(r));
      alleFouten.push(...errs); await ctx.close(); }
  }

  console.log('─── Grensgevallen van de vergelijking ───');
  { const { ctx, p, errs } = await open();
    const r = await p.evaluate(() => {
      const H = 36e5, o = Date.UTC(2026, 8, 8, 7, 0, 0), c = o + 4 * H;
      const api = { pair: 'BTC/USDT', dir: 'short', entry: 61000, exit: 60500, qtyAsset: 0.02, openTime: String(o), closeTime: String(c) };
      const csv = x => ({ ...api, openTime: String(o + 30e3), closeTime: String(c + 30e3), ...x });
      const zz = { marge: 120e3, tijdzoneOnbekend: true }, vast = { marge: 120e3 };
      return {
        gelijk: zelfdeRondgang(csv({}), api, vast),
        alleenOpenVerschoven: zelfdeRondgang(csv({ openTime: String(o + H) }), api, zz),
        beideVerschoven: zelfdeRondgang(csv({ openTime: String(o + 2 * H), closeTime: String(c + 2 * H) }), api, zz),
        vastVerschoven: zelfdeRondgang(csv({ openTime: String(o + 2 * H), closeTime: String(c + 2 * H) }), api, vast),
        halfUur: zelfdeRondgang(csv({ openTime: String(o + 20 * 60e3), closeTime: String(c + 20 * 60e3) }), api, zz),
        andereGrootte: zelfdeRondgang(csv({ qtyAsset: 0.03 }), api, zz),
        anderePrijs: zelfdeRondgang(csv({ entry: 61200 }), api, zz),
        andereRichting: zelfdeRondgang(csv({ dir: 'long' }), api, zz),
        zonderTijd: zelfdeRondgang(csv({ openTime: '', date: '', time: '' }), api, zz),
      };
    });
    ok('vergelijking: zelfde positie, 30 s verschil → één', r.gelijk, JSON.stringify(r));
    ok('vergelijking: alleen de opening een uur anders → niet dezelfde', !r.alleenOpenVerschoven, JSON.stringify(r));
    ok('vergelijking: open én sluiting 2 uur verschoven → dezelfde bij onbekende tijdzone, niet bij een vaste', r.beideVerschoven && !r.vastVerschoven, JSON.stringify(r));
    ok('vergelijking: 20 minuten verschoven is geen tijdzone → niet dezelfde', !r.halfUur, JSON.stringify(r));
    ok('vergelijking: andere grootte, prijs of richting → niet dezelfde', !r.andereGrootte && !r.anderePrijs && !r.andereRichting, JSON.stringify(r));
    ok('vergelijking: zonder tijd geen match (liever dubbel dan een echte trade kwijt)', !r.zonderTijd, JSON.stringify(r));
    alleFouten.push(...errs); await ctx.close(); }

  ok('geen JS-fouten', alleFouten.length === 0, [...new Set(alleFouten)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== CSV + API dubbel (B3): ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
