# Meerdere accounts per exchange — ontwerp (grill-uitkomst)

**Datum**: 2026-06-09
**Status**: ontwerp afgerond via `/grill-me`. Nog geen code. Wacht op go voor implementatieplan/bouw.
**Aanleiding**: Denny wil meerdere accounts van dezelfde exchange (bv. 2 Hyperliquid-wallets).

## Probleem
Nu zijn er twee soorten "accounts":
- **Manual accounts** → `accounts[]` (lijst, ondersteunt al meerdere instances).
- **Exchange-configs** → `config.exchanges[type]` (gekeyed op exchange-**type** → max één per type).

`trade.source` is een string (exchange-type, manual-naam of `"manual"`); dispatch via `ExchangeAPI[type]`. Er kan dus geen 2e Hyperliquid bestaan.

## Beslissingen (7)

1. **Unified datamodel** — exchange-accounts worden net als manual accounts first-class records in **één** `accounts[]`-lijst:
   ```
   { id, type:'hyperliquid'|'mexc'|'blofin'|'kraken'|'ftmo'|'manual',
     label, /* creds: */ walletAddress | apiKey/apiSecret/passphrase,
     transactions:[], syncFrom }
   ```
   `trade.source = account.id`. Dispatch via `ExchangeAPI[account.type]`. `config.exchanges` (keyed-by-type) verdwijnt na migratie.

2. **Opake stabiele `account.id`** (`'acc_'+uid()`), losgekoppeld van label → hernoemen + dubbele labels veilig.

3. **Auto one-time migratie** (zoals onze bestaande useEffect-migraties, self-terminating):
   - `config.exchanges[type]` → account-record met nieuwe id (creds/label/transactions/syncFrom mee).
   - bestaande manual accounts → `type:'manual'` (behoud hun bestaande `id`).
   - bouw `oude-source → nieuwe-id`-map; hermap **elke** `trade.source`.
   - generieke `source:"manual"` blijft een **gereserveerd literal** (= ✏️ Handmatig, geen account).
   - `tj_lastsync_<type>` → `tj_lastsync_<accountId>`.
   - **geen dataverlies; onbekende source → "manual" fallback.**

4. **Account-scoping in de adapter** — dispatcher geeft de account (id + creds) door aan `ExchangeAPI[type].fetchTrades/fetchOpenPositions`. De adapter:
   - stempelt `source = account.id`,
   - namespacet id's met account.id (bv. `acc_7fk2_open_BTC`).
   Zo geen collisions tussen 2 accounts van hetzelfde type (open-positie-id én matchKey). `detectPartials` + `getConsumedSiblings` filteren al op `source` → **automatisch per-account geïsoleerd**.

5. **UI: flat unified "Accounts"-lijst** + `+ Account toevoegen` → kies type → creds + **verplicht label** (auto-suggestie 'Hyperliquid 2' bij leeg). Overal getoond als `⧿ Hyperliquid · Main` / `· Degen`. Balans-breakdown per account-regel.

6. **Rollout Hyperliquid-first** — model + migratie bouwen we voor **alle** types; de `+ 2e account`-UI staat in v1 **alleen open voor Hyperliquid** (wallet-only = geen proxy, geen keys-in-browser, public → makkelijkst end-to-end te testen). v2: aanzetten voor MEXC/Blofin/Kraken.

7. **Filters/analytics: beide** — per-account chips (`Hyperliquid · Degen`) **én** type-aggregaat (`∑ alle Hyperliquid` = filter op `account.type`).

## Mechanische gevolgen (voor de implementatie)
- **Live balance**: `useLiveExchangeBalances`-hook + Dashboard `fetchBalances` + `computeTotalBalance` rekeyen van per-**type** naar per-**account.id** (fetch per account, één balance-regel per account).
- **Auto-sync + manual Refresh**: itereren over `accounts[]` (die creds hebben), per account `ExchangeAPI[type]`-call met die account-creds, `source=account.id`.
- **sourceOptions** (TradeForm): lijst `accounts[]` (icon + type · label) i.p.v. exchange-keys.
- **`resolveAccountLabel` / `getCapitalForSource`**: lookup op `account.id`.
- **AccountsHub**: grootste UI-herschrijving (van vaste exchange-lijst → unified account-CRUD).
- **~61 touch-points** die `config.exchanges`/`trade.source` aanraken moeten mee.

## Risico's / aandachtspunten
- **Migratie is kritisch** — bouw 'm met een snapshot van een echte journal-export + test dat élke trade z'n account houdt (geen orphans). Inclusief de FTMO-merge-masters (`mergedFrom`/`mergedInto`) en bestaande tpLevels.
- **Worker (v2, API-exchanges)**: meerdere API-keys per exchange — de Worker accepteert creds al per request, dus geen Worker-wijziging nodig; wel testen per key.
- **Per-exchange isolatie** (CLAUDE.md): adapters blijven per type; account-scoping is een uniforme param, geen cross-exchange logica.
- **Backwards-compat export/import**: backup-JSON moet het nieuwe `accounts[]`-model ronddragen; oude backups (met `config.exchanges` + source=type) moeten bij import door dezelfde migratie.

## Voorgestelde implementatie-fasering
1. **Schema + migratie** (geen UI) — unified `accounts[]`, auto-migratie, source-remap, source→id-map. Test met journal-export-fixture: 0 orphans, PnL/counts identiek vóór/na.
2. **Adapter-scoping** — account-param door alle `fetchTrades`/`fetchOpenPositions`; id-namespacing + source=account.id. Exchange-isolation-test uitbreiden.
3. **Sync-laag** — auto-sync + Refresh + live-balance + lastSync per account.
4. **UI** — flat Accounts-lijst + CRUD + verplicht label; sourceOptions; balans-breakdown.
5. **Filters/analytics** — per-account + type-aggregaat chips.
6. **HL-multi aanzetten** + multi-account-tests (2 HL-wallets: geen id-collision, balans per account, filter beide kanten).

**Effort (ruwe schatting)**: groot — meerdaagse refactor. Fase 1+2 zijn de fundering en het meeste risico; UI is het meeste werk.

**Wacht op groen licht van Denny voor het implementatieplan / Sprint 1.**
