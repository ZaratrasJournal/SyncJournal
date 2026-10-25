// Import van een bestand zonder echte trades: een object zonder trade-velden ({"foo":"bar"}) telde
// als 1 trade, met "vervangen" voorgeselecteerd. Alleen rommel ([1,"x",null]) kwam bij de nette
// melding uit via een opgevangen TypeError in looksOldExport. Loopt de echte route: importJSON → bestand.
const { chromium } = require('playwright');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const MELDING = /Geen journal-gegevens gevonden in dit bestand/;

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const warns = []; p.on('console', m => { if (/TypeError/.test(m.text())) warns.push(m.text()); });
  await H.seed(p, DS.volledig());
  const nVoor = await p.evaluate(() => T.length);

  // Kies een bestand via de echte importknop-route en geef de app even tijd.
  const importeer = async (inhoud, naam) => {
    await p.evaluate(() => { closeForm(); document.getElementById('toasts').innerHTML = ''; ErrorCenter.log = []; });
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => importJSON())]);
    await fc.setFiles({ name: naam, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(inhoud)) });
    await p.waitForTimeout(400);
    return p.evaluate(() => ({
      modal: (document.getElementById('modal') || {}).innerText || '',
      keuze: !!document.getElementById('dovMode'),
      toasts: document.getElementById('toasts').innerText,
      fouten: ErrorCenter.log.map(e => e.msg),
    }));
  };

  console.log('─── (a) object zonder trade-velden tussen rommel ───');
  const a = await importeer([{ foo: 'bar' }, 1, 'x', null], 'leeg-object.json');
  ok('geen keuzescherm met "1 trade" en geen vervang-keuze', !a.keuze && !/Wat zit erin/.test(a.modal), a.modal.slice(0, 200));
  ok('nette melding: geen journal-gegevens gevonden', MELDING.test(a.toasts), a.toasts);
  ok('geen fout in het foutencentrum', !a.fouten.length, a.fouten.join(' | '));

  console.log('─── (b) alleen rommel ───');
  const r = await importeer([1, 'x', null], 'rommel.json');
  ok('nette melding: geen journal-gegevens gevonden', MELDING.test(r.toasts) && !r.keuze, r.toasts);
  ok('geen TypeError, ook niet opgevangen', !r.fouten.length && !warns.length, r.fouten.concat(warns).join(' | '));

  console.log('─── (c) gewone back-up met 2 trades ───');
  const VOL = DS.volledig();
  const twee = { app: 'SyncJournal', appVersion: 'v1.15', schemaVersion: 8, exported: '2026-10-25T10:00:00Z', trades: VOL.trades.slice(0, 2) };
  const c = await importeer(twee, 'twee-trades.json');
  ok('keuzescherm toont 2 trades in het bestand, met vervang-keuze', c.keuze && /2 in bestand/.test(c.modal) && /Trades\s*2 · netto/i.test(c.modal), c.modal.slice(0, 300));

  console.log('─── oude TradeJournal-export gaat nog steeds naar het overzetten-scherm ───');
  const OUD = [{ id: 'a1', date: '2026-09-01', pair: 'BTC/USDT', direction: 'long', entry: '60000', exit: '60500', stopLoss: '59500', pnl: '8.3', setupTags: [], status: 'closed' }];
  const o = await importeer(OUD, 'tradejournal-export.json');
  ok('overzetten-scherm, geen keuzescherm', /Controleer wat er wordt overgezet/.test(o.modal) && !o.keuze && !o.fouten.length, o.modal.slice(0, 200));

  console.log('─── journal ongemoeid ───');
  await p.evaluate(() => closeForm());
  ok('journal heeft nog al zijn trades', await p.evaluate(() => T.length) === nVoor);
  ok('geen JS-fouten op de pagina', !errs.length, errs.join(' | '));

  await b.close();
  console.log(`\n${pass} geslaagd, ${fail} mislukt`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
