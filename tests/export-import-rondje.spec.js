// Rondje export → leeg → import, per dataset (docs/opdracht-data-overzetten.md stap 4):
// wat je exporteert komt na een schone import identiek terug. Datasets: zo compleet mogelijk
// (meerdere TP's, stappen, screenshots, links, unicode, open/partial, alle exchanges), minimaal,
// randgevallen, en de gehoste voorbeelddata.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const SETS = [['volledig', DS.volledig()], ['minimaal', DS.minimaal()], ['randgevallen', DS.randen()], ['voorbeelddata (site)', JSON.parse(fs.readFileSync(path.resolve('site/demo-dataset.json'), 'utf8'))]];
const CMP = ['trades', 'trash', 'tagConfig', 'pbook', 'manual', 'conns', 'sync', 'aiPrefs', 'settings', 'tradingplan'];
(async () => {
  const b = await chromium.launch();
  for (const [naam, ds] of SETS) {
    console.log('─── ' + naam + ' (' + (ds.trades || []).length + ' trades) ───');
    const { ctx, p, errs } = await H.openJournal(b);
    await H.seed(p, ds);
    const E1 = await p.evaluate(() => { const sel = {}; DOV_PARTS.forEach(x => sel[x.k] = true); return dovBuildExport(sel, true); });
    const n1 = await p.evaluate(() => T.length);
    ok('geladen en geëxporteerd: ' + n1 + ' trades, manifest met ' + Object.keys(E1.manifest.parts).length + ' onderdelen', n1 === (ds.trades || []).length && E1.manifest && E1.manifest.parts.trades.count === n1, String(n1));
    await H.wipe(p);
    ok('schoon: 0 trades, geen playbooks', await p.evaluate(() => T.length === 0 && Object.keys(PBOOK).length === 0));
    await p.evaluate(d => dovImportModal(d, 'rondje.json'), E1);
    await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 600)); });
    const res = await p.evaluate(() => ({ modal: document.getElementById('modal').innerText.replace(/\s+/g, ' '), n: T.length }));
    ok('controle geslaagd na import', /Controle geslaagd/.test(res.modal) && res.n === n1, res.modal.slice(0, 200) + ' n=' + res.n);
    await p.evaluate(() => closeForm());
    const E2 = await p.evaluate(() => { const sel = {}; DOV_PARTS.forEach(x => sel[x.k] = true); return dovBuildExport(sel, true); });
    // een koppeling zonder sleutels (zoals in de voorbeelddata) telt na import bewust niet als verbonden
    let connsGenorm = false; Object.values(E1.conns || {}).forEach(c => { if (c && c.connected && !['apiKey', 'apiSecret', 'passphrase', 'wallet'].some(k => c[k])) { c.connected = false; connsGenorm = true; } });
    if (connsGenorm) { E1.manifest.parts.conns = E2.manifest.parts.conns; console.log('  · koppelingen zonder sleutels: na import niet verbonden (verwacht)'); }
    for (const k of CMP) {
      const a = JSON.stringify(E1[k] === undefined ? null : E1[k]), c = JSON.stringify(E2[k] === undefined ? null : E2[k]);
      if (a === c) { ok(k + ' identiek na het rondje', true); continue; }
      // eerste verschil zichtbaar maken
      let i = 0; while (i < a.length && a[i] === c[i]) i++;
      ok(k + ' identiek na het rondje', false, 'verschil bij positie ' + i + ': …' + a.slice(Math.max(0, i - 60), i + 80) + ' ⇄ …' + c.slice(Math.max(0, i - 60), i + 80));
    }
    const ex1 = E1.exMeta || {}, ex2 = E2.exMeta || {};
    ok('exMeta: saldi en namen uit het bestand komen terug', Object.keys(ex1).every(id => !ex2[id] || (+ex2[id].val === +ex1[id].val && (!ex1[id].acct || ex2[id].acct === ex1[id].acct))));
    if (E1.view) ok('weergave-preset terug', E2.view && E2.view.preset === E1.view.preset);
    ok('manifest-aantallen gelijk', JSON.stringify(Object.fromEntries(Object.entries(E1.manifest.parts).map(([k, v]) => [k, v.count]))) === JSON.stringify(Object.fromEntries(Object.entries(E2.manifest.parts).map(([k, v]) => [k, v.count]))));
    if (naam === 'volledig') {
      const det = await p.evaluate(() => { const t = T.find(x => x.fills && x.fills.length === 4), o = T.find(x => x.status === 'open'), pa = T.find(x => x.status === 'partial'), s = T.find(x => (x.screenshots || []).length === 2), tp3 = T.find(x => (x.tps || []).length === 3);
        return { fills: t && t.fills.map(f => f.kind).join(), open: o && o.unrealizedPnl, partial: pa && pa.realizedPnl, shots: s && s.screenshots[0].slice(0, 22), tp3: tp3 && tp3.tps.map(x => x.hit + ':' + x.pct).join(), note: T[1].notes, links: T[1].tvLinks.length, tags: T[3].tags.join('|'), planRef: T[7].planRef, trash: TRASH.length, keys: CONNS.blofin.apiSecret, plan: JSON.parse(localStorage.getItem('tp2:trades')).length, pbCov: PBOOK['London SFP'].criteria[1].covers, pbImg: PBOOK['London SFP'].examples[0].dataUrl.slice(0, 15) }; });
      ok('details: 4 stappen (open, add, close, close)', det.fills === 'open,add,close,close', det.fills);
      ok('details: open trade met unrealized, partial met realizedPnl', det.open === 7.5 && det.partial === 12.5, JSON.stringify([det.open, det.partial]));
      ok('details: 2 screenshots, 3 TP-niveaus met hit/pct', det.shots === 'data:image/png;base64' && det.tp3 === 'true:30,true:30,true:40' || /true:30,true:30,(true|false):40/.test(det.tp3 || ''), det.tp3);
      ok('details: notitie met quotes, html, newline, emoji en unicode intact', /"quotes"/.test(det.note) && /<html> & ampersand/.test(det.note) && /\n/.test(det.note) && /🚀📈 én ünïcödé/.test(det.note), det.note);
      ok('details: 2 links, tags met unicode, planRef, prullenbak 2, sleutels, TradingPlan-record, gedekt criterium, playbook-afbeelding', det.links === 2 && /ünïcode-tag 🚀/.test(det.tags) && det.planRef === '700007' && det.trash === 2 && det.keys === 'BLOFIN-SECRET-abcdef' && det.plan === 1 && det.pbCov === 'trigger' && det.pbImg === 'data:image/png;', JSON.stringify(det).slice(0, 300));
    }
    if (naam === 'randgevallen') {
      const rd = await p.evaluate(() => ({ dup: T.filter(t => t.srcId === 'okx_1_1').length, noteLen: T[0].notes.length, tags: Array.isArray(T[5].tags), shots: T[5].screenshots.length, pnl: T[1].pnl, size: T[1].size }));
      ok('randgevallen: dubbele bron-id blijft 2× (vervangen verandert niets), notitie van 20.000 tekens, kapotte lijstvelden genormaliseerd, grote bedragen intact', rd.dup === 2 && rd.noteLen === 20000 && rd.tags === true && rd.pnl === -333333.33 && rd.size === '1000000', JSON.stringify(rd));
    }
    ok('geen JS-errors (' + naam + ')', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  console.log(`\n=== Export-import-rondje: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
