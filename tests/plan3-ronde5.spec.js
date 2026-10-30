// TradingPlan v3 ronde 5 (Zaratras over v1.25).
//  1. De criteria-regel is herkenbaar een knop: ▸/▾, "Criteria · <playbook> · 1/3 verplicht", "Toon alle 8"/"Verberg",
//     aria-expanded, hover; de amber regel blijft.
//  2. "Plan" links is drie blokken (Lagen, Confirmations, Criteria) in dezelfde stijl als de blokken rechts.
//  3. Bewerken en verwijderen: ✎ Bewerk in de kop van het open scenario, ⋯-menu op elke rij; titel en playbook
//     wijzigen blijft bewaard; verwijderen met een bevestiging in de pagina (geen confirm()), trades losgekoppeld,
//     plaatjes weg uit IndexedDB tp3.
//  4. Verplaatsen: "Volgorde: Op edge · Eigen volgorde"; ↑ ↓ en slepen aan ⠿; de eerste keer springt de keuze naar
//     eigen; Day.volgorde bewaard; edge-plek en "sterkste" blijven zichtbaar; Mori's dagplan volgt de volgorde.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 ronde 5';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'A', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const PB = Object.assign({}, H.PBOOK, { 'Trend-pullback': Object.assign({}, H.PBOOK['Trend-pullback'], {
  criteria: ['HTF-trend mee', 'Liquidity gepakt', 'Pullback naar 50%', 'FVG op de 15M', 'Geen nieuws', 'London of NY open', 'R:R minstens 2', 'Volume boven gemiddeld'].map((text, i) => ({ text, mandatory: i < 3 })),
  antiCriteria: [{ text: 'Vlak voor nieuws', mandatory: true }] }) });

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = []; let dialogen = 0;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => { dialogen++; d.accept(); });
  await p.goto(srv.TP, { waitUntil: 'load' });
  const TR = H.FIXTURE(); await H.zaaiJournal(p, { trades: TR, pbook: PB });
  await p.evaluate(([s]) => { const id = __tp3.vandaag(), P = { v: 1, weeks: {}, days: {} };
    P.days[id] = { id, week: __tp3.isoWeek(id), layers: [{ tf: '4H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }], levels: '', emoties: [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: '', scenarios: s };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, [[
    sc({ id: 's_a', title: 'BTC trend-pullback', pb: 'Trend-pullback', entry: L('15M', ['BOS'], ['FVG', 'OB'], 'Bullish'), critChecked: ['HTF-trend mee'], stop: '75.020', tps: ['77.400'], trades: [TR[0].id] }),
    sc({ id: 's_b', title: 'Backtestbaas 1H', pb: 'Backtestbaas', entry: L('1H', ['BOS']) }),
    sc({ id: 's_c', title: 'Gok zonder data', pb: 'Klein', grade: 'C', entry: L('5M', [], ['OB']) })]]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const img = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 160; c.height = 90; c.getContext('2d').fillRect(0, 0, 160, 90); const bl = await new Promise(r => c.toBlob(r, 'image/png'));
    return __tp3.voegBeeldToe(new File([bl], 'c.png', { type: 'image/png' }), 'scen:s_a'); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const open = async sid => { if (!(await p.evaluate(sid => !!document.querySelector(`.ritem[data-s="${sid}"] .rdetail`), sid))) await p.click(`.ritem[data-s="${sid}"] .rrow`); await p.waitForTimeout(100); };
  const volgorde = () => p.evaluate(() => [...document.querySelectorAll('.rlist .ritem')].map(r => r.dataset.s));
  const dag = () => p.evaluate(() => __tp3.load().days[__tp3.vandaag()]);

  console.log('--- 1. de criteria-regel is een knop ---');
  await open('s_a');
  const knop = () => p.evaluate(() => { const k = document.querySelector('.ritem[data-s="s_a"] [data-a="critOpen"]'); return k ? { tag: k.tagName, exp: k.getAttribute('aria-expanded'), txt: k.textContent.replace(/\s+/g, ' ').trim(), bg: getComputedStyle(k).backgroundColor, rand: getComputedStyle(k).borderTopStyle } : null; });
  let k = await knop();
  ok('dicht: een knop met ▸, "Criteria · Trend-pullback · 1/3 verplicht" en "Toon alle 8", aria-expanded=false', !!k && k.tag === 'BUTTON' && k.exp === 'false' && /^▸ Criteria · Trend-pullback · 1\/3 verplicht/.test(k.txt) && /Toon alle 8/.test(k.txt), JSON.stringify(k));
  ok('ziet eruit als een knop: een rand', !!k && k.rand !== 'none', JSON.stringify(k));
  await p.hover('.ritem[data-s="s_a"] [data-a="critOpen"]'); await p.waitForTimeout(150);
  ok('hover: de achtergrond verandert', (await knop()).bg !== k.bg, (await knop()).bg + ' vs ' + k.bg);
  await p.click('.ritem[data-s="s_a"] [data-a="critOpen"]'); await p.waitForTimeout(100); k = await knop();
  ok('open: ▾, "Verberg", aria-expanded=true, acht criteria in beeld', k.exp === 'true' && /^▾ /.test(k.txt) && /Verberg/.test(k.txt) && await p.evaluate(() => document.querySelectorAll('.ritem[data-s="s_a"] [data-a="crit"]').length === 8), JSON.stringify(k));
  await p.click('.ritem[data-s="s_a"] [data-a="critOpen"]');
  await p.click('.ritem[data-s="s_a"] [data-a="chk"][data-v="FVG"]'); await p.click('.ritem[data-s="s_a"] [data-a="chk"][data-v="OB"]'); await p.waitForTimeout(100);
  ok('de amber regel blijft: "2 verplichte criteria nog open"', /2 verplichte criteria nog open/.test((await knop()).txt), (await knop()).txt);

  console.log('--- 2. Plan in blokken, zoals rechts ---');
  const blok = await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_a"]'), st = e => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopColor, c.borderTopWidth, c.borderRadius, c.paddingTop].join(' '); };
    const L = [...r.querySelectorAll('.rplan > .blok')], kh = e => { const h = e.querySelector('.kh'); if (!h) return ''; const c = getComputedStyle(h); return [c.fontSize, c.fontWeight, c.textTransform, c.letterSpacing, c.color].join(' '); };
    return { n: L.length, koppen: L.map(e => (e.querySelector('.kh') || {}).textContent || ''), stijl: L.map(st), rechts: st(r.querySelector('.kern')), khL: L.map(kh), khR: kh(r.querySelector('.kern')),
      gapL: getComputedStyle(r.querySelector('.rplan')).rowGap, gapR: getComputedStyle(r.querySelector('.rside')).rowGap }; });
  ok('links drie blokken: Lagen, Confirmations, Criteria', blok.n === 3 && /^Lagen/.test(blok.koppen[0]) && /^Confirmations 15M/.test(blok.koppen[1]) && /Criteria/.test(blok.koppen[2]), JSON.stringify(blok.koppen));
  ok('zelfde achtergrond, rand, hoek en binnenruimte als de blokken rechts', blok.n === 3 && blok.stijl.every(s => s === blok.rechts), JSON.stringify(blok.stijl) + ' vs ' + blok.rechts);
  ok('zelfde kopstijl en tussenruimte als rechts', blok.n === 3 && blok.khL.every(s => s === blok.khR) && blok.gapL === blok.gapR, JSON.stringify(blok));
  ok('"Niet als" staat in het blok Criteria (als hij open is)', await p.evaluate(() => { document.querySelector('.ritem[data-s="s_a"] [data-a="critOpen"]').click(); return true; }) && await p.evaluate(() => !!document.querySelector('.ritem[data-s="s_a"] .rplan > .blok:last-child .anti')));

  console.log('--- 3. bewerken ---');
  const kopKnop = await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_a"]'), b = r.querySelector('.rtools [data-a="editScen"]'), d = r.querySelector('.rdetail');
    return b ? { txt: b.textContent.trim(), boven: b.getBoundingClientRect().bottom <= d.getBoundingClientRect().top + 1 } : null; });
  ok('✎ Bewerk in de kop van het open scenario', !!kopKnop && /✎ Bewerk/.test(kopKnop.txt) && kopKnop.boven, JSON.stringify(kopKnop));
  ok('dicht scenario: geen ✎ in de kop, wel een ⋯-menu', await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_b"]'); return !r.querySelector('.rtools [data-a="editScen"]') && !!r.querySelector('[data-a="rMenu"]'); }));
  await p.click('.ritem[data-s="s_b"] [data-a="rMenu"]'); await p.waitForTimeout(80);
  const menu = await p.evaluate(() => [...document.querySelectorAll('.ritem[data-s="s_b"] .rmenu [role="menuitem"]')].map(x => x.textContent.trim()));
  ok('het open menu valt niet weg onder de kaart of de volgende kaart', await p.evaluate(() => { const m = document.querySelector('.ritem[data-s="s_b"] .rmenu'), b = m.getBoundingClientRect(), el = document.elementFromPoint(b.left + 20, b.bottom - 8); return !!el && m.contains(el); }));
  ok('⋯-menu: Bewerk, Omhoog, Omlaag, Verwijder', ['Bewerk', 'Omhoog', 'Omlaag', 'Verwijder'].every(w => menu.some(m => m.includes(w))), JSON.stringify(menu));
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok('Escape sluit het menu', await p.evaluate(() => !document.querySelector('.rmenu')));
  await p.click('.ritem[data-s="s_b"] [data-a="rMenu"]'); await p.click('.ritem[data-s="s_b"] .rmenu [data-a="editScen"]'); await p.waitForTimeout(100);
  ok('Bewerk vanuit het menu opent het venster met alle velden', await p.evaluate(() => ['#sc-title', '#sc-pair', '#sc-pb', '#sc-trig', '#sc-inv', '#sc-tf', '#sc-stop', '#sc-tps', '#sc-note'].every(s => !!document.querySelector('#modal ' + s)) && document.querySelectorAll('#modal [data-a="dset"][data-p="dir"]').length === 2 && document.querySelectorAll('#modal [data-a="dset"][data-p="grade"]').length === 3));
  await p.click('#modal [data-a="close"]');
  await p.click('.ritem[data-s="s_a"] .rtools [data-a="editScen"]'); await p.waitForTimeout(100);
  await p.fill('#sc-title', 'BTC sweep en terug'); await p.selectOption('#sc-pb', 'London SFP'); await p.waitForTimeout(100);
  await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(150);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const na = (await dag()).scenarios.find(s => s.id === 's_a');
  ok('titel en playbook gewijzigd, bewaard na herladen; oude criteria-vinkjes weg', na.title === 'BTC sweep en terug' && na.pb === 'London SFP' && na.critChecked.length === 0, JSON.stringify({ t: na.title, pb: na.pb, c: na.critChecked }));
  ok('de rij toont de nieuwe titel', await p.evaluate(() => /BTC sweep en terug/.test(document.querySelector('.ritem[data-s="s_a"] .rrow').textContent)));

  console.log('--- 3b. verwijderen ---');
  await open('s_a'); await p.click('.ritem[data-s="s_a"] .rtools [data-a="editScen"]'); await p.click('#modal [data-a="delScen"]'); await p.waitForTimeout(100);
  const vraag = await p.evaluate(() => { const m = document.querySelector('#modal [role="dialog"]'); return m ? m.innerText.replace(/\s+/g, ' ') : ''; });
  ok('verwijderen vraagt in de pagina (geen confirm()), en zegt wat er weggaat', dialogen === 0 && /BTC sweep en terug/.test(vraag) && /1 gekoppelde trade/.test(vraag) && /losgekoppeld/.test(vraag) && /blijft in je journal|blijven in je journal/.test(vraag) && /1 afbeelding/.test(vraag), vraag);
  await p.click('#modal [data-a="delNee"]'); await p.waitForTimeout(80);
  ok('Annuleer: terug naar het bewerkvenster, scenario bestaat nog', await p.evaluate(() => !!document.getElementById('sc-title')) && (await dag()).scenarios.some(s => s.id === 's_a'));
  await p.click('#modal [data-a="close"]');
  await p.click('.ritem[data-s="s_a"] [data-a="rMenu"]'); await p.click('.ritem[data-s="s_a"] .rmenu [data-a="delScen"]'); await p.waitForTimeout(80);
  ok('ook vanuit het ⋯-menu: dezelfde bevestiging', await p.evaluate(() => !!document.querySelector('#modal [data-a="delJa"]')));
  await p.click('#modal [data-a="delJa"]'); await p.waitForTimeout(250);
  const d1 = await dag();
  ok('verwijderd: weg uit de dag en uit de volgorde', !d1.scenarios.some(s => s.id === 's_a') && !d1.volgorde.includes('s_a'), JSON.stringify(d1.volgorde));
  ok('de trade is losgekoppeld (hoort bij geen scenario meer), de trade zelf staat nog in de journal', await p.evaluate(id => !__tp3.load().days[__tp3.vandaag()].scenarios.some(s => (s.trades || []).map(String).includes(String(id))) && __tp3.JR.trades.some(t => String(t.id) === String(id)), TR[0].id));
  ok('de afbeelding is weg uit IndexedDB tp3', await p.evaluate(id => __tp3.imgLees(id).then(v => v === undefined), img));
  ok('geen enkele browser-dialoog gebruikt', dialogen === 0, String(dialogen));

  console.log('--- 4. verplaatsen ---');
  await p.evaluate(() => { const P = __tp3.load(), d = P.days[__tp3.vandaag()], mk = (id, t, pb, g) => ({ id, title: t, pair: 'BTC', dir: 'long', pb, grade: g, trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: ['BOS'], confirmations: [] }, off: [], checked: [], critChecked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] });
    d.scenarios.push(mk('s_d', 'Trend A', 'Trend-pullback', 'A')); localStorage.setItem('tp3:plans', JSON.stringify(P)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const edgeVolg = await volgorde();
  const keuze = () => p.evaluate(() => [...document.querySelectorAll('.volgkeuze [data-a="volgorde"]')].map(x => x.dataset.v + ':' + x.getAttribute('aria-pressed')).join());
  ok('keuze boven de lijst: Op edge (aan) · Eigen volgorde', await keuze() === 'edge:true,eigen:false' && await p.evaluate(() => /Volgorde/.test(document.querySelector('.volgkeuze').textContent)), await keuze());
  const plekken = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.rlist .ritem')].map(r => [r.dataset.s, r.querySelector('.rnum').textContent.replace(/\D/g, '')])));
  const pl0 = await plekken();
  ok('op edge: de plekken lopen 1, 2, 3 van boven naar beneden', edgeVolg.map(s => pl0[s]).join() === '1,2,3', JSON.stringify(pl0));
  const tweede = edgeVolg[1];
  await p.click(`.ritem[data-s="${tweede}"] [data-a="omhoog"]`); await p.waitForTimeout(120);
  const v1 = await volgorde();
  ok('↑ op de tweede: die staat nu bovenaan', v1[0] === tweede && v1[1] === edgeVolg[0], JSON.stringify(v1));
  ok('de eerste keer verplaatsen: de keuze springt naar Eigen volgorde', await keuze() === 'edge:false,eigen:true');
  ok('de edge-plek blijft per scenario zichtbaar (en "sterkste" waar hij was)', await (async () => { const n = await plekken(); return Object.keys(pl0).every(k => n[k] === pl0[k]); })() && await p.evaluate(s => !!document.querySelector(`.ritem[data-s="${s}"] .tag-sterk`) || !document.querySelector('.tag-sterk'), edgeVolg[0]));
  ok('bewaard in Day.volgorde', JSON.stringify((await dag()).volgorde) === JSON.stringify(v1) && (await dag()).eigen === true, JSON.stringify(await dag()));
  await p.click(`.ritem[data-s="${v1[1]}"] [data-a="omlaag"]`); await p.waitForTimeout(120);
  const v2 = await volgorde();
  ok('↓: één plek omlaag', v2[2] === v1[1] && v2[1] === v1[2], JSON.stringify(v2));
  await p.dragAndDrop(`.ritem[data-s="${v2[2]}"] .grip`, `.ritem[data-s="${v2[0]}"] .rrow`, { targetPosition: { x: 40, y: 4 } }); await p.waitForTimeout(150);
  const v3 = await volgorde();
  ok('slepen aan ⠿: de onderste naar boven', v3[0] === v2[2] && v3.length === 3, JSON.stringify(v3));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  ok('na herladen: dezelfde eigen volgorde', JSON.stringify(await volgorde()) === JSON.stringify(v3) && await keuze() === 'edge:false,eigen:true');
  await p.click('.volgkeuze [data-a="volgorde"][data-v="edge"]'); await p.waitForTimeout(100);
  ok('terug naar Op edge: de edge-volgorde, de eigen volgorde blijft bewaard', JSON.stringify(await volgorde()) === JSON.stringify(edgeVolg) && JSON.stringify((await dag()).volgorde) === JSON.stringify(v3));
  await p.click('.volgkeuze [data-a="volgorde"][data-v="eigen"]'); await p.waitForTimeout(100);
  ok('weer Eigen volgorde: precies zoals je hem liet', JSON.stringify(await volgorde()) === JSON.stringify(v3));
  await p.click('[data-a="newScen"]'); await p.fill('#sc-title', 'Nieuw onderaan'); await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(150);
  const v4 = await volgorde(), nieuw = (await dag()).scenarios.find(s => s.title === 'Nieuw onderaan');
  ok('een nieuw scenario komt onderaan in je eigen volgorde', !!nieuw && v4[v4.length - 1] === nieuw.id, JSON.stringify(v4));

  console.log('--- Mori volgt de volgorde ---');
  const j = await ctx.newPage(); j.on('pageerror', e => errs.push('journal: ' + String(e).split('\n')[0]));
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true')); await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1000);
  const pakket = async () => j.evaluate(() => { const P = planLoad(), id = Object.keys(P.plans.days)[0], day = { ...P.plans.days[id], id }, edge = {};
    window.__edgeVolg.forEach((s, i) => { edge[s] = { plek: i + 1 }; }); return coachDagplanDeel([], { plan: { day, week: null, edge } }).join('\n'); });
  await j.evaluate(v => { window.__edgeVolg = v; }, [...edgeVolg, nieuw.id]);
  let pk = await pakket();
  const volgIn = t => [...v4].sort((a, b) => t.indexOf(a) - t.indexOf(b));
  const titels = await p.evaluate(() => Object.fromEntries(__tp3.load().days[__tp3.vandaag()].scenarios.map(s => [s.id, s.title])));
  const posities = t => v4.map(id => t.indexOf(titels[id]));
  ok('Mori\'s dagplan in de eigen volgorde, en het zegt dat', /eigen volgorde/i.test(pk) && posities(pk).every((x, i, a) => x > 0 && (i === 0 || x > a[i - 1])), pk.slice(pk.indexOf("## Scenario's"), pk.indexOf("## Scenario's") + 400));
  ok('… met de edge-plek erbij', /edge-plek 1/.test(pk));
  await p.click('.volgkeuze [data-a="volgorde"][data-v="edge"]'); await p.waitForTimeout(100);
  pk = await pakket();
  ok('op edge: Mori\'s dagplan op edge-volgorde, en het zegt dat', /op edge/i.test(pk) && !/eigen volgorde/i.test(pk.slice(pk.indexOf("## Scenario's"), pk.indexOf("## Scenario's") + 120)), pk.slice(pk.indexOf("## Scenario's"), pk.indexOf("## Scenario's") + 200));
  await j.close();
  await p.click('.volgkeuze [data-a="volgorde"][data-v="eigen"]'); await p.waitForTimeout(100);

  console.log('--- 390 ---');
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(150);
  const v5 = await volgorde();
  ok('390: ↑ ↓ zichtbaar', await p.evaluate(s => { const b = document.querySelector(`.ritem[data-s="${s}"] [data-a="omhoog"]`); return !!b && b.getBoundingClientRect().width > 0; }, v5[1]));
  await p.click(`.ritem[data-s="${v5[1]}"] [data-a="omhoog"]`); await p.waitForTimeout(120);
  ok('390: ↑ werkt', (await volgorde())[0] === v5[1]);
  ok('390: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok('390: de knoppen staan onder de kop, de titel houdt de breedte van de rij', await p.evaluate(s => { const r = document.querySelector(`.ritem[data-s="${s}"]`), t = r.querySelector('.rtools').getBoundingClientRect(), k = r.querySelector('.rrow').getBoundingClientRect(); return t.top >= k.bottom - 1 && k.width >= r.getBoundingClientRect().width - 20; }, v5[1]));
  await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- screenshots ---');
  await H.zaaiJournal(p, { trades: TR, pbook: PB });
  for (const donker of [false, true]) { await H.thema(p, donker); for (const w of [1280, 1680, 390]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(150);
    const eerste = (await volgorde())[0]; await open(eerste);
    const c = await p.$(`.ritem[data-s="${eerste}"] [data-a="critOpen"]`); if (c && await c.getAttribute('aria-expanded') === 'false') await c.click();
    await p.click(`.ritem[data-s="${(await volgorde())[1]}"] [data-a="rMenu"]`).catch(() => {}); await p.waitForTimeout(150);
    await p.screenshot({ path: `${H.SHOTS}/ronde5-${donker ? 'donker' : 'licht'}-${w}.png`, fullPage: true });
    if (w === 390) ok(`${donker ? 'donker' : 'licht'} 390: geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await p.keyboard.press('Escape'); } }
  await p.setViewportSize({ width: 1280, height: 900 }); await H.thema(p, false);

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
