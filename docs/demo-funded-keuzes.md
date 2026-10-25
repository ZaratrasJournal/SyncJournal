# Funded modus: drie varianten naast elkaar

**Datum**: 25-10-2026 (tweede versie) · **Demo**: [demos/funded-demo.html](../demos/funded-demo.html) · **Onderzoek**: branch
`research-funded-modus`, `docs/research-funded-modus-2026-10-24.md`

Open de demo via localhost. Bovenin schakel je tussen A, B en C, tussen licht en donker, en met "Lege staat" naar een journal zonder
challenges. Rechtsboven zie je of de Funded modus aan of uit staat. De nepdata: FTMO 100k #1 (gefaald in fase 1), FTMO 100k #2 (nu funded en
actief), Breakout 25k #1 (gehaald, daarna eruit gezet), FTMO 10k #3 (fase 1 net gestart, nog geen trades) en eigen trades op Blofin en
Kraken. 44 trades, aug t/m okt.

## Nieuw in de tweede versie

1. **Funded is een functie die je aanzet**: Instellingen → **Funded** (een nieuwe tab naast Accounts, Weergave, Tags, AI-coach, Data,
   Updates en Wissen, in de volgorde van de app). Bovenaan staat de schakelaar **Funded modus**, standaard **uit**.
   - **Uit**: de journal is die van nu. Geen funded-kaarten op het Dashboard, geen challenges bij Accounts, geen filter
     eigen/funded in Analytics, geen pagina Prop-geld, geen funded-keuze bij de import. De Playwright-controle zoekt op elke pagina naar
     "funded", "challenge", "FTMO" en "Breakout" en vindt niets.
   - **Aan**: alles van de gekozen variant verschijnt.
2. **"Funded meetellen" staat in dezelfde tab**, onder Funded modus, en is alleen zichtbaar als die aan staat. De uitleg over het
   P&L-percentage is meeverhuisd. Op Dashboard en Accounts zie je alleen nog een klein label in de kopbalk ("eigen en funded apart" of
   "⚠ funded meegeteld"). Klik je erop, dan ga je naar de tab.
3. **De import zit in Instellingen → Accounts**, sectie "CSV-import", net als `csvFileInp` / `handleCsvFile` in de app. "Import" staat
   niet meer in het menu. Na het kiezen van een bestand blijft de vraag "Bij welk account hoort dit?":
   - **modus uit**: alleen gewone keuzes. Bij een FTMO-bestand stelt hij een handmatig account voor, dat als eigen geld telt, met
     een tip om Funded modus aan te zetten.
   - **modus aan**: de funded accounts en challenges, met het voorstel op login (zoals in de eerste versie). Een Blofin-bestand
     gaat in beide standen gewoon naar Blofin.

## Wat er in de tab Funded staat, per variant

Mijn keuze: **Accounts is voor gebruiken, Instellingen → Funded is voor inrichten.** Wat je vaak doet (status zetten, voortgang
bekijken) staat bij Accounts. Wat je eenmalig of af en toe doet (een challenge aanmaken, regels invullen, een fee of payout boeken)
staat in de tab. Zo wordt de Accounts-pagina geen formulier, en zie je de instellingen niet als je alleen je cijfers wilt bekijken.

| | A | B | C |
|---|---|---|---|
| Funded modus + Funded meetellen + uitleg P&L-% | ✓ | ✓ | ✓ |
| Lijst van accounts met per account de funded-vlag, en een funded account toevoegen | ✓ | | |
| Challenges: lijst met status, en een nieuwe challenge (firm, programma, startkapitaal) | | ✓ | ✓ |
| Regels per fase van de gekozen challenge (winstdoel, dagverlies, max drawdown, type, min. dagen); een wijziging zie je meteen bij Accounts | | ✓ | ✓ |
| Kosten en payouts: een boeking invoeren, de laatste vier boekingen, en een link naar het overzicht op de pagina Prop-geld | | | ✓ |

Status zetten blijft op de challenge-kaart bij Accounts. Het overzicht "uitgegeven tegenover verdiend" blijft een eigen pagina
(Prop-geld, alleen in C en alleen met de modus aan): dat lees je, daar voer je niets in.

## Het uitgangspunt in alle drie

- **Wiens geld** hoort bij het **account**, niet bij de trade. Een trade krijgt dus geen nieuw veld: hij hangt al aan een account
  via `t.exchange` (dat is ook het id van een handmatig account, zie `acctOf`). Een `kind:'funded'` valt af, want dan haalt het
  standaardfilter (live) funded trades juist uit je analyse.
