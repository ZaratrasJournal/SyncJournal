// SyncJournal Drive-token-broker — Cloudflare Worker (fase 4: langer ingelogd blijven)
//
// Wat dit doet: Google geeft browser-apps zonder server maar 1 uur toegang. Met deze
// mini-Worker wisselt SyncJournal eenmalig een autorisatie-code in voor een REFRESH
// token; daarna kan de app stil nieuwe uur-tokens ophalen zolang de gebruiker de
// koppeling niet intrekt. De Worker bewaart NIETS: hij kent alleen het client secret
// (als Worker-secret) en speelt verzoeken door naar Google. Het refresh token blijft,
// net als alle andere data, uitsluitend in de browser van de gebruiker.
//
// Deploy (Denny, eenmalig, ±5 min):
// 1. Cloudflare-dashboard → Workers & Pages → Create → Worker → naam bijv.
//    "syncjournal-drive-token" → plak dit bestand → Deploy.
// 2. Worker → Settings → Variables and Secrets:
//      GOOGLE_CLIENT_ID     = 625279040986-2pk0t1repmdciiumlcrmvapv0ctjvhok.apps.googleusercontent.com
//      GOOGLE_CLIENT_SECRET = (het client secret uit Google Cloud Console → Credentials) [type: Secret]
// 3. Worker → Settings → Domains & Routes → Custom domain: drive-token.syncjournal.nl
// 4. Klaar. De app-kant (aparte SyncJournal-release) gebruikt dan deze URL.
//
// Google Cloud Console (eenmalig): bij de bestaande OAuth-client hoeft NIETS te
// veranderen — de code-flow gebruikt redirect_uri "postmessage" (popup), die geen
// geregistreerde redirect vereist.

const ALLOWED_ORIGINS = [
  'https://syncjournal.nl',
  'https://work.syncjournal.nl',
];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': 'no-store',
  };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors(origin) });

    let body;
    try { body = await req.json(); } catch (e) { return new Response('bad json', { status: 400, headers: cors(origin) }); }

    // Twee smaken: { code } (eerste koppeling, popup-code-flow) of { refresh_token } (stille verlenging).
    const params = new URLSearchParams(
      body.code
        ? { code: body.code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: 'postmessage', grant_type: 'authorization_code' }
        : body.refresh_token
          ? { refresh_token: body.refresh_token, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }
          : null
    );
    if (![...params.keys()].length) return new Response('code of refresh_token vereist', { status: 400, headers: cors(origin) });

    const g = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const d = await g.json();

    // Alleen de velden die de app nodig heeft doorsturen; nooit loggen of opslaan.
    const out = d.error
      ? { error: d.error, error_description: d.error_description }
      : { access_token: d.access_token, expires_in: d.expires_in, refresh_token: d.refresh_token };
    return new Response(JSON.stringify(out), { status: g.ok ? 200 : 400, headers: { 'content-type': 'application/json', ...cors(origin) } });
  },
};
