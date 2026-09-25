// Tradingplan: de drie uitbreidingen van 19-09-2026 (Denny koos voorstel 4, 5 en 6).
// Bijgesteld 25-09-2026 voor v2: geen uitleg-modal in de test, overzicht = cockpit (#ov-sc),
// oordeel heet vol/half/geen en vraagt eerst een setup-type.
//  4 — het dagplan vult zichzelf half in vanuit het weekplan en je vorige dag
//  5 — scenario's zijn als-dan-dan-niet i.p.v. één vrij tekstvak
//  6 — je eigen no-trade-condities uit het weekplan gelden als harde check in de poort
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const URL_APP = 'file:///' + path.resolve('tradingplan/tradingplan.html').replace(/\\/g, '/');

(async () => {
  const b = await chromium.launch(); const errs = [];

  // Verse context per scenario: de app bewaart alles in localStorage/IndexedDB.
  async function open(seed) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.addInitScript(() => { localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); });
    if (seed) await p.addInitScript(s => { localStorage.setItem('tp2:plans', JSON.stringify(s)); }, seed);
    await p.goto(URL_APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(700);
    return { ctx, p };
  }
  const vandaag = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const gisteren = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  console.log('─── Voorstel 5: scenario als als-dan ───');
  {
    const { ctx, p } = await open();
    await p.click('.tabs button[data-tab="dag"]');
    await p.click('#sc-add');
    const velden = await p.evaluate(() => ['.sc-als', '.sc-dan', '.sc-ong'].map(s => !!document.querySelector('#sc-wrap ' + s)));
    ok('scenario heeft de velden Als, Dan en Ongeldig bij', velden.every(Boolean), JSON.stringify(velden));
    await p.fill('#sc-wrap .sc-als', 'prijs sweept de weekend-low');
    await p.fill('#sc-wrap .sc-dan', 'long vanaf de 15m OB, TP1 op POC');
    await p.fill('#sc-wrap .sc-ong', '15m sluit onder 73.8k');
    await p.waitForTimeout(1100);   // het opslaan van een concept is 700ms uitgesteld
    const opgeslagen = await p.evaluate(() => {
      const all = JSON.parse(localStorage.getItem('tp2:plans') || '{}');
      const dag = Object.keys(all).filter(k => k.indexOf('dag-') === 0)[0];
      return dag ? all[dag].scenarios[0] : null;
    });
    ok('de drie velden worden los opgeslagen', opgeslagen && opgeslagen.als.includes('weekend-low') && opgeslagen.dan.includes('POC') && opgeslagen.ongeldig.includes('73.8k'), JSON.stringify(opgeslagen).slice(0, 120));

    const ovTekst = await p.evaluate(() => { const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('overzicht'); return document.querySelector('#ov-sc').innerText; });
    ok('het overzicht toont Als en Dan als losse regels', /Als\s+prijs sweept/i.test(ovTekst) && /Dan\s+long vanaf/i.test(ovTekst), JSON.stringify(ovTekst.slice(0, 160)));
    ok('en waar het scenario ongeldig wordt', /ongeldig\s+15m sluit onder 73\.8k/i.test(ovTekst));

    const toelichting = await p.evaluate(() => {
      const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('dag'); const btn = document.querySelector('#sc-wrap .sc-note'); if (!btn) return 'knop ontbreekt';
      btn.click(); return document.querySelector('#sc-wrap .sc-text') ? 'open' : 'bleef dicht';
    });
    ok('toelichting is optioneel en op te vouwen', toelichting === 'open', toelichting);
    await ctx.close();
  }

  console.log('─── Voorstel 5: oude scenario’s blijven leesbaar ───');
  {
    const oud = {}; oud['dag-' + vandaag()] = { id: 'dag-' + vandaag(), type: 'dag', key: vandaag(), checks: {}, images: [], links: [], scenarios: [{ title: 'Oud', text: 'Als prijs de low pakt dan long.', images: [], links: [] }] };
    const { ctx, p } = await open(oud);
    const r = await p.evaluate(() => { const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('dag'); return { tekstveld: (document.querySelector('#sc-wrap .sc-text') || {}).value, als: (document.querySelector('#sc-wrap .sc-als') || {}).value, ov: document.querySelector('#ov-sc').innerText }; });
    ok('bestaande vrije tekst blijft staan als toelichting', r.tekstveld === 'Als prijs de low pakt dan long.', JSON.stringify(r.tekstveld));
    ok('en gaat niet verloren in het overzicht', r.ov.includes('Als prijs de low pakt dan long.'));
    ok('de nieuwe velden zijn leeg, niets wordt verzonnen', r.als === '', JSON.stringify(r.als));
    await ctx.close();
  }

  console.log('─── Voorstel 4: dagplan neemt over uit weekplan en gisteren ───');
  {
    const { ctx, p } = await open();
    await p.evaluate(() => {
      const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('week');
      const set = (f, v) => { const el = document.querySelector('[data-f="wk:' + f + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('levels', '76.8k supply\n74.2k demand'); set('liq', 'weekend high 79.1k'); set('focus', 'Geen entry zonder SFP'); set('maxtrades', '5');
    });
    await p.waitForTimeout(250);
    const ctxTekst = await p.evaluate(() => { const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('dag'); return document.querySelector('#dg-ctx').innerText; });
    ok('het dagplan toont de weekcontext', ctxTekst.includes('Geen entry zonder SFP') && ctxTekst.includes('Max trades'), JSON.stringify(ctxTekst.slice(0, 140)));

    await p.click('#dg-take-wk');
    await p.waitForTimeout(300);
    const levels = await p.evaluate(() => document.querySelector('[data-f="dg:levels"]').value);
    ok('levels én liquiditeit komen over', levels.includes('76.8k supply') && levels.includes('weekend high 79.1k'), JSON.stringify(levels));

    const nogmaals = await p.evaluate(async () => {
      const voor = document.querySelector('[data-f="dg:levels"]').value;
      document.getElementById('dg-take-wk').click(); await new Promise(r => setTimeout(r, 200));
      return { zelfde: document.querySelector('[data-f="dg:levels"]').value === voor, toast: document.getElementById('toast').textContent };
    });
    ok('een tweede keer overnemen overschrijft niets', nogmaals.zelfde && /al ingevuld/.test(nogmaals.toast), JSON.stringify(nogmaals));
    await ctx.close();
  }
  {
    const seed = {}; seed['dag-' + gisteren()] = { id: 'dag-' + gisteren(), type: 'dag', key: gisteren(), checks: {}, images: [], links: [], scenarios: [], bias: 'Bullish', tD: 'up', t4: 'up', t1: 'range', levels: 'POC 75.4k' };
    const { ctx, p } = await open(seed);
    await p.click('.tabs button[data-tab="dag"]');
    const knop = await p.evaluate(() => !!document.getElementById('dg-take-prev'));
    ok('de knop "neem gisteren over" verschijnt', knop);
    await p.click('#dg-take-prev');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      bias: document.querySelector('[data-segf="dg:bias"] button[aria-pressed="true"]').dataset.v,
      tD: document.querySelector('[data-f="dg:tD"]').value, levels: document.querySelector('[data-f="dg:levels"]').value,
    }));
    ok('bias, trend en levels komen over', r.bias === 'Bullish' && r.tD === 'up' && r.levels === 'POC 75.4k', JSON.stringify(r));
    ok('de dagstart-checklist blijft leeg (geen vals afvinken)', await p.evaluate(() => document.querySelectorAll('#dg-list input:checked').length === 0));
    await ctx.close();
  }

  console.log('─── Voorstel 6: no-trade-condities als harde check ───');
  {
    const { ctx, p } = await open();
    const leeg = await p.evaluate(() => { const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('poort'); return document.getElementById('pt-notrade').innerText; });
    ok('zonder condities legt de poort uit waar je ze zet', /weekplan/i.test(leeg), JSON.stringify(leeg.slice(0, 90)));

    await p.evaluate(() => {
      const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('week');
      const el = document.querySelector('[data-f="wk:notrade"]');
      el.value = 'Binnen 2 minuten na high-impact nieuws\nNa 2 verliezers op één dag';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    const na = await p.evaluate(() => { const tab=t=>document.querySelector('.tabs button[data-tab="'+t+'"]').click(); tab('poort'); return { n: document.querySelectorAll('#pt-notrade input').length, blok: !!document.querySelector('#pt-notrade .nt.blocked') }; });
    ok('beide condities staan in de poort, en blokkeren zolang ze openstaan', na.n === 2 && na.blok, JSON.stringify(na));
    ok('het oordeel loopt niet achter op het blok', /No-trade-conditie/.test(await p.evaluate(() => document.getElementById('pt-why').textContent)));

    const allesAf = await p.evaluate(async () => {
      document.querySelectorAll('#pt-list input').forEach(i => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise(r => setTimeout(r, 100));
      return { oordeel: document.querySelector('#pt-verdict .g').textContent, reden: document.getElementById('pt-why').textContent };
    });
    ok('7 van 7 afgevinkt is nog steeds geen trade zolang een conditie openstaat', allesAf.oordeel === 'Geen trade' && /No-trade-conditie/.test(allesAf.reden), JSON.stringify(allesAf));

    const vrij = await p.evaluate(async () => {
      document.querySelector('#pt-stype [data-t="A"]').click();
      document.querySelectorAll('#pt-notrade input').forEach(i => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await new Promise(r => setTimeout(r, 120));
      return { oordeel: document.querySelector('#pt-verdict .g').textContent, blok: !!document.querySelector('#pt-notrade .nt.blocked') };
    });
    ok('zijn ze afgevinkt, dan geldt gewoon het oordeel (A-setup, alles af: volle size 2%)', vrij.oordeel === 'Volle size · 2%' && !vrij.blok, JSON.stringify(vrij));

    const eenOpen = await p.evaluate(async () => {
      const i = document.querySelector('#pt-notrade input'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      document.getElementById('pt-taken').checked = true; document.getElementById('pt-taken').dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('pt-save').click();
      await new Promise(r => setTimeout(r, 250));
      const t = JSON.parse(localStorage.getItem('tp2:trades'))[0];
      return { noTrade: t.noTrade, grade: t.exec, log: document.getElementById('log-body').innerText };
    });
    ok('de openstaande conditie gaat mee de log in', (eenOpen.noTrade || []).length === 1 && eenOpen.grade === 'NO', JSON.stringify(eenOpen.noTrade));
    ok('en is zichtbaar in de logregel', /No-trade:/.test(eenOpen.log), JSON.stringify(eenOpen.log.slice(0, 120)));

    const schoon = await p.evaluate(() => ({ vinkjes: document.querySelectorAll('#pt-notrade input:checked').length, blok: !!document.querySelector('#pt-notrade .nt.blocked') }));
    ok('na opslaan staat de poort weer schoon voor de volgende trade', schoon.vinkjes === 0 && schoon.blok, JSON.stringify(schoon));

    const csv = await p.evaluate(() => { const h = ['datum']; return document.getElementById('exp-csv') ? 'ok' : 'mist'; });
    ok('de CSV-knop bestaat nog', csv === 'ok');
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Tradingplan (voorstel 4/5/6): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
