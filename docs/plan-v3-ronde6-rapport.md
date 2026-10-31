# TradingPlan v3 — ronde 6, rapport (31-10-2026): het scenario-venster

Branch `plan-v3-ronde6`, gemaakt vanaf `release-v1.27` (de stand op work). Opdracht en logboek:
[plan-v3-ronde6-2026-10-31.md](plan-v3-ronde6-2026-10-31.md). Niets is gereleased: geen versienummer, geen CHANGELOG,
niets naar `site/` of de deploy-repo.

| Punt | Commit | Spec |
|---|---|---|
| 1. Afbeeldingen en links bij "Zet om in trade" | `7f28586` | `plan3-ronde6` deel 1 (11 checks) |
| 2. Scenario-venster breder en overzichtelijk | `904d0d9` | `plan3-ronde6` deel 2 (15 checks), `plan3-criteria` 19/19, `plan3-dag` 77/77 (aangepast) |
| 3. Grade en Long/Short in kleur | `51bb1f5` | `plan3-ronde6` deel 3 (12 checks) — samen 38/38, in de release-poort |

Alle plan3-specs, `theme-hook`, `faq` en `faq-volledig` groen. De release-poort staat hieronder.

## 1. Afbeeldingen en links bij "Zet om in trade"

Zaratras' vraag: "worden de afbeeldingen die je in het scenario plaatst overgenomen als ik klik op zet om in trade?"

**Antwoord voor v1.27: deels.**
- **Nieuwe trade invullen:** ja. Het formulier kreeg tot 8 afbeeldingen en de links.
- **Koppelen aan een trade die al een screenshot had:** nee. De plan-afbeeldingen gingen verloren, en de links ook als
  de trade er al een had.

**Nu**:
- **Koppelen (beide routes) voegt toe.** Dat geldt voor "Koppel" in het plan en voor "Koppel aan scenario" in de
  journal (`planErbij`). Wat de trade heeft blijft vooraan; wat nieuw is komt erachter, zonder dubbele (zelfde
  inhoud), tot de grens van het tradeformulier: 8 afbeeldingen en 8 links per trade.
- **Nooit iets kwijt.** Er wordt niets overschreven of weggehaald, en opnieuw koppelen voegt niets nog eens toe.
- **Het venster "Zet om in trade"** zegt in beide tabs wat er meegaat: "2 afbeeldingen en 1 link gaan mee naar de
  trade" of "Geen afbeeldingen in dit scenario."
- **De meldingen:**
  - in de journal: 'Gekoppeld aan scenario "…" · 2 afbeeldingen en 1 link meegenomen';
  - in het plan na Koppel, als voorspelling met dezelfde regel: "1 van 2 afbeeldingen en 1 link gaan mee, de trade zat
    vol."
- **FAQ:** "Hoe koppel ik een trade aan een scenario?" en "Kan ik screenshots en TradingView-links in mijn plan zetten?"
  zeggen het nu ook.

**Besluiten**

- Besluit: de grens is 8 per trade voor afbeeldingen én voor links, de bestaande grens van het tradeformulier
  (`addFormShot`, `addFormTvLink`, het label "max 8"), nu met een naam (`TRADE_MAX_BEELD`) in beide bestanden — geen
  nieuwe grens verzinnen, zoals gevraagd — als het fout is: een trade die via een import al meer dan 8 had, krijgt niets
  bij; er gaat niets weg.
- Besluit: "dubbel" = exact dezelfde data-URL (of hetzelfde adres bij links) — de journal bewaart de afbeelding precies
  zoals het plan hem in IndexedDB `tp3` heeft, dus opnieuw koppelen geeft dezelfde tekst; vergelijken op beeld zou een
  rekenpartij zijn voor geen winst — als het fout is: dezelfde chart die je los in het plan én in de journal plakte, staat
  er twee keer (twee keer verkleind is niet byte-gelijk).
