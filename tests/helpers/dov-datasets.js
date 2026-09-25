// Datasets voor de export/import-doorloop (docs/opdracht-data-overzetten.md, stap 4).
// Zo compleet mogelijk: meerdere TP's, stappen, screenshots, links, notities met rare tekens,
// open en deels gesloten posities, alle soorten, alle exchanges én handmatige accounts, prullenbak,
// playbooks met afbeeldingen en gedekte criteria, koppelingen met sleutels, TradingPlan-blok.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const D = (i) => { const d = new Date(Date.UTC(2026, 0, 5) + i * 86400000 * 3); return d.toISOString().slice(0, 10); };
const ms = (date, hm) => +new Date(date + 'T' + hm + ':00');

function fullTrade(i) {
  const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDC', 'XRP/USD', 'DOGE/USDT'];
  const exs = ['blofin', 'okx', 'hyperliquid', 'kraken', 'm_ftmo', 'm_spot', ''];
  const kinds = ['live', 'live', 'live', 'paper', 'backtest', 'gemist'];
  const pair = pairs[i % pairs.length], ex = exs[i % exs.length], kind = kinds[i % kinds.length], dir = i % 3 === 0 ? 'short' : 'long';
  const date = D(i), time = String(8 + (i % 12)).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0');
  const open = ms(date, time), entry = 100 + i * 1.234567, stop = dir === 'long' ? entry - 2 : entry + 2, size = 1000 + i * 37;
  const nTP = 1 + (i % 3), tps = [];
  for (let k = 0; k < nTP; k++) { const price = +(dir === 'long' ? entry + (k + 1) * 1.5 : entry - (k + 1) * 1.5).toFixed(4); tps.push({ price, pct: k === nTP - 1 ? 100 - 30 * (nTP - 1) : 30, r: (k + 1) * 0.75, hit: k < nTP - 1 || i % 2 === 0, ts: open + (k + 1) * 900000 }); }
  const status = i % 9 === 8 ? 'open' : (i % 9 === 7 ? 'partial' : 'closed');
  const exit = status === 'open' ? '' : +(dir === 'long' ? entry + 1.1 : entry - 1.1).toFixed(4);
  const pnl = status === 'open' ? '' : +(((exit - entry) * (dir === 'long' ? 1 : -1)) / entry * size - 1.23).toFixed(2);
  const isEx = ex && !/^m_/.test(ex);
  const qty = +(size / entry).toFixed(6);
  const fills = isEx && status !== 'open' ? [
    { ts: open, side: dir === 'long' ? 'buy' : 'sell', kind: 'open', qty: qty / 2, qtyAsset: qty / 2, price: entry, fee: 0.3, posAfter: qty / 2, dirAfter: dir, avgEntry: entry, pnl: null, ordId: 'o' + i + 'a' },
    { ts: open + 120000, side: dir === 'long' ? 'buy' : 'sell', kind: 'add', qty: qty / 2, qtyAsset: qty / 2, price: entry + 0.01, fee: 0.3, posAfter: qty, dirAfter: dir, avgEntry: entry + 0.005, pnl: null, ordId: 'o' + i + 'b' },
    { ts: open + 900000, side: dir === 'long' ? 'sell' : 'buy', kind: 'close', qty: qty * 0.3, qtyAsset: qty * 0.3, price: tps[0].price, fee: 0.2, posAfter: qty * 0.7, dirAfter: dir, avgEntry: entry, pnl: 12.5, pnlCalc: 12.5, ordId: 'o' + i + 'c' },
    { ts: open + 3600000, side: dir === 'long' ? 'sell' : 'buy', kind: 'close', qty: qty * 0.7, qtyAsset: qty * 0.7, price: exit, fee: 0.4, posAfter: 0, dirAfter: '', avgEntry: entry, pnl: pnl - 12.5, pnlCalc: pnl - 12.5, ordId: 'o' + i + 'd' },
  ] : undefined;
  const t = {
    id: i, date, time, pair, dir, setup: ['London SFP', 'Trend-pullback', 'Range-fade', ''][i % 4], session: ['Asia', 'London', 'US AM', 'US PM'][i % 4], timeframe: ['5M', '15M', '1H', '4H'][i % 4], market: ['Trending', 'Ranging', 'Volatiel', ''][i % 4], grade: ['A', 'B', 'C', ''][i % 4],
    entry: +entry.toFixed(6), exit, stop: +stop.toFixed(6), tp: tps[tps.length - 1].price, tps, hindsightExit: kind === 'live' ? '' : +(entry + 3).toFixed(4),
    size, qtyAsset: qty, leverage: [3, 5, 10, 20][i % 4], fees: status === 'open' ? '' : 1.23, risk: +(2 / entry * 100).toFixed(2), rrPlanned: 2.5,
    pnl, pnlPct: status === 'open' ? 0 : +((pnl / 25000) * 100).toFixed(2), r: status === 'open' ? 0 : +(pnl / (2 / entry * size)).toFixed(2),
    status, kind, exchange: ex, account: '',
    emotion: 'Rustig', emotions: ['Rustig', 'FOMO'].slice(0, 1 + (i % 2)), mistake: i % 2 ? 'Te vroeg in' : '', mistakes: i % 2 ? ['Te vroeg in', 'SL te krap'] : [],
    missedReasons: kind === 'gemist' ? ['🐢 Durf'] : [], tags: ['A+ setup', 'nieuwsdag', 'ünïcode-tag 🚀'].slice(0, i % 4),
    layers: [{ timeframe: '4H', bias: 'Bullish', setups: ['London SFP'], confirmations: ['Liquidity Sweep', 'FVG'] }, { timeframe: '15M', bias: 'Neutraal', setups: [], confirmations: ['OB'] }].slice(0, 1 + (i % 2)),
    notes: i % 3 ? 'Notitie ' + i + ' met "quotes", \'apostrof\', <html> & ampersand,\nnieuwe regel en emoji 🚀📈 én ünïcödé' : '',
    lessons: i % 4 === 0 ? 'Les: wachten op de retest.' : '',
    tvLinks: i % 2 ? ['https://www.tradingview.com/x/abc' + i + '/', 'https://www.tradingview.com/x/def' + i + '/'] : [],
    screenshots: i % 5 === 0 ? [PNG, PNG] : [],
    durationMin: status === 'open' ? 0 : 60 + i, mae: 0.4, mfe: 1.8, rating: i % 6, checks: i % 2 ? ['plan', 'sl'] : [], realizedPnl: status === 'partial' ? 12.5 : '',
    openTime: String(open), closeTime: status === 'open' ? '' : String(open + 3600000),
  };
  if (isEx && kind === 'live') { t.srcId = ex + '_' + (900000 + i) + '_' + open; t.positionId = String(900000 + i); }
  if (fills) t.fills = fills;
  if (status === 'open') { t.unrealizedPnl = 7.5; t.liq = +(entry * 0.9).toFixed(4); }
  if (i % 7 === 0) t.planRef = String(700000 + i);
  return t;
}

