# Funded modus: één eenvoudig ontwerp

**Datum**: 25-10-2026 (derde versie) · **Demo**: [demos/funded-demo.html](../demos/funded-demo.html) · **Onderzoek**: branch
`research-funded-modus`, `docs/research-funded-modus-2026-10-24.md`

Open de demo via localhost. Bovenin kies je een toestand (Funded modus uit, aan maar leeg, lopende challenge, gehaald vóór en ná
omzetten, niet gehaald, funded met uitbetaling, funded gestopt) en licht of donker. De nepdata: FTMO 100k #1 (niet gehaald),
FTMO 100k #2 (gehaald, omgezet naar een actief funded account met één uitbetaling van $ 2.480), Breakout 25k #1 (lopend) en eigen
trades op Blofin en Kraken. 38 trades, aug t/m okt.

## Besluiten (Denny, 25-10-2026)

1. **Eén plek.** Alles van funded staat in Instellingen → Funded. Er is geen apart Accounts-scherm voor funded, en Instellingen →
   Accounts blijft voor de eigen exchanges en handmatige accounts.
2. **Twee schakelaars bovenaan de tab**: *Funded modus* (standaard uit) en daaronder *Funded meetellen*, die alleen zichtbaar is
   als de modus aan staat. Met de modus uit is de journal precies zoals nu: nergens iets van funded.
3. **Geen regels van de firm.** Geen dagverlies, max drawdown, winstdoel, minimum dagen, voortgangsbalk of fases. De firm houdt dat
   zelf bij.
4. **Twee soorten**, met dezelfde velden: firm (vrije tekst met suggesties), naam, grootte (startkapitaal, voor het P&L-%) en status.
   - **Challenge**: bezig / gehaald / niet gehaald. Een 2-step challenge is één challenge, zonder fase 1 en fase 2.
   - **Funded account**: actief / gestopt, en bij gestopt de reden: eruit gezet of zelf gestopt.
   - Staat een challenge op *gehaald*, dan verschijnt **"Omzetten naar funded account"**. Firm en grootte gaan mee, de naam kun je
     aanpassen. Het nieuwe account blijft gekoppeld aan de challenge. De trades van de challenge blijven bij de challenge.
5. **Trades komen binnen** via de CSV-import (Instellingen → Accounts) of met de hand (het trade-formulier). In het formulier staan bij
   "Exchange / account" ook de lopende challenges en actieve funded accounts, maar alleen als de modus aan staat. Bij de import vraagt
   de journal "Bij welk account hoort dit?", met een voorstel op basis van het login-nummer. Een challenge of funded account onthoudt
   elke login die er ooit bij is geïmporteerd (FTMO geeft per fase een nieuwe).
6. **Uitbetalingen**: één knop "Uitbetaling toevoegen" (bedrag en datum) op een funded account, zoals een opname bij een handmatig
   account. "Uitbetaald" staat per funded account en in totaal. Geen fees, resets of profit split.
7. **Dashboard**: met de modus aan en "meetellen" uit staat er één compacte kaart *Funded* naast je eigen balans, met lopende
   challenges, actieve funded accounts, P&L van funded en het totaal uitbetaald. Met "meetellen" aan staat er één totaal, gemarkeerd
   als "incl. funded". **Analytics** heeft het filter eigen / funded / alles.

## Datamodel

**Een funded-item** (challenge of funded account) is één soort record, in een eigen lijst `sj_funded` (localStorage, naast
`sj_manual`). Velden:

```js
{ id:'fc_…', kind:'challenge'|'funded',
  firm:'FTMO', name:'100k #2', size:100000,      // size = basis voor het P&L-%
  status:'bezig'|'gehaald'|'niet'                // challenge
        |'actief'|'gestopt',                     // funded account
  stop:null|'eruit'|'zelf',                      // alleen bij funded + gestopt
  logins:['1510002222','1510003333'],            // elke login die er ooit bij is geïmporteerd
  start:'2026-08-24',
  funded:'fa_…',                                 // challenge → het funded account waarnaar hij is omgezet
  from:'fc_…',                                   // funded account → de challenge waar hij uit komt
  payouts:[{amount:2480, date:'2026-10-13'}] }   // alleen bij funded
```

