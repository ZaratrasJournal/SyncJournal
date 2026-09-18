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

### 3. Naleving als één cijfer — met het bedrag erbij
Toon in het overzicht: **"Deze week volgens plan: 9 van 11 trades (82%)"**, met de streefwaarde erbij. Plus de diagnose eronder: hoge naleving + negatieve R = het plan deugt niet; lage naleving = de uitvoering deugt niet.

**Belangrijke bijstelling na het laatste onderzoek:** het percentage mag niet de hoofdmoot zijn. Een gemeten verband tussen nalevingsscore en rendement kwam uit op r = 0,21 — positief maar zwak, dus als losse score is het makkelijk weg te wuiven. Wat volgens gebruikers wél binnenkomt is het bedrag: *"these trades cost you €2.650 this month"*. Zet dus het **euro-verschil tussen je plan-trades en je regelbreuk-trades** vooraan, en het percentage eronder. Neem ook een derde uitkomst mee naast gevolgd/gebroken: **niet te beoordelen** (te weinig data), zodat lege dagen het cijfer niet vervuilen.
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

**Harde randvoorwaarde:** elk automatisch label moet met één klik terug te draaien zijn, en nooit stilletjes bestaande handmatige labels overschrijven. Het schoolvoorbeeld hoe dit misgaat staat in de reviews van een concurrent: automatische labels die over honderden trades heen fout gingen, zónder herstelmogelijkheid — *"my statistics unreliable… no reliable undo or restore function"*, van een tot dan toe tevreden klant. Gebruikers straffen een fout label veel harder af dan een ontbrekend label.
*Inschatting: 1 dag.*

### 10. Welke van je 7 poort-checks lonen écht?
Edgewonk's beste feature omgezet naar jouw poort: splits je resultaat uit naar welke checks je had afgevinkt. Dan zie je na verloop van tijd of bijvoorbeeld "trend mee" daadwerkelijk verschil maakt of dat het een regel is die je gerust kunt schrappen. Voorkomt dat je checklist elk kwartaal langer wordt.
*Inschatting: halve dag, bovenop voorstel 2.*

### 11. Waarschuwen vóór de schade
Prop-firms rekenen open posities mee in de daglimiet; jouw journal kent je open posities inclusief niet-gerealiseerde P&L. Een zachte banner bij 70% en 90% van je daglimiet ("nog 0,8% ruimte vandaag") is wat een journal wél kan, en wat vrijwel niemand biedt. Blokkeren kan alleen je broker; dat moeten we ook niet willen pretenderen.
*Inschatting: halve dag.*

### 12. Volgorde-regels: het gat dat niemand vult
Waarschuw (niet blokkeren) bij de patronen die traders zichzelf niet zien aandoen: een nieuwe entry binnen X minuten na een verlies, de derde verliezer op rij, of een grotere positie dan de vorige na een verlies. De journal ziet die volgorde in je eigen data; geen enkele onderzochte tool doet dit. Dit past ook bij je mentale check in de poort.
*Inschatting: 1 dag.*

### 13. Discipline zichtbaar in de kalender
Twee aflezingen per dag: je resultaat in kleur, plus een markering of je je plan volgde. En daarnaast de vergelijking die overtuigt: gemiddelde R en win-rate op dagen mét plan versus dagen zonder.
*Inschatting: halve dag, vereist voorstel 3.*

### 14. Plannen meenemen in de backup
Zodra het plan op hetzelfde domein draait, gaat het automatisch mee in de bestaande backup- en Drive-routine van de journal. Daarmee vervalt gat H vanzelf.

### 15. Leg vast wat je bewust niet nam
Eén knop in de poort: **"Niet genomen"** — met de reden (buiten plan, te laat, twijfel, geen ruimte). Die overgeslagen setups verschijnen in het weekoverzicht naast je echte trades. Dat beantwoordt de vraag die traders het meest bezighoudt en die geen enkele tool beantwoordt: *ben ik te voorzichtig, of red ik mezelf?* Iemand die het drie maanden bijhield: *"I could see after 3 months that all the trades I didn't take wouldn't have turned a profit overall, so there was no second guessing myself anymore."* Ook fijn: het is precies dezelfde poort, alleen een andere uitkomstknop.
*Inschatting: 2-3 uur, bovenop voorstel 2.*

