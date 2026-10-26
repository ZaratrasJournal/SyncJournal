# Review-pagina — rapport (26-10-2026)

Branch `review-pagina`, vanaf `origin/release-v1.18.1`. Drie wensen van Zaratras, elk een eigen commit.
Geen versie opgehoogd, geen release; de nieuwe specs staan (nog) níet in `tests/release-set.js`.
Changelog: drie regels onder `## [Unreleased]` in `CHANGELOG.md`.

## 1. Nieuwste trade bovenaan — commit `9393927`

**Veranderd** (`work/syncjournal.html`)
- Nieuw: `revMoment(t)` en `revOrder(list)` — één volgorde voor de hele Review-pagina: sluitmoment
  (`closeTime`); een open of deels gesloten trade (of een zonder sluitmoment) op `openTime`; zonder
  tijdstempels op `date` + `time`. Gelijke momenten: hoogste id eerst, zodat de lijst niet springt.
- `reviewItems()` sorteert met `revOrder` → de lijst bij *Per trade*, `revNav` (‹ › en pijltjes) en de teller.
- `revPerTrade()`: zonder gekozen trade opent de nieuwste (was: de eerste in opslagvolgorde).
- `revMonths()` sorteert met `revOrder` vóór het groeperen → kaarten in *Beeld*, *Presenteer maand*,
  *+ Hele maand* en de nieuwe grote weergave (punt 3) volgen dezelfde volgorde.
- Trades, Dashboard en de opslag (`T`) zijn niet aangeraakt; `FT` wordt niet gesorteerd.

**Test** `tests/review-volgorde.spec.js` (5 trades: één open, één met vroege opening maar late sluiting,
één zonder tijdstempels, twee met precies hetzelfde moment). Eerst 2 ✓ / 9 ✗, na de fix **11 ✓ / 0 ✗**.
`tests/review-list.spec.js` ging uit van "trade 1 staat bovenaan"; die aanname is aangepast (`STATE.revSel = -1`).

## 2. Beeld: ook trades zonder afbeelding — commit `31ac1e4`

**Veranderd**
- `revMonths()` filtert niet meer op `revHasBeeld` (die is weg); alle trades staan op hun plek.
- Nieuw `revGeenBeeld(t, kapot)`: tegel in hetzelfde vak (`.cardshot`, 16:10) met pair, richting, datum,
  R en P&L (`.mask`, dus privacy-modus vervaagt hem), "🖼 Geen afbeelding" en **+ Afbeelding toevoegen**
  (bestaande `pickScreenshot`). Een trade met alleen een TradingView-link houdt zijn bestaande tegel.
- Nieuw `revImgFout(img)`: een afbeelding die niet laadt krijgt `kapot`; dan verdwijnt het plaatje en
  verschijnt "Afbeelding niet te laden" (geen gebroken-plaatje-icoon). Ook in de grote weergave en de filmstrip.
- Lege staat `revbeeld` aangepast: verschijnt nu alleen als het filter (Te doen / Gereviewed) niets
  overlaat → "Geen trades in deze selectie".
- Alleen CSS-variabelen (`--ink2`, `--muted`, `--sink`, `--line`, …).

**Test** `tests/review-beeld-info.spec.js --deel=2`: eerst rood (2 i.p.v. 4 tegels), daarna **14 ✓ / 0 ✗**:
evenveel tegels als trades in de juiste volgorde, "Geen afbeelding"-tegel met pair/richting/datum/R/P&L,
kapotte link, gelijke tegelhoogte, alles zonder afbeelding, lege staat door filter, licht + donker, 390 px.
`tests/review-beeld.spec.js`: twee asserties beschreven het oude gedrag ("alleen trades met beeld",
"lege staat zonder beelden") en zijn bijgewerkt.

## 3. Beeld: klik toont de gegevens erbij — commit `76cb95e`

**Veranderd** — de bestaande presentatie-overlay (`openRevPres` / `drawRevPres`) is uitgebreid, geen nieuwe lightbox.
- Nieuw `revBeeldOpen(id)`: klik (of Enter/spatie) op een tegel opent de getoonde maand, in de volgorde van punt 1,
  op die trade, met paneel `'info'`. De tegel is nu een knop (`role="button"`, `tabindex`, `aria-label`).
- Nieuw `revBeeldInfo(t)`: pair, richting, datum/tijd/sessie, R, P&L, lagen, playbook, setup, confirmaties,
  entry/stop/exit, R:R gepland, alle TP's en de notitie, plus *Kopieer voor Discord*.
  Gebouwd uit dezelfde stukken als de Discord-export: `revTagRegels`, `revTpRegels`, `lagenTxt` en de nieuwe
  gedeelde `revPrijzen` / `revRrTxt`, die nu óók in `revDiscordTekst` en `revDiscordCanvas` gebruikt worden
  (de Discord-uitvoer is ongewijzigd; `discord-meerdere` en `review-beeld` blijven groen).
