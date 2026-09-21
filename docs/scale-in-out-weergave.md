# Een positie met meerdere entries en exits tonen — onderzoek en advies

**Datum:** 21-09-2026
**Aanleiding:** Denny's OKX-short 3809943469299781632. Eén positie, twee entries, vier afbouwstappen waarvan één in winst, en middenin een bijshort. De journal toonde er één gemiddelde instap van — zijn vraag: *"elke stap moet duidelijk zichtbaar zijn. Hoe doen anderen dit?"*

---

## 1. De casus

| tijd | actie | grootte | prijs | positie na | Ø entry op dat moment | P&L |
|---|---|---|---|---|---|---|
| 20-09 03:51 | sell | 38 cont | 81.008,90 | 38 | 81.008,90 | — |
| 20-09 03:51 | sell | 13 cont | 81.011,70 | 51 | 81.009,61 | — |
| 20-09 04:45 | buy | 25 cont | 80.378,50 | 26 | 81.009,61 | **+1,58** |
| 20-09 18:38 | buy | 13 cont | 81.403,10 | 13 | 81.009,61 | −0,52 |
| 20-09 21:08 | sell | 39 cont | 81.055,10 | **52** | **81.020,99** | — |
| 21-09 03:22 | buy | 39 cont | 82.032,90 | 13 | 81.020,99 | −3,86 |
| 21-09 19:39 | buy | 13 cont | 85.888,60 | **0** | — | −6,30 |

De exchange vat dit samen als één regel: gemiddelde instap 81.029, gemiddelde uitstap 82.039, netto −9,76.

Het interessante: **close #1 was winstgevend, #2 t/m #4 niet** — en dat is pas te begrijpen als je ziet dat de bijshort om 21:08 het gemiddelde omhoog schoof.

---

## 2. Hoe de markt het doet

Er bestaan maar twee datamodellen:

- **Execution-first** — fills zijn atomair, een "trade" is een groep fills volgens een expliciete groeperingsregel. Tradervue, TradesViz, TraderSync, Chartlog, CoinMarketMan, Trademetria.
- **Manual-parts** — de trader typt zelf entry- en exit-delen met een open-quantity-teller. Edgewonk.

| Product | "Trade" = | Groepering | Entry bij multi-fill | Stappentabel | Schaal-analyse | Plan los van uitvoering |
|---|---|---|---|---|---|---|
| **Tradervue** | *"group of executions"* | kantwissel + tijdvenster | **eerste/laatste fill** | ja, bewerkbaar | alleen laatste exit-groep | niet gevonden |
| **TradeZella** | broker-import | Split/Merge via Bulk Actions | gewogen gemiddelde | ja ("Execution"-tab) | nee | **ja — PT1/2/3 met prijs + aantal** |
| **TraderSync** | executions → trade | "Normal" (1 uur) of "Split When Possible" | toggle gewogen/ongewogen | ja, met Split | **Rolling Exit Analytics** | "+ Add Target", koppeling onbekend |
| **Edgewonk** | trade + "parts" | handmatig tot open qty = 0 | gemiddelde | ja (popup) | Trade Management | **expliciet nee** — 1 SL + 1 TP |
| **TradesViz** | groep executions | **flat-position + symbol** | blended | ja, "executions table" | **First vs Last Exit PnL** | onbekend |
| **Trademetria** | executions → trade | tot positie vlak is | gewogen, per fill herrekend (hard-coded, geen keuze) | ja, kop **FILLS** | nee | 1 SL + 1 target |

Aanvulling op TraderSync: die bewaart entry- én gemiddelde prijs als **losse kolommen** (zie advies hieronder). Hun split-functie is bovendien eerlijk over de prijs ervan — beide helften worden weer open gezet en de gerealiseerde P&L reset, en de gebruiker moet dat expliciet bevestigen vóór *"Split anyway"*. Dat transparantieniveau hoort erbij als hier ooit een split- of samenvoegknop komt.

### Drie bevindingen die ertoe doen

**Niemand splitst een geschaalde positie in losse regels.** Elk onderzocht product groepeert tot de positie vlak staat. De uitzondering is een *handmatige* split-knop.

