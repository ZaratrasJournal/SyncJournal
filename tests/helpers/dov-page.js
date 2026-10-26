// Gedeelde opzet voor SyncJournal-specs: journal op file://, netwerk dicht, welkom weg.
//
// Seeden gaat via de app zelf (applyBackup → sanitizeTrade → sj_ + IndexedDB), nooit via
// tj_-sleutels: die ziet SyncJournal als óúde data en opent dan de migratie-modal (CLAUDE.md,
// "Opslag"). Navigeren gaat via go(page) van de app, niet door knoppen op tekst te zoeken.
const { chromium } = require('playwright'); const path = require('path');
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

// boot() is async (IndexedDB) en sluit af met landingAankomst(), die sj_welcomed schrijft.
// Dat schrijven is het signaal "data geladen, eerste render gedaan": we vangen het af in
// plaats van te wachten op de statische kop of een vaste pauze. De migratie-route (oude
// tj_-data) schrijft het niet; specs voor die route wachten op de modal.
function bootHaak() {
  localStorage.setItem('sj_welcomed', 'true');
  localStorage.setItem('sj_onboard', '"klaar"');   // the F14 welcome for a new journal: specs start past it
  window.__sjBoot = false;
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && k === 'sj_welcomed') window.__sjBoot = true;
    return orig.call(this, k, v);
  };
}
const bootKlaar = p => p.waitForFunction(() => window.__sjBoot === true, null, { timeout: 15000 });

async function openJournal(b, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, permissions: opts.clipboard ? ['clipboard-read', 'clipboard-write'] : [],
    ...(opts.timezoneId ? { timezoneId: opts.timezoneId } : {}) });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(bootHaak);
  if (opts.init) await p.addInitScript(opts.init, opts.initArg);
  // Vaste klok (Date.now en new Date); timers lopen gewoon door.
  if (opts.klok) await p.clock.setFixedTime(opts.klok);
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await bootKlaar(p); await p.waitForTimeout(300);
  return { ctx, p, errs };
}
async function reload(p) { await p.reload({ waitUntil: 'domcontentloaded' }); await bootKlaar(p); await p.waitForTimeout(300); }
async function seed(p, ds) { await p.evaluate(async d => { await applyBackup(d); await new Promise(r => setTimeout(r, 400)); }, ds); }
// Alleen trades (plus eventueel andere backup-onderdelen): elke rij gaat door sanitizeTrade,
// precies zoals bij een echte import.
const seedTrades = (p, trades, rest) => seed(p, { ...(rest || {}), trades });
async function wipe(p) { await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('sj_welcomed', 'true'); localStorage.setItem('sj_onboard', '"klaar"'); try { await IDB.clearAll(); } catch (e) {} }); await reload(p); }
// Naar een pagina via de app zelf; klaar als de kop van die pagina staat.
async function go(p, page) {
  await p.evaluate(pg => go(pg), page);
  await p.waitForFunction(pg => STATE.page === pg && document.getElementById('ptitle').textContent === PAGES[pg][0], page, { timeout: 5000 });
}
// render() laat #main infaden; een screenshot of kleurmeting daarvóór ziet een half-transparante pagina.
const stil = p => p.waitForFunction(() => document.getElementById('main').getAnimations({ subtree: true })
  .every(a => a.playState !== 'running' || (a.effect && a.effect.getTiming().iterations === Infinity)), null, { timeout: 5000 });
const modalText = p => p.evaluate(() => document.getElementById('modal').innerText.replace(/\s+/g, ' '));
const mainText = p => p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
module.exports = { APP, openJournal, reload, bootKlaar, seed, seedTrades, wipe, go, stil, modalText, mainText };