- **Analyse telt alles mee**, met een filter *eigen / funded / alles* (standaard *alles*). Vergelijk op **R**: in de demo staat
  "Range reclaim" op +0,02R maar op −$ 7.381, omdat één verlies op een 100k-account in dollars alles overstemt.
- **P&L-%** rekent per deel op de eigen basis. In de demo: eigen +$ 356 / $ 8.000 = **+4,45%**, funded +$ 10.650 / $ 450.000 = **+2,37%**.
  Met "Funded meetellen" aan wordt het (356 + 10.650) / (8.000 + 450.000) = **+2,40%**. Het funded-kapitaal weegt 56× zwaarder,
  dus het gecombineerde % zegt niets meer over je eigen rendement.

## Waar de instelling staat (datamodel)

In alle varianten gelijk:
- **`STATE.funded`** (aan/uit) en **`STATE.fundedMee`** (meetellen) bij de andere voorkeuren in `sj_state` (`persistState`),
  naast `pctRef` en `unit`. Het zijn weergavekeuzes, geen data. Ze gaan mee in de JSON-export onder `settings`.
- **De funded-vlag en de challenges zijn data**: ze staan bij de accounts (`sj_manual`) en in `sj_challenges`, en blijven bestaan
  als je de modus uitzet.

| | A | B | C |
|---|---|---|---|
| **Kosten** | S | L (B1 = A, daarna B2) | B + S |
| **Account** (`MANUAL`) | `funded`, `size`, optioneel `login` | + `firm`, `server`, `challengeId`, `phase` | als B |
| **Nieuw** | – | `sj_challenges`: fases, `status` (`bezig/gehaald/gefaald/eruit`, door jou gezet), `rules` per fase | + `money:[{type:'fee'\|'reset'\|'payout'\|'refund', amount, date, note}]` op de challenge |
| **Trade** | niets nieuws | niets nieuws | niets nieuws |

## Wat er met funded trades gebeurt als je de modus uitzet

Er zijn drie mogelijkheden:

1. **Ze tellen als eigen geld.** Dat is precies de scheeftrekking die we willen voorkomen: een funded winst van $ 10.650 maakt van je
   $ 8.356 ineens $ 19.000, en je P&L-% klopt niet meer. Dit gebeurt ook ongemerkt, want de schakelaar staat ver weg in Instellingen.
2. **Ze blijven apart, maar zonder funded-schermen.** Dan staan er trades in je analyse en je tradelijst van accounts die je
   nergens meer ziet. Of je balans "klopt" kun je dan niet meer nagaan, en de journal is niet clean.
3. **Ze worden verborgen, niet gewist.** Funded accounts en hun trades verdwijnen uit Dashboard, Accounts, Analytics en de
   tradelijst. Ze blijven in de opslag en in de JSON-export. Zet je de modus weer aan, dan is alles terug.

**Advies: 3, verbergen.** "Uit" betekent dan: "ik wil niets van prop zien". De belofte die de hele functie draagt, dat funded geld
nooit stilletjes als eigen geld telt, blijft in beide standen overeind. Er gaat niets verloren. In de tab staat dan één regel:
"7 funded accounts met 32 trades zijn verborgen, niet gewist." Wie een funded account tóch als eigen geld wil tellen, haalt per
account de vlag weg. Dat is een bewuste keuze per account, geen bijwerking van een schakelaar. De demo doet het zo.

Het nadeel: met de modus uit tellen die trades ook niet mee in je strategie-analyse. Maar wie funded uitzet, wil prop juist niet zien.
Wie de trades in de analyse wil hebben, laat de modus aan.

## A · Minimaal

**Voor**: klein, en het lost het echte probleem op: funded winst trekt je eigen balans en % niet meer scheef.
**Tegen**: de journal weet niet welke accounts bij elkaar horen of welke dicht zijn. De funded-balans telt daardoor alle 7 accounts
mee, ook de gefaalde: **$ 470.650**, een getal zonder betekenis. Bij de import kan hij alleen op login koppelen. Zonder login
(MetriX-CSV) blijft alleen "kies zelf" over.

## B · Challenge-kaart (advies van het onderzoek)

