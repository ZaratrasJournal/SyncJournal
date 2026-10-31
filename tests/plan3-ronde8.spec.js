// TradingPlan v3 ronde 8 (docs/plan-v3-ronde8-2026-10-31.md): één breedte voor alle tabs.
//  - Op 1600 en 2000 px staan de kop (.top-in) en de inhoud (.pagehead) op Week, Dag, Afsluiting en Log op precies
//    dezelfde plek, leeg én gevuld; wisselen van tab laat niets verspringen.
//  - De lege staten van de vier tabs zijn hetzelfde kaartje: zelfde breedte, de knop op dezelfde hoogte.
//  - Gevuld gebruiken Week, Afsluiting en Log de breedte met twee kolommen (links context, rechts het werk); onder
//    ± 1100 px één kolom. Op 390 en 1024 px geen horizontale scroll.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 ronde 8';
const TABS = ['week', 'dag', 'afsluiting', 'log'];
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'A', trigger: '', invalid: '', entry: L('15M', ['BOS'], ['FVG']), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(srv.TP, { waitUntil: 'load' });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: H.PBOOK });
  const zaai = gevuld => p.evaluate(([gevuld, s]) => { const P = { v: 1, weeks: {}, days: {} };
    if (gevuld) { const v = __tp3.vandaag(), dag = n => { const d = new Date(v + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
      const wid = __tp3.isoWeek(v);
      P.weeks[wid] = { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }], levels: 'BTC 78.150 weekly high', noTrade: 'do FOMC 19:00', focus: 'Alleen A-setups', media: { imgs: [], links: [] }, les: '' };
      [0, 1, 2, 3, 4].forEach(n => { const id = dag(n); P.days[id] = { id, week: __tp3.isoWeek(id), layers: [], levels: '', emoties: n ? ['FOMO'] : [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: n ? 'Wachten op de 15M close' : '', volgorde: [], eigen: false,
        scenarios: s.map(x => Object.assign({}, x, { id: x.id + '_' + n, status: n ? (n % 2 ? 'genomen' : 'gemist') : 'open', statusTs: n ? Date.now() : null })) }; }); }
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, [gevuld, [sc({ id: 's_a', title: 'BTC trend-pullback', pb: 'Trend-pullback' }), sc({ id: 's_b', title: 'ETH sweep', pair: 'ETH', dir: 'short', pb: 'London SFP', grade: 'B' })]]);
  const tab = async t => { await p.click(`nav.tabs [data-v="${t}"]`); await p.waitForTimeout(120); };
  const maat = () => p.evaluate(() => { const r = e => { const b = e && e.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.right)] : null; };
    return { kop: r(document.querySelector('.top-in')), inhoud: r(document.querySelector('#app .pagehead')), scroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
  const gelijk = rs => rs.every(x => x && Math.abs(x[0] - rs[0][0]) <= 1 && Math.abs(x[1] - rs[0][1]) <= 1);

  for (const gevuld of [true, false]) {
    await zaai(gevuld); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
    const staat = gevuld ? 'gevuld' : 'leeg';
    for (const w of [1600, 2000]) {
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(100);
      const m = {}; for (const t of TABS) { await tab(t); m[t] = await maat(); }
      ok(`${staat} ${w}: de kop staat op elke tab op dezelfde plek`, gelijk(TABS.map(t => m[t].kop)), JSON.stringify(TABS.map(t => m[t].kop)));
      ok(`${staat} ${w}: de inhoud heeft op elke tab dezelfde linker- en rechterrand`, gelijk(TABS.map(t => m[t].inhoud)), JSON.stringify(TABS.map(t => m[t].inhoud)));
      ok(`${staat} ${w}: de inhoud gebruikt de breedte van Dag (tot 1648 px)`, m.week.inhoud[1] - m.week.inhoud[0] >= Math.min(1648, w - 32) - 2, JSON.stringify(m.week.inhoud));
    }
    if (!gevuld) {
      await p.setViewportSize({ width: 1600, height: 900 });
      const kaart = {}; for (const t of TABS) { await tab(t); kaart[t] = await p.evaluate(() => { const k = document.querySelector('#app .leegkaart'), b = k && k.querySelector('.btn'), r = e => e.getBoundingClientRect();
        return k ? { w: Math.round(r(k).width), l: Math.round(r(k).left), top: Math.round(r(k).top), h: Math.round(r(k).height), knop: b ? Math.round(r(b).top) : null, titel: Math.round(r(k.querySelector('b')).top) } : null; }); }
      ok('leeg: elke tab toont hetzelfde kaartje (.leegkaart)', TABS.every(t => !!kaart[t]), JSON.stringify(kaart));
      ok('leeg: dezelfde breedte, plek en hoogte', TABS.every(t => kaart[t] && kaart[t].w === kaart.week.w && kaart[t].l === kaart.week.l && kaart[t].top === kaart.week.top && kaart[t].h === kaart.week.h), JSON.stringify(kaart));
      ok('leeg: de titel en de knop op dezelfde hoogte', TABS.every(t => kaart[t] && kaart[t].titel === kaart.week.titel && kaart[t].knop === kaart.week.knop && kaart.week.knop != null), JSON.stringify(TABS.map(t => kaart[t] && [kaart[t].titel, kaart[t].knop])));
    } else {
      await p.setViewportSize({ width: 1600, height: 900 });
      const kol = async (t, links, rechts) => { await tab(t); return p.evaluate(([l, r]) => { const a = document.querySelector('#app ' + l), b = document.querySelector('#app ' + r); if (!a || !b) return null; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return { naast: B.left >= A.right - 1, aw: Math.round(A.width), bw: Math.round(B.width) }; }, [links, rechts]); };
      let k = await kol('week', '.wkcontext', '.wkwerk');
      ok('gevuld 1600, Week: twee kolommen (context links, charts en de dagen rechts)', !!k && k.naast, JSON.stringify(k));
      ok('Week: "Dagen van deze week" noemt de dagen met een plan', await p.evaluate(() => { const d = document.querySelector('#app .wkdagen'); return !!d && d.querySelectorAll('.wkdag').length >= 1; }));
      k = await kol('afsluiting', '.afcontext', '.afwerk');
      ok('gevuld 1600, Afsluiting: scenario\'s links, samenvatting en les rechts', !!k && k.naast && await p.evaluate(() => !!document.querySelector('#app .afwerk #af-les') && !!document.querySelector('#app .afwerk .edge2')), JSON.stringify(k));
      k = await kol('log', '.logdagen', '.logzij');
      ok('gevuld 1600, Log: de dagen links, score, binnen/buiten en dagstart-gevoel rechts', !!k && k.naast && await p.evaluate(() => !!document.querySelector('#app .logzij .score') && !!document.querySelector('#app .logzij .gevoel, #app .logzij [class*="gevoel"]')), JSON.stringify(k));
      ok('tekstvelden niet over de hele breedte (Week: levels ≤ 820 px)', await p.evaluate(() => { document.querySelector('nav.tabs [data-v="week"]').click(); return true; }) && await p.evaluate(() => new Promise(r => setTimeout(() => r(document.getElementById('w-levels').getBoundingClientRect().width <= 820), 100))));
    }
    for (const w of [1024, 390]) {
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(100);
      const sc = []; for (const t of TABS) { await tab(t); if ((await maat()).scroll) sc.push(t); }
      ok(`${staat} ${w}: geen horizontale scroll op elke tab`, sc.length === 0, sc.join());
      if (gevuld && w === 1024) { await tab('log'); ok('1024 (onder ± 1100): Log in één kolom', await p.evaluate(() => { const a = document.querySelector('#app .logdagen'), b = document.querySelector('#app .logzij'); return !!a && !!b && (a.getBoundingClientRect().top >= b.getBoundingClientRect().bottom - 1 || b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom - 1); })); }
    }
    // screenshots: licht en donker, 1600 en 390, alle vier de tabs
    for (const donker of [false, true]) { await H.thema(p, donker); for (const w of [1600, 390]) { await p.setViewportSize({ width: w, height: 900 });
      for (const t of TABS) { await tab(t); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${H.SHOTS}/ronde8-${t}-${staat}-${donker ? 'donker' : 'licht'}-${w}.png`, fullPage: true }); } } }
    await H.thema(p, false); await p.setViewportSize({ width: 1600, height: 900 });
  }

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
