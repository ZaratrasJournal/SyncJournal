# Worker deploy instructies

## Wat is het
[proxy.js](proxy.js) is de nieuwe versie van `morani-proxy.moranitraden.workers.dev`. Bevat dezelfde handlers als de lokale proxy (`proxy-local/server.js`) maar aangepast voor Cloudflare's runtime (WebCrypto ipv Node's crypto, fetch ipv Express).

## Deploy via Cloudflare dashboard (makkelijkst)

1. https://dash.cloudflare.com → Workers & Pages → `morani-proxy`
2. Klik **Edit code** (of Quick edit)
3. Vervang de volledige inhoud door [proxy.js](proxy.js)
4. Klik **Save and deploy**
5. In SyncJournal → Instellingen → Worker URL: laat staan op `https://morani-proxy.moranitraden.workers.dev`

## Deploy via wrangler CLI (voor later)

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler deploy proxy.js --name morani-proxy
```

## Test na deploy

1. Open SyncJournal
2. Kraken → Verbinding testen → moet groene toast geven
3. MEXC → Trades importeren → moet positions history binnenhalen
4. Blofin → Trades importeren → moet positions-history binnenhalen

## Rollback

Als er iets stuk gaat: in Cloudflare dashboard → Workers → morani-proxy → **Deployments** tab → kies oudere versie → "Rollback to this version".

## Key verschillen tov v3

- **MEXC trades** — gebruikt nu `position/list/history_positions` (positie-level) i.p.v. `order/history/new` (order-level). Geeft direct entry+exit+pnl per positie.
- **Blofin trades** — gebruikt nu `account/positions-history` i.p.v. `trade/orders-history`. Geeft geaggregeerde posities.
- **Kraken trades** — gebruikt nu `history/account-log` met paginatie (max 20k entries) + **server-side positie-lifecycle tracking**. Elke positie wordt 1 trade met tpLevels[] voor TP-fills. Matcht exact met de lokale proxy.
- **Nieuwe action `fills`** — voor de "🎯 TP's ophalen" knop per trade. Werkt voor alle 3 exchanges.
- **Signing unchanged** — MEXC/Blofin/Kraken signing algoritmes zijn identiek aan v3.
