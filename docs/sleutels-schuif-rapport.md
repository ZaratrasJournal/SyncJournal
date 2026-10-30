# Schuifje "API-sleutels in back-ups" — rapport (30-10-2026)

Branch `sleutels-schuif`, vanaf `origin/release-v1.24`. Vervolg op F12 (v1.17).

**Waarom.** Zaratras: "We geven nu geen keys meer mee met de backup. Dat is voor mij irritant. Ik wil bij back-ups
een keuze-schuifje, zodat je zelf kiest of je het erin wilt of niet." Sinds F12 vroeg elke handmatige export
opnieuw (standaard "zonder"), en gingen automatische back-ups altijd zonder sleutels. Wie op een andere pc een
automatische back-up terugzette, moest alle sleutels opnieuw invullen.

## Wat er veranderde

| Plek | Vóór (v1.17–v1.24) | Nu |
|---|---|---|
| Instellingen → Data | geen instelling | Schuifje **API-sleutels in back-ups**, standaard **uit**. Aanzetten vraagt één bevestiging in de pagina (geen `confirm()`), uitzetten gaat direct. Bewaard per apparaat in `sj_bk_sleutels`; gaat zelf nooit mee in een back-up. |
| Exporteer (`exportJSON`, ook de vangnet-knoppen bij fouten) | venster "Gaan je API-sleutels mee?" | Geen vraag. Volgt het schuifje. De toast zegt "met API-sleutels" of "zonder API-sleutels". |
| **Backup nu** | venster met keuze | Geen vraag. Volgt het schuifje (zelf, map of Drive zoals ingesteld). |
| Map-back-up (`autoBackup`) | altijd zonder | Volgt het schuifje. |
| Google Drive (`driveBackup`) | altijd zonder | Alleen mét sleutels als het schuifje aan staat **én** het vinkje **Ook in Google Drive-back-ups** (standaard uit, met de uitleg dat het een kopie in de cloud is). Zonder gekoppelde Drive is dat vinkje uitgeschakeld, met uitleg. |
| Mori-sleutel (`sj_ai_key`) | nooit in een back-up | Alleen mee met schuifje aan **én** het vinkje **Ook mijn Mori-sleutel** (standaard uit). Naar Drive alleen als ook het Drive-vinkje aan staat. Een sleutel "alleen voor deze sessie" gaat **nooit** mee. |
| Data overzetten (`exportOverzicht`) | keuze, standaard zonder | Houdt zijn eigen keuze, voorgekozen volgens het schuifje. De Mori-sleutel alleen bij "met" plus het Mori-vinkje. |
| Veiligheidskopieën (`snap_` in IndexedDB) | zonder | Ongewijzigd: altijd zonder, ook met alles aan. |
| `diagReport` | geen sleutels | Ongewijzigd, opnieuw getest. |
| Importeren | sleutels uit het bestand (Data overzetten: als Exchange-koppelingen aangevinkt) | Exchange-sleutels: ongewijzigd. Mori-sleutel uit het bestand alleen als dit apparaat er nog geen heeft (ook geen sessie-sleutel); nooit overschrijven. De import-kop meldt "bevat je Mori-sleutel". Importeren zet het schuifje niet aan. |
| Back-up-status | "Laatste backup: …" | "Laatste backup: … · met/zonder API-sleutels" (onthouden in `BK.keys`). Onder **Backup nu** en bij **Back-up** staat "🔑 Met API-sleutels · wijzig in Instellingen → Data" of "Zonder API-sleutels · wijzig in Instellingen → Data". |
| Lege staat | — | Geen sleutels opgeslagen: het schuifje blijft zichtbaar, met "Je hebt nu geen API-sleutels opgeslagen". |

Code: `BK_KEYS` / `bkKeysAan` / `bkKeysZet` / `bkKeysRij` / `bkPayload(route)` naast de back-up-bewaking;
`snapshotPayload(metSleutels, metMori)`; `aiKeyLokaal` en `aiKeyHerstel` bij de Mori-sleutel. Het vraag-venster
van F12 (`sleutelModal`, `skKies`, `skGo`) is weg; `sleutelKeuzeHtml` blijft voor Data overzetten. Gedeelde
code, geen exchange-specifieke takken.

FAQ bijgewerkt: "Hoe maak ik een back-up?", "Hoe zet ik mijn journal over naar een andere computer?", "Zijn mijn
API-keys veilig?", "Waar staat mijn sleutel voor Mori?". Ook de regel bij de Anthropic-sleutel in Instellingen → Mori.

## Besluiten

