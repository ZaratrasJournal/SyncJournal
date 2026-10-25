// Datums rond middernacht en een rommel-back-up.
//
// 1. Tussen 00:00 en 02:00 in Amsterdam is het in UTC nog gisteren. Wat de gebruiker als "vandaag"
//    ziet, moet de lokale dag zijn: new Date().toISOString() geeft de UTC-dag en is dan fout.
//    De klok staat op 1 juli 2026 00:30 Amsterdam (30 juni 22:30 UTC): dan is zelfs de maand anders.
// 2. Een back-up met rommel ([1, 'x', null, …]) mag niets toevoegen of vervangen.
//
// Herschreven in T2 (24-10-2026): de oude spec testte dezelfde audit-bugs in de bevroren oude app.
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0, fixmes = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
// FIXME-check: bekende bug in de app (docs/plan-t2-specs.md, Gevonden bugs). Telt niet als rood zolang hij faalt.
const fixme = (n, c, e) => { fixmes++; console.log(c ? '  ⚠ FIXME lijkt opgelost, maak er weer ok() van: ' + n : '  ⚠ FIXME (bekende bug): ' + n + (e ? ' → ' + e : '')); };

const NA_MIDDERNACHT = new Date('2026-07-01T00:30:00+02:00');
const FILL_UTC = Date.UTC(2026, 5, 30, 22, 30);   // zelfde moment, als exchange-tijdstempel

(async () => {
  const b = await chromium.launch();
  // De browser in Nederland, zoals bij de leden; de klok vast op net na middernacht.
  const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam', klok: NA_MIDDERNACHT });

  console.log('─── Na middernacht ───');
  const r = await p.evaluate(fill => ({ utc: new Date().toISOString().slice(0, 10), lokaal: localDateISO(), leeg: EMPTY_TRADE.date,
    fillDatum: ts2date(fill), fillTijd: ts2time(fill), ams: amsDateTime(fill) }), FILL_UTC);
  ok('klok staat goed: in UTC is het nog 30 juni', r.utc === '2026-06-30', r.utc);
  ok('localDateISO() = 1 juli', r.lokaal === '2026-07-01', r.lokaal);
  ok('EMPTY_TRADE.date = 1 juli', r.leeg === '2026-07-01', r.leeg);
  ok('exchange-fill om 22:30 UTC: datum en tijd beschrijven hetzelfde moment (1 juli 00:30)', r.fillDatum === '2026-07-01' && r.fillTijd === '00:30', JSON.stringify(r));
  ok('amsDateTime: ook 1 juli 00:30', r.ams.date === '2026-07-01' && r.ams.time === '00:30', JSON.stringify(r.ams));

  await H.go(p, 'trades');
  await p.evaluate(() => openForm(null));
  const nieuw = await p.evaluate(() => document.getElementById('f_date').value);
  ok('nieuwe trade krijgt als datum vandaag (1 juli), niet gisteren', nieuw === '2026-07-01', nieuw);
  await p.evaluate(() => closeForm());
  const kal = await p.evaluate(() => STATE.calMonth);
  ok('Kalender opent op de huidige maand (juli)', kal === '2026-07', kal);
  const storting = await p.evaluate(() => { MANUAL.push({ id: 'm_t', name: 'Test', transactions: [] }); go('instellingen'); setSetTab('accounts'); txOpen('m_t', 'deposit');
    document.getElementById('tx_amt').value = '100'; addAcctTx('m_t'); const d = MANUAL.find(m => m.id === 'm_t').transactions[0].date; removeManual('m_t'); return d; });
  ok('storting op een handmatig account krijgt als datum vandaag', storting === '2026-07-01', storting);

  console.log('─── Rommel-back-up ───');
  await H.seedTrades(p, [1, 2, 3].map(i => ({ id: i, date: '2026-06-0' + i, time: '10:00', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live', entry: 100, exit: 110, size: '1000', pnl: 10, exchange: '' })));
  const tmp = path.join(os.tmpdir(), 'sj-rommel-backup.json');
  const importeer = async inhoud => {
    fs.writeFileSync(tmp, JSON.stringify(inhoud));
    const [kiezer] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => importJSON())]);
    await kiezer.setFiles(tmp);
    await p.waitForFunction(() => document.getElementById('modal').classList.contains('on') || /niet worden geïmporteerd|geen journal-gegevens/i.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
    return p.evaluate(() => ({ modal: document.getElementById('modal').classList.contains('on'), tekst: document.getElementById('modal').innerText.replace(/\s+/g, ' '),
      melding: /niet worden geïmporteerd|geen journal-gegevens/i.test(document.body.innerText) }));
  };
  const trades = () => p.evaluate(() => T.map(t => t.date + ' ' + t.pair).sort().join(', '));
  const voor = await trades();
  ok('drie trades staan klaar', voor.split(', ').length === 3, voor);

  const r1 = await importeer([1, 2, 3, 'niet-een-trade', null]);
  ok('alleen rommel: een duidelijke melding, geen keuzescherm', r1.melding && !r1.modal, JSON.stringify({ ...r1, tekst: r1.tekst.slice(0, 80) }));
  ok('en niets toegevoegd of vervangen', await trades() === voor, await trades());

  // Een object zonder één trade-veld ertussen: de oude app liet dat weg ("{foo:'bar'} is geen trade").
  const r2 = await importeer([{ foo: 'bar' }, 1, 'x', null]);
  // Since v1.15.1 (B10) such an object is not a trade, so the file holds no journal data at all.
  ok('object tussen de rommel telt niet als trade: dezelfde melding, geen keuzescherm', r2.melding && !r2.modal, JSON.stringify({ ...r2, tekst: r2.tekst.slice(0, 80) }));
  ok('en niets veranderd', await trades() === voor, await trades());
  fs.unlinkSync(tmp);

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Integriteit randen: ${pass}/${pass + fail}${fixmes ? ' · ' + fixmes + ' fixme' : ''} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