### 16. Plafond op het playbook, en steekproef zichtbaar
Twee kleine ingrepen tegen de meest gedocumenteerde faalroute:
- **Toon bij elke playbook-statistiek het aantal trades**, en verberg percentages onder een ondergrens (bijv. 10) met *"nog te weinig trades voor betrouwbare cijfers"*. Anders lees je ruis als edge.
- **Waarschuw zacht boven ~8 playbooks of ~15 fout-labels**: *"je hebt nu 12 playbooks — de meeste traders komen uit op 5 tot 8; verder opsplitsen maakt de cijfers per playbook onbetrouwbaar."* Niet blokkeren, wel benoemen.

De aanleiding is één van de scherpste verhalen uit het onderzoek: *"I used to have like 30 playbooks… and extremely specific mistake tags, ended up with 40+ … caused me information overload and not get much value off of it. Now I have 7 playbooks."* Verfijning voelt als vooruitgang en is het niet.
*Inschatting: 2-3 uur.*

### 17. Log het moment dat je de waarschuwing wegklikt
Bij elke zachte waarschuwing (voorstel 11 en 12) leggen we vast dat hij verscheen én wat je vervolgens deed. Geen blokkade, geen oordeel — één regel data. Na een maand kun je zien: *"7 keer gewaarschuwd bij de derde verliezer, 6 keer toch doorgegaan, samen −€840."* Dit is de enige plek waar het echte risicopatroon zichtbaar wordt, en nota bene expliciet gevraagd door gebruikers: *"I'd log every attempted rule breach and every override, because that is where the trader's real risk pattern shows."* Niemand bouwt het.
*Inschatting: 3-4 uur, bovenop voorstel 11.*

---

## 4b. Aanvullend onderzoek: hoe afdwinging écht werkt

Er blijkt een duidelijke ladder te bestaan, en vrijwel elk product doet alsof het bovenaan staat terwijl het onderaan zit:

| Niveau | Mechanisme | Wie doet dit echt |
|---|---|---|
| 1 | Broker sluit posities en weigert orders | Topstep, Tradovate, NinjaTrader |
| 2 | Terminal-robot sluit alles (MT5-EA) | Prop-Firm Equity Guard e.a. |
| 3 | Browser-extensie dekt de koopknop af | Trading Buddy |
| 4 | Waarschuwen in realtime, niet blokkeren | PropJournal (70%/90%), ExMachina (80%) |
| 5 | Achteraf beoordelen | TradesViz, TradeZella |

**Wat dit voor ons betekent:** een journal kan per definitie geen order tegenhouden — dat moeten we ook niet pretenderen. Wat we wél kunnen is het beste van niveau 4 doen, en dat doet bijna niemand goed.

Drie ideeën die het waard zijn om te stelen:

1. **De "dead-line"** (PropGuard): reken je resterende dagverlies om naar iets concreets — *"nog €340 ruimte = nog één trade van 1%"*. Niet een percentage-balkje, maar het getal waar je iets mee kunt.
2. **Twee aflezingen per dag in de kalender** (TradesViz): de kleur voor je resultaat, plús een markering of je je plan volgde. Jouw journal hééft al een kalender — dat is één extra streepje per dag.
3. **Vergelijk dagen mét en zonder plan** (TradesViz "Rule Outcome"): laat win-rate, gemiddelde R en houdtijd zien voor dagen waarop je je regels volgde versus dagen waarop je ze brak. Dat is het overtuigendste bewijs dat een trader kan krijgen.

**En één gat dat de hele markt open laat:** *volgorde-regels*. Geen enkele tool waarschuwt bij "nieuwe entry binnen 10 minuten na een verlies" (revenge), "derde verliezer op rij", of "grotere size na verlies". Op Reddit is dit juist wat traders zelf vragen: *"set a daily loss limit lockout… take the keys of the vehicle out of your hands."* Een journal kan die patronen wél zien en benoemen.

