// Borgt fase 2 van het hosting-plan (2026-09-16): IS_HOSTED-detectie, echte
// versie-vergelijking + update-banner, opslag-bescherming-status, verhuis-FAQ,
// en de release-sync tussen site/index.html en site/version.json.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Hosted-detectie + versievergelijking ───');
  ok('file:// telt niet als hosted', await p.evaluate(() => IS_HOSTED === false));
  ok('file:// telt ook niet als werkversie (IS_WORK)', await p.evaluate(() => IS_WORK === false && !document.querySelector('.workbadge')));
  ok('verNum: v0.9.60 < v0.9.61 < v0.10.0 < v1.0.0', await p.evaluate(() => verNum('v0.9.60') < verNum('v0.9.61') && verNum('v0.9.61') < verNum('v0.10.0') && verNum('v0.10.0') < verNum('v1.0.0')));
  ok('verNum: v0.10.0 > v0.9.999', await p.evaluate(() => verNum('v0.10.0') > verNum('v0.9.999')));
  ok('checkUpdate lokaal → status "local" met nette uitleg', await p.evaluate(async () => { await checkUpdate(); go('instellingen'); setSetTab('updates'); return UPDATE.status === 'local' && /lokale/.test(document.getElementById('main').textContent); }));

  console.log('─── Update-banner ───');
  ok('nieuwere versie → app-brede banner met Ververs-knop', await p.evaluate(() => { UPDATE.status = 'newer'; UPDATE.remote = 'v9.9.9'; UPDATE.released = '2026-01-01'; go('dashboard'); const bn = document.querySelector('.updbanner'); return bn && /v9\.9\.9/.test(bn.textContent) && /Ververs/.test(bn.textContent); }));
  ok('banner staat op elke pagina', await p.evaluate(() => { go('trades'); return !!document.querySelector('.updbanner'); }));
  ok('Later → banner weg', await p.evaluate(() => { dismissUpdate(); return !document.querySelector('.updbanner'); }));

  console.log('─── Opslag-bescherming + FAQ ───');
  ok('Data-tab toont opslag-bescherming-status', await p.evaluate(() => { go('instellingen'); setSetTab('data'); return /Opslag-bescherming/.test(document.getElementById('main').textContent); }));
  ok('FAQ: syncjournal.nl-vraag + verhuisvraag aanwezig', await p.evaluate(() => { go('faq'); const t = document.getElementById('main').textContent; return /staat mijn data dan online/.test(t) && /hoe verhuis ik naar syncjournal\.nl/.test(t); }));

  console.log('─── Release-sync site/ ───');
  const idx = fs.readFileSync(path.resolve('site', 'index.html'), 'utf8');
  const vj = JSON.parse(fs.readFileSync(path.resolve('site', 'version.json'), 'utf8'));
  const m = idx.match(/const APP_VERSION='([^']+)'/);
  ok('site/index.html en site/version.json dragen dezelfde versie', m && m[1] === vj.version, `index=${m && m[1]} json=${vj.version}`);
  ok('privacy.html aanwezig met kernpunten (lokaal, Drive, contact)', (() => { const pv = fs.readFileSync(path.resolve('site', 'privacy.html'), 'utf8'); return /eigen browser/.test(pv) && /Google Drive/.test(pv) && /info@syncjournal\.nl/.test(pv); })());
  ok('_headers: version.json wordt nooit gecachet', /\/version\.json\s*\n\s*Cache-Control: no-store/.test(fs.readFileSync(path.resolve('site', '_headers'), 'utf8')));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Hosted (fase 2): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