- `revPresGo`: in de info-weergave per **trade** (naar de eerste afbeelding van de volgende/vorige trade);
  *Presenteer* blijft per afbeelding.
- Sluiten: Escape, ✕ (`aria-label="sluiten"`) of klik op de achtergrond naast de afbeelding. Focus gaat bij
  openen naar de weergave (✕) en bij sluiten terug naar de tegel waarop geklikt is (`closeRevPres`).
- Trade zonder afbeelding: groot vak "Geen afbeelding" + *+ Afbeelding toevoegen*.
- Privacy-modus (`STATE.priv`): het bedrag staat niet in het paneel; R wel. Bewust níet `revHide()`: het vinkje
  "Bedragen verbergen" staat standaard aan en is bedoeld voor delen, niet voor je eigen scherm.
- Breed scherm: paneel rechts (420 px). Tot 1000 px: afbeelding boven (62vh), paneel eronder, scrollt.

**Test** `tests/review-beeld-info.spec.js --deel=3`: eerst rood, daarna **21 ✓ / 0 ✗**: klik opent; paneel met pair,
richting, P&L, R, dezelfde playbook/setup/confirmatie-regels als `revTagRegels`, entry/stop/exit, TP's, lagen,
notitie ge-escaped; focus in de weergave; → naar de volgende trade (ook zonder afbeelding), ← terug; Escape,
✕ en klik buiten sluiten; focus terug op de tegel; privacy-modus zonder bedrag; licht + donker; 390 px; geen JS-fouten.
`tests/review-beeld.spec.js`: "klik op kaartbeeld: alleen die trade, zonder paneel" → nu "de maand, op die trade, met gegevens".

## Gedraaide specs

| Spec | Uitkomst |
|---|---|
| review-volgorde (nieuw) | 11/11 |
| review-beeld-info (nieuw) | 34/34 (incl. 3000-trades-render in review-beeld) |
| review-beeld | 93/93 |
| review-list | 20/20 |
| discord-meerdere | 55/55 |
| privacy-mode | 30/30 |
| lege-staten | 134/134 |

## Release-poort (`node tests/run-release.js --hier`)

**156/160 groen** (5,2 min), `ruwe-data` groen bij de tweede poging.
- `analytics-metrics`, `matrix`, `tendencies`: alleen "boot zonder fout / geen JS-errors" door
  `net::ERR_TUNNEL_CONNECTION_FAILED` (CDN/fonts in de cloud) — het bekende netwerk-rood.
- `kraken-accountlog-sync` 41/43 ("je short van 14-10 staat er als gesloten trade"): **ook rood op de basis
  `origin/release-v1.18.1`**, met precies dezelfde uitvoer, dus niet van deze branch. Vermoedelijk
  tijdzone-afhankelijk (de cloud draait in UTC). Graag lokaal nakijken.

Cloud-omgeving: `run-release.js` zet `NODE_PATH` op `./node_modules`, die hier ontbrak; de eerste ronde faalde daarom
op `MODULE_NOT_FOUND`. Opgelost met `npm install --no-save` (`@playwright/test@1.63.0`, gelijk aan de browser); `package.json` is niet gewijzigd.

## Met de hand bekijken (Zaratras)

1. **Volgorde**: Review → Per trade met je echte data: staat je laatst gesloten trade bovenaan, een lopende trade
   op zijn openingsmoment? Klopt dat voor elke exchange (Kraken/OKX/Blofin zetten `closeTime`, CSV/handmatig vaak alleen datum + tijd)?
2. **Beeld**: de "Geen afbeelding"-tegel tussen echte screenshots, in licht en donker. Is de tekst rustig genoeg?
   Werkt *+ Afbeelding toevoegen* (opent de bestandskiezer; na kiezen staat de afbeelding in de tegel)?
3. **Grote weergave**: klik een tegel, blader met ← →, sluit met Esc en klik-naast. Is de verdeling afbeelding/paneel
   goed op je eigen scherm? Op de telefoon: paneel onder de afbeelding, scrollen.
4. Een trade met meerdere screenshots: de pijltjes springen per trade; de andere screenshots kies je in de filmstrip.
5. Privacy-modus aan: geen bedrag in het paneel; in de onderbalk wordt het bedrag (zoals overal in de app) vervaagd.

Schermafdrukken van de tests (niet gecommit): `tests/screenshots/review-beeld-info/`.
