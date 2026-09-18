# Tradingplan: analyse en verbetervoorstellen

**Datum:** 2026-09-18 · **App:** tradingplan.syncjournal.nl (v1, losse app naast SyncJournal)
**Bronnen:** eigen metingen aan de app + onderzoek naar Steenbarger, Bellafiore, Douglas, Van Tharp, FTMO/Topstep + het tool-onderzoek dat al in `playbook-coaching-ai/results/` ligt.

---

## 1. Wat er nu staat (gemeten)

| Tabblad | Inhoud | Invulwerk |
|---|---|---|
| Overzicht | dagplan/weekplan-status, setup-criteria, triggers | — |
| Weekplan | bias, open, range, key levels/HP-zones, liquiditeit, max trades, nieuws, focuspunt, screenshots, TV-links | 8 velden + 10 vinkjes |
| Dagplan | daily bias, trend per timeframe, levels, scenario's (eigen tekst + charts), FTMO-ruimte, mentaal 1-5 | 5 velden + 12 vinkjes |
| Poort | 7 checks (2 hard), richting, symbool, timeframe, waarom, notities, verdict A/B/geen-trade + risico | 3 velden + 8 vinkjes |
| Playbook | A/B/C-setupdefinities, setup-criteria, triggers, valkuilen | vrije tekst |
| Log | trades, dagplannen, weekplannen; R per trade handmatig invulbaar | 1 veld per trade |

Opslag: localStorage (`tp2:*`), handmatige JSON-backup/import. De cloud-modus in de code (`window.claude.use`) is op het eigen domein **niet** beschikbaar — live draait alles lokaal.

---

## 2. Waar jouw plan al sterker is dan de meeste tools

Dit is geen beleefdheid, het volgt uit het onderzoek:

1. **Harde regels die écht consequenties hebben.** FTMO-ruimte en mentale staat zijn `hard`: mis je die, dan is de uitkomst "geen trade". Steenbarger: *"Checklists don't dictate what a trader does; they ensure that what a trader is supposed to do actually gets done."*
2. **Setup-kwaliteit gekoppeld aan positiegrootte** (A = 1%, B = 0,5%, rest = niet traden). Dat is Van Tharp's kern: sizing is de belangrijkste variabele, en jij koppelt hem aan een objectieve score in plaats van aan gevoel.
3. **Regelbreuk wordt gelogd, niet geblokkeerd.** Exact het ontwerp dat Topstep hanteert (stop-mechanisme ≠ straf) en het levert de data die je nodig hebt.
4. **De juiste ritmiek**: week → dag → pre-trade → log. Dat is precies de volgorde die alle bronnen aanbevelen.
5. **Scenario's met eigen charts** = scenario-preparatie (Steenbarger's "bedenk vooraf hoe het kan lopen").
6. **A vs B vs regelbreuk met gemiddelde R** in de poort-statistiek. Dit is de kruising die telt: hoge naleving + slechte uitkomst = plan kapot; lage naleving = uitvoering kapot.

---

## 2b. Hoe de rest van de markt het doet

| Feature | TradeZella | TraderSync | Edgewonk | TradesViz | Notion/Obsidian | **Jouw plan** |
|---|---|---|---|---|---|---|
| Setup-/playbook-definitie | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pre-trade checklist | ✅ | ✅ | ✅ verplicht/optioneel | ✅ | ✅ | ✅ **met harde stops** |
| Dagplan los van een trade | ✅ | deels | ✖ | ✅ | ✅ | ✅ |
| Weekplan | ✅ | ✖ | ✅ | ✅ | ✅ | ✅ |
| Bias + scenario's + invalidatie | ✖ | ✖ | deels | ✅ vrije velden | ✅ | ✅ (vrije tekst) |
| Naleving als cijfer | ✅ follow-rate | ✅ % per trade | ✅ completion | ✅ | ✖ | ✖ |
| Automatische regelbreuk-detectie | deels | deels | ✖ | ✅ (prop-regels) | ✖ | ✖ |
| Daily-loss-bewaking | ✅ | ✅ | ✖ | ✅ met buffer | ✖ | handmatig veld |
| Welke regels lónen | ✅ per regel | ✅ | ✅ **beste van allemaal** | ✅ | ✖ | ✖ |
| Risico gekoppeld aan setup-grade | ✖ | ✖ | ✖ | ✖ | ✖ | ✅ **uniek** |

