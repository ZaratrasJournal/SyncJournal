# OKX Perpetual Swaps — implementatie-onderzoek (2026-06-17)

> Status: **bouwklaar onderzoek**, OKX wordt binnenkort toegevoegd. Perps (USDT-margined SWAP).
> Auth-stijl = passphrase (zoals Blofin). Alles via Cloudflare Worker, keys nooit in browser.

## 1. Auth (OKX v5)
4 headers per private request:
- `OK-ACCESS-KEY` = API key
- `OK-ACCESS-SIGN` = Base64(HMAC-SHA256(preHash, secret))
- `OK-ACCESS-TIMESTAMP` = ISO8601 UTC ms, bv. `2024-03-15T09:08:57.715Z`
- `OK-ACCESS-PASSPHRASE` = door user gekozen passphrase

`preHash = timestamp + METHOD + requestPath + body`. Bij GET zit de querystring in `requestPath`, body = "". Klok-skew > 30s → error 50102.

User levert: **API key + secret + passphrase**, permission **Read** is genoeg. → `needsPassphrase:true`.

Demo/sandbox: header `x-simulated-trading: 1`.

## 2. Endpoints
| Doel | Endpoint | Belangrijk |
|---|---|---|
| Balance (`testConnection`) | `GET /api/v5/account/balance?ccy=USDT` | `details[0].eq` = equity. 10/2s |
| Open posities | `GET /api/v5/account/positions?instType=SWAP` | `avgPx`,`upl`,`lever`,`liqPx`,`pos`(contracts). 10/2s |
| **Gesloten posities (primair)** | `GET /api/v5/account/positions-history?instType=SWAP&limit=100` | 1 record/positie, geaggregeerd. 3 mnd terug. 20/2s. Cursor op `uTime` |
| Fills (TP-breakdown) | `GET /api/v5/trade/fills-history?instType=SWAP&instId=…` | 3 mnd; `fills-archive` per kwartaal (`year`,`quarter`). Cursor op `billId` |
| Funding | `GET /api/v5/account/bills?instType=SWAP&subType=173` | `balChg` negatief = kosten |
| Contract-size (publiek, geen auth) | `GET /api/v5/public/instruments?instType=SWAP` | `ctVal`,`ctMult`,`ctValCcy` |

## 3. positions-history → intern schema
| OKX | Intern | Noot |
|---|---|---|
| `instId` `BTC-USDT-SWAP` | symbol | `.replace(/-SWAP$/,"").replace("-","/")` → `BTC/USDT` |
| `posSide`/`direction` | side long/short | net-mode → `direction` fallback |
| `cTime`/`uTime` (ms-string) | open/closeTime | `new Date(parseInt(ts)).toISOString()` |
| `openAvgPx`/`closeAvgPx` | entry/exitPrice | |
| `closeTotalPos` × `ctVal` | size (base asset) | **contracts → asset, ctVal-lookup verplicht** |
| `lever` | leverage | |
| `realizedPnl` | pnl (BRUTO) | **netto = realizedPnl + fee + fundingFee** (fees zijn negatief) |
| `fee`+`fundingFee` | fees | `Math.abs(...)` |
| `posId` | positionId | stabiel; verandert NIET bij heropen |

## 4. Multi-TP / partial-close
`positions-history` = 1 geaggregeerd record per volledige cyclus (gewogen `closeAvgPx`, geen TP-breakdown). Voor TP-niveaus: `fills-history` per `posId`/`instId`+tijdvenster ophalen en clusteren — de **Worker bouwt tpLevels** (zoals bij Kraken). posId wordt hergebruikt bij heropen → tijdvenster-filtering via `cTime`/`uTime` essentieel voor dedup.

## 5. CSV-import (CSV-first)
Web UI → Order Center → Trading History → Download → **Position History** (per gesloten positie, beste). Max 3 mnd/export, vanaf dec-2022. Kolommen spiegelen API-velden (Engelse display-namen, bv. "Realized PnL"), timestamps waarschijnlijk ISO. **Exacte headers onbevestigd — sample van Denny nodig.** ctVal in browser: publieke instruments-endpoint (geen CORS-block) of hardcoded fallback-map (zoals MEXC).

## 6. Quirks
- `closeTotalPos`/`pos` in **contracts**, niet base — ctVal-lookup is de #1 valkuil.
- Fees negatief; `realizedPnl` is bruto (≠ MEXC waar al netto).
- net-mode: `posSide="net"`, richting via `direction`-veld; fallback PnL-heuristiek.
- Unified account: filter altijd op `instType=SWAP`.
- positions-history > 3 mnd: geen archive-equivalent (bekende beperking vs Blofin).
- Sub-accounts: main-key ziet alleen main-trades (latere uitbreiding).

## 7. Bouwvolgorde
1. **CSV-parser** (laag, 2-3u) — wacht op sample; ctVal fallback-map.
2. **Adapter-stub + UI-registratie** (laag, 1u).
3. **Worker-actions** test/trades/open_positions (gemiddeld, 3-4u) — HMAC server-side.
4. **Fills + tpLevels in Worker** (hoog, 4-6u).
5. **Funding fees** (gemiddeld, 2-3u).

## 8. Registratieplekken in `work/tradejournal.html`
- Adapter-object `ExchangeAPI.okx` na ftmo-blok (~r3954).
- `detectPartials`-registratie na ~r4017: `ExchangeAPI.okx.detectPartials=(t,k)=>detectPartialFromSiblings(t,k||"okx","okx")`.
- captureSnapshot na ~r3994.
- ACCT_TYPES ~r14448: `["okx","OKX — API key + passphrase"]`.
- Account-UI ~r15691: voeg `"okx"` toe aan `["mexc","blofin","kraken"]`; passphrase-input ~r15694 `t==="blofin"` → `(t==="blofin"||t==="okx")`.
- ExchangeIcon ~r4110: favicon okx.com.
> Regelnummers indicatief — verifiëren bij implementatie.

## 9. Open vragen — alleen met echte credentials (snapshot-fixture)
1. `type`-enum in positions-history (full vs partial close).
2. Betrouwbaarheid `direction` in net-mode.
3. `closeTotalPos` altijd contracts? (PnL cross-check inbouwen, à la Blofin).
4. Portfolio-margin mode → andere endpoints (positions-history pas sinds nov-2024).
5. Geeft fills-history consistent `posId`? (cruciaal voor partial-reconstructie).
6. Exacte CSV-kolomnamen Position History.
7. Funding subType 173 universeel?
8. Sub-account-gebruikers in community?

Bronnen: okx.com/docs-v5, changelog, help-artikelen contract-size + history-download.
