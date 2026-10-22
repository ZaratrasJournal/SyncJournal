// Sync log (Denny 22-10-2026): "is het een idee om dit bij te houden? een soort last sync since?"
// Every sync is logged (time, exchange, automatic or by hand, new trades, error); the account row says how the
// last one went; a dot by the balance shows whether automatic sync is on schedule; Settings has the history.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const NU = Date.parse('2026-10-22T20:00:00Z');

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(new Date(NU));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  // OKX with a fake API: window.__trades comes in, window.__fout makes the trade history fail
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {}
    const o = ExchangeAPI.okx; let id = 1;
    o.fetchOpenPositions = async () => []; o.fetchFills = async () => [];
    o.fetchTrades = async () => { if (window.__fout) throw new Error(window.__fout); return (window.__trades || []).splice(0).map(t => ({ ...EMPTY_TRADE, id: 'okx_t' + (id++), source: 'okx', status: 'closed', pair: 'BTC/USDT',
      direction: 'long', entry: '80000', exit: '80100', pnl: '1', fees: '0', positionSizeAsset: '0.01', openTime: String(Date.now() - 36e5), closeTime: String(Date.now() - 6e5), date: '2026-10-22', time: '20:00', ...t })); };
    window.proxyCall = async () => ({ success: true, balance: '100' });
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', hint: 'abcd', syncFrom: '2026-10-01' }; persistConns();
    SYNC.auto = true; SYNC.interval = '15m'; persistSync(); });
  const status = () => p.evaluate(() => { go('instellingen'); STATE.setTab = 'accounts'; render();
    const rij = [...document.querySelectorAll('.setrow')].find(r => /OKX/.test((r.querySelector('b') || {}).textContent || ''));
    const dot = document.getElementById('syncDot');
    const hist = [...document.querySelectorAll('details')].find(d => /Sync-geschiedenis/.test(d.textContent));
    return { rij: rij ? rij.querySelector('small').textContent.replace(/\s+/g, ' ') : '', dot: dot ? { kleur: dot.dataset.s, titel: dot.title } : null,
      hist: hist ? [...hist.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) : null, leeg: hist ? hist.textContent.replace(/\s+/g, ' ') : '',
      log: DB.load('synclog', []) }; });

  console.log('─── Nog geen sync ───');
  let s = await status();
  ok('geschiedenis is er, met uitleg dat er nog niets is', s.hist && s.hist.length === 0 && /Nog geen syncs/.test(s.leeg), JSON.stringify(s));

  console.log('─── Met de hand gesynct, één nieuwe trade ───');
  await p.evaluate(async () => { window.__trades = [{}]; await syncExchange('okx'); });
  s = await status();
  ok('logboek: OKX, handmatig, 1 nieuw, geen fout', s.log.length === 1 && s.log[0].ex === 'okx' && s.log[0].auto === false && s.log[0].n === 1 && !s.log[0].fout, JSON.stringify(s.log));
  ok('rij bij OKX: laatste sync 22:00 (zojuist) · handmatig · 1 nieuwe trade', /laatste sync 22:00 \(zojuist\) · handmatig · 1 nieuwe trade/.test(s.rij), s.rij);
  ok('geschiedenis toont hem: 22:00, OKX, handmatig, 1 nieuw', s.hist.length === 1 && /22:00/.test(s.hist[0]) && /OKX/.test(s.hist[0]) && /handmatig/.test(s.hist[0]) && /1 nieuw/.test(s.hist[0]), JSON.stringify(s.hist));
  ok('stip bij de balans: groen, met wanneer en hoe vaak', s.dot && s.dot.kleur === 'ok' && /22:00/.test(s.dot.titel) && /elke 15 min/.test(s.dot.titel), JSON.stringify(s.dot));

  console.log('─── 10 minuten later: de automatische sync ───');
  await p.clock.setFixedTime(new Date(NU + 10 * 60e3));
  await p.evaluate(() => autoSyncRun(false));
  s = await status();
  ok('logboek: automatisch, geen nieuwe trades', s.log.length === 2 && s.log[0].auto === true && s.log[0].n === 0, JSON.stringify(s.log[0]));
  ok('rij bij OKX: · automatisch · geen nieuwe trades', /laatste sync 22:10 \(zojuist\) · automatisch · geen nieuwe trades/.test(s.rij), s.rij);

  console.log('─── 40 minuten niets: de automatische sync liep niet ───');
  await p.clock.setFixedTime(new Date(NU + 50 * 60e3));
  s = await status();
  ok('stip oranje: langer dan twee keer het interval niet gesynct', s.dot.kleur === 'laat' && /40 min geleden/.test(s.dot.titel), JSON.stringify(s.dot));
  ok('de rij zegt hoe lang geleden: (40 min geleden)', /\(40 min geleden\)/.test(s.rij), s.rij);

  console.log('─── Een sync die mislukt ───');
  await p.evaluate(async () => { window.__fout = 'OKX: rate limit (50011)'; await autoSyncRun(false); window.__fout = null; });
  s = await status();
  ok('logboek: de fout staat erin', s.log[0].fout === 'OKX: rate limit (50011)' && s.log[0].auto === true && s.log[0].n == null, JSON.stringify(s.log[0]));
  ok('rij bij OKX: mislukt, met de reden', /mislukt: OKX: rate limit \(50011\)/.test(s.rij), s.rij);
  ok('stip rood bij een mislukte laatste sync', s.dot.kleur === 'fout' && /mislukt/.test(s.dot.titel), JSON.stringify(s.dot));
  ok('geschiedenis: nieuwste bovenaan, met de fout', /mislukt/.test(s.hist[0]) && s.hist.length === 3, JSON.stringify(s.hist));

  console.log('─── Grenzen ───');
  await p.evaluate(async () => { for (let i = 0; i < 55; i++) await syncExchange('okx', { quiet: true }); });
  s = await status();
  ok('het logboek houdt de laatste 50', s.log.length === 50 && s.hist.length === 50, String(s.log.length));
  ok('het logboek gaat mee in je export', await p.evaluate(() => Array.isArray(snapshotPayload().synclog) && snapshotPayload().synclog.length === 50));
  await p.evaluate(() => { SYNC.auto = false; persistSync(); render(); });
  s = await status();
  ok('automatisch uit: stip grijs, en zegt dat', s.dot.kleur === 'uit' && /staat uit/.test(s.dot.titel), JSON.stringify(s.dot));
  await p.evaluate(() => { CONNS = {}; persistConns(); render(); });
  s = await status();
  ok('geen koppeling: geen stip', !s.dot || s.dot.kleur === 'geen', JSON.stringify(s.dot));
  for (const th of ['dark', 'light']) await p.evaluate(th => { setTheme(th); go('instellingen'); }, th);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Sync-logboek: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
