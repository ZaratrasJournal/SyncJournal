# Release-kandidaat v1.18.5: FAQ bijgewerkt voor v1.18 t/m v1.18.4

Datum: 26-10-2026 · branch `release-v1.18.5` (vanaf `origin/main`, v1.18.4) · niet naar main, work, live of deploy.

## Commits

1. `FAQ: cover funded test phase, CSV+link dedupe, stop management, Discord, Review image view, raw data`
   (FAQ-teksten in `work/syncjournal.html` + `tests/faq.spec.js`)
2. `CSV popup: drop the stale "may be duplicated" note for a linked exchange`
   (één melding in de app + `tests/csv-account-keuze.spec.js`)
3. `Release v1.18.5: FAQ updated for v1.18` (APP_VERSION, `site/version.json`, CHANGELOG,
   `site/app.html`, `site/demo-dataset.json`)

## Nieuwe vragen (8)

| Onderwerp | Vraag |
|---|---|
| 🔄 Exchanges koppelen & sync | De funded modus is nog in testfase, waar let ik op? |
| 🔄 Exchanges koppelen & sync | Hoe zie ik hoe mijn stop liep en hoe mijn trade dichtging? |
| 🔄 Exchanges koppelen & sync | De stop van mijn exchange klopt niet, kan ik hem aanpassen? |
| 🔄 Exchanges koppelen & sync | Ik heb een CSV ingelezen én mijn exchange gekoppeld. Staan mijn trades nu dubbel? |
| 📊 Analytics begrijpen | Wat laat het paneel Stop-management en uitvoering zien? |
| ✅ Review & delen met je coach | Hoe zet ik mijn trades in Discord? |
| ✅ Review & delen met je coach | Hoe werkt 🖼 Beeld op de Review-pagina? |
| 🛠️ Weergave & problemen oplossen | Zaratras vraagt om ruwe gegevens, hoe stuur ik die? |

## Aangevulde vragen (9)

- **Ik handel een challenge bij een prop firm (FTMO, Breakout). Hoe houd ik die bij?**: + Funded account
  (al funded zonder challenge), de eenmalige vraag over FTMO-trades zonder account, verwijzing naar de testfase.
- **Telt het geld van mijn funded account mee in mijn balans?**: de Dashboard-kaart staat er alleen zolang
  Funded meetellen uit staat, en Uitbetaling toevoegen (ook op een gestopt account). Het stuk over uitzetten is
  verhuisd naar de testfase-vraag, zodat het niet dubbel staat.
- **Hoe importeer ik een CSV-bestand?**: waarschuwing bij een verkeerde exchange, de FTMO-export op een account.
  De zin "kan een trade … dubbel komen te staan" is weg (sprak v1.18.1 tegen).
- **Komt mijn stop-loss vanzelf binnen?**: label "van Kraken Futures … later naar break-even" in plaats van
  "verschoven", Zelf aanpassen, en dat de meeste CSV-exports geen stop-loss hebben (koppel of vul zelf in).
- **Waarom kan ik entry en exit niet aanpassen bij een gesyncte trade?**: een stop van de exchange pas je aan
  met Zelf aanpassen.
- **Kan ik mijn bedragen verbergen?**: de privacy-modus geldt ook voor het coach-pakket, Kopieer voor Discord en Mori.
- **Hoe deel ik trades met mijn coach of trading-buddy?**: de zin "In Beeld staan alleen trades met een
  screenshot" is weg (sprak v1.18.2 tegen). De Discord-uitleg staat nu in een eigen vraag.
- **Ziet mijn coach mijn bedragen?**: met de privacy-modus aan blijven bedragen altijd weg.
- **Wat krijgt Mori van mij te zien?**: met de privacy-modus aan gaan er geen bedragen mee.

Bestaande vragen die al klopten en bleven staan: "Mijn exchange staat er niet tussen" (dekt een onbekend
bestand), "Wat betekenen TP1, SL en Close ✋" (per stap; de nieuwe stopvraag gaat over de trade als geheel).

## Wat ik in de app controleerde

Elke knop en elk menu dat de FAQ noemt, staat zo in de code van `work/syncjournal.html`:

- Funded: tab **Instellingen → Funded**, schakelaar **Funded modus** met "Nog in testfase", waarschuwing
  "Testfase … maak eerst een back-up", **Funded meetellen**, **+ Challenge toevoegen**, **+ Funded account**,
  **Omzetten naar funded account**, **Uitbetaling toevoegen**, "verborgen, niet gewist", Dashboard-kaart alleen
  met meetellen uit (`fundedKaart`), Analytics-knoppen **Eigen / Funded / Alles** (`fundedGeldFilter`).