- Besluit: de melding na Koppel komt uit het plan, als voorspelling ("gaan mee"); de journal voert het uit zodra zijn
  tabblad het plan bekijkt (`planSync`) en toont daar geen tweede melding — de journal kan op de achtergrond staan of
  dicht zijn; de trades (met screenshots) kent het plan al — als het fout is: verandert de trade tussen koppelen en het
  openen van de journal, dan klopt de voorspelde telling niet precies; er gaat niets weg.
- Besluit: bij meer dan één trade tegelijk zegt de melding "Afbeeldingen en links gaan mee naar de trades" en, als het
  zo is, bij hoeveel trades niet alles paste, in plaats van per trade een telling — een melding van vier regels leest
  niemand — als het fout is: per trade zie je het pas in de journal.

## 2. Scenario-venster breder en overzichtelijk

"Als ik een nieuw scenario toevoeg mag het scherm breder. Het is weinig overzichtelijk met de tekst; criteria is tekst
achter elkaar."

- **Desktop (≥ 1024 px):** het venster is 1000 px breed, met twee kolommen.
  - **Links het formulier:** Titel, Playbook, Pair + Richting, Grade, Trigger, Ongeldig als, Stop + TP's, Notitie.
  - **Rechts, sticky onder de kop van het venster:**
    - Criteria als lijst, één per regel, met "verplicht" als badge rechts. Dezelfde `critLijst` als in het
      opengeklapte scenario, hier alleen-lezen.
    - "Niet als" als eigen blok, elke regel apart in amber.
    - Target en Min. R:R als twee kengetallen, met de stop-regel van het playbook eronder.
    - Lagen met het entry-tijdframe.
    - "Edge van deze combinatie".
- **Zonder playbook:** rechts "Kies een playbook om de criteria te zien", met eronder Lagen en Edge.
- **Eén venster:** hetzelfde voor Nieuw scenario en Scenario bewerken. Annuleer en Bewaar blijven onderaan in beeld,
  ook met 8 criteria en een lang criterium (de spec klikt erop, ook helemaal gescrold).
- **Onder 1024 px:** één kolom van 640 px.
- **Telefoon (390 px):** schermvullend van onderen, met playbook en context onder het formulier.

**Besluiten**

- Besluit: in het venster is de criteria-lijst alleen-lezen (een stip in plaats van een vinkvakje) — afvinken hoort bij
  het opengeklapte scenario op de dag zelf; een vakje in het formulier dat je wel kunt zien maar niet hoort te gebruiken
  is verwarrend — als het fout is: wie al in het formulier wil afvinken, doet dat na Bewaar in het scenario.
- Besluit: de stop-regel van het playbook ("Stop volgens het playbook: Onder de sweep") staat als kleine regel onder de
  twee kengetallen, niet als derde kengetal — de opdracht noemt alleen Target en Min. R:R als kengetallen, en de stop is
  tekst, geen getal — als het fout is: alleen opmaak.
- Besluit: in het blok "Niet als" staat elke regel zonder het voorvoegsel "Niet als:" (`antiH(p, kort)`); in het
  opengeklapte scenario blijft het voorvoegsel — de kop zegt het al — als het fout is: alleen tekst.
- Besluit: zonder playbook blijven rechts Lagen en Edge staan, met de lege staat bovenaan — het entry-tijdframe kies je
  ook zonder playbook — als het fout is: geen.
- Besluit: tussen telefoon en 1024 px één kolom op 640 px breed — twee kolommen van ± 360 px lezen slechter dan één
  — als het fout is: op een liggende tablet scrol je iets meer.
- Besluit: de compacte voorvertoning van ronde 3 (punt 8: "mag zichtbaar blijven, maar compact") is vervangen — Zaratras
  vindt de criteria "tekst achter elkaar" juist onoverzichtelijk, en rechts naast het formulier is er nu ruimte — als het
  fout is: het venster is hoger met lange criteria; de knoppen blijven onderaan in beeld (de spec bewaakt dat).

## 3. Grade en Long/Short in kleur

