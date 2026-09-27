// Borgt dat een screenshot-URL nooit als HTML wordt uitgevoerd.
//
// Aanleiding (27-09-2026): op zes plekken ging een opgeslagen beeld-URL ongeëscaped een
// innerHTML-template in. Bij eigen screenshots is dat ongevaarlijk — die komen uit
// compressImg als data:image — maar via "Importeer backup" komt de waarde van iemand
// anders, en in deze community worden backups uitgewisseld. Alles loopt nu door beeldSrc().
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// 1×1 transparante PNG — een geldige data:image-URL zoals compressImg die maakt.
const ECHT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const BREEKUIT = 'x" onerror="window.__xss=1" data-y="';
const SCRIPT_URL = 'javascript:window.__xss=1';

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  console.log('─── beeldSrc: welke schema\'s komen erdoor ───');
  const schema = await p.evaluate((v) => ({
    echt: beeldSrc(v.ECHT) !== '',
    blob: beeldSrc('blob:http://x/abc') !== '',
    https: beeldSrc('https://example.com/a.png') !== '',
    breekuit: beeldSrc(v.BREEKUIT),
    script: beeldSrc(v.SCRIPT_URL),
    leeg: beeldSrc(''),
    undef: beeldSrc(undefined),
    quote: beeldSrc(v.ECHT + '" onerror="x'),
  }), { ECHT, BREEKUIT, SCRIPT_URL });
  ok('data:image wordt doorgelaten', schema.echt);
  ok('blob: wordt doorgelaten', schema.blob);
  ok('https: wordt doorgelaten', schema.https);
  ok('uitbraak-poging wordt geweigerd', schema.breekuit === '', JSON.stringify(schema.breekuit));
  ok('javascript: wordt geweigerd', schema.script === '', JSON.stringify(schema.script));
  ok('leeg en undefined geven lege string', schema.leeg === '' && schema.undef === '');
  ok('quote in een geldige URL wordt geëscaped, niet doorgelaten',
    !/"/.test(schema.quote) && schema.quote.includes('&quot;'), JSON.stringify(schema.quote).slice(0, 90));

  console.log('─── Lightbox met een vijandige backup ───');
  await p.evaluate((v) => {
    T = [{ ...EMPTY_TRADE, id: 901, pair: 'BTC/USDT', setup: 'Test', date: '2026-09-27', time: '10:00',
           dir: 'long', status: 'closed', pnl: 10, entry: 1, exit: 2,
           screenshots: [v.BREEKUIT, v.ECHT] }];
    persist();
  }, { BREEKUIT, ECHT });
  await p.evaluate(() => zoomShots(901, 0)); await p.waitForTimeout(400);
  const lb = await p.evaluate(() => {
    const img = document.querySelector('#lightbox img');
    return { xss: !!window.__xss, src: img ? img.getAttribute('src') : null,
             onerror: img ? img.getAttribute('onerror') : null, attrs: img ? img.attributes.length : 0 };
  });
  ok('geen code uitgevoerd', lb.xss === false);
  ok('src is leeg gelaten', lb.src === '', JSON.stringify(lb.src));
  ok('geen onerror-attribuut aangemaakt', lb.onerror === null);
  ok('geen extra attributen uit de waarde gelekt', lb.attrs <= 2, 'attributen: ' + lb.attrs);

  await p.evaluate(() => lbMove(1)); await p.waitForTimeout(300);
  ok('de echte screenshot ernaast rendert nog wel',
    await p.evaluate((e) => { const i = document.querySelector('#lightbox img'); return !!i && i.getAttribute('src') === e; }, ECHT));

  console.log('─── Tijd in het onderschrift ───');
  await p.evaluate(() => { T[0].time = '10:00" onerror="window.__xss2=1'; persist(); renderLightbox(); });
  await p.waitForTimeout(250);
  ok('tijd wordt geëscaped in het onderschrift', await p.evaluate(() => !window.__xss2));

  console.log('─── Miniaturen op de trade ───');
  await p.evaluate(() => { const t = T.find(x => x.id === 901); if (typeof renderShots === 'function') try { renderShots(t) } catch (e) {} });
  ok('nog steeds geen code uitgevoerd', await p.evaluate(() => !window.__xss && !window.__xss2));
  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);

  console.log(`\n=== Beeld-escaping: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