Tot slot een detail over eerlijk scoren dat TradesViz goed doet: naast "gevolgd" en "gebroken" bestaat er **"niet te beoordelen"** (te weinig data). Dat voorkomt dat een lege dag je nalevingscijfer vervuilt.

---

## 4c. Wat het onderzoek naar Notion en Obsidian oplevert

Er is nog een vierde onderzoekslijn gedraaid over de "doe-het-zelf"-hoek (Notion-templates en Obsidian-vaults). Drie dingen springen eruit.

**1. Scenario-denken bestaat nergens als structuur.** Over honderden templates heen: geen enkele heeft een als-dan-scenario, of zelfs maar een gekoppeld bull-/bear-geval. Iedereen heeft één `bias`-veld en een stuk vrije tekst. Terwijl traders het wél zo doen — letterlijk uit een forum: *"whenever I plan my trades before market open I have both a bearish and bullish set up, that way if either plays out I will be ready."* **Jouw scenario's met eigen charts zijn dus geen detail maar je onderscheidende functie**; als we ze de als-dan-structuur geven (voorstel 5) is er niets vergelijkbaars op de markt.

**2. Lokaal opslaan is voor een deel van de markt een reden om níet voor de grote tools te kiezen.** Terugkerend geluid: *"I just don't feel comfortable handing over every detail of my strategy to any online platform — especially the free ones."* SyncJournal is lokaal-eerst; dat is geen technische keuze meer maar een verkoopargument.

**3. De afhaak-curve is exact benoemd**: flexibiliteit → te veel bouwen → onderhoud kost meer dan het oplevert → men stopt met bijhouden. De twee strategieën die volgens gebruikers wél overleven: radicaal versimpelen, of automatisch importeren zodat alleen het denkwerk overblijft. Letterlijk: *"If it takes too long to log trades or review them, I just stop doing it, no matter how good the features are."* Dat is het sterkste argument voor voorstel 1, 2 en 4.

Twee ideeën uit die hoek die het waard zijn om te lenen:

- **Overtuiging vóór én na de trade** (1-10). Eén trader gebruikt dat verschil om zijn trades in te delen in "vermijden", "uitbuiten" en **"overmoed"**. Jouw poort geeft al een A/B-oordeel; één getal erbij maakt zichtbaar wanneer je jezelf overschat.
- **Een korte eindedag-checklist** naast je dagstart: *positiegrootte gerespecteerd · niet revenge getraden · alleen A/B-setups genomen · gestopt op mijn daglimiet · alle trades nagekeken.* Vijf vinkjes die je dag afsluiten en meteen de nalevingsscore voeden.

Eén waarschuwing uit hetzelfde onderzoek, die precies past bij wat jij wilt bouwen: *"Been through a lot of them over 5 years. Excel, Notion, TradeZella, TraderSync. They all track the same stuff. Good for record keeping but none of them helped me figure out WHY I kept making the same mistakes."* Dat is de lat: niet nog een logboek, maar iets dat het patroon benoemt.

---

## 4d. Wat gebruikers zélf zeggen (28 discussielijnen + de 1- en 2-sterrenrecensies)

De laatste onderzoekslijn keek niet naar wat tools beloven, maar naar waar gebruikers over klagen: ~28 draadjes op trader-fora plus de gefilterde negatieve recensies van TradeZella, TraderSync, TradesViz en Edgewonk. Drie dingen komen er onafhankelijk van elkaar steeds weer uit.

**1. De plan-laag is precies het onderdeel dat het minst vertrouwd wordt.** Niet omdat hij ontbreekt, maar omdat hij instelwerk is dat nooit iets teruggeeft. Een recensie vat het samen als: *"every other 'feature' like strategies or plans are useless."* Bij één tool bleken zelfs de ingestelde regels regelmatig niet op te slaan — maandenlang niet opgelost. De oorzaak is structureel: een playbook is daar een etiket dat je achteraf opplakt, dus het kan de trade niet meer beïnvloeden.