**Op het samenvattingsgetal splitst de markt.** Tradervue toont bewust de prijs van de eerste en laatste fill. TradeZella, Edgewonk, StonkJournal, CoinMarketMan en Trademetria tonen een gewogen gemiddelde. TraderSync heeft er een toggle voor — inclusief een rekenkundig onjuiste ongewogen variant.

**Niemand koppelt geplande TP-niveaus per niveau aan werkelijke closes.** TradeZella komt het dichtst: *"Add partial PT"* met PT1/PT2/PT3 (prijs + aantal) en daarnaast **Planned R-Multiple** tegenover **Realized R-Multiple** — maar alleen als totaal, niet per niveau. Edgewonk sluit meerdere niveaus expliciet uit: *"Every trade can only have one stop loss and take profit."*

### De enige echte schaal-analyse

TradesViz, onder de kop *"The Scaling Question: Is Scaling In/Out Actually Helping You?"*:

> *"Last Exit PnL simulates moving your final execution (total blended position) to a different point; First Exit PnL isolates just your initial entry, ignoring all subsequent scale-ins."*

Met een waarschuwing die precies op deze casus slaat: een "wat als ik had vastgehouden"-getal is bij een geschaalde positie **dubbelzinnig** tenzij je erbij zet vanaf welke basis je rekent. Zij mengen die twee nooit op dezelfde as.

---

## 3. Wat traders zelf zeggen

De twee klachten zijn **niet symmetrisch**.

Over journals die een positie **opsplitsen** is de kritiek scherp en talrijk:

> *"A lot of journals and spreadsheets treat each fill as a separate trade which makes scaled positions a mess to review."*
> *"I would count your partials and remainder as one trade otherwise you are skewing your win rate higher."*

Over **wegmiddelen** bestaat wel ongemak, maar als onbeantwoorde vraag, niet als woede:

> *"I'm a trader-in-training… How do you record scaling in and out of a trade in your journal?"* — onbeantwoord
> *"Partial lots are my biggest hurdle in my spreadsheets right now."*

En over de vraag óf uitschalen slim is, bestaat **geen consensus**: een peiling op Elite Trader met 801 stemmen komt uit op 43% wel, 57% niet. De scherpste observatie daaruit:

> *"Scaling out almost always reduces total net profit, whilst also smoothing the equity curve, increasing the winning percentage and reducing the drawdowns."*

Dat betekent dat één cijfer per definitie liegt over iemand die uitschaalt: win-rate vleit hem, netto resultaat straft hem. Een journal moet ze dus altijd samen tonen en geen kant kiezen.

### Woordkeuze

| Concept | Gebruik | Vermijd |
|---|---|---|
| atomaire regel | **fill** | *order* (één order kan meerdere fills zijn) |
| erbij kopen | **add** | *scale in* zonder uitleg — wordt gelezen als "toevoegen aan een winnaar", niet als bijkopen in verlies |
| deels sluiten | **partial** | — |
| restpositie | **runner** | — |
| samenvattingsgetal | **average entry** | *blended* |
| de stappenlijst | **execution timeline** | **"legs"** (bezet door opties) en **"layers"** (al in gebruik in deze codebase) |

---

## 4. Advies

### Eén positie blijft één trade
Niet onderhandelbaar. Splitsen vervuilt de win-rate, en in een community waar partial closes de standaard zijn maakt dat élke statistiek onbruikbaar. Wel een aanduiding op de rij: **2 entries · 4 exits**, zodat zichtbaar is dat er iets onder zit.

### Bewaar béide prijzen — dat is geen keuze die je hoeft te maken

Eerst dacht ik: gewogen gemiddelde, want dan komt het getal overeen met wat OKX zelf toont. Maar TraderSync laat zien dat het een vals dilemma is; zij bewaren vier losse velden:

> *"Entry Price: Price of the initial entry order."* · *"Avg Entry: Average price across all entry executions."* · *"Exit Price: Price of the first closing execution."* · *"Avg Exit: Average price across all closing executions."* · *"Executions: Count of individual executions within the trade."*

Dat is bruikbaarder dan één getal: **je eerste instap náást je gemiddelde laat precies zien hoeveel een bijkoop je gemiddelde heeft verschoven** — in deze casus 81.008,90 tegenover 81.020,99. Precies het getal dat nu ontbreekt.

