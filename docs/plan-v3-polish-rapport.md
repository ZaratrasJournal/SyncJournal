# TradingPlan v3 — tweede ronde, rapport (27-10-2026)

Branch `plan-v3-polish` (vanaf de v1.19-release). De zes punten uit
[de opdracht](plan-v3-polish-2026-10-27.md) zijn af, elk met een eigen commit en een regel in het logboek onderaan dat
bestand. Niets is gereleased: geen versienummer, geen CHANGELOG, niets naar `site/`.

## Per punt

1. **Tag-pills in de journal-kleuren.** `.chip` is de pill van de journal (`.tagchip.col`): 12% achtergrond, 30% rand,
   een stip. Setup accent, confirmation teal, tijdframe violet, eigen labels muted (`tagKleur`, zelfde regel als
   `TAG_CATS`). Eigen = vol; geërfd = zelfde kleur, geen vulling, stippelrand, gedimd; uitgezet = grijs en doorgestreept.
   Bias-knoppen in groen/rood/muted, gekozen = gevuld. Ook de "zonder …"-uitleg bij de edge, de tag- en
   tijdframe-keuze en de Log-filters (nu pills). Tokens `--violet`, `--teal`, `--pink` letterlijk uit de journal.
2. **Kleurrijker.** Scenario-kaart met een linkerrand naar status; de trechter met een eigen kleur per stap; tabs met
   een eigen kleur (stip + onderstreping); KPI's en binnen/buiten plan op hun `-soft`-achtergrond; de voorspel-score op
   accent-soft; mentaal-knoppen naar de score; kleurstippen bij de week-kaarten. Alles via tokens.
3. **Week en dag zonder dubbele rijen.** Een nieuwe dag krijgt de lagen van de stijl min de tijdframes van het
   weekplan. Eén rij per tijdframe: week-chips gedimd, de dag-tags erachter, "+ tag" op dezelfde rij. Een lege dag-laag
   op een week-tijdframe verdwijnt bij het laden. Het scenario toont ook één rij per tijdframe, met de entry-laag in
   zijn eigen rij. De edge is niet veranderd.
4. **Rustiger koppelvenster.** Kop in één regel, tabs "Uit je journal" / "Nieuwe trade invullen", twee filter-pills,
   trades als rijen die je aantikt (vinkje, accent-rand), "bij <titel>" voor een bezette trade, één grijze regel in
   plaats van de uitleg, "Koppel n trade(s)" (uit bij 0) en de tekstlink "Nog niet binnen? Markeer als genomen". Op de
   telefoon een paneel van onderen met de knoppen vast onderaan. Zelfde venster vanuit Dag, Afsluiting en Log.
5. **Eén lettertype.** Geen IBM Plex Mono en geen `--fn` meer; alles Inter (koppen Plus Jakarta Sans) met
   `tabular-nums`. Vier groottes als tokens (12 / 13,5 / 15 / 19) en één stijl voor labels in hoofdletters.
6. **Playbook-criteria.** Bij het kiezen van een playbook staan de criteria er meteen onder (verplicht gemarkeerd),
   "Niet als: …" in amber en stop / target / min. R:R op één regel. Opengeklapt een afvinklijst
   (`Scenario.critChecked`); "Klaar om te nemen" vraagt ook alle verplichte criteria. Vinkjes van criteria die in de
   journal niet meer bestaan vallen weg. Zonder criteria een korte regel met een link naar het playbook
   (`?page=playbook&pb=…`, nieuw in de journal).

## Besluiten (uit het logboek)

- Log-filters zijn pills geworden in plaats van keuzelijsten (playbook in de setup-kleur).
- Het tijdframe-label van een laag is een violet pill.
- Een geërfde chip houdt "↑" maar verliest de stip.
- Tekst op een gevulde bias-knop is `--surface` (wit op het lichte groen van het donkere thema was slecht leesbaar).
- Mentaal-knoppen gekleurd naar de score (1–2 rood, 3 amber, 4–5 groen).
- Staptitels in de trechter blijven grijs, alleen de stip kleurt (contrast).
- Op 390 breed staan de Log-filtergroepen onder elkaar.
- De trechterstap "Week" toont de week-lagen niet meer: die staan gedimd bij "Vandaag" (anders stond 4H er alsnog
  twee keer). De stap houdt no-trade, de context-zin en een link naar het weekplan.
