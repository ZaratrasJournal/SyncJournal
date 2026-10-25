// Backlog C3: the account label is looked up, not copied into the trade.
//
// The trade form used to save account: EXMAP[ex].acct, a copy of the label at that moment. Rename the
// account (via a backup import or the old-journal migration, adoptExMeta) and old trades kept the old
// name in their detail. Now the label comes from the exchange; t.account only counts as a real
// sub-account when it is not a copy of the exchange's current or shipped label.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const trade = (id, extra) => ({ id, exchange: 'okx', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', date: '2026-10-20', time: '10:00',
  entry: 100, exit: 110, stop: 95, size: '1000', pnl: 10, ...extra });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(rows => { T = rows.map(t => ({ ...EMPTY_TRADE, ...t })); persist(); go('trades'); }, [
    trade(1, { account: 'OKX' }),            // saved by the old form: a copy of the shipped label
    trade(2, { account: 'Prop-sub 2' }),     // a real sub-account
    trade(3, { account: '' }),               // synced trade: never had a label
  ]);
  // the Account stat in the expanded row of the trades list
  const acct = id => p.evaluate(id => { const m = tradeHoverDetail(T.find(t => t.id === id)).match(/<div class="lb">Account<\/div><div class="vl"[^>]*>([^<]*)</); return m ? m[1] : ''; }, id);
  const rowText = id => p.evaluate(id => { go('trades'); const r = document.getElementById('drow-' + id); return r ? r.previousElementSibling.innerText + ' ' + r.innerText : ''; }, id);

  console.log('─── Before the rename ───');
  ok('the shipped label is not repeated next to the Exchange tile', await acct(1) === '', await acct(1));
  ok('a sub-account is shown', await acct(2) === 'Prop-sub 2', await acct(2));

  console.log('─── Account renamed (adoptExMeta, as a backup import does) ───');
  await p.evaluate(() => { adoptExMeta({ exMeta: { okx: { acct: 'Swing' } } }); render(); });
  ok('detail: the old trade shows the new name', await acct(1) === 'Swing', await acct(1));
  ok('detail: a synced trade on that account shows the new name too', await acct(3) === 'Swing', await acct(3));
  ok('detail: the sub-account keeps its own name', await acct(2) === 'Prop-sub 2', await acct(2));
  const row1 = await rowText(1);
  ok('list: the row shows the new name, not the old copy', /Swing/.test(row1) && !/Account\s*OKX/.test(row1), row1.replace(/\s+/g, ' ').slice(0, 200));

  console.log('─── Trade form ───');
  const form = await p.evaluate(() => { openForm(1); const s = document.getElementById('f_exchange'); return s ? s.value : null; });
  ok('form: the trade stays on its account', form === 'okx', form);
  await p.evaluate(() => submitForm(1));
  const saved = await p.evaluate(() => { const t = T.find(x => x.id === 1); return { account: t.account, exchange: t.exchange }; });
  ok('form: saving writes no copy of the label', saved.account === '' && saved.exchange === 'okx', JSON.stringify(saved));
  await p.evaluate(() => { openForm(2); submitForm(2); });
  ok('form: saving keeps a real sub-account', await p.evaluate(() => T.find(x => x.id === 2).account) === 'Prop-sub 2');
  await p.evaluate(() => { adoptExMeta({ exMeta: { okx: { acct: 'Daytrade' } } }); render(); });
  ok('renamed again: the saved trade follows', await acct(1) === 'Daytrade', await acct(1));
  ok('renamed again: the sub-account still keeps its own name', await acct(2) === 'Prop-sub 2', await acct(2));
  const nw = await p.evaluate(() => { const n = T.length; openForm(null); document.getElementById('f_exchange').value = 'okx'; document.getElementById('f_pair').value = 'ETH/USDT'; document.getElementById('f_pnl').value = '5'; submitForm(null); return T.length > n ? T[0].account : 'not saved'; });
  ok('form: a new trade gets no copied label either', nw === '', nw);

  ok('no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Account-label: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