Advies: sla `entryPrice`, `avgEntry`, `exitPrice`, `avgExit` en het aantal fills apart op. Toon **avgEntry** als hoofdgetal (blijft matchen met OKX), de eerste instap ernaast of in de uitgeklapte tijdlijn. Let op: TraderSync's "Exit Price" is de **eerste** close, terwijl Tradervue de **laatste** neemt — kies bewust en zet er een eenduidig label bij.

Nog een les, van Trademetria, die openlijk opschrijft waarom hun cijfer soms afwijkt van dat van de broker:

> *"we use the average weighted prices methodology because it provides a distinct speed advantage over the other methods"*

Zij documenteren dat expliciet om supportvragen vóór te zijn. Dezelfde aanpak is hier verstandig: zet in de FAQ welke methode de journal gebruikt en waarom hij van je exchange kan afwijken.

### Een uitklapbare execution timeline — dit is de kern

```
Tijd | Kant | Aantal | Prijs | Positie na | Ø entry op dat moment | Fee | P&L | R
```

Die kolom **Ø entry op dat moment** heeft geen enkel onderzocht product, en hij is precies wat deze casus leesbaar maakt: hij laat zien dát en wannéér de bijshort het gemiddelde verschoof, en dus waarom de eerste close winst pakte en de latere niet. Zonder die kolom blijft "één winst, drie verliezen tegen één gemiddelde entry" onverklaarbaar.

Daaronder een **stapgrafiek van de positiegrootte over tijd**. Geen van de onderzochte producten heeft dat, en met de positie-na-waarde is het bijna gratis.

### Plan en uitvoering strikt gescheiden — dit is het gat in de markt

De TP-niveaus blijven **je plan**. De stappen zijn **wat er gebeurde**. Per gepland niveau vier statussen:

| Status | Betekenis |
|---|---|
| **Hit** | een close valt binnen de tolerantie van dit niveau |
| **Deels** | er is gesloten, maar minder dan gepland |
| **Gemist** | niveau nooit gehaald, of gehaald en niet uitgevoerd |
| **Ongepland** | een close die op geen enkel niveau matcht |

Die laatste is de belangrijkste én de gevoeligste. In deze casus waren drie van de vier closes verliesgevend en vrijwel zeker ongepland — precies het gedrag dat een journal hoort te tónen in plaats van te verstoppen. **Nooit stilletjes een verliesclose aan een TP-niveau plakken.** Bij twijfel: ongepland, en laat de trader zelf koppelen.

Daarnaast Edgewonks **OTP**-vlag, goedkoop en los bruikbaar: *"Did the price hit the Original Take Profit price before it hit the initial stop loss?"* Eén ja/nee die "was mijn plan goed?" beantwoordt, los van "heb ik het gevolgd?".

### Later: hielp het schalen?
First Exit PnL tegenover Last Exit PnL, plus een derde die hier het meest zegt: *alles vastgehouden tot de laatste exit*. Met de basis altijd expliciet in het label, anders is het getal onzin.

---

## 5. Wat dit raakt in de huidige code

- `tradeTimeline()` bestaat al (Open → TP-hits → Close → duur) en wordt gebruikt in het Review-detail en de hover-uitklap. **De weergave is er dus al; de data ontbreekt.**
- Elke stap in die tijdlijn heeft een tijdstempel (`ts`) nodig. Handmatig ingevoerde TP's krijgen die; **door een koppeling aangeleverde TP-niveaus niet** — daardoor tonen ook Kraken-trades vandaag alleen Open → Close. Eén fix helpt beide.
- De OKX-adapter heeft **geen** `fetchFills`; in de code staat letterlijk *"Fase 2 (nog niet geport): TP-backfill via fetchFills"*. De Worker kán de fills al leveren (`action: 'fills'`, met instId en tijdvenster).
- Er is nog geen enkel veld dat afbouwstappen modelleert.

## 6. Volgorde van bouwen

1. `fills[]` op de trade + `fetchFills` in de OKX-adapter, met tijdstempel per stap.
2. De execution timeline in het trade-detail, inclusief positie-na en Ø entry.
3. Plan-vs-uitvoering met de vier statussen.
4. Stapgrafiek en de schaal-analyse.

Stap 1 en 2 leveren samen het antwoord op de oorspronkelijke vraag; 3 is de onderscheidende functie; 4 is luxe.
