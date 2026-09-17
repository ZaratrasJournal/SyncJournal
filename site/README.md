# SyncJournal

**Een rustige, complete trading journal die je exchanges koppelt en van elke trade een les maakt.**
Gratis, zonder account — al je data blijft in je eigen browser.

🌐 **Live:** [syncjournal.nl](https://syncjournal.nl) · 🚧 Werkversie: [work.syncjournal.nl](https://work.syncjournal.nl)

Built by **Zaratras** · Powered by **Morani**

---

## Wat kan SyncJournal?

- **Exchange-sync** — koppel Blofin, OKX, Kraken Futures of Hyperliquid met read-only keys; trades, saldo en open posities komen automatisch binnen. CSV-import werkt voor elke exchange.
- **Dashboard & analytics** — balans, equity-curve, drawdown, R-verdeling, win-rate, profit factor, prestatie per uur/sessie/pair en een klikbare fout-analyse (radar).
- **Playbooks** — leg je setups vast met criteria en setup-lagen; koppel trades eraan en zie per playbook waar je edge zit.
- **Review & psychologie** — notities, screenshots, TradingView-links, emoties, fouten en sterren per trade; tendencies laten zien welke combinaties je geld kosten.
- **Weergave-presets** — kies Rustig, Standaard of Alles; elk onderdeel is ook los aan/uit te zetten.
- **Backups** — handmatige JSON-export, automatische map-backups of Google Drive-sync, met een app-brede waarschuwing zodra je backup te oud is.
- **Overzetten uit de oude TradeJournal** — importeer je oude backup en krijg eerst een controle-overzicht; trades, playbooks, tags én API-koppelingen gaan mee.

## Privacy

SyncJournal heeft **geen server en geen accounts**. Alles — trades, keys, screenshots — staat uitsluitend in de opslag van je eigen browser. Exchange-koppelingen gebruiken read-only API-keys die je browser nooit verlaten (behalve richting de exchange zelf). Zie [privacy.html](https://syncjournal.nl/privacy) voor de volledige verklaring.

**Maak daarom backups**: bij het wissen van je browserdata ben je anders alles kwijt. De app helpt je eraan herinneren.

## Snel starten

1. Open [syncjournal.nl](https://syncjournal.nl).
2. Kies een weergave (Rustig / Standaard / Alles) — of klik **Rondkijken met voorbeelddata** om de app direct gevuld te verkennen.
3. Koppel een exchange via **Instellingen → Accounts**, of voeg handmatig je eerste trade toe.
4. Kom je van de oude TradeJournal? **Instellingen → Data → Importeer oude backup.**

---

## Voor beheerders

Onderstaande secties gaan over hosting en releases van deze repo.

### Inhoud van deze repo

| Bestand | Doel |
|---|---|
| `index.html` | De volledige app (single-file HTML + vanilla JS; kopie van `work/syncjournal.html` op releasemoment) |
| `version.json` | Bron voor de in-app update-check (`{version, released}`) — **moet gelijk zijn aan `APP_VERSION` in index.html** |
| `demo-dataset.json` | Voorbeelddata (3000 trades) voor "Rondkijken met voorbeelddata" |
| `privacy.html` | Privacyverklaring (ook vereist voor de Google Drive-verificatie) |
| `_headers` | Cache-regels (`version.json` nooit cachen) |

De broncode wordt ontwikkeld in een aparte dev-repo met een Playwright-testsuite (29 specs, ~800 checks); `tests/hosted.spec.js` bewaakt daar o.a. dat `index.html` en `version.json` dezelfde versie dragen en dat de demo-dataset meegaat.

### Hosting: twee Cloudflare Pages-projecten op deze repo

| Omgeving | Branch | Domein | Doel |
|---|---|---|---|
| Productie | `main` | syncjournal.nl | Stabiel, voor leden |
| Werkversie | `work` | work.syncjournal.nl | Testen; eigen origin = eigen opslag, raakt live-data nooit |

De app toont op een `work.*`-hostname automatisch een 🚧 WERKVERSIE-badge. Aanrader in Cloudflare: een Transform Rule (hostname `work.syncjournal.nl` → response header `X-Robots-Tag: noindex`) zodat zoekmachines de werkversie negeren.

### Release-ritueel

1. `cp work/syncjournal.html site/index.html` (in de dev-repo)
2. Zet `version` + `released` in `version.json` gelijk aan de nieuwe `APP_VERSION`
3. Draai de volledige testsuite — alles groen vóór er iets vertrekt
4. Commit, en **alleen op expliciet "push"/"release"-commando van Denny** naar GitHub:
   - push naar `work` → work.syncjournal.nl (staging)
   - fast-forward `work` → `main` + push → syncjournal.nl (leden-release)
5. Cloudflare Pages deployt automatisch; leden zien binnen ±4 uur de update-banner, of direct via 🔄 Check in Instellingen → Updates.

### Eenmalige Cloudflare Pages-setup

1. Cloudflare-dashboard → **Workers & Pages → Create → Pages → Connect to Git** → kies deze repo.
2. Build settings: framework **None**, build command **leeg**, output directory **`site`**.
3. Na de eerste deploy: **Custom domains** → domein toevoegen (`www` → redirect naar apex via Bulk Redirect).
4. Herhaal als tweede project voor branch `work` → work.syncjournal.nl.

### Later

- **Tradingplan**: derde Pages-project met output directory `tradingplan`, custom domain `tradingplan.syncjournal.nl`.

---

*Vragen of feedback? Meld het in de community — elke bugmelding maakt de journal beter.*
