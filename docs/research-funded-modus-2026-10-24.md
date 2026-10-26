# Onderzoek: funded-modus (prop-firm challenges) voor SyncJournal

**Datum**: 24-10-2026
**Status**: onderzoek, geen code. Voorstel om met `/grill-me` door te lopen voordat er gebouwd wordt.
**Vraag**: hoe gaan andere journals en de prop firms zelf om met challenges en funded accounts, en hoe
bouwen we dat in SyncJournal zo dat (1) funded geld je eigen balans en P&L niet scheeftrekt, (2) de
trades wél meetellen in strategie- en playbook-analyse, (3) je per firm meerdere challenges kunt hebben
die je haalt, verliest of later kwijtraakt, en (4) de journal na een CSV-import zelf het juiste account kiest.

## Samenvatting

1. Bijna alle journals zetten **een fase op een eigen account**. Een challenge is dan een container met
   slots: fase 1, fase 2 en funded. Zo doen TradeZella (stap-slots) en TradesViz (een profiel per fase)
   het. FTMO werkt zelf ook zo: voor elke nieuwe fase krijg je nieuwe inloggegevens.
2. De journals die het goed doen, houden **twee boekhoudingen** naast elkaar. De trading-P&L draait op
   gesimuleerd kapitaal. Het echte geld zit in de kosten (fee, reset, activatie) en de uitbetalingen. Het
   resultaat daarvan heet "spent vs earned / net / ROI". TradeZella en Tradesyncer werken zo.
3. TradesViz boekt fees als storting en uitbetalingen als opname *op het funded account zelf*. Daardoor
   loopt gesimuleerd geld door je equity-curve. Dat is precies wat Zaratras niet wil.
4. Regels worden overal als **sjabloon per firm** vastgelegd: dagverlies, max drawdown (statisch, EOD-trailing,
   intraday-trailing of trailing tot een lock), winstdoel, minimum handelsdagen en consistentie. Firms die
   niet in de lijst staan vul je zelf in.
5. Een status die de journal automatisch uit trades berekent, werkt alleen met realtime equity. FTMO meet het
   dagverlies op equity *inclusief open posities*, en Topstep liquideert intraday op ongerealiseerde P&L.
   Uit een CSV met gesloten trades kun je een breach dus niet betrouwbaar vaststellen.
6. Regels veranderen snel. FTMO verving op 12-10-2026 de Best Day-regel door een consistentieregel. Een
   lijst met voorinstellingen veroudert dus en kost onderhoud.
