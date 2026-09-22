// Brede testronde (Denny 22-09-2026): één journal met álle bronnen naast elkaar —
// OKX, Hyperliquid, Blofin, Kraken (levensloop én oud pad), CSV en handmatig — en dan de
// hele app aflopen. Geen losse feature-toets maar samenhang: kloppen de totalen overal
// hetzelfde, overleeft alles een back-up, en blijft het staan onder filters en valuta.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.01 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const DAG = 864e5, UUR = 36e5;

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  // de spec blokkeert alle https-verzoeken; die meldingen komen van de blokkade, niet van de app
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(t)) errs.push('console: ' + t.slice(0, 120)); });
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  console.log('─── Een journal met alle bronnen door elkaar ───');
  const opzet = await p.evaluate(([DAG, UUR]) => {
    const nu = Date.now();
    ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-04APR31': 0.0001 }; ExchangeAPI.okx._ctvCacheTs = nu;
    ExchangeAPI.blofin._ctvCache = {}; ExchangeAPI.blofin._ctvCacheTs = nu;
    T = []; TRASH = []; persist();

    // ── 1. OKX: één positie in stappen, via de echte sync-weg ──
    const okxOpen = nu - 6 * DAG, okxDicht = nu - 5 * DAG;
    const okxFill = (ts, side, sz, px, fee, sub, pnl) => ({ instId: 'BTC-USD_UM_XPERP-04APR31', posSide: 'short',
      tradeId: 'k' + ts, ordId: 'o' + ts, ts: String(ts), fillTime: String(ts), side, subType: sub,
      fillSz: String(sz), fillPx: String(px), fee: String(-fee), fillPnl: String(pnl || 0) });
    window.__P = {
      okxHist: [{ instId: 'BTC-USD_UM_XPERP-04APR31', posId: '900', posSide: 'short', direction: 'short', settleCcy: 'USDC', type: '2',
        cTime: String(okxOpen), uTime: String(okxDicht), openAvgPx: '81000', closeAvgPx: '80500', closeTotalPos: '51',
        openMaxPos: '51', realizedPnl: '2.3', fee: '-0.4', fundingFee: '0' }],   // netto = 2,70 bruto − 0,40 fees
      okxFills: [okxFill(okxOpen + 1000, 'sell', 38, 81000, 0.15, '4'), okxFill(okxOpen + 2000, 'sell', 13, 81000, 0.05, '4'),
        okxFill(okxDicht - UUR, 'buy', 25, 80600, 0.1, '6', 1.0), okxFill(okxDicht, 'buy', 26, 80400, 0.1, '6', 1.7)],
      blofin: [{ historyId: '1', positionId: '800', instId: 'ETH-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net',
        closePositions: '1.5', maxPositions: '1.5', liquidationPositions: '0', openAveragePrice: '3000', closeAveragePrice: '3040',
        createTime: String(nu - 4 * DAG), updateTime: String(nu - 3 * DAG), leverage: '10', realizedPnl: '58', fee: '2', side: 'buy' }],   // realizedPnl is netto: 60 bruto − 2 fees
      blofinFills: [
        { instId: 'ETH-USDT', tradeId: 'b1', orderId: 'ob1', fillPrice: '3000', fillSize: '1.5', fillPnl: '0', positionSide: 'net', side: 'buy', fee: '1', ts: String(nu - 4 * DAG + 1000) },
        { instId: 'ETH-USDT', tradeId: 'b2', orderId: 'ob2', fillPrice: '3040', fillSize: '1.5', fillPnl: '60', positionSide: 'net', side: 'sell', fee: '1', ts: String(nu - 3 * DAG) }],
      krakenEvents: [1, 2, 3].map((n, i) => {
        const standen = [[0, 0.01], [0.01, 0.004], [0.004, 0]][i];
        const ts = nu - 2 * DAG + i * UUR;
        return { uid: 'ku' + n, timestamp: ts, event: { PositionUpdate: { tradeable: 'PF_XBTUSD',
          oldPosition: String(standen[0]), newPosition: String(standen[1]), newAverageEntryPrice: '80000', fillTime: ts,
          fee: '0.2', realizedPnL: String(i === 0 ? 0 : i === 1 ? 4 : 3), realizedFunding: i === 1 ? '-0.05' : '0',
          positionChange: i === 0 ? 'open' : i === 2 ? 'close' : 'decrease', executionUid: 'ke' + n,
          executionPrice: String([80000, 80700, 80500][i]), executionSize: String(Math.abs(standen[1] - standen[0])),
          tradeType: 'userExecution', timestamp: ts, updateReason: 'trade' } } };
      }),
      hlFills: (() => {
        const t0 = nu - 8 * DAG;
        const mk = (ts, dir, sz, px, fee, pnl, sp, tid) => ({ coin: 'SOL', dir, side: /Open Long|Close Short/.test(dir) ? 'B' : 'A',
          startPosition: String(sp), px: String(px), sz: String(sz), fee: String(fee), closedPnl: String(pnl), time: ts, tid });
        return [mk(t0, 'Open Long', 10, 150, 0.06, 0, 0, 1), mk(t0 + UUR, 'Close Long', 4, 155, 0.03, 20, 10, 2), mk(t0 + 2 * UUR, 'Close Long', 6, 160, 0.04, 60, 6, 3)];
      })(),
    };
    // proxy + directe koppelingen nabootsen
    window.fetch = async (url, init) => {
      const P = window.__P, body = JSON.parse(init.body || '{}');
      const antw = d => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });
      if (body.exchange === 'okx') {
        if (body.action === 'trades') return antw({ source: 'positions-history', trades: P.okxHist });
        if (body.action === 'fills') return antw({ fills: P.okxFills.filter(f => +f.ts >= +body.startTime && +f.ts <= +body.endTime) });
        if (body.action === 'test') return antw({ success: true, balance: '500' });
        return antw({ positions: [] });
      }
      if (body.exchange === 'kraken') {
        if (body.action === 'trades') return antw({ source: 'position_updates', trades: [], events: P.krakenEvents });
        if (body.action === 'test') return antw({ success: true, balance: '300' });
        return antw({ positions: [] });
      }
      return antw({});
    };
    ExchangeAPI.blofin._direct = async (k, s, pp, pad, params) => {
      const P = window.__P;
      if (/positions-history/.test(pad)) return { data: P.blofin };
      if (/fills-history/.test(pad)) return { data: P.blofinFills.filter(x => (!params.begin || +x.ts >= +params.begin) && (!params.end || +x.ts <= +params.end)) };
      if (/asset\/balances/.test(pad)) return { data: [{ currency: 'USDT', balance: '400' }] };
      return { data: [] };
    };
    ExchangeAPI.hyperliquid._post = async body => {
      const P = window.__P;
      if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '200' }, assetPositions: [] };
      if (body.type === 'spotClearinghouseState') return { balances: [] };
      if (body.type === 'userFillsByTime') return P.hlFills.filter(f => f.time >= body.startTime && (!body.endTime || f.time <= body.endTime));
      return [];
    };
    CONNS = { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' },
      blofin: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' },
      kraken: { connected: true, apiKey: 'k', apiSecret: 's', lastSync: 0, syncFrom: '' },
      hyperliquid: { connected: true, wallet: '0x' + 'a'.repeat(40), lastSync: 0, syncFrom: '' } };
    persistConns();
    return { nu };
  }, [DAG, UUR]);

  const gesynct = await p.evaluate(async () => {
    const uit = {};
    for (const ex of ['okx', 'blofin', 'kraken', 'hyperliquid']) uit[ex] = await syncExchange(ex, { quiet: true });
    return uit;
  });
  ok('alle vier de koppelingen leveren elk één positie', Object.values(gesynct).every(n => n === 1), JSON.stringify(gesynct));

  // handmatige trade + CSV erbij
  await p.evaluate(nu => {
    T.push({ id: nextId(), exchange: 'manual', srcId: '', pair: 'XAU/USD', dir: 'long', status: 'closed', kind: 'live',
      date: new Date(nu - 7 * 864e5).toISOString().slice(0, 10), time: '09:30', openTime: String(nu - 7 * 864e5), closeTime: String(nu - 7 * 864e5 + 2 * 36e5),
      entry: 2400, exit: 2430, stop: 2380, pnl: 30, r: 1.5, size: '2400', fees: 1, notes: 'handmatig ingevoerd',
      tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: nu - 7 * 864e5 + 36e5 }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }],
      tags: ['breakout'], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    persist(); render();
  }, opzet.nu);

  const stand = await p.evaluate(() => ({
    n: T.length,
    perEx: T.reduce((m, t) => { m[t.exchange] = (m[t.exchange] || 0) + 1; return m; }, {}),
    metStappen: T.filter(t => (t.fills || []).length >= 2).length,
    som: +T.reduce((s, t) => s + (+t.pnl || 0), 0).toFixed(4),
    srcIds: T.map(t => t.srcId).filter(Boolean),
  }));
  ok('vijf trades: vier gesynct + één handmatig', stand.n === 5 && stand.perEx.manual === 1, JSON.stringify(stand.perEx));
  ok('alle vier de gesyncte trades hebben hun stappen', stand.metStappen === 4, JSON.stringify(stand.metStappen));
  ok('elke gesyncte trade heeft een eigen bron-id', new Set(stand.srcIds).size === 4, JSON.stringify(stand.srcIds));

  console.log('─── Kloppen de bedragen, per bron en in totaal ───');
  const bedragen = await p.evaluate(() => T.map(t => ({ ex: t.exchange, pnl: +t.pnl, fees: +t.fees,
    stapSom: (t.fills || []).filter(f => f.pnl != null).reduce((s, f) => s + f.pnl, 0),
    stapFees: (t.fills || []).reduce((s, f) => s + (+f.fee || 0), 0) })));
  const okx = bedragen.find(x => x.ex === 'okx'), bf = bedragen.find(x => x.ex === 'blofin'),
    kr = bedragen.find(x => x.ex === 'kraken'), hl = bedragen.find(x => x.ex === 'hyperliquid');
  ok('OKX: de stappen zijn 2,70 bruto, de fees 0,40, en OKX meldt 2,30 netto',
    bij(okx.pnl, 2.3) && bij(okx.stapSom, 2.7) && bij(okx.stapFees, 0.4), JSON.stringify(okx));
  ok('Blofin: de stappen zijn 60 bruto, de fees 2, en Blofin meldt 58 netto',
    bij(bf.pnl, 58) && bij(bf.stapSom, 60) && bij(bf.stapFees, 2), JSON.stringify(bf));
  ok('Kraken: 7 bruto − 0,60 fees − 0,05 funding = 6,35', bij(kr.pnl, 6.35) && bij(kr.stapSom, 7), JSON.stringify(kr));
  ok('Hyperliquid: 80 bruto − 0,13 fees = 79,87', bij(hl.pnl, 79.87) && bij(hl.stapSom, 80), JSON.stringify(hl));

  /* Bij alle vier geldt dezelfde rekensom: wat de exchange netto meldt is de som van de
     stappen minus de fees, plus de funding die in die periode is verrekend. Alleen de
     Kraken-positie hierboven dráágt funding (−0,05). */
  const FUNDING = { okx: 0, blofin: 0, hyperliquid: 0, kraken: -0.05 };
  const sluit = bedragen.filter(x => x.ex !== 'manual')
    .map(x => ({ ex: x.ex, rest: +(x.stapSom - x.stapFees + FUNDING[x.ex] - x.pnl).toFixed(4) }));
  ok('bij elke exchange geldt: netto = som van de stappen − fees + funding',
    sluit.every(x => Math.abs(x.rest) < 0.005), JSON.stringify(sluit));

  console.log('─── Loopt de hele app zonder fouten, met deze data ───');
  const paginas = await p.evaluate(async () => {
    const uit = {};
    for (const pg of Object.keys(PAGES)) {
      try { go(pg); await new Promise(r => setTimeout(r, 120)); const m = document.getElementById('main');
        uit[pg] = { ok: !!m && m.innerHTML.length > 200, tekst: (m.textContent || '').length };
      } catch (e) { uit[pg] = { ok: false, fout: e.message }; }
    }
    go('trades'); return uit;
  });
  ok('elke pagina tekent zichzelf', Object.values(paginas).every(x => x.ok), JSON.stringify(Object.entries(paginas).filter(([, x]) => !x.ok)));

  console.log('─── Tellen de overzichten hetzelfde ───');
  const totalen = await p.evaluate(() => {
    go('trades');
    const tabel = [...document.querySelectorAll('tfoot .num')].map(x => x.textContent.trim());
    const som = T.filter(t => t.status !== 'open').reduce((s, t) => s + (+t.pnl || 0), 0);
    const ag = aggOf(CLOSED);
    return { som: +som.toFixed(4), agNet: +ag.net.toFixed(4), agN: ag.n != null ? ag.n : CLOSED.length, closed: CLOSED.length, tabel };
  });
  ok('de som van de trades is die van de analytics-aggregatie', bij(totalen.som, totalen.agNet), JSON.stringify(totalen));
  ok('en alle vijf tellen mee als gesloten', totalen.closed === 5, JSON.stringify(totalen.closed));

  console.log('─── Filters, valuta en sortering laten de cijfers heel ───');
  const filt = await p.evaluate(() => {
    const alles = CLOSED.reduce((s, t) => s + t.pnl, 0);
    setFilter('exchange', 'okx'); const naFilter = CLOSED.reduce((s, t) => s + t.pnl, 0); const nF = CLOSED.length;
    clearGFilter(); render();
    const terug = CLOSED.reduce((s, t) => s + t.pnl, 0);
    return { alles: +alles.toFixed(4), naFilter: +naFilter.toFixed(4), nF, terug: +terug.toFixed(4) };
  });
  ok('een filter op OKX laat één trade over en herstelt daarna volledig',
    filt.nF === 1 && bij(filt.naFilter, 2.3) && bij(filt.alles, filt.terug), JSON.stringify(filt));

  const valuta = await p.evaluate(() => {
    const pctVoor = pnlPctTotal(CLOSED, CLOSED.reduce((s, t) => s + t.pnl, 0));
    FX.rates['2026-01-01'] = 0.9; FX.latest = 0.9; FX.latestDate = '2026-01-01'; FX.ts = Date.now();
    STATE.currency = 'EUR'; render();
    const euroSom = CLOSED.reduce((s, t) => s + t.pnl, 0);
    const pctNa = pnlPctTotal(CLOSED, euroSom);
    STATE.currency = 'USD'; render();
    const dollarSom = CLOSED.reduce((s, t) => s + t.pnl, 0);
    return { pctVoor, pctNa, euroSom: +euroSom.toFixed(2), dollarSom: +dollarSom.toFixed(2) };
  });
  ok('in euro’s staan er andere bedragen', valuta.euroSom !== valuta.dollarSom, JSON.stringify(valuta));
  ok('maar het rendementspercentage verschuift niet mee', bij(valuta.pctVoor, valuta.pctNa, 0.001), JSON.stringify(valuta));

  const sortering = await p.evaluate(() => {
    STATE.sortCol = 'date'; STATE.sortDir = -1; render();
    const momenten = [...document.querySelectorAll('td[data-l="Datum"]')].map((c, i) => i);
    const rijen = FT.slice().sort((a, b) => tradeMoment(b) - tradeMoment(a)).map(t => t.exchange);
    return { n: momenten.length, verwacht: rijen };
  });
  ok('de lijst staat op moment gesorteerd, nieuwste eerst', sortering.n === 5 && sortering.verwacht[0] === 'kraken', JSON.stringify(sortering.verwacht));

  console.log('─── Het formulier: gesynct op slot, handmatig open ───');
  const form = await p.evaluate(() => {
    const kijk = id => { openForm(id); const ro = k => { const el = document.getElementById('f_' + k); return el ? el.hasAttribute('readonly') : null; };
      const r = { entry: ro('entry'), pnl: ro('pnl'), tp: !!document.getElementById('tpbuilder'), stappen: !!document.querySelector('.exwrap table') }; closeForm(); return r; };
    const g = T.find(t => t.exchange === 'kraken'), h = T.find(t => t.exchange === 'manual');
    return { gesynct: kijk(g.id), handmatig: kijk(h.id) };
  });
  ok('een gesyncte trade: velden op slot, stappentabel, geen TP-bouwer',
    form.gesynct.entry && form.gesynct.pnl && form.gesynct.stappen && !form.gesynct.tp, JSON.stringify(form.gesynct));
  ok('een handmatige trade: alles bewerkbaar, TP-bouwer, geen stappentabel',
    !form.handmatig.entry && !form.handmatig.pnl && form.handmatig.tp && !form.handmatig.stappen, JSON.stringify(form.handmatig));

  console.log('─── Back-up eruit en op een vers profiel weer erin ───');
  const backup = await p.evaluate(() => snapshotPayload());
  await ctx.close();
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push('vers: ' + String(e).split('\n')[0]));
  p2.on('dialog', d => d.accept());
  await p2.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p2.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p2.goto(APP, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1300);
  const na = await p2.evaluate(async d => {
    await applyBackup(d); await new Promise(r => setTimeout(r, 1500));
    const fouten = [];
    for (const t of T) { try { openForm(t.id); closeForm(); } catch (e) { fouten.push(t.id + ': ' + e.message); } }
    for (const pg of Object.keys(PAGES)) { try { go(pg); } catch (e) { fouten.push(pg + ': ' + e.message); } }
    go('trades');
    return { n: T.length, som: +T.reduce((s, t) => s + (+t.pnl || 0), 0).toFixed(4),
      stappen: T.filter(t => (t.fills || []).length >= 2).length, schema: DB.load('schema', 0), fouten };
  }, backup);
  ok('alle vijf trades en hun stappen overleven de back-up', na.n === 5 && na.stappen === 4, JSON.stringify(na));
  ok('en de bedragen zijn tot op de cent hetzelfde', bij(na.som, stand.som), `${na.som} vs ${stand.som}`);
  ok('elke trade opent, elke pagina tekent', na.fouten.length === 0, JSON.stringify(na.fouten));

  console.log('─── Prullenbak en herstel ───');
  const trash = await p2.evaluate(async () => {
    const t = T.find(x => x.exchange === 'okx'); const voor = T.length;
    trashDelete([t.id]); const na = T.length; const inBak = TRASH.length;
    trashRestore([t.id]); const terug = T.length;
    const her = T.find(x => x.exchange === 'okx');
    return { voor, na, inBak, terug, stappen: (her && her.fills || []).length };
  });
  ok('verwijderen en terugzetten laat de trade compleet', trash.na === trash.voor - 1 && trash.terug === trash.voor && trash.stappen === 4, JSON.stringify(trash));

  ok('geen JS-errors in de hele ronde', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));
  console.log(`\n=== Brede integratie: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
