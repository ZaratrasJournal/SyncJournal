// Borgt positie-grootte in asset-eenheden: unit-toggle $ ↔ asset in het trade-formulier,
// omrekening via entry (beide richtingen), opslag (size altijd in $, qty+sizeUnit erbij),
// weergave in tabel + review-detail, en her-openen in de juiste unit.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades'); });
  await p.waitForTimeout(300);

  console.log('─── Formulier: toggle + omrekening ───');
  await p.evaluate(() => openForm(null)); await p.waitForTimeout(300);
  ok('unit-toggle aanwezig ($ + basis-asset uit pair)', await p.evaluate(() => { const bs = [...document.querySelectorAll('#szseg button')]; return bs.length === 2 && /BTC/.test(bs[1].textContent); }));
  ok('pair wijzigen → asset-knop volgt', await p.evaluate(() => { const el = document.getElementById('f_pair'); el.value = 'SOL/USDT'; el.dispatchEvent(new Event('input')); const t = document.getElementById('szAssetBtn').textContent; el.value = 'BTC/USDC'; el.dispatchEvent(new Event('input')); return /SOL/.test(t); }));
  await p.evaluate(() => { document.getElementById('f_entry').value = '50000'; document.getElementById('f_size').value = '10000'; calcTrade(true); });
  await p.evaluate(() => setSizeUnit('asset'));
  ok('$ → asset rekent om via entry (10000/50000 = 0.2)', await p.evaluate(() => Math.abs(parseFloat(document.getElementById('f_size').value) - 0.2) < 1e-9));
  ok('rekenbalk toont ≈ $-waarde', await p.evaluate(() => /≈/.test(document.getElementById('calcPrev').textContent)));
  await p.evaluate(() => setSizeUnit('usd'));
  ok('asset → $ rekent terug (0.2 × 50000 = 10000)', await p.evaluate(() => parseFloat(document.getElementById('f_size').value) === 10000));

  console.log('─── Opslaan in asset-modus ───');
  await p.evaluate(() => {
    document.getElementById('f_exit').value = '52000'; document.getElementById('f_stop').value = '49000';
    setSizeUnit('asset'); document.getElementById('f_size').value = '0.5'; calcTrade(true); submitForm(null);
  });
  await p.waitForTimeout(300);
  const t0 = await p.evaluate(() => T[T.length - 1]);
  ok('size opgeslagen in $ (0.5 × 50000 = 25000)', Number(String(t0.size).replace(/\./g, '')) === 25000, 'size=' + t0.size);
  ok('qty + sizeUnit opgeslagen', t0.qty === 0.5 && t0.sizeUnit === 'asset');
  ok('P&L rekent met $-notional (0.5 × 2000 = 1000)', Math.abs(t0.pnl - 1000) < 1, 'pnl=' + t0.pnl);

  console.log('─── Weergave ───');
  ok('tabel toont $ + asset-regel', await p.evaluate(() => { const td = [...document.querySelectorAll('td[data-l="Size"]')].find(x => /BTC/.test(x.textContent)); return td && /25\.000/.test(td.textContent) && /0,5 BTC/.test(td.textContent); }));
  await p.evaluate(() => { STATE.revSel = T[T.length - 1].id; go('review'); }); await p.waitForTimeout(400);
  ok('review-detail toont asset-hoeveelheid', await p.evaluate(() => /0,5 BTC/.test(document.getElementById('main').textContent)));

  console.log('─── Her-openen + $-modus onaangetast ───');
  await p.evaluate(() => openForm(T[T.length - 1].id)); await p.waitForTimeout(300);
  ok('formulier heropent in asset-unit met qty', await p.evaluate(() => formSizeUnit === 'asset' && parseFloat(document.getElementById('f_size').value) === 0.5));
  await p.evaluate(() => closeForm());
  await p.evaluate(() => openForm(null)); await p.waitForTimeout(200);
  await p.evaluate(() => { document.getElementById('f_entry').value = '100'; document.getElementById('f_exit').value = '110'; document.getElementById('f_size').value = '5000'; calcTrade(true); submitForm(null); });
  await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => T.find(t => String(t.size) === '5000'));
  ok('$-modus: size zoals ingevoerd, geen qty', t1 && t1.sizeUnit === 'usd' && !t1.qty);

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Pos-size in asset: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