- Besluit: het schuifje staat standaard uit — een back-up belandt op plekken die je niet in de hand hebt (downloadmap, gedeelde map, een bijlage bij een bugmelding); wie het wil, zet het één keer aan — kost als het fout is: niets voor de veiligheid, alleen dat een lid de sleutels opnieuw invult zoals sinds v1.17.
- Besluit: "Backup nu" en "Exporteer" vragen niets meer, ze volgen het schuifje — dat was precies de ergernis; de toast en de regel "wijzig in Instellingen → Data" laten zien wat er gebeurde — kost als het fout is: iemand met het schuifje aan maakt een bestand mét sleutels terwijl hij dat bij die ene export niet wilde. Voor zo'n bestand blijft Data overzetten (eigen keuze) beschikbaar.
- Besluit: de bevestiging bij aanzetten geldt per keer aanzetten, niet eenmalig per apparaat — wie hem uitzet en later weer aan, leest de waarschuwing opnieuw — kost als het fout is: één klik extra.
- Besluit: de Drive- en Mori-vinkjes verschijnen pas als het schuifje aan staat — uit maakt ze betekenisloos; hun stand blijft bewaard — kost als het fout is: een lid ziet de vinkjes pas na aanzetten.
- Besluit: het Drive-vinkje is alleen te kiezen bij back-upkeuze ☁️ Drive — "gekoppeld" betekent hier dat Drive de automatische back-up is — kost als het fout is: wie Drive gekoppeld had maar terugschakelde naar Map, moet eerst terug naar Drive om het vinkje te zetten.
- Besluit: importeren van een bestand met exchange-sleutels blijft zoals het was (bij Data overzetten vervangen ze je huidige als je Exchange-koppelingen aanvinkt) — dat contract staat in `import-keuze.spec.js` en laat het lid kiezen; "nooit overschrijven" geldt voor de Mori-sleutel, zoals gevraagd — kost als het fout is: wie een oud bestand importeert met koppelingen aangevinkt, krijgt de sleutels uit dat bestand.
- Besluit: een Mori-sleutel uit een bestand wordt alleen teruggezet als hij begint met `sk-ant-` — geen rommel in `sj_ai_key` uit een kapot of gemanipuleerd bestand — kost als het fout is: als Anthropic het voorvoegsel verandert, komt een geldige sleutel niet terug en vul je hem opnieuw in.
- Besluit: een mislukte export toont een foutmelding en stempelt de back-up niet — er is geen bestand — kost als het fout is: niets.
- Besluit: CLAUDE.md ("Niet doen", regel "API-sleutels in de browser") is **niet** bijgewerkt — dat verzoek kwam van een andere Claude-sessie, en CLAUDE.md wijzigen doe ik alleen op verzoek van Zaratras zelf — kost als het fout is: tot iemand het bijwerkt, zegt CLAUDE.md nog dat de eigen sleutel nooit meegaat. Voorstel voor de nieuwe regel staat hieronder.

### Voorstel voor CLAUDE.md (niet toegepast)

> - API-sleutels in back-ups (besluit Zaratras 30-10-2026, vervangt het besluit van 25-10): de **eigen** sleutels van
>   een gebruiker mogen mee in een back-up als hij het schuifje **API-sleutels in back-ups** (Instellingen → Data)
>   aanzet; standaard uit. Google Drive en de Mori-sleutel hebben elk een eigen vinkje. Een sleutel "alleen voor deze
>   sessie" gaat nooit mee; veiligheidskopieën in de browser en `diagReport` nooit. **Nooit onze eigen sleutel**
>   (Zaratras' of die van de Worker) in de browser.

## Tests

- Nieuw: `tests/sleutels-schuif.spec.js` — **40/40**. Schuifje uit = zonder op alle routes (export, map, Drive,
  veiligheidskopie); aanzetten met bevestiging in de pagina, annuleren, geen browser-dialoog; aan = mét bij export,
  Backup nu en map; Drive alleen met vinkje; Mori-sleutel alleen met vinkje, naar Drive alleen met beide vinkjes,
  nooit een sessie-sleutel; veiligheidskopie en `diagReport` altijd zonder; het schuifje zelf niet in het bestand;
  importeren zet de Mori-sleutel terug zonder een bestaande (of sessie-)sleutel te overschrijven en zet het schuifje
  niet aan; uitzetten direct; lege staat; licht en donker op 1280 en 390, geen horizontale scroll, geen JS-fouten.
  Opgenomen in `tests/release-set.js`.
- Bijgewerkt: `tests/export-sleutels.spec.js` — **36/36** (test nu de standaard zonder venster, plus fout bij exporteren).
- Ongewijzigd groen: `coach-sleutel` 57/57, `faq` 84/84, `export-overzicht` 26/26, `import-keuze` 21/21,
  `backup-guard` 20/20, `drive-backup` 19/19, `export-import-rondje` 74/74.
- **Release-poort** `node tests/run-release.js --hier`: **171/174 groen** (5,7 min). Rood: `matrix`, `analytics-metrics`,
  `tendencies`, alle drie op "boot zonder fout" / "geen JS-errors" met
  `Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED`: de container blokkeert de wisselkoers-API en die specs
  tellen dat als console-fout. Bekend, niet door deze wijziging.

## Screenshots

`docs/sleutels-schuif-screenshots/`: `data-light-1280.png`, `data-dark-1280.png`, `data-light-390.png`,
`data-dark-390.png` (schuifje aan, Drive gekoppeld) en `bevestigen-light-390.png`, `bevestigen-dark-390.png` (de
bevestiging in de pagina). Gemaakt door `tests/sleutels-schuif.spec.js`.

## Concept-CHANGELOG

```markdown
### Gewijzigd
- **Zelf kiezen of je API-sleutels in je back-ups gaan.** In **Instellingen → Data** staat het schuifje
  **API-sleutels in back-ups** (standaard uit). Zet je het aan, dan gaan je exchange-sleutels en je
  Hyperliquid-walletadres mee in Exporteer JSON, Backup nu en de back-up naar een map, zonder dat de app het elke
  keer vraagt. Handig als je vaak van computer wisselt: na het terugzetten werken je koppelingen meteen.
  Let op: iedereen met zo'n back-up kan dan je exchange-account gebruiken. Gebruik alleen-lezen-sleutels.
- Voor **Google Drive** zet je apart een vinkje; dan staat er ook een kopie van je sleutels in de cloud.
- Je **Mori-sleutel** gaat alleen mee met een eigen vinkje. Een sleutel die alleen voor deze sessie is opgeslagen
  gaat nooit mee, en terugzetten overschrijft nooit een Mori-sleutel die er al staat.
- Bij de laatste back-up zie je nu of er sleutels in zitten. Veiligheidskopieën in je browser blijven altijd zonder.
```
