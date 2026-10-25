# Funded modus: drie varianten naast elkaar

**Datum**: 25-10-2026 · **Demo**: [demos/funded-demo.html](../demos/funded-demo.html) · **Onderzoek**: branch
`research-funded-modus`, `docs/research-funded-modus-2026-10-24.md`

Open de demo via localhost. Bovenin schakel je tussen A, B en C, tussen licht en donker, en met "Lege staat" naar een journal zonder
challenges. De nepdata: FTMO 100k #1 (gefaald in fase 1), FTMO 100k #2 (nu funded en actief), Breakout 25k #1 (gehaald,
daarna eruit gezet), FTMO 10k #3 (fase 1 net gestart, nog geen trades) en eigen trades op Blofin en Kraken. 44 trades, aug t/m okt.

## Het uitgangspunt in alle drie

- **Wiens geld** hoort bij het **account**, niet bij de trade. Een trade krijgt dus geen nieuw veld: hij hangt al aan een account
  via `t.exchange` (dat is ook het id van een handmatig account, zie `acctOf`). Een `kind:'funded'` valt af, want dan haalt het
  standaardfilter (live) funded trades juist uit je analyse.
- **Analyse telt alles mee**, met een filter *eigen / funded / alles* (standaard *alles*). Vergelijk op **R**: in de demo staat
  "Range reclaim" op +0,02R maar op −$ 7.381, omdat één verlies op een 100k-account in dollars alles overstemt.
- **Schakelaar "Funded meetellen"** (Dashboard en Accounts, standaard **uit**, onthouden in localStorage):
  - **uit**: eigen geld en funded naast elkaar, elk met een eigen balans, P&L, P&L-% en totaal. Funded blijft altijd zichtbaar.
  - **aan**: één totaal met funded erbij, met een oranje markering "incl. funded" en de uitsplitsing eigen / funded eronder.
- **P&L-%** rekent per deel op de eigen basis. In de demo staat eigen op +$ 356 / $ 8.000 = **+4,45%** en funded op +$ 10.650 /
  $ 450.000 (startkapitaal van de 6 fases met trades) = **+2,37%**. Staat de schakelaar aan, dan wordt het (356 + 10.650) / (8.000 + 450.000) =
  **+2,40%**. Het funded-kapitaal weegt 56× zwaarder, dus het gecombineerde % zegt niets meer over je eigen rendement. De demo
  laat die berekening in beide standen zien.

## A · Minimaal

**Kosten: S.** Eén vlag, één helper `isEigenGeld(t)` op alle geld-sommen (`totalBalance`, `acctPnl`, `_pctBases`, dashboard-tegels,
equity), de schakelaar, het analysefilter en een accountkeuze bij de import.

**Datamodel**
- Account (`MANUAL`): `funded:true`, `size` (startkapitaal = %-basis), optioneel `login`.
- Trade: niets nieuws.

**Voor**: klein, en het lost het echte probleem op: funded winst trekt je eigen balans en % niet meer scheef.
**Tegen**: de journal weet niet welke accounts bij elkaar horen of welke dicht zijn. In de demo telt de funded-balans daardoor alle
7 accounts mee, ook de gefaalde: **$ 470.650**, een getal zonder betekenis. Bij de import kan hij alleen op login koppelen. Zonder
login (MetriX-CSV) blijft alleen "kies zelf" over.

## B · Challenge-kaart (advies van het onderzoek)

**Kosten: L.** A, plus het challenge-record, fases met status, regels, de indicatieve voortgang, het lezen van het MT5-rapport (kop:
login, startkapitaal) en de slimme import. Bouw in twee stappen: **B1 = A** (minor-release, raakt cijfers) en **B2 = de challenge-laag**.

**Datamodel**
- Account (`MANUAL`): `funded:true`, `firm`, `login`, `server`, `size`, `challengeId`, `phase` (`'p1'|'p2'|'funded'`).
- Nieuw `sj_challenges`: `{id, firm, program, size, label, phases:[{key, accountId, start, end, status, rules:{target, dailyLoss,
  maxLoss, ddType, minDays}}]}`. Status: `bezig | gehaald | gefaald | eruit`, **altijd door jou gezet**.
- Trade: niets nieuws. JSON-export en -import nemen `sj_challenges` mee.

