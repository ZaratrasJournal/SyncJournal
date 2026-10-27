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

- **Punt 1 klaar** — `node tests/plan3-lagen.spec.js` → 34/34 (9 nieuwe kleur-checks), `plan3-afsluiting` 29/29, alle
  plan3-specs groen. Tokens `--violet`, `--teal`, `--pink` letterlijk uit de journal (licht en donker), plus
  `--violet-soft`/`--teal-soft`/`--pink-soft` als 12%-mix (de journal heeft die niet als token). `.chip` is nu de
  journal-pill (`.tagchip.col`: 12% achtergrond, 30% rand, stip) met `--tc` per soort via `tagKleur()` (kopie van de
  regel in `TAG_CATS`): setup accent, confirmation teal, tijdframe violet, eigen/onbekend muted. Geldt voor eigen lagen,
  geërfde lagen, geërfd in het scenario, de tag-keuze, de tijdframe-keuze, de lagen in "Zet om in trade" en de
  "zonder …"-uitleg bij de edge. Eigen = vol met stip; geërfd = zelfde kleur, geen vulling, stippelrand, 72% dekking;
  uitgezet = `--faint`, doorgestreept, 55%. Bias-knoppen omlijnd in groen/rood/muted, gekozen = gevuld.
  Voor-screenshots (v1.19) in `docs/plan-v3-polish-screenshots/voor/` (gekopieerd uit de bouw-doorloop, zelfde code).
  Besluit: de Log-filters zijn pills geworden in plaats van keuzelijsten (status in zijn statuskleur, playbook in de
  setup-kleur, long groen, short rood; nog eens tikken = uit) — de opdracht noemt de Log-filters als chips, en een
  keuzelijst kan geen kleur dragen — kost als het fout is: bij veel playbooks wordt de rij langer (hij loopt door).
  Besluit: het tijdframe-label van een laag is een violet pill (tijdframe = violet in de journal) — kost niets.
  Besluit: een geërfde chip houdt zijn pijltje "↑" maar verliest de stip — twee tekens voor hetzelfde oogde druk —
  kost niets.
  Besluit: tekst op een gevulde bias-knop is `--surface` in plaats van `--on-accent` (wit): wit op het lichte groen
  van het donkere thema is slecht leesbaar — kost niets.
- **Punt 2 klaar** — `plan3-dag` 43/43 (4 nieuwe kleur-checks), `plan3-afsluiting` 32/32 (3 nieuwe), alle plan3-specs
  groen, doorloop 20/20. Scenario-kaart: linkerrand 4px naar status (open accent, genomen groen, gemist amber, niet
  muted, ongeldig rood); de grade-badge had al zijn kleur (A groen, B accent, C amber). Trechter: gevulde stip per stap
  (Week violet, Vandaag accent, Levels amber, Pre-flight groen, Mentaal pink). Tabs: een stip en een onderstreping in
  hun eigen kleur (Week violet, Dag accent, Afsluiting groen, Log amber). KPI's in de Afsluiting op `-soft` (uitgekomen
  accent, genomen groen, gemist amber), het getal in de volle kleur; binnen plan op groen-soft, buiten plan op
  rood-soft bij verlies en anders amber-soft (Afsluiting én Log); voorspel-score op accent-soft met de percentages in
  accent. Week-kaarten hebben een kleurstip bij hun label, in dezelfde kleur als in de trechter (levels amber).
  Het × van een laag staat nu op dezelfde regel als de laag (eigen kolom) in plaats van op een losse regel.
  Besluit: mentaal-knoppen gekleurd naar de score (1–2 rood, 3 amber, 4–5 groen) — een 2 in accent-blauw zei niets,
  en het past bij "Overweeg alleen A-setups" bij ≤ 2 — kost niets.
  Besluit: de staptitels in de trechter blijven grijs, alleen de stip kleurt — amber of pink als 11px-tekst op wit is
  te zwak (contrast < 4,5) — kost niets.
  Besluit: op 390 breed staan de Log-filtergroepen onder elkaar, zonder scheidingslijn — kost niets.
