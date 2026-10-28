// TradingPlan v3 ronde 3, punt 7 — Mori in een zijpaneel van het plan (docs/plan-v3-ronde3-2026-10-27.md).
//  1. Knop "Mori" bovenin opent het paneel, ook zonder vraag en zonder sleutel. Zonder sleutel: de uitleg van de
//     journal met "Mori instellen" (naar de journal zelf), geen sleutelveld in het paneel.
//  2. In het paneel draait de journal in embed-modus (?embed=mori): geen zijbalk, geen menu, geen banners, geen
//     welkom- of migratievenster, geen auto-sync, geen "← Terug naar je plan".
//  3. "Vraag Mori" (scenario en dagplan) blijft in het plan: het paneel opent en de journal stelt de vraag; daarna
//     kun je doorvragen. Ook een tweede vraag in een al geladen paneel komt aan.
//  4. Sluiten verbergt het paneel; het iframe en het gesprek blijven staan.
//  5. De embed schrijft niets aan trades, tags of instellingen: trades in IndexedDB en sj_tagconfig/sj_state zijn na
//     een hele sessie byte-gelijk; van de sj_-sleutels veranderen alleen die van Mori zelf.
//  6. Desktop: paneel ± 420 px rechts, de Cockpit wordt smaller; telefoon: volledig scherm, met sluiten. Licht en donker.
//  7. Het plan leest de sleutel nooit; geen echte aanroep naar Anthropic.
// Nep-Anthropic uit helpers/coach-nep.js: nooit een echte sleutel, nooit een echte aanroep.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const N = require('./helpers/coach-nep'); const NAAM = 'Plan v3 Mori-zijpaneel';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'B', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const A1 = 'Je Trend-pullback staat op n=4. Let op je bearish dag-bias.', A2 = 'Doorvraag-antwoord: wacht op de 15M BOS.', A3 = 'Je dagplan heeft één sterk scenario.';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  await N.vooraf(ctx, N.tekst(A1), N.tekst(A2), N.tekst(A3));
  await ctx.addInitScript(() => { window.__lees = []; const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { window.__lees.push(k); return g.call(this, k); }; });
  let netwerkAnthropic = 0; ctx.on('request', r => { if (/anthropic\.com/.test(r.url())) netwerkAnthropic++; });
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };

  // journal: trades, playbooks, tags (gewoon geopend, niet in embed)
  const j = await nieuw();
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  const DAG = await j.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date()));
  const WID = await j.evaluate(d => coachIsoWeek(d), DAG);
  const tr = (id, R, extra) => Object.assign({ id, exchange: 'okx', status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', setup: 'Trend-pullback', entry: 100, stop: 99, size: 1000, exit: 100 + R, pnl: R * 10, r: 0, fees: 0,
    date: '2026-10-01', time: '10:10', openTime: String(Date.parse('2026-10-01T09:10:00Z') + id * 864e5), closeTime: '', tps: [], layers: [{ timeframe: '15M', bias: '', setups: ['BOS'], confirmations: ['FVG'] }] }, extra || {});
  await j.evaluate(ts => { T = ts; TRASH = []; PBOOK['Trend-pullback'] = pbNormalize('Trend-pullback', { layers: [], defaultGrade: 'A' }); persistPbook(); persist(); render(); },
    [tr(1, 2), tr(2, -1), tr(3, 1.5), tr(4, -1), tr(5, 3, { setup: 'London SFP' }), tr(6, -1, { setup: 'London SFP', dir: 'short' })]);
  await j.waitForTimeout(400);
  await j.close();   // the plan tab is the only one from here on: the embed must not need a journal tab

  const PLAN = { v: 1, weeks: { [WID]: { id: WID, layers: [L('Weekly', ['BOS'], [], 'Bullish')], levels: '', noTrade: '', focus: '', media: leeg(), les: '' } },
    days: { [DAG]: { id: DAG, week: WID, layers: [L('4H', ['MSB'], [], 'Bearish')], levels: '', emoties: [], dagstart: [], off: [], media: leeg(), les: '', scenarios: [
      sc({ id: 's_btc', title: 'BTC trend-pullback', pb: 'Trend-pullback', grade: 'A', entry: L('15M', ['BOS'], ['FVG'], 'Bullish'), stop: '75020', tps: ['77400'], trades: [1] })] } } };
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' });
  await p.evaluate(P => { localStorage.setItem('tp3:plans', JSON.stringify(P)); }, PLAN);
  const herlaad = async () => { await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600); };
  await herlaad();
  const frame = () => p.frames().find(f => /[?&]embed=mori/.test(f.url()));
  const wachtFrame = async () => { for (let i = 0; i < 40 && !frame(); i++) await p.waitForTimeout(100); const f = frame(); if (f) { await f.waitForLoadState('load'); await f.waitForFunction(() => typeof STATE === 'object' && STATE.page === 'ai', null, { timeout: 6000 }).catch(() => {}); } return f; };
  const paneel = () => p.evaluate(() => { const el = document.getElementById('moripanel'); if (!el) return { er: false };
    const r = el.getBoundingClientRect(), ifr = el.querySelector('iframe'); return { er: true, zichtbaar: !el.hidden && r.width > 0 && getComputedStyle(el).display !== 'none', w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y),
      iframe: !!ifr, src: ifr ? ifr.getAttribute('src') : '', sluit: !!el.querySelector('[data-a="moriDicht"]') }; });

  console.log('--- 1. knop Mori, zonder sleutel ---');
  ok('knop "Mori" bovenin het plan, ook zonder sleutel', await p.evaluate(() => { const k = document.querySelector('.top [data-a="moriPaneel"]'); return !!k && /Mori/.test(k.textContent); }));
  ok('zonder sleutel: geen "Vraag Mori" op het scenario (zoals voorheen)', await p.evaluate(() => !document.querySelector('[data-a="mori"],[data-a="dagMori"]')));
  ok('nog geen paneel en geen iframe vóór het openen (niets laden wat je niet vraagt)', !(await paneel()).iframe);
  await p.click('.top [data-a="moriPaneel"]');
  let f = await wachtFrame(), pn = await paneel();
  ok('het paneel opent, met de journal in embed-modus', pn.zichtbaar && pn.iframe && /syncjournal\.html\?embed=mori$/.test(pn.src) && !!f, JSON.stringify(pn));
  ok('knop zegt dat het paneel open is (aria-expanded)', await p.evaluate(() => document.querySelector('.top [data-a="moriPaneel"]').getAttribute('aria-expanded') === 'true'));
  const zonder = f ? await f.evaluate(() => { const m = document.getElementById('main'), a = [...m.querySelectorAll('a')].find(x => /Mori instellen/.test(x.textContent));
    return { uitleg: /Zet Mori aan/.test(m.innerText), veld: !!document.getElementById('aiKeyInput'), link: a ? { href: a.getAttribute('href'), target: a.getAttribute('target') } : null }; }) : {};
  ok('zonder sleutel: de uitleg van Mori, geen sleutelveld in het paneel', zonder.uitleg && !zonder.veld, JSON.stringify(zonder));
  ok('zonder sleutel: "Mori instellen" opent Mori in de journal zelf (target _top)', !!zonder.link && /syncjournal\.html\?page=ai$/.test(zonder.link.href) && zonder.link.target === '_top', JSON.stringify(zonder.link));

  console.log('--- 2. embed is kaal en stil ---');
  const kaal = f ? await f.evaluate(() => { const zicht = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; };
    return { embed: document.body.classList.contains('embed'), side: zicht('.side'), appbar: zicht('.appbar'), welkom: (document.getElementById('welcome') || { classList: { contains: () => false } }).classList.contains('on'),
      modal: document.getElementById('modal').classList.contains('on'), sync: typeof _autoSyncTimer !== 'undefined' && !!_autoSyncTimer, banners: document.querySelectorAll('#main .updbanner').length, pagina: STATE.page }; }) : {};
  ok('embed: geen zijbalk, geen menu/kopbalk', kaal.embed && !kaal.side && !kaal.appbar, JSON.stringify(kaal));
  ok('embed: geen welkom- of migratievenster, geen banners', !kaal.welkom && !kaal.modal && kaal.banners === 0, JSON.stringify(kaal));
  ok('embed: geen auto-sync-timer', kaal.sync === false, JSON.stringify(kaal));
  ok('embed: opent op Mori', kaal.pagina === 'ai');
  await p.click('#moripanel [data-a="moriDicht"]'); await p.waitForTimeout(150);

  console.log('--- 3. vraag Mori in het paneel ---');
  await p.evaluate(k => sessionStorage.setItem('sj_ai_key', k), N.NEP);   // "alleen deze sessie": werkt omdat het iframe in hetzelfde tabblad draait
  await herlaad();
  const leesOpslag = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('sj_db', 1); r.onsuccess = () => { const g = r.result.transaction('kv', 'readonly').objectStore('kv').get('trades');
    g.onsuccess = () => { const sj = {}; Object.keys(localStorage).filter(k => /^sj_/.test(k)).sort().forEach(k => { sj[k] = localStorage.getItem(k); }); r.result.close(); res({ trades: JSON.stringify(g.result), sj }); }; }; }));
  const voor = await leesOpslag();
  ok('voor de vergelijking: er staan trades en instellingen', voor.trades.length > 100 && 'sj_state' in voor.sj, Object.keys(voor.sj).join());
  await p.click('.ritem[data-s="s_btc"] .rrow');
  const url0 = p.url();
  await p.click('.ritem[data-s="s_btc"] [data-a="mori"]');
  f = await wachtFrame();
  await f.waitForFunction(() => window.__nep && window.__nep.verzoeken.length > 0 && !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300);
  let v = await N.verzoeken(f);
  ok('het plan blijft staan (geen navigatie)', p.url() === url0, p.url());
  ok('het paneel is open en de journal in het paneel stelde precies één vraag', (await paneel()).zichtbaar && v.length === 1, String(v.length));
  const vraag = v[0] ? v[0].body.messages[v[0].body.messages.length - 1].content : '';
  ok('de vraag: "Check mijn scenario: BTC trend-pullback — BTC long, Trend-pullback"', vraag === 'Check mijn scenario: BTC trend-pullback — BTC long, Trend-pullback', vraag);
  ok('pakket: het scenario uit het plan', v[0] && JSON.stringify(v[0].body.system).includes('# Scenario uit TradingPlan'));
  ok('de overdracht is gewist', await p.evaluate(() => localStorage.getItem('tp3:mori') === null));
  ok('het antwoord staat in het paneel, zonder "← Terug naar je plan"', await f.evaluate(a => document.getElementById('aiFeed').innerText.includes(a.slice(0, 30)) && !document.querySelector('.aiterug'), A1));
  await f.fill('#aiInput', 'En wat als de dag-bias draait?'); await f.click('#aiSendBtn');
  await f.waitForFunction(() => window.__nep.verzoeken.length > 1 && !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(200);
  v = await N.verzoeken(f);
  ok('doorvragen in het paneel: tweede vraag met het gesprek erbij', v.length === 2 && v[1].body.messages.length >= 3 && await f.evaluate(a => document.getElementById('aiFeed').innerText.includes(a.slice(0, 25)), A2), String(v.length));

  console.log('--- 4. sluiten en opnieuw openen ---');
  const fid = await p.evaluate(() => { const i = document.querySelector('#moripanel iframe'); i.dataset.merk = 'een'; return i.dataset.merk; });
  await p.click('#moripanel [data-a="moriDicht"]'); await p.waitForTimeout(150);
  pn = await paneel();
  ok('sluiten: paneel weg, iframe blijft bestaan', !pn.zichtbaar && pn.iframe, JSON.stringify(pn));
  ok('sluiten: knop zegt dicht (aria-expanded=false), focus terug op de knop', await p.evaluate(() => { const k = document.querySelector('.top [data-a="moriPaneel"]'); return k.getAttribute('aria-expanded') === 'false' && document.activeElement === k; }));
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(100);   // het plan rendert opnieuw: het paneel staat los daarvan
  await p.click('.top [data-a="moriPaneel"]'); await p.waitForTimeout(200);
  ok('opnieuw openen: zelfde iframe, gesprek staat er nog', await p.evaluate(m => document.querySelector('#moripanel iframe').dataset.merk === m, fid) && await frame().evaluate(a => document.getElementById('aiFeed').innerText.includes(a.slice(0, 30)), A1));
  await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(100);
  await p.click('[data-a="dagMori"]');
  await frame().waitForFunction(() => window.__nep.verzoeken.length > 2 && !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(200);
  v = await N.verzoeken(frame());
  ok('dagplan vragen in een al geladen paneel: komt aan in hetzelfde gesprek', v.length === 3 && /^Review mijn dagplan van /.test(v[2].body.messages[v[2].body.messages.length - 1].content) && await p.evaluate(m => document.querySelector('#moripanel iframe').dataset.merk === m, fid), String(v.length));

  console.log('--- 5. de embed schrijft niets aan trades, tags of instellingen ---');
  // Trade 1 hangt aan het scenario zonder planRef: een gewone journal-start zou die meteen wegschrijven (planSync).
  // En wat de journal normaal bewaart, roepen we in het paneel zelf aan: het mag nergens aankomen.
  await frame().evaluate(() => { T[0].notes = 'gewijzigd in de embed'; persist(); setTheme(STATE.theme === 'dark' ? 'light' : 'dark'); persistState(); persistTagConfig(); persistPbook(); persistManual(); persistSync(); });
  await p.waitForTimeout(500);
  const na = await leesOpslag();
  ok('trades in IndexedDB byte-gelijk', na.trades === voor.trades);
  ok('sj_tagconfig byte-gelijk', na.sj.sj_tagconfig === voor.sj.sj_tagconfig);
  ok('sj_state byte-gelijk', na.sj.sj_state === voor.sj.sj_state);
  const anders = [...new Set([...Object.keys(voor.sj), ...Object.keys(na.sj)])].filter(k => voor.sj[k] !== na.sj[k]);
  ok('alleen Mori\'s eigen opslag veranderde (sj_ai_*)', anders.every(k => /^sj_ai_/.test(k)), anders.join());

  console.log('--- 6. maten en thema ---');
  const maat = async () => p.evaluate(() => { const c = document.querySelector('.cockpit'), pnl = document.getElementById('moripanel').getBoundingClientRect();
    return { cockpitRechts: c ? Math.round(c.getBoundingClientRect().right) : -1, paneelLinks: Math.round(pnl.left), w: Math.round(pnl.width), scroll: document.documentElement.scrollWidth > innerWidth + 1, top: Math.round(pnl.top), h: Math.round(pnl.height), vh: innerHeight }; });
  let m = await maat();
  ok('desktop: paneel ± 420 px rechts, de Cockpit schuift niet onder het paneel', m.w >= 380 && m.w <= 440 && m.cockpitRechts <= m.paneelLinks && m.cockpitRechts > 600 && !m.scroll, JSON.stringify(m));
  for (const donker of [false, true]) for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: 800 }); await H.thema(p, donker);
    await p.click('.ritem[data-s="s_btc"] .rrow').catch(() => {});
    await p.click('.ritem[data-s="s_btc"] [data-a="mori"]'); const g = await wachtFrame();
    await g.waitForFunction(() => !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
    m = await maat(); const th = donker ? 'donker' : 'licht';
    ok(`${th} ${w}: iframe volgt het thema`, await g.evaluate(d => document.body.classList.contains('dark') === d, donker));
    if (w === 390) ok(`${th} 390: paneel vult het scherm, sluitknop zichtbaar, geen horizontale scroll`, m.w === 390 && m.top <= 1 && m.h >= m.vh - 1 && !m.scroll && await p.isVisible('#moripanel [data-a="moriDicht"]'), JSON.stringify(m));
    await p.screenshot({ path: `${H.SHOTS}/zijpaneel-${th}-${w}.png` });
  }
  await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- 7. de sleutel ---');
  ok('het plan leest de sleutel nooit (alleen óf hij er is)', await p.evaluate(() => !window.__lees.includes('sj_ai_key')));
  ok('geen echte aanroep naar Anthropic', netwerkAnthropic === 0, String(netwerkAnthropic));
  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
