# Release-kandidaat v1.18.1 — rapport (26-10-2026)

Branch `release-v1.18.1`, gemaakt vanaf `origin/release-v1.18` (`0986029`). De punten die Zaratras vond bij het
testen van v1.18 op work.syncjournal.nl. Samengesteld en getest door een cloud-routine, zonder iemand die meekeek.
**Niet** naar `main`, `work` of de deploy-repo gepusht; alleen `release-v1.18.1`.

## Commits

| Commit | Wat |
|---|---|
| `0c94d2e` | Merge `csv-dubbel-ci` (B3 + T1) |
| `d8f52d0` | Specs: Hyperliquid-CSV zonder voorloopnul naast de API, en de echte export tegen de wallet-opname |
| `1b2a91e` | Punt 2: regel over de stop-loss na een CSV-import |
| `8e43adb` | Punt 3: TP-som |
| `8ba6460` | Punt 4: playbook, setup en confirmaties in Kopieer voor Discord |
| `0bebea3` | Punt 5: `auto-sync`-spec |
| `e087b5c` | Release v1.18.1 (versie, changelog, `site/`, release-set) |

Bij punt 2, 3 en 4 kwam de test eerst en stond hij rood voordat de fix erin ging.

## 1. CSV en API dubbel (B3): "de API is altijd leidend"

### De merge

`git merge --no-ff origin/csv-dubbel-ci`. Eén conflict, in **`BACKLOG.md`** (de regels T1, W1 en B3):

- T1 en B3 staan nu als gedaan, met "in v1.18.1" erbij.
- W1 houdt "XS (Zaratras)" uit v1.18. De branch had daar nog "Denny".

**`CHANGELOG.md`** ging zonder conflict door git heen, maar **verkeerd**: git zette de B3-regel van de branch onder
`### Fixed` van het blok **v1.18**. Die regel heb ik daar weggehaald (het v1.18-blok is nu weer gelijk aan
`release-v1.18`). B3 staat nu in het blok v1.18.1, met de tekst uit de opdracht. `work/syncjournal.html` ging zonder
conflict samen. Er staan nergens nog conflictmarkeringen.

Wat de merge meebrengt (zie `docs/csv-dubbel-ci-rapport.md`): `zelfdePositie` per adapter (Blofin, OKX,
Hyperliquid), de gedeelde `zelfdeRondgang` en `csvOpgaanInApi` (de API-rij wint en neemt je invoer van de CSV-rij
over). Ook mee: `csvMoment`, `neemInvoerMee`, zeven synthetische exports in `tests/fixtures-csv/` en de specs
`csv-synthetisch` en `csv-api-dubbel`.

### Het formaat van Zaratras' echte export

Nagelopen in de code: `parseHLDateMs` leest `^(\d{1,2})-(\d{1,2})-(\d{4})` en vult dag en maand zelf aan tot twee
cijfers. "8-4-2026 - 08:30:57" werkt dus al. `px` gaat als tekst naar `_reconstructTrades` en verliest geen decimalen.
`zelfdeRondgang` vergelijkt prijzen op 0,1% en de grootte op 2%. De tijd is die van het scherm van de exporteur,
en `ExchangeAPI.hyperliquid.zelfdePositie` laat dezelfde verschuiving van hele kwartieren (tot 14 uur) op opening en
sluiting toe. **Er was geen codewijziging nodig.**

**Nieuwe spec `tests/hl-csv-zonder-nul.spec.js`: 15/15.** Hij was meteen groen (de merge dekte dit al). Hij gebruikt
een CSV in precies dat formaat ("8-4-2026", "3-5-2026", px `71358.8152173913`) en een nagebootste Hyperliquid-API
op `_post`, met een stop-order in `historicalOrders`. Hij controleert:
- het inlezen: datum 2026-04-08, tijd 08:30, long, de instap met alle decimalen, en de netto P&L;
- **CSV na API** en **API na CSV**: de positie staat er één keer, als rij van de koppeling;
- de API-rij houdt zijn **stop-loss 70.100**;
- de P&L-som is de API-trade plus de positie die alleen in de CSV staat, dus niets dubbel;
- nog een sync of import verandert niets.

