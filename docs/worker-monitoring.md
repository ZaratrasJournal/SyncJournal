# Worker v20 — monitoring voor het dagrapport

*Voor Denny. `morani-proxy` draait in **het Cloudflare-account van Morani**; je kunt erbij. Morani's
eigen journal gebruikt dezelfde Worker, dus laat hem weten wat er verandert (zie onder). De complete
code staat in [worker-v20.js](worker-v20.js) en is getest met `node tests/worker-monitoring.spec.js`,
met de echte handlers en een nagemaakt internet.*

---

## Wat er verandert

**Voor de apps niets.** De handler van v19 staat er byte voor byte in, alleen heet hij nu `proxy`. Een
nieuwe `export default` onderaan roept hem aan en telt daarna het verzoek. De test controleert dat
SyncJournal, Morani's journal en de oude journal precies hetzelfde antwoord krijgen als van v19.

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

- **Andere apps** tellen alleen als aantal: exchange, actie, uitkomst. Geen fouttekst, geen
  vingerafdruk — die gebruikers kennen de privacyverklaring van SyncJournal niet.
- **Nooit** sleutels, secrets, passphrases, bedragen, trades of IP-adressen. De vingerafdruk is een
  HMAC van de API-sleutel met een geheim dat alleen in de Worker staat: niet terug te rekenen.
- Analytics Engine bewaart alles **drie maanden** en ruimt daarna zelf op.
- **OKX en Kraken** geven sommige fouten terug met status 200 (OKX `trades`/`fills` in `_okxDebug`,
  Kraken `trades` als `position_updates_error`). v20 herkent die, anders telde een IP-whitelist bij
  het ophalen van trades als "gelukt". Bij OKX telt het als fout als FUTURES én SWAP allebei mislukten.

## Stappen

**Eerst v1.3.4 live** (de privacypagina die dit beschrijft), dan pas deze stappen.

1. **Code** — Workers & Pages → `morani-proxy` → *Edit code*: vervang de hele code door
   [worker-v20.js](worker-v20.js).
2. **Binding** — Settings → Bindings → Add binding → *Analytics Engine*: naam `SJ_METRICS`,
   dataset `sj_proxy`. De dataset maakt Cloudflare zelf aan bij de eerste telling.
3. **Geheim** — Settings → Variables and Secrets → Add → type *Secret*: naam `SJ_KOPPEL_ZOUT`,
   waarde een lange willekeurige tekst (bijvoorbeeld uit `openssl rand -hex 32`). **Verander hem
   daarna niet**: met een nieuw geheim krijgt elke koppeling een nieuwe vingerafdruk en begint "dagen
   op rij" opnieuw. Kwijt? Dan is dat het enige gevolg.
4. **Deploy.**

De volgorde van 1 t/m 3 maakt niet uit: zonder `SJ_METRICS` telt de Worker niets, zonder het geheim
blijft de vingerafdruk leeg. De sync werkt in alle gevallen door.

Met wrangler in plaats van het dashboard:

```jsonc
"analytics_engine_datasets": [ { "binding": "SJ_METRICS", "dataset": "sj_proxy" } ]
```
```bash
npx wrangler secret put SJ_KOPPEL_ZOUT
```

## Workers Logs: uitzetten

Op 30-09-2026 stond bij `morani-proxy` *Observability → Workers Logs: Enabled*. Dat bewaart per
verzoek een logregel met gegevens over het verzoek en het antwoord (Free: drie dagen). Welke velden
precies, zegt Cloudflare niet; de headers van een verzoek bevatten in elk geval het IP-adres. Dat past
niet bij de privacypagina ("geen IP-adres"), en het dagrapport heeft het niet nodig: de telling hierboven
doet dat werk. **Zet Workers Logs uit** (Settings → Observability), en alleen tijdelijk aan als je iets
moet debuggen. Met wrangler: `"observability": { "logs": { "invocation_logs": false } }`.

## Voor Morani

> De Worker telt vanaf nu per verzoek: exchange, actie, gelukt of welke soort fout. Voor jouw journal
> alleen dat — geen foutteksten, geen sleutels, geen IP-adressen. De antwoorden aan je journal
> veranderen niet. De tellingen staan in jouw Cloudflare-account (Analytics Engine, dataset
> `sj_proxy`) en verdwijnen na drie maanden vanzelf.

## De snelheidslimiet (staat nog uit)

v20 bevat de limiet per IP uit [worker-hardening-2026-09-27.md](worker-hardening-2026-09-27.md),
maar **uitgeschakeld**: hij doet pas iets met de binding `LIMIET`. Hij geldt voor iedereen op de
Worker, dus ook voor Morani's journal en de oude journal — en of die een 429 netjes opvangen zoals
SyncJournal, weten we niet.

**Eerst meten.** Het dagrapport toont per dag de *drukste minuut* (alle apps samen). Kies de limiet
pas na een week, ruim boven die piek (bijvoorbeeld het dubbele): de limiet telt per IP, en de piek
van alle apps samen is altijd hoger dan die van één IP. Zet hem dan aan met wrangler — in het
dashboard staat *Rate limiting* meestal niet tussen de bindings:

```jsonc
"ratelimits": [ { "name": "LIMIET", "namespace_id": "1001", "simple": { "limit": 60, "period": 60 } } ]
```

`period` mag alleen 10 of 60 zijn. Vereist wrangler 4.36 of nieuwer. Hoe vaak hij daarna ingrijpt,
zie je in het dagrapport als `rate-limit`.

## Het dagrapport en Morani's account

Het dagrapport leest de Worker-cijfers en de tellingen uit Morani's account. Vul in `dagrapport.env`
op de NUC `CF_ACCOUNT_ID_WORKER` in (Morani's account-ID). Ben je lid van zijn account, dan kan één
API-token met *Account Analytics: Read* op beide accounts; laat `CF_API_TOKEN_WORKER` dan leeg.

## Controleren

Na een paar syncs, vanaf de NUC:

```bash
sudo python3 /opt/sj-dagrapport/dagrapport.py controleer
```

Onder *Exchange-tellingen* horen rijen te staan. Of rechtstreeks:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID_MORANI>/analytics_engine/sql" \
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