**Voor**: een fase is een eigen account, net als bij FTMO zelf (nieuwe login per fase). De funded-balans telt alleen lopende fases
($ 114.000). De import kiest slim: op login, op een fase zonder login met hetzelfde startkapitaal, of op het datumvenster. Gefaalde en
eruit gezette challenges blijven als historie staan, en hun trades blijven in de analyse.
**Tegen**: veel meer code en schermen. De voortgang is een richtlijn: de firm meet op equity met open posities, en die zit niet in een
CSV. Regels vul je zelf in (alleen voor FTMO voorgesteld).

## C · Twee boekhoudingen

**Voor**: beantwoordt "verdien ik geld met prop?". In de demo: uitgegeven $ 1.368, verdiend $ 3.540, netto **+$ 2.172**, per firm, met
ROI. Het staat los van je balans, dus er wordt niets dubbel geteld.
**Tegen**: alles handmatig (fees en payouts staan niet in een trade-export). Een payout die op Kraken of de bank landt, staat daar al in
je balans en mag nooit ook als storting meetellen.

## Toestanden in de demo

| Toestand | Waar |
|---|---|
| Funded modus uit | Dashboard, Accounts en Analytics zoals nu; de tab Funded zegt hoeveel er verborgen is |
| Leeg (modus aan, nog geen challenge) | "Lege staat": Dashboard, Accounts, tab Funded en Prop-geld tonen de volgende stap; bij de import is "nieuwe challenge" voorgeselecteerd |
| Niets in beeld | Analytics met filter *Funded* in de lege staat |
| Challenge zonder trades | FTMO 10k #3, Fase 1 |
| Gefaald / eruit gezet | FTMO 100k #1 / Breakout 25k #1 (grijs, trades blijven in de analyse) |
| Grens geraakt bij een lopende fase | zet bij Accounts een status terug op "bezig", of verlaag in de tab een max drawdown: de kaart waarschuwt, maar beslist niet |

## Open vragen voor Denny

1. **Welke variant?** Mijn advies blijft B in twee stappen (B1 = A eerst), met C erbij als je het geldoverzicht echt bijhoudt.
2. **Modus uit = verbergen** (advies hierboven): akkoord, of wil je de trades dan toch in je analyse houden?
3. **Inrichten in Instellingen, gebruiken bij Accounts**: past dat bij hoe jij werkt, of wil je een challenge ook vanaf Accounts kunnen
   aanmaken?
4. **Telt "funded" in de balans alleen lopende fases**, of ook een funded account dat je nog hebt maar even niet handelt?
5. **Wat doet een payout met de funded-balans?** Bij FTMO gaat de winst eraf en zakt de balans terug naar het startkapitaal. De demo
   verwerkt dat niet.
6. **Funded-% over meerdere accounts**: zinvol, of alleen een % per fase (zoals de firm het meet)?
7. **Analyse-filter**: is *eigen / funded / alles* genoeg, of wil je ook *evaluatie* los van *funded* zien?
8. **Oude FTMO-trades** (`t.exchange='ftmo'`, zonder account): bij het aanzetten van de modus automatisch naar één account "FTMO",
   of verdeel je ze zelf? En zolang de modus uit staat, blijven ze eigen geld, zoals nu?
9. **Aanlevering**: een MT5-rapport (HTML of XLSX) en een MetriX-CSV van hetzelfde account, en een Breakout-export als die er is.
   Zonder die bestanden is de import-herkenning een aanname.

## Over de demo zelf

- Eén bestand, geen build. Alleen de Google Fonts van de app worden van buiten geladen.
- De kleuren komen uit de variabelen van de app. De enige letterlijke kleur zit in app-regels die ongewijzigd zijn overgenomen
  (`.btn.pri` en de knop van `.sw`, allebei `#fff` zoals in de app).
- Funded modus, Funded meetellen, variant, thema, pagina en tab worden onthouden in localStorage (`sj_demo_funded_*`).
- De tabs Weergave, Tags, AI-coach, Data, Updates en Wissen zijn in de demo leeg; ze werken zoals in de app.
- Gecontroleerd met Playwright, headless: elke variant met de modus uit en aan, in licht en donker, op desktop en op 390px, plus de
  tab Funded, de import, de lege staat en Prop-geld. Geen JS-fouten en geen horizontale scroll. Met de modus uit staat er op geen enkele
  pagina iets van funded. Een regelwijziging in de tab is terug te zien bij Accounts, en beide schakelaars worden na herladen onthouden.
