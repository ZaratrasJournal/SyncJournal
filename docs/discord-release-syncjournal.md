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
en je hoeft nooit meer een bestand te downloaden — updates komen vanzelf. **OKX** is erbij gekomen,
je ziet nu **de hele levensloop van een positie** met elke TP, elke stap en elke fee, en er is een
nieuwe **Plan-pagina**.

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
> SyncJournal is live op syncjournal.nl — 12× sneller, werkt offline, OKX erbij. Overzetten duurt 2 minuten.

**Als reactie op "waarom een nieuwe app?"**
> De oude was in de browser een React-app die zichzelf bij elke keer openen moest vertalen. Dat
> kostte 2,5 seconden en een internetverbinding. De nieuwe doet dat niet meer: 0,2 seconden, en
> hij werkt zonder verbinding. Daardoor ging het bestand ook van 3,4 naar 1,4 MB.

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
| Vijf exchanges, OKX erbij | `EXCHANGES` in beide bestanden; OKX komt in de oude nergens voor |
| Nieuw: Plan-pagina | `NAVBOT` in SyncJournal; staat niet in de oude `TABS` |
| Niet meegekomen | Doelen, milestones, mindset, pre-trade, deelkaarten — in de oude app aanwezig, in SyncJournal nul voorkomens |

**Niet claimen**: "alles is meegenomen" (dat is niet zo) en "sneller dan elke andere journal"
(niet gemeten). De 2,5 s is een eerlijke meting mét netwerk; zonder netwerk blijft de oude app
op een CDN wachten en wordt het 30 s — dat getal is misleidend en gebruiken we niet.