**De belangrijkste conclusie uit dit onderzoek:** de journal-tools hebben statistiek maar geen echt plan; Notion en Obsidian hebben een echt plan (bias, scenario's, invalidatie) maar geen statistiek. **Niemand koppelt beide.** Jij hebt beide bouwstenen al in huis — ze praten alleen nog niet met elkaar.

Wat gebruikers volgens reviews het meest missen, en wat daarvan voor jou geldt:
1. **Automatische afwijking-detectie** — overal moet je zelf aanvinken dat je een regel brak, precies wat niemand doet na een slechte trade. Jij kunt dit uit je eigen tradedata afleiden.
2. **Een dagplan dat doorwerkt in de trades** — het gat waar niemand in zit.
3. **Waarschuwen vóór de schade** (70%/90% van je daglimiet) in plaats van erna.
4. **Snelheid**: duurt afvinken langer dan ~30 seconden, dan stopt men ermee. TradeZella en Edgewonk hebben niet eens een telefoon-app.
5. **Open posities meetellen** in risicoregels — prop-firms doen dat wél (FTMO rekent floating P/L mee), de meeste tools niet.
6. **Terugkoppeling welke regels je mag schrappen** — alleen Edgewonk doet dit.

---

## 3. De gaten

### 🔴 A. Plan en journal weten niets van elkaar
De poort logt trades in de plan-app; je échte trades (met echte R en P&L) staan in SyncJournal. Gevolg: je moet elke trade **twee keer** vastleggen, en de vraag "doen mijn A-setups het echt beter?" hangt op handmatig overtypen. Dit is veruit het grootste gat.

### 🟠 B. De poort weet niets van je verleden
Onderzoek naar pre-trade-validatie (zie `playbook-coaching-ai/results/pattern_pre_trade_validation.json`): vrijwel geen enkele tool doet dit, en het is "gewoon de checklist + een historische opzoeking". Jij hébt de checklist al. Wat ontbreekt is de tweede helft: *"deze setup: laatste 10 keer 4W/6L — de verliezen kwamen allemaal bij lage volatiliteit, en dat is nu ook zo."*

### 🟠 C. Geen meetbare naleving
Je ziet aantallen per grade, maar niet één getal: **% trades volgens plan deze week** (streefwaarde >85%). Dat is dé procesmaat uit het onderzoek; P&L als dagscore beloont juist mazzel.

### 🟠 D. Elke dag opnieuw vanaf nul
Een nieuw dagplan start volledig leeg (`blankPlan`). Levels uit het weekplan, je vaste checklist-antwoorden en gisteren's context komen niet mee. 12 vinkjes + 5 velden per dag is precies waar routines sneuvelen.

### 🟡 E. Scenario's zijn vrije tekst, geen als-dan
Gollwitzer's meta-analyse (94 studies): "als X, dan doe ik Y" verhoogt daadwerkelijke uitvoering fors (d = .65). Nu schrijf je scenario's in proza; als veld-structuur (*als … dan … ongeldig bij …*) worden ze uitvoerbaar én toetsbaar.

### 🟡 F. Geen expliciete no-trade-condities
Steenbarger noemt dit apart: schrijf niet alleen je beste condities op, maar juist **de condities waarin je niet hoort te handelen**. Nu zit dat impliciet in de poort.

### 🟡 G. Geen "beste trade van de week" naar het playbook
Bellafiore's methode: je playbook groeit uit je eigen beste trades, met vaste velden. Jouw playbook is nu een statische A/B/C-definitie die je zelf bijhoudt.

### 🟡 H. Plannen staan alleen in deze browser
Geen automatische backup, geen Drive, geen herinnering — terwijl SyncJournal dat allemaal wél heeft. Eén gewiste browser = al je plannen weg.

---

## 4. Voorstellen, op volgorde van opbrengst

### 1. Zet het plan op hetzelfde domein: `syncjournal.nl/plan`
**Getest en bewezen:** een pagina op `/plan` kan de opslag van de journal direct uitlezen (zelfde herkomst). Een apart subdomein kan dat principieel niet.

Dat ene besluit ontsluit alles hieronder:
- **FTMO-ruimte vult zichzelf**: de journal weet wat je vandaag al hebt verloren/verdiend.
- **Geen dubbele invoer**: de poort-statistiek gebruikt de échte R uit je trades.
- **"Trades vandaag: 2 / max 3"** komt uit echte data.
- Tradingplan.syncjournal.nl blijft bestaan als doorverwijzing.

*Inschatting: een halve dag (hosting + leeslaag + de bestaande velden erop aansluiten).*

### 2. Koppel poort-beslissing aan de echte trade
Bij "Ik neem deze trade" onthoudt de poort de beoordeling (A/B/regelbreuk + gemiste checks). Zodra die trade in de journal verschijnt (sync of handmatig), plakken we het oordeel eraan vast op tijd + pair. Daarna kan de journal tonen: *gem. R van A-setups vs B vs regelbreuken* — met echte cijfers, zonder overtypen.
*Inschatting: 1 dag.*

### 3. Naleving als één cijfer
Toon in het overzicht: **"Deze week volgens plan: 9 van 11 trades (82%)"**, met de streefwaarde erbij. Plus de diagnose eronder: hoge naleving + negatieve R = het plan deugt niet; lage naleving = de uitvoering deugt niet.
*Inschatting: halve dag (bovenop 2).*

### 4. Dagplan dat zichzelf half invult
- Key levels en liquiditeit uit het weekplan automatisch tonen in het dagplan (met één klik overnemen).
- Knop "neem gisteren over" voor trend/bias/levels.
- Checklist-items die zelden veranderen (tools open, nieuws gecheckt) onthouden hun stand per dag maar zijn met één klik te resetten.
*Inschatting: halve dag. Grootste effect op of je het blijft volhouden.*

### 5. Scenario's als als-dan
Per scenario drie korte velden: **als** (trigger/conditie) · **dan** (wat je doet) · **ongeldig bij** (waar het scenario sneuvelt). Vrije tekst blijft mogelijk, maar de structuur stuurt je naar uitvoerbare formuleringen — en maakt achteraf toetsbaar of het scenario is uitgekomen.
*Inschatting: 2-3 uur.*

### 6. No-trade-condities als vast blokje
In het weekplan: "deze week handel ik NIET wanneer …" (bijv. eerste 2 minuten na high-impact nieuws, na 2 verliezers op één dag, buiten sessie). Die condities verschijnen in de poort als extra harde check.
*Inschatting: 2-3 uur.*

### 7. Historische spiegel in de poort (de onderscheidende feature)
Op het moment dat je de poort invult, laat de app zien wat deze setup historisch deed: *"London SFP long: 14 trades, 57% win, gem. +0,8R. Je laatste 4 verliezers waren allemaal buiten de London-sessie — nu is het US PM."* Geen advies, alleen jouw eigen cijfers op het beslismoment. Vereist voorstel 1.
*Inschatting: 1 dag.*

### 8. Beste trade van de week → playbook
Wekelijks een voorstel: "Deze week was je beste uitvoering X. Toevoegen aan je playbook?" met Bellafiore's vaste velden (context, waarom in play, techniek, uitvoering, wat kon beter).
*Inschatting: halve dag.*

### 9. Automatische regelbreuk-detectie (waar de hele markt faalt)
Sommige regels zijn uit de tradedata af te leiden, zonder dat iemand iets hoeft aan te vinken: geen stop-loss ingevuld, risico groter dan je eigen maximum, meer trades dan je weeklimiet, entry buiten je eigen handelsvenster, of een setup die niet in je playbook staat. De journal kan die stil signaleren in het weekoverzicht: *"3 trades zonder vooraf genoteerde stop"*. Eerlijke data zonder zelfrapportage — precies wat volgens de reviews overal ontbreekt.
*Inschatting: 1 dag.*

### 10. Welke van je 7 poort-checks lonen écht?
Edgewonk's beste feature omgezet naar jouw poort: splits je resultaat uit naar welke checks je had afgevinkt. Dan zie je na verloop van tijd of bijvoorbeeld "trend mee" daadwerkelijk verschil maakt of dat het een regel is die je gerust kunt schrappen. Voorkomt dat je checklist elk kwartaal langer wordt.
*Inschatting: halve dag, bovenop voorstel 2.*

### 11. Waarschuwen vóór de schade
Prop-firms rekenen open posities mee in de daglimiet; jouw journal kent je open posities inclusief niet-gerealiseerde P&L. Een zachte banner bij 70% en 90% van je daglimiet ("nog 0,8% ruimte vandaag") is wat een journal wél kan, en wat vrijwel niemand biedt. Blokkeren kan alleen je broker; dat moeten we ook niet willen pretenderen.
*Inschatting: halve dag.*

### 12. Plannen meenemen in de backup
Zodra het plan op hetzelfde domein draait, gaat het automatisch mee in de bestaande backup- en Drive-routine van de journal. Daarmee vervalt gat H vanzelf.

---

## 5. Wat ik zou laten zoals het is

- **De 7 poort-checks.** Kort, binair, met twee harde stops — precies goed. Niet uitbreiden.
- **A/B/C met vaste risicopercentages.** Deze koppeling is je sterkste ontwerp.
- **Regelbreuk loggen zonder blokkade.** Blokkeren zou de eerlijke data kapotmaken.
- **De dagstart-checklist van 14 items** — lang, maar het is een voorbereidingsritueel, geen beslismoment. Wel de invul-wrijving verlagen (voorstel 4).

Uit het onderzoek, ter bevestiging van wat je níet moet doen: plannen langer maken, regels toevoegen na elke slechte sessie, vage formuleringen ("ik beheer mijn risico gepast"), en P&L als dagscore gebruiken.
