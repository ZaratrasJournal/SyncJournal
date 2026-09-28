# Discord-bericht — SyncJournal live

> Voor Denny. Plak dit in Discord met `demos/release-vergelijking.png` eronder.
> Kanaalnaam en @-mention aanpassen. Het langere concept in
> `community-aankondiging-syncjournal.md` blijft staan als naslag voor de live sessie.

---

## 🎉 SyncJournal is live

Mannen — hij staat er: **https://syncjournal.nl**

Uit de enquête kwam één ding heel duidelijk naar voren: **vereenvoudigen en stabiliseren**. Dus
zijn we niet gaan stapelen op de oude journal, maar opnieuw begonnen.

Wat je meteen merkt: hij is **12× sneller open** (0,2 seconden in plaats van 2,5), werkt **offline**,
en je hoeft nooit meer een bestand te downloaden — updates komen vanzelf. En je ziet nu
**de hele levensloop van een positie**: elke TP, elke stap en elke fee, in plaats van alleen het
eindresultaat.

Nieuw is ook de **Google Drive-koppeling**: de app maakt een map *SyncJournal* in **jouw** Drive en
zet daar automatisch je backups neer — wij kunnen daar niet bij. Daarmee is je journal niet langer
alleen je browser, en kun je op een andere computer verder waar je gebleven was.

En er komt nog iets aan: een **Plan-pagina** waarop je vóór de handelsdag vastlegt wat je van plan
bent, en waar je journal achteraf zelf de link legt met je trades. Nog in aanbouw — morgenavond laat
ik alvast zien waar het heen gaat.

Een paar onderdelen zijn nog niet meegekomen — laat vooral weten wat je mist, dan zetten we het op
de lijst.

**Je oude journal blijft gewoon draaien**, maar alles wat we nog bouwen gebeurt hier.

**Overzetten duurt twee minuten:**
1. Oude journal → Instellingen → **Exporteer JSON**
2. syncjournal.nl → Instellingen → **Data** → **Importeer oude backup**
3. Je krijgt eerst een controle-overzicht — check of het netto-bedrag klopt, en klik dan op overzetten

Alles gaat mee: trades, screenshots, playbooks, tags én je koppelingen.

Morgenavond loop ik het live met jullie door. 📓

---

## Losse onderdelen om te hergebruiken

**Als titel of embed-kop**
> Opnieuw opgebouwd, met wat jullie vroegen

**Als één regel (bijv. in een aankondigingskanaal)**
> SyncJournal is live op syncjournal.nl — 12× sneller, werkt offline, automatische back-up naar je eigen Drive. Overzetten duurt 2 minuten.

**Als reactie op "waarom een nieuwe app?"**
> De oude was in de browser een React-app die zichzelf bij elke keer openen moest vertalen. Dat
> kostte 2,5 seconden en een internetverbinding. De nieuwe doet dat niet meer: 0,2 seconden, en
> hij werkt zonder verbinding. Daardoor ging het bestand ook van 3,4 naar 1,4 MB.

**Als reactie op "gaat mijn data dan naar Google?"**
> Nee. De app maakt een map *SyncJournal* in jouw eigen Drive en zet daar je backup-bestand neer —
> hetzelfde bestand dat je ook met de hand kunt exporteren. Wij hebben geen server en kunnen er niet
> bij. Je trekt de toegang op elk moment in via je Google-accountinstellingen. Bonus: Drive bewaart
> 30 dagen versiegeschiedenis per bestand, dus je kunt ook terug naar gisteren.

**Als reactie op "wat is er weg?"**
> Doelen, milestones, de mindset-module met pre-trade-checks en de deelkaarten zijn nog niet
> meegekomen. Niet omdat ze slecht waren — er moest gekozen worden, en de sync en de analyse
> gingen voor. Zeg welke je het meest mist, dan bepaalt dat de volgorde.

---

## Waar de cijfers vandaan komen

| Claim | Bron |
|---|---|
| 12× sneller (2,5 s → 0,2 s) | Gemeten 28-09-2026 met Playwright, beide apps, netwerk aan, twee metingen per app |
| 3,4 MB → 1,4 MB | Bestandsgrootte `work/tradejournal.html` en `work/syncjournal.html` |
| Nieuw: Google Drive-backup | 10 treffers + OAuth in SyncJournal, 1 losse vermelding zonder koppeling in de oude |
| Nieuw: levensloop per positie | "levensloop" 0× in de oude, 38× in SyncJournal; "executie-stappen" 0× tegen 3× |
| Niet meegekomen | Doelen, milestones, mindset, pre-trade, deelkaarten — in de oude app aanwezig, in SyncJournal nul voorkomens |

**Niet claimen:**
- *"OKX is erbij gekomen"* — onjuist. OKX zat al in de oude journal (eigen adapter, 60 treffers).
  Stond eerst wel in dit bericht; eruit gehaald op 28-09-2026.
- *"Nieuw: de Plan-pagina"* — niet als afgeronde functie neerzetten; hij is nog in aanbouw.
  Als vooruitblik mag hij er wél in, en dat doet het bericht ook — met "nog in aanbouw" erbij.
- *"alles is meegenomen"* — dat is niet zo.
- *"sneller dan elke andere journal"* — niet gemeten.
- De **30 seconden** die een eerdere meting gaf: die kwam doordat het netwerk geblokkeerd was en
  de oude app dan op een CDN blijft wachten. Mét netwerk is het 2,5 s. Dat is het getal dat klopt.
