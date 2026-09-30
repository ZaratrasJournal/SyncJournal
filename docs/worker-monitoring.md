# Monitoring in de Worker — voor het dagrapport

*Voor Denny, en voor Morani: `morani-proxy` draait in **het Cloudflare-account van Morani**, dus
deze stappen gebeuren daar, door Morani of door jou als je toegang hebt tot zijn account. De
tellingen komen ook daar te staan. Morani's eigen journal gebruikt dezelfde Worker; vraag hem dus
eerst of hij akkoord is. De Worker-code zit buiten deze repo; hieronder staat wat erin moet en wat je
in Cloudflare instelt. De code zelf staat in [worker-monitoring.js](worker-monitoring.js) en is getest
met `node tests/worker-monitoring.spec.js`.*

---

## Wat het doet

Na elk verzoek schrijft de Worker één telling naar **Workers Analytics Engine** (dataset `sj_proxy`):

| Veld | Inhoud | Voorbeeld |
|---|---|---|
| blob1 | exchange | `okx` |
| blob2 | actie | `trades` |
| blob3 | uitkomst | `ok`, `ip-whitelist`, `sleutel`, `rate-limit`, `exchange-fout`, `verzoek`, `worker-fout` |
| blob4 | bij een fout: de foutmelding, zonder IP-adressen en sleutels — **alleen voor SyncJournal** | `OKX /api/v5/account/balance: Your IP [ip] is not included…` |
| blob5 | client | `syncjournal-web`, of `ander` (Morani's journal, de oude TradeJournal) |
| double1, double2 | HTTP-status, duur in ms | `500`, `312` |
| index1 | vingerafdruk van de koppeling — **alleen voor SyncJournal** | `3f9a0c1e` |

Verzoeken van **andere apps** tellen alleen mee als aantal: exchange, actie, uitkomst. Geen
fouttekst, geen vingerafdruk. Die gebruikers kennen onze privacyverklaring niet, en het dagrapport
heeft van hen alleen nodig hoe druk ze de Worker maken.

**Nooit** sleutels, secrets, passphrases, bedragen, trades of IP-adressen — de test controleert dat.
De vingerafdruk is een HMAC van de API-sleutel met een geheim dat alleen in de Worker staat: niet
terug te rekenen, en zonder dat geheim niet na te maken. Analytics Engine bewaart alles drie maanden.

Dit staat zo op de privacypagina (vanaf v1.3.4). **Zet de monitoring pas aan als v1.3.4 live is**,
zodat de pagina al klopt op het moment dat er geteld wordt.

## Stappen

### 1. De code

In `worker.js`:

1. Hernoem bovenin `export default {` naar `const proxy = {`. Verder niets aan dat blok veranderen.
2. Plak de hele inhoud van [worker-monitoring.js](worker-monitoring.js) onderaan het bestand.

De nieuwe `export default` roept jouw bestaande handler aan (`proxy.fetch`) en telt daarna. Het
antwoord aan de app verandert niet. Hij gebruikt de bestaande `json()`-helper uit de Worker.

### 2. De binding

**Met wrangler** (`wrangler.jsonc`):

```jsonc
"analytics_engine_datasets": [
  { "binding": "SJ_METRICS", "dataset": "sj_proxy" }
]
```

of in `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "SJ_METRICS"
dataset = "sj_proxy"
```

**In het dashboard**: Workers & Pages → `morani-proxy` → Settings → Bindings → Add binding →
*Analytics Engine*, naam `SJ_METRICS`, dataset `sj_proxy`.

De dataset maakt Cloudflare zelf aan bij de eerste telling.

### 3. Het geheim voor de vingerafdruk

Een willekeurige lange tekst, bijvoorbeeld uit `openssl rand -hex 32`:

```bash
npx wrangler secret put SJ_KOPPEL_ZOUT
```

of in het dashboard: Settings → Variables and Secrets → Add → type *Secret*, naam `SJ_KOPPEL_ZOUT`.

**Verander hem daarna niet**: met een nieuw geheim krijgt elke koppeling een nieuwe vingerafdruk,
en telt het rapport "dagen op rij" opnieuw vanaf nul. Kwijt? Dan is dat het enige gevolg.

### 4. Deployen

Zoals je de Worker altijd deployt. De volgorde van stap 1 t/m 3 maakt niet uit: zonder binding telt
de Worker niets, zonder geheim blijft de vingerafdruk leeg — de sync werkt in alle gevallen door.

## Het dagrapport en Morani's account

Het dagrapport leest de Worker-cijfers en de tellingen uit Morani's account. Vul in `dagrapport.env`
op de NUC `CF_ACCOUNT_ID_WORKER` (Morani's account-ID) en `CF_API_TOKEN_WORKER` in: een token met
*Account Analytics: Read* op dat account. Ben je lid van Morani's account, dan kun je ook één token
maken dat bij allebei mag en `CF_API_TOKEN_WORKER` leeg laten.

## Controleren

Na een paar syncs, vanaf de NUC:

```bash
cd ~/sj-dagrapport && python3 dagrapport.py --controleer
```

Onder *Exchange-tellingen* horen rijen te staan. Of rechtstreeks:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql" \
  --header "Authorization: Bearer <TOKEN>" \
  --data "SELECT blob1 AS exchange, blob3 AS uitkomst, SUM(_sample_interval) AS n FROM sj_proxy WHERE timestamp > NOW() - INTERVAL '1' HOUR GROUP BY exchange, uitkomst"
```

## Web Analytics (bezoekers)

Los van de Worker, en in **jouw** account. Sinds v1.3.4 laden de pagina's het meetscript zelf, alleen
op `syncjournal.nl` (niet op de werkversie of lokaal): *Automatic setup* zette het er in twee weken
nooit in. In Web Analytics → Manage site staat de site daarom op *JS Snippet installation*. Het token
staat in de pagina's (`data-cf-beacon`); dat is niet geheim. De *site tag* voor het dagrapport staat
in de adresbalk als je de site opent onder Web Analytics (`siteTag~in=…`); dat is een andere waarde
dan het token.