function volledig() {
  const trades = Array.from({ length: 40 }, (_, i) => fullTrade(i));
  const trash = [{ ...fullTrade(40), deletedAt: Date.now() - 86400000 }, { ...fullTrade(41), srcId: 'blofin_weg_1', deletedAt: Date.now() }];
  const pb = (name, grade, status) => ({ name, oneLiner: 'Eén regel over ' + name + ' — met “aanhalingstekens”', status, defaultGrade: grade,
    layers: [{ timeframe: '4H', bias: 'Bullish', setups: [name], confirmations: ['Liquidity Sweep'] }],
    criteria: [{ text: 'Duidelijke structuur', mandatory: true, covers: 'trend' }, { text: 'Sweep van de low', mandatory: true, covers: 'trigger' }, { text: 'R:R minimaal 2:1', mandatory: false, covers: '' }],
    antiCriteria: [{ text: 'Vlak vóór high-impact nieuws', mandatory: true }], stop: 'onder de sweep', target: 'volgende pool', minRR: '2', bigPicture: 'HTF mee', tape: 'volume', intuition: 'schoon',
    examples: [{ id: 'ex_' + name, dataUrl: PNG, caption: 'Voorbeeld', kind: 'win' }], tradingViewUrl: 'https://www.tradingview.com/chart/', referenceUrl: '', referenceLabel: '', pairs: ['BTC/USDT'], sessions: ['London'] });
  const pbook = { 'London SFP': pb('London SFP', 'A', 'active'), 'Trend-pullback': pb('Trend-pullback', 'A', 'active'), 'Range-fade': pb('Range-fade', 'B', 'testing'), 'Oud': pb('Oud', 'C', 'retired') };
  const tradingplan = {
    trades: JSON.stringify([{ id: 700000, ts: new Date(ms(D(0), '08:00')).toISOString(), week: '2026-W02', day: D(0), sym: 'BTC', dir: 'Short', tf: '15m', setup: 'A', pb: 'London SFP', pbGrade: 'A', pbMissing: [], anti: [], checks: { trend: true, zone: true, trigger: true, sl: true, rr: true, ftmo: true, mind: true }, missing: [], exec: 'VOL', grade: 'A', risk: 2, taken: true, r: null, noTrade: [], notes: 'poort' }]),
    plans: JSON.stringify({ ['dag-' + D(0)]: { id: 'dag-' + D(0), type: 'dag', key: D(0), checks: { start: true }, images: [], links: [], saved: true, savedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), bias: 'Bullish', scenarios: [{ title: 'Sweep', als: 'x', dan: 'y', ongeldig: 'z', text: '', images: [], links: [] }], close: { scenario: 0, gevolgd: 'ja', les: 'Les', r: null, saved: true, savedAt: new Date().toISOString() } } }),
    cfg: JSON.stringify({ gradeMode: 'assen', max: { A: 2, B: 1, C: 0.5 }, matchMin: 45, pt: [{ k: 'trend', t: 'Trend mee' }, { k: 'zone', t: 'Prijs in HP-zone' }, { k: 'trigger', t: 'Trigger uit de lijst' }, { k: 'sl', t: 'SL op logisch level' }, { k: 'rr', t: 'Minimaal 2R naar TP1' }, { k: 'ftmo', t: 'FTMO-ruimte oké', hard: true }, { k: 'mind', t: 'Mentaal oké', hard: true }] }),
    meta: JSON.stringify({ schema: 2, introSeen: true, pbSeen: true }),
  };
  return {
    app: 'SyncJournal', appVersion: 'v0.9.136', schemaVersion: 8, exported: '2026-09-25T10:00:00.000Z',
    tagConfig: { setupTags: ['London SFP', 'Trend-pullback', 'Range-fade'], confirmationTags: ['Liquidity Sweep', 'FVG', 'OB'], timeframeTags: ['5M', '15M', '1H', '4H'], emotionTags: ['Rustig', 'FOMO'], mistakeTags: ['Te vroeg in', 'SL te krap'], missedReasonTags: ['🐢 Durf', '🔪 Buiten regels'], customTags: ['A+ setup', 'nieuwsdag', 'ünïcode-tag 🚀'] },
    pbook,
    conns: { blofin: { connected: true, autoSync: true, hint: '5533', apiKey: 'BLOFIN-KEY-1234-5533', apiSecret: 'BLOFIN-SECRET-abcdef', passphrase: 'pass-w00rd', syncFrom: '2026-01-01', lastSync: String(ms(D(30), '21:14')) }, okx: { connected: true, autoSync: false, hint: '318f', apiKey: 'OKX-KEY-318f', apiSecret: 'OKX-SECRET-xyz', passphrase: 'okx-pass', lastSync: String(ms(D(30), '21:14')) }, hyperliquid: { connected: true, autoSync: true, hint: '3E70', wallet: '0x1d14aabbccddeeff00112233445566778899' + '3E70' }, kraken: { connected: true, autoSync: false, hint: '9k2q', apiKey: 'KRAKEN-KEY-9k2q', apiSecret: 'KRAKEN-SECRET' } },
    manual: [{ id: 'm_ftmo', name: 'FTMO Challenge 100K', transactions: [{ id: 'tx1', type: 'deposit', amount: '100000', date: '2026-01-01', note: 'start' }, { id: 'tx2', type: 'withdrawal', amount: '5000', date: '2026-03-01', note: 'payout' }, { id: 'tx3', type: 'correction', amount: '96000', date: '2026-04-01', note: 'reset' }] }, { id: 'm_spot', name: 'Spot Reserve', transactions: [{ id: 'tx4', type: 'deposit', amount: '5000', date: '2026-02-01', note: '' }] }],
    sync: { auto: true, interval: '30m' },
    aiPrefs: { enabled: true, tone: 'direct', focus: { discipline: true, risk: false, psychologie: true }, hideAmounts: true },
    view: { preset: 'rustig', v: { hero: true, kpis: true, equity: false, monthly: true, edge: false, recent: true } },
    exMeta: { blofin: { val: 10527, acct: 'Swing' }, okx: { val: 6240, acct: 'OKX' }, hyperliquid: { val: 2115, acct: 'HL' }, kraken: { val: 1480, acct: 'Kraken' }, mexc: { val: 0, acct: 'MEXC' } },
    settings: { theme: 'dark', currency: 'EUR', priv: true, density: 'compact' },
    tradingplan,
    trades, trash,
  };
}