- De week-bias staat gestippeld in de bias-knoppen van de dag; tikken zet hem voor de dag vast.
- Opengeklapt scenario: de entry-rij toont setups en bias; de confirmations staan in de afvinklijst.
- De koppelknop heet bij 0 gekozen "Koppel trade" (uitgeschakeld); alles ontkoppelen gaat via het × in het scenario.
- De geen-kandidaten-regel noemt wat ontbreekt en de volgende stap; "later koppelen" is de tekstlink.
- Formulierlabels zijn ook hoofdletter-labels (één stijl). De edge-tabel heeft korte rijnamen met de uitleg als
  tooltip. De statusknoppen staan op 390 breed in drie kolommen.
- Een scenario zonder confirmations maar met verplichte criteria kan klaar zijn zodra die af zijn. De voortgangsbalk
  blijft voor de confirmations; criteria hebben een eigen teller. Een ander playbook kiezen wist ook de criteria-vinkjes.

## Screenshots

Voor (v1.19, uit de bouw-doorloop, zelfde code als de release) en na (deze branch, `node tests/plan3-doorloop.spec.js
--uit=<map>`), Dag, Week, Afsluiting, Log en het koppelvenster, licht en donker, 1280 en 390:

- [voor/](plan-v3-polish-screenshots/voor/) — bv. `dag-licht-1280.jpg`, `log-donker-390.jpg`
- [na/](plan-v3-polish-screenshots/na/) — dezelfde namen; plus `criteria-*.png` (punt 6) en
  `lagen-week-dag-licht-1280.png` (punt 3: week Daily · 4H, dag 1H, één rij per tijdframe)

De tests blokkeren alles buiten localhost, dus ook Google Fonts: op de screenshots staat het systeemlettertype van de
container, niet Inter. Afstanden en groottes kloppen; de letters zelf zien er online anders (beter) uit.

## Tests

- Alle plan3-specs groen: `plan3-basis` 24, `plan3-lagen` 46, `plan3-edge` 29, `plan3-dag` 77, `plan3-media` 35,
  `plan3-koppeling` 45, `plan3-afsluiting` 32, `plan3-journal` 22, `plan3-doorloop` 20.
- Nieuw per punt: kleuren (computed styles tegen de tokens, licht en donker), statusrand, trechter- en tabkleuren,
  `-soft`-blokken, de week/dag-test uit de opdracht, het koppelvenster (kop, tabs, pills, rij aantikken, knoppen,
  paneel van onderen op 390), lettertype en typeschaal per scherm, en de criteria (tonen, afvinken, klaar, playbook
  gewijzigd, zonder criteria, oud formaat).
- `plan3-doorloop` heeft een optie `--uit=<map>` voor de screenshots gekregen.
- Release-poort: zie hieronder.

## Release-poort

`node tests/run-release.js --hier` op de laatste commit:
**`═══ SyncJournal-suite (release-poort): 164/167 specs groen · 5.4 min ═══`** — gefaald: `analytics-metrics`, `matrix`,
`tendencies`. Alle drie alleen op "boot zonder fout" en "geen JS-errors", met als enige fout
`net::ERR_TUNNEL_CONNECTION_FAILED`: de journal haalt bij het starten de wisselkoers op bij `api.frankfurter.dev`
(`FX_URL` in `work/syncjournal.html`), en dat adres is vanuit deze container niet bereikbaar (`curl` → geen verbinding
via de proxy). Bewijs dat het niet aan deze branch ligt: dezelfde drie specs op de onaangeraakte v1.19-commit
(`e78f755`, losse worktree) falen op precies dezelfde twee checks (matrix, analytics-metrics, tendencies 13/15), en in de
vorige ronde (bouwrapport) stonden ze hier ook zo rood. Geen van de drie raakt het plan. Op een machine met internet
horen ze groen te zijn; draai de poort lokaal om dat te bevestigen.

## Concept CHANGELOG-blok (het versienummer kiest Claude bij de release)

```markdown
## [vX.Y] — 2026-10-xx

### Toegevoegd
- TradingPlan: bij een scenario staan de criteria van je playbook, met verplichte criteria als afvinklijst.
  "Klaar om te nemen" vraagt nu ook de verplichte criteria. Wanneer-niet staat erbij als waarschuwing.

### Gewijzigd
- TradingPlan: tags in dezelfde kleuren als in je journal (setup, confirmation, tijdframe), met duidelijk verschil
  tussen eigen, geërfde en uitgezette tags. Bias-knoppen in groen en rood.
- TradingPlan: meer kleur: scenario's met een kleurrand naar status, gekleurde stappen en tabs, KPI's in hun kleur.
- TradingPlan: wat je weekplan al heeft, staat niet nog eens leeg in je dagplan; één rij per tijdframe, de week-tags
  gedimd erin.
- TradingPlan: het venster om een trade te koppelen is rustiger: tik de trade(s) aan en koppel.
- TradingPlan: één lettertype, ook voor getallen.
```
