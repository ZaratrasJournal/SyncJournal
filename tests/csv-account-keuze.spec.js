// CSV-import met de pop-up "Bij welk account hoort dit bestand?" (Zaratras 25-10-2026), stap 3 van F11.
// Alleen KLEINE, VERZONNEN CSV's per formaat (de echte exports staan niet in de repo).
// Per formaat: de juiste voorkeur en het juiste aantal trades; importeren zet de trades op het gekozen account;
// "+ Nieuw account" werkt; een onbekende, lege of geblokkeerde CSV geeft een melding en importeert niets;
// een verkeerde exchange geeft een waarschuwing; Annuleren importeert niets. En exchange-isolatie: via de pop-up
// komen per formaat precies dezelfde trades binnen als via de oude route (sjImportCsvText(text, '')).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const KR_KOP = 'uid,dateTime,account,type,symbol,contract,change,new balance,new average entry price,trade price,mark price,funding rate,realized pnl,fee,realized funding,collateral,conversion spread percentage,liquidation fee,position uid,exchange rate,exchange rate from,conversion fee';
const kr = (nr, dt, oud, nieuw, px, pnl, fee) => [
  [`p${nr}`, dt, 'flex', 'futures trade', 'pf_xbtusd', 'pf_xbtusd', (nieuw - oud).toFixed(8), nieuw.toFixed(8), nieuw ? '75000' : '', px, px, '', '', '', '', '', '', '', '', '', '', ''].join(','),
  [`c${nr}`, dt, 'flex', 'futures trade', 'usd', 'pf_xbtusd', (pnl - fee).toFixed(8), '1000', '', px, px, '', pnl || '', fee, '', '', '', '', '', '', '', ''].join(',')];
