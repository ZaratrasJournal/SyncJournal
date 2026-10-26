// Review → Beeld (Zaratras 26-10-2026):
//  2. trades without an image stay in the grid, as a same-size "Geen afbeelding" tile (also when an image fails to load);
//  3. clicking a tile opens the large view with the trade details beside it, from the same source as the Discord export;
//  4. the panel shows every tag of the trade as a coloured chip, grouped per kind, in the colour of the trade list.
// Run with: node tests/review-beeld-info.spec.js   (--deel=2, --deel=3 or --deel=4 for one part)
const { chromium } = require('playwright');
const { openJournal, seedTrades, go, stil } = require('./helpers/dov-page');
const deel = (process.argv.find(a => a.startsWith('--deel=')) || '').slice(7);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';
const ms = s => String(Date.parse(s));
const mk = (pair, over) => Object.assign({ date: '2026-10-10', time: '10:00', pair, dir: 'long', setup: '', session: 'London', exchange: 'blofin', status: 'closed', kind: 'live',
  pnl: 50, r: 1, entry: 100, stop: 95, exit: 105, screenshots: [], tvLinks: [], layers: [], tags: [], emotions: [], mistakes: [], tps: [] }, over);
const A = mk('AAA/USDT', { date: '2026-10-20', closeTime: ms('2026-10-20T15:00:00Z'), screenshots: [PNG], setup: 'Breakout', pnl: 1234.5, entry: 100, stop: 95, exit: 110, rrPlanned: 2,
  layers: [{ timeframe: '4H', setups: ['SFP'], confirmations: ['OB', 'FVG'] }, { timeframe: '15M', setups: ['BOS'], confirmations: ['OB'] }],
  tps: [{ price: 108, pct: 50, hit: true }, { price: 115, pct: 50, hit: false }], notes: 'Mooi geduld <b>x</b>' });
const B = mk('BBB/USDT', { date: '2026-10-18', closeTime: ms('2026-10-18T15:00:00Z'), dir: 'short', pnl: -40, r: -0.5, entry: 50, stop: 52, exit: 51 });
const C = mk('CCC/USDT', { date: '2026-10-16', closeTime: ms('2026-10-16T15:00:00Z'), screenshots: ['https://voorbeeld.invalid/kapot.png'] });   // network is closed: never loads
const D = mk('DDD/USDT', { date: '2026-10-14', closeTime: ms('2026-10-14T15:00:00Z'), pnl: 7 });
const WANT = ['AAA/USDT', 'BBB/USDT', 'CCC/USDT', 'DDD/USDT'];
const pairsOf = sel => [...document.querySelectorAll(sel)].map(e => (e.textContent.match(/[A-Z]{3}\/USDT/) || [''])[0]);

