// Gedeelde opzet voor de data-overdracht-specs: journal op file://, netwerk dicht, welkom weg.
const { chromium } = require('playwright'); const path = require('path');
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
async function openJournal(b, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, permissions: opts.clipboard ? ['clipboard-read', 'clipboard-write'] : [] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => { localStorage.setItem('sj_welcomed', 'true'); });
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  return { ctx, p, errs };
}
async function seed(p, ds) { await p.evaluate(async d => { await applyBackup(d); await new Promise(r => setTimeout(r, 400)); }, ds); }
async function wipe(p) { await p.evaluate(async () => { localStorage.clear(); localStorage.setItem('sj_welcomed', 'true'); try { await IDB.clearAll(); } catch (e) {} }); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); }
const modalText = p => p.evaluate(() => document.getElementById('modal').innerText.replace(/\s+/g, ' '));
module.exports = { APP, openJournal, seed, wipe, modalText };
