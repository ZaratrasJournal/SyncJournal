// F2 (backlog): "Kopieer voor Discord" with several selected trades. The browser clipboard holds one
// image at a time, so the button walks through the selection one trade per click, and a second
// button downloads one PNG per trade with all texts on the clipboard.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';
const mk = (id, over) => Object.assign({ id, date: '2026-10-' + String(id).padStart(2, '0'), time: '10:00', pair: 'BTC/USDC', dir: 'long', setup: 'BOS-retest', session: 'London', exchange: 'blofin', status: 'closed', kind: 'live', pnl: 540, r: 2.4, entry: 63450, stop: 62800, exit: 65010, size: 8000, risk: 1, leverage: 5, rrPlanned: 2.5, reviewed: false, tags: [], layers: [], emotions: [], mistakes: [], screenshots: [PNG], tvLinks: [], notes: '', lessons: '', coach: '' }, over || {});
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const downloads = []; p.on('download', d => downloads.push(d.suggestedFilename()));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  // Fake clipboard: records what is written; window.__clipFail makes image writes fail, window.__clipHold keeps them pending.
  await p.evaluate(() => {
    window.__clip = []; window.__clipText = [];
    navigator.clipboard.write = async items => { if (window.__clipHold) await new Promise(r => { window.__clipRelease = r; }); if (window.__clipFail) throw new Error('NotAllowed'); window.__clip.push(items[0].types.join()); };
    navigator.clipboard.writeText = async s => { window.__clipText.push(s); };
  });
  const seed = async (rows, sel) => { await p.evaluate(([rows, sel]) => { T = rows.map(r => ({ ...r })); STATE.revShareSel = sel.slice(); STATE.revMonth = 0; STATE.shareHide = true; STATE.priv = false; persist(); clearGFilter(); go('review'); setRevMode('beeld'); }, [rows, sel]); await p.waitForTimeout(200); };
  const btn = () => p.evaluate(() => { const e = document.getElementById('revDcBtn'); return e ? { t: e.textContent.replace(/\s+/g, ' ').trim(), dis: e.disabled } : null; });
  const lastToast = () => p.evaluate(() => { const l = document.querySelectorAll('#toasts .toast'); return l.length ? l[l.length - 1].textContent : ''; });
  const klik = async () => { await p.evaluate(() => document.getElementById('revDcBtn').click()); await p.waitForFunction(() => !revDcBusy); await p.waitForTimeout(50); };

  console.log('─── Geen selectie / één trade ───');
  await seed([mk(5), mk(6, { pair: 'ETH/USDT' }), mk(7, { pair: 'SOL/USDT' })], []);
  let k = await btn();
  ok('geen selectie: knop uit', k && k.dis, JSON.stringify(k));
  ok('geen selectie: geen "Alle beelden"-knop', await p.evaluate(() => !document.getElementById('revDcAllBtn')));
  await seed([mk(5), mk(6, { pair: 'ETH/USDT' }), mk(7, { pair: 'SOL/USDT' })], [5]);
  k = await btn();
  ok('één trade: knop zoals nu', k && !k.dis && /^📋 Kopieer voor Discord/.test(k.t) && !/van/.test(k.t), JSON.stringify(k));
  ok('één trade: geen "Alle beelden"-knop', await p.evaluate(() => !document.getElementById('revDcAllBtn')));
  await klik();
  ok('één trade: beeld op het klembord', await p.evaluate(() => window.__clip.length === 1 && /image\/png/.test(window.__clip[0])));
  ok('één trade: toast zoals nu', /Beeld \+ tekst gekopieerd/.test(await lastToast()), await lastToast());
  ok('één trade: knop blijft zoals nu', /^📋 Kopieer voor Discord/.test((await btn()).t));

  console.log('─── Meerdere trades: één voor één ───');
  await seed([mk(5), mk(6, { pair: 'ETH/USDT' }), mk(7, { pair: 'SOL/USDT' })], [5, 6, 7]);
  await p.evaluate(() => { window.__clip = []; });
  k = await btn();
  ok('eerst "Kopieer 1 van 3 (BTC/USDC 05-10)"', /Kopieer 1 van 3 \(BTC\/USDC 05-10\)/.test(k.t), k.t);
  await klik();
  ok('toast: "1 van 3 gekopieerd. Plak in Discord en klik dan op Volgende."', /1 van 3 gekopieerd\. Plak in Discord en klik dan op Volgende\./.test(await lastToast()), await lastToast());
  k = await btn();
  ok('na een klik "2 van 3 (ETH/USDT 06-10)"', /Kopieer 2 van 3 \(ETH\/USDT 06-10\)/.test(k.t), k.t);
  await klik();
  ok('daarna "3 van 3"', /Kopieer 3 van 3 \(SOL\/USDT 07-10\)/.test((await btn()).t), (await btn()).t);
  await klik();
  ok('na de laatste weer vanaf 1', /Kopieer 1 van 3/.test((await btn()).t), (await btn()).t);
  ok('drie beelden naar het klembord', await p.evaluate(() => window.__clip.length === 3));

  console.log('─── Andere selectie zet de teller terug ───');
  await klik();
  ok('stand op 2 van 3', /2 van 3/.test((await btn()).t));
  await p.evaluate(() => revSelMove(0, 1));
  ok('volgorde verschuiven: terug naar 1', /Kopieer 1 van 3 \(ETH\/USDT/.test((await btn()).t), (await btn()).t);
  await klik();
  await p.evaluate(() => revSelToggle(7));
  ok('trade weghalen: terug naar 1 van 2', /Kopieer 1 van 2/.test((await btn()).t), (await btn()).t);
  await klik();
  await p.evaluate(() => revSelToggle(7));
  ok('trade toevoegen: terug naar 1 van 3', /Kopieer 1 van 3/.test((await btn()).t), (await btn()).t);

  console.log('─── Bezig met maken ───');
  await p.evaluate(() => { window.__clipHold = true; document.getElementById('revDcBtn').click(); });
  await p.waitForFunction(() => revDcBusy);
  k = await btn();
  ok('tijdens maken: knop uit met ⏳', k.dis && /⏳/.test(k.t), JSON.stringify(k));
  await p.waitForFunction(() => typeof window.__clipRelease === 'function');
  await p.evaluate(() => { window.__clipHold = false; window.__clipRelease(); });
  await p.waitForFunction(() => !revDcBusy);
  ok('daarna door naar 2 van 3', /2 van 3/.test((await btn()).t), (await btn()).t);

  console.log('─── Trade zonder beeld, fout bij kopiëren ───');
  await seed([mk(5), mk(6, { pair: 'ETH/USDT', screenshots: [] }), mk(7, { pair: 'SOL/USDT' })], [5, 6, 7]);
  await klik(); await klik();
  ok('zonder screenshot: alleen tekst, met de stand', /2 van 3: Geen screenshot/.test(await lastToast()), await lastToast());
  ok('zonder screenshot: toch door naar 3 van 3', /3 van 3/.test((await btn()).t));
  downloads.length = 0;
  await p.evaluate(() => { window.__clipFail = true; });
  await klik();
  await p.waitForTimeout(200);
  ok('klembord weigert: beeld gedownload', downloads.length === 1 && downloads[0] === 'discord-2026-10-07-SOL-USDT.png', downloads.join());
  ok('klembord weigert: melding met uitweg "Alle beelden" (download)', await p.evaluate(() => { const l = [...document.querySelectorAll('#toasts .toast')].pop(); return /gedownload/.test(l.textContent) && !!l.querySelector('.tact') && /Alle beelden/.test(l.querySelector('.tact').textContent); }));
  await p.evaluate(() => { window.__clipFail = false; });

  console.log('─── Alle beelden voor Discord ───');
  await seed([mk(5), mk(6, { pair: 'ETH/USDT' }), mk(7, { pair: 'SOL/USDT' })], [5, 6, 7]);
  ok('tweede knop zichtbaar', await p.evaluate(() => /Alle beelden voor Discord/.test((document.getElementById('revDcAllBtn') || {}).textContent || '')));
  downloads.length = 0; await p.evaluate(() => { window.__clipText = []; });
  await p.evaluate(() => revDiscordAlles()); await p.waitForTimeout(300);
  ok('3 downloads met de juiste namen', downloads.join() === 'discord-2026-10-05-BTC-USDC.png,discord-2026-10-06-ETH-USDT.png,discord-2026-10-07-SOL-USDT.png', downloads.join());
  const tx = await p.evaluate(() => window.__clipText[window.__clipText.length - 1] || '');
  ok('teksten samen op het klembord', /BTC\/USDC/.test(tx) && /ETH\/USDT/.test(tx) && /SOL\/USDT/.test(tx), tx);
  ok('toast noemt toestemming voor meerdere downloads', /toestemming/.test(await lastToast()), await lastToast());
  await seed([mk(5), mk(6, { screenshots: [] }), mk(7)], [5, 6, 7]);
  downloads.length = 0;
  await p.evaluate(() => revDiscordAlles()); await p.waitForTimeout(300);
  ok('trade zonder beeld: 2 downloads, melding', downloads.length === 2 && /1 zonder beeld/.test(await lastToast()), downloads.join() + ' | ' + await lastToast());
  await seed([mk(5), mk(15, { date: '2026-10-05' })], [5, 15]);
  downloads.length = 0;
  await p.evaluate(() => revDiscordAlles()); await p.waitForTimeout(300);
  ok('zelfde dag en pair: geen dubbele naam', downloads.join() === 'discord-2026-10-05-BTC-USDC.png,discord-2026-10-05-BTC-USDC-2.png', downloads.join());

  console.log('─── Bedragen op het beeld ───');
  const getekend = (shareHide, priv) => p.evaluate(async ([shareHide, priv]) => {
    STATE.shareHide = shareHide; STATE.priv = priv; const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { seen.push(String(s)); return orig.call(this, s, ...a); };
    try { await revDiscordVolgende(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    return { seen: seen.join(' | '), amount: eurS(540) };
  }, [shareHide, priv]);
  await seed([mk(5)], [5]);
  let g = await getekend(false, false);
  ok('bedragen tonen als je dat wilt', g.seen.includes(g.amount), g.amount);
  g = await getekend(true, false);
  ok('"Bedragen verbergen": geen bedrag op het beeld', !g.seen.includes(g.amount));
  g = await getekend(false, true);
  ok('privacy-modus: geen bedrag op het beeld', !g.seen.includes(g.amount), g.seen);
  ok('privacy-modus: geen bedrag in de tekst', await p.evaluate(() => { STATE.shareHide = false; STATE.priv = true; const s = revHide(); STATE.priv = false; return s === true; }));
  await seed([mk(5), mk(6)], [5, 6]);
  await p.evaluate(() => { STATE.shareHide = false; STATE.priv = true; window.__clipText = []; });
  await p.evaluate(() => revDiscordAlles()); await p.waitForTimeout(300);
  ok('privacy-modus bij "Alle beelden": geen bedrag in de teksten', await p.evaluate(() => !window.__clipText.join().includes(eurS(540))));

  console.log('─── Licht, donker, telefoon ───');
  await seed([mk(5), mk(6, { pair: 'ETH/USDT' }), mk(7, { pair: 'SOL/USDT' })], [5, 6, 7]);
  for (const th of ['light', 'dark']) {
    await p.evaluate(th => setTheme(th), th); await p.waitForTimeout(150);
    await p.locator('.revsel').screenshot({ path: `tests/screenshots/discord-meerdere-${th}.png` });
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok('telefoon: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await p.evaluate(() => document.documentElement.scrollWidth));
  ok('telefoon: knoppen passen in het paneel', await p.evaluate(() => { const pr = document.querySelector('.revsel').getBoundingClientRect(); return ['revDcBtn', 'revDcAllBtn'].every(id => document.getElementById(id).getBoundingClientRect().right <= pr.right + 1); }));
  await p.locator('.revsel').screenshot({ path: 'tests/screenshots/discord-meerdere-telefoon.png' });
  await p.evaluate(() => setTheme('light'));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} ✓  ${fail} ✗`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