"De grade en long/short zijn geen gekleurde blokken zoals de rest van de pagina's."

- **Gekozen knop:** in de kleur van `.dir`/`.grade`, op de soft-achtergrond met een dunne rand: Long groen, Short rood,
  A groen, B accent, C amber.
- **Niet gekozen:** rustig grijs; bij hover een vleugje van de eigen kleur.
- **Toegankelijk:** `aria-pressed` op elke knop. Het contrast is in de spec gemeten: ≥ 4,5 in licht én donker.
- **Alleen tokens**, geen vaste hex-waarden.
- **Elders:** de rest van het plan heeft geen grijze richting- of grade-keuze. Het Log-filter op richting was al
  gekleurd, en het tandwiel heeft alleen percentages per grade.

**Besluiten**

- Besluit: de tekstkleur is de kleur gemengd met `--ink` (65/35) in plaats van de pure kleur van de badges — groen,
  amber en rood op hun soft-achtergrond halen in het lichte thema geen 4,5 (± 3–3,5); mengen met `--ink` maakt de tekst
  in licht donkerder en in donker lichter, met één regel — als het fout is: de knoppen zijn iets donkerder dan de
  `.dir`/`.grade`-badges op de rest van de pagina.
- Besluit: alleen tokens (`--green`, `--green-soft` … en `color-mix`), geen hex; `--kc`/`--ks` per knop — de
  theme-token-hook bewaakt dat — als het fout is: geen.

## Release-poort

`node tests/run-release.js --hier` (werkmap): **175/178 groen** in 5,8 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten wisselkoersen bij `api.frankfurter.dev` (`FX_URL` in `work/syncjournal.html`); vanuit de container is die host niet bereikbaar (`curl` geeft `000`). In ronde 3 t/m 5 precies zo rood; deze ronde raakt die pagina's niet. |

- Wisselvallig, tweede poging groen: `terugkijken-v12` en `privacy-mode`. Deze ronde raakt geen van beide.
- Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: 8 specs geheel of deels.

## Wat niet getest kon worden

- **Safari en echte telefoons**: alleen Chromium (1280, 390). `color-mix()` vraagt Safari 16.2 of nieuwer.
- **De journal op de achtergrond bij Koppel in het plan**: de spec opent de journal opnieuw (dan draait `planSync`). Het
  echte moment waarop een al open journal-tabblad overneemt (zichtbaar worden of het storage-signaal) toetst
  `plan3-koppeling`.
- **Een trade die via een import al meer dan 8 afbeeldingen heeft**: niet gezaaid. De regel geeft dan 0 erbij en haalt
  niets weg.

## Screenshots

`docs/plan-v3-ronde6-screenshots/`, licht en donker:
- `voor-venster-*` / `na-venster-*` op 1280 en 390, in drie varianten:
  - `leeg`: nieuw scenario zonder playbook;
  - `playbook`: met een playbook met 8 criteria, één ervan lang;
  - `bewerken`: een bestaand scenario bewerken.
- `na-zetom-*`: het venster "Zet om in trade" met de regel over wat er meegaat.

## Concept-CHANGELOG

```markdown
### Gewijzigd
- **Een scenario maken of bewerken is overzichtelijker.** Het venster is op een groot scherm twee keer zo breed: links
  vul je het scenario in, rechts zie je je playbook. De criteria staan onder elkaar met "verplicht" erbij, "Niet als" per
  regel, target en min. R:R als kengetallen, en de lagen en de edge van deze combinatie.
- **Richting en grade in kleur** in het scenario-venster: Long groen, Short rood, A groen, B blauw, C amber, net als
  op de rest van de pagina's.

### Fixed
- **Afbeeldingen en links van een scenario gaan mee als je een trade koppelt.** Had de trade al een screenshot, dan
  gingen de afbeeldingen uit je plan verloren. Nu komen ze erbij (tot 8 per trade); wat de trade al had blijft staan. In
  "Zet om in trade" staat hoeveel er meegaat.
```