**Nieuwe spec `tests/hl-csv-echt.spec.js`.** Deze speelt de wallet-opname af via `tests/helpers/hl-wallet.js`
(`speelAf`, zoals `hl-echt`), synct, en importeert dan `tests/_fixtures/hyperliquid-trade-history.csv`. Daarna
controleert hij:
- geen gesloten positie (volgens de ruwe fills, `levenslopen`) staat nul of twee keer in de journal;
- geen CSV-rij die binnen de opname valt blijft los staan (met 14 uur marge aan beide randen, voor de onbekende tijdzone);
- elke API-trade houdt zijn stop-loss;
- de P&L van de API-trades blijft gelijk;
- nog een keer inlezen voegt niets toe.

Het walletadres wordt nergens geprint. Bestaat een van de twee bestanden niet, dan meldt hij "overgeslagen" en
eindigt met exit 0. Zo ging het hier en in de poort. Om de logica toch te toetsen heb ik eenmalig een **nep-opname
en nep-CSV** in `tests/_fixtures/` gezet (zonder voorloopnul, plus een CSV-positie van vóór de opname). Uitkomst
9/9; daarna heb ik ze weer verwijderd. **Zaratras: draai `node tests/hl-csv-echt.spec.js` lokaal**, met je eigen
export op die plek.

## 2. Stop-loss bij een CSV-import zonder koppeling

- `csvGeenStopRegel(nieuw)` (nieuw, naast `sjImportCsvText`). Een extra regel komt er alleen als er nieuwe trades
  zijn en **geen** daarvan een stop heeft. De regel luidt: "Deze export bevat geen stop-loss. Vul hem per trade in,
  of koppel je exchange: dan komt hij vanzelf mee." Is een van die exchanges gekoppeld, dan valt het tweede deel weg
  ("… Vul hem per trade in."). Trades die opgingen in een API-trade tellen niet mee.
- `sjImportCsvText` hangt de regel achter de bestaande melding.
- `toast`: `white-space:pre-line`, zodat de regel echt op een eigen regel staat. Een melding langer dan
  `TOAST_LANG` (120 tekens) blijft 6 s staan in plaats van 2,6 s, anders is hij niet te lezen. Dat geldt voor
  alle lange meldingen; korte meldingen veranderen niet.
- Verder geen nieuwe UI.

**Test `tests/csv-stop-melding.spec.js`: 12/12** (vooraf 6/12 rood). Gecontroleerd voor licht en donker, op 390 px:
- Hyperliquid zonder koppeling geeft de regel, op een eigen regel;
- de melding past op het scherm;
- een herimport zonder nieuwe trades geeft geen regel;
- FTMO (heeft een SL-kolom) geeft geen regel;
- Blofin mét koppeling geeft de regel zonder "koppel je exchange".

## 3. "Verdeeld: 99.99999999999999%"

Twee oorzaken:
- `renderTPs` en `tpSum` toonden de kale float-som en vergeleken met `sum===100`.
- `tpSum` (bij het typen) zette alleen het getal en de kleur, niet de tekst "✓ volledig" / "moet samen 100% zijn".
  Die bleef dus staan zoals hij was.

Waar de percentages vandaan komen: de adapters ronden elk niveau al op 2 decimalen af (OKX, Kraken, Hyperliquid:
`toFixed(2)`; de Blofin-CSV op 1 decimaal). 33.76 + 42.97 + 23.27 is in honderdsten precies 100. Het probleem zat
dus alleen in de float-som. Maar zes keer 16.67 is 100,02, en dat valt buiten een marge van 0,01.

Wat er veranderde:
- `tpSomRegel()` (nieuw): binnen `TP_SOM_MARGE` (0,01) van 100 telt de som als volledig en toont hij "100%".
  Anders toont hij het getal met hooguit 2 decimalen in nl-notatie ("96,73%").
- `renderTPs` en `tpSum` gebruiken allebei die regel. Bij het typen klopt de hele regel nu.
- `tpPctsNaar100(tps)` (nieuw) draait bij het openen van het formulier (`openForm`). Wijkt de som niet meer af dan
  de afronding kan verklaren (`TP_AFRONDING`: 0,05 per niveau, dus ook de Blofin-CSV met 1 decimaal), dan gaan de
  honderdsten naar de grootste niveaus, en tellen ze precies op tot 100. Een echte afwijking (50 + 40) blijft staan.
  Bij opslaan gaan de rechtgezette waarden mee.
- "Gelijk verdelen" (`evenTPs`) gaf al hele getallen die samen 100 zijn. Daar veranderde niets.