**Voor**: een fase is een eigen account, net als bij FTMO zelf (nieuwe login per fase). De funded-balans telt alleen lopende fases
($ 114.000 in de demo). De import kan slim kiezen: op login, op een fase zonder login met hetzelfde startkapitaal, of op het
datumvenster. Gefaalde en eruit gezette challenges blijven zichtbaar als historie, en hun trades blijven in de analyse.
**Tegen**: veel meer code en schermen. De voortgang is maar een richtlijn: de firm meet op equity met open posities, en die zit niet in
een CSV. Regels moet je zelf invullen, of alleen voor FTMO voorgesteld krijgen.

## C · Twee boekhoudingen

**Kosten: B + S.** Een geld-lijst op de challenge en één extra pagina "Prop-geld".

**Datamodel**: B, plus op de challenge `money:[{type:'fee'|'reset'|'payout'|'refund', amount, date, note}]`.

**Voor**: dit beantwoordt de echte vraag: "verdien ik geld met prop?". In de demo: uitgegeven $ 1.368, verdiend $ 3.540, netto
**+$ 2.172**, per firm uitgesplitst, met ROI en hoeveel challenges funded werden. Het staat los van je balans, dus er wordt niets
dubbel geteld.
**Tegen**: alles moet je met de hand invoeren (fees en payouts staan niet in een trade-export). Een payout die op Kraken of de bank
landt, staat daar al in je balans. Hij mag dus nooit ook nog als storting meetellen.

## Toestanden in de demo

| Toestand | Waar |
|---|---|
| Leeg (nog geen challenge) | "Lege staat" aan: Dashboard, Accounts en Prop-geld tonen een lege staat met de volgende stap; bij de import is "nieuwe challenge" voorgeselecteerd |
| Niets in beeld | Analytics met filter *Funded* in de lege staat: "Geen funded trades in beeld" |
| Challenge zonder trades | FTMO 10k #3, Fase 1 |
| Gefaald | FTMO 100k #1 (grijs, trades blijven in de analyse) |
| Eruit gezet | Breakout 25k #1 (gehaald, daarna funded kwijt) |
| Grens geraakt bij een lopende fase | zet een status terug op "bezig": de kaart waarschuwt, maar beslist niet |

## Open vragen voor Denny

1. **Welke variant?** Mijn advies blijft B in twee stappen (B1 = A eerst), met C erbij als het geldoverzicht je echt iets zegt.
2. **Telt "funded" in de balans alleen lopende fases**, of ook een funded account dat je nog hebt maar even niet handelt?
3. **Wat doet een payout met de funded-balans?** Bij FTMO gaat de winst eraf en zakt de balans terug naar het startkapitaal. De
   demo verwerkt dat niet: de balans is startkapitaal plus alle P&L.
4. **Funded-% over meerdere accounts**: is "P&L / opgeteld startkapitaal van alle fases met trades" zinvol, of wil je alleen een %
   per fase zien (zoals de firm het meet)?
5. **Analyse-filter**: is *eigen / funded / alles* genoeg, of wil je ook *evaluatie* los van *funded* bekijken?
6. **Mag de schakelaar "Funded meetellen" ook op Analytics werken**, of blijft daar het filter *eigen / funded / alles*? (In de demo
   het tweede.)
7. **Oude FTMO-trades** (`t.exchange='ftmo'`, zonder account): automatisch naar één account "FTMO", of verdeel je ze zelf?
8. **Aanlevering**: een MT5-rapport (HTML of XLSX) en een MetriX-CSV van hetzelfde account, en een Breakout-export als die er is.
   Zonder die bestanden is de import-herkenning in de demo een aanname.

## Over de demo zelf

- Eén bestand, geen build. Alleen de Google Fonts van de app worden van buiten geladen.
- De kleuren komen uit de variabelen van de app. De enige letterlijke kleuren zijn in de app-regels die ongewijzigd zijn overgenomen
  (`.btn.pri` en de knop van `.sw`, allebei `#fff` zoals in de app).
- Gecontroleerd met Playwright, headless: elke variant op desktop in licht en donker en op 390px, plus import, lege staat en Prop-geld.
  Geen JS-fouten en geen horizontale scroll.