**2. De luidste onvervulde wens is vóór de trade, niet erna.** Twee verschillende mensen in twee verschillende draadjes formuleren het bijna identiek: *"you need enforcement, not information"* en *"if it waits until after the trade, it's basically a receipt."* Waarschuwingen op het moment zelf worden expliciet waardeloos genoemd — *"you will click through it and tell yourself this one is different."*

Dat is tegelijk de nuance die ons plan bevestigt én bijstelt: een journal kan een order niet tegenhouden, dus onze winst zit in het moment **vóór de sessie** (het dagplan en de poort, waar nog niets te onderhandelen valt) en in het **achteraf zichtbaar maken van wat je wegklikte** (voorstel 17). Wat gebruikers zelf als oplossing noemen is exact jouw model: *"making the decisions before I was in the trade, so once I'm in, there's nothing to negotiate."*

**3. Wat mensen doet opzeggen zijn geen ontbrekende functies maar foute cijfers.** De negatieve recensies gaan vrijwel allemaal over verkeerde P&L, verdwenen sluitingen, vastlopende koppelingen en automatische labels die de statistiek vervuilen. Eén voorbeeld dat het hele probleem vangt: een tool toonde een gemiddeld verlies van $4.500 in plaats van $160, doordat hij de som in het gemiddelde-veld zette. Dit is waarom niemand playbook-statistiek vertrouwt: de basiscijfers kloppen al niet. Voor ons betekent het dat de integriteitscontroles waar we net veel tijd in staken geen bijzaak zijn maar het fundament van deze hele feature.

**Wat verder opvalt, kort:**
- **De ochtendpagina is wat journaling doet beklijven.** Steeds opnieuw genoemd als de enige gewoonte die bleef: *"the morning prep page is what I use most… yesterday's context is right there: what worked, what I said I'd focus on today."* Dat is voorstel 4, en het verdient meer aandacht dan ik het eerst gaf.
- **Prijs en opzegbaarheid zijn een open zenuw.** Geen proefperiode, jaarcontracten, geweigerde terugbetalingen, abonnementen die na opzegging doorlopen. Plus de moat die iedereen haat: *"I'd lose 3 years worth of data if I change."* Jouw één-klik-export is daar het directe antwoord op, en lokaal-eerst is een argument dat mensen uit zichzelf aandragen: *"data privacy was important for me."*
- **Twee dingen waar wij toevallig al goed zitten:** meerdere accounts naast elkaar (elders *"one trader, one account"* en daarmee onbruikbaar voor prop-accounts) en partiële sluitingen die als één trade blijven tellen (elders een klassieke klacht).
- **Twee echte gaten die ook wij niet dichten:** invoer op de telefoon (*"desktop tools squeezed onto a phone"*) en een geschiedenis van je stop- en TP-verplaatsingen — iemand ontdekte pas via die log dat hij zijn stop structureel opschoof.
- **Statisch versus je eigen normaal.** Een scherpe kanttekening bij daglimieten: die gaan pas af als de dag al verloren is. *"Build it around the deviation from the trader's own normal, not a static rule. That's the gap nobody fills."* Dat is precies waar voorstel 12 op mikt.

**Eén waarschuwing over de bron:** deze draadjes zitten vol met mensen die hun eigen tool promoten, en de negatieve recensies zijn bewust gefilterd — ze zijn een minderheid van het totaal. Ik heb klachten zwaarder gewogen naarmate de schrijver niets te verkopen had, en de patronen hierboven komen in meerdere onafhankelijke bronnen terug.

---

## 5. Wat ik zou laten zoals het is

- **De 7 poort-checks.** Kort, binair, met twee harde stops — precies goed. Niet uitbreiden.
- **A/B/C met vaste risicopercentages.** Deze koppeling is je sterkste ontwerp.
- **Regelbreuk loggen zonder blokkade.** Blokkeren zou de eerlijke data kapotmaken.
- **De dagstart-checklist van 14 items** — lang, maar het is een voorbereidingsritueel, geen beslismoment. Wel de invul-wrijving verlagen (voorstel 4).

Uit het onderzoek, ter bevestiging van wat je níet moet doen: plannen langer maken, regels toevoegen na elke slechte sessie, vage formuleringen ("ik beheer mijn risico gepast"), en P&L als dagscore gebruiken.
