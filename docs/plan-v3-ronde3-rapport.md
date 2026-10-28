# TradingPlan v3 — ronde 3, rapport (28-10-2026)

Branch `plan-v3-ronde3`. Opdracht en volledig logboek: [plan-v3-ronde3-2026-10-27.md](plan-v3-ronde3-2026-10-27.md).
Niets is gereleased: geen versienummer, geen CHANGELOG, niets naar `site/` of de deploy-repo.

| Punt | Commit | Spec (nieuw of aangepast) |
|---|---|---|
| 1. Tags en tijdframes alleen via Instellingen | `459b706` | `plan3-lagen` 52/52 |
| 2. Geen pijltje bij geërfde tags, `Day.off` | `2979b8c` | `plan3-lagen` 63/63, `plan3-journal` 23/23 |
| 3. Pre-flight wordt Dagstart, vrije lijst | `b18792d` | `plan3-dagstart` 29/29 (nieuw) |
| 4+5. Mentaal wordt emoties, en dat wordt data | `7ed3303` | `plan3-gevoel` 30/30 (nieuw) |
| 6. Blok "Vandaag": één regel per laag | `6d0f4d2` | `plan3-regels` 39/39 (nieuw) |
| 7. Mori in een zijpaneel van het plan | `ed4768e` | `plan3-zijpaneel` 37/37 (nieuw), `plan3-mori` 55/55 |
| 8. Playbook-criteria standaard ingeklapt | `22fe378` | `plan3-criteria` 19/19 (nieuw), `plan3-dag` 77/77 |
| FAQ | deze commit, samen met dit rapport | `faq-volledig` 38/38, `faq` 84/84 |

## Stand

- Punt 1 t/m 8, de FAQ en dit rapport staan op `origin/plan-v3-ronde3`. Punt 1 t/m 6 deden eerdere agents; punt 7, 8,
  de FAQ en het rapport deze sessie.
- De commit van de FAQ werd eerst tegengehouden door de permissie-check van de sessie (de opdracht kwam van een andere
  Claude-sessie). Hij is gepusht nadat `CLAUDE.md` de uitzondering voor cloud-agents kreeg: een agent mag zijn eigen
  feature-branch pushen als Claude of Zaratras de opdracht gaf. Samenvoegen naar `main` en alles naar work/live blijft
  achter Denny's woord.

## Release-poort

`node tests/run-release.js --hier` (werkmap, mét de FAQ-wijziging): **170/173 groen** in 5,9 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten koersen bij `https://api.frankfurter.dev/v1/` (`FX_URL`, `work/syncjournal.html`); vanuit deze container geeft `curl https://api.frankfurter.dev/v1/latest` geen verbinding (`000`). Op `t2-specs` en vóór deze ronde rood op dezelfde regels. Geen fout in de app. |

- Wisselvallig, tweede poging groen: `terugkijken-v12` (niet aangeraakt in deze ronde).
- Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: `csv-import`, `hl-echt`, `hl-csv-echt`,
  en delen van `okx-`, `hyperliquid-`, `blofin-`, `kraken-` en `scenario-levensloop`.
- Alle plan3-, coach- en faq-specs zijn groen, ook los gedraaid (25/25).

## Punt 1

Het tag-venster heeft geen "Ontbreekt er een?" meer; "+ tijdframe" kiest alleen uit de journal. Het plan schrijft nergens meer naar `sj_tagconfig` (`voegTagToe`, `voegTijdframeToe`, "Ander tijdframe" weg). Lege soort: een regel met een link naar de journal op `?page=instellingen&tab=tags` (de journal kreeg daarvoor `tab`).

Screenshots: `voor/` (v1.21) — geen aparte na-set; de plan3-specs schrijven ze bij elke run naar `tests/screenshots/plan3/`.

**Besluiten** (uit het logboek):

- Besluit: link naar de journal is `?page=instellingen&tab=tags`; de journal kreeg daarvoor `tab` naast `page` (alleen
  bekende tabbladen) — de bestaande `?page=` kende geen subtabblad — als het fout is: de link opent Instellingen op
  het laatst gebruikte tabblad, één klik extra.