De adapters heb ik niet aangepast. Dat zou zes plekken in vier exchanges raken, terwijl de waarden alleen in het
formulier samen 100 moeten zijn.

**Test `tests/tp-verdeling.spec.js`: 19/19** (vooraf 9/19 rood), licht en donker, 390 px:
- 33.76 + 42.97 + 23.27 geeft "100% ✓ volledig", nergens meer dan 2 decimalen, en de delen blijven ongewijzigd;
- TP3 op 20 typen geeft "96,73% — moet samen 100% zijn", terug naar 23.27 weer "volledig";
- 50 + 40 geeft de melding;
- zes keer 16.67 geeft "volledig" en precies 100;
- Gelijk verdelen met 3 TP's geeft "volledig";
- het getal staat in `var(--green)`.

`handmatig-scenarios` (gebruikt dezelfde regel): 37/37.

## 4. Kopieer voor Discord: playbook, setup en confirmaties

De velden: het playbook is `t.setup`. Setups en confirmaties staan in de lagen (`layers[].setups` en
`layers[].confirmations`). Ik heb de bestaande `laagSetups` hergebruikt.

- `revTagRegels(t)` (nieuw, naast `lagenTxt`): de gevulde rijen van Playbook, Setup en Confirmaties, elke waarde één
  keer. Lege rijen vallen weg.
- `revDiscordTekst`: na de eerste regel volgen "Playbook: …", "Setup: …" en "Confirmaties: …" (alleen als ze gevuld
  zijn). Het playbook stond al op de eerste regel; daar is het weggehaald, zodat het er niet twee keer staat. De
  lagen ("4H → 1H") staan op de eerste regel alleen als er lagen zijn.
- `revDiscordCanvas`: dezelfde drie als rijen in het infopaneel. De ondertitel toont nu alleen de lagen.
  - `dcPas()` (nieuw) zet zoveel waarden als passen op de rij, en dan "+n". Een te lange naam eindigt op "…".
  - De TP-rijen krijgen wat er boven de voettekst overblijft: `revTpRegels(t,max)` kreeg een optionele `max`.
    Zo wordt een volle trade "TP1, TP2, +2" in plaats van over de rand te lopen.
  - Nieuwe constanten `DC_REGEL` (38) en `DC_RAND` (14).
- Privacy-modus: de nieuwe rijen bevatten geen bedragen. Bestaande checks op bedragen in beeld en tekst blijven groen.

**Test: een nieuwe sectie in `tests/discord-meerdere.spec.js`.** De spec is in totaal 55/55; vooraf was die sectie
rood. Hij controleert:
- licht en donker: de tekst heeft precies "Playbook: Range-reclaim", "Setup: SFP, MSB" en "Confirmaties: OB, FVG"
  (OB staat in twee lagen, maar één keer in de regel);
