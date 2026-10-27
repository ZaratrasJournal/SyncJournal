# TradingPlan v3 — tweede ronde (27-10-2026)

Zaratras testte v1.19 op work.syncjournal.nl/plan: "ziet er een stuk beter uit". Deze zes punten zijn zijn
feedback, uitgewerkt tot vaste eisen. Ze gaan vóór het ontwerp
([plan-v3-ontwerp-2026-10-27.md](plan-v3-ontwerp-2026-10-27.md)) waar ze botsen. Bestanden:
`tradingplan/tradingplan.html` (het plan) en waar nodig `work/syncjournal.html`.

Werk per punt: eerst de test of de spec-uitbreiding (in de bestaande `tests/plan3-*.spec.js`), dan bouwen,
dan screenshots lezen in licht én donker, op 1280 en 390 breed. Commit en push na elk punt naar
`plan-v3-polish`. Houd onderaan dit bestand een logboek bij, zoals in het bouwplan
(`Besluit: <wat> — <waarom> — <wat het kost als het fout is>`).

## 1. Tag-pills in de kleuren van de journal

In de journal heeft elke tag-soort één kleur (`TAG_CATS` en `tagKleur()` in `work/syncjournal.html`):

| Soort | Token |
|---|---|
| setup (`setupTags`) | `--accent` |
| confirmation (`confirmationTags`) | `--teal` |
| timeframe (`timeframeTags`) | `--violet` |
| eigen labels (`customTags`) | `--muted` |

De pill-stijl is `.tagchip.col` (achtergrond 12% van de kleur, rand 30%, een stipje in de kleur vooraan).
- Neem die tokens met hun licht- en donkerwaarden letterlijk over uit de journal (`--violet`, `--teal`,
  `--pink` ontbreken nu in het plan), en dezelfde pill-stijl. **Elke chip in het plan** (lagen, geërfd,
  scenario, edge-uitleg "zonder …", Log-filters) gebruikt die kleur.
- Bias-knoppen: Bullish `--green`, Bearish `--red`, Neutraal `--muted`, gekozen = gevuld.
- **Geërfd** = dezelfde kleur, maar gedimd (lagere dekking, stippelrand). **Uitgezet** = doorgestreept en
  grijs. Het verschil tussen eigen, geërfd en uitgezet moet in één oogopslag te zien zijn.

## 2. Alle pagina's iets kleurrijker

Nu is alles grijs-op-wit met één blauwe accentkleur. Maak het levendiger, binnen de journal-palette
(`--accent`, `--green`, `--red`, `--amber`, `--teal`, `--violet`, `--pink` en hun `-soft`-varianten); geen
nieuwe kleuren verzinnen. Richting:
- Een scenario-kaart krijgt een gekleurde linkerrand naar status (open `--accent`, genomen `--green`, gemist
  `--amber`, niet uit `--muted`, ongeldig `--red`), en de grade een eigen kleurbadge (A `--green`,
  B `--accent`, C `--amber`).
- De trechter-stappen (Week, Vandaag, Levels, Pre-flight, Mentaal) elk een eigen kleur stip of icoon.
- KPI-blokken in Afsluiting en Log op een `-soft`-achtergrond in hun kleur (binnen plan groen, buiten plan
  rood of amber, voorspel-score accent).
- De actieve tab een gekleurde onderstreping per tab.
- Contrast blijft leesbaar in beide thema's (tekst op `-soft` in de volle kleur of `--ink`). Geen
  hardcoded kleuren; alles via tokens.
- Lever **voor/na-screenshots** van Dag, Week, Afsluiting en Log (licht + donker) in
  `docs/plan-v3-polish-screenshots/`.

## 3. Wat de week al heeft, staat niet nog eens in de dag

Heeft het weekplan al een 4H-laag, dan hoort het dagplan geen tweede, lege 4H-rij te tonen.
- **Een nieuwe dag** krijgt de lagen van zijn stijl **min de tijdframes die het weekplan al heeft**. Blijft er
  niets over, dan staat er alleen "+ tijdframe".
- **Weergave:** per tijdframe één rij. Heeft de week dat tijdframe, dan staan de week-chips daar geërfd
  (gedimd), en voeg je met "+ tag" op diezelfde rij dag-tags toe. Die komen in een dag-laag met dat
  tijdframe, maar je ziet één rij, geen twee.
- **Bestaande dagen:** een lege dag-laag (geen bias, geen tags) met een tijdframe dat de week ook heeft,
  wordt bij het laden weggehaald. Een gevulde blijft staan en wordt samengevoegd weergegeven zoals hierboven.
- Hetzelfde geldt voor het scenario tegenover de dag (en week): één rij per tijdframe.
- **De edge verandert niet:** de matching gebruikt de samengevoegde tags per tijdframe, zoals nu.
- Test: weekplan met Daily en 4H, stijl Daytrade (dag = 4H · 1H) → de nieuwe dag heeft alleen een 1H-laag;
  de dag toont 4H één keer (geërfd), en een dag-tag op 4H verschijnt in die rij en telt mee in de edge.

