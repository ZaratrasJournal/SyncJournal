// TradingPlan v3, taak 3: edge per scenario (blok A), met exacte getallen uit tests/fixtures/plan3-trades.json.
// Groepen in de fixture (live: risico $10, dus R = pnl/10):
//  G1 Trend-pullback long, lagen 4H MSB · 1H OB · 15M BOS+FVG: 12 live met stop (R 2,−1,1.5,−1,2,3,−1,1,−1,2,−1,0.5 = 7),
//     1 live zonder stop (+$30, nieuwste), 6 backtest (1,1,−1,2,−1,1) + 2 paper (−1,2), 3 gemist (2,1.5,−1), 1 open
//  G2 Trend-pullback short, zelfde lagen: 3 live (−1,−1,1)
//  G3 London SFP: 2 long + 1 short met 4H SFP · 1H Liquidity Sweep · 15M FVG; 1 zonder 4H; 2 zonder 1H; 1 alleen 15M FVG
//  Range-fade: 2 long (5M Range + VAH / VAL / POC: 1,−1), 2 short (5M Range: 2,−1) → precies 4
//  Eenling: 1 live (1,5R) · Zonder stop: 2 live zonder stop (+25, −15) · Backtestbaas: 3 live, 12 backtest (8×2, 4×−1)
//  Klein: 6 backtest (1,1,−1,1,0.5,0)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 edge';
const TRADES = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'tests/fixtures/plan3-trades.json'), 'utf8')).trades;
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const WEEK = { id: '2026-W44', layers: [L('Weekly', ['BOS'], [], 'Bullish'), L('Daily', [], ['Liquidity Sweep'])], levels: '', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' };
const DAG = { id: '2026-10-27', week: '2026-W44', layers: [L('4H', ['MSB']), L('1H', [], ['OB'])], levels: '', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '', scenarios: [] };
const DAG3 = { ...DAG, layers: [L('4H', ['SFP']), L('1H', [], ['Liquidity Sweep'])] };
const sc = (o) => Object.assign({ id: 's_' + o.pb.replace(/\W/g, ''), title: o.pb, pair: 'BTC', dir: 'long', grade: 'B', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] }, o);
const S1 = sc({ pb: 'Trend-pullback', entry: L('15M', ['BOS'], ['FVG']) });
const S2 = sc({ id: 's_short', pb: 'Trend-pullback', dir: 'short', entry: L('15M', ['BOS'], ['FVG']) });
const S3 = sc({ pb: 'London SFP', entry: L('15M', [], ['FVG']) });
const S4 = sc({ pb: 'Range-fade', entry: L('5M', ['Range'], ['VAH / VAL / POC']), off: ['4H|MSB', '1H|OB'] });
const S5 = sc({ pb: 'Bestaat niet' });
const S6 = sc({ pb: 'Eenling', off: ['4H|MSB', '1H|OB'], entry: L('15M', ['BOS']) });
const S7 = sc({ pb: 'Backtestbaas', off: ['4H|MSB', '1H|OB'], entry: L('1H', ['BOS']) });
const S8 = sc({ pb: 'Klein', off: ['4H|MSB', '1H|OB'], entry: L('1H', ['MSB']) });
const S9 = sc({ pb: 'Zonder stop', off: ['4H|MSB', '1H|OB'], entry: L('15M', ['BOS']) });
const near = (a, b) => a != null && Math.abs(a - b) < 1e-6;

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.goto(srv.TP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  const E = (s, d) => p.evaluate(([s, d, w, t]) => __tp3.edge(s, d, w, t), [s, d || DAG, WEEK, TRADES]);

  console.log('--- S1: Trend-pullback long, alle tags ---');
  const e1 = await E(S1);
  ok('matching op playbook + richting + alle tags in de juiste laag: live 13, backtest 8 (6 + 2 paper)', e1.live.n === 13 && e1.bt.n === 8, JSON.stringify({ l: e1.live.n, b: e1.bt.n }));
  ok('Weekly en Daily zijn context (geen trade heeft die laag), 4H · 1H · 15M tellen mee', e1.context.join() === 'Weekly,Daily' && e1.meetellend.join() === '4H,1H,15M', e1.context + ' | ' + e1.meetellend);
  ok('niets weggevallen, richting telt mee', e1.zonder.length === 0 && e1.richtingLos === false);
  ok('live winrate 8/13 = 61,5% (trade zonder stop telt mee in n en winrate)', near(e1.live.wr, 800 / 13), e1.live.wr);
  ok('live gem. R = 7/12 = +0,583 (alleen trades mét stop)', near(e1.live.gemR, 7 / 12), e1.live.gemR);
  ok('live expectancy $100/13 = $7,69, profit factor 150/50 = 3', near(e1.live.expGeld, 100 / 13) && near(e1.live.pf, 3), e1.live.expGeld + ' / ' + e1.live.pf);
  ok('backtest (incl. paper): 62,5% · +0,50R · PF 70/30', near(e1.bt.wr, 62.5) && near(e1.bt.gemR, 0.5) && near(e1.bt.pf, 70 / 30), JSON.stringify(e1.bt));
  ok('gemist alleen apart: 3×, samen +2,5R', e1.gemist.n === 3 && near(e1.gemist.somR, 2.5), JSON.stringify(e1.gemist));
  ok('laatste 10 live, nieuwste eerst', JSON.stringify(e1.live.laatste10) === JSON.stringify([true, true, false, true, false, true, false, true, true, false]), JSON.stringify(e1.live.laatste10));
  ok('basis Live (13 ≥ 10), betrouwbaarheid live redelijk, backtest weinig', e1.basis === 'live' && e1.live.betr === 'redelijk' && e1.bt.betr === 'weinig');

  console.log('--- S2: short → richting valt weg ---');
  const e2 = await E(S2);
  ok('3 shorts < 5 → richtingLos, long en short samen: live 16, backtest 8', e2.richtingLos === true && e2.live.n === 16 && e2.bt.n === 8 && e2.zonder.length === 0, JSON.stringify({ los: e2.richtingLos, l: e2.live.n, b: e2.bt.n }));
  ok('gem. R over de 15 met stop: (7 − 1)/15 = +0,40', near(e2.live.gemR, 0.4), e2.live.gemR);

  console.log('--- S3: tags vallen weg, hoogste tijdframe eerst ---');
  const e3 = await E(S3, DAG3);
  ok('eerst richting, dan 4H SFP, dan 1H Liquidity Sweep (zonder in die volgorde)', e3.richtingLos && e3.zonder.join() === '4H SFP,1H Liquidity Sweep', e3.zonder.join());
  ok('daarna 7 trades (≥ 5)', e3.live.n + e3.bt.n === 7, e3.live.n + '+' + e3.bt.n);
  const e3b = await p.evaluate(([s, d, w, t]) => __tp3.edge(s, d, w, t), [{ ...S3, entry: L('15M', ['BOS'], ['FVG']) }, { ...DAG3, layers: [L('4H', ['SFP'], ['OB'])] }, WEEK, TRADES]);
  ok('binnen één tijdframe eerst de confirmations, dan de setups', e3b.zonder.slice(0, 2).join() === '4H OB,4H SFP', e3b.zonder.join());

  console.log('--- randgevallen ---');
  const e4 = await E(S4);
  ok('Range-fade: precies 4 na alle weggevallen tags, geen NaN', e4.live.n === 4 && e4.zonder.join() === '5M VAH / VAL / POC,5M Range' && near(e4.live.gemR, 0.25) && near(e4.live.wr, 50), JSON.stringify({ n: e4.live.n, z: e4.zonder, r: e4.live.gemR }));
  const e5 = await E(S5);
  ok('0 trades: n 0, gemR null, wr null, geen NaN', e5.live.n === 0 && e5.bt.n === 0 && e5.live.gemR === null && e5.live.wr === null && !/NaN/.test(JSON.stringify(e5)), JSON.stringify(e5.live));
  const e6 = await E(S6);
  ok('precies één trade: 100% · +1,50R · PF ∞, geen NaN', e6.live.n === 1 && near(e6.live.wr, 100) && near(e6.live.gemR, 1.5) && e6.live.pf >= 99 && !/NaN/.test(JSON.stringify(e6)), JSON.stringify(e6.live));
  const e9 = await E(S9);
  ok('alleen trades zonder stop: n 2, winrate 50%, gem. R onbekend (null)', e9.live.n === 2 && near(e9.live.wr, 50) && e9.live.gemR === null, JSON.stringify(e9.live));
  const e8 = await E(S8);
  ok('break-even telt als null in de laatste 10, en als 0R in het gemiddelde (2,5/6)', e8.bt.laatste10.includes(null) && near(e8.bt.gemR, 2.5 / 6), JSON.stringify(e8.bt));
  const e7 = await E(S7);
  ok('3 live → basis Backtest (12 trades, +1,00R)', e7.basis === 'backtest' && e7.bt.n === 12 && near(e7.bt.gemR, 1), JSON.stringify({ b: e7.basis, n: e7.bt.n, r: e7.bt.gemR }));
  ok('betrouwbaarheid: 9 weinig · 10 redelijk · 29 redelijk · 30 genoeg', await p.evaluate(() => [9, 10, 29, 30].map(__tp3.betrouwbaarheid).join() === 'weinig,redelijk,redelijk,genoeg'));
  ok('open trades tellen niet mee (G1 heeft er één)', e1.live.n === 13);
  const eOff = await E({ ...S1, off: ['4H|MSB'] });
  ok('uitgezette geërfde tag telt niet mee in de matching', eOff.live.n === 13 && !eOff.zonder.length);

  console.log('--- rangschikking ---');
  const rk = await p.evaluate(([l, d, w, t]) => __tp3.rangschik(l, d, w, t), [[S1, S2, S3, S7], DAG, WEEK, TRADES]);
  ok('op gem. R van de basis: Backtestbaas (+1,0 bt) · S1 (+0,58 live) · S2 (+0,40 live) · S3 (geen basis)', rk.map(x => x.id).join() === [S7.id, S1.id, S2.id, S3.id].join() && rk.map(x => x.plek).join() === '1,2,3,4', JSON.stringify(rk));
  ok('"sterkste" alleen de eerste, en alleen bij ≥ 10 op de basis', rk[0].sterkste === true && rk.slice(1).every(x => !x.sterkste));
  const rk2 = await p.evaluate(([l, d, w, t]) => __tp3.rangschik(l, d, w, t), [[S4, S8], DAG, WEEK, TRADES]);
  ok('Klein (6 backtest, +0,42R) staat eerst, maar is niet "sterkste" (< 10)', rk2[0].id === S8.id && rk2.every(x => !x.sterkste), JSON.stringify(rk2));
  ok('geen journal-trades: edge werkt, alles is context', await p.evaluate(([s, d, w]) => { const e = __tp3.edge(s, d, w, []); return e.live.n === 0 && e.bt.n === 0 && e.meetellend.length === 0 && e.context.join() === 'Weekly,Daily,4H,1H,15M'; }, [S1, DAG, WEEK]));
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
