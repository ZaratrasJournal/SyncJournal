// W2: raw exchange data, recorded in dev mode only (?dev=1), downloadable per exchange from the
// diagnose panel, without keys, wallet, account numbers or balance. Never in localStorage, IndexedDB or a
// back-up: only in memory of the tab. The download plays back through tests/helpers/ruwe-data.js.
// The fake exchanges below answer with keys, a wallet, uids and balances on purpose.
const { chromium } = require('playwright'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { execFileSync } = require('child_process');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const EX = ['okx', 'blofin', 'hyperliquid', 'kraken'];
const WALLET = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const GEHEIM = { okx: ['OKXKEY-geheim-111111', 'OKXSECRET-geheim-222222', 'OKXPASS-geheim-333'], blofin: ['BFKEY-geheim-444444', 'BFSECRET-geheim-555555', 'BFPASS-geheim-666'],
  kraken: ['KRKEY-geheim-777777', 'KRSECRET-geheim-888888'], hyperliquid: [WALLET] };
const ACCOUNT = ['OKXUID-99887766', 'subgeheim-01', 'ACCT-424242', 'BFUID-1234567'];
const SALDO = ['98765.43', '11111.11', '22222.22', '33333.33', '44444.44', '40404.04', '55555.55', '50505.05', '66666.66', '77777.77', '12121.21', '13131.31'];
// stays in the file: trades, prices, order/position ids (and Kraken's uid, which is an event/order id there)
const BLIJFT = { okx: ['RUWSPOOR-OKX', '"900"', '84913.84'], blofin: ['RUWSPOOR-BLOFIN', '"800"', '3040'], hyperliquid: ['RUWSPOOR-HL', '"tid":2', '"155"'], kraken: ['RUWSPOOR-KRAKEN', 'ek2', '"uid":"k2"', '80700'] };
const SLEUTELNAAM = /apikey|apisecret|secret|passphrase|wallet|balance|equity|^(uid|user|address|accountid|subacct|availbal|cashbal|availeq|totaleq|eq|accountvalue|withdrawable|totalrawusd|marginsummary)$/;

// Fake exchanges at the fetch level, so the real proxyCall / _direct / _post run (and record).
function nepExchanges(a) {
  const { WALLET, GEHEIM } = a; const NU = Date.now(), UUR = 36e5, DAG = 864e5, T0 = NU - 2 * DAG, T1 = T0 + 2 * UUR, T2 = T0 + 5 * UUR;
  const okxInst = 'BTC-USDT-SWAP';
  const okx = { trades: { source: 'positions-history', _spoor: 'RUWSPOOR-OKX', echo: 'verzoek met ' + GEHEIM.okx[0], meta: { account: { accountId: 'ACCT-424242', apiKey: GEHEIM.okx[0] } },
      trades: [{ instId: okxInst, posId: '900', posSide: 'short', direction: 'short', settleCcy: 'USDT', type: '2', cTime: String(T0), uTime: String(T2), openAvgPx: '86415', closeAvgPx: '84913.84',
        closeTotalPos: '25', openMaxPos: '25', realizedPnl: '3.4562', fee: '-0.1', fundingFee: '0', uid: 'OKXUID-99887766', subAcct: 'subgeheim-01' }] },
    open_positions: { positions: [] }, fills: { fills: [] },
    test: { success: true, balance: '98765.43', totalEq: '98765.43', details: [{ ccy: 'USDT', availBal: '11111.11', cashBal: '22222.22', eq: '33333.33' }] } };
  const kraken = { trades: { source: 'position_updates', _spoor: 'RUWSPOOR-KRAKEN', trades: [], events: [
      { uid: 'k1', timestamp: T0, event: { PositionUpdate: { tradeable: 'PF_XBTUSD', oldPosition: '0', newPosition: '0.01', newAverageEntryPrice: '80000', fillTime: T0, fee: '0.2', realizedPnL: '0', realizedFunding: '0', positionChange: 'open', executionUid: 'ek1', executionPrice: '80000', executionSize: '0.01', tradeType: 'userExecution', timestamp: T0, updateReason: 'trade' } } },
      { uid: 'k2', timestamp: T1, event: { PositionUpdate: { tradeable: 'PF_XBTUSD', oldPosition: '0.01', newPosition: '0', newAverageEntryPrice: '80000', fillTime: T1, fee: '0.2', realizedPnL: '7', realizedFunding: '0', positionChange: 'close', executionUid: 'ek2', executionPrice: '80700', executionSize: '0.01', tradeType: 'userExecution', timestamp: T1, updateReason: 'trade' } } }] },
    open_positions: { positions: [] }, test: { success: true, balance: '77777.77' },
    account_log: { logs: [{ booking_uid: 'bk1', date: new Date(T1).toISOString(), info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: '12121.21', new_balance: '13131.31', realized_pnl: '7', fee: '0.2', execution: 'ek2', account_uid: 'ACCT-424242' }] } };
  const blofin = { '/api/v1/account/positions-history': { code: '0', _spoor: 'RUWSPOOR-BLOFIN', data: [{ historyId: '1', positionId: '800', instId: 'ETH-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net', side: 'buy',
      closePositions: '2', maxPositions: '2', openAveragePrice: '3000', closeAveragePrice: '3040', createTime: String(T0), updateTime: String(T2), leverage: '10', realizedPnl: '79', fee: '1', uid: 'BFUID-1234567' }] },
    '/api/v1/account/positions': { code: '0', data: [] }, '/api/v1/account/fills-history': { code: '0', data: [] },
    '/api/v1/asset/balances': { code: '0', data: [{ currency: 'USDT', equity: '44444.44', balance: '44444.44', available: '40404.04', frozen: '0' }] } };
  const hlFill = (t, dir, sz, px, sp, pnl, tid) => ({ coin: 'SOL', dir, side: /Open Long/.test(dir) ? 'B' : 'A', startPosition: String(sp), px: String(px), sz: String(sz), fee: '0.02', closedPnl: String(pnl), time: t, tid, oid: 100 + tid, hash: '0xhash' + tid });
  const hl = { userFillsByTime: [hlFill(T0, 'Open Long', 10, 150, 0, 0, 1), hlFill(T1, 'Close Long', 10, 155, 10, 50, 2)],
    clearinghouseState: { _spoor: 'RUWSPOOR-HL', marginSummary: { accountValue: '55555.55', totalRawUsd: '55555.55' }, crossMarginSummary: { accountValue: '55555.55' }, withdrawable: '50505.05', assetPositions: [], echo: WALLET.toLowerCase() },
    spotClearinghouseState: { balances: [{ coin: 'USDC', total: '66666.66', hold: '0' }] }, historicalOrders: [], frontendOpenOrders: [] };
  const ant = d => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
  window.fetch = async (u, init) => {
    u = String(u); const body = (() => { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } })();
    if (/workers\.dev/.test(u)) { const s = body.exchange === 'okx' ? okx : body.exchange === 'kraken' ? kraken : {}; return ant(s[body.action] || {}); }
    if (/openapi\.blofin\.com/.test(u)) { const pad = new URL(u).pathname; return ant(blofin[pad] || { code: '0', data: [] }); }
    if (/api\.hyperliquid\.xyz/.test(u)) return ant(body.type in hl ? hl[body.type] : []);
    return ant({ data: [] });
  };
  CONNS = { okx: { connected: true, apiKey: GEHEIM.okx[0], apiSecret: GEHEIM.okx[1], passphrase: GEHEIM.okx[2], hint: '1111', lastSync: 0, syncFrom: '' },
    blofin: { connected: true, apiKey: GEHEIM.blofin[0], apiSecret: GEHEIM.blofin[1], passphrase: GEHEIM.blofin[2], hint: '4444', lastSync: 0, syncFrom: '' },
    hyperliquid: { connected: true, wallet: WALLET, hint: 'Ef01', lastSync: 0, syncFrom: '' },
    kraken: { connected: true, apiKey: GEHEIM.kraken[0], apiSecret: GEHEIM.kraken[1], hint: '7777', lastSync: 0, syncFrom: '' } };
  persistConns();
}
const syncAlle = p => p.evaluate(async ex => { const n = {}; for (const e of ex) n[e] = await syncExchange(e, { quiet: true }); return n; }, EX);
const devBlok = p => p.evaluate(() => { go('instellingen'); setSetTab('data'); const el = document.getElementById('ruwPanel'); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
const sleutels = (v, uit) => { if (Array.isArray(v)) v.forEach(x => sleutels(x, uit)); else if (v && typeof v === 'object') Object.keys(v).forEach(k => { uit.push(k); sleutels(v[k], uit); }); return uit; };
// everything the page keeps: localStorage, every IndexedDB store, the back-up and the diagnose report
const opslag = p => p.evaluate(async () => {
  const ls = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls.push(k + '=' + localStorage.getItem(k)); }
  const idb = await new Promise(res => { const r = indexedDB.open('sj_db'); r.onsuccess = () => { const db = r.result, uit = []; const namen = [...db.objectStoreNames]; if (!namen.length) return res('');
    const tx = db.transaction(namen, 'readonly'); namen.forEach(n => { const q = tx.objectStore(n).getAll(); q.onsuccess = () => uit.push(JSON.stringify(q.result)); }); tx.oncomplete = () => res(uit.join('\n')); }; r.onerror = () => res(''); });
  return { ls: ls.join('\n'), idb, backup: JSON.stringify(snapshotPayload()), diag: JSON.stringify(await diagReport()) };
});

(async () => {
  const b = await chromium.launch(); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ruw-'));

  console.log('─── Zonder ?dev=1: niets te zien, niets vastgelegd ───');
  {
    const { ctx, p, errs } = await H.openJournal(b, { http: true });
    await p.evaluate(nepExchanges, { WALLET, GEHEIM });
    const n = await syncAlle(p);
    ok('de nep-sync loopt (alle vier ≥ 0)', EX.every(e => n[e] >= 0), JSON.stringify(n));
    ok('IS_DEV staat uit', await p.evaluate(() => IS_DEV === false));
    ok('geen dev-blok in het diagnosepaneel', (await devBlok(p)) === null);
    ok('er is niets vastgelegd', await p.evaluate(() => Object.keys(RUWE_DATA).length === 0));
    ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }

  console.log('─── Met ?dev=1: per exchange een download ───');
  const { ctx, p, errs } = await H.openJournal(b, { http: true, query: '?dev=1' });
  ok('IS_DEV aan en onthouden onder sj_dev', await p.evaluate(() => IS_DEV === true && localStorage.getItem('sj_dev') === 'true'));
  const leeg = await devBlok(p);
  ok('dev-blok zonder koppelingen: zegt wat er ontbreekt', leeg !== null && /Koppel/.test(leeg), leeg);
  await p.evaluate(nepExchanges, { WALLET, GEHEIM });
  const voor = await devBlok(p);
  ok('vóór de sync: nog niets vastgelegd, knop uit', /nog niets/i.test(voor) && await p.evaluate(() => [...document.querySelectorAll('#ruwPanel button')].every(x => x.disabled)), voor);
  const n = await syncAlle(p);
  ok('de nep-sync loopt (alle vier ≥ 0)', EX.every(e => n[e] >= 0), JSON.stringify(n));
  const blok = await devBlok(p);
  ok('de eerlijke regel staat boven de knop', blok && blok.includes('Dit bestand bevat je trades (bedragen en tijden), maar geen sleutels, walletadres, accountnummer of saldo. Deel het alleen met Zaratras.'), blok);
  ok('per gekoppelde exchange een knop "Ruwe gegevens downloaden"', await p.evaluate(() => [...document.querySelectorAll('#ruwPanel button')].filter(x => /Ruwe gegevens downloaden/.test(x.textContent) && !x.disabled).length === 4));
  const origineel = await p.evaluate(ex => Object.fromEntries(ex.map(e => [e, T.filter(t => t.exchange === e).length])), EX);

  const bestanden = {};
  for (const ex of EX) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(e => document.querySelector(`#ruwPanel button[data-ex="${e}"]`).click(), ex)]);
    const f = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(f); bestanden[ex] = f;
    const tekst = fs.readFileSync(f, 'utf8'); const d = JSON.parse(tekst); const compact = JSON.stringify(d);
    console.log(`  · ${ex}: ${dl.suggestedFilename()} · ${d.aanroepen.length} aanroepen · ${tekst.length} tekens`);
    ok(`${ex}: bestandsnaam syncjournal-ruw-${ex}-<datum>.json`, new RegExp(`^syncjournal-ruw-${ex}-\\d{4}-\\d{2}-\\d{2}\\.json$`).test(dl.suggestedFilename()), dl.suggestedFilename());
    ok(`${ex}: exchange, datum, app-versie, aanroepen per actie`, d.soort === 'syncjournal-ruwe-data' && d.exchange === ex && /^\d{4}-\d{2}-\d{2}T/.test(d.gemaakt) && d.app === await p.evaluate(() => APP_VERSION) && d.aanroepen.length > 0 && d.aanroepen.every(a => a.actie && 'verzoek' in a), JSON.stringify(d).slice(0, 200));
    ok(`${ex}: trades, prijzen en id's staan erin`, BLIJFT[ex].every(s => compact.includes(s)), BLIJFT[ex].filter(s => !compact.includes(s)).join());
    const lek = [...Object.values(GEHEIM).flat(), ...ACCOUNT, ...SALDO].filter(s => tekst.toLowerCase().includes(s.toLowerCase()));
    ok(`${ex}: geen sleutel, secret, passphrase, wallet, account-id of saldo (ook niet genest of als tekst)`, lek.length === 0, lek.join());
    const namen = sleutels(d.aanroepen, []).filter(k => SLEUTELNAAM.test(k.toLowerCase().replace(/[^a-z0-9]/g, '')) && !(ex === 'kraken' && k === 'uid'));
    ok(`${ex}: geen veldnamen als apiKey/secret/wallet/uid/balance/equity`, namen.length === 0, [...new Set(namen)].join());
  }
  ok('Kraken: de uid van een gebeurtenis blijft (dat is daar een event-/order-id, geen account)', JSON.stringify(JSON.parse(fs.readFileSync(bestanden.kraken, 'utf8'))).includes('"uid":"k1"'));

  console.log('─── Alleen in het geheugen van het tabblad ───');
  const o = await opslag(p);
  const spoor = s => ['RUWSPOOR-OKX', 'RUWSPOOR-BLOFIN', 'RUWSPOOR-HL', 'RUWSPOOR-KRAKEN'].filter(x => s.includes(x));
  ok('localStorage bevat de ruwe antwoorden niet', spoor(o.ls).length === 0, spoor(o.ls).join());
  ok('IndexedDB bevat de ruwe antwoorden niet', o.idb.length > 0 && spoor(o.idb).length === 0, spoor(o.idb).join());
  ok('back-up (snapshotPayload) en diagnose-rapport ook niet', spoor(o.backup).length === 0 && spoor(o.diag).length === 0);
  await H.reload(p);
  ok('na herladen: niets meer vastgelegd, dev-modus nog aan', await p.evaluate(() => Object.keys(RUWE_DATA).length === 0 && IS_DEV === true));
  const naReload = await devBlok(p);
  ok('na herladen: knoppen uit, "nog niets" per exchange', /nog niets/i.test(naReload) && await p.evaluate(() => [...document.querySelectorAll('#ruwPanel button')].every(x => x.disabled)), naReload);

  console.log('─── Grootte begrensd ───');
  const grens = await p.evaluate(() => { const groot = { rows: Array.from({ length: 3000 }, (_, i) => ({ id: i, px: '1.2345', note: 'x'.repeat(1000) })) };
    for (let i = 0; i < 3; i++) ruwVastleggen('okx', 'trades', { action: 'trades' }, groot);
    const r = RUWE_DATA.okx; return { tekens: r.tekens, afgekapt: r.afgekapt, max: RUW_MAX_TEKENS, n: r.aanroepen.length, laatste: r.aanroepen[r.aanroepen.length - 1] }; });
  ok('boven de grens: antwoord weggelaten en geteld, totaal onder de grens', grens.tekens <= grens.max && grens.afgekapt > 0 && grens.laatste.antwoord === null && grens.laatste.afgekapt === true, JSON.stringify({ ...grens, laatste: { ...grens.laatste, antwoord: undefined } }));

  console.log('─── Licht en donker ───');
  await p.evaluate(nepExchanges, { WALLET, GEHEIM }); await syncAlle(p);
  for (const th of ['light', 'dark']) {
    await p.evaluate(t => { setTheme(t); go('instellingen'); setSetTab('data'); }, th); await H.stil(p);
    const c = await p.evaluate(() => { const el = document.getElementById('ruwPanel'); el.scrollIntoView(); const s = getComputedStyle(el.querySelector('.txt b') || el); return { kleur: s.color, body: getComputedStyle(document.body).backgroundColor, cls: document.body.className }; });
    ok(`${th}: dev-blok leesbaar (tekst ≠ achtergrond)`, c.kleur !== c.body && (th === 'dark') === c.cls.split(' ').includes('dark'), JSON.stringify(c));
    fs.mkdirSync('tests/screenshots', { recursive: true });
    await (await p.$('#ruwPanel')).screenshot({ path: `tests/screenshots/ruwe-data-${th}.png` });
  }

  console.log('─── ?dev=0 zet hem uit ───');
  await p.goto(H.APP_HTTP + '?dev=0', { waitUntil: 'domcontentloaded' }); await H.bootKlaar(p); await p.waitForTimeout(300);
  ok('?dev=0: IS_DEV uit, onthouden, geen dev-blok', await p.evaluate(() => IS_DEV === false && localStorage.getItem('sj_dev') !== 'true') && (await devBlok(p)) === null);
  await p.goto(H.APP_HTTP, { waitUntil: 'domcontentloaded' }); await H.bootKlaar(p); await p.waitForTimeout(300);
  ok('daarna zonder parameter: blijft uit', await p.evaluate(() => IS_DEV === false));
  ok('geen JS-fouten (dev)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();

  console.log('─── Het voorbeeld uit docs/w2-ruwe-data.md speelt de bestanden af ───');
  for (const ex of EX) {
    let uit = '', code = 0;
    try { uit = execFileSync('node', ['tests/ruwe-data-voorbeeld.spec.js', bestanden[ex]], { encoding: 'utf8', timeout: 120000 }); } catch (e) { code = e.status || 1; uit = String(e.stdout || '') + String(e.stderr || ''); }
    const m = /trades: (\d+)/.exec(uit);
    ok(`${ex}: afspelen geeft dezelfde ${origineel[ex]} trade(s) als de echte sync`, code === 0 && m && +m[1] === origineel[ex] && origineel[ex] > 0, (m ? m[0] : '') + ' · exit ' + code + ' · ' + uit.split('\n').filter(l => /✗|Error/.test(l)).slice(0, 3).join(' | '));
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n=== Ruwe data (W2): ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
