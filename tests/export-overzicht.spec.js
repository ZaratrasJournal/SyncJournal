// Export-overzicht (docs/opdracht-data-overzetten.md §3.1): per onderdeel aantal en omvang, vinkjes,
// sleutels apart, manifest in het bestand, uitgezet = afwezig, bestandsgrootte klopt.
const { chromium } = require('playwright');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const b = await chromium.launch(); const { ctx, p, errs } = await H.openJournal(b);
  await H.seed(p, DS.volledig());

  console.log('─── Overzicht ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('data'); });
  ok('Data-tab: knop opent het overzicht, niet direct een download', await p.evaluate(() => /exportOverzicht\(\)/.test(document.getElementById('main').innerHTML)));
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(200);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#modal [data-dov]')].map(r => ({ k: r.dataset.dov, txt: r.innerText.replace(/\s+/g, ' ') })));
  ok('10 onderdelen + sleutels-regel', rows.length === 11 && rows[10].k === 'keys', String(rows.length));
  const t = k => (rows.find(r => r.k === k) || {}).txt || '';
  ok('trades: aantal, met notities, screenshots, links, stappen', /40 trades/.test(t('trades')) && /met notities/.test(t('trades')) && /8 met screenshots/.test(t('trades')) && /20 met links/.test(t('trades')) && /met stappen/.test(t('trades')), t('trades'));
  ok('prullenbak 2, tags 19, playbooks 4 met 4 afbeeldingen', /2 verwijderde trades/.test(t('trash')) && /19 labels/.test(t('tags')) && /4 playbooks · 4 voorbeeldafbeeldingen/.test(t('pbook')), t('tags') + ' | ' + t('pbook'));
  ok('handmatige accounts met transacties, koppelingen met hints', /FTMO Challenge 100K, Spot Reserve · 4 stortingen/.test(t('manual')) && /Blofin …5533 · OKX …318f · Hyperliquid …3E70 · Kraken Futures …9k2q/.test(t('conns')), t('conns'));
  ok('saldi zonder plusteken, instellingen, AI, TradingPlan', /Swing \$ 10\.527/.test(t('exmeta')) && !/\+\$/.test(t('exmeta')) && /thema donker · EUR · weergave rustig/.test(t('settings')) && /toon direct/.test(t('ai')) && /1 plannen · 1 poort-beoordelingen/.test(t('plan')), t('exmeta') + ' | ' + t('plan'));
  ok('sleutels-regel: gaat mee, met waarschuwing om uit te zetten bij delen', /gaat mee/.test(t('keys')) && /Zet uit als je dit bestand deelt/.test(t('keys')));
  const tot0 = await p.evaluate(() => document.getElementById('dovExpTot').innerText);
  ok('totaal: 10 van 10, met sleutels, bestandsnaam', /10 van 10 onderdelen/.test(tot0) && /met sleutels/.test(tot0) && /syncjournal-backup-\d{4}-\d{2}-\d{2}\.json/.test(tot0), tot0);
  await p.evaluate(() => { dovExpToggle('trash', false); dovExpToggle('plan', false); dovExpToggle('keys', false); });
  const tot1 = await p.evaluate(() => document.getElementById('dovExpTot').innerText);
  ok('uitzetten telt mee: 8 van 10, zonder sleutels, doorgestreept', /8 van 10/.test(tot1) && /zonder sleutels/.test(tot1) && await p.evaluate(() => document.querySelector('#modal [data-dov="trash"]').classList.contains('dov-off')), tot1);

  console.log('─── Het bestand ───');
  const built = await p.evaluate(() => { const d = dovBuildExport(_dovExp.sel, _dovExp.keys); return { keys: Object.keys(d), json: JSON.stringify(d), man: d.manifest, conns: d.conns }; });
  ok('uitgezette onderdelen ontbreken helemaal (trash, tradingplan)', !built.keys.includes('trash') && !built.keys.includes('tradingplan') && built.keys.includes('trades') && built.keys.includes('pbook'), built.keys.join());
  ok('zonder sleutels: geen apiKey/apiSecret/passphrase/wallet, koppeling zelf blijft herkenbaar', !/apiKey|apiSecret|passphrase|wallet|BLOFIN-SECRET/.test(JSON.stringify(built.conns)) && built.conns.blofin.hint === '5533' && built.conns.blofin.syncFrom === '2026-01-01', JSON.stringify(built.conns.blofin));
  ok('manifest: per onderdeel included/count/bytes, keysIncluded false', built.man.keysIncluded === false && built.man.parts.trash.included === false && built.man.parts.trash.count === 0 && built.man.parts.trades.included && built.man.parts.trades.count === 40 && built.man.parts.pbook.count === 4, JSON.stringify(built.man.parts.trades));
  const sum = Object.values(built.man.parts).reduce((s, x) => s + x.bytes, 0);
  ok('som van de manifest-omvang binnen 5% van de werkelijke bestandsgrootte', Math.abs(sum - built.json.length) / built.json.length < 0.05, sum + ' vs ' + built.json.length);
  ok('screenshots en TradingView-links zitten in het bestand', /data:image\/png;base64/.test(built.json) && /tradingview\.com\/x\/abc1/.test(built.json));

  console.log('─── Exporteren ───');
  const bk0 = await p.evaluate(() => BK.ts);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => dovExportGo())]);
  ok('download met de juiste bestandsnaam', /^syncjournal-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('gedeeltelijk bestand telt niet als volledige back-up (geen stempel)', await p.evaluate(b0 => BK.ts === b0, bk0));
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(150);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => dovExportGo())]);
  ok('volledig bestand stempelt de back-up wel', await p.evaluate(b0 => BK.ts > b0 && BK.method === 'handmatig', bk0));
  const full = JSON.parse(require('fs').readFileSync(await dl2.path(), 'utf8'));
  ok('volledig bestand: alle onderdelen, sleutels erin, manifest keysIncluded true', ['trades', 'trash', 'tagConfig', 'pbook', 'manual', 'conns', 'sync', 'exMeta', 'settings', 'view', 'aiPrefs', 'tradingplan', 'manifest'].every(k => k in full) && full.conns.blofin.apiSecret === 'BLOFIN-SECRET-abcdef' && full.manifest.keysIncluded === true, Object.keys(full).join());
  ok('oude directe export (exportJSON) blijft werken voor de vangnetten', await p.evaluate(() => typeof exportJSON === 'function'));

  console.log('─── Zonder sleutels opgeslagen ───');
  await p.evaluate(() => { CONNS = {}; persistConns(); exportOverzicht(); }); await p.waitForTimeout(150);
  ok('geen sleutels → regel zegt dat het vinkje nu niets doet', /dit vinkje doet nu niets/.test(await p.evaluate(() => document.querySelector('#modal [data-dov="keys"]').innerText)));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Export-overzicht: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