(async () => {
  const b = await chromium.launch();
  const { p, errs } = await openJournal(b, { klok: new Date('2026-10-26T12:00:00Z') });
  const naarBeeld = async rows => { await seedTrades(p, rows); await go(p, 'review'); await p.evaluate(() => { STATE.revFilter = 'all'; STATE.revMonth = 0; setRevMode('beeld'); }); await p.waitForTimeout(300); };

  if (!deel || deel === '2') {
    console.log('─── 2. Beeld: ook trades zonder afbeelding ───');
    await naarBeeld([D, C, B, A]);
    ok('evenveel tegels als trades, nieuw → oud', (await p.evaluate(pairsOf, '.revcard')).join() === WANT.join(), (await p.evaluate(pairsOf, '.revcard')).join());
    const zonder = await p.evaluate(() => [...document.querySelectorAll('.revcard')].map(c => { const n = c.querySelector('.cardshot .noshot'); return n && getComputedStyle(n).display !== 'none' ? n.innerText.replace(/\s+/g, ' ') : ''; }));
    ok('trade zonder afbeelding: "Geen afbeelding"-tegel', /Geen afbeelding/.test(zonder[1]) && /Geen afbeelding/.test(zonder[3]), JSON.stringify(zonder));
    ok('tegel noemt pair, richting, datum en R', /BBB\/USDT/.test(zonder[1]) && /SHORT/.test(zonder[1]) && /18-10|18 okt/.test(zonder[1]) && /R/.test(zonder[1]), zonder[1]);
    ok('P&L in de tegel valt onder privacy (.mask)', await p.evaluate(() => !!document.querySelectorAll('.revcard')[1].querySelector('.noshot .mask')));
    ok('knop om een afbeelding toe te voegen', await p.evaluate(() => /afbeelding toevoegen/i.test(document.querySelectorAll('.revcard')[1].querySelector('.noshot').textContent)));
    ok('trade met afbeelding: geen "Geen afbeelding"', !zonder[0], zonder[0]);
    await p.waitForTimeout(400);
    const kapot = await p.evaluate(() => { const s = document.querySelectorAll('.revcard')[2].querySelector('.cardshot'), img = s.querySelector('img'), n = s.querySelector('.noshot');
      return { img: img ? getComputedStyle(img).display : 'weg', n: n ? getComputedStyle(n).display : 'geen', tekst: n ? n.innerText : '' }; });
    ok('afbeelding die niet laadt: geen gebroken plaatje, wel een nette melding', kapot.img === 'none' && kapot.n !== 'none' && /niet te laden/i.test(kapot.tekst), JSON.stringify(kapot));
    const maat = await p.evaluate(() => [...document.querySelectorAll('.revcard .cardshot')].map(e => Math.round(e.getBoundingClientRect().height)));
    ok('tegels zonder afbeelding even groot als met', new Set(maat).size === 1, maat.join());
    await naarBeeld([B, D]);
    ok('alle trades zonder afbeelding: tegels, geen lege staat', await p.evaluate(() => document.querySelectorAll('.revcard').length === 2 && !document.querySelector('.empty')));
    await p.evaluate(() => setRevFilter('done'));
    ok('niets in beeld door filter: lege staat met uitleg', await p.evaluate(() => /Geen trades in deze selectie/.test((document.querySelector('.empty') || {}).textContent || '')));
    await p.evaluate(() => setRevFilter('all'));
    for (const thema of ['light', 'dark']) {
      await naarBeeld([D, C, B, A]); await p.evaluate(t => setTheme(t), thema); await stil(p);
      const kl = await p.evaluate(() => { const n = document.querySelectorAll('.revcard')[1].querySelector('.noshot'); const cs = getComputedStyle(n); return { c: cs.color, bg: getComputedStyle(n.parentNode).backgroundColor }; });
      ok(`${thema}: tekst in de tegel leesbaar (kleur ≠ achtergrond)`, kl.c !== kl.bg, JSON.stringify(kl));
      await p.screenshot({ path: `tests/screenshots/review-beeld-info/tegels-${thema}.png` });
    }
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    ok('390 px: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 391), String(await p.evaluate(() => document.documentElement.scrollWidth)));
    await p.screenshot({ path: 'tests/screenshots/review-beeld-info/tegels-390.png', fullPage: false });
    await p.setViewportSize({ width: 1360, height: 900 }); await p.evaluate(() => setTheme('light'));
  }

  if (!deel || deel === '3') {
    console.log('─── 3. Beeld: klik toont de gegevens erbij ───');
    await naarBeeld([D, C, B, A]);
    await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[0].click()); await p.waitForTimeout(150);
    const open = () => p.evaluate(() => { const el = document.getElementById('revpres'); return !!el && el.classList.contains('on'); });
    ok('klik op tegel opent de weergave', await open());
    const info = () => p.evaluate(() => { const a = document.querySelector('#revpres aside'); return a && getComputedStyle(a).display !== 'none' ? a.innerText.replace(/\s+/g, ' ') : ''; });
    let txt = await info();
    ok('infopaneel: pair en richting', /AAA\/USDT/.test(txt) && /LONG/.test(txt), txt.slice(0, 120));
    ok('infopaneel: P&L en R', txt.includes(await p.evaluate(() => eurS(T.find(t => t.pair === 'AAA/USDT').pnl))) && txt.includes(await p.evaluate(() => rS(tradeROrNull(T.find(t => t.pair === 'AAA/USDT'))))), txt);
    const regels = await p.evaluate(() => revTagRegels(T.find(t => t.pair === 'AAA/USDT')).map(([l, v]) => [l, v.join(', ')]));
    const chips = await p.evaluate(() => [...document.querySelectorAll('#revpres aside .tagchip')].map(c => c.textContent.trim()));
    ok('playbook, setups en confirmaties uit de Discord-regels staan er als chip', regels.length === 3 && regels.every(([, v]) => v.split(', ').every(x => chips.includes(x))), JSON.stringify(regels) + ' | ' + chips.join());
    ok('entry/stop/exit, TP\'s en lagen (top-down)', /Entry/.test(txt) && /Stop/.test(txt) && /Exit/.test(txt) && /TP1/.test(txt) && /TP2/.test(txt) && /4H\s*→\s*15M/.test(txt), txt);
    ok('notitie, ge-escaped', txt.includes('Mooi geduld <b>x</b>') && await p.evaluate(() => !document.querySelector('#revpres aside b + x, #revpres aside .binote b')));
    ok('focus gaat naar de weergave', await p.evaluate(() => document.getElementById('revpres').contains(document.activeElement)));
    ok('knoppen hebben een label', await p.evaluate(() => [...document.querySelectorAll('#revpres button')].every(x => x.getAttribute('aria-label') || x.textContent.trim())));
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120);
    txt = await info();
    ok('→ naar de volgende trade (zonder afbeelding)', /BBB\/USDT/.test(txt) && /Geen afbeelding/.test(await p.evaluate(() => document.querySelector('#revpres .stage').innerText)), txt.slice(0, 80));
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(120);
    ok('← terug', /BBB\/USDT/.test(await info()));
    await p.keyboard.press('Escape'); await p.waitForTimeout(120);
    ok('Escape sluit', !(await open()));
    ok('focus terug op de tegel', await p.evaluate(() => { const a = document.activeElement; return !!a && !!a.closest('.revcard') && /AAA/.test(a.closest('.revcard').textContent); }));
    await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[1].click()); await p.waitForTimeout(120);
    ok('klik op tegel zonder afbeelding opent ook', await open() && /BBB\/USDT/.test(await info()));
    await p.evaluate(() => document.querySelector('#revpres .nav.x').click()); await p.waitForTimeout(100);
    ok('sluitknop sluit', !(await open()));
    await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[0].click()); await p.waitForTimeout(100);
    await p.evaluate(() => { const s = document.querySelector('#revpres .stage'); s.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await p.waitForTimeout(100);
    ok('klik buiten (achtergrond) sluit', !(await open()));

    console.log('─── 3. privacy, thema\'s, 390 px ───');
    await p.evaluate(() => { if (!STATE.priv) togglePriv(); });
    await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[0].click()); await p.waitForTimeout(120);
    txt = await info();
    ok('privacy-modus: geen bedragen in het paneel', !/1[.,]?234|1234/.test(txt) && !txt.includes(await p.evaluate(() => eurS(1234.5))), txt);
    ok('privacy-modus: R blijft staan', txt.includes(await p.evaluate(() => rS(tradeROrNull(T.find(t => t.pair === 'AAA/USDT'))))));
    await p.keyboard.press('Escape'); await p.evaluate(() => togglePriv());
    for (const thema of ['light', 'dark']) {
      await p.evaluate(t => setTheme(t), thema); await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[0].click()); await p.waitForTimeout(150);
      const kl = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('#revpres aside')); return { c: a.color, bg: a.backgroundColor }; });
      ok(`${thema}: paneel leesbaar`, kl.c !== kl.bg, JSON.stringify(kl));
      await p.screenshot({ path: `tests/screenshots/review-beeld-info/info-${thema}.png` });
      await p.keyboard.press('Escape');
    }
    await p.evaluate(() => setTheme('light'));
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelectorAll('.revcard .cardshot')[0].click()); await p.waitForTimeout(150);
    const lay = await p.evaluate(() => { const s = document.querySelector('#revpres .stage').getBoundingClientRect(), a = document.querySelector('#revpres aside'); const ar = a.getBoundingClientRect();
      return { zicht: getComputedStyle(a).display !== 'none', onder: ar.top >= s.bottom - 1, breed: Math.round(ar.width), sw: document.getElementById('revpres').scrollWidth }; });
    ok('390 px: paneel zichtbaar, onder de afbeelding, geen horizontale scroll', lay.zicht && lay.onder && lay.sw <= 391, JSON.stringify(lay));
    await p.screenshot({ path: 'tests/screenshots/review-beeld-info/info-390.png' });
    await p.evaluate(() => document.getElementById('revpres').scrollTo(0, 99999)); await p.screenshot({ path: 'tests/screenshots/review-beeld-info/info-390-onder.png' });
    await p.keyboard.press('Escape');
  }

  if (!deel || deel === '4') {
    console.log('─── 4. Beeld: alle tags als gekleurde chips ───');
    // E: layers + every kind; F: no layers, only flat fields (older trades); G: closed on its stop; H: no tags at all
    const E = mk('EEE/USDT', { date: '2026-10-22', closeTime: ms('2026-10-22T15:00:00Z'), screenshots: [PNG], setup: 'Breakout',
      layers: [{ timeframe: '1H', setups: ['MSB'], confirmations: ['OB', 'FVG'] }], emotions: ['Rustig'], mistakes: ['Te vroeg in'], tags: ['Test'] });
    const F = mk('FFF/USDT', { date: '2026-10-21', closeTime: ms('2026-10-21T15:00:00Z'), timeframe: '4H', layers: [],
      tags: ['OB', 'SFP', 'nieuwsdag'], emotions: [], emotion: 'FOMO', mistakes: [], mistake: 'Geen plan', missedReasons: ['Durf'] });
    const G = mk('GGG/USDT', { date: '2026-10-19', closeTime: ms('2026-10-19T15:00:00Z'), pnl: -30, r: -1, entry: 85, stop: 79.901, exit: 79.901,
      tps: [{ price: 90, pct: 0, hit: false }, { price: 79.901, pct: 100, hit: true, soort: 'sl' }] });
    const H = mk('HHH/USDT', { date: '2026-10-17', closeTime: ms('2026-10-17T15:00:00Z') });
    const openTegel = async pair => { await p.evaluate(pr => [...document.querySelectorAll('.revcard')].find(c => c.textContent.includes(pr)).querySelector('.cardshot').click(), pair); await p.waitForTimeout(150); };
    const groepen = () => p.evaluate(() => [...document.querySelectorAll('#revpres aside .bitags .birow')].map(r => ({
      soort: r.dataset.soort, kop: r.querySelector('.l').textContent.trim(),
      chips: [...r.querySelectorAll('.tagchip')].map(c => ({ t: c.textContent.trim(), kleur: getComputedStyle(c).color })) })));
    const SOORT = { setupTags: 'var(--accent)', confirmationTags: 'var(--teal)', timeframeTags: 'var(--violet)', mistakeTags: 'var(--amber)', missedReasonTags: 'var(--pink)', customTags: 'var(--muted)' };
    const kleurVan = v => p.evaluate(v => { const d = document.createElement('span'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, v);
    // the chip colour per tag in the trade list, the reference for "same colour as everywhere"
    const lijstKleuren = () => p.evaluate(() => { go('trades'); const m = {}; document.querySelectorAll('td[data-l="Tags"] .tagchip').forEach(c => { m[c.textContent.trim()] = getComputedStyle(c).color; }); return m; });

    for (const thema of ['light', 'dark']) {
      await naarBeeld([H, G, F, E]); await p.evaluate(t => setTheme(t), thema); await stil(p);
      const lijst = await lijstKleuren();
      await go(p, 'review'); await p.evaluate(() => setRevMode('beeld')); await p.waitForTimeout(200);
      await openTegel('EEE/USDT');
      const g = await groepen();
      const kop = thema === 'light' ? '' : ' (donker)';
      ok('trade met lagen: soorten in de afgesproken volgorde' + kop, g.map(x => x.kop).join('|') === 'Playbook|Timeframe|Setup-type|Confirmaties|Emoties|Fouten|Eigen labels', g.map(x => x.kop).join('|'));
      ok('elke tag één keer, als chip' + kop, JSON.stringify(g.map(x => x.chips.map(c => c.t))) === JSON.stringify([['Breakout'], ['1H'], ['MSB'], ['OB', 'FVG'], ['Rustig'], ['Te vroeg in'], ['Test']]), JSON.stringify(g.map(x => x.chips.map(c => c.t))));
      const verw = { MSB: await kleurVan(SOORT.setupTags), OB: await kleurVan(SOORT.confirmationTags), FVG: await kleurVan(SOORT.confirmationTags), '1H': await kleurVan(SOORT.timeframeTags),
        Rustig: await kleurVan('var(--green)'), 'Te vroeg in': await kleurVan(SOORT.mistakeTags), Test: await kleurVan(SOORT.customTags) };
      const kleur = Object.fromEntries(g.flatMap(x => x.chips.map(c => [c.t, c.kleur])));
      ok('elke chip in de kleur van zijn soort' + kop, Object.entries(verw).every(([t, c]) => kleur[t] === c), JSON.stringify({ kleur, verw }));
      ok('dezelfde kleur als dezelfde chip in de tradelijst' + kop, Object.keys(verw).every(t => lijst[t] && lijst[t] === kleur[t]), JSON.stringify({ lijst, kleur }));
      ok('chips gebruiken de bestaande tag-chip (.tagchip.col)' + kop, await p.evaluate(() => [...document.querySelectorAll('#revpres aside .bitags .tagchip')].filter(c => c.textContent.trim() !== 'Breakout').every(c => c.classList.contains('col'))));
      await p.screenshot({ path: `tests/screenshots/review-beeld-info/tags-${thema}.png` });
      await p.keyboard.press('Escape');
    }
    await p.evaluate(() => setTheme('light'));
    const negRood = await kleurVan('var(--red)');

    await openTegel('FFF/USDT');
    let g = await groepen();
    ok('trade zonder lagen: platte tags verschijnen', JSON.stringify(g.map(x => [x.kop, x.chips.map(c => c.t)])) === JSON.stringify([['Timeframe', ['4H']], ['Setup-type', ['SFP']], ['Confirmaties', ['OB']], ['Emoties', ['FOMO']], ['Fouten', ['Geen plan']], ['Missed-redenen', ['Durf']], ['Eigen labels', ['nieuwsdag']]]), JSON.stringify(g.map(x => [x.kop, x.chips.map(c => c.t)])));
    ok('negatieve emotie rood, missed-reden roze', (g.find(x => x.kop === 'Emoties') || { chips: [{}] }).chips[0].kleur === negRood && (g.find(x => x.kop === 'Missed-redenen') || { chips: [{}] }).chips[0].kleur === await kleurVan('var(--pink)'));
    ok('geen "Lagen —" en geen lege kopjes', await p.evaluate(() => { const a = document.querySelector('#revpres aside').innerText; return !/Lagen\s*—/.test(a) && [...document.querySelectorAll('#revpres aside .bitags .birow')].every(r => r.querySelector('.tagchip')); }));
    await p.keyboard.press('Escape');

    await openTegel('HHH/USDT');
    const leeg = await p.evaluate(() => { const a = document.querySelector('#revpres aside'); return { txt: a.innerText, rijen: a.querySelectorAll('.bitags .birow').length, knop: !!a.querySelector('.bitags button') }; });
    ok('trade zonder tags: "Nog geen tags", geen kopjes', /Nog geen tags/.test(leeg.txt) && leeg.rijen === 0 && !/Playbook|Timeframe|Setup-type|Lagen/.test(leeg.txt), JSON.stringify(leeg));
    ok('"Nog geen tags" heeft een knop naar het formulier', leeg.knop);
    await p.evaluate(() => document.querySelector('#revpres aside .bitags button').click()); await p.waitForTimeout(250);
    ok('die knop sluit de weergave en opent het trade-formulier van deze trade', await p.evaluate(() => { const el = document.getElementById('revpres'); const f = document.getElementById('f_pair'); return !el.classList.contains('on') && !!f && f.value === 'HHH/USDT'; }));
    await p.evaluate(() => { try { closeForm(); } catch (e) {} }); await p.waitForTimeout(100);

    await go(p, 'review'); await p.evaluate(() => setRevMode('beeld')); await p.waitForTimeout(200);
    await openTegel('GGG/USDT');
    const sl = await p.evaluate(() => [...document.querySelectorAll('#revpres aside .birow')].filter(r => /^SL/.test(r.querySelector('.l').textContent.trim())).map(r => { const v = r.querySelector('.v'); return { tekst: r.innerText.replace(/\s+/g, ' '), groen: v.classList.contains('g'), rood: v.classList.contains('r') }; }));
    ok('stop-loss-sluiting: rij "SL", niet groen en zonder ✓ van een behaalde TP', sl.length === 1 && !sl[0].groen && sl[0].rood && !/✓/.test(sl[0].tekst), JSON.stringify(sl));
    ok('Discord-tekst ongewijzigd voor de SL', await p.evaluate(() => /SL 79[.,]901/.test(revDiscordTekst(T.find(t => t.pair === 'GGG/USDT'), true))));
    await p.keyboard.press('Escape');

    await p.evaluate(() => { if (!STATE.priv) togglePriv(); });
    await openTegel('EEE/USDT');
    ok('privacy-modus: geen bedrag, tags blijven', await p.evaluate(() => { const a = document.querySelector('#revpres aside'); return !a.innerText.includes(eurS(50)) && a.querySelectorAll('.bitags .tagchip').length === 8; }));
    await p.keyboard.press('Escape'); await p.evaluate(() => togglePriv());

    // 390 px: panel under the image, long tags wrap inside the panel, the view scrolls itself
    await p.evaluate(() => { const t = T.find(x => x.pair === 'EEE/USDT'); t.tags = ['Test', 'een heel erg lange eigen tag die nooit op één regel past bij 390 px']; persist(); });
    await p.setViewportSize({ width: 390, height: 844 }); await go(p, 'review'); await p.evaluate(() => setRevMode('beeld')); await p.waitForTimeout(200);
    await openTegel('EEE/USDT');
    const m = await p.evaluate(() => { const el = document.getElementById('revpres'), a = el.querySelector('aside'), ar = a.getBoundingClientRect();
      const uit = [...a.querySelectorAll('.tagchip')].filter(c => c.getBoundingClientRect().right > ar.right + 1).map(c => c.textContent);
      return { sw: el.scrollWidth, uit, scrollt: el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible' }; });
    ok('390 px: lange tags lopen door binnen het paneel, geen horizontale scroll', m.sw <= 391 && !m.uit.length, JSON.stringify(m));
    ok('390 px: de weergave scrollt zelf', m.scrollt, JSON.stringify(m));
    await p.evaluate(() => { const a = document.querySelector('#revpres aside'); a.scrollIntoView(); }); await p.screenshot({ path: 'tests/screenshots/review-beeld-info/tags-390.png' });
    await p.keyboard.press('Escape'); await p.setViewportSize({ width: 1360, height: 900 });
  }
  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${pass} ✓  ${fail} ✗`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