- **Trade**: krijgt geen nieuw veld. Een trade hangt al aan een account via `t.exchange` (ook bij handmatige accounts, zie `acctOf`).
  Voor een funded trade wordt `t.exchange` het id van het item. `acctOf` en de keuzelijst in het trade-formulier (`exOpt`) moeten
  `sj_funded` dus kennen.
- **De koppeling challenge ↔ funded account** gaat in twee richtingen (`funded` en `from`). Zo laat elk van de twee kaartjes de
  ander zien zonder te zoeken. Bij omzetten worden beide gezet. Er worden geen trades verplaatst.
- **Login-nummers** staan op het item zelf (`logins`), niet op de trade. De import zoekt de login uit het bestand op in alle items.
  Bij een treffer koppelt hij zonder vraag, met alleen een melding. Bij een onbekende login stelt hij een nieuwe challenge voor
  (firm en grootte uit het bestand) of een bestaand item van dezelfde firm. Na de keuze komt de login bij dat item. Het lezen van
  de login uit het bestand hoort in de adapter (`ExchangeAPI.ftmo`), het opzoeken is generiek.
- **Uitbetalingen** staan op het funded account en raken de eigen balans niet. Een uitbetaling landt op je bank of exchange en
  zit daar al in. Hem ook in de balans tellen zou dubbel tellen.
- **Instellingen**: `STATE.funded` (modus) en `STATE.fundedMee` (meetellen) in `sj_state`, naast `pctRef`. De **JSON-export/import**
  neemt `sj_funded` mee (verplicht vangnet volgens CLAUDE.md).
- **Geld-sommen**: één helper `isEigenGeld(t)`, die zegt "dit account is geen funded-item". Die komt op elke plek waar eigen geld wordt
  opgeteld: `totalBalance`, `acctPnl`, `_pctBases`, de dashboard-tegels en de equity.

## Funded modus uitzetten terwijl er funded trades zijn

Er zijn drie mogelijkheden:

1. **Ze tellen als eigen geld.** Dat is precies de scheeftrekking die we willen voorkomen: met de nepdata wordt je $ 8.356 ineens
   ruim $ 18.000. En het gebeurt ongemerkt, door een schakelaar ver weg in Instellingen.
2. **Ze blijven apart, zonder funded-schermen.** Dan staan er trades in je lijst en analyse van accounts die je nergens kunt zien of
   beheren. Dat is niet clean.
3. **Ze worden verborgen, niet gewist.** Funded-items en hun trades verdwijnen uit Dashboard, Trades, Analytics en het trade-formulier.
   Ze blijven in de opslag en in de JSON-export. Zet je de modus weer aan, dan is alles terug.

**Advies: 3, verbergen.** Uit betekent dan: "ik wil niets van prop zien", en funded geld telt in geen van beide standen stilletjes
als eigen geld. In de tab staat dan één regel: "4 challenges en funded accounts met 26 trades zijn verborgen, niet gewist." De demo
doet het zo.

Het nadeel: met de modus uit tellen die trades ook niet mee in je strategie-analyse. Wie ze daar wil hebben, laat de modus aan.

## Bouwgrootte: M

Dit ontwerp is duidelijk kleiner dan de oude challenge-kaart met fases en regels (L). Het blijft wel M, en niet S, omdat het
op een paar plekken door de hele app heen loopt:

| Onderdeel | Grootte |
|---|---|
| `isEigenGeld(t)` op alle geld-sommen (`totalBalance`, `acctPnl`, `_pctBases`, dashboard, equity) + spec die nu faalt | S–M, het meeste risico |
| `sj_funded` + tab Funded (lijst, toevoegen, status, omzetten, uitbetaling) + schakelaars | S |
| Dashboard-kaart en "meetellen", Analytics-filter | S |
| `exOpt` en `acctOf` kennen de funded-items; verbergen als de modus uit staat | S |
| Import: login uit het MT5-rapport lezen (adapter) + "Bij welk account hoort dit?" + logins onthouden | M (MT5-rapport inlezen is nieuw) |
| JSON-export/import, `schemaVersion` | S |

