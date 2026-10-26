// Review redesign (v1.9, Denny 14-10-2026): per-trade layout, image mode with month cards, a
// persistent selection with a "Selectie & delen" panel, presentation with a thumbnail strip,
// coach feedback stored on the trade, and "Kopieer voor Discord". Design: demos/review-beeld-demo-v5.html.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';
const mk = (id, over) => Object.assign({ id, date: '2026-09-' + String(id).padStart(2, '0'), time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'BOS-retest', session: 'London', timeframe: '15M', market: 'Trending', grade: 'A', exchange: 'blofin', status: 'closed', kind: 'live', pnl: 540, r: 2.4, pnlPct: 1.8, entry: 63450, stop: 62800, tp: 65100, exit: 65010, size: 8000, risk: 1, leverage: 5, rrPlanned: 2.5, reviewed: false, tags: [], layers: [], emotions: ['Kalm'], emotion: 'Kalm', mistakes: [], mistake: '', screenshots: [], tvLinks: [], notes: '', lessons: '', coach: '', checks: [true, true, true, true, true], rating: 5 }, over || {});
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));
  const seed = async (rows, extra) => { await p.evaluate(([rows, extra]) => { T = rows.map(r => ({ ...r })); STATE.revShareSel = []; STATE.revMonth = 0; STATE.revSel = rows[0] ? rows[0].id : 0; persist(); clearGFilter(); go('review'); if (extra === 'beeld') setRevMode('beeld'); else if (typeof setRevMode === 'function') setRevMode('trade'); }, [rows, extra || '']); await p.waitForTimeout(300); };

  console.log('─── Coach-feedback als veld ───');
  await seed([mk(1, { coach: 'Wacht op de close <b>x</b>' }), mk(2)]);
  ok('coach blijft na sanitizeTrade', await p.evaluate(() => sanitizeTrade({ coach: 'abc' }, 1).coach === 'abc'));
  ok('coach geen string → leeg', await p.evaluate(() => sanitizeTrade({ coach: { x: 1 } }, 1).coach === ''));
  ok('coach verhuist mee bij sluiten (SJ_USER_FIELDS)', await p.evaluate(() => SJ_USER_FIELDS.includes('coach')));
  await p.evaluate(() => saveCoach(2, 'Goede trade'));
  ok('saveCoach bewaart', await p.evaluate(() => T.find(x => x.id === 2).coach === 'Goede trade'));
  const pk = await p.evaluate(() => coachPkgHTML([T.find(x => x.id === 1)], { name: 'D', hide: true, shotMap: {} }));
  ok('coach-feedback in het pakket, ge-escaped', pk.includes('Feedback van de coach') && pk.includes('&lt;b&gt;x') && !pk.includes('<b>x'));
  ok('oude "volgende versie"-tekst weg', !/volgende versie/.test(pk));

  console.log('─── Schakelaar + selectie ───');
  await seed([mk(1), mk(2), mk(3)]);
  ok('schakelaar met twee knoppen', await p.evaluate(() => document.querySelectorAll('.revmodes button').length === 2));
  ok('standaard Per trade', await p.evaluate(() => STATE.revMode === 'trade'));
  ok('elke lijstregel heeft een vakje', await p.evaluate(() => document.querySelectorAll('.revitem .revcbx').length === 3));
  ok('geen deel-modus meer', await p.evaluate(() => typeof toggleShareMode === 'undefined' && typeof openShareDialog === 'undefined'));
  const openVoor = await p.evaluate(() => STATE.revSel);
  await p.evaluate(() => document.querySelectorAll('.revitem .revcbx')[1].click());
  ok('vakje selecteert zonder te openen', await p.evaluate(v => STATE.revShareSel.length === 1 && STATE.revSel === v, openVoor));
  ok('vakje toont volgnummer', await p.evaluate(() => document.querySelector('.revitem .revcbx.on').textContent.trim() === '1'));
  await p.evaluate(() => { STATE.revShareSel = []; revSelToggle(2); revSelToggle(3); revSelMove(1, -1); });
  ok('volgorde verschuiven', await p.evaluate(() => STATE.revShareSel.join() === '3,2'));
  await p.evaluate(() => setRevMode('beeld'));
  ok('selectie blijft over de schakelaar', await p.evaluate(() => STATE.revShareSel.length === 2 && STATE.revMode === 'beeld'));
  await p.evaluate(() => { T = T.filter(x => x.id !== 3); persist(); });
  ok('verdwenen trade valt uit revSelTrades', await p.evaluate(() => revSelTrades().map(t => t.id).join() === '2'));
  await p.evaluate(() => { setRevMode('trade'); revSelClear(); });
  ok('Wissen leegt de selectie', await p.evaluate(() => STATE.revShareSel.length === 0));

  console.log('─── Per trade ───');
  await seed([mk(1, { screenshots: [PNG], tvLinks: ['https://www.tradingview.com/x/abc/'], coach: 'Top', layers: [{ timeframe: '4H', bias: 'Bullish', confirmations: ['OB'], setups: [] }, { timeframe: '1H', setups: ['BOS'], confirmations: [] }] }),
    mk(2, { stop: 0, r: 0, screenshots: [] })]);
  ok('18 tegels', await p.evaluate(() => document.querySelectorAll('.revtrade .revtiles > div').length === 18));
  ok('lagen top-down als 4H → 1H', await p.evaluate(() => document.querySelector('.revtiles').textContent.includes('4H → 1H')));
  ok('HTF-bias Bullish groen', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].some(d => d.textContent.includes('HTF-bias') && d.querySelector('.g'))));
  ok('grote chart = eerste screenshot', await p.evaluate(() => !!document.querySelector('.revshot-main img')));
  ok('TV-link zichtbaar', await p.evaluate(() => !!document.querySelector('.revtrade .tvlink')));
  ok('coach-veld gevuld', await p.evaluate(() => document.querySelector('.revgrid textarea.coach').value === 'Top'));
  ok('bedragen gemaskeerd', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].filter(d => /P&L|Fees|Size/.test(d.textContent)).every(d => d.querySelector('.mask'))));
  ok('oude kolommen weg', await p.evaluate(() => !document.querySelector('.revmid') && !document.querySelector('.revshots-col')));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('→ naar volgende trade', await p.evaluate(() => STATE.revSel === 2));
  ok('zonder stop: Behaald = streepje', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].find(d => d.textContent.includes('Behaald')).textContent.includes('—')));
  ok('zonder screenshot: lege staat met uitleg', await p.evaluate(() => /Nog geen screenshot/.test(document.querySelector('.revshot-main').textContent)));
  await p.evaluate(() => document.querySelector('.revgrid textarea').focus()); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  ok('pijltjes in een tekstvak bladeren niet', await p.evaluate(() => STATE.revSel === 2));
  await p.evaluate(() => { document.querySelector('.revgrid textarea.coach').value = 'Nieuw'; document.querySelector('.revgrid textarea.coach').dispatchEvent(new Event('blur')); });
  ok('coach-veld bewaart bij verlaten', await p.evaluate(() => T.find(x => x.id === 2).coach === 'Nieuw'));

  console.log('─── Beeld-modus ───');
  const BAD = 'x" onerror="alert(1)';
  await seed([mk(1, { date: '2026-09-29', screenshots: [PNG], setup: '<img src=x onerror=alert(1)>' }),
    mk(2, { date: '2026-09-20', tvLinks: ['https://www.tradingview.com/x/a/'] }),
    mk(3, { date: '2026-08-10', screenshots: [PNG] }),
    mk(4, { date: '2026-09-21' }),
    mk(5, { date: '2026-09-22', screenshots: [BAD] })], 'beeld');
  ok('nieuwste maand eerst (september)', await p.evaluate(() => /september 2026/.test(document.querySelector('.revmonth h2').textContent)));
  // since 26-10-2026 (Zaratras) trades without an image keep their place as a "Geen afbeelding" tile
  ok('alle trades van de maand, ook zonder beeld', await p.evaluate(() => document.querySelectorAll('.revcard').length === 4 && document.querySelectorAll('.revcard .noshot:not(.fallback)').length === 2));
  ok('kaart heeft 8 tegels', await p.evaluate(() => document.querySelectorAll('.revcard')[0].querySelectorAll('.revtiles > div').length === 8));
  ok('winst = groene rand', await p.evaluate(() => document.querySelector('.revcard').classList.contains('win')));
  ok('setup ge-escaped', await p.evaluate(() => !document.querySelector('.revcard img[src="x"]') && document.querySelector('.revcard').textContent.includes('<img')));
  ok('img lazy', await p.evaluate(() => [...document.querySelectorAll('.revcard img')].every(i => i.loading === 'lazy')));
  ok('presenteerknop zonder selectie = maand', await p.evaluate(() => /Presenteer maand/.test(document.querySelector('.revmonth').textContent)));
  await p.evaluate(() => revMonthGo(1)); await p.waitForTimeout(100);
  ok('‹ naar augustus', await p.evaluate(() => /augustus 2026/.test(document.querySelector('.revmonth h2').textContent)));
  ok('oudste maand: ‹ uitgeschakeld', await p.evaluate(() => document.querySelector('.revmonth .mbtn').disabled));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('→ terug naar september', await p.evaluate(() => /september 2026/.test(document.querySelector('.revmonth h2').textContent)));
  await p.evaluate(() => { const b = [...document.querySelectorAll('.revcard .linkbtn')].find(x => /Open trade/.test(x.textContent)); b.click(); });
  ok('Open trade → Per trade op die trade', await p.evaluate(() => STATE.revMode === 'trade' && STATE.revSel === 1));
  await p.evaluate(() => { T = T.map(t => ({ ...t, screenshots: [], tvLinks: [] })); persist(); setRevMode('beeld'); });
  ok('zonder beelden: tegels "Geen afbeelding", geen lege staat', await p.evaluate(() => !document.querySelector('.empty') && [...document.querySelectorAll('.revcard')].every(c => /Geen afbeelding/.test(c.textContent))));
  await p.evaluate(() => setRevMode('trade'));

  console.log('─── Beeld: 3000 trades ───');
  const perf = await p.evaluate((PNG) => {
    const rows = []; for (let i = 0; i < 3000; i++) { const d = new Date(Date.UTC(2025, 9, 1) + i * 3 * 3600e3 * 4); rows.push({ id: 10000 + i, date: d.toISOString().slice(0, 10), time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'X', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', pnl: 10, r: 1, entry: 1, stop: 0.9, exit: 1.1, screenshots: [PNG], tvLinks: [], layers: [], tags: [], emotions: [], mistakes: [] }); }
    T = rows; persist(); STATE.revMonth = 0; setRevMode('beeld');
    const t0 = performance.now(); render(); const ms = performance.now() - t0;
    const k = revMonths()[0]; return { ms, cards: document.querySelectorAll('.revcard').length, inMonth: k.list.length };
  }, PNG);
  ok('alleen de kaarten van één maand', perf.cards === perf.inMonth && perf.cards < 400, JSON.stringify(perf));
  ok('render in Beeld onder 300 ms', perf.ms < 300, Math.round(perf.ms) + ' ms');
  await p.evaluate(() => setRevMode('trade'));

  console.log('─── Selectie & delen ───');
  await seed([mk(1, { date: '2026-09-29', screenshots: [PNG], layers: [{ timeframe: '4H', bias: 'Bullish', setups: ['SFP'], confirmations: ['OB'] }, { timeframe: '1H', setups: ['BOS'], confirmations: [] }] }),
    mk(2, { date: '2026-09-20', screenshots: [PNG], coach: 'Let op <script>' })], 'beeld');
  ok('paneel zonder selectie: uitleg + knoppen uit', await p.evaluate(() => /Vink kaarten aan/.test(document.querySelector('.revsel').textContent) && document.querySelector('#revPkgBtn').disabled));
  await p.evaluate(() => revSelMonth());
  ok('+ Hele maand selecteert de maand', await p.evaluate(() => STATE.revShareSel.length === 2));
  ok('paneel toont volgorde met pijltjes', await p.evaluate(() => document.querySelectorAll('.revsel .bitem').length === 2));
  ok('presenteerknop wordt "geselecteerde (2)"', await p.evaluate(() => /geselecteerde \(2\)/.test(document.querySelector('.revmonth').textContent)));
  const dl = p.waitForEvent('download');
  await p.evaluate(() => { document.getElementById('revShareName').value = 'Denny'; downloadCoachPackage(); });
  const html = require('fs').readFileSync(await (await dl).path(), 'utf8');
  ok('pakket gedownload met naam', /Gedeeld door <b>Denny/.test(html));
  ok('pakket bevat coach-feedback ge-escaped', html.includes('Let op &lt;script&gt;'));
  ok('pakket bevat de lagen', /Lagen/.test(html) && /4H/.test(html) && /SFP/.test(html));
  ok('naam onthouden', await p.evaluate(() => DB.load('share_name', '') === 'Denny'));
  ok('selectie blijft na download (ook nog naar Discord)', await p.evaluate(() => STATE.revShareSel.length === 2));
  await p.evaluate(() => { revSelClear(); setRevMode('trade'); });

  console.log('─── Presentatie ───');
  await seed([mk(1, { date: '2026-09-29', screenshots: [PNG, PNG] }), mk(2, { date: '2026-09-20', tvLinks: ['https://www.tradingview.com/x/a/'], notes: '<img src=x onerror=alert(1)>' })], 'beeld');
  await p.evaluate(() => document.querySelector('.revmonth .btn').click()); await p.waitForTimeout(150);
  ok('presenteer maand opent overlay', await p.evaluate(() => document.getElementById('revpres').classList.contains('on')));
  ok('miniaturen = 3 (2 beelden + 1 TV-only)', await p.evaluate(() => document.querySelectorAll('#revpres .film .f').length === 3));
  ok('zijpaneel met info + coach-veld', await p.evaluate(() => !!document.querySelector('#revpres aside .revtiles') && !!document.querySelector('#revpres aside textarea.coach')));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  ok('→ door de items, ook naar TV-only', await p.evaluate(() => /Alleen een TradingView-link/.test(document.querySelector('#revpres .stage').textContent)));
  ok('maand blijft staan tijdens presenteren', await p.evaluate(() => STATE.revMonth === 0));
  ok('notitie ge-escaped in zijpaneel', await p.evaluate(() => !document.querySelector('#revpres aside img[src="x"]')));
  await p.evaluate(() => { const ta = document.querySelector('#revpres aside textarea.coach'); ta.value = 'Mooi'; ta.dispatchEvent(new Event('blur')); });
  ok('coach invullen in presentatie bewaart', await p.evaluate(() => T.find(x => x.id === 2).coach === 'Mooi'));
  await p.evaluate(() => document.querySelectorAll('#revpres .film .f')[0].click());
  ok('klik op miniatuur springt', await p.evaluate(() => revPres.i === 0));
  await p.evaluate(() => setEmotion(1, 'Kalm'));
  ok('overlay blijft open na een render()', await p.evaluate(() => document.getElementById('revpres').classList.contains('on')));
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('Esc sluit', await p.evaluate(() => !document.getElementById('revpres').classList.contains('on') && revPres === null));
  await p.evaluate(() => document.querySelector('.revcard .cardshot').click()); await p.waitForTimeout(100);
  // since 26-10-2026 (Zaratras): the month in page order, with the trade details beside the image
  ok('klik op kaartbeeld: de maand, op die trade, met gegevens', await p.evaluate(() => revPres.panel === 'info' && revPres.items[revPres.i].id === 1 && new Set(revPres.items.map(x => x.id)).size === 2 && !!document.querySelector('#revpres aside .birows')));
  await p.evaluate(() => go('dashboard'));
  ok('naar een andere pagina sluit de presentatie', await p.evaluate(() => revPres === null && !document.getElementById('revpres').classList.contains('on')));

  console.log('─── Discord ───');
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await seed([mk(1, { screenshots: [PNG], notes: 'Netjes', layers: [{ timeframe: '4H', bias: 'Bullish', setups: [], confirmations: [] }, { timeframe: '1H', setups: [], confirmations: [] }], tvLinks: ['https://www.tradingview.com/x/a/'] }),
    mk(2, { screenshots: ['https://example.com/x.png'], stop: 0, r: 0 }), mk(3, { screenshots: [] })]);
  const tx = await p.evaluate(() => revDiscordTekst(T.find(t => t.id === 1), true));
  ok('tekst: pair, richting, lagen, R', /\*\*BTC\/USDT LONG\*\*/.test(tx) && tx.includes('4H → 1H') && /[+−][\d,]+R/.test(tx), tx);
  ok('tekst: verborgen bedragen = geen bedrag', !/\$|540/.test(tx), tx);
  ok('tekst: notitie en TV-link mee', tx.includes('Netjes') && tx.includes('tradingview.com/x/a/'));
  ok('tekst met bedragen als je dat wilt', /540/.test(await p.evaluate(() => revDiscordTekst(T.find(t => t.id === 1), false))));
  ok('tekst zonder stop: R als streepje', /· —/.test(await p.evaluate(() => revDiscordTekst(T.find(t => t.id === 2), true))));
  const r1 = await p.evaluate(() => revDiscord(1));
  ok('met screenshot: beeld naar klembord of download', r1 === 'beeld' || r1 === 'download', r1);
  const r2 = await p.evaluate(() => revDiscord(2));
  ok('externe screenshot: geen crash, alleen tekst', r2 === 'tekst', r2);
  const r3 = await p.evaluate(() => revDiscord(3));
  ok('zonder screenshot: alleen tekst', r3 === 'tekst', r3);
  await p.unroute('**/*');

  console.log('─── Eindreview-fixes ───');
  await seed([mk(7, { date: '2026-09-07', screenshots: [PNG] }), mk(8, { date: '2026-09-08', screenshots: [PNG], pair: 'ETH/USDT' }), mk(9, { date: '2026-09-09', screenshots: [PNG] })]);
  await p.evaluate(() => { go('trades'); });
  ok('Trades-tabel: selectiekolom blijft een tabelcel', await p.evaluate(() => { const td = document.querySelector('td.cbx'); return !!td && getComputedStyle(td).display === 'table-cell'; }));
  await p.evaluate(() => { go('review'); setRevMode('beeld'); revSelToggle(7); revSelToggle(8); revSelToggle(9); T = T.filter(t => t.id !== 7); persist(); render(); });
  ok('verwijderde trade valt uit de selectie', await p.evaluate(() => STATE.revShareSel.join() === '8,9'));
  ok('vakje-nummer = plek in het paneel', await p.evaluate(() => [...document.querySelectorAll('.revcard')].find(c => c.textContent.includes('09-09')).querySelector('.revcbx').textContent.trim() === '2'));
  await p.evaluate(() => revSelMove(0, 1));
  ok('▼ verschuift zichtbaar', await p.evaluate(() => STATE.revShareSel.join() === '9,8'));
  await p.evaluate(() => { revSelClear(); setRevMode('trade'); STATE.revQuery = 'eth'; render(); setRevMode('beeld'); });
  ok('Beeld negeert de zoekterm van Per trade', await p.evaluate(() => document.querySelectorAll('.revcard').length === 2));
  await p.evaluate(() => { STATE.revQuery = ''; setRevFilter('done'); });
  ok('Beeld met "Gereviewed" en niets gereviewd: statusknoppen blijven zichtbaar', await p.evaluate(() => !!document.querySelector('.revfilters') && !!document.querySelector('.empty')));
  await p.evaluate(() => { setRevFilter('all'); setRevMode('trade'); });
  const pkJs = await p.evaluate(() => coachPkgHTML([{ ...T[0], tvLinks: ['javascript:alert(1)', 'https://www.tradingview.com/x/ok/'] }], { name: 'D', hide: true, shotMap: {} }));
  ok('coach-pakket: geen javascript:-link', !/javascript:/i.test(pkJs) && pkJs.includes('tradingview.com/x/ok/'));
  const pkR = await p.evaluate(() => coachPkgHTML([{ ...T[0], stop: 0, r: 0 }], { name: 'D', hide: true, shotMap: {} }));
  ok('coach-pakket: zonder stop geen +0,0R', !/\+0,0+R/.test(pkR), (pkR.match(/[+−]0,0+R/) || [''])[0]);
  await p.evaluate(() => { setRevMode('beeld'); openRevPres([8, 9], null, true); openForm(8); });
  ok('formulier opent bóven de presentatie', await p.evaluate(() => +getComputedStyle(document.getElementById('modal')).zIndex > +getComputedStyle(document.getElementById('revpres')).zIndex));
  await p.evaluate(() => { formDirty = false; closeForm(); });
  await p.evaluate(() => { const a = document.querySelector('#revpres aside'); a.scrollTop = 400; setRating(8, 4); });
  ok('zijpaneel houdt zijn scrollpositie na een klik', await p.evaluate(() => document.querySelector('#revpres aside').scrollTop > 100));
  await p.evaluate(() => { closeRevPres(); setRevMode('trade'); });
  ok('FAQ beschrijft de nieuwe flow (geen "⤴ Deel")', await p.evaluate(() => { go('faq'); const t = document.getElementById('main').textContent; go('review'); return !/⤴ Deel/.test(t) && /Selectie & delen/.test(t); }));

  console.log('─── F1: take-profits in presentatie en Discord ───');
  const TPS = [{ price: 81230, pct: 50, hit: true }, { price: 82009, pct: 30, hit: true }, { price: 82616, pct: 20, hit: false }];
  await seed([mk(1, { date: '2026-09-29', screenshots: [PNG], tps: TPS }), mk(2, { date: '2026-09-28', screenshots: [PNG], tps: [] }),
    mk(3, { date: '2026-09-27', screenshots: [PNG], tps: [1, 2, 3, 4, 5, 6].map(i => ({ price: 60000 + i * 100, pct: 10, hit: i < 3 })) })], 'beeld');
  await p.evaluate(() => openRevPres([1], 1, true));
  ok('presentatie: blok Take-profits met 3 regels', await p.evaluate(() => document.querySelectorAll('#revpres aside .revtps > span').length === 3));
  ok('presentatie: prijs, % en ✓ bij geraakt', await p.evaluate(() => { const s = [...document.querySelectorAll('#revpres aside .revtps > span')].map(x => x.textContent); return /TP1/.test(s[0]) && /81\.230/.test(s[0]) && /50%/.test(s[0]) && /✓/.test(s[0]) && !/✓/.test(s[2]); }));
  await p.evaluate(() => openRevPres([2], 2, true));
  ok('presentatie zonder TP\'s: geen leeg kopje', await p.evaluate(() => !document.querySelector('#revpres aside .revtps') && !/Take-profits/.test(document.querySelector('#revpres aside').textContent)));
  await p.evaluate(() => closeRevPres());
  const txTp = await p.evaluate(() => revDiscordTekst(T.find(t => t.id === 1), true));
  ok('Discord-tekst: TP-regel', /TP1 81\.230 ✓ · TP2 82\.009 ✓ · TP3 82\.616/.test(txTp), txTp);
  ok('Discord-tekst zonder TP\'s: geen TP-regel', !/TP1/.test(await p.evaluate(() => revDiscordTekst(T.find(t => t.id === 2), true))));
  const rg = await p.evaluate(() => revTpRegels(T.find(t => t.id === 3)));
  ok('Discord-beeld: maximaal 4 TP-regels + "+2"', rg.length === 5 && rg[4].l === '+2' && rg[0].hit === true && rg[3].hit === false, JSON.stringify(rg));
  ok('Discord-beeld zonder TP\'s: geen regels', (await p.evaluate(() => revTpRegels(T.find(t => t.id === 2)))).length === 0);

  console.log('─── Privacy-modus in het coach-pakket ───');
  await seed([mk(1, { date: '2026-09-29', screenshots: [PNG] })], 'beeld');
  await p.evaluate(() => { STATE.revShareSel = [1]; STATE.shareHide = false; STATE.priv = true; render(); });
  const dlPriv = p.waitForEvent('download');
  await p.evaluate(() => downloadCoachPackage());
  const htmlPriv = require('fs').readFileSync(await (await dlPriv).path(), 'utf8');
  const bedrag = await p.evaluate(() => eurS(540));
  ok('privacy-modus aan, vinkje uit: geen bedrag in het coach-pakket', !htmlPriv.includes(bedrag), bedrag);
  await p.evaluate(() => { STATE.priv = false; STATE.shareHide = true; revSelClear(); setRevMode('trade'); });

  //@@NEXT

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} ✓  ${fail} ✗`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
