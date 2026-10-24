# SyncJournal — Backlog

*Opgeruimd op 29-09-2026.* Van de 84 open punten waren er 24 al gedaan of vervallen; de meeste
stamden uit april–juni en waren geschreven voor de oude TradeJournal. Elk twijfelgeval is in de code
nagekeken. Wat er met elk punt is gebeurd staat onderaan; de vorige versie, met 137 afgeronde punten
en alle onderzoeksnotities, staat in [docs/backlog-archief-2026-09-29.md](docs/backlog-archief-2026-09-29.md).

**Hoe te lezen.** Elke story heeft een ID (**F** functie · **B** bug · **T** tests · **C** code · **W** werkwijze), een
prioriteit (1 = eerst) en een effort (XS < 1 uur · S ≈ halve dag · M ≈ dag · L = meerdere dagen). Per
story: waarom het ertoe doet, het plan in stappen, en wanneer hij klaar is.

**Werkwijze** (uit CLAUDE.md): bugs beginnen met een test die de fout laat zien; M- en L-stories eerst
een plan-document (`superpowers:writing-plans`); exchange-logica alleen in de adapter van die exchange;
elke wijziging eindigt met `node tests/run-release.js` groen.

---

## Overzicht

| ID | Story | Prio | Effort | Hangt af van |
|---|---|---|---|---|
| ~~F1~~ | ~~TP's in de presentatie en in Kopieer voor Discord~~ — ✅ **gedaan in v1.9.1** | — | — | — |
| **F2** | Kopieer voor Discord met meerdere trades: één voor één + alles downloaden | 2 | S | samen met F1 |
| **F3** | Kraken: oorspronkelijke stop-loss automatisch — 🔨 **gebouwd, branch `kraken-stoploss`** | 1 | — | release v1.11 |
| ~~F4~~ | ~~Kraken: lopende positie krijgt zijn stop al vóór het sluiten~~ — ✅ **gedaan in v1.11** | — | — | — |
| **F5** | Hoe liep de trade af: ~~exit-reden (TP/SL/Close)~~ ✅ v1.11 · stopbeweging (BE/strakker/ruimer) nog open | 1 | S | F3 |
| **F6** | Kraken: geplande TP's uit de trigger-historie | 2 | S | F3 |
| **F7** | Analytics: stop-management en uitvoering | 1 | M | F5 (F6 voor één blok) |
| ~~F8~~ | ~~Hyperliquid: oorspronkelijke stop-loss, geplande TP's, TP/SL/Close~~ — ✅ **gedaan in v1.12** | — | — | — |
| **F9** | Override-knop voor een stop van de exchange ("Zelf aanpassen" / "Terug naar Kraken") | 2 | S | F3 |
| **F10** | OKX en daarna Blofin: stop-loss en TP/SL/Close, elk in de eigen adapter — **OKX ✅ v1.15**, Blofin nog open | 2 | M | F8 |
| ~~B1~~ | ~~Kraken: lopende positie zonder partial en zonder stappen~~ — ✅ **gedaan in v1.13** | — | — | — |
| ~~B2~~ | ~~OKX: contractwaarde-vangnet kent geen USDC-perps~~ — ✅ **gedaan 24-10** (per contractfamilie; volgende release) | — | — | — |
| **W2** | Ruwe exchange-data kunnen vastleggen (dev-modus terug) | 2 | M | — |
| **C1** | Lege staten: één manier, met een volgende stap | 2 | S + M | — |
| ~~C5~~ | ~~Acht tag-soorten, acht kleuren, overal gelijk~~ — ✅ **gedaan in v1.3** | — | — | — |
| **T1** | CSV-import testen op CI | 2 | M | — |
| **W1** | Worker: staat `Access-Control-Allow-Origin` op `*`? | 2 | XS (Denny) | — |
| **B3** | Controleren: telt dezelfde positie dubbel via CSV én API? | 2 | S | — |
| **W3** | Worker v25: `okxHost` alleen uit een vaste lijst (lek sinds v19) en de ongebruikte `orders`-verzoeken uit `algos` weg (review 24-10) | 1 | XS | — |
| **B6** | OKX: waarschuwing bij een onbekende contractsoort in het vangnet; SL koppelen op het exacte contract i.p.v. de munt (review 24-10) | 3 | XS | — |
| ~~B5~~ | ~~P&L-percentages van −107% en 2.834% bij oudere trades~~ — ✅ **gedaan in v1.11** | — | — | — |
| **T2** | Oude-app-specs herschrijven of schrappen | 3 | L | besluit AI-coach (deels) |
| **C2** | CSV-parser per exchange opsplitsen | 3 | M–L | T1 |
| **T3** | Levensloop-toets voor FTMO, één gedeelde vorm | 3 | M | T1 |
| **T4** | `npm test` repareren | 3 | XS | — |
| **T5** | `drive-backup` is timing-gevoelig bij 4 specs tegelijk | 3 | XS | — |
| **C3** | Account-label opzoeken in plaats van kopiëren | 3 | S | — |
| **W3** | Graphify verversen of de instructie weghalen | 3 | S | — |
| **W4** | Eerste echte PR met beide reviewers | 3 | XS | volgende release |
| **C4** | XLSX-ondersteuning eruit | gepland | S | na 16 nov (MEXC weg) |

---

## Functies

### F1 · TP's in de presentatie en in Kopieer voor Discord — ✅ gedaan in v1.9.1

**Waarom.** Denny en de community traden met deelsluitingen (TP1, TP2, …). In v1.9 tonen de
presentatie en het Discord-beeld alleen een tegel "TP geraakt 2/3". De niveaus zelf (prijs, deel van
de positie, geraakt of niet) staan alleen op de per-trade-pagina en in het coach-pakket. Juist bij het
presenteren aan de coach en bij delen op Discord wil je zien wáár je afbouwde. (Denny, 14-10-2026.)

**Wat er al is.** De TP-data staat in `t.tps` (`price`, `pct`, `hit`). `tpStats(t)` geeft de niveaus,
het gewogen exit-niveau en de gerealiseerde R; `tpBreakdown(t)` tekent ze op de per-trade-pagina. Bouw
daarop, niet opnieuw.

**Plan.**
1. Test eerst, in `tests/review-beeld.spec.js`:
   - een trade met 3 TP's (2 geraakt) geeft in het zijpaneel van de presentatie drie regels met prijs en %, en de geraakte zijn gemarkeerd;
   - `revDiscordTekst` bevat een TP-regel ("TP1 81.230 ✓ · TP2 82.009 ✓ · TP3 82.616");
   - een trade zonder TP's toont niets extra's: geen leeg kopje.
