// Laadsnelheid-onderzoek (ad-hoc, geen test-framework). Meet empirisch:
//   1. Baseline: huidige work/tradejournal.html (in-browser Babel) → goto→Dashboard.
//   2. Pure Babel-transpileertijd van het text/babel-blok (met de echte babel-standalone),
//      én dezelfde transpile met de 1.7MB base64-share-cards weggestript → delta = base64-aandeel.
//   3. Vooraf-gecompileerde kopie (JSX al naar JS, babel-standalone verwijderd) → goto→Dashboard.
//      Dit is tegelijk optie B (build-stap) én het plafond voor optie A (warme compile-cache).
//
// Run: node tests/perf-research.js
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = f => 'file:///' + f.split(path.sep).join('/');
const BABEL_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js';

async function measureLoad(browser, url, runs = 2) {
  const times = [];
  let errs = [];
  for (let i = 0; i < runs; i++) {
    const page = await browser.newPage();
    const collected = [];
    page.on('pageerror', e => collected.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') collected.push('console: ' + m.text()); });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 40000 });
    times.push(Date.now() - t0);
    if (i === runs - 1) errs = collected.filter(e => !/deoptimised|max of 500KB/i.test(e));
    await page.close();
  }
  return { min: Math.min(...times), times, errs };
}

(async () => {
  const html = fs.readFileSync(APP, 'utf8');

  // Splits het text/babel-blok eruit.
  const open = '<script type="text/babel">';
  const i0 = html.indexOf(open);
  const i1 = html.indexOf('</script>', i0);
  const head = html.slice(0, i0);
  const jsxSrc = html.slice(i0 + open.length, i1);
  const tail = html.slice(i1); // begint bij </script>
  console.log(`JSX-blok: ${(jsxSrc.length / 1024 / 1024).toFixed(2)} MB`);

  const browser = await chromium.launch();

  // ── 1. Baseline ────────────────────────────────────────────────────────────
  const base = await measureLoad(browser, FILE_URL(APP), 2);
  console.log(`\n[1] BASELINE (in-browser Babel): ${base.min} ms  (runs: ${base.times.join(', ')})`);
  if (base.errs.length) console.log('    errors:', base.errs.join(' | '));

  // ── 2. Pure transpileertijd (echte babel-standalone) ─────────────────────────
  const tp = await browser.newPage();
  await tp.goto('about:blank');
  await tp.addScriptTag({ url: BABEL_CDN });
  await tp.waitForFunction(() => typeof Babel !== 'undefined', { timeout: 20000 });

  const jsxStripped = jsxSrc.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, 'data:image/png;base64,STUB');

  const transpile = await tp.evaluate(({ full, stripped }) => {
    const run = (src) => {
      const t = performance.now();
      const out = Babel.transform(src, { presets: ['react'], compact: false }).code;
      return { ms: Math.round(performance.now() - t), bytes: out.length };
    };
    const a = run(full);
    const b = run(stripped);
    // Geef de gecompileerde (volledige) code terug voor stap 3.
    const compiled = Babel.transform(full, { presets: ['react'], compact: false }).code;
    return { full: a, stripped: b, compiled };
  }, { full: jsxSrc, stripped: jsxStripped });

  console.log(`\n[2] PURE BABEL-TRANSPILE:`);
  console.log(`    volledig blok      : ${transpile.full.ms} ms  → ${(transpile.full.bytes / 1024 / 1024).toFixed(2)} MB output`);
  console.log(`    zonder base64      : ${transpile.stripped.ms} ms`);
  console.log(`    base64-aandeel     : ~${transpile.full.ms - transpile.stripped.ms} ms`);
  await tp.close();

  // ── 3. Vooraf-gecompileerde kopie ────────────────────────────────────────────
  // Verwijder de babel-standalone CDN-regel + vervang het text/babel-blok door compiled JS.
  const headNoBabel = head.replace(/<script src="[^"]*babel[^"]*"><\/script>\s*/i, '');
  const compiledHtml = headNoBabel + '<script>\n' + transpile.compiled + '\n' + tail;
  const TMP = path.resolve(__dirname, '_compiled-tmp.html');
  fs.writeFileSync(TMP, compiledHtml);

  const comp = await measureLoad(browser, FILE_URL(TMP), 2);
  console.log(`\n[3] VOORAF-GECOMPILEERD (geen babel in browser): ${comp.min} ms  (runs: ${comp.times.join(', ')})`);
  if (comp.errs.length) console.log('    errors:', comp.errs.join(' | '));
  else console.log('    (geen JS-errors — gecompileerde versie draait correct)');

  // ── Samenvatting ─────────────────────────────────────────────────────────────
  const saved = base.min - comp.min;
  const pct = ((saved / base.min) * 100).toFixed(0);
  console.log(`\n=== SAMENVATTING ===`);
  console.log(`baseline (Babel in browser) : ${base.min} ms`);
  console.log(`vooraf gecompileerd         : ${comp.min} ms`);
  console.log(`winst                       : ${saved} ms  (${pct}% sneller)`);
  console.log(`\n(_compiled-tmp.html blijft staan zodat je 'm zelf kunt openen; rm tests/_compiled-tmp.html om op te ruimen)`);

  await browser.close();
})();