## 4. Het venster "Koppel aan een trade uit je journal" rustiger

Nu: veel tekst, onoverzichtelijk. Nieuw:
- **Kop in één regel:** grade-badge, richting, pair en titel van het scenario, met de datum klein erachter.
- **Twee tabs** bovenaan: "Uit je journal" en "Nieuwe trade invullen" (was "Handmatig, backtest of paper";
  die uitleg komt als één korte regel in die tab zelf).
- **Filters** als twee kleine schakel-pills op één regel: "Alle pairs en richtingen" en "+ dag erna".
- **Trades als rijen die je in zijn geheel aantikt:** tijd · pair · richting-badge · R · bedrag, het
  resultaat groen/rood. Gekozen = gekleurde rand en achtergrond plus een vinkje. Bezet door een ander
  scenario = grijs, met "bij <titel>" rechts, niet aan te tikken.
- **De uitleg-alinea gaat weg.** Hooguit één regel grijze tekst onder de lijst: "Lege velden van de trade
  worden aangevuld vanuit het scenario."
- **Knoppen:** primair "Koppel 1 trade" / "Koppel 2 trades" (uitgeschakeld bij 0). Secundair, als tekstlink:
  "Nog niet binnen? Markeer als genomen".
- **Geen kandidaten:** één regel met wat ontbreekt en de volgende stap, plus die tekstlink.
- Op 390 px een paneel van onderen, de knoppen altijd in beeld (vast onderaan).
- Dezelfde vorm voor koppelen vanuit Afsluiting en Log.

## 5. Eén lettertype in de scenario's (en het hele plan)

Nu staan in één scenario-kaart een sans en een monospace (`IBM Plex Mono` via `--fn`) door elkaar:
de edge-regel, stop, TP's, "1/2 conf", levels. Dat oogt rommelig.
- **Overal Inter** (`--fb`). Koppen en titels mogen `--fd` (Plus Jakarta Sans), zoals in de journal.
- Getallen in **Inter met `font-variant-numeric: tabular-nums`**, zodat kolommen recht blijven.
  **Geen `--fn`/monospace meer in het plan**, ook niet in het levels-veld of de edge-tabel.
- Eén typeschaal: kies hooguit vier groottes voor het plan en houd je daaraan (bijvoorbeeld 12 / 13,5 / 15 / 19).
  Labels in hoofdletters (zoals TRIGGER) één stijl, overal gelijk.

## 6. Playbook-criteria zichtbaar bij een scenario

Een journal-playbook (`sj_db` → `kv` → `pbook`) heeft `criteria: [{text, mandatory}]` ("wanneer WEL"),
`antiCriteria` ("wanneer NIET") en eventueel `stop`, `target`, `minRR`.
- **Bij het kiezen van een playbook** in het scenario-formulier verschijnen meteen de criteria eronder:
  de verplichte met een duidelijke markering ("verplicht"), de anti-criteria als "Niet als …", en
  stop / target / min. R:R als één regel als ze gevuld zijn.
- **In het opengeklapte scenario** staan de criteria als **afvinklijst**, naast de confirmations, in
  dezelfde stijl. Afgevinkt bewaren in `Scenario.critChecked: [text]` (normaliseer oude scenario's naar `[]`).
- **"Klaar om te nemen"** vraagt voortaan: alle confirmations én alle **verplichte** criteria afgevinkt.
  Heeft het playbook geen criteria, dan verandert er niets.
- De anti-criteria staan erbij als waarschuwing (amber), niet om af te vinken.
- Playbook zonder criteria: geen leeg blok, hooguit "Dit playbook heeft nog geen criteria" met een link naar
  het playbook in de journal.
- Verandert het playbook in de journal, dan volgt het scenario de nieuwe tekst; vinkjes van criteria die niet
  meer bestaan vallen weg.

## Vaste regels

- Branch `plan-v3-polish` (vertrekt van de v1.19-release). **Alleen daarheen pushen.** Nooit `main`,
  `work`, `plan-v3-bouw` of de deploy-repo.
- **Geen versienummer, geen CHANGELOG, niets naar `site/`.** Dat doet Claude bij de release.
- Alles uit `CLAUDE.md` en de "Vaste regels" uit [het bouwplan](plan-v3-bouwplan-2026-10-27.md) blijft gelden
  (tokens, `esc()`, lege staten, Nederlandse teksten, "Zaratras").
- Aan het eind: de release-poort `node tests/run-release.js --hier`. Wat rood blijft door de container (de
  wisselkoers-API was vorige keer onbereikbaar) eerlijk benoemen, met bewijs dat het daaraan ligt.
- Schrijf `docs/plan-v3-polish-rapport.md` (kort, Nederlands): per punt wat er veranderde, de
  `Besluit:`-regels, de voor/na-screenshots, en een concept voor het CHANGELOG-blok (het versienummer kiest Claude).

## Logboek