- een trade zonder playbook, setup en confirmaties geeft geen van die regels en geen lege regels;
- het beeld met een volle trade (lang playbook, 6 setups, 9 confirmaties, 4 TP's, notitie van 400 tekens), met en
  zonder bedragen. De `fillText`-aanroepen zijn bijgehouden: niets ligt onder `DC_H − 8` of voorbij de rechterrand,
  de lijsten eindigen op "+n" en het playbook op "…".

`review-beeld` (93/93) blijft groen. Ik heb het beeld ook zelf bekeken: compact en leesbaar, niets overlapt.

## 5. `auto-sync.spec.js` wisselend rood: de oorzaak

**Geen app-fout, maar ook geen ander Hyperliquid-verzoek: het was een echte sync, en die hoort er te zijn.**
Ik heb de `fetch`-aanroepen met hun stack gemeten. Het rode verzoek is `clearinghouseState` uit
`autoSyncRun → syncExchange → syncOpenTrades`. Op dat moment stond `CONNS.hyperliquid.lastSync` **30 dagen terug**,
niet op de verse waarde die de spec zette.

Hoe dat komt:
- De spec seedde `sj_conns`, maar **geen `sj_schema`**. De app ziet die opslag daarom als ouder dan elke migratie en
  draait ze allemaal bij het opstarten.
- **Migratie v12** ("koppelingen kijken eenmalig 30 dagen terug", v1.17.1) zet `lastSync` bewust 30 dagen terug.
  `autoSyncRun(true)` ziet de sync dan als achterstallig en synct direct. Dat is precies wat v12 moet doen bij een
  lid dat bijwerkt.
- Wisselend rood, omdat de migratie asynchroon is (snapshot in IndexedDB). In de groene runs stond `sj_schema` na
  de 3 s neptijd nog op 0: de app was nog niet bij `startAutoSync`, en het verzoek kwam pas ná de check. Een
  worktree is trager bij de eerste IndexedDB, vandaar vaker rood daar.

De fix zit in de spec, en de spec is er niet zwakker van geworden:
- Hij zet `sj_schema` op de huidige `SCHEMA_VERSION`, gelezen uit `work/syncjournal.html`. De scenario's beschrijven
  dan wat ze zeggen: een lid op de huidige versie met een verse sync.
- Hij meet pas nadat `_autoSyncTimer` gestart is. Anders kon "nog niets" ook "nog niet opgestart" betekenen.
- Een nieuw scenario legt het v12-gedrag vast: opslag op schema 11 met een verse sync kijkt één keer terug en synct
  direct.

Gegenproef: zonder `sj_schema` is de strengere spec **4/4 rood** op precies die check. Met de fix **10/10 groen,
achter elkaar** (13/13 per run), en ook groen in de poort.

## Release

- `APP_VERSION` `'v1.18'` → `'v1.18.1'` (gezocht op inhoud, regel 2222). `site/version.json`:
  `{"version":"v1.18.1","released":"2026-10-26"}`.
- `CHANGELOG.md`: blok `## [v1.18.1] — 2026-10-26` boven v1.18, met Toegevoegd, Gewijzigd en Fixed. B3 staat onder
  Fixed. Het v1.18-blok is ongewijzigd.
- `site/app.html` is byte-gelijk aan `work/syncjournal.html` (`cmp`). `site/demo-dataset.json` is ververst.
- `tests/release-set.js`: zes namen erbij: `csv-synthetisch`, `csv-api-dubbel`, `hl-csv-zonder-nul`, `hl-csv-echt`,
  `csv-stop-melding` en `tp-verdeling`. Gecontroleerd: 161 namen, geen dubbele, elk bestand bestaat.
  `discord-meerdere` en `auto-sync` stonden er al in.

## De release-poort

`TZ=Europe/Amsterdam node tests/run-release.js --hier`: **157/160 groen** in 6,2 min.

- **Rood door het netwerk, net als bij v1.18:** `matrix` (19/21), `analytics-metrics` (15/17) en `tendencies`
  (13/15). Alleen "boot zonder fout" en "geen JS-errors" falen, door `net::ERR_TUNNEL_CONNECTION_FAILED`
  (`cdn.jsdelivr.net` is vanuit de container niet bereikbaar).
- **Overgeslagen (fixtures ontbreken):** helemaal `csv-import`, `hl-echt` en `hl-csv-echt`; gedeeltelijk
  `okx-levensloop`, `hyperliquid-levensloop`, `kraken-levensloop`, `blofin-levensloop` en `scenario-levensloop`.
- **Pas groen bij de herkansing:** `okx-partial-herstel` en `plan-doorloop` (allebei bekend uit het v1.18-rapport),
  en **`privacy-mode`**. Die laatste stond niet in het v1.18-rapport. Los gedraaid was hij 5/5 groen. De poging die
  faalde laat geen details achter in het log, dus de oorzaak weet ik niet. Mijn wijzigingen raken de privacy-modus
  alleen via de Discord-tekst, en die checks zijn groen. Houd hem in de gaten bij de lokale poort.
- `ruwe-data` was deze keer meteen groen.
- **Niets anders rood.** Alle nieuwe specs en `auto-sync` waren meteen groen.

Voorbereiding op deze machine: `npm install`. Daarna heb ik `playwright` en `playwright-core` gekoppeld aan de
vooraf geïnstalleerde versie (zoals bij `csv-dubbel-ci`).

## Open punten

1. Zaratras: draai lokaal `node tests/hl-csv-echt.spec.js`, met de echte export in
   `tests/_fixtures/hyperliquid-trade-history.csv` naast de wallet-opname. Draai ook de volledige poort lokaal
   (`node tests/run-release.js`). Daar horen ook `matrix`, `analytics-metrics` en `tendencies` groen te zijn.
2. Versienummer: v1.18.1 is een patch. De Discord-regels zijn een kleine toevoeging aan een bestaande functie.
3. Daarna de stappen 7–8 van de release-flow (`site/` naar de deploy-repo, pushen alleen op Denny's "push").