const CSV = {
  blofin: ['Underlying Asset,Order Time,Side,Avg Fill,Filled,PNL,Fee,Leverage,Status,Reduce-only',
    'BTCUSDT,09/01/2026 10:00:00,Buy,60000,0.01,0,0.3,10,Filled,N', 'BTCUSDT,09/01/2026 12:00:00,Sell,61000,0.01,10,0.3,10,Filled,Y',
    'ETHUSDT,09/03/2026 09:00:00,Sell,2500,0.2,0,0.2,10,Filled,N', 'ETHUSDT,09/03/2026 11:00:00,Buy,2450,0.2,10,0.2,10,Filled,Y'].join('\n'),
  okx: ['Instrument,Direction,Open avg price,Close avg price,Closed position,Realized PnL,Fee,Open time,Close time',
    'BTC-USDT-SWAP,long,60000,61000,0.01,10,-0.5,2026-09-01 10:00:00,2026-09-01 12:00:00',
    'ETH-USDT-SWAP,short,2500,2450,0.2,10,-0.4,2026-10-20 09:00:00,2026-10-20 11:00:00'].join('\n'),
  kraken: [KR_KOP, ...kr(1, '2026-04-01 10:00:00', 0, 0.002, 75000, 0, 0.1), ...kr(2, '2026-04-01 12:30:00', 0.002, 0, 75600, 1.2, 0.1)].join('\n'),
  hyperliquid: 'time,coin,dir,px,sz,ntl,fee,closedPnl\n2026-04-01 10:00:00,BTC,Open Long,75000,0.002,150,0.1,0\n2026-04-01 11:00:00,BTC,Close Long,75500,0.002,151,0.1,1',
  mexc: ['Futures,Direction,Open Time,Close Time,Avg Entry Price,Avg Close Price,Realized PNL,Closing Qty (Cont.)',
    'BTCUSDT,Long,2026-09-02 10:00:00,2026-09-02 12:00:00,60000,61000,12.5,1', 'ETHUSDT,Short,2026-09-04 10:00:00,2026-09-04 12:00:00,2500,2450,4,1',
    'SOLUSDT,Long,2026-09-05 10:00:00,2026-09-05 12:00:00,150,148,-2,1'].join('\n'),
  ftmo: ['Ticket,Open,Type,Volume,Symbol,Price,SL,TP,Close,Price,Swap,Commissions,Profit,Pips,Trade duration in seconds',
    '1001,2026-09-03 10:00:00,buy,1,EURUSD,1.1000,1.0950,1.1100,2026-09-03 12:00:00,1.1050,0,-5,500,50,7200',
    '1002,2026-09-04 10:00:00,sell,1,US30,42000,42100,41800,2026-09-04 12:00:00,41900,0,-5,1000,100,7200'].join('\n'),
  algemeen: 'date,symbol,side,entry,exit,pnl\n2026-09-10,BTCUSDT,long,60000,61000,10\n2026-09-11,ETHUSDT,short,2500,2450,5',
  onbekend: 'naam,adres,woonplaats\nJan,Straat 1,Utrecht\nPiet,Laan 2,Delft',
  leeg: '',
};
// format → [voorkeur, aantal trades]
const VERWACHT = { blofin: ['blofin', 2], okx: ['okx', 2], kraken: ['kraken', 1], hyperliquid: ['hyperliquid', 1], mexc: ['mexc', 3], ftmo: ['nieuw', 2], algemeen: ['', 2] };

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const reset = (o) => p.evaluate((o) => { T = []; TRASH = []; MANUAL = (o && o.manual) || []; CONNS = (o && o.conns) || {}; FUNDED = []; STATE.funded = false; persistManual(); persistConns(); persistFunded(); persist(); closeForm(); }, o || null);
  const open = (k) => p.evaluate(([t, n]) => { csvKeuze(t, n); }, [CSV[k], k + '.csv']);
  const modal = () => p.evaluate(() => { const m = document.getElementById('modal'), body = m.querySelector('[data-csvk]');
    return { open: m.classList.contains('on'), toestand: body ? body.dataset.csvk : '', tekst: m.innerText.replace(/\s+/g, ' '),
      keuze: (m.querySelector('input[name="csvk"]:checked') || {}).value || '', voorstel: ((m.querySelector('.csvk-voor') || {}).parentElement || {}).querySelector ? m.querySelector('.csvk-voor').parentElement.querySelector('input').value : '',
      go: !!m.querySelector('#csvkGo') && !m.querySelector('#csvkGo').disabled }; });
  const importeer = () => p.evaluate(async () => { csvKImport(); await new Promise(r => setTimeout(r, 400)); });
  const opAccount = () => p.evaluate(() => { const o = {}; T.forEach(t => o[t.exchange] = (o[t.exchange] || 0) + 1); return o; });

  console.log('─── Herkennen: voorkeur en aantal per formaat ───');
  for (const [k, [voor, n]] of Object.entries(VERWACHT)) {
    await reset(); await open(k); const m = await modal();
    const nTxt = (m.tekst.match(/Herkend: .*? · (\d+) trades?/) || [])[1];
    ok(`${k}: pop-up, voorkeur ${voor || '(geen)'}, ${n} trades`, m.open && m.toestand === 'herkend' && m.keuze === voor && +nTxt === n && (voor ? m.voorstel === voor : true), `keuze=${m.keuze} n=${nTxt} · ${m.tekst.slice(0, 140)}`);
  }
  await reset(); await open('okx');
  ok('kop in gewone taal: "Herkend: OKX-positiehistorie · 2 trades · 1 sep t/m 20 okt"', /Herkend: OKX-positiehistorie · 2 trades · 1 sep t\/m 20 okt/.test((await modal()).tekst), (await modal()).tekst.slice(0, 120));
  await reset(); await open('algemeen');
  ok('algemene CSV: geen voorkeur, Importeren uit tot je kiest', !(await modal()).go);
  await reset({ manual: [{ id: 'mFT', name: 'FTMO 100k', transactions: [] }] }); await open('ftmo');
  ok('FTMO MetriX met een handmatig "FTMO 100k": dat account voorgesteld', (await modal()).keuze === 'mFT');
  await reset(); await open('ftmo');
  ok('FTMO MetriX zonder FTMO-account: "+ Nieuw account" met naam "FTMO"', (await modal()).keuze === 'nieuw' && await p.evaluate(() => document.getElementById('csvkNaam').value === 'FTMO'));
  ok('de uitleg noemt prop-firm-challenges', /prop-firm-challenge/.test((await modal()).tekst));

  console.log('─── Importeren zet de trades op het gekozen account ───');
  await reset(); await open('blofin'); await importeer();
  ok('Blofin-bestand → 2 trades op Blofin, pop-up dicht', JSON.stringify(await opAccount()) === '{"blofin":2}' && !(await modal()).open, JSON.stringify(await opAccount()));
  await reset({ manual: [{ id: 'mFT', name: 'FTMO 100k', transactions: [] }] }); await open('ftmo'); await importeer();
  ok('FTMO-bestand → op het handmatige account (niet meer op een los "ftmo")', JSON.stringify(await opAccount()) === '{"mFT":2}', JSON.stringify(await opAccount()));
  await reset(); await open('ftmo'); await importeer();
  ok('"+ Nieuw account" met naam FTMO: account aangemaakt en gekozen', await p.evaluate(() => MANUAL.length === 1 && MANUAL[0].name === 'FTMO' && T.length === 2 && T.every(t => t.exchange === MANUAL[0].id)));
  await reset(); await open('algemeen');
  await p.click('#modal input[value="nieuw"]');
  ok('"+ Nieuw account" zonder naam: Importeren uit', !(await modal()).go);
  await p.fill('#csvkNaam', 'Sub-account'); await p.fill('#csvkSaldo', '2500');
  ok('… met naam: aan', (await modal()).go);
  await importeer();
  ok('algemene CSV → nieuw handmatig account met startsaldo 2500', await p.evaluate(() => MANUAL.length === 1 && MANUAL[0].name === 'Sub-account' && acctCapital(MANUAL[0].transactions) === 2500 && T.length === 2 && T.every(t => t.exchange === MANUAL[0].id)));
  await reset(); await open('blofin'); await importeer(); await open('blofin'); await importeer();
  ok('twee keer hetzelfde bestand: dubbele trades worden overgeslagen', JSON.stringify(await opAccount()) === '{"blofin":2}');

  console.log('─── Verkeerde exchange ───');
  await reset(); await open('okx'); await p.click('#modal input[value="blofin"]');
  let m = await modal();
  ok('OKX-bestand bij Blofin: waarschuwing en Importeren uit', /Dit is een OKX-positiehistorie, maar je kiest Blofin/.test(m.tekst) && !m.go, m.tekst.slice(0, 200));
  await p.click('.csvk-toch input'); m = await modal();
  ok('"Toch bij Blofin importeren" aangevinkt: aan', m.go);
  await importeer();
  ok('… en dan staan ze op Blofin', JSON.stringify(await opAccount()) === '{"blofin":2}');
  await reset({ manual: [{ id: 'mSub', name: 'OKX sub', transactions: [] }] }); await open('okx'); await p.click('#modal input[value="mSub"]');
  ok('een handmatig account mag altijd, zonder waarschuwing', !/Dit is een/.test((await modal()).tekst) && (await modal()).go);
  await reset(); await open('ftmo'); await p.click('#modal input[value="okx"]');
  ok('FTMO-bestand bij een exchange: ook een waarschuwing', /Dit is een FTMO MetriX-export, maar je kiest OKX/.test((await modal()).tekst));

  console.log('─── Koppeling + CSV (B3) ───');
  await reset({ conns: { okx: { connected: true } } }); await open('okx');
  m = await modal();
  ok('gekoppelde exchange: "gekoppeld" erbij en één regel over dubbele trades', /OKX (voorstel )?gekoppeld/.test(m.tekst) && /niet dubbel/.test(m.tekst) && /koppeling is leidend/.test(m.tekst) && !/kunnen dubbel komen te staan/.test(m.tekst) && /slaat de journal over/.test(m.tekst), m.tekst.slice(0, 260));

  console.log('─── Niet herkend, leeg, geblokkeerd ───');
  await reset(); await open('onbekend'); m = await modal();
  ok('onbekend: melding met de Morani Discord en de lijst van formaten, geen keuzes', m.toestand === 'onbekend' && /herkennen we nog niet/.test(m.tekst) && /Morani Discord/.test(m.tekst) && /Blofin.*OKX.*Kraken.*Hyperliquid.*MEXC.*FTMO/.test(m.tekst) && !(await p.evaluate(() => !!document.querySelector('#modal input[name="csvk"]'))), m.tekst.slice(0, 200));
  ok('… en er is niets geïmporteerd', await p.evaluate(() => T.length === 0));
  await reset(); await open('leeg'); m = await modal();
  ok('leeg bestand: "Dit bestand is leeg"', m.toestand === 'leeg' && /Dit bestand is leeg/.test(m.tekst));
  await reset({ conns: { kraken: { connected: true } } }); await open('kraken'); m = await modal();
  ok('Kraken gekoppeld: de bestaande blokkade als melding, niets geïmporteerd', m.toestand === 'fout' && /Kraken is gekoppeld/.test(m.tekst) && await p.evaluate(() => T.length === 0), m.tekst.slice(0, 160));

  console.log('─── Annuleren en bezig ───');
  await reset(); await open('blofin'); await p.click('#modal .csvk-foot button:text-is("Annuleren")');
  ok('Annuleren: pop-up dicht, niets geïmporteerd', !(await modal()).open && await p.evaluate(() => T.length === 0));
  await reset(); await open('blofin');
  const bezig = await p.evaluate(() => { csvKImport(); const g = document.getElementById('csvkGo'); return { txt: g && g.textContent, dis: g && g.disabled, radio: document.querySelector('#modal input[name="csvk"]').disabled }; });
  ok('bezig met importeren: knop uit met "Bezig met importeren…", keuzes uit', bezig.txt === 'Bezig met importeren…' && bezig.dis && bezig.radio, JSON.stringify(bezig));
  await p.waitForTimeout(400);
  ok('… daarna dicht met de bestaande toast', await p.evaluate(() => !document.getElementById('modal').classList.contains('on') && /geïmporteerd/.test(document.getElementById('toasts').innerText)));

  console.log('─── Echte route: Instellingen → Accounts → Bestand kiezen ───');
  await reset(); await p.evaluate(() => { STATE.setTab = 'accounts'; go('instellingen'); });
  const tmp = path.resolve('tests/screenshots/_csv-okx.csv'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, CSV.okx);
  await p.setInputFiles('#csvFileInp', tmp); await p.waitForTimeout(400);
  ok('bestand kiezen opent de pop-up met OKX voorgesteld', (await modal()).keuze === 'okx');
  await p.waitForTimeout(300); await p.screenshot({ path: path.resolve('tests/screenshots/csv-account-keuze.png') });
  await p.evaluate(() => { STATE.theme = 'dark'; document.body.classList.add('dark'); }); await p.waitForTimeout(400); await p.screenshot({ path: path.resolve('tests/screenshots/csv-account-keuze-dark.png') });
  await p.evaluate(() => { STATE.theme = 'light'; document.body.classList.remove('dark'); });
  fs.unlinkSync(tmp);

  console.log('─── Exchange-isolatie: zelfde trades als de oude route ───');
  for (const k of ['blofin', 'okx', 'kraken', 'hyperliquid', 'mexc']) {
    await reset();
    const oud = await p.evaluate((t) => { sjImportCsvText(t, ''); return T.map(x => [x.exchange, x.pair, x.dir, x.date, x.pnl, x.entry, x.exit, x.srcId].join('|')).sort(); }, CSV[k]);
    await reset(); await open(k); await importeer();
    const nieuw = await p.evaluate(() => T.map(x => [x.exchange, x.pair, x.dir, x.date, x.pnl, x.entry, x.exit, x.srcId].join('|')).sort());
    ok(`${k}: via de pop-up precies dezelfde trades als vóór de pop-up`, oud.length > 0 && JSON.stringify(oud) === JSON.stringify(nieuw), JSON.stringify(oud).slice(0, 120) + ' vs ' + JSON.stringify(nieuw).slice(0, 120));
  }

  console.log('─── Telefoon ───');
  await p.setViewportSize({ width: 390, height: 844 }); await reset(); await open('ftmo'); await p.waitForTimeout(300);
  ok('390px: pop-up past in de breedte', await p.evaluate(() => { const r = document.getElementById('modal').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }));
  await p.screenshot({ path: path.resolve('tests/screenshots/csv-account-keuze-390.png') });

  ok('geen JS-fouten', !errs.length, errs.join(' | '));
  await b.close();
  console.log(`\n=== CSV-accountkeuze: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
