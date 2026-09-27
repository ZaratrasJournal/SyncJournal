// De API-koppelingswaarschuwing in het trade-formulier hoort alleen bij een LIVE trade te staan.
// Een backtest, paper- of gemiste trade zit nergens aan vast: geen koppeling, geen saldo, geen
// botsing met een sync. Gemeld door Denny 26-09-2026, gerepareerd in v0.9.141 — deze spec legt
// het vast, want het is precies het soort melding dat bij een verbouwing terugsluipt.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
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

  // Een gekoppelde exchange, zodat er iets te waarschuwen valt.
  await p.evaluate(() => {
    const id = Object.keys(EXMAP)[0];
    CONNS[id] = { connected: true };
    window.__ex = id;
  });

  const zichtbaar = (soort) => p.evaluate((s) => {
    openForm(null);
    const ex = document.getElementById('f_exchange'); if (ex) ex.value = window.__ex;
    const k = document.getElementById('f_kind'); if (k) k.value = s;
    onKindChange();
    const box = document.getElementById('exWarn');
    return { hidden: !box || box.hidden, tekst: box ? box.textContent.slice(0, 40) : '' };
  }, soort);

  console.log('─── De waarschuwing hoort alleen bij live ───');
  const live = await zichtbaar('live');
  ok('live: waarschuwing staat er', !live.hidden, JSON.stringify(live));
  for (const s of ['backtest', 'paper', 'gemist']) {
    const r = await zichtbaar(s);
    ok(`${s}: geen waarschuwing`, r.hidden, JSON.stringify(r));
  }

  console.log('─── Wisselen van soort werkt beide kanten op ───');
  const heen = await p.evaluate(() => {
    openForm(null);
    const ex = document.getElementById('f_exchange'); if (ex) ex.value = window.__ex;
    const k = document.getElementById('f_kind');
    k.value = 'live'; onKindChange();
    const a = !document.getElementById('exWarn').hidden;
    k.value = 'backtest'; onKindChange();
    const b2 = !document.getElementById('exWarn').hidden;
    k.value = 'live'; onKindChange();
    const c = !document.getElementById('exWarn').hidden;
    return { a, b: b2, c };
  });
  ok('live → backtest laat de box verdwijnen', heen.a && !heen.b, JSON.stringify(heen));
  ok('backtest → live laat hem terugkomen', heen.c, JSON.stringify(heen));

  console.log('─── Het gemist-veld volgt de soort ───');
  const mf = await p.evaluate(() => {
    const k = document.getElementById('f_kind');
    k.value = 'gemist'; onKindChange();
    const aan = document.getElementById('missedfield').style.display !== 'none';
    k.value = 'live'; onKindChange();
    const uit = document.getElementById('missedfield').style.display === 'none';
    return { aan, uit };
  });
  ok('gemist toont het extra veld, live verbergt het', mf.aan && mf.uit, JSON.stringify(mf));

  console.log('--- Geen emoji bij de soorten ---');
  // Denny 27-09-2026: de plaatjes voor Backtest/Paper/Gemist ogen niet professioneel. Ze zaten in
  // KINDS zelf, dus ze kwamen op drie plekken terug; de kleur per soort blijft het onderscheid.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{23E9}-\u{23FA}]/u;
  const labels = await p.evaluate(() => {
    openForm(null);
    const opties = [...document.getElementById('f_kind').options].map((o) => o.textContent);
    const t = { ...EMPTY_TRADE, id: 77, pair: 'BTC/USDT', date: '2026-09-27', dir: 'long', status: 'closed', pnl: 5 };
    const badges = ['backtest', 'paper', 'gemist'].map((k) => {
      const d = document.createElement('div'); d.innerHTML = kindBadge({ ...t, kind: k }); return d.textContent;
    });
    return { opties, badges, kinds: Object.values(KINDS).map((k) => k.label + (k.emoji || '')) };
  });
  ok('keuzelijst in het formulier zonder emoji', !labels.opties.some((x) => EMOJI.test(x)), JSON.stringify(labels.opties));
  ok('badge in de tradeslijst zonder emoji', !labels.badges.some((x) => EMOJI.test(x)), JSON.stringify(labels.badges));
  ok('KINDS draagt geen emoji meer', !labels.kinds.some((x) => EMOJI.test(x)), JSON.stringify(labels.kinds));
  ok('de kleur per soort blijft staan', await p.evaluate(() => Object.values(KINDS).every((k) => !!k.color)));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Soort-waarschuwing: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
