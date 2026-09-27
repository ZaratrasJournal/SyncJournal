// Elke Worker-aanroep draagt een vast kenmerk, zodat de Worker verzoeken van buiten onze app
// kan weigeren. Geen beveiliging (het staat in de client) maar een drempel tegen meeliften:
// de Worker stond open voor iedereen die de URL kende — gemeten 27-09-2026, ACAO was `*` voor
// elke origin. Het kenmerk zit in de BODY, niet in een header: een eigen header maakt van elk
// verzoek een CORS-preflight en dat zou de Worker eerst moeten toestaan.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  // fetch vervangen zodat we zien wat er de deur uit gaat, zonder de Worker te raken
  const r = await p.evaluate(async () => {
    const gezien = [];
    const echte = window.fetch;
    window.fetch = async (u, o) => { gezien.push({ u: String(u), body: o && o.body, headers: (o && o.headers) || {} }); return { ok: true, status: 200, json: async () => ({ ok: 1 }), text: async () => '{}' }; };
    await proxyCall({ exchange: 'okx', action: 'test', apiKey: 'K', apiSecret: 'S' });
    window.fetch = echte;
    const b1 = JSON.parse(gezien[0].body);
    return { aantal: gezien.length, body: b1, headerNamen: Object.keys(gezien[0].headers), tag: typeof CLIENT_TAG !== 'undefined' ? CLIENT_TAG : null };
  });

  console.log('─── Het kenmerk gaat mee ───');
  ok('CLIENT_TAG bestaat en is niet leeg', !!r.tag, JSON.stringify(r.tag));
  ok('de body draagt client = CLIENT_TAG', r.body.client === r.tag, JSON.stringify(r.body.client));
  ok('de rest van de payload blijft intact', r.body.exchange === 'okx' && r.body.action === 'test' && r.body.apiKey === 'K', JSON.stringify(Object.keys(r.body)));

  console.log('─── Geen eigen header, dus geen preflight ───');
  ok('alleen Content-Type als header', r.headerNamen.length === 1 && /content-type/i.test(r.headerNamen[0]), JSON.stringify(r.headerNamen));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Proxy-clienttag: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