Een redelijke volgorde: eerst `isEigenGeld` met de tab en de handmatige invoer (dat is al bruikbaar), daarna de import op login.
Het verandert cijfers, dus het wordt een **minor**-release.

## Toestanden in de demo

| Toestand | Wat je ziet |
|---|---|
| Funded modus uit | Dashboard, Trades en Analytics zoals nu. Het trade-formulier toont alleen eigen accounts. De tab Funded meldt wat er verborgen is |
| Aan, nog niets | Lege staat met "Challenge toevoegen". Op het Dashboard een kaart met dezelfde knop |
| Lopende challenge | Breakout 25k #1, 4 trades, status bezig |
| Gehaald, vóór omzetten | FTMO 100k #2 op gehaald, met de knop "Omzetten naar funded account". Nog geen funded account |
| Gehaald, ná omzetten | De challenge wijst naar "100k #2 · funded", en het funded account wijst terug |
| Niet gehaald | FTMO 100k #1, P&L −$ 10.400. De trades blijven in de analyse |
| Funded + uitbetaling | $ 2.480 uitbetaald op 13-10, en "Uitbetaling toevoegen" |
| Funded gestopt | Status gestopt, reden eruit gezet. De uitbetaling blijft staan |

## Open vragen voor Denny

1. **Modus uit = verbergen** (advies hierboven): akkoord?
2. **Funded meetellen aan**: telt het totaal alleen lopende challenges en actieve funded accounts mee (zo doet de demo het), of ook
   afgeronde?
3. **Na een uitbetaling** zet de firm de balans terug naar de grootte. De demo rekent de balans van een item als grootte + alle P&L.
   Moet een uitbetaling die balans verlagen, of laten we de balans van een funded-item helemaal weg en tonen we alleen P&L en
   "uitbetaald"?
4. **Uitbetaling op een gestopt funded account**: mag dat (een laatste uitbetaling na "zelf gestopt"), of verdwijnt de knop?
5. **Trade-formulier**: alleen lopende challenges en actieve funded accounts in de keuzelijst (zoals nu), of ook afgeronde, om een
   vergeten trade achteraf toe te voegen?
6. **Bestaande FTMO-trades** (`t.exchange='ftmo'`, zonder account): bij het aanzetten van de modus voorstellen ze in één challenge
   te zetten, of laat je ze als eigen geld staan tot je ze zelf verplaatst?
7. **Aanlevering**: een MT5-rapport (HTML of XLSX) en een MetriX-CSV van hetzelfde FTMO-account, en een Breakout-export als die er is.
   Dan stellen we vast waar de login staat, in plaats van het aan te nemen.

## Over de demo zelf

- Eén bestand, geen build. Alleen de Google Fonts van de app worden van buiten geladen.
- De kleuren komen uit de variabelen van de app. De enige letterlijke kleur zit in de ongewijzigd overgenomen app-regels `.btn.pri`
  en `.sw` (`#fff`, zoals in de app).
- Funded modus, Funded meetellen, de toestand en het thema worden onthouden (localStorage `sj_demo_funded3_*`). Wat je in de demo
  toevoegt, omzet of uitbetaalt, wordt niet onthouden.
- De tabs Weergave, Tags, AI-coach, Data, Updates en Wissen zijn leeg; ze werken zoals in de app.
- Gecontroleerd met Playwright, headless:
  - elke toestand in licht en donker, op desktop en op 390px, plus het dashboard, het trade-formulier en de import;
  - geen JS-fouten en geen horizontale scroll;
  - met de modus uit staat er op Dashboard, Trades, Analytics en Instellingen → Accounts nergens "funded" of "challenge";
  - omzetten maakt een gekoppeld funded account (firm en grootte overgenomen, de 10 trades blijven bij de challenge);
  - een uitbetaling telt op, een nieuwe login wordt na de import onthouden, en beide schakelaars blijven na herladen bewaard.
