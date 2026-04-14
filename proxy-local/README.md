# SyncJournal — lokale proxy

Tijdelijke vervanger voor de Cloudflare Worker totdat die werkt. Draait op je eigen machine.

## Eenmalig installeren

1. Installeer Node.js (LTS) als je dat nog niet hebt: https://nodejs.org
2. In een terminal:
   ```bash
   cd proxy-local
   npm install
   ```
   (duurt ~20 seconden, downloadt `ccxt` + `express`)

## Starten

```bash
node server.js
```

Je ziet:
```
SyncJournal proxy listening on http://localhost:8787
```

## Koppelen aan SyncJournal

1. Open `tradejournal.html` in de browser
2. Ga naar **Instellingen → Worker URL**
3. Plak: `http://localhost:8787`
4. Klik **Verbinding testen** op je exchange van keuze

## Ondersteund

- **Kraken** — futures (krakenfutures in CCXT). Spot kan via aanpassing in `CCXT_CLASS`.
- **Blofin** — perps.
- **MEXC** — alleen spot momenteel; futures-API voor retail is dicht tot 31 maart 2026.

## Stoppen

Ctrl+C in de terminal waar `node server.js` draait.

## Voor wie is dit?

Alleen jij en Sebas tijdens ontwikkelen. Community-members moeten wachten tot de Cloudflare Worker live is — die proxy draait voor iedereen tegelijk. Deze lokale proxy is niet geschikt voor publiek gebruik.

## Beveiliging

- Je API-keys blijven in RAM van dit lokale proces. Verlaten je machine niet — alleen naar de exchange zelf.
- Gebruik **read-only** API-keys (geen withdraw, geen trade permissies) uit de exchange.
- Rote de keys elke paar maanden.
