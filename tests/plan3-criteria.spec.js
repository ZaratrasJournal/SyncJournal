// TradingPlan v3 ronde 3, punt 8 — playbook-criteria standaard ingeklapt (docs/plan-v3-ronde3-2026-10-27.md).
//  1. In een opengeklapt scenario is het criteria-blok één regel: "Criteria · <playbook> · 0/2 verplicht" met een pijltje.
//     Tikken klapt open (afvinklijst + "Niet als …"), nog eens tikken klapt dicht.
//  2. Alle confirmations af maar verplichte criteria open: de dichte regel zegt het in amber ("2 verplichte criteria nog
//     open"), zodat je niets mist. Alles af: "2/2 verplicht ✓", niet amber.
//  3. Open/dicht per scenario, onthouden binnen de sessie (andere tab en terug), niet in de opslag.
//  4. Playbook zonder criteria: geen klapregel, wel "Dit playbook heeft nog geen criteria".
//  5. Scenario-formulier: de voorvertoning blijft zichtbaar, maar compact (criteria op één regel, geen lijst).
//  6. Licht en donker, 1280 en 390, geen horizontale scroll.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 criteria';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'A', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const PB = Object.assign({}, H.PBOOK, { 'Trend-pullback': Object.assign({}, H.PBOOK['Trend-pullback'], {
  criteria: [{ text: 'HTF-trend mee', mandatory: true }, { text: 'Liquidity gepakt', mandatory: true }, { text: 'Volume boven gemiddeld', mandatory: false }],
  antiCriteria: [{ text: 'Vlak voor nieuws', mandatory: true }], stop: 'Onder de sweep', target: '2R', minRR: '2' }) });

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(srv.TP, { waitUntil: 'load' });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: PB });
  await p.evaluate(s => { const id = __tp3.vandaag(), P = { v: 1, weeks: {}, days: {} };
    P.days[id] = { id, week: __tp3.isoWeek(id), layers: [], levels: '', emoties: [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: '', scenarios: s };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, [
    sc({ id: 's_kr', title: 'BTC trend-pullback', pb: 'Trend-pullback', entry: L('15M', ['BOS'], ['FVG']) }),
    sc({ id: 's_tw', title: 'ETH trend-pullback', pair: 'ETH', pb: 'Trend-pullback', entry: L('15M', [], ['OB']) }),
    sc({ id: 's_zc', title: 'Zonder criteria', pb: 'Backtestbaas', entry: L('1H', [], ['OB']) })]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const open = async sid => { if (!(await p.evaluate(sid => !!document.querySelector(`.ritem[data-s="${sid}"] .rdetail`), sid))) await p.click(`.ritem[data-s="${sid}"] .rrow`); await p.waitForTimeout(80); };
  const amber = await p.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--amber)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
  // kop via textContent: the title is uppercase only through CSS
  const blok = sid => p.evaluate(sid => { const r = document.querySelector(`.ritem[data-s="${sid}"]`), k = r && r.querySelector('[data-a="critOpen"]'), zicht = el => !!el && el.getClientRects().length > 0;
    return { kop: k ? k.textContent.replace(/\s+/g, ' ').trim() : '', open: k ? k.getAttribute('aria-expanded') : '', kleur: k ? getComputedStyle(k.querySelector('.critnog') || k).color : '',
      nog: k && k.querySelector('.critnog') ? k.querySelector('.critnog').innerText.trim() : '', vink: [...r.querySelectorAll('[data-a="crit"]')].filter(zicht).length,
      anti: [...r.querySelectorAll('.anti')].filter(zicht).length, ready: r.classList.contains('ready'), tekst: r.innerText }; }, sid);

  console.log('--- 1. standaard ingeklapt ---');
  await open('s_kr');
  let k = await blok('s_kr');
  ok('dicht: één regel "Criteria · Trend-pullback · 0/2 verplicht" met pijltje', /^▸ Criteria · Trend-pullback · 0\/2 verplicht Toon alle 3$/.test(k.kop) && await p.evaluate(() => { const k = document.querySelector('.ritem[data-s="s_kr"] [data-a="critOpen"]'); return k.getClientRects().length === 1 && k.getBoundingClientRect().height < 48; }) && k.open === 'false', JSON.stringify(k.kop));
  ok('dicht: geen afvinklijst en geen "Niet als" in beeld', k.vink === 0 && k.anti === 0, JSON.stringify(k));
  ok('dicht en de confirmation nog open: geen amber waarschuwing', !k.nog, k.nog);
  await p.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await p.waitForTimeout(80);
  k = await blok('s_kr');
  ok('tikken klapt open: drie criteria om af te vinken, "Niet als" als waarschuwing, pijltje omlaag', k.open === 'true' && k.vink === 3 && k.anti === 1 && /^▾ Criteria/.test(k.kop), JSON.stringify(k));
  await p.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await p.waitForTimeout(80);
  ok('nog eens tikken klapt dicht', (await blok('s_kr')).vink === 0);

  console.log('--- 2. verplichte criteria open terwijl de confirmations af zijn ---');
  await p.click('.ritem[data-s="s_kr"] [data-a="chk"][data-v="FVG"]'); await p.waitForTimeout(80);
  k = await blok('s_kr');
  ok('confirmations af, verplicht nog open: de dichte regel zegt "2 verplichte criteria nog open" in amber', k.nog === '2 verplichte criteria nog open' && k.kleur === amber && k.vink === 0 && !k.ready, JSON.stringify(k));
  await p.click('.ritem[data-s="s_kr"] [data-a="critOpen"]');
  await p.click('.ritem[data-s="s_kr"] [data-a="crit"][data-v="HTF-trend mee"]'); await p.waitForTimeout(80);
  k = await blok('s_kr');
  ok('één af: "1/2 verplicht" en "1 verplicht criterium nog open", het blok blijft open', /1\/2 verplicht/.test(k.kop) && k.nog === '1 verplicht criterium nog open' && k.vink === 3, JSON.stringify(k));
  await p.click('.ritem[data-s="s_kr"] [data-a="crit"][data-v="Liquidity gepakt"]'); await p.waitForTimeout(80);
  k = await blok('s_kr');
  ok('alles af: "2/2 verplicht ✓", geen amber, "Klaar om te nemen"', /· 2\/2 verplicht ✓ Verberg$/.test(k.kop) && !k.nog && k.ready && /Klaar om te nemen/.test(k.tekst), JSON.stringify(k));

  console.log('--- 3. per scenario, binnen de sessie ---');
  await open('s_tw');
  ok('een ander scenario staat gewoon dicht', (await blok('s_tw')).open === 'false' && (await blok('s_kr')).open === 'true');
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(80); await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(80);
  await open('s_kr'); await open('s_tw');
  ok('andere tab en terug: open en dicht per scenario onthouden', (await blok('s_kr')).open === 'true' && (await blok('s_tw')).open === 'false');
  ok('niets over open/dicht in de opslag van het plan', await p.evaluate(() => !/critOpen|critDicht/.test(localStorage.getItem('tp3:plans'))));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); await open('s_kr');
  ok('na herladen weer standaard dicht (geen opslag nodig)', (await blok('s_kr')).open === 'false');

  console.log('--- 4. playbook zonder criteria ---');
  await open('s_zc');
  k = await blok('s_zc');
  ok('geen klapregel, wel "Dit playbook heeft nog geen criteria"', !k.kop && /Dit playbook heeft nog geen criteria/.test(k.tekst), JSON.stringify(k.kop));

  console.log('--- 5. scenario-formulier: compact ---');
  await p.click('[data-a="newScen"]'); await p.selectOption('#sc-pb', 'Trend-pullback'); await p.waitForTimeout(120);
  const f = await p.evaluate(() => { const b = document.querySelector('#modal .pbcrit'); return b ? { t: b.innerText.replace(/\s+/g, ' '), lijst: !!b.querySelector('ul,li'), n: b.querySelectorAll('.crit').length, h: Math.round(b.getBoundingClientRect().height) } : null; });
  // ronde 6 (Zaratras: "criteria is tekst achter elkaar"): in het scenario-venster weer een lijst, rechts naast het formulier
  const zij = await p.evaluate(() => { const z = document.querySelector('#modal .scenzij'); return z ? { t: z.innerText.replace(/\s+/g, ' '), rijen: [...z.querySelectorAll('.crit')].map(c => Math.round(c.getBoundingClientRect().top)), anti: z.querySelectorAll('.anti').length } : null; });
  ok('voorvertoning zichtbaar: criteria (verplicht gemarkeerd), "Niet als" en target/R:R', !!zij && /HTF-trend mee verplicht/.test(zij.t) && /Volume boven gemiddeld/.test(zij.t) && /Vlak voor nieuws/.test(zij.t) && /Target 2R/.test(zij.t) && /Min\. R:R 2/.test(zij.t) && /Stop volgens het playbook: Onder de sweep/.test(zij.t), JSON.stringify(zij));
  ok('de criteria als lijst: elk criterium op een eigen regel, "Niet als" apart', !!zij && zij.rijen.length === 3 && new Set(zij.rijen).size === 3 && zij.anti === 1, JSON.stringify(zij));
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);

  console.log('--- 6. thema\'s en breedtes ---');
  const scroll = await H.vierShots(p, 'criteria-dicht', async q => { await q.click('.ritem[data-s="s_kr"] .rrow'); await q.waitForTimeout(120); });
  ok('390 breed: geen horizontale scroll (licht en donker)', !scroll.licht && !scroll.donker, JSON.stringify(scroll));
  for (const donker of [false, true]) {
    await H.thema(p, donker); await open('s_kr');
    const c = await p.evaluate(() => { const k = document.querySelector('.ritem[data-s="s_kr"] [data-a="critOpen"]'), cs = getComputedStyle(k); return { kleur: cs.color, bg: getComputedStyle(document.body).backgroundColor }; });
    ok(`${donker ? 'donker' : 'licht'}: de klapregel is leesbaar (tekst ≠ achtergrond)`, c.kleur !== c.bg, JSON.stringify(c));
  }
  await H.vierShots(p, 'criteria-open', async q => { await q.click('.ritem[data-s="s_kr"] .rrow'); await q.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await q.waitForTimeout(120); });
  await H.vierShots(p, 'criteria-formulier', async q => { await q.click('[data-a="newScen"]'); await q.selectOption('#sc-pb', 'Trend-pullback'); await q.waitForTimeout(120); });

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
