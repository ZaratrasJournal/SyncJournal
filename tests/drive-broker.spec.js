// Borgt Drive fase 4 (Denny 2026-09-17): eenmalig koppelen via de popup-code-flow levert
// een refresh-token op; daarna verlengt de app stil via de token-broker en is "opnieuw
// verbinden" verleden tijd. Gedekt: koppelen, stille verlenging, overleven van een
// herlaad, intrekking (rt gewist + banner-conditie), broker-uitval (terugval op de oude
// uur-flow) en dat het refresh-token NOOIT in backups/exports belandt.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);

  const stub = () => {
    window.__brk = { mode: 'ok', calls: [] };
    window.google = { accounts: { oauth2: {
      initCodeClient: (cfg) => ({ requestCode: () => setTimeout(() => cfg.callback({ code: 'CODE-1' }), 5) }),
      initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'LEGACY-AT', expires_in: 3600 }), 5) }),
    } } };
    const orig = window.fetch;
    window.fetch = async (u, opt) => {
      if (String(u).startsWith(DRIVE_BROKER)) {
        const body = JSON.parse(opt.body);
        window.__brk.calls.push(body);
        if (window.__brk.mode === 'offline') throw new Error('netwerk weg');
        if (window.__brk.mode === 'revoked') return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'revoked' }), { status: 400 });
        if (body.code) return new Response(JSON.stringify({ access_token: 'AT-1', expires_in: 3600, refresh_token: 'RT-GEHEIM-1' }), { status: 200 });
        return new Response(JSON.stringify({ access_token: 'AT-VERLENGD', expires_in: 3600 }), { status: 200 });
      }
      return orig(u, opt);
    };
  };
  await p.evaluate(s => { try { hideWelcome() } catch (e) {} eval('(' + s + ')()'); }, String(stub));
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Eenmalig koppelen (code-flow via broker) ───');
  const r1 = await p.evaluate(async () => { const t = await driveToken(true); const st = DB.load('drive_tok', {}); return { t, rt: DRIVE.rt, stored: st.rt, needsAuth: DRIVE.needsAuth, sentCode: window.__brk.calls.some(c => c.code === 'CODE-1') }; });
  ok('popup-code → broker → uur-token + refresh-token opgeslagen', r1.t === 'AT-1' && r1.rt === 'RT-GEHEIM-1' && r1.stored === 'RT-GEHEIM-1' && !r1.needsAuth && r1.sentCode, JSON.stringify(r1));

  console.log('─── Stille verlenging (het nooit-meer-verbinden-pad) ───');
  const r2 = await p.evaluate(async () => { DRIVE.token = null; DRIVE.tokenExp = 0; const t = await driveToken(false); return { t, needsAuth: DRIVE.needsAuth, refreshed: window.__brk.calls.some(c => c.refresh_token === 'RT-GEHEIM-1') }; });
  ok('verlopen token → stil nieuw token, geen banner, geen popup', r2.t === 'AT-VERLENGD' && !r2.needsAuth && r2.refreshed, JSON.stringify(r2));

  console.log('─── Herladen: refresh-token overleeft ───');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(s => { try { hideWelcome() } catch (e) {} eval('(' + s + ')()'); }, String(stub));
  const r3 = await p.evaluate(async () => { DRIVE.token = null; DRIVE.tokenExp = 0; const t = await driveToken(false); return { rt: DRIVE.rt, t }; });
  ok('na herlaad: rt uit opslag, stille verlenging werkt direct', r3.rt === 'RT-GEHEIM-1' && r3.t === 'AT-VERLENGD', JSON.stringify(r3));

  console.log('─── Koppeling ingetrokken bij Google ───');
  const r4 = await p.evaluate(async () => { window.__brk.mode = 'revoked'; DRIVE.token = null; DRIVE.tokenExp = 0; let failed = false; try { await driveToken(false); } catch (e) { failed = true; } return { failed, rt: DRIVE.rt, stored: (DB.load('drive_tok', {}) || {}).rt, needsAuth: DRIVE.needsAuth }; });
  ok('intrekking → rt gewist (ook uit opslag) + herverbind-status', r4.failed && r4.rt === '' && !r4.stored && r4.needsAuth, JSON.stringify(r4));

  console.log('─── Broker onbereikbaar ───');
  const r5 = await p.evaluate(async () => { window.__brk.mode = 'offline'; DRIVE.needsAuth = false; DRIVE.token = null; DRIVE.tokenExp = 0; const t = await driveToken(true); return { t, needsAuth: DRIVE.needsAuth }; });
  ok('interactief + broker plat → terugval op oude uur-flow (Drive blijft werken)', r5.t === 'LEGACY-AT' && !r5.needsAuth, JSON.stringify(r5));
  ok('stil + broker plat → geen paniek-banner (backup-leeftijd waakt eerlijk)', await p.evaluate(async () => { DRIVE.rt = 'RT-GEHEIM-1'; DRIVE.needsAuth = false; DRIVE.token = null; DRIVE.tokenExp = 0; try { await driveToken(false); } catch (e) {} return DRIVE.needsAuth === false; }));

  console.log('─── Veiligheid ───');
  ok('refresh-token zit NOOIT in exports of backups', await p.evaluate(() => { DRIVE.rt = 'RT-GEHEIM-1'; const s = JSON.stringify(snapshotPayload()); return !s.includes('RT-GEHEIM-1') && !s.includes('drive_tok'); }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Drive-broker (fase 4): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
