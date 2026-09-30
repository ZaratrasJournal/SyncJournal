/* ── Monitoring voor het dagrapport (SyncJournal, 30-09-2026) ─────────────────────────────────
   Plak dit onderaan worker.js en hernoem het bestaande `export default {` bovenin naar
   `const proxy = {`. Uitleg en de stappen in Cloudflare: docs/worker-monitoring.md.

   Telt per verzoek alleen: exchange, actie, uitkomst, client, HTTP-status en duur, en bij een fout
   de foutmelding van de exchange zonder IP-adressen of sleutels. `koppeling` is een onomkeerbare
   vingerafdruk van de API-sleutel (HMAC met een geheim dat alleen in de Worker staat): zo ziet het
   dagrapport dat een fout steeds van dezelfde koppeling komt, zonder te weten welke.

   Zonder de binding SJ_METRICS doet dit blok niets, en zonder het geheim SJ_KOPPEL_ZOUT blijft de
   vingerafdruk leeg. De volgorde van deployen maakt dus niet uit. */
export default {
  async fetch(request, env, ctx) {
    const start = Date.now();
    let meta = {};
    if (request.method === 'POST') { try { meta = await request.clone().json(); } catch (e) {} }
    let response, workerFout = false;
    try { response = await proxy.fetch(request, env, ctx); }
    catch (e) { workerFout = true; response = json({ error: 'Worker fout' }, 500); }
    if (env && env.SJ_METRICS && request.method === 'POST') {
      const tellen = telVerzoek(env, meta, response.clone(), Date.now() - start, workerFout).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(tellen);
    }
    return response;
  }
};

// Uitkomsten zoals het dagrapport ze groepeert. Volgorde telt: een 429 is een rate-limit, ook al
// noemt de tekst ook een sleutel.
function foutSoort(status, fout, workerFout) {
  if (workerFout) return 'worker-fout';
  if (status === 429 || /rate.?limit|too many request|1015|apiLimitExceeded/i.test(fout)) return 'rate-limit';
  if (/(^|[^a-z])ip([^a-z]|$)/i.test(fout) && /(whitelist|white ?list|allowlist|not included)/i.test(fout)) return 'ip-whitelist';
  if (/access.?key|api.?key|passphrase|\bsign(ature)?\b|authenticat|unauthori[sz]ed|permission/i.test(fout)) return 'sleutel';
  if (status === 400 || status === 405) return 'verzoek';
  return 'exchange-fout';
}

// Een foutmelding zonder IP-adressen en zonder lange tokens (sleutels, handtekeningen), ingekort.
function schoneFout(t) {
  return String(t || '')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\b[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}\b/gi, '[ip]')
    .replace(/[A-Za-z0-9+/]{30,}={0,2}/g, '…')      // base64 (handtekeningen)
    .replace(/[A-Za-z0-9_\-+=]{20,}/g, '…')        // sleutels en andere lange tokens; paden als /api/v5/... blijven leesbaar
    .slice(0, 100);
}

async function vingerafdruk(env, meta) {
  if (!env.SJ_KOPPEL_ZOUT || !meta.apiKey) return '';
  const enc = new TextEncoder();
  const sleutel = await crypto.subtle.importKey('raw', enc.encode(env.SJ_KOPPEL_ZOUT), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h = await crypto.subtle.sign('HMAC', sleutel, enc.encode(String(meta.exchange) + ':' + String(meta.apiKey)));
  return [...new Uint8Array(h).slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join('');   // 8 tekens is genoeg om koppelingen uit elkaar te houden
}

async function telVerzoek(env, meta, response, duur, workerFout) {
  let fout = '';
  const tekst = await response.text();
  // Alleen de fout lezen, niet de hele (soms grote) trade-lijst parsen: dat kost CPU-tijd.
  if (response.status !== 200 || tekst.startsWith('{"error"')) { try { fout = String(JSON.parse(tekst).error || ''); } catch (e) { fout = tekst.slice(0, 200); } }
  const uitkomst = response.status === 200 && !fout ? 'ok' : foutSoort(response.status, fout, workerFout);
  env.SJ_METRICS.writeDataPoint({
    blobs: [String(meta.exchange || ''), String(meta.action || ''), uitkomst, uitkomst === 'ok' ? '' : schoneFout(fout), String(meta.client || 'onbekend')],
    doubles: [response.status, duur],
    indexes: [await vingerafdruk(env, meta)],
  });
}
