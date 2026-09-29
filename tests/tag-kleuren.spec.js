// Eén kleur per tag-soort, gelijk in het formulier, het trade-overzicht en Instellingen → Tags.
//
// Denny 29-09-2026 (backlog C5, demo in demos/tag-kleuren-demo.html): elke plek had een eigen
// schema — FOMO was rood in de trade maar amber in het overzicht, timeframe en missed-redenen
// kwamen niet in het overzicht, en emoties stonden in Instellingen op één hoop. De splitsing
// positief/negatief kwam uit een vaste lijst in de code, dus een zelf toegevoegde negatieve emotie
// belandde bij Positief. Nu: acht soorten, acht kleuren, en de splitsing is data (tagConfig.emotionNeg).
//
// De test vergelijkt de kleur zoals de browser hem uitrekent, per plek, in beide thema's.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Per tag: de soort en de verwachte kleur-token
const VERWACHT = {
  'MSB': 'var(--accent)', 'OB': 'var(--teal)', '1H': 'var(--violet)',
  'Geduldig': 'var(--green)', 'FOMO': 'var(--red)', 'Te vroeg in': 'var(--amber)',
  'Te laat gespot': 'var(--pink)', 'nieuwsdag': 'var(--muted)',
};

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1100 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  await p.evaluate(() => {
    tagConfig.customTags = ['nieuwsdag']; persistTagConfig();
    const B = { pair: 'BTC/USDC', dir: 'long', date: '2026-09-28', entry: 83000, size: '200' };
    T = [
      { ...EMPTY_TRADE, ...B, id: 'a', exchange: 'hyperliquid', time: '17:40', status: 'open',
        layers: [{ timeframe: '1H', bias: 'Bullish', setups: ['MSB'], confirmations: ['OB'] }],
        emotions: ['Geduldig', 'FOMO'], mistakes: ['Te vroeg in'], tags: ['nieuwsdag'] },
      { ...EMPTY_TRADE, ...B, id: 'g', exchange: 'okx', time: '09:00', status: 'closed', kind: 'gemist',
        layers: [{ timeframe: '4H', setups: ['SFP'], confirmations: [] }], missedReasons: ['Te laat gespot'] },
    ];
    persist(); clearGFilter(); setFilter('kind', 'alle');
  });

  // Rekent een CSS-kleurwaarde (ook var(--x)) uit zoals de browser hem in dit thema toont.
  const meet = () => p.evaluate((VERWACHT) => {
    const los = v => { const d = document.createElement('span'); d.style.color = v; document.body.appendChild(d);
      const c = getComputedStyle(d).color; d.remove(); return c; };
    const verwacht = Object.fromEntries(Object.entries(VERWACHT).map(([k, v]) => [k, los(v)]));

    // 1 · trade-overzicht
    go('trades');
    const overzicht = {};
    document.querySelectorAll('td[data-l="Tags"] .tagchip').forEach(c => { overzicht[c.textContent.trim()] = getComputedStyle(c).color; });

    // 2 · formulier (trade a, en de gemiste trade voor missed-redenen)
    const formulier = {};
    const leesForm = () => document.querySelectorAll('.tagopt.on').forEach(c => {
      const txt = c.textContent.replace('✓', '').trim();
      const pil = !!c.closest('.pillchips');       // gevulde pil: kleur zit in de achtergrond
      formulier[txt] = pil ? getComputedStyle(c).backgroundColor : getComputedStyle(c).color;
    });
    openForm('a'); leesForm(); closeForm();
    openForm('g'); leesForm(); closeForm();

    // 3 · Instellingen → Tags: het bolletje in elke tag
    STATE.setTab = 'tags'; go('instellingen');
    const inst = {};
    document.querySelectorAll('.tagmanage').forEach(c => {
      const dot = c.querySelector('span'); const txt = c.textContent.replace('×', '').replace('⇄', '').trim();
      if (dot && !(txt in inst)) inst[txt] = getComputedStyle(dot).backgroundColor;
    });
    const negKolom = [...document.querySelectorAll('[data-emo="neg"] .tagmanage')].map(c => c.textContent.replace(/[×⇄]/g, '').trim());
    const posKolom = [...document.querySelectorAll('[data-emo="pos"] .tagmanage')].map(c => c.textContent.replace(/[×⇄]/g, '').trim());
    return { verwacht, overzicht, formulier, inst, negKolom, posKolom };
  }, VERWACHT);

  for (const thema of ['light', 'dark']) {
    await p.evaluate(t => setTheme(t), thema); await p.waitForTimeout(300);
    const m = await meet();
    console.log(`─── ${thema === 'light' ? 'Licht' : 'Donker'}: elke soort dezelfde kleur op alle drie de plekken ───`);
    for (const tag of Object.keys(VERWACHT)) {
      const v = m.verwacht[tag];
      ok(`${tag} — overzicht`, m.overzicht[tag] === v, `${m.overzicht[tag]} ≠ ${v}`);
      ok(`${tag} — in de trade`, m.formulier[tag] === v, `${m.formulier[tag]} ≠ ${v}`);
      ok(`${tag} — instellingen`, m.inst[tag] === v, `${m.inst[tag]} ≠ ${v}`);
    }
    if (thema === 'light') {
      console.log('─── Instellingen: emoties in twee kolommen ───');
      ok('FOMO staat bij Negatief', m.negKolom.includes('FOMO'), JSON.stringify(m.negKolom));
      ok('Geduldig staat bij Positief', m.posKolom.includes('Geduldig'), JSON.stringify(m.posKolom));
      ok('geen emotie staat in beide kolommen', !m.negKolom.some(x => m.posKolom.includes(x)));
      ok('acht soorten hebben acht verschillende kleuren', new Set(Object.values(m.verwacht)).size === 8, JSON.stringify(m.verwacht));
    }
  }

  console.log('─── Een zelf toegevoegde negatieve emotie ───');
  const eigen = await p.evaluate(() => {
    STATE.setTab = 'tags'; go('instellingen');
    const inp = document.getElementById('newemo_neg'); if (!inp) return { geenInvoer: true };
    inp.value = 'Angstig'; addEmotie(true, 'newemo_neg');
    const neg = [...document.querySelectorAll('[data-emo="neg"] .tagmanage')].map(c => c.textContent.replace(/[×⇄]/g, '').trim());
    T.find(t => t.id === 'a').emotions = ['Angstig']; persist(); go('trades');
    const chip = [...document.querySelectorAll('td[data-l="Tags"] .tagchip')].find(c => c.textContent.trim() === 'Angstig');
    const los = v => { const d = document.createElement('span'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    openForm('a');
    const negForm = [...document.querySelectorAll('.emocol')].find(c => /Negatief/.test(c.textContent));
    const inNegForm = !!negForm && /Angstig/.test(negForm.textContent);
    closeForm();
    return { neg, chipKleur: chip ? getComputedStyle(chip).color : null, rood: los('var(--red)'), inNegForm, opgeslagen: tagConfig.emotionNeg.includes('Angstig') };
  });
  ok('Instellingen heeft een invoerveld voor Negatief', !eigen.geenInvoer);
  ok('"Angstig" staat bij Negatief in Instellingen', (eigen.neg || []).includes('Angstig'), JSON.stringify(eigen.neg));
  ok('en is bewaard in tagConfig.emotionNeg', eigen.opgeslagen === true);
  ok('en staat in het formulier bij Negatief (niet meer bij Positief)', eigen.inNegForm === true);
  ok('en is rood in het overzicht', eigen.chipKleur === eigen.rood, `${eigen.chipKleur} ≠ ${eigen.rood}`);

  console.log('─── Van kant wisselen ───');
  const wissel = await p.evaluate(() => {
    zetEmotieKant('Geduldig', true); const naNeg = tagConfig.emotionNeg.includes('Geduldig');
    zetEmotieKant('Geduldig', false); const naPos = !tagConfig.emotionNeg.includes('Geduldig');
    return { naNeg, naPos };
  });
  ok('Geduldig kan naar Negatief', wissel.naNeg);
  ok('en weer terug naar Positief', wissel.naPos);

  console.log('─── Oude journal en oude back-up zonder splitsing ───');
  const oud = await p.evaluate(async () => {
    const r = {};
    // een journal van vóór C5: tagConfig zonder emotionNeg
    const zonder = JSON.parse(JSON.stringify(tagConfig)); delete zonder.emotionNeg;
    tagConfig = zonder; normTagConfig();
    r.journal = { fomo: tagConfig.emotionNeg.includes('FOMO'), gehaast: tagConfig.emotionNeg.includes('Gehaast'), geduldig: tagConfig.emotionNeg.includes('Geduldig') };
    // een back-up van vóór C5
    const backup = { app: 'SyncJournal', schemaVersion: SCHEMA_VERSION, trades: [], tagConfig: JSON.parse(JSON.stringify(zonder)) };
    try { await applyBackup(backup); } catch (e) { r.fout = String(e); }
    r.backup = Array.isArray(tagConfig.emotionNeg) && tagConfig.emotionNeg.includes('FOMO') && !tagConfig.emotionNeg.includes('Geduldig');
    return r;
  });
  ok('oude journal: FOMO en Gehaast worden negatief', oud.journal.fomo && oud.journal.gehaast, JSON.stringify(oud.journal));
  ok('oude journal: Geduldig blijft positief', oud.journal.geduldig === false);
  ok('oude back-up krijgt dezelfde splitsing', oud.backup === true, oud.fout || '');

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Tag-kleuren: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