- CSV: pop-up "Bij welk account hoort dit bestand?", **+ Nieuw account**, waarschuwing bij een verkeerde exchange,
  melding bij een onbekend bestand, de importmelding "… stonden er al via je koppeling" en "Deze export bevat geen
  stop-loss" (`csvGeenStopRegel`). Samenvoegen via `csvOpgaanInApi` (Blofin, OKX, Hyperliquid); Kraken via zijn
  eigen opruiming.
- Stop: hint "(van Kraken Futures, later naar break-even)", **Zelf aanpassen**, "zelf aangepast · Kraken Futures:
  …", **Terug naar Kraken Futures** (`stopVeldHtml`); in het trade-detail **Stop later** en **Gesloten via** met
  de labels naar break-even / strakker / verder weg ⚠ / niet verzet en stop-loss / take-profit / met de hand /
  liquidatie; paneel en kopje **Stop-management en uitvoering** in Analytics, grens van 10 trades (`STOP_MIN_N`).
- Discord: **📋 Kopieer voor Discord**, **Kopieer 2 van 3**, **⬇ Alle beelden voor Discord**, regels Playbook /
  Setup / Confirmaties (`revDiscordTekst`), bedragen weg via `revHide()` (vinkje óf privacy-modus).
- Review → Beeld: per maand, nieuwste eerst, tegel "Geen afbeelding" met **+ Afbeelding toevoegen**, grote weergave
  met ‹ › / pijltjes, Esc sluit.
- Privacy: `aiHide()` (Mori) en `revHide()` (coach-pakket, Discord) kijken allebei naar de privacy-modus.
- Ruwe gegevens: `?dev=1` / `?dev=0`, **Instellingen → Data → 🩺 Hulp bij problemen**, per gekoppelde exchange
  **Ruwe gegevens downloaden**, tekst "geen sleutels, walletadres, accountnummer of saldo. Deel het alleen met
  Zaratras", "Weg na herladen".

### Gevonden tegenstrijdigheid in de app zelf

De CSV-pop-up zei bij een gekoppelde exchange nog: "Trades die ook via de koppeling binnenkomen, kunnen dubbel
komen te staan." Dat klopt sinds v1.18.1 niet meer. Nu: "… komen er niet dubbel in: de koppeling is leidend."
Staat als **Fixed** in de changelog van v1.18.5, naast de regel over de FAQ onder Gewijzigd.

## Tests

- `tests/faq.spec.js`: eerst rood (22 nieuwe checks faalden), daarna **84/84**. Nieuw: elke nieuwe vraag
  staat onder het juiste onderwerp met de kernwoorden; de aangevulde vragen; geen tegenspraak meer (Beeld,
  dubbel); de één-voor-één-uitleg van Discord staat op één plek; zoeken op funded, dubbel, stop, Discord, ruwe en
  Beeld; Instellingen → Data heeft "Hulp bij problemen", Instellingen → Funded heeft "Nog in testfase"; alle
  nieuwe vragen open op 390 px in licht en donker zonder horizontale scroll; geen JS-fouten.
- `tests/csv-account-keuze.spec.js`: eerst rood op de oude pop-uptekst, daarna **40/40**.
- `tests/lege-staten.spec.js` **134/134**, `tests/morani-links.spec.js` **16/16**.

## Release-poort (`node tests/run-release.js --hier`)

**158/162 groen.** In de cloud ontbrak `node_modules`: de runner zet NODE_PATH op die map. Opgelost met
`npm install` plus `npm install --no-save` van Playwright 1.63.0, dezelfde versie als de vooraf geïnstalleerde
Chromium. Er is niets aan de repo veranderd.

De 4 rode specs, en waarom:

- `matrix`, `analytics-metrics`, `tendencies`: alleen "boot zonder fout" / "geen JS-errors" door
  `ERR_TUNNEL_CONNECTION_FAILED` (cdn/fonts onbereikbaar in de cloud). Bekend.
- `kraken-accountlog-sync` (41/43): **ook rood op origin/main**. Oorzaak: tijdzone. De spec verwacht 19:12
  (Amsterdam), de container draait in UTC en geeft 17:12. Met `TZ=Europe/Amsterdam` is hij **43/43**. Niet
  door deze release; wel een spec die afhangt van de tijdzone van de machine.

Overgeslagen delen door ontbrekende fixtures (bekend): csv-import, hl-echt, hl-csv-echt en delen van de
levensloop-specs van OKX, Hyperliquid, Blofin, Kraken en de scenario's.

`ruwe-data` was bij een losse run één keer rood ("na herladen") en ook één keer op main, en daarna twee
keer 47/47. In de poort groen. Dat ziet eruit als een timing-flake in de spec.

## Wat er nog moet gebeuren (Denny)

Lezen en akkoord geven. Daarna samenvoegen naar `main`, `site/` naar de deploy-repo, en work en live. Dat
gebeurt alleen op jouw expliciete woord.