2. **Presentatie** (`revInfoVol`): onder *Lagen (top-down)* een blok *Take-profits* met `tpBreakdown(t)` of
   een compacte variant (TP · prijs · % · ✓).
3. **Discord-beeld** (`revDiscord`): in het infopaneel rechts een regel per TP, met prijs en een groen ✓
   als hij geraakt is. Maximaal 4 regels; daarna "+n". Controleer dat het paneel (hoogte `DC_H`) niet
   overloopt bij lange notities en 4 TP's.
4. **Discord-tekst** (`revDiscordTekst`): één regel met de TP's.
5. Kijken in licht en donker, en het Discord-PNG bekijken met een echte chart.

**Klaar als** de presentatie, het Discord-beeld en de Discord-tekst de TP-niveaus tonen voor trades
mét TP's, er niets verandert voor trades zónder, en `node tests/run-release.js` groen is. Release als
patch (v1.9.1): een kleine aanpassing aan bestaande functies.

### F2 · Kopieer voor Discord met meerdere trades — prio 2 · S

**Waarom.** Selecteer je 3 trades en klik je *Kopieer voor Discord*, dan krijg je alleen de eerste
(Denny, 14-10-2026). Dat is geen fout in de code: het klembord van de browser kan maar één afbeelding
tegelijk bevatten. De knop moet dat wel zichtbaar oplossen.

**Gekozen aanpak.** Geen collage: die maakt elke chart onleesbaar en Discord verkleint grote plaatjes
(10 MB-limiet). Alleen een waarschuwing laat het werk bij de gebruiker.
1. **Eén voor één.** Na het kopiëren verandert de knop in *📋 Kopieer 2 van 3 (BTC/USDC 05-10)*, enz.
   Discord laat je in één bericht meerdere keren plakken (tot 10 bijlagen): plakken, klikken, plakken,
   en dan één keer versturen. De toast zegt "1 van 3 gekopieerd, plak en klik dan op Volgende".
   De stand (`STATE.revDiscordIdx`) gaat terug naar 0 als de selectie verandert.
2. **Alles downloaden** als tweede knop in *Selectie & delen*: één PNG per trade
   (`discord-<datum>-<pair>.png`), met de teksten samen op het klembord. Die bestanden sleep je in één
   keer naar Discord. De browser kan één keer toestemming vragen voor meerdere downloads; zeg dat in
   de knoptekst of de toast.

**Bouwen op.** `revDiscord(id)` geeft al `'beeld' | 'download' | 'tekst'` terug. Splits het tekenen
van het canvas af (`revDiscordCanvas(t, img, hide) → Blob`), zodat de klembord-route en de
download-route het delen. Dat stond ook als nit in de review van v1.9.

**Plan.**
1. Test eerst, in `tests/review-beeld.spec.js`:
   - met 3 geselecteerde trades zegt de knop eerst "1 van 3", na een klik "2 van 3", daarna "3 van 3", en daarna weer vanaf 1;
   - een andere selectie zet de teller terug naar 0;
   - *Alles downloaden* geeft 3 downloads met de juiste namen;
   - met 1 trade ziet de knop eruit zoals nu.
2. `revDiscordCanvas` afsplitsen; `revDiscord` en de nieuwe `revDiscordAlles()` gebruiken hem.
3. Knop en toast in `revSelPanel` aanpassen; tweede knop *⬇ Alle beelden voor Discord*.
4. Met de hand in Discord testen: plakken, volgende, plakken, versturen.

**Klaar als** je met 3 geselecteerde trades alle drie in één Discord-bericht krijgt, op volle
kwaliteit, en `node tests/run-release.js` groen is. Samen met F1 als patch (v1.9.1).

### F3 · Kraken: oorspronkelijke stop-loss automatisch — 🔨 gebouwd, wacht op release v1.11

**Waarom.** Zonder stop is de R van een trade niet te bepalen ("—"), en dan kloppen gemiddelde R,
expectancy en risico niet. Kraken bewaart elke stop-order in de trigger-historie.

