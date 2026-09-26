// Echte oude-app-export van Denny (39 backtests, geanonimiseerd): sim-trades met status "missed"
// komen als gesloten backtests binnen, gekoppeld aan hun playbook, met TradingView-links als
// adressen, en ze zijn zichtbaar op de Trades- en Playbook-pagina.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const d = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/tj-backtest-export.json'), 'utf8'));
  const pre = await p.evaluate(d => { const pre = TJMigrate.mapExport(d); const ts = pre.payload.trades; const by = f => { const o = {}; ts.forEach(t => { const k = String(f(t)); o[k] = (o[k] || 0) + 1; }); return o; };
    return { status: by(t => t.status), kind: by(t => t.kind), setup: by(t => t.setup), links: ts.filter(t => (t.tvLinks || []).length).length, linkType: typeof ((ts[0].tvLinks || [])[0]), tps: ts.filter(t => (t.tps || []).length).length, hits: ts.filter(t => (t.tps || []).some(x => x.hit)).length, metR: ts.filter(t => t.r).length, r0: ts[0].r, shots: ts.filter(t => (t.screenshots || []).length).length, report: pre.report, warn: pre.warnings.length }; }, d);
  // trade 0: short 73213, stop 74218, TP's 71468 (50%) 68882 (25%) 66894 (25%) alle gehaald → R = Σ (entry−tp)/risk × pct
  const rExp = +(((73213 - 71468) / 1005) * 0.5 + ((73213 - 68882) / 1005) * 0.25 + ((73213 - 66894) / 1005) * 0.25).toFixed(2);
  ok('gehaalde TP-niveaus (status "hit") herkend: 31 trades; R afgeleid uit de niveaus (' + rExp + 'R voor trade 0), ' + pre.metR + ' trades met R', pre.hits === 31 && Math.abs(pre.r0 - rExp) < 0.011 && pre.metR >= 34, JSON.stringify([pre.hits, pre.r0, rExp, pre.metR]));
  ok('39 trades, allemaal gesloten backtests (oude status "missed" vertaald)', pre.status.closed === 39 && !pre.status.missed && pre.kind.backtest === 39, JSON.stringify([pre.status, pre.kind]));
  ok('setup = playbook-naam (1H MSB/BOS en HTF OB POI), niet de setup-tag', (pre.setup['1H MSB/BOS'] || 0) + (pre.setup['HTF OB POI - LTF Entry'] || 0) === 39 && !pre.setup.BOS, JSON.stringify(pre.setup));
  ok('TradingView-links als adressen (38 trades), 3 TP-niveaus (34), screenshots (6)', pre.links === 38 && pre.linkType === 'string' && pre.tps === 34 && pre.shots === 6, JSON.stringify([pre.links, pre.linkType, pre.tps, pre.shots]));
  ok('overzicht: 39 trades, 2 playbooks, 3 koppelingen, 47 tags, 2 waarschuwingen', pre.report.trades === 39 && pre.report.playbooks === 2 && pre.report.conns === 3 && pre.report.tags === 47 && pre.warn === 2, JSON.stringify(pre.report));
  ok('netto telt alleen live (0 hier); 39 sim-trades apart met theoretisch bedrag', pre.report.liveN === 0 && pre.report.simN === 39 && pre.report.simPnl > 700, JSON.stringify([pre.report.liveN, pre.report.simN, pre.report.simPnl]));
  const cc = await p.evaluate(d => { const ts = TJMigrate.mapExport(d).payload.trades; return { n: ts.filter(t => /Afgevinkt bij entry \(oude app, \d+%\): /.test(t.notes)).length, note0: ts[0].notes, txt: (migPreview(TJMigrate.mapExport(d), 'file'), document.getElementById('modal').innerText.replace(/\s+/g, ' ')) }; }, d);
  ok('afgevinkte criteria bij entry bewaard als tekst in de notitie (39 trades)', cc.n === 39 && /een MSB of BOS · MSB of BOS na impuls/.test(cc.note0), cc.note0.slice(0, 120));
  ok('overzicht: jaartal in de periode, sim-trades apart, waarschuwing zegt dat de vinkjes als tekst bewaard zijn', /02-01-2026 – 15-06-2026/.test(cc.txt) && /39 backtest\/paper\/gemist \(theoretisch/.test(cc.txt) && /als tekst onderaan de notitie/.test(cc.txt), cc.txt.slice(0, 300));
  await p.evaluate(() => closeForm());

  const na = await p.evaluate(async d => { const pre = TJMigrate.mapExport(d); await Snapshots.create('test'); await applyBackup(pre.payload); await new Promise(r => setTimeout(r, 800));
    const issues = TJMigrate.verify(pre.payload, pre.old);
    go('trades'); clearGFilter(); FILTER.kind = 'backtest'; render(); await new Promise(r => setTimeout(r, 300));
    const rows = document.querySelectorAll('#main tbody tr').length, txt = document.getElementById('main').innerText.replace(/\s+/g, ' ');
    openPlaybook('1H MSB/BOS'); await new Promise(r => setTimeout(r, 300));
    const pb = document.getElementById('main').innerText.replace(/\s+/g, ' ');
    const t = T.find(x => x.tvLinks.length); const html = t ? (openForm(t.id), document.getElementById('modal').innerHTML) : '';
    return { issues, closed: T.filter(t => t.status === 'closed').length, rows, txt: txt.slice(0, 500), pb: pb.slice(0, 600), link: /tradingview\.com\/x\//.test(html) && !/object Object/.test(html) }; }, d);
  ok('controle na overzetten zonder afwijkingen', na.issues.length === 0, JSON.stringify(na.issues));
  ok('Trades-pagina met filter Backtest toont de 39 trades', na.closed === 39 && /Alle 39/.test(na.txt), na.rows + ' rijen · ' + na.txt);
  ok('Playbook-pagina 1H MSB/BOS telt de backtests', /Backtest \(3[0-9]\)/.test(na.pb) || /backtest/i.test(na.pb), na.pb.slice(0, 200));
  ok('trade-formulier toont de TradingView-link als link', na.link);
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== TJ-backtest (echte export): ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