- Besluit: de verwijzing staat er ook als álle journal-tijdframes al een laag zijn ("Alle tijdframes uit je journal
  zijn al een laag. Voeg ze toe in de journal: Instellingen → Tags") — wie daar staat, zoekt een tijdframe dat er nog
  niet is — als het fout is: één regel tekst te veel.
- Besluit: in het tag-venster staat onderaan één regel "Tags beheer je in de journal", maar alleen als geen van beide
  soorten leeg is (anders staat de link al bij de lege soort) — als het fout is: een dubbele link.

## Punt 2

Geen "↑" meer bij geërfde chips; één uitlegregel en een tooltip naar de bron. Nieuw: `Day.off` om een week-tag voor vandaag uit te zetten (telt niet in de edge, niet in het scenario, niet op de trade, niet bij Mori).

Screenshots: `voor/` (v1.21) — geen aparte na-set; de plan3-specs schrijven ze bij elke run naar `tests/screenshots/plan3/`.

**Besluiten** (uit het logboek):

- Besluit: "Tik om voor vandaag uit te zetten" is echt gebouwd: `Day.off: ["<tf>|<tag>"]` (zelfde vorm als
  `Scenario.off`). Een uitgezette week-tag telt die dag niet mee in de edge, het scenario erft hem niet, hij gaat
  niet mee op een gekoppelde trade (`planLagen`) en niet in Mori's pakket — de opdracht schrijft de uitlegregel voor,
  en zonder dit gedrag zou die regel liegen — als het fout is: één veld in het datamodel extra; oude dagen hebben
  `off: []` en gedragen zich als voorheen.
- Besluit: in het scenario zegt de uitlegregel "uit je week- of dagplan … voor dit scenario"; de chip-tooltip noemt
  de echte bron — een scenario erft van beide — als het fout is: alleen tekst.
- Besluit: "Gisteren overnemen" neemt `Day.off` alleen mee binnen dezelfde week — een nieuwe week heeft andere
  week-tags — als het fout is: een uitgezette tag staat de volgende week weer aan.

## Punt 3

"Dagstart" overal in plaats van pre-flight. `cfg.pre` is een vrije lijst van hooguit 8 teksten; vinkjes per dag op tekst (`Day.dagstart`), migratie van `Day.pre`. Bewerken in de trechter (Bewerk) en in het tandwiel.

Screenshots: `voor/` (v1.21) — geen aparte na-set; de plan3-specs schrijven ze bij elke run naar `tests/screenshots/plan3/`.

**Besluiten** (uit het logboek):

- Besluit: in de trechter-stap staat "Bewerk" (→ invoervelden met × en "+ Voeg toe", "Klaar" terug), in plaats van
  altijd × en een veld naast de vinkjes — de ochtend is afvinken, bewerken is zeldzaam, en punt 6 vraagt rust in de
  trechter — als het fout is: één tik extra om te bewerken.
- Besluit: hernoemen neemt het vinkje mee op álle dagen, niet alleen vandaag (vinkjes staan op tekst; anders verliest
  een oude dag zijn vinkje door een tikfout-correctie) — als het fout is: een oude dag toont de nieuwe naam.
- Besluit: hernoemen in de trechter bewaart bij Enter of het verlaten van het veld, niet bij elke toets; in het
  tandwiel pas bij "Bewaar" (zoals de rest van het tandwiel) — als het fout is: wie de pagina sluit met de cursor nog
  in het veld, verliest die ene hernoeming.
- Besluit: voor de migratie bewaart "Bewaar" in het tandwiel eerst het plan (dan zijn oude pre-flight-dagen al
  omgezet met de óúde lijst) en pas daarna de nieuwe lijst — anders zou een oude `pre` na herladen op de indexen van
  de nieuwe lijst gelezen worden — als het fout is: verkeerde vinkjes op oude dagen; de spec bewaakt het.
- Besluit: de journal leest beide vormen (`planDagstart`), zodat Mori een dag die het plan nog niet opnieuw bewaarde
  ook goed ziet — als het fout is: niets, het is alleen lezen.
- Besluit: lege lijst (alle punten weg) mag; de stap zegt dan "Nog geen dagstart-punten. Tik op Bewerk …" en de kop
  laat "Dagstart x/y" weg — als het fout is: geen.

## Punt 4+5

De stap "Gevoel": emoties uit de journal (`Day.emoties`), negatief → "Overweeg alleen A-setups". Per gekozen emotie een regel uit de journal; nieuw blok "Je dagstart-gevoel" in de Log en in Tendencies → Plan. Afsluiting, Log, Mori-pakket en `coachPlanRegels` tonen emoties; oude dagen "mentaal 4/5 (oud)".

Screenshots: `voor/` (v1.21) — geen aparte na-set; de plan3-specs schrijven ze bij elke run naar `tests/screenshots/plan3/`.

**Besluiten** (uit het logboek):

- Besluit: de stap heet "Gevoel" (niet "Mentaal") — je kiest emoties, geen score; "Gevoel bij de dagstart" leest ook
  goed in de Afsluiting, de Log en Mori's pakket — als het fout is: alleen een naam.
- Besluit: niet gekozen emoties staan omlijnd in hun kleur, gekozen gevuld met ✓ (zoals de bias-knoppen) — de
  opdracht vraagt pills in de journal-kleur, en een grijze pill zegt niets over de kant — als het fout is: smaak.
- Besluit: de waarschuwing noemt de emotie: "Je begon met FOMO · Overweeg alleen A-setups vandaag." Een oude dag met
  mentaal ≤ 2 houdt de oude waarschuwing — als het fout is: alleen tekst.
- Besluit: "Je dagstart-gevoel" telt de dag van vandaag mee als je die emotie al koos (de opdracht zegt "alle dagen");
  zonder trades vandaag zakt alleen het aantal trades niet — als het fout is: één dag te veel in het aantal dagen.
- Besluit: de regel noemt de voorspel-score als "scenario's 67% uit" (uitgekomen van de afgeronde scenario's), en
  laat hem weg als die dagen geen afgerond scenario hebben — de opdracht noemt de score zonder vorm — als het fout
  is: één getal anders benoemd.
- Besluit: in Tendencies → Plan gelden de filters van de pagina (CLOSED), net als bij "Binnen tegenover buiten plan"
  ernaast; in het plan en in Mori's pakket alle trades — als het fout is: met een filter aan verschillen de cijfers
  tussen plan en journal (zonder filter zijn ze gelijk; de spec bewaakt dat).
- Besluit: in Mori's pakket staat de plan → statistiek-regel alleen bij een emotie met minstens één trade op die
  dagen ("als er data is"); de journal → plan-regel altijd — als het fout is: Mori mist "0 trades".
- Besluit: de Mori-opdracht voor het dagplan vraagt nu of het plan past bij "het gevoel waarmee de trader de dag
  begon" in plaats van "de mentale score" — anders vraagt Mori naar iets dat er niet meer is — als het fout is: tekst.
- Besluit (punt 3): Afsluiting en Log noemden "pre-flight" nergens; ik heb daar geen Dagstart-teller bijgezet (de Log-
  dagkop toont nu het gevoel) — als het fout is: één regel die Zaratras toch wil zien.

## Punt 6

Elke laag is één regel (kaartje): tijdframe · bias · tags, afgekapt met "+N". Tikken opent het venster met bias, uit te zetten week-tags, tags en "Laag weghalen". Week compact bovenaan, ⓘ voor de uitleg, "+ Tijdframe", een eigen stap "Charts". Zelfde regel in Week, Dag, scenario en formulier.

Screenshots: `punt6/` (trechter, Week, scenario, venster; voor en na).

**Besluiten** (uit het logboek):

- Besluit: tijdframes die alleen de week heeft, krijgen in Vandaag geen eigen regel meer; ze staan in de week-regel
  bovenaan, met tijdframe en bias zoals het voorbeeld ("Week · Weekly Bullish · Daily Bullish"), zonder tags — de
  opdracht vraagt de week apart en compact — als het fout is: de week-tags van Weekly/Daily zie je op Dag niet meer
  (wel in het weekplan, in elk scenario en in de edge); tags erbij in die regel is één regel code.
- Besluit: een week-tag voor vandaag uitzetten (punt 2) op een tijdframe zonder dag-laag gaat via "+ Tijdframe": de
  keuze toont nu ook de week-tijdframes, en `snoeiDag` laat zo'n lege dag-laag staan zolang de dag daar iets uitzet —
  zonder dat kon het niet meer, en zonder regel zou je niet zien dát er iets uit staat — als het fout is: één tik extra.
- Besluit: de uitleg "Gestippeld = …" (punt 2) staat nu samen met de context-zin achter de ⓘ, ook bij "Lagen" in een
  opengeklapt scenario; alleen in het scenario-formulier blijft hij als regel staan. De tekst werd "Tik op een laag
  om ze … uit te zetten": een chip zelf aantikken kan niet meer, de regel is één knop — de opdracht noemt de
  uitlegzin erboven als onrust — als het fout is: wie de ⓘ mist, heeft nog de tooltip op elke gestippelde chip.
- Besluit: tikken op een regel van een opgeslagen scenario opent hetzelfde venster met alleen de geërfde tags (voor
  dit scenario uit te zetten); op de entry-regel staat de entry-laag ter info met "Bewerk scenario" — de entry-laag
  wijzig je zoals voorheen in het formulier — als het fout is: één tik extra om entry-tags te wijzigen.
- Besluit: "bias?" alleen waar je hem kunt zetten (week, dag, entry in het formulier); geërfde regels in een scenario
  tonen de geërfde bias gestippeld of niets — als het fout is: geen.
- Besluit: de stap "Charts" staat na Levels (Week → Vandaag → Levels → Charts → Dagstart → Gevoel) en hoort op de
  telefoon bij de ingeklapte context — eerst analyse en levels, dan de plaatjes daarvan — als het fout is: volgorde.
- Besluit: de Week-stap in de trechter toont alleen no-trade en de link; "De lagen van de week staan gedimd bij
  Vandaag" verviel (klopt niet meer) en de context-zin ging naar de ⓘ — als het fout is: geen.
- Besluit: afkappen meet na het tekenen (`kapRijen`, ook bij een andere schermbreedte) in plaats van een vast aantal
  tags — hoeveel er passen hangt af van de breedte en de taglengte — als het fout is: een meting per render.

## Punt 7

Knop "🤖 Mori" bovenin en "Vraag Mori" openen een zijpaneel (420 px rechts, telefoon schermvullend) met de journal in embed-modus (`?embed=mori`). Het plan navigeert niet meer weg; doorvragen kan; sluiten bewaart het gesprek. De embed is stil (geen zijbalk, menu, banners, sneltoetsen, sync, update-check, welkom of migratie) en alleen-lezen: `bootEmbed()` leest alleen, `DB.save` schrijft alleen `sj_ai_*`, IndexedDB-schrijfacties en `persist()` doen niets.

Screenshots: `punt7/` (voor: de journal na "Vraag Mori"; na: het zijpaneel).

**Besluiten** (uit het logboek):

- Besluit: de embed is alleen-lezen op het laagste niveau: `DB.save` schrijft in de embed alleen `sj_ai_*`, `IDB.set`/
  `del`/`clearAll` en `persist()` doen niets, en `boot()` gaat naar een eigen `bootEmbed()` die alleen trades en
  playbooks leest — een lijst "sla deze stappen over" mist vroeg of laat een schrijfactie; zo kan geen pad in de
  journal (ook niet via een Mori-tool) iets wegschrijven — als het fout is: iets wat Mori in de embed wil bewaren
  buiten `sj_ai_*` blijft liggen tot de pagina sluit (nu niets).
- Besluit: een al geladen paneel krijgt een nieuwe vraag met `postMessage({tp3:'mori'})` naar de eigen origin; de
  embed accepteert alleen berichten van zijn ouder en van dezelfde origin, en negeert ze zolang hij nog opstart
  (`bootEmbed` pakt `tp3:mori` dan zelf op) — de overdracht blijft `tp3:mori`, zoals de opdracht vraagt — als het
  fout is: een tweede vraag komt niet aan tot je het paneel herlaadt; de spec bewaakt het.
- Besluit: het iframe wordt pas gemaakt bij de eerste keer openen, niet bij het laden van het plan — de journal laden
  kost tijd en geheugen, en wie Mori niet opent hoeft dat niet te betalen — als het fout is: de eerste keer openen
  duurt een tel langer.
- Besluit: knop "🤖 Mori" staat altijd in de kop, ook zonder sleutel of met Mori uit; "Vraag Mori" bij scenario en
  dagplan blijft alleen zichtbaar met een sleutel en Mori aan (zoals ronde Mori) — de opdracht zegt "ook zonder
  vraag", en zonder sleutel toont het paneel de uitleg — als het fout is: een knop die naar een uitleg leidt.
- Besluit: zonder sleutel toont het paneel de bestaande uitleg, maar zonder sleutelveld: "Mori instellen" opent Mori in
  de journal zelf (`target="_top"`); ook "Mori inschakelen" en "Instellingen" in de voet gaan naar de journal — een
  sleutel bewaren is een instelling, en de embed bewaart geen instellingen — als het fout is: één paginawissel om de
  sleutel te plakken.
- Besluit: "← Terug naar je plan" verdwijnt alleen in de embed; in een gewoon journal-tabblad (oude link, bladwijzer)
  staat hij er nog — als het fout is: geen.
- Besluit: in de embed verbergt CSS de knoppen van een lege staat ("Naar Accounts", "Filter uitzetten") — die zouden in
  het paneel de journal-pagina's openen of je filter wijzigen — als het fout is: wie zonder trades Mori opent, leest
  wat er ontbreekt maar heeft geen knop; de journal staat één klik verderop.
- Besluit: met het paneel open krijgt een opengeklapt scenario één kolom (zoals onder 860 px) — met 420 px minder waren
  de statusknoppen afgekapt tot "Ge…" — als het fout is: een opengeklapt scenario is langer met het paneel open.
- Besluit: op schermen tot 900 px is het paneel volledig scherm en scrollt het plan eronder niet mee; het schuift van
  onder in (niet bij `prefers-reduced-motion`) — 420 px naast een plan van minder dan 480 px leest niet — als het fout
  is: op een tablet staand dekt Mori het plan.
- Besluit: het thema van het iframe volgt `sj_state.theme` zoals de journal altijd doet; wisselt het thema in een ander
  tabblad, dan volgt het paneel pas na herladen (net als het plan zelf) — als het fout is: een paneel in het oude
  thema tot je herlaadt.

## Punt 8

Criteria in een opengeklapt scenario zijn één regel: "Criteria · <playbook> · 1/2 verplicht" met een pijltje; tikken klapt open. Confirmations af en verplichte criteria open: de regel zegt het in amber. Open/dicht per scenario in het geheugen. De voorvertoning in het formulier is compact (102 px in plaats van 146 px).

Screenshots: `punt8/` (voor: scenario en formulier; na: dicht, open, formulier).

**Besluiten** (uit het logboek):

- Besluit: het ✓ staat alleen achter de telling als álle verplichte criteria af zijn ("2/2 verplicht ✓"); bij 1/3 staat
  er geen ✓ — het voorbeeld in de opdracht ("1/3 verplicht ✓") lees ik als vorm, en een vinkje bij een open verplicht
  criterium zegt "klaar" terwijl het dat niet is — als het fout is: één teken.
- Besluit: de amber regel verschijnt als alle confirmations af zijn en er verplichte criteria open staan, ook als het
  scenario geen confirmations heeft (dan zijn ze "alle af") — de regel moet voorkomen dat je iets mist terwijl het blok
  dicht is — als het fout is: amber bij een scenario zonder confirmations, iets eerder dan nodig.
- Besluit: zonder verplichte criteria zegt de regel het aantal ("3 criteria"); een playbook zonder criteria en zonder
  "Niet als" krijgt geen klapregel maar de bestaande twee regels met de link naar de journal — een klapregel voor
  niets is één tik voor niets — als het fout is: geen.
- Besluit: open/dicht staat in `S.critOpen` (geheugen van de pagina): na herladen weer dicht — "binnen de sessie is
  genoeg (geen opslag nodig)" — als het fout is: na herladen één tik om weer open te klappen.
- Besluit: de titel van de klapregel houdt de kop-stijl van de andere blokken (hoofdletters, zoals CONFIRMATIONS 15M);
  de telling en de amber regel staan in gewone letters erachter — anders valt het blok uit de rij koppen — als het
  fout is: smaak.
- Besluit: de voorvertoning in het scenario-formulier zet de criteria achter elkaar op één regel (met "verplicht"), en
  "Niet als" als amber tekstregel zonder kader: 102 px hoog in plaats van 146 px bij drie criteria — de opdracht vraagt
  compact, zichtbaar blijven — als het fout is: bij lange criteria-teksten loopt de regel over op een tweede regel.

## FAQ

Twee nieuwe vragen (Dagstart; Gevoel en "Je dagstart-gevoel") en bijgewerkte antwoorden voor het Trading Plan, het dagplan (lagen als regels), "Klaar om te nemen" (criteria ingeklapt), screenshots (Charts) en Mori (zijpaneel).

Screenshots: `faq/` (na).

**Besluiten** (uit het logboek):

- Nieuw: "Wat is de Dagstart?" en "Wat doet Gevoel, en wat zegt het over mijn trades?" (emoties, de regel per emotie
  uit de journal, "Je dagstart-gevoel" in de Log en Tendencies → Plan, betrouwbaarheid op aantal dagen, niet naar je
  trades).
- Bijgewerkt: "Wat is het Trading Plan?" (Dag: charts, dagstart, gevoel), "Hoe maak ik een dagplan" (lagen als regels,
  tik om te bewerken, + Tijdframe, Laag weghalen, gestippeld = uit je weekplan), "Klaar om te nemen" (criteria
  ingeklapt, de amber regel, Dagstart en Gevoel als herinnering), screenshots (stap Charts), Mori (het zijpaneel,
  doorvragen, 🤖 Mori bovenin, het gesprek blijft, het paneel verandert niets aan je trades).
- De spec bewaakt nu ook: geen "pre-flight", geen mentaal-cijfer behalve "mentaal 4/5 (oud)", geen "voeg een tag toe in
  het plan"/"Ontbreekt er een?", en elke nieuwe knopnaam bestaat in de broncode én staat in de FAQ.
- Besluit: Dagstart en Gevoel kregen elk een eigen vraag in plaats van een alinea in "Wat is het Trading Plan?" — het
  zijn de twee dingen die je elke ochtend doet, en Gevoel heeft een eigen statistiek om uit te leggen — als het fout
  is: twee vragen meer in de categorie.
- Besluit: het woord "pre-flight" staat nergens meer, ook niet als "heette vroeger" — de opdracht zegt "geen
  pre-flight meer in beeld" — als het fout is: wie de oude naam zoekt, vindt hem niet (zoeken op "dagstart" wel).

## Wat niet getest kon worden

- **Echte Anthropic-aanroepen**: alles loopt via de nep-fetch (`tests/helpers/coach-nep.js`); geen echte sleutel,
  geen echt verzoek (de specs tellen netwerkverkeer naar `anthropic.com`: 0).
- **Het zijpaneel op `syncjournal.nl`/`work.syncjournal.nl`**: getest op localhost, waar `JOURNAL_URL` naar
  `../work/syncjournal.html` wijst. Hosted wordt het `/app?embed=mori`; dat vereist dat `/app` in een iframe van `/plan`
  geladen mag worden. `site/_headers` zet alleen `Cache-Control`, geen `X-Frame-Options` of `frame-ancestors`, dus dat
  zou moeten werken; gezien heb ik het niet. **Controleer na de volgende deploy op work dat het paneel de journal toont.**
- **Echte telefoons en Safari**: alleen Chromium op 390 px breed.
- **De wisselkoersen** (`api.frankfurter.dev`) zijn vanuit de container niet bereikbaar; zie de release-poort.
- **Echte exports** (`tests/_fixtures/`): niet in deze kloon; de delen die ze nodig hebben zijn overgeslagen.

## Concept-CHANGELOG

```markdown
## [vX.Y] — 2026-10-xx

### Toegevoegd
- **Mori naast je plan.** "Vraag Mori" opent Mori nu in een paneel rechts van je plan (op je telefoon schermvullend),
  in plaats van naar de journal te springen. Je kunt gewoon doorvragen, en met 🤖 Mori bovenin open je het paneel ook
  zonder vraag. Het paneel verandert niets aan je trades of instellingen.
- **Gevoel bij je dagstart.** In plaats van een cijfer 1 tot 5 kies je 's ochtends emoties uit je journal. Onder elke
  emotie zie je hoe je trades ermee gingen, en "Je dagstart-gevoel" in de Log en bij Tendencies → Plan laat zien hoe de
  dagen liepen die je met een bepaald gevoel begon.
- **Dagstart: je eigen lijstje.** Pre-flight heet nu Dagstart, en de lijst is van jou: hooguit 8 punten, toevoegen,
  weghalen en hernoemen met Bewerk.

### Gewijzigd
- **Vandaag is rustiger.** Elk tijdframe is één regel met bias en tags; tik erop om te bewerken. De week staat compact
  bovenaan, afbeeldingen en links hebben een eigen stap "Charts".
- **Criteria standaard ingeklapt.** In een scenario staan je playbook-criteria op één regel; tik om ze af te vinken.
  Staan er nog verplichte criteria open terwijl je confirmations af zijn, dan zegt die regel dat in amber.
- **Tags en tijdframes beheer je alleen in de journal** (Instellingen → Tags). In het plan kies je uit die lijst.
- **Geërfde tags zonder pijltje.** Gestippeld betekent "uit je weekplan"; tik op de laag om zo'n tag voor vandaag uit
  te zetten.
```