**Stand (18-10-2026).** Plan: [docs/plan-kraken-stoploss-2026-10-17.md](docs/plan-kraken-stoploss-2026-10-17.md).
Worker v22 (actie `triggers`) is live. De app-kant staat op branch `kraken-stoploss`, met
`tests/kraken-stoploss.spec.js` (ook getoetst tegen Denny's echte triggers, 4/4) en `tests/worker-triggers.spec.js`.
- De R rekent met de **oorspronkelijke** stop. Schuif je hem later naar break-even, dan blijft het risico
  van je instap de noemer; de trade krijgt `stopVerschoven: true`.
- Een stop die je zelf invult of wist (`stopBron: 'gebruiker'`) raakt de sync nooit meer aan.
- Trades van vóór de update krijgen hun stop één keer, voor zover Kraken's historie reikt (bij Denny vanaf 14-10).

**Klaar als** v1.11 live staat: versie, changelog, CLAUDE.md "productie = Worker v22", release-poort groen.

### F4 · Kraken: lopende positie krijgt zijn stop al vóór het sluiten — ✅ gedaan in v1.11

**Gedaan (18-10-2026).** Zelfde triggers-verzoek als de sync, venster opening → nu; test in `tests/kraken-stoploss.spec.js`.
Bij het sluiten gaat de stop mee naar de gesloten trade (als jouw veld, zonder "van Kraken"; de waarde is dezelfde).

**Waarom.** Nu krijgt een Kraken-trade zijn stop pas als hij dicht is. Tijdens de trade zie je dus
nog geen risico en geen R:R, terwijl Kraken de stop al kent (Denny's open long van 16-10: stop 79.314).

**Plan** (Task 5 van het F3-plan).
1. Test eerst: een open long met een Sell-stop 79.314 krijgt die stop op de open rij, met `stopBron: 'kraken'`.
   Wordt hij daarna naar break-even geschoven, dan blijft 79.314 staan.
2. Dezelfde `triggers`-aanroep van de sync, met als venster de opening van de lopende positie tot nu (`this._lopend`).
3. Vul de stop van de open rij op dezelfde manier: alleen als hij leeg is of `stopBron: 'kraken'` heeft.
4. **Niet** `/openorders` gebruiken: die geeft de huidige stop, en na verschuiven klopt de R dan niet meer.

**Klaar als** een lopende Kraken-positie zijn oorspronkelijke stop toont, en het sluiten hem niet verandert.

### F5 · Hoe liep de trade af: stopbeweging en exit-reden vastleggen — prio 1 · S

**Waarom.** `stopVerschoven` zegt alleen dát de stop bewoog, niet welke kant op. Een stop naar
break-even of strakker is risicobeheer; een stop **verder weg** zetten is verliezen laten lopen, een
heel ander signaal. En je weet nu niet of een trade dichtging op je stop, op een TP of met de hand.
Kraken legt beide vast (snapshot 18-10): een geraakte trigger is `OrderTriggerActivated`, en bij een
sluiting met de hand annuleert Kraken alles met `would_not_reduce_position`. Dit is de basis voor F7.

**Velden** (op de trade, naast `stop`):
- `stopLaatst`: de laatste stop vóór de sluiting.
- `stopBeweging`: `'geen' | 'be' | 'strakker' | 'ruimer'`.
  - **be**: binnen 0,1% van de entry.
  - **strakker**: dichter bij de entry, of voorbij de entry de winst in (trailing).
  - **ruimer**: verder van de entry dan de oorspronkelijke stop.
- `exitReden`: `'stop' | 'tp' | 'hand' | 'liquidatie'`, voor het deel dat de positie sloot.
  - **stop** of **tp**: de laatste `geactiveerd` vóór de sluiting is een stop- of TP-trigger (SL/TP volgens dezelfde kant-regel).
  - **hand**: er is niets geactiveerd.
  - **liquidatie**: komt uit de account-log.

**Plan.**
1. Test eerst, in `tests/kraken-stoploss.spec.js`, uit de fixture: positie 3 (16-10 11:19) → `exitReden: 'stop'`,
   positie 4 (14:32) → `'hand'`, positie 1 (14-10) → `'hand'` na TP1 (`geactiveerd` op 80.000 telt als deelsluiting,
   niet als exit). Plus synthetisch: naar BE → `'be'`, stop verder weg → `'ruimer'`.
2. `_stopVoorLevensloop` geeft naast `stop` en `verschoven` ook `laatst`, `beweging` en `exitReden`.
   De keten-logica die de stop-order volgt bestaat al.
3. Invullen in `afterImport`, met dezelfde regel als de stop: niet over iets dat de gebruiker zelf koos.
4. In het formulier: onder de stop "later naar BE" / "later strakker" / "later verder weg ⚠", in plaats van alleen "later verschoven".
5. **Gedeelde vorm**, zodat Hyperliquid (F8) dezelfde velden vult. De berekening van de beweging is een pure
   helper zonder exchange-aannames (`stopBewegingVan(dir, entry, stop, laatst)`); de exit-reden blijft per adapter.

**Klaar als** de vier fixture-posities de juiste exit-reden hebben, een verder weggezette stop als `'ruimer'`
herkend wordt, en de release-poort groen is. Patch of minor: geen cijfers veranderen, wel nieuwe info → **minor**.

### F6 · Kraken: geplande TP's uit de trigger-historie — prio 2 · S

**Waarom.** De TP's van een Kraken-trade komen nu uit de fills, dus alleen de TP's die geraakt zijn.
De TP die je plande maar die niet geraakt werd, ontbreekt. Daarmee mis je "gepland tegenover gehaald".
Kraken heeft ze wél: TP-triggers aan de winstkant, met hun eigen qty (16-10 06:51: 82.932 / 83.582 / 85.332
voor 0,0038 / 0,0019 / 0,0019).

**Plan.**
1. Test eerst, uit de fixture: positie 2 krijgt 3 geplande TP's met prijs en % (49/25/25), geen enkele geraakt;
   positie 1 krijgt TP1 80.000 geraakt (uit de fill) plus TP2 78.500 en TP3 77.200 gepland.
2. In de adapter: triggers aan de winstkant, sluitende kant, binnen de levensloop, die niet de stop zijn.
   Gewijzigd of geannuleerd en opnieuw geplaatst → de laatste prijs vóór de sluiting (een TP mag je verzetten, de stop niet).
3. Samenvoegen met de `tps` uit de fills: een fill binnen 0,2% van een geplande TP markeert die als geraakt.
   Een fill zonder geplande TP blijft een eigen regel. Bestaand gedrag voor trades zonder triggers blijft gelijk.
4. Met `rrPlanned` (geplande R:R van de gewogen TP's tegenover de oorspronkelijke stop), maar alleen als de gebruiker die niet zelf invulde.

**Klaar als** een Kraken-trade alle geplande TP's toont, de geraakte gemarkeerd, en de presentatie en
Discord (F1) ze laten zien.

### F7 · Analytics: stop-management en uitvoering — prio 1 · M

**Waarom.** Met de oorspronkelijke stop (F3), de stopbeweging en de exit-reden (F5) en de geplande TP's (F6)
kun je vragen beantwoorden die je nu niet ziet (Denny, 18-10-2026). De R blijft overal de R ten opzichte van
je **oorspronkelijke** risico; dat maakt trades vergelijkbaar.

**Blokken** (één nieuw paneel *Stop & uitvoering* op de Analytics-pagina, volgt de filterbalk):
1. **Verliezen in R.** Gemiddeld verlies in R, en het aandeel verliezen slechter dan −1,1R.
   Rond −1R betekent dat je je stop respecteert. Slechter wijst op slippage of een ruimer gezette stop.
   Een klik toont die trades.
2. **Break-even schuiven.** Hoe vaak, de gemiddelde R en winrate met en zonder verschoven stop, en hoeveel
   trades op break-even eindigen. Zonder koersdata kunnen we niet zeggen wat er zónder schuiven was
   gebeurd; zeg dat in het paneel, en beweer het niet.
3. **Stop verder weg gezet.** Aantal trades en hun gemiddelde R, als waarschuwing. Telt mee als fout
   (`mistakes`) in discipline-statistieken, maar alleen als voorstel: de gebruiker bevestigt.
4. **Hoe ging de trade dicht.** Verdeling stop / TP / met de hand, met de gemiddelde R per soort.
5. **Gepland tegenover gehaald** (vereist F6). Geplande R:R naast de gehaalde R, en het aandeel trades dat TP1, TP2 en TP3 haalde.

**Toestanden** (CLAUDE.md):
- **Leeg:** "Nog geen trades met een stop-loss. Die komen vanzelf bij Kraken-trades, of vul de stop in bij een trade."
- **Niets in beeld:** het filter laat geen trades met een stop over.
- **Eén trade:** wel tonen, met "te weinig trades voor een conclusie" onder 10.

Trades zonder stop tellen nergens mee; zeg hoeveel dat er zijn ("12 van 40 trades hebben een stop").

**Plan.** Eerst een demo met 2 varianten (`/prototype`, `demos/`) met Denny's echte data, dan pas in de app.
Gebruik `gemR` en `tradeROrNull`, en `emptyState(key)` voor de lege staten.

**Klaar als** de blokken kloppen met een met de hand nagerekende set trades (test), licht en donker
bekeken zijn, en de release-poort groen is.

### F9 · Override-knop voor een stop van de exchange — prio 2 · S

**Waarom.** De stop van de exchange is vergrendeld (v1.11). Plaats je bij de exchange per ongeluk een verkeerde stop
(typfout, een minuut later verbeterd), dan rekent de journal met die typfout als oorspronkelijke stop. Advies van
18-10-2026: een bewuste, zichtbare override in plaats van een automatische "typfout"-regel die gokt.

**Plan.**
1. Naast het vergrendelde stop-veld een knop **Zelf aanpassen**: zet `stopBron:'gebruiker'`, bewaart de waarde van de
   exchange (`stopExchange`) en maakt het veld vrij. De sync laat `stopBron:'gebruiker'` daarna met rust (nu wint de
   exchange altijd: die regel krijgt deze ene uitzondering).
2. Label: "Stop-loss (zelf aangepast · Kraken: 81.000)".
3. Knop **Terug naar Kraken**: `stopBron` weer van de exchange, de waarde van de exchange terug.
4. Tests: override overleeft een sync; terugzetten herstelt; geldt per trade, voor elke exchange (gedeeld, via `EXMAP`).

**Klaar als** een verkeerde stop van de exchange met twee klikken te corrigeren en terug te draaien is.

### F8 · Hyperliquid: oorspronkelijke stop-loss en geplande TP's — prio 1 · M

**Waarom.** Hetzelfde als F3 en F6, voor Hyperliquid. Daar legt `historicalOrders` elke statuswijziging vast.
Een wijziging is annuleren plus een nieuwe order (nieuw oid), dus de oorspronkelijke stop is terug te vinden.

**Plan:** [docs/plan-hyperliquid-stoploss-2026-10-17.md](docs/plan-hyperliquid-stoploss-2026-10-17.md),
met een risicotabel. Hergebruik de gedeelde regels uit F3: `stopBron`, het formulier, het label en de
`stopBeweging`-helper uit F5. Geen Worker nodig: wallet-data is openbaar.

**Klaar als** het plan is uitgevoerd en `tests/hl-echt.spec.js` de stops van Denny's echte account toont.

---

## Bugs

### B1 · Kraken: lopende positie zonder partial en zonder stappen — prio 1 · M

**Stand 07-10-2026.** Hyperliquid is af: een lopende positie met een TP is sinds v1.3.6 één rij met
status partial, en sinds v1.4 staan bij Hyperliquid, OKX en Blofin de stappen er vanaf de opening
(melding Denny: "dit wil je al zien vanaf dat die open gaat, voor elke exchange"). Kraken niet: daar
staat een lopende positie als gewoon "open", zonder stappen, en het geboekte deel van een TP verschijnt
pas als de hele positie dicht is. Vastgelegd als "bekend gat" in
[tests/partial-alle-exchanges.spec.js](tests/partial-alle-exchanges.spec.js) (de Kraken-check).

**Waarom het bij Kraken niet meekwam.** De stappen komen uit de positie-gebeurtenissen
(`_krLevenslopen`), en die geeft alleen afgesloten levenslopen terug. Bovendien haalt een gewone sync
gebeurtenissen op vanaf de vorige sync: de opening van een positie die dagen geleden begon, ligt buiten
dat venster. Hyperliquid kijkt in dat geval eenmalig verder terug (`liepAl` in `fetchTrades`); Kraken
niet.

**Plan.**
1. Test eerst: in partial-alle-exchanges de Kraken-check omdraaien (lopende positie met één afbouw →
   partial met het geboekte deel apart), en in een eigen spec een open Kraken-positie die zijn instap
   als stap toont. Zien falen.
2. `_krLevenslopen` en `levenslopenUitAccountLog` (die de lopende levenslopen al apart houdt): een
   lopende levensloop met afbouw → status partial, zonder afbouw → de stappen aan de open rij, zoals
   Hyperliquid in `_reconstructTrades(…, metOpen)`.
3. Terugkijken als een levensloop al liep bij het begin van het venster, zoals Hyperliquid. Nagaan of
   de Worker-actie `trades` een vroeger `startTime` aankan zonder de rate-limit te raken.
4. Past bij de geplande Kraken-sessie 2 (het events-pad met fillTime als openingstijd vervangen); samen
   doen. Alleen in de Kraken-adapter.

**Klaar als** de spec voor alle vier de API-exchanges hetzelfde gedrag toetst, en de release-poort groen is.

**Al gedaan (14-10-2026, B4):** de openingstijd van een lopende positie komt uit de positie-events (`_lopend` in `_krLevenslopen`, ingevuld door `afterImport`), niet meer uit `/openpositions`, dat geen `fillTime` documenteert en 1970 stuurde. `fetchTrades` kijkt 30 dagen terug zolang een open rij geen tijd heeft. Stap 3 hieronder is daarmee voor de openingstijd al gedekt; de stappen en de partial-status nog niet. Test: [tests/kraken-opentijd.spec.js](tests/kraken-opentijd.spec.js).

### B2 · OKX: contractwaarde-vangnet kent geen USDC-perps — prio 2 · S

**Waarom.** `ExchangeAPI.okx._ctvFallback` ([work/syncjournal.html:7123](work/syncjournal.html#L7123))
kent 14 sleutels, allemaal `*-USDT-SWAP`. Faalt de live lookup van `/public/instruments`, dan wordt de
size van een USDC-positie verkeerd omgerekend. Meestal vangt de live lookup het af — dit is het
vangnet — maar OKX is je actieve exchange en EEA-accounts handelen in USDC.

**Plan.**
1. Test eerst: met een lege cache geeft `_ctVal('BTC-USDC-SWAP')` nu geen of een verkeerde waarde.
2. De echte `ctVal`-waarden van de USDC-tegenhangers ophalen uit OKX's publieke
   `/api/v5/public/instruments?instType=SWAP` (geen sleutel nodig). Niet gokken: USDC- en
   USDT-contracten kunnen een andere grootte hebben.
3. Toevoegen aan de map; test groen.

**Klaar als** elke USDT-sleutel in het vangnet een USDC-tegenhanger heeft, met de waarde van OKX zelf.

**✅ Gedaan 24-10-2026** (`tests/okx-ctval.spec.js`). Bij het meten bleek: **USDC-SWAP-contracten bestaan niet**; EEA-accounts
handelen USDC op FUTURES, de X-Perps (`BTC-USD_UM_XPERP-310404`) en datum-futures (`BTC-USD_UM-261030`). Het vangnet
kent nu de contractwaarde per familie (instrument zonder vervaldatum), uit OKX's eigen lijst. Daarbij twee fouten
gevonden: de oude uitzondering gaf een BTC-datum-future 0,0001 in plaats van 0,01 (100× te klein), en ETH X-Perp viel
terug op 1 in plaats van 0,001 (1000× te groot).

### B3 · Controleren: telt dezelfde positie dubbel via CSV én API? — prio 2 · S

**Waarom.** In de oude app kon één positie twee keer binnenkomen: via een CSV-import én via de
API-sync, met verschillende id's. Of dat in SyncJournal nog kan is onbekend — de import is sindsdien
herbouwd. Het is een stille fout: je P&L verdubbelt zonder melding.

**Plan.**
1. Test eerst: een CSV-fixture importeren van een exchange met API-koppeling (Blofin of Kraken — de
   fixtures staan lokaal), daarna dezelfde positie syncen via een nagebootste API-respons.
2. Groen → story sluiten, de spec blijft als bewaking. Rood → dedup in de adapter van die exchange,
   niet in een gedeelde helper.

**Klaar als** de spec bestaat en groen is. Effort M als het een echte fout blijkt.

---

### B5 · P&L-percentages van −107% en 2.834% bij oudere trades — ✅ gedaan in v1.11

**Wat er mis was** (Denny, 18-10-2026). Het percentage onder de P&L is P&L ÷ je saldo op dat moment. Dat saldo
rekent de journal terug: het huidige totaalsaldo min alle P&L die daarna kwam. Daarin telden ook **backtests** mee
(bij Denny 39 stuks, +$814), terwijl dat geen geld op je account is. Voor maart kwam de basis daardoor rond nul of
onder nul uit.

**Fix.** `_pctBases` en `pnlPctTotal` tellen alleen live trades (`isLive`). Een backtest heeft zelf geen
percentage meer. Test: `tests/pnl-pct.spec.js` (backtest van +814 verandert de basis niet). Op Denny's data: de
basis van 23-03 is $309,58 (−0,96%), geen basis meer onder nul, hoogste percentage 6%.

**Wat blijft:** stortingen en opnames ziet de journal niet. Wie geld bijstort of opneemt, krijgt voor de periode
daarvóór een basis die zoveel te hoog of te laag is. Zie het idee "stortingen" onder *Ideeën*. Het vaste
referentiebedrag (Instellingen → Accounts) blijft de uitwijk.

## Tests

### T1 · CSV-import testen op CI — prio 2 · M

**Waarom.** `tests/_fixtures/` is terecht gitignored (echte exports), dus op CI slaat `csv-import`
zichzelf over — ook in de groene runs van vandaag (`⏭️ csv-import … overgeslagen`). Lokaal draait hij
weer sinds de worktree-poort die map koppelt. Import is de risicovolste laag, en de spec dekt 3 van de
6 formaten (Blofin, Kraken, Hyperliquid).

**Plan.**
1. Per exchange één **geanonimiseerde** export in `tests/fixtures/csv/` (die mag in git): echte
   kolommen en randgevallen, verzonnen bedragen en id's. MEXC (xlsx), FTMO en OKX erbij.
2. `csv-import.spec.js` leest die map; de lokale echte exports blijven een extra laag.
3. Vóór de commit controleren dat er geen account-id's, wallets of namen in staan.

**Klaar als** CI geen `⏭️ csv-import` meer toont en alle zes formaten gedekt zijn. Nodig vóór C2 en T3.

### T2 · Oude-app-specs herschrijven of schrappen — prio 3 · L

*Voegt de oude stories 17 (AI-coach), 18 (accounts) en 20 samen.*

**Waarom.** 81 specs laden nog de bevroren oude app en worden overgeslagen in de volle run. 7 laden
SyncJournal maar zoeken teksten van de oude journal ("Verbinding testen", "Refresh trades",
milestones, donatie) — dat zijn de enige rode in de volle run (90/97). Een mechanische omzetting gaf
op 29-09 64 rode en ~20 vals-groene specs, dus: per spec.

**Plan** (eerst een plan-document in `docs/`):
0. Fundament: `tests/helpers/seed.js` laten seeden via `dov-page.js` → `seed()` / `applyBackup`
   (`sj_` + IndexedDB, niet `tj_`), en één navigatiehelper via `go(page)` in plaats van ~50 keer
   knoppen op tekst zoeken.
1. Triage-tabel per spec: **herschrijven**, **schrappen** (de feature bestaat niet in SyncJournal:
   zes thema's, milestones, donatie, mindset, hash-routing) of **al gedekt** door een release-spec.
2. Per cluster herschrijven, met de lessen uit de review: naast elke "NIET getoond"-check een
   positieve check; niet zoeken in `page.content()` (daar staat de broncode ook in); wachten op iets
   dat `boot()` zet, niet op de statische kop.
3. De AI-coach-cluster (12 specs) pas na het besluit of de AI-coach blijft.

**Klaar als** geen spec meer alleen `tradejournal.html` laadt, de volle run groen is, en wat een
release moet tegenhouden in `tests/release-set.js` staat.

### T3 · Levensloop-toets voor FTMO, één gedeelde vorm — prio 3 · M

**Waarom.** Kraken, Blofin, Hyperliquid en OKX hebben een levensloop-spec; FTMO niet. En de vier
toetsen elk iets anders. (MEXC vervalt: koppeling gestopt.)

**Plan** (na T1): één toets — open → partial → partial → dicht → opnieuw importeren voegt niets toe —
die per adapter over diens fixture draait. FTMO erbij via zijn CSV. De bestaande specs blijven voor
de eigenaardigheden per exchange.

**Klaar als** vijf exchanges dezelfde toets doorlopen.

### T4 · `npm test` repareren — prio 3 · XS

**Waarom.** `package.json` zegt `"test": "playwright test"`, en `playwright.config.js` pakt
`**/*.spec.js` — ook de losse node-scripts, die zelf een browser starten en `process.exit` aanroepen.
Onbruikbaar; CLAUDE.md waarschuwt er nu voor.

**Plan.** `"test": "node tests/run-release.js"` en `testMatch` beperken of weghalen. De waarschuwing
in CLAUDE.md eruit.

**Klaar als** `npm test` hetzelfde doet als de release-poort.

### T5 · `drive-backup` is timing-gevoelig bij 4 specs tegelijk — prio 3 · XS

**Waarom.** In de release-poort van v1.2 (29-09) faalde `drive-backup` de eerste keer en slaagde hij
bij de herkansing (39 s). Los draaide hij 3 van de 3 keer groen. De herkansing verbergt dit nu —
maar een spec die op timing leunt, geeft vroeg of laat een vals rood of groen.

**Plan.** De vaste wachttijden in de spec vervangen door wachten op een concreet signaal (de
back-up is geschreven). Daarna de poort een paar keer draaien zonder herkansing
(`GEEN_HERKANSING=1 node tests/run-release.js`).

**Klaar als** hij bij 4 tegelijk drie keer achter elkaar zonder herkansing groen is.

---

## Code

### C1 · Lege staten: één manier, met een volgende stap — prio 2 · S + M

**Waarom.** `equity()` zet bij nul trades een nulpunt in de reeks
([work/syncjournal.html:2996](work/syncjournal.html#L2996)) en tekent een leeg assenstelsel zonder
uitleg — het lijkt een fout. Daarnaast bestaan naast de helper `emptyState()`
([:2930](work/syncjournal.html#L2930), teksten in `EMPTY` op [:2921](work/syncjournal.html#L2921))
nog zeven losse classes: `lt-empty` (5×), `revempty` (3×), `txempty`, `thm-empty`, `tagcard-empty`,
`ml-empty`, `empty-h`.

**Plan.**
1. Test eerst: dashboard met een periode zonder gesloten trades → een lege staat met een volgende
   stap. Twee teksten: "nog nooit data" en "niets in deze periode" zijn verschillende meldingen.
2. `equity()` geeft bij lege data `emptyState(...)` terug in plaats van het nulpunt. Andere
   grafiekhelpers nalopen op `data.push({x:0`.
3. Per scherm één losse class naar `emptyState()`, CSS opruimen. Pixel-diff als vangnet, licht én donker.

**Klaar als** er geen losse `*-empty`-classes meer zijn en elke lege-staat-tekst in `EMPTY` staat en
een volgende stap noemt.

### C5 · Eén kleurenschema voor tags, en emoties gesplitst in positief en negatief — ✅ gedaan in v1.3

*Gebouwd 29-09-2026 na akkoord op de demo ([demos/tag-kleuren-demo.html](demos/tag-kleuren-demo.html)).*
*Spec: `tests/tag-kleuren.spec.js` (64 checks, beide thema's). Afwijking van het plan: de emotiekaart*
*zet Negatief en Positief onder elkaar in plaats van naast elkaar — de kaarten zijn ~360px breed.*

*Gevraagd door Denny, 29-09-2026.*

**Waarom.** Elke soort tag heeft op drie plekken drie verschillende kleuren:

| Soort | Trade-formulier | Instellingen → Tags | Tags-kolom (overzicht) |
|---|---|---|---|
| Setups | neutraal (aangeklikt: accentblauw) | blauw | blauw |
| Bevestigingen | neutraal | groenblauw | groenblauw |
| Emoties, negatief | rood | amber, één lijst | amber |
| Emoties, positief | groen | amber, één lijst | amber |
| Fouten | amber | oranje | oranje |

Instellingen → Tags belooft *"elke categorie z'n eigen kleur, precies zoals ze in de trade-picker
verschijnen"* — dat klopt niet. En de splitsing positief/negatief in het formulier komt uit een vaste
lijst in de code (`EMO_NEG`, [work/syncjournal.html:1738](work/syncjournal.html#L1738)): een emotie
die je zelf toevoegt (bv. "Angstig") staat daar niet in en belandt bij **Positief**, in het groen,
zonder dat je dat ergens kunt rechtzetten.

**Plan.**
1. Eén bron: elke soort één kleur, uit thema-tokens (`var(--red)`, `var(--green)`, `var(--amber)` …)
   in plaats van hex, zodat licht en donker kloppen.
2. De splitsing wordt data: `tagConfig.emotionNeg` (welke emoties negatief zijn). Bij het laden gevuld
   uit de huidige vaste lijst als het veld ontbreekt — ook voor oude back-ups.
3. Instellingen → Tags: de emotiekaart in twee kolommen, Negatief en Positief; toevoegen aan een kant,
   met één klik verplaatsen naar de andere.
4. Formulier: leest de splitsing uit `emotionNeg`; aangeklikte setups en bevestigingen in hun eigen kleur.
5. Tags-kolom volgt vanzelf via `tagColor`, die alleen positief/negatief hoeft te kennen.
6. `EMO_NEG` en het ongebruikte `EMO_POS` weg. `CALM_EMOS` blijft (rating in de coach-export).
7. Test: dezelfde tag heeft op alle drie de plekken dezelfde kleur, in licht en donker; een zelf
   toegevoegde negatieve emotie staat overal bij Negatief; een oude journal zonder `emotionNeg` houdt
   FOMO en Gehaast negatief.

**Acht soorten, acht kleuren** (voorstel 29-09-2026, wacht op akkoord Denny):

| Soort | Kleur | Token |
|---|---|---|
| Setup-type | blauw | `--accent` |
| Confirmaties | groenblauw | `--teal` |
| Timeframe | paars | `--violet` |
| Emoties, positief | groen | `--green` |
| Emoties, negatief | rood | `--red` |
| Fouten | amber | `--amber` |
| Missed-redenen | roze | nieuw `--pink` (licht + donker) |
| Eigen tags | grijs | `--muted` |

Groen, rood en amber zijn de kleuren die het formulier al gebruikt. Nu dubbel: missed-redenen en eigen
labels zijn allebei grijs.

**Ook erbij:** timeframe en missed-redenen komen in de Tags-kolom van het overzicht (`overzichtTags`
toont ze nu niet), en in het formulier krijgen timeframe, setups en confirmaties hun kleur zodra je
ze aanklikt.

**Klaar als** elke soort op alle drie de plekken dezelfde kleur heeft, in beide thema's, eigen emoties
hun kant kiezen in Instellingen, en de belofte in Instellingen weer klopt. Wijzigt de tag-datastructuur:
met migratie, changelog-regel en een test op oude back-ups.

### C2 · CSV-parser per exchange opsplitsen — prio 3 · M–L

**Waarom.** `parseExchangeCsvText` ([work/syncjournal.html:7788](work/syncjournal.html#L7788)) is 333
regels met de parsing van alle exchanges door elkaar. De OKX-tak en de fallback beginnen met een
zesvoudige negatie, dus een nieuwe exchange toevoegen betekent twee negatie-kettingen bijwerken.
Kraken en Hyperliquid hebben hun parsing al in de adapter; Blofin, MEXC, FTMO en OKX nog niet.

**Plan** (na T1, eerst een plan-document):
1. Per exchange `herkentCsv(headers)` en `parseCsv(rows)` op de adapter, zoals Kraken en
   Hyperliquid het al doen.
2. `parseExchangeCsvText` wordt een lus over de adapters; de negatie-kettingen verdwijnen vanzelf.
3. Eén exchange per stap, met `csv-import` (zes formaten) ertussen.

**Klaar als** de functie op één scherm past en elke import exact dezelfde trades oplevert als
ervoor. Geen changelog (geen gedragswijziging). Niet samen met een feature doen.

### C3 · Account-label opzoeken in plaats van kopiëren — prio 3 · S

**Waarom.** Het trade-formulier zet het account-label plat in de trade
([work/syncjournal.html:8750](work/syncjournal.html#L8750)). Hernoem je je account, dan houden oude
trades de oude naam. Cosmetisch — er wordt niets mee gerekend.

**Plan.** Weergave via `acctOf(t.exchange).acct`; `t.account` alleen voor echte sub-accounts. Test:
account hernoemen → een oude trade toont de nieuwe naam.

### C4 · XLSX-ondersteuning eruit — gepland, na 16 november · S

**Waarom.** Het enige externe script in de app (`xlsx@0.18.5`,
[work/syncjournal.html:15](work/syncjournal.html#L15)) bestaat alleen voor MEXC's Excel-export. Tot
MEXC uit Nederland vertrekt hebben leden het nodig om hun historie binnen te halen.

**Plan** (december): script-tag weg; `accept` terug naar `.csv` ([:3923](work/syncjournal.html#L3923));
de xlsx-tak uit de CSV-import met de melding *"Sla op als CSV en probeer opnieuw"*; FAQ nalopen.
Test: een `.xlsx` geeft een begrijpelijke melding.

**Klaar als** er geen `<script src>` meer in het bestand staat.

---

## Werkwijze & tooling

### W1 · Worker: staat `Access-Control-Allow-Origin` op `*`? — prio 2 · XS (Denny)

**Waarom.** Dan kan elke website je Worker gebruiken als gratis exchange-proxy, op jouw
Cloudflare-quota. Bij misbruik gaan de koppelingen voor iedereen stuk door rate-limits. Sleutels
lekken er niet door.

**Plan** (jouw kant, ~5 minuten): in het Cloudflare-dashboard de Worker openen en zoeken op
`Access-Control-Allow-Origin`. Staat er `*`, dan lever ik een diff die beperkt tot de eigen origins.
Meteen meekijken: bouwt de Worker upstream-URL's uit een vaste basis per exchange, zodat het clientpad
geen andere host kan worden?

**Let op:** Morani's journal en de oude TradeJournal gebruiken dezelfde Worker. De oude TradeJournal
draait lokaal — als bestand (origin `null`) of via `localhost`. Die moeten op de lijst, anders breek je ze.

**Klaar als** bevestigd is wat er staat, en bij `*` een diff gedeployd is.

### W2 · Ruwe exchange-data kunnen vastleggen (dev-modus terug) — prio 2 · M

**Waarom.** CLAUDE.md beschrijft het snapshot-fixture-patroon via `?dev=1`-knoppen als dé manier om
exchange-bugs met echte data te reproduceren zonder jouw sleutels. In SyncJournal bestaat `?dev=1`
niet (0 treffers). Het diagnosepaneel (`diagnostics()`,
[work/syncjournal.html:1846](work/syncjournal.html#L1846)) geeft versie, aantallen en laatste sync,
maar niet de ruwe respons. Voor B1 en elke volgende exchange-bug mis je zo de brug naar een testfixture.

**Plan.**
1. `?dev=1`, onthouden onder een `sj_`-sleutel, zet een dev-blok aan in het diagnosepaneel.
2. Per gekoppelde exchange een knop "Ruwe respons downloaden": de laatste API-antwoorden van de
   adapter, met sleutels, wallet en accountnummers eruit gefilterd.
3. Die download is direct bruikbaar als fixture in `tests/_fixtures/`.
4. Test: het bestand bevat geen `apiKey`, `secret`, `passphrase` of wallet (zoals de diagnose-spec
   dat al toetst).
5. CLAUDE.md bijwerken: de passages over `IS_DEV` beschrijven nu de oude app.

**Klaar als** de knop voor elke API-exchange (OKX, Blofin, Kraken, Hyperliquid) een bestand oplevert
dat een spec kan inladen.

### W3 · Graphify verversen of de instructie weghalen — prio 3 · S

**Waarom.** CLAUDE.md verwijst naar de graphify-graaf voor impact-checks, maar die graaf komt uit de
bevroren app (22-06-2026). Een verouderde graaf geeft plausibele, foute antwoorden.

**Plan.** Kiezen, niet allebei half. **Verversen**: het `<script>`-blok van `work/syncjournal.html`
naar `graphify-src/syncjournal.js`, de oude weg, `graphify graphify-src --update` (gratis, alleen
AST). **Of weghalen**: de instructie uit CLAUDE.md, want grep werkt en is altijd actueel.
Advies: weghalen, tenzij je hem echt gebruikt — dat is de afgelopen weken niet gebeurd.

### W4 · Eerste echte PR met beide reviewers — prio 3 · XS

**Waarom.** `pr-reviewer-nl` en `/code-review` zijn nog nooit op een release losgelaten.

**Plan.** Bij de volgende release een branch en een PR. Lokaal `pr-reviewer-nl` over de diff, op de
PR `/code-review`. Daarna beoordelen of ze te streng of te los zijn, en of `pr-reviewer-nl` op het
duurdere opus-model moet blijven.

---

## Ideeën — niet ingepland

| Groep | Punten | Oppakken als |
|---|---|---|
| AI-coach uitbreiden (3) | AI Trade Autopsy, AI Super-Prompt "wat heeft prioriteit", playbook-coaching | Na het besluit of de AI-coach blijft |
| Mindset & discipline (10) | Tiltmeter, pre-trade-checklist-builder, checklist-streak, mindset-reminders, dag-limiet/tilt guard, Strengths-onboarding, 2D mindset-grid, decision-space-meter, Strengths Primer, Best Trade of the Week | Als leden erom vragen — de mindset-module is niet meegekomen en de enquête vroeg om vereenvoudiging |
| Grafieken & analyse (7) | Bruto/netto P&L naast elkaar, drawdown-grafiek, funding & fees-waterval, weekoverzicht, scratch-donut, MAE-to-stop per setup, bias per layer | Kies er één; bruto/netto eerst (fees worden zichtbaar) |
| Funding-fees per trade (1) | Onderzoek klaar (bouwvolgorde Hyperliquid → Kraken → Blofin) | Na B1 |
| Blofin-schermhulpjes (3) | Near-liquidation-waarschuwing, "laatst ververst"-indicator, live R:R | Laag |
| Delen & integraties (4) | Trade-voucher/deellink, Discord-webhook, TradingView-grafieken, PDF-rapport | Laag |
| Help & content (3) | Alerts Cookbook, Bellafiore-playbookveld, pro-trader-review-follow-up | Laag |
| Combined trades (1) | Meerdere trades als één behandelen | Samenvoegen bestaat al (FTMO); pas bij vraag |
| Test-scenario's O–T (6) | Funding, scaling-in, direction-flip, leverage-wijziging, liquidatie, sub-accounts | Zodra de bijbehorende feature er is |
| Wachtpost (2) | Dagelijkse staat-controle, diff-wachtpost ([ontwerp](docs/wachtpost-ontwerp-2026-09-27.md)) | Na W3 en T2 — anders vervalt de helft van de signalen |
| Sync (1) | `fetchFills` parallel bij verversen | Als verversen traag voelt |
| Stortingen & opnames (1) | Percentages kloppend houden bij in- en uitleg, zie hieronder | Als leden vragen waarom oude percentages veranderen, of als je vaak stort of opneemt |

**Stortingen & opnames in de percentages** (Denny, 14-10-2026, bewust niet ingepland). De app kent
voor gekoppelde exchanges geen stortingen en opnames, en bewaart geen saldo-geschiedenis. Het
%-rendement van een trade rekent met een teruggerekend saldo (`pnlBaseOf`/`_pctBases`: saldo nu −
geboekte winst van die trade en alle latere). Een storting van $500 maakt daardoor al je óúde
percentages achteraf kleiner; een opname maakt ze groter. Bedragen, R, de equity-curve en drawdown
kloppen wél. Oplossing als het nodig wordt: een stortingen/opnames-logboek per account (bestaat al
voor handmatige accounts, `acctCapital`). Dat vul je zelf, of het wordt opgehaald: Hyperliquid
openbaar, Kraken uit de account-log, Blofin en OKX via een extra endpoint. Daarna is de basis = saldo
nu − latere winst − latere stortingen + latere opnames. Tot die tijd: *Instellingen → Percentage
rekent met → Vast referentiebedrag*.

De uitgewerkte teksten van deze ideeën staan in het [archief](docs/backlog-archief-2026-09-29.md).

## Besluiten

| Besluit | Waarom het ertoe doet |
|---|---|
| **Blijft de AI-coach?** | Blokkeert de AI-coach-specs in T2 en de drie AI-ideeën. De enquête zei "heroverwegen". |
| Welke exchanges krijgen prioriteit? | Bepaalt of er een zevende exchange komt, en daarmee de urgentie van C2 |
| Backend ja of nee? | Pas relevant als API-sleutels uit de browser moeten, of bij cloud-sync |
| Distributiemodel | Gratis/donatie, of iets anders |

---

## Opgeruimd op 29-09-2026

| Punt (oud) | Uitkomst | Bewijs |
|---|---|---|
| Hyperliquid toevoegen | ✅ gedaan | adapter `ExchangeAPI.hyperliquid` |
| Laadtijd ~10 s door Babel | ✅ gedaan | geen Babel meer; laadt in 0,2 s |
| Hosted op eigen domein | ✅ gedaan | syncjournal.nl |
| Meerdere screenshots per trade | ✅ gedaan | `t.screenshots` |
| TP-niveaus met datum en tijd | ✅ gedaan | `tsDate`/`tsTime` (v0.9.149) |
| MFE/MAE-analyse, MFE/MAE-scatter | ✅ gedaan | grafiek bij "Kwaliteit van je trades" |
| PnL-kalender-heatmap | ✅ gedaan | kalenderpagina |
| Trades-tabel paginatie | ✅ gedaan | `tPage`/`pageCount` |
| Kraken-trades zonder TP-overzicht | ✅ opgelost door de levensloop | `kraken-levensloop`: "elke trade heeft stappen met minstens één afbouw"; het restgat is **B1** |
| Blofin partial-close → koppeling met open trade | ✅ opgelost door de levensloop | `blofin-levensloop`: partial met het geboekte deel apart |
| CI draait 74 van de 171 specs | ✅ anders opgelost | vaste release-set, en de volle run leest de map |
| Trage poort splitsen / CI-poorten (oud 14, 19) | ✅ gedaan | 55 → 2,4 min, 4 specs tegelijk |
| Self-review vóór commit | ✅ gedaan | `superpowers:verification-before-completion` + `pr-reviewer-nl` |
| Twee runners | ✅ grotendeels | runner draait beide soorten; de rest is **T4** |
| MEXC partial-close: TP-winst ~8× te laag | ❌ geschrapt | MEXC-koppeling gestopt |
| MEXC `contractSize` via de proxy | ❌ geschrapt | idem |
| MEXC eigen `detectPartials` | ❌ geschrapt | idem |
| `ftmoCtx` doorgeven aan `calcRMultiple` | ❌ geschrapt | die functies bestaan niet in SyncJournal; R loopt via `tradeR`/`gemR` |
| Dashboard-grafieken lazy mounten | ❌ geschrapt | probleem van de oude React-app |
| Finalize-aggregatie: 3 kopieën | ❌ geschrapt | `importTrades`-finalize bestaat niet in SyncJournal |
| Bulk-tag-knop afmaken | ❌ geschrapt | de code zit niet in SyncJournal |
| Pre-Market Game Plan-tab | ❌ geschrapt | gaat op in de Plan-pagina |
| aicoach-weekly-spec structureel maken | → **T2** | valt onder de AI-coach-specs |
| Dev-only debug-knoppen | → **W2** | bestaan niet in SyncJournal; opnieuw als W2 |
| CSV-import op CI | → **T1** | bleek *niet* gedaan: CI slaat de spec over |
| Levensloop-toets MEXC en FTMO | → **T3** | MEXC vervalt, FTMO blijft |
| Oude stories 17, 18, 20 | → **T2** | samengevoegd |
| Lege staten (oud 8, 9) | → **C1** | samengevoegd |
| CSV-import per exchange (oud 6) | → **C2** | |
| CSV- vs API-dedup-gat | → **B3** | eerst een test: bestaat het nog? |
| Graphify (oud 7), Worker-CORS, reviewer op echte PR | → **W3**, **W1**, **W4** | |
