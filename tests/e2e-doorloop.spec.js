// Grondige end-to-end doorloop (Denny 2026-09-16): accounts aanmaken, saldo-mutaties
// (toevoegen/weigeren/corrigeren/verwijderen), trades toevoegen/wijzigen/verwijderen/
// herstellen, tags en TP's — en op elk punt cross-checken dat ALLE pagina's hetzelfde
// beeld tonen en de berekeningen exact kloppen (tabel == dashboard == kalender == balans).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1800, height: 1050 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  ok('welkomstscherm verschijnt bij verse start', await p.evaluate(() => document.getElementById('welcome').classList.contains('on')));
  await p.evaluate(() => { hideWelcome(); T = []; TRASH = []; persist(); clearGFilter(); setFilter('kind', 'alle'); });

  console.log('─── Account + saldo-mutaties ───');
  const base = await p.evaluate(() => totalBalance());
  await p.evaluate(() => { go('instellingen'); setSetTab('accounts'); });
  await p.evaluate(() => { document.getElementById('ma_name').value = 'QA Account'; document.getElementById('ma_bal').value = '10000'; addManual(); });
  ok('handmatig account aangemaakt met startsaldo', await p.evaluate(() => MANUAL.length === 1 && manualBalance(MANUAL[0]) === 10000));
  ok('balans stijgt exact met 10.000 (hero + pill)', await p.evaluate((b0) => totalBalance() === b0 + 10000 && document.getElementById('balVal').textContent.replace(/\D/g, '') === String(Math.round(totalBalance())), base));
  ok('account zichtbaar in dashboard-legenda', await p.evaluate(() => { go('dashboard'); return /QA Account/.test(document.getElementById('main').textContent); }));
  await p.evaluate(() => { go('instellingen'); setSetTab('accounts'); const m = MANUAL[0]; txOpen(m.id, 'deposit'); });
  await p.evaluate(() => { document.getElementById('tx_amt').value = '5000'; addAcctTx(MANUAL[0].id); });
  ok('storting +5.000 → kapitaal 15.000', await p.evaluate(() => acctCapital(MANUAL[0].transactions) === 15000));
  await p.evaluate(() => { txOpen(MANUAL[0].id, 'withdrawal'); }); await p.evaluate(() => { document.getElementById('tx_amt').value = '2000'; addAcctTx(MANUAL[0].id); });
  ok('opname −2.000 → kapitaal 13.000 en balans volgt', await p.evaluate((b0) => acctCapital(MANUAL[0].transactions) === 13000 && totalBalance() === b0 + 13000, base));
  ok('opname groter dan kapitaal wordt geweigerd', await p.evaluate(() => { txOpen(MANUAL[0].id, 'withdrawal'); document.getElementById('tx_amt').value = '99999'; addAcctTx(MANUAL[0].id); return acctCapital(MANUAL[0].transactions) === 13000 && MANUAL[0].transactions.length === 3; }));
  ok('correctie zet kapitaal exact (confirm >50% afwijking)', await p.evaluate(() => { txCancel(); txOpen(MANUAL[0].id, 'correction'); document.getElementById('tx_amt').value = '20000'; addAcctTx(MANUAL[0].id); return acctCapital(MANUAL[0].transactions) === 20000; }));
  ok('mutatie verwijderen → kapitaal terug naar 13.000', await p.evaluate(() => { const m = MANUAL[0]; const last = m.transactions[m.transactions.length - 1]; delAcctTx(m.id, last.id); return acctCapital(m.transactions) === 13000; }));

  console.log('─── Trade toevoegen (formulier, alles erop en eraan) ───');
  const today = await p.evaluate(() => localDateISO());
  await p.evaluate(() => { go('trades'); openForm(null); }); await p.waitForTimeout(250);
  await p.evaluate((today) => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; };
    document.getElementById('f_exchange').value = MANUAL[0].id;
    set('f_pair', 'BTC/USDT'); set('f_date', today); set('f_time', '10:00');
    document.getElementById('f_dir').value = 'long'; document.getElementById('f_status').value = 'closed';
    set('f_entry', '100'); set('f_exit', '110'); set('f_stop', '95'); set('f_size', '1000'); set('f_fees', '5');
    set('f_closeDate', today); set('f_closeTime', '12:00');
    addTP(); addTP(); formTPs[0].price = '105'; formTPs[1].price = '110'; formTPs[0].hit = true; formTPs[1].hit = true; renderTPs();
    const chip = [...document.querySelectorAll('#tagpick *')].find(x => x.textContent.trim() === 'A+ setup'); if (chip) chip.click();
    document.getElementById('f_notes').value = 'QA-doorloop trade';
    calcTrade(true);
  }, today);
  const calc = await p.evaluate(() => ({ pnl: document.getElementById('f_pnl').value, r: document.getElementById('f_r').value, dur: document.getElementById('f_durationMin').value }));
  ok('calculator: P&L 95, R 1.9, duur 120m automatisch', calc.pnl === '95' && calc.r === '1.9' && calc.dur === '120', JSON.stringify(calc));
  await p.evaluate(() => submitForm(null)); await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => { const t = T[0]; return { n: T.length, pnl: t.pnl, r: t.r, tps: t.tps.length, hits: t.tps.filter(x => x.hit).length, tag: (t.tags || []).includes('A+ setup'), dur: t.durationMin, ex: t.exchange === MANUAL[0].id }; });
  ok('trade opgeslagen: pnl 95 · R 1.9 · 2 TP\'s (2 hit) · label · duur · account', t1.n === 1 && t1.pnl === 95 && t1.r === 1.9 && t1.tps === 2 && t1.hits === 2 && t1.tag && t1.dur === 120 && t1.ex, JSON.stringify(t1));

  console.log('─── Zichtbaar op élke pagina + berekeningen ───');
  ok('tabel: rij met pair, groene P&L, R-badge en tag-chip', await p.evaluate(() => { go('trades'); const r = document.querySelector('tbody tr.mrow'); return r && /BTC\/USDT/.test(r.textContent) && /95/.test(r.textContent) && /1\.9|1,9/.test(r.textContent) && /A\+ setup/.test(r.textContent); }));
  ok('hover-uitklap: tijdlijn 10:00 → close 12:00 · 2u 0m + notitie', await p.evaluate(() => { trDrowShow(T[0].id); const d = document.getElementById('drow-' + T[0].id); return d && /10:00/.test(d.textContent) && /12:00/.test(d.textContent) && /2u 0m/.test(d.textContent) && /QA-doorloop/.test(d.textContent); }));
  ok('dashboard: netto +95, win-rate 100%, balans +95 op account', await p.evaluate((b0) => { go('dashboard'); const k = document.querySelector('.kpis').textContent; return /95/.test(k) && /100%/.test(k) && totalBalance() === b0 + 13000 + 95 && manualBalance(MANUAL[0]) === 13095; }, base));
  ok('kalender (huidige maand!): dag toont +95', await p.evaluate((today) => { go('kalender'); const main = document.getElementById('main').textContent; return STATE.calMonth === today.slice(0, 7) && /95/.test(main); }, today));
  ok('review: trade in lijst + TP-breakdown 2/2', await p.evaluate(() => { STATE.revSel = T[0].id; go('review'); const m = document.getElementById('main').textContent; return /BTC\/USDT/.test(m) && /2\/2/.test(m); }));
  ok('analytics rendert met 1 trade zonder fouten', await p.evaluate(() => { go('analytics'); return document.getElementById('main').textContent.length > 200; }) && errs.length === 0);

  console.log('─── Trade wijzigen → alles beweegt exact mee ───');
  await p.evaluate(() => { go('trades'); openForm(T[0].id); }); await p.waitForTimeout(250);
  await p.evaluate(() => { document.getElementById('f_exit').value = '90'; calcTrade(true); submitForm(T[0].id); }); await p.waitForTimeout(300);
  const edit = await p.evaluate(() => ({ pnl: T[0].pnl, r: T[0].r, bal: manualBalance(MANUAL[0]) }));
  ok('exit 110→90: pnl −105 · R −2.1 · saldo 12.895', edit.pnl === -105 && edit.r === -2.1 && edit.bal === 12895, JSON.stringify(edit));
  ok('dashboard: netto −105 en win-rate 0%', await p.evaluate(() => { go('dashboard'); const k = document.querySelector('.kpis').textContent; return /105/.test(k) && /0%/.test(k); }));
  ok('kalender-dag nu rood/−105', await p.evaluate(() => { go('kalender'); return /105/.test(document.getElementById('main').textContent); }));

  console.log('─── Tweede trade + tag-filter ───');
  await p.evaluate(() => { go('trades'); openForm(null); }); await p.waitForTimeout(250);
  await p.evaluate((today) => {
    const set = (id, v) => { document.getElementById(id).value = v; };
    document.getElementById('f_exchange').value = MANUAL[0].id;
    set('f_pair', 'ETH/USDT'); set('f_date', today); set('f_time', '14:00');
    document.getElementById('f_dir').value = 'short';
    set('f_entry', '200'); set('f_exit', '190'); set('f_stop', '205'); set('f_size', '500'); set('f_fees', '0');
    const chip = [...document.querySelectorAll('#tagpick *')].find(x => x.textContent.trim() === 'High conviction'); if (chip) chip.click();
    calcTrade(true); submitForm(null);
  }, today); await p.waitForTimeout(300);
  ok('short win: pnl +25 · R +2 · netto −80 · saldo 12.920', await p.evaluate(() => { const t = T.find(x => x.pair === 'ETH/USDT'); const net = T.reduce((s, x) => s + x.pnl, 0); return t && t.pnl === 25 && t.r === 2 && net === -80 && manualBalance(MANUAL[0]) === 12920; }));
  ok('tag-filter: 1 rij, dashboard rekent alleen +25, badge "1 van 2"', await p.evaluate(() => { toggleFilter('tag', 'High conviction'); go('trades'); const rows = document.querySelectorAll('tbody tr.mrow').length; go('dashboard'); const k = document.querySelector('.kpis').textContent; const badge = document.getElementById('gfBadge').textContent; clearGFilter(); return rows === 1 && /25/.test(k) && /1.*van.*2/.test(badge); }));

  console.log('─── Tags beheren ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('tags'); });
  ok('nieuwe eigen tag via Instellingen → in formulier-picker', await p.evaluate(() => { tagConfig.customTags = [...(tagConfig.customTags || []), 'QA-label']; persistTagConfig(); go('trades'); window.__qaId = T.find(x => x.pair === 'ETH/USDT').id; openForm(window.__qaId); const inPicker = [...document.querySelectorAll('#tagpick *')].some(x => x.textContent.trim() === 'QA-label'); return inPicker; }));
  ok('tag aanklikken + opslaan → chip in tabel + in filteropties', await p.evaluate(() => { [...document.querySelectorAll('#tagpick *')].find(x => x.textContent.trim() === 'QA-label').click(); submitForm(window.__qaId); go('trades'); const inTable = [...document.querySelectorAll('tbody tr.mrow')].some(r => /QA-label/.test(r.textContent)); const inFilter = [...document.querySelectorAll('.ddchk')].some(x => /QA-label/.test(x.textContent)); return inTable && inFilter; }));
  // Bewust gedrag (regel ~5854): een tag die nog op trades staat blijft als "losse tag"
  // kiesbaar in de picker, óók na verwijdering uit de config — data verdwijnt nooit.
  ok('tag verwijderen uit config → uit config, trade-data + chip + losse-tag-picker blijven', await p.evaluate(() => { removeTagCat('customTags', 'QA-label'); const uitConfig = !(tagConfig.customTags || []).includes('QA-label'); openForm(null); const alsLosseTag = [...document.querySelectorAll('#tagpick *')].some(x => x.textContent.trim() === 'QA-label'); formDirty = false; closeForm(); const onTrade = T.find(x => x.id === window.__qaId).tags.includes('QA-label'); go('trades'); const chipStill = [...document.querySelectorAll('tbody tr.mrow')].some(r => /QA-label/.test(r.textContent)); return uitConfig && alsLosseTag && onTrade && chipStill; }));

  console.log('─── TP wijzigen ───');
  ok('TP2 op niet-geraakt → review toont 1/2', await p.evaluate(() => { openForm(T.find(x => x.pair === 'BTC/USDT').id); formTPs[1].hit = false; renderTPs(); submitForm(T.find(x => x.pair === 'BTC/USDT').id); const t = T.find(x => x.pair === 'BTC/USDT'); STATE.revSel = t.id; go('review'); return t.tps.filter(x => x.hit).length === 1 && /1\/2/.test(document.getElementById('main').textContent); }));

  console.log('─── Verwijderen, prullenbak, herstellen ───');
  const eth = await p.evaluate(() => T.find(x => x.pair === 'ETH/USDT').id);
  await p.evaluate((id) => { go('trades'); delTrade(id); }, eth); await p.waitForTimeout(200);
  ok('verwijderen: uit tabel, netto −105, in prullenbak', await p.evaluate(() => { const net = T.reduce((s, x) => s + x.pnl, 0); go('instellingen'); setSetTab('data'); return T.length === 1 && net === -105 && TRASH.length === 1 && /ETH\/USDT/.test(document.getElementById('main').textContent); }));
  ok('saldo volgt verwijdering (12.895)', await p.evaluate(() => manualBalance(MANUAL[0]) === 12895));
  ok('terugzetten: trade + tags + berekeningen exact terug', await p.evaluate((id) => { trashRestoreOne(id); const t = T.find(x => x.id === id); const net = T.reduce((s, x) => s + x.pnl, 0); return t && t.pnl === 25 && (t.tags || []).includes('High conviction') && net === -80 && TRASH.length === 0 && manualBalance(MANUAL[0]) === 12920; }, eth));
  ok('definitief verwijderen via prullenbak → echt weg', await p.evaluate((id) => { delTrade(id); trashKill(id); return T.length === 1 && TRASH.length === 0; }, eth));

  console.log('─── Account verwijderen + slotconsistentie ───');
  ok('account weg → trade blijft bestaan, geen crash, balans zakt', await p.evaluate((b0) => { go('instellingen'); setSetTab('accounts'); const mid = MANUAL[0].id; removeManual(mid); go('trades'); const rowOk = document.querySelectorAll('tbody tr.mrow').length === 1; return MANUAL.length === 0 && T.length === 1 && rowOk && totalBalance() === b0; }, base));
  ok('slotsom: tabel == dashboard == acctPnl == kalender (−105)', await p.evaluate(() => { const net = T.filter(t => t.status === 'closed').reduce((s, t) => s + t.pnl, 0); go('dashboard'); const k = document.querySelector('.kpis').textContent; go('kalender'); const cal = document.getElementById('main').textContent; return net === -105 && /105/.test(k) && /105/.test(cal); }));
  ok('geen JS-errors in de hele doorloop', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== E2E-doorloop: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