- **Punt 3 klaar** — `plan3-lagen` 46/46 (12 nieuwe checks, met de test uit de opdracht: week Daily · 4H, stijl
  Daytrade → de nieuwe dag heeft alleen 1H; 4H staat één keer, geërfd; een dag-tag op 4H komt in die rij en telt mee in
  de edge), `plan3-dag` 43/43, `plan3-doorloop` 20/20, alle plan3-specs groen. `nieuweDag` laat de tijdframes van het
  weekplan weg; `snoeiDag` haalt bij het laden (en bij "Weekplan maken" en "Gisteren overnemen") een lege dag-laag weg
  waarvan de week het tijdframe al heeft. `laagRij` voegt week en dag samen tot één rij per tijdframe (`tfRij`): de
  week-chips gedimd, de dag-tags erachter, "+ tag" op dezelfde rij; zo'n tag gaat naar de dag-laag met dat tijdframe
  (`day@4H`), die pas ontstaat als je er iets in zet. Het scenario (formulier én opengeklapt) toont ook één rij per
  tijdframe (`scenRijen`), met de entry-laag in zijn eigen tijdframe-rij (gemarkeerd "entry"). De edge is niet veranderd.
  Specs bijgewerkt waar de vorm veranderde: `plan3-dag` telt in het formulier alleen de eigen chips (`:not(.inh)`),
  `plan3-doorloop` verwacht voor dag 2 nu 1H (de week heeft 4H).
  Besluit: de trechterstap "Week" toont de week-lagen niet meer; die staan gedimd in de rijen van "Vandaag" — anders
  staat 4H alsnog twee keer op het scherm, één keer in Week en één keer in Vandaag. De stap houdt no-trade, de
  context-zin en een link naar het weekplan — kost als het fout is: wie de week-lagen los wil zien, opent het Week-tabblad.
  Besluit: de bias van de week staat in de bias-knoppen van de dag gestippeld (zolang de dag er zelf geen kiest), in
  plaats van als los label naast de knoppen — één rij, één bias-plek; tikken zet hem voor de dag vast (en maakt zo nodig
  de dag-laag aan) — kost niets.
  Besluit: in het opengeklapte scenario toont de entry-rij de setups en bias van de entry-laag; de confirmations staan
  zoals eerder in de afvinklijst eronder — kost niets.
- **Punt 4 klaar** — `plan3-koppeling` 45/45 (8 nieuwe checks: kop in één regel, tabs, filter-pills, rij aantikken met
  vinkje, "Koppel 1/2 trades", uitgeschakeld bij 0, tekstlink, geen-kandidaten-regel, paneel van onderen op 390 met de
  knoppen in beeld), `plan3-afsluiting` 32/32 en `plan3-doorloop` 20/20 (koppelen vanuit Afsluiting, Log en Dag: zelfde
  venster). Kop: grade · richting · pair · titel, datum klein erachter. Tabs "Uit je journal" / "Nieuwe trade invullen"
  (met de oude uitleg als één regel in die tab). Filters "Alle pairs en richtingen" en "+ dag erna" als pills. Trades als
  rijen (knoppen) met tijd · pair · richting · R · bedrag, resultaat groen/rood; gekozen = accent-rand en -achtergrond
  met vinkje; bezet = grijs, "bij <titel>" rechts, uitgeschakeld. Eén grijze regel onder de lijst. Onderaan links de
  tekstlink "Nog niet binnen? Markeer als genomen", rechts "Koppel n trade(s)". Specs aangepast aan de nieuwe vorm
  (rij aantikken in plaats van een vinkvakje, `plan3-afsluiting` en `plan3-doorloop` idem).
  Besluit: bij 0 gekozen heet de uitgeschakelde knop "Koppel trade" (niet "Koppel 0 trades") — kost niets.
  Besluit: alles ontkoppelen kan niet meer via dit venster (de knop is uit bij 0); dat gaat met het × bij de trade in het
  opengeklapte scenario — de opdracht vraagt de knop uit bij 0 — kost als het fout is: één knop "Bewaar zonder trades".
  Besluit: de geen-kandidaten-regel noemt wat ontbreekt ("Geen XRP long op di 27-10 in je journal") en de volgende stap
  ("Sync eerst in de journal, of zet "Alle pairs en richtingen" aan"); de oude zin over "later koppelen vanuit Afsluiting
  of Log" is weg, de tekstlink eronder doet dat — kost niets.