7. Accounts koppelen gaat **op accountnummer** waar dat in de data staat (Deltalytix: `accountNumber` per trade,
   uniek per gebruiker), en anders door bij elke import te vragen (TradeZella bij FTMO-upload, Tradervue "account tag
   verplicht").
8. De MT5-report (HTML/XLSX) bevat in de kop het **accountnummer en de broker/firm**. De FTMO MetriX-CSV die SyncJournal nu
   inleest bevat **geen** login. Daarom is de kolomvolgorde van het bestand alleen genoeg om de firm te herkennen,
   niet de challenge.
9. In SyncJournal komen FTMO-trades nu binnen als `t.exchange='ftmo'`. Daar hoort geen account bij, maar ze
   tellen wel mee in elke P&L-som en in de reconstructie van de %-basis. Dat trekt de cijfers nu al scheef.
10. **Aanbeveling: optie B**, in twee stappen. B1 geeft accounts een "funded"-vlag die ze uit balans, geld-P&L
    en de %-basis haalt (de strategie-analyse houdt ze), plus een accountkeuze bij de import. B2 voegt een
    challenge-laag toe met fases, status, kosten en uitbetalingen, en rekent het resultaat "eigen geld uit prop"
    als uitbetalingen min kosten. Regels komen er als doelen met een *indicatieve* voortgang, zonder automatische breach.

---

## 1. Bronnen en betrouwbaarheid

Per bewering staat de bron erbij. Het soort bron loopt sterk uiteen, daarom heeft elke bron een label:

- **[P]** primair: de eigen site, help-center of broncode van de partij zelf
- **[V]** de eigen marketing van een journal (claims, niet nagelopen in het product)
- **[S]** secundair: een review- of concurrentensite (vaak met commercieel belang, zoals Tanto en TradeZella-blogs over anderen)

Wat niet te vinden was staat er expliciet bij als "onbekend". Niets is in een echt product of met een
echte export getest. Inloggen bij journals of firms kon niet.

---

## 2. Hoe de prop firms het zelf doen

| Firm | Fasen | Regels (kern) | Wat gebeurt er bij halen / falen | Kosten en uitbetaling |
|---|---|---|---|---|
| **FTMO** 2-Step | Challenge → Verification → FTMO Account | Winstdoel 10% / 5%; dagverlies 5% van Initial Simulated Capital, herberekend om 00:00 CE(S)T, op equity incl. open posities; max loss **statisch** 10%; min. 4 handelsdagen (dag = minstens één positie geopend) [P1] | Na halen: review 1-2 werkdagen, daarna **nieuwe inloggegevens** voor Verification; na Verification review 1-4 werkdagen, identiteit, dan "we may provide you with the FTMO Account" [P2][P3] | Fee wordt terugbetaald bij je eerste reward-opname [P4] |
| **FTMO** 1-Step | Challenge → FTMO Account | Winstdoel 10%; dagverlies 3%; max loss **EOD-trailing** 10%; consistentie: beste dag ≤ 50% van totale winst (vervangt Best Day voor orders vanaf 12-10-2026) [P1] | Review 1-4 werkdagen [P2]. Bij een reward-opname reset de max-loss-grens naar 90% van het startkapitaal [P1] | Fee wordt **niet** terugbetaald [P4] |
| **Topstep** | Trading Combine → Express Funded Account → Live Funded Account [P5] | Maximum Loss Limit trailt op het eindsaldo van de dag, gaat nooit omlaag, en staat vast zodra hij het startsaldo bereikt; de breach-check is **intraday incl. ongerealiseerde P&L** [P6] | Combine-breach: liquidatie, account komt pas na een reset weer in aanmerking. **XFA-breach: account definitief gesloten** [P6]. "Back2Funded": een account heractiveren na een slechte dag [P5] | 90% profit split; Live-uitbetalingen na 30 winstdagen van ≥ $150 [P5] |
| **The5ers** Hyper Growth | 1 evaluatie → Pro-levels die opschalen bij elke +10% [P7] | Stop-out 6%; dagverlies 3% [P7]; "Daily Pause is not the same as a daily-loss fail, but stop-out can still terminate the account" [S1]; geen minimum dagen voor level 1 [P7] | Account vervalt na 30 dagen inactiviteit [P7] | Split oplopend van 75% tot 100% met de accountgrootte [P7] |
| **Breakout** (crypto, Kraken-groep) | 1-Step (Turbo/Classic/Pro) of 2-Step [S2] | 2-Step: max drawdown 8% **trailing** vanaf de hoogste balans; dagverlies en max drawdown gelden tegelijk, raak je een van beide dan breach je [P8]. Geen minimum dagen, geen consistentieregel [S2] | onbekend | Uitbetaling op aanvraag in USDC; split 80%, met add-on 90%; fee $35-$1.399 [S2]. Alleen via de Breakout Terminal [S2]; geen publieke API (eigen onderzoek 14-10-2026) |

**Wat SyncJournal hieruit moet onthouden:**
- **Een fase is een nieuw account met een nieuwe login** (FTMO [P3]). Een challenge is dus een *reeks* accounts, geen enkel account dat van status wisselt.
- **"Kwijtraken" komt in drie soorten**: falen in de evaluatie, een funded account dat na een breach sluit (Topstep XFA [P6]), en een pauze of heractivering (The5ers daily pause, die geen fail is [S1]; Topstep Back2Funded [P5]).
- **Kosten zijn soms terug te krijgen**: FTMO betaalt de 2-Step-fee terug bij de eerste uitbetaling [P4]. Een geldboekhouding heeft dus naast kosten en uitbetalingen ook een **terugbetaling** nodig.
- **Regels lopen per firm, per programma en zelfs per besteldatum uiteen** (FTMO 12-10-2026 [P1]). Voorinstellingen verouderen.

---

## 3. Hoe journals het doen

### 3.1 Vergelijkingstabel

| Journal | Hoe ze een challenge modelleren | Statussen | Regels | Voortgang | Uitbetalingen en kosten | Eigen vs funded geld | Koppeling bij import |
|---|---|---|---|---|---|---|---|
| **TradeZella** (PropFirm Sync) | Een challenge (bijnaam, firm, programma) met **slots per stap**: Step 1, Step 2, Funding. Elk slot hangt aan een TradeZella-account, een bestaand of een automatisch nieuw [P9] | Fase: Evaluation / Funded; status: Active / Breached; tab met "every evaluation, funded, and breached account" [P9][P10] | Per stap: min. handelsdagen, periode, winstdoel, max dagverlies, max drawdown **Static / EOD / Trailing**, optioneel best-day-consistentie; "Same rules as Step 1" [P9]. Regels van bekende firms worden automatisch ingevuld [P9] | "Real-time distance to profit target, drawdown levels, and trading days remaining" [V1] | Evaluatie-fee, reset, activatie en uitbetaling als transacties; automatisch via Plaid, ook handmatig [P10]. Dashboard: Net P&L, ROI, spent vs earned, pass rate per firm/type/grootte, faalredenen [P10][V1] | Een **apart geldoverzicht** (spent/earned/net) naast de trade-P&L. Of funded P&L uit de algemene cijfers blijft: onbekend [P10]. Advies: elke trade aan zijn account, en statistiek per account en gecombineerd [V2] | MT5-sync op login, investor-wachtwoord en server; je kiest een bestaand account of "Create New Account" [V3]. FTMO-CSV: je kiest het doelaccount en de tijdzone van het bestand [P11] |
| **TradesViz** | Een **profiel per fase** (Phase 1, Phase 2/Verification, Funded) op een trading-account; het actieve profiel geldt [V4] | ACTIVE / PASSED / FAILED; een breach zet het profiel op FAILED, met reden en datum [V4] | Startsaldo, max drawdown + type (**trailing EOD, trailing intraday, static, trailing-to-static lock**), dagverlies, winstdoel, min. dagen, consistentie-%, payout-buffer, commissies; 20 firms / 65 configuraties ingebouwd, eigen profielen sinds juni 2026 [V4] | Compliance-dashboard met 9 widgets (buffer-meter, winstdoel, dagverlies, consistentie, dagen); grafiek met balans, trailing floor en buffer; "Payout Readiness" [V4][V5]. Achteraf ook: je historie langs de regels van een firm leggen [V4] | Fees als **storting** en uitbetalingen als **opname** in de equity-curve van het account [V4] | Fees en uitbetalingen lopen door de equity-curve en het rendement van het account, dus gesimuleerd en echt geld lopen door elkaar [V4]. Een overzicht van meerdere accounts geeft totalen en een kaart per account [V5] | Per sync-verbinding of upload kies je het TradesViz-account; advies: een apart account per Tradovate-subaccount [V6]. FTMO: kies de MT5-server (FTMO-Demo, FTMO-Server…) [V7] |
| **Deltalytix** (open source) | `Account` met prop-velden (`propfirm`, `evaluation`, `startingBalance`, `drawdownThreshold`, `trailingDrawdown`, `profitTarget`, `dailyLoss`, `consistencyPercentage`, `minDays`, `resetDate`, `activationFees`, `price`…) plus `Group` om accounts te bundelen [P12] | `evaluation` (boolean); geen expliciete fase-keten [P12] | Zie velden; ook `buffer`, `minPnlToCountAsDay`, `shouldConsiderTradesBeforeReset` [P12] | onbekend | Eigen tabel `Payout` (bedrag, datum, status, `propfirmSharingPercentage`); `price` en `activationFees` op het account [P12] | Een uitbetaling is een apart record, geen trade [P12] | **Een trade draagt `accountNumber` (string) uit de import; het account is uniek op `(number, userId)`** [P12] |
| **Tradesyncer** (Prop Firm Expense Tracker, geen journal) | Een account per aankoop; **een reset = een nieuw account**, het oude zet je op Breached [P13] | Active / Passed (alleen bij evaluatie) / Breached [P13] | geen | geen | Eén aankoop per account, activatie alleen bij funded, uitbetalingen onbeperkt maar **niet bij evaluatie**; uitbetalingen verlagen "spent" niet [P13] | Alleen geld, geen trades | n.v.t. |
| **Tanto** | Accounts met eigen commissieschema, samen te nemen in groepen [S3] | onbekend | onbekend | Statistiek en equity-curve per account [S3] | onbekend | Accountkiezer filtert de hele app (één account, een groep of alles); "hidden trades" tellen niet mee in de statistiek [S3] | Bij Rithmic kies je de firm in een lijst [S3] |
| **FX Replay** | Een sessie in de simulator, geen echt account [P14] | Challenge Failed (sessie op slot) / certificaat bij halen [P14] | Winstdoel, max drawdown, dagverlies, min. dagen [P14] | Equity-curve met de lijnen van doel en drawdown [P14] | n.v.t. | n.v.t. (oefenen) | n.v.t. |
| **Edgewonk** | Geen eigen model; je zet accounts in "unlimited journals" uit elkaar, "no native concept of a combine versus a funded account" [S4] | geen | geen | geen | geen | Aparte journals, dus de statistiek raakt ook versnipperd | Alleen MetaTrader als automatische route, de rest via bestanden; "do not document an exact prop-program rule engine" [S5] |
| **Tradervue** | Geen; meerdere accounts via **account tags** (Silver/Gold) [P15] | geen | geen | geen | geen | Filteren per tag of alles samen [P15] | Zonder tag voegt Tradervue trades per symbool samen tot één positie; optie "Always require me to select a Account Tag" bij import [P15] |
| **TraderSync** | Niets gevonden; "does not advertise prop firm-specific features" [S6] | – | – | – | – | Accountlimiet per abonnement [S6] | – |
| **Journalytix** (Jigsaw) | "Evaluation and funded accounts supported" voor Rithmic/Tradovate-firms; groepen en "risk views" zijn voor firms en coaches [P16] | onbekend | Alleen "what if"-test op je eigen dagverlies [P16] | – | – | Filter per account [P16] | – |
| **Chartlog** | Geen; alleen Amerikaanse aandelen en opties [S7] | – | – | – | – | – | – |
| **Kinfo** | Geen; homepage noemt alleen "Verified Trading Performance" via broker-koppeling [P17] | – | – | – | – | – | – |
| **Trademetria** | Geen; "has no prop firm-specific features"; meer dan één account alleen in Pro (50) [S8] | – | – | – | – | – | – |

### 3.2 Patronen

**P1: Challenge = container, fase = account.** TradeZella (slots), TradesViz (profiel per fase) en
FTMO zelf (nieuwe login per fase) wijzen allemaal dezelfde kant op [P9][V4][P3]. Het mooie daaraan:
de trades van één fase staan nooit op hetzelfde account als die van een andere fase. Voortgang per fase
reken je dan gewoon uit de trades van dat account.

**P2: Twee boekhoudingen.** Trading-P&L op gesimuleerd kapitaal is voor de analyse. Echt geld bestaat
alleen uit fees, resets, activatie, uitbetalingen en terugbetalingen. TradeZella toont die
als "total spent vs total earned, net, ROI" [V1][P10], Tradesyncer houdt alleen dat bij [P13], Deltalytix
maakt van uitbetalingen een eigen tabel [P12]. **Dit past precies op Zaratras' wens** dat de winst pas van
hem is bij uitbetaling.

**P3: Regels als sjabloon.** Overal dezelfde set: winstdoel, dagverlies, max drawdown met type,
min. dagen, consistentie, soms een payout-buffer [P9][V4][P12]. Vier drawdown-typen zijn het minimum om
FTMO (statisch / EOD-trailing), Topstep (EOD-trailing met lock) en Breakout (trailing) te dekken [P1][P6][P8].

**P4: Statussen.** Grootste gemene deler: *Active*, *Passed*, *Breached/Failed* [P13][V4]. TradeZella
zet daar de fase (Evaluation/Funded) los naast [P9].

**P5: Reset = nieuw account.** Tradesyncer schrijft dat expliciet voor [P13]. Dat past bij P1: na een reset start
de meting opnieuw, met een nieuw startsaldo.

**P6: Koppelen op accountnummer, anders vragen.** Deltalytix legt het nummer uit de import op elke trade [P12].
TradeZella koppelt MT5 op login en server [V3], en vraagt bij een upload altijd om een doelaccount [P11]. Tradervue maakt een tag
verplicht, omdat accounts anders samengevoegd worden [P15].

**P7: Statistiek per account én gecombineerd.** TradeZella adviseert beide ("profit factor on NQ across all
accounts combined") [V2]. Tanto en Deltalytix gebruiken groepen [S3][P12]. Edgewonk laat zien wat er misgaat
zonder dit: aparte journals versnipperen je strategie-statistiek [S4].

### 3.3 Wat werkt en wat niet

**Wat werkt**
- Een apart geldoverzicht voor alles rond prop (P2). Het is eenvoudig, het klopt altijd (bedragen voer je in of komen
  van de bank), en het geeft het antwoord dat een trader wil weten: "verdien ik geld met prop?".
- Een fase als eigen account (P1). Status en voortgang blijven eenduidig, en een import kun je op login koppelen.
- Statistiek over alle accounts heen met een filter per account of groep (P7).
- Een tijdzone-keuze bij de import (TradeZella [P11]). FTMO telt dagen in CE(S)T [P1], en de handelsdagen en het dagverlies hangen daaraan.

**Wat niet werkt of veel kost**
- **Een automatische breach uit gesloten trades.** FTMO rekent het dagverlies op equity met open posities [P1], en
  Topstep liquideert intraday op ongerealiseerde P&L [P6]. Een journal die alleen gesloten trades uit een CSV
  ziet, kan "gehaald" of "gefaald" dus niet hard vaststellen. TradesViz doet het toch [V4], maar die heeft live sync.
  Voor SyncJournal (alleen CSV voor FTMO en Breakout) zou dat schijnzekerheid geven.
- **Een catalogus met voorinstellingen per firm.** TradesViz heeft 65 configuraties [V4]. FTMO veranderde in oktober 2026
  zijn regels per besteldatum [P1]. Voor een eenmansproject is dat te veel onderhoud.
- **Fees en uitbetalingen boeken op het funded account** (TradesViz [V4]). Dan staan gesimuleerde winst en echte kosten
  op één curve, en wordt je rendement onzin.
- **Accounts zonder tag of keuze laten samenvallen** (Tradervue standaard [P15]).

---

## 4. Accountinfo in de exports

| Bron | Wat staat erin | Zekerheid |
|---|---|---|
| **MT5 Trade History Report** (HTML, ook XLSX) | Kop: naam van de broker, **accountnummer**, naam van de eigenaar, valuta, datum van het rapport. Secties: Orders, Deals (met de totale gesloten P/L), Positions, Working Orders, Summary (balans, equity, margin), Details (statistiek) [P18] | [P]. De **server** noemt de help niet [P18]. In echte rapporten staat bij het accountnummer vaak "(valuta, server, demo/real, Hedge)", maar dat is **niet geverifieerd**; nalopen met een echte export van Zaratras |
| **MT5 Deals** | Balans-, credit- en bonusregels naast de trades (het parser-advies voor FTMO filtert die eruit, zie memory `project_ftmo_mt5`). De **eerste balansregel is het startkapitaal** en kan het accountformaat invullen | Eigen kennis plus memory; nalopen |
| **FTMO MetriX CSV** (de huidige parser) | Kolommen: Ticket, Open, Type, Volume, Symbol, Price, SL, TP, Close, Price, Swap, Commissions, Profit, Pips, Duration (`work/syncjournal.html`, de FTMO-tak in `parseExchangeCsvText`). **Geen login, geen server** | Uit onze eigen code. Of de bestandsnaam het accountnummer bevat is onbekend |
| **MetriX-scherm** | Accounttype (Challenge/Free Trial), grootte, platform, begin en eind van de periode, balans, equity [P19]; login en server staan onder *Credentials* [P20] | [P] |
| **MT5-sync bij andere journals** | Login (6-10 cijfers), investor-wachtwoord, server, broker [V3]; FTMO-servers heten FTMO-Demo, FTMO-Server … FTMO-Server5 [V7] | [V] |
| **Tradovate** | Orders- en Fills-export per account (instellingen per account); journals adviseren een apart journal-account per subaccount [V6] | Of er een "Account"-kolom in staat: **onbekend** |
| **cTrader** | Statement als HTML, Excel of CSV; kolommen kies je zelf [S9] | Accountnummer in de export: **onbekend** |
| **Breakout Terminal** | Geen export onderzocht; geen API (onderzoek 14-10-2026) | Wacht op een voorbeeld |

**Gevolg:** automatisch koppelen gaat pas echt als SyncJournal ook het **MT5-rapport** (HTML/XLSX) leest.
De XLSX-route bestond toen: `handleCsvFile` las `.xlsx` met SheetJS. *(Sinds v1.18.6, backlog C4, niet meer: een
Excel-bestand moet eerst als CSV opgeslagen worden. Een MT5-rapport lezen gaat dus via HTML of CSV.)* In het MetriX-CSV staat geen login,
dus daar moet de journal het account afleiden (zie §6.3) of erom vragen.

---

## 5. De huidige stand van SyncJournal (uit de code)

- FTMO-trades uit MetriX krijgen `source:'ftmo'`, en dat wordt `t.exchange='ftmo'` (`parseExchangeCsvText`, `OLD_EXMAP`).
  **`ftmo` staat niet in `EXCHANGES`**, dus `acctOf('ftmo')` geeft `null`: de trade hangt aan geen enkel account.
- Ze zijn `kind` live en tellen dus mee in alle P&L-sommen (`CLOSED`, dashboard, equity) **en** in `_pctBases()`. Die
  reconstrueert de accountgrootte per trade als *totale balans − alles wat daarna geboekt is*. Een funded winst van $5.000
  verlaagt zo de berekende basis van al je eerdere crypto-trades. Dat is de scheeftrekking die Zaratras bedoelt, en die zit er nu al in.
- Handmatige accounts (`MANUAL`) hebben een ledger met `deposit` / `withdrawal` / `correction` (`TX_TYPES`). Hun saldo
  (`manualBalance` = ingelegd + `acctPnl`) telt mee in `totalBalance()`.
- `STATE.pctRef` is één vast bedrag voor *alle* trades. De instelling zegt zelf "handig voor bijv. een prop-account",
  maar daarmee zet je ook je crypto-percentages op dat bedrag.
- `sjImportCsvText(text, forExchange)` kan een doelaccount meekrijgen, maar `handleCsvFile` geeft altijd `''` mee.
- `kind` (live / paper / backtest / gemist) zegt *of het echt gehandeld is*. Het standaardfilter `kindMatch` laat live zien.

---

## 6. Opties voor SyncJournal

### Optie A: funded-vlag op het account (minimaal)

Een account (in de praktijk een handmatig account, want FTMO en Breakout zijn alleen CSV) krijgt `funded:true`.
- **Wat het oplost:** trades op dat account vallen buiten `totalBalance`, buiten de geld-P&L op het dashboard en buiten
  `_pctBases`. In analytics, playbook, tendencies en review blijven ze gewoon staan, met hun R.
- **Geld:** twee nieuwe ledger-soorten, `fee` en `payout`, die *niet* het kapitaal van het account raken maar een
  regel "prop-resultaat = uitbetalingen − kosten" voeden.
- **Niet:** fases, status, regels, slimme import.
- **Kosten:** klein. Wel moet je elke geld-som langslopen (`totalBalance`, `acctPnl`, `_pctBases`, `pnlPctTotal`, dashboard-tegels, equity).
- **Risico:** "geld-som" versus "analyse-som" zit nu op tientallen plekken door elkaar. Je hebt één helper nodig
  (bijv. `isEigenGeld(t)`) in plaats van overal een losse check.

### Optie B: A + challenge-laag + slimme import (aanbevolen)

Bovenop A:
- **Challenge**-record met fases, waarbij **elke fase een eigen account is** (P1). Statussen per fase: *actief /
  gehaald / gefaald*, plus bij funded *actief / kwijt* (breach na funding) en *gepauzeerd*. Wat de status
  is bepaal je zelf; de journal stelt hem alleen voor.
- **Regels als doelen**, ingevuld per fase (winstdoel, dagverlies, max drawdown + type, min. dagen, consistentie), zonder
  catalogus. Bij hooguit FTMO 1-Step/2-Step komen er waarden *voorgesteld* bij, omdat Zaratras daar zelf handelt.
- **Voortgang indicatief** uit gesloten trades, met de tekst "op basis van gesloten trades, de firm meet op equity".
- **%-basis per account** = startkapitaal van de fase. FTMO meet zijn doelen ook op het Initial Simulated Capital [P1].
- **Slimme import** (§6.3).
- **Geldoverzicht** per challenge, per firm en in totaal: kosten, terugbetaling, uitbetalingen, netto, ROI, slagingspercentage (P2).

### Optie C: B + een regel-engine die automatisch beslist

Zoals TradesViz: met een catalogus per firm de status automatisch op gefaald of gehaald zetten.
**Niet aanbevolen.** De CSV bevat geen equity en geen open posities (§3.3), en het onderhoud van de catalogus is te groot.
Hooguit later, voor Breakout, *als* er ooit een API met equity komt.

### Optie D: een nieuwe `kind:'funded'` op de trade

Afgewezen. `kind` betekent "is dit echt gehandeld". Een funded trade is echt uitgevoerd. Het standaardfilter (`kindMatch` → live)
zou funded trades dan juist uit de strategie-analyse halen, en dat is het tegendeel van wat Zaratras wil. Bovendien hoort
"wiens geld" bij het account en niet bij de trade: alle trades van een FTMO-fase delen het.

### 6.1 Vergelijking

| | A | B | C | D |
|---|---|---|---|---|
| Balans en P&L blijven zuiver | ja | ja | ja | ja, maar op de verkeerde laag |
| Trades tellen mee in strategie | ja | ja | ja | **nee** (standaardfilter) |
| Meerdere challenges per firm, halen/falen/kwijt | nee | ja | ja | nee |
| Uitbetaling = pas dan je geld | ruw | ja, per challenge | ja | nee |
| Slim bij CSV-import | nee | ja | ja | nee |
| Onderhoud | laag | middel | **hoog** (regelcatalogus) | laag |
| Kans op een verkeerd cijfer | laag | laag (status zet je zelf) | **hoog** (breach uit onvolledige data) | middel |

### 6.2 Datamodel-schets (optie B)

Aansluitend op wat er is: `MANUAL` (localStorage `sj_manual`) houdt de accounts, trades blijven in IDB met `t.exchange`.

```js
// Handmatig account, uitgebreid. Bestaande velden blijven; alles nieuw is optioneel (migratie = niets doen).
{ id:'m…', name:'FTMO 100k #2 · Verification', transactions:[…],
  funded:true,                       // optie A: telt niet als eigen geld
  firm:'ftmo',                       // adapter-id voor import-herkenning (ExchangeAPI.ftmo)
  login:'1510123456', server:'FTMO-Server3',   // uit MT5-rapport of handmatig
  size:100000,                       // startkapitaal fase = %-basis voor trades op dit account
  challengeId:'c…', phase:'p2' }     // 'p1' | 'p2' | 'funded'

// Nieuw, eigen sleutel sj_challenges
{ id:'c…', firm:'ftmo', program:'2-step', size:100000, label:'FTMO 100k #2',
  phases:[ { key:'p1', accountId:'m…', start:'2026-10-01', end:'2026-10-14', status:'gehaald',
             rules:{ target:10, dailyLoss:5, maxLoss:10, ddType:'static', minDays:4, consistency:null, tz:'Europe/Prague' } },
           { key:'p2', accountId:'m…', start:'2026-10-16', end:null, status:'actief', rules:{…} } ],
  money:[ {type:'fee', amount:540, date:'2026-10-01'},
          {type:'payout', amount:3600, date:'2026-11-20', note:'80% split'},
          {type:'refund', amount:540, date:'2026-11-20'} ] }
```

- Het geld zit **op de challenge**, niet op een fase-account. Zo raakt het nooit de saldi van accounts (anders dan bij TradesViz).
- **Nooit dubbel tellen:** een uitbetaling die op Kraken of de bank landt en daar via de sync al in je balans komt, mag niet
  óók in `totalBalance`. Daarom telt het prop-resultaat in een **eigen regel**, niet in de balans (open vraag 3).
- **JSON-export/import** neemt `sj_challenges` mee (verplicht vangnet volgens CLAUDE.md), samen met `schemaVersion`.
- **Exchange-isolatie:** het lezen van login, server en startkapitaal hoort in de adapter (bijv. `ExchangeAPI.ftmo.accountHint(text, filename)`
  → `{login, server, size}`). Het matchen op die hint is generiek en heeft geen `if (firm===…)` nodig.

### 6.3 Slimme import (optie B)

1. **Formaat → firm.** Dat bestaat al: de kolomvolgorde van MetriX herkent FTMO. Nieuw is een MT5-rapport (HTML/XLSX), waarvan
   de kop "Company" en het accountnummer geeft [P18].
2. **Login in het bestand?** Dan koppel je zonder vragen aan het account met die login, met een toast: "→ FTMO 100k #2 · Verification".
   Is de login onbekend maar heeft dezelfde firm een fase die *gehaald* is en nog geen opvolger heeft? Dan vraagt de journal:
   "Nieuwe login. Is dit de Verification van FTMO 100k #2?" Dat werkt omdat elke fase een nieuwe login krijgt [P3].
3. **Geen login (MetriX-CSV):** de kandidaten zijn de actieve accounts van die firm.
   - Eén kandidaat: die staat voorgeselecteerd in een korte bevestiging.
   - Meer kandidaten: kies op het **datumvenster**. Vallen de trades binnen begin en eind van een fase, en na de laatste
     geïmporteerde trade van dat account?
   - Geen kandidaat: "Nieuwe challenge aanmaken", vooringevuld met firm, startdatum (eerste trade) en startkapitaal
     (de balansregel uit MT5, als die er is).
4. **Controle na de koppeling:** trades na de einddatum of status van een fase → "hoort dit bij de volgende fase?". Hetzelfde Ticket
   in een ander account → dat is dezelfde trade, niet dupliceren (de id bevat het Ticket al, `ftmo_csv_<ticket>_…`).
5. **Tijdzone:** FTMO telt dagen in CE(S)T [P1], MT5 schrijft servertijd. De keuze per firm onthouden (zoals TradeZella vraagt [P11]).

### 6.4 Weergave

- **Dashboard:** balans, P&L-tegels en equity alleen over eigen geld. Daarnaast een tegel "Prop" met actieve challenges, de voortgang
  van de lopende fase en het prop-resultaat (uitbetalingen − kosten).
- **Filter "geld":** *eigen / funded / alles*. Analytics en playbook staan standaard op **alles**, het dashboard op **eigen**.
  Dat moet zichtbaar zijn: bestaande regel B1 (filterbadge) uitbreiden.
- **R als vergelijkingsmaat:** R hangt niet af van de accountgrootte en is dus de eerlijkste maat over eigen en funded heen.
  % rekent per account met de eigen basis.
- **Toestanden** (CLAUDE.md): *leeg* ("Nog geen challenges. Voeg er een toe of importeer een FTMO-export"), *geen actieve*
  (alleen afgeronde challenges: toon de historie en het netto resultaat), *fase zonder trades*, *precies één trade*,
  *gehaald maar nog geen opvolger* (vraag om de nieuwe login), en *funded maar kwijt* (grijs, met het geldresultaat).

### 6.5 Uitvoering

- **B1** (minor-release, verandert cijfers): de `funded`-vlag, één helper `isEigenGeld(t)` op alle geld-sommen, de %-basis per
  account, de accountkeuze bij de import (stap 3 van §6.3 in de eenvoudige vorm). Test eerst: een spec die laat zien dat een funded
  winst nu `_pctBases` en de balans verschuift (die faalt vandaag), dan de fix.
- **B2**: challenges, fases, status, geldoverzicht, het lezen van het MT5-rapport en vragen op login. Grote feature, dus plan via
  `superpowers:writing-plans` en eerst een demo (`/prototype`) voor het challenge-paneel.
- **Later of nooit:** optie C.

---

## 7. Open vragen voor Zaratras (`/grill-me`)

1. Wordt een fase een **eigen account** (aanbevolen, past op FTMO) of één account per challenge?
2. Moeten oude FTMO-trades (`t.exchange='ftmo'`, zonder account) automatisch naar een eerste "FTMO"-account, of verdeel je ze zelf per challenge?
3. Waar telt een uitbetaling: alleen in "prop-resultaat", of óók als storting op een eigen account wanneer je hem daar laat landen?
   (Het gevaar is dubbel tellen met de live-sync.)
4. Telt een evaluatie anders dan funded in de analyse? TradeZella adviseert ze apart te bekijken [V2]. Een extra filterwaarde of niet?
5. Wil je regels per fase zelf invullen, of alleen FTMO 1-Step/2-Step als voorinstelling?
6. Kun je een **MT5-rapport (XLSX)** en een **MetriX-CSV** van hetzelfde FTMO-account aanleveren? Dan kunnen we de kop
   (login, server, startkapitaal) en de bestandsnaam vaststellen in plaats van aannemen.
7. Breakout: is er een export uit de Breakout Terminal? Zonder voorbeeld blijft Breakout handmatig.

---

## Bronnen

**Prop firms**
- [P1] FTMO, Trading Objectives: https://ftmo.com/en/trading-objectives/
- [P2] FTMO FAQ, "I have successfully passed…": https://ftmo.com/en/faq/i-have-successfully-passed-my-ftmo-challenge-now-what/
- [P3] FTMO FAQ (Oanda-spiegel): "Once results are verified, you will receive login credentials for the Verification phase": https://ftmo.oanda.com/faq/i-have-successfully-passed-my-ftmo-challenge-now-what/
- [P4] FTMO FAQ, "Why is there a fee": https://ftmo.oanda.com/faq/why-is-there-a-fee/
- [P5] Topstep, Our Program: https://www.topstep.com/our-program
- [P6] Topstep Help, "What is the Trading Combine" (Maximum Loss Limit): https://help.topstep.com/en/articles/8284204-what-is-the-trading-combine
- [P7] The5ers, Hyper Growth: https://the5ers.com/hyper-growth/
- [P8] Breakout Help Center, maximum drawdown (2-Step): https://intercom.help/breakoutprop/en/articles/10340637
- [P19] FTMO/Oanda blog, Account MetriX: https://ftmo.oanda.com/blog/account-metrix-a-tool-for-analyzing-and-improving-your-prop-trading/
- [P20] FTMO FAQ, "How do I log in to MT5?": https://ftmo.com/faq/how-do-i-log-in-to-mt5/
- [S1] TradingFunder, The5ers rules: https://tradingfunder.com/the5ers-rules
- [S2] Kraken Learn, Breakout vs BrightFunded (2026; Kraken is verwant aan Breakout): https://www.kraken.com/au/learn/breakout-vs-brightfunded

**Journals**
- [P9] TradeZella Help, PropFirm Sync koppelen: https://help.tradezella.com/en/articles/13463732-how-to-connect-your-existing-tradezella-account-to-propfirm-sync
- [P10] TradeZella Help, wat is PropFirm Sync: https://help.tradezella.com/en/articles/14499729-what-is-propfirm-sync-tradezella-s-command-center-for-prop-firm-traders
- [P11] TradeZella Help, FTMO-import via bestand: https://help.tradezella.com/en/articles/10395516-ftmo-how-to-import-trades-from-ftmo-into-tradezella-using-the-file-upload-method
- [P12] Deltalytix, Prisma-schema (open source): https://raw.githubusercontent.com/hugodemenez/deltalytix/main/prisma/schema.prisma
- [P13] Tradesyncer Help, Prop Firm Expense Tracker: https://help.tradesyncer.com/en/articles/14999089-prop-firm-expense-tracker-how-it-works
- [P14] FX Replay, Prop Firm Simulator: https://fxreplay.com/prop-firm-simulator
- [P15] Tradervue Help, Using Multiple Trading Accounts: https://help.tradervue.com/article/3422-using-multiple-trading-accounts
- [P16] Jigsaw Trading, Journalytix: https://www.jigsawtrading.com/journalytix-institutional-grade-trade-analytics/
- [P17] Kinfo, homepage: https://kinfo.com/
- [P18] MetaTrader 5 Help, Trading Report: https://www.metatrader5.com/en/terminal/help/trading_advanced/history_report
- [V1] TradeZella, PropFirm Sync-productpagina: https://www.tradezella.com/prop-firm-sync
- [V2] TradeZella blog, Prop Firm Trading Journal: https://www.tradezella.com/blog/prop-firm-trading-journal
- [V3] TradeZella blog, MT4/MT5 koppelen: https://www.tradezella.com/blog/connect-mt4-mt5-trading-journal
- [V4] TradesViz blog, Prop Firm Compliance Tracking: https://www.tradesviz.com/blog/prop-firm-compliance-tracking/
- [V5] TradesViz, Prop Firm Journal: https://www.tradesviz.com/prop-firm-journal/
- [V6] TradesViz, Topstep-brokerpagina: https://www.tradesviz.com/brokers/Topstep%20Prop%20Firm
- [V7] TradesViz, FTMO-brokerpagina: https://www.tradesviz.com/brokers/FTMO
- [S3] Tanto, TradeZella-alternatief: https://tradetanto.com/learn/tradezella-alternative
- [S4] Tanto, Edgewonk-alternatief: https://tradetanto.com/learn/edgewonk-alternative
- [S5] Traders Second Brain, Edgewonk-alternatief: https://traderssecondbrain.com/guides/edgewonk-alternative
- [S6] GodFunded, TraderSync: https://thegodfunded.com/en/tools/tradersync/
- [S7] Tanto, Chartlog-alternatief: https://tradetanto.com/learn/chartlog-alternative
- [S8] GodFunded, Trademetria: https://thegodfunded.com/en/tools/trademetria/
- [S9] TradesViz, cTrader-brokerpagina (voorbeeld): https://www.tradesviz.com/brokers/ShineTrades

**Eigen repo**
- `work/syncjournal.html`: `parseExchangeCsvText` (FTMO-tak), `_pctBases` / `pnlBaseOf`, `totalBalance` / `manualBalance`, `TX_TYPES`, `handleCsvFile`, `kindMatch`
- `docs/multi-account-design-2026-06-09.md`: eerder ontwerp voor meerdere accounts per exchange
- Memory `project_ftmo_mt5`, `project_breakout_prop`