function minimaal() {
  return { app: 'SyncJournal', appVersion: 'v0.9.100', schemaVersion: 8, exported: '2026-06-01T00:00:00.000Z',
    trades: [
      { id: 0, date: '2026-05-01', time: '10:00', pair: 'BTC/USDT', dir: 'long', entry: 60000, exit: 60600, stop: 59500, size: '1000', pnl: 10, r: 1.2, status: 'closed', kind: 'live', exchange: '' },
      { id: 1, date: '2026-05-02', time: '11:30', pair: 'ETH/USDT', dir: 'short', entry: 3000, exit: 3030, stop: 2980, size: '500', pnl: -5, r: -1.5, status: 'closed', kind: 'live', exchange: '' },
      { id: 2, date: '2026-05-03', time: '09:15', pair: 'SOL/USDT', dir: 'long', entry: 150, exit: '', stop: 145, size: '300', pnl: '', r: 0, status: 'open', kind: 'live', exchange: '' },
    ] };
}

function randen() {
  const long = 'x'.repeat(20000);
  return { app: 'SyncJournal', appVersion: 'v0.9.136', schemaVersion: 8, exported: '2026-09-25T00:00:00.000Z',
    tagConfig: { setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], missedReasonTags: [], customTags: [] }, pbook: {}, manual: [], conns: {}, exMeta: {},
    trades: [
      { id: 0, date: '2025-12-31', time: '23:59', pair: 'btc/usdt', dir: 'long', entry: 0.00001234, exit: 0.00001300, stop: 0.00001200, size: '12345678', pnl: 0, r: 0, status: 'closed', kind: 'live', exchange: '', notes: long, tps: [], tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [], checks: [] },
      { id: 1, date: '2026-01-01', time: '00:00', pair: 'ETH/USDT', dir: 'short', entry: 3000, exit: 2000, stop: 3100, size: '1000000', pnl: -333333.33, r: -10, status: 'closed', kind: 'live', exchange: 'okx', srcId: 'okx_1_1', fees: 999.99 },
      { id: 2, date: '2026-01-02', time: '12:00', pair: 'ETH/USDT', dir: 'short', entry: 3000, exit: 2000, stop: 3100, size: '1000000', pnl: -333333.33, r: -10, status: 'closed', kind: 'live', exchange: 'okx', srcId: 'okx_1_1', fees: 999.99 },
      { id: 3, date: '2026-02-02', time: '12:00', pair: 'SOL/USDT', dir: 'long', entry: 100, exit: 101, stop: 99, size: '1000', pnl: 10, r: 1, status: 'closed', kind: 'paper', exchange: 'm_x', tps: [{ price: 101, pct: 100, r: '', hit: true, ts: 0 }, { price: 102, pct: 0, r: '', hit: false }] },
      { id: 4, date: '2026-02-02', time: '12:00', pair: 'SOL/USDT', dir: 'long', entry: 100, exit: 101, stop: 99, size: '1000', pnl: 10, r: 1, status: 'closed', kind: 'paper', exchange: 'm_x' },
      { id: 5, date: '2026-03-03', time: '08:00', pair: 'XRP/USD', dir: 'long', entry: 0.5, exit: 0.55, stop: 0.48, size: '2000', pnl: 200, r: 2.5, status: 'closed', kind: 'backtest', exchange: '', emotions: null, mistakes: undefined, tags: 'geen-lijst', screenshots: [null, PNG] },
    ] };
}

// Bewust kapot: twee trades met een onleesbare P&L (tekst), de rest in orde.
function kapot() { const d = volledig(); d.trades[3].pnl = 'abc'; d.trades[9].pnl = 'n/a'; return d; }

module.exports = { volledig, minimaal, randen, kapot, PNG };