- **Punt 5 klaar** — `plan3-dag` 64/64 (21 nieuwe checks: op Dag met een opengeklapt scenario, het scenario-formulier,
  Week, Afsluiting en Log per scherm alleen Inter/Plus Jakarta Sans, alleen de vier groottes, één stijl voor labels in
  hoofdletters, getallen met tabular-nums; en geen `--fn`/IBM Plex Mono/`monospace` meer in het bestand), alle
  plan3-specs groen. IBM Plex Mono is uit de font-link en `--fn` is weg; elke `font-family:var(--fn)` geschrapt.
  `font-variant-numeric:tabular-nums` op `body`, zodat elk getal (edge-regel, tabel, KPI, stop, TP's, tijden) rechte
  kolommen houdt. Typeschaal als tokens `--t1` 12 · `--t2` 13,5 · `--t3` 15 · `--t4` 19; elke `font-size` staat op een
  van die vier (10,5–12 → 12; 12,5–14 → 13,5; 15–17 → 15; 18–22 → 19). Labels in hoofdletters (kaartkoppen, TRIGGER,
  tabelkoppen, LONG/SHORT, STERKSTE, ENTRY en de formulierlabels) delen één regel: 12px, 700, `.05em`.
  Besluit: formulierlabels (`label.f`: Levels, No-trade, Titel, Playbook …) zijn nu ook hoofdletter-labels, zodat
  "Lagen" en "Levels" op het Week-scherm er hetzelfde uitzien — kost niets.
  Besluit: de rijnamen van de edge-tabel zijn kort ("Gem. R", "Expectancy") met de uitleg als tooltip — met de grotere
  tekst liep "Gem. R (= expectancy in R)" over drie regels — kost als het fout is: de uitleg is alleen nog via hover te zien.
  Besluit: de vijf statusknoppen staan op 390 breed in drie kolommen (twee rijen) — met 12px viel "Genomen" weg achter
  een "…" — kost niets.
- **Punt 6 klaar** — `plan3-dag` 77/77 (13 nieuwe checks), `plan3-journal` 22/22 (1 nieuwe), alle plan3-specs groen,
  doorloop 20/20. `pbInfo(naam)` leest criteria, anti-criteria, stop, target en min. R:R uit het journal-playbook (ook het
  oude formaat, een lijst met teksten, zoals `pbNormalize`; lege criteria vallen weg). Formulier: meteen onder het
  playbook de criteria (verplichte met een "verplicht"-pill), "Niet als: …" in amber en "Stop · Target · Min. R:R" op één
  regel. Opengeklapt: "Criteria · <playbook>" als afvinklijst in de stijl van de confirmations, met "x/y verplicht";
  anti-criteria als amber waarschuwing zonder vinkje. `Scenario.critChecked: [text]` (oude scenario's → `[]`). "Klaar om
  te nemen" vraagt alle confirmations én alle verplichte criteria. Bij het laden van de journal vallen vinkjes van
  criteria die niet meer bestaan weg (`snoeiCriteria`, bewaard), en het scenario toont altijd de actuele tekst.
  Journal: `?page=playbook&pb=<naam>` opent dat playbook (link "vul ze aan in de journal" bij een playbook zonder
  criteria); het adres wordt daarna weer schoon, zoals bij `?page=`.
  Besluit: een scenario zonder confirmations maar mét verplichte criteria kan klaar zijn zodra die criteria af zijn —
  de oude regel ("zonder confirmations nooit klaar") ging erover dat er niets af te vinken was; nu is dat er wel —
  kost als het fout is: één voorwaarde in `confAf`.
  Besluit: de voortgangsbalk blijft alleen voor de confirmations; de criteria hebben hun eigen teller ("1/2 verplicht")
  — kost niets.
  Besluit: kies je een ander playbook in het formulier, dan worden ook de criteria-vinkjes leeggemaakt (zoals de
  confirmations al werden) — kost niets.
- **Afronding** — na-screenshots in `docs/plan-v3-polish-screenshots/na/` (doorloop met `--uit=`), rapport in
  [plan-v3-polish-rapport.md](plan-v3-polish-rapport.md). Poort: `node tests/run-release.js --hier` →
  **`═══ SyncJournal-suite (release-poort): 164/167 specs groen · 5.4 min ═══`**; rood `analytics-metrics`, `matrix`,
  `tendencies`, alleen op "boot zonder fout"/"geen JS-errors" door `ERR_TUNNEL_CONNECTION_FAILED` (wisselkoers-API
  `api.frankfurter.dev` onbereikbaar uit de container). Op de onaangeraakte v1.19-commit falen ze hier identiek.
