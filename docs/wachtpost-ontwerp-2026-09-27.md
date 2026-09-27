# De wachtpost — ontwerp

*Opgesteld 27-09-2026, sessie 5 van de prompt-reeks. Dit is een **ontwerp**, geen werkend ding.
Het beschrijft een controle die uit zichzelf opmerkt wanneer een wijziging de bekende valkuilen
van deze repo raakt, en die alleen iets zegt wanneer dat de onderbreking waard is.*

---

## Waarom

De duurste bugs van dit jaar hadden één ding gemeen: **niemand wist dat er iets mis was tot een
member het meldde.** De Kraken-import die van 20 naar 43 trades ging, de Hyperliquid-positie die
bij elke refresh dupliceerde, de MEXC-size die na een sync veranderde. Stuk voor stuk pas
ontdekt nadat de data al kapot was.

Dat zijn geen slordigheidsfouten. Het zijn gevallen waarin een wijziging een pad raakte waarvan
niet in beeld was dat het geraakt werd. Dat is precies wat een wachtpost kan opvangen — mits hij
zwijgt over de rest.

De waarschuwing vooraf: een controle die te vaak iets zegt, wordt genegeerd, en dan is hij erger
dan niets. Alles hieronder is erop gericht om **zo min mogelijk te zeggen**.

---

## Drie niveaus

| Niveau | Wat | Wat we al hebben |
|---|---|---|
| **1 · Reactief** | Blokkeert een bewerking op het moment zelf | `.claude/hooks/check-theme-tokens.js` — vangt hardgecodeerde kleuren in JSX. Werkt goed. |
| **2 · Gepland** | Draait op een vast moment en controleert de staat van de repo | Nog niets project-specifieks |
| **3 · Situatie-bewust** | Kijkt naar wat er net gewijzigd is en concludeert daaruit | Nog niets |

Niveau 1 staat. Het ontwerp hieronder gaat over 2 en 3, en houdt ze **expliciet uit elkaar** —
dat is de belangrijkste keuze in dit document. Niveau 2 mag traag en volledig zijn; niveau 3 moet
snel en terughoudend zijn.

---

## Wat hij in de gaten houdt

Elk signaal hieronder is gekozen omdat er dit jaar iets door misging, niet omdat het netjes zou
zijn. Signalen zonder aanwijsbare schade staan er bewust niet in.

### Niveau 3 — na een wijziging aan `work/syncjournal.html`

| Signaal | Waarom | Bewijs dat eronder moet | Actie |
|---|---|---|---|
| **Gedeelde helper gewijzigd** (`netPnl`, `sourceTypeOf`, `normalizeTrade`, `syncTradeFlatFields`, `detectPartialFromSiblings`, `getConsumedSiblings`) | Dit is dé oorzaak van cross-exchange-schade | De naam, en de lijst adapters die over dat pad lopen | **melden** |
| **`if (ex === …)` of `exchange ===` nieuw toegevoegd buiten `ExchangeAPI`** | Exact het anti-patroon uit `CLAUDE.md` | Het regelnummer en de tak | **melden** |
| **`localStorage.setItem` met een key zonder `tj_`** | Botsing op dezelfde origin | Regel + key | **melden** |
| **Nieuw `<script src>` of `<link href>` naar een externe host** | Supply chain; nu nog maar één (`xlsx`) | De URL, en of er `integrity` bij staat | **melden** |
| **`innerHTML` met een template-string zonder `esc()`** | Story 2 kwam hier vandaan | Regel + de interpolatie | **melden** |
| Functie boven de ~80 regels aangeraakt | Leesbaarheid, geen schade | — | **stil loggen** |
| Nieuw `tests/*.spec.js` toegevoegd | Zou moeten meedraaien | — | **stil loggen** (vervalt zodra backlog-story 10 klaar is) |

### Niveau 2 — één keer per dag, of vóór een release

| Controle | Groen betekent |
|---|---|
| `work/syncjournal.html` = `site/app.html` | De release loopt niet achter op dev |
| `APP_VERSION` = `site/version.json` | De update-melding klopt |
| Bovenste `CHANGELOG.md`-blok = `APP_VERSION` | Er is een release-notitie voor wat er draait |
| `graphify-src/` komt uit `work/syncjournal.html` en is jonger dan de app | De impact-check is te vertrouwen (zie backlog-story 7) |
| `node tests/run-all-sj.js` groen | 27-09-2026: 72/74, 8,6 min |

Deze vijf zijn goedkoop en hard: geen oordeel, alleen vergelijken. Daarom mogen ze alle vijf
draaien zonder dat iemand er last van heeft.

---

## Wanneer hij iets zegt

Dit is het hart van het ontwerp. **Melden mag alleen als alle vijf waar zijn:**

1. Het is te onderbouwen met een bestandsnaam en een regelnummer. Geen vermoedens.
2. Niets doen kost binnen dagen iets — verkeerde data, een kapotte release, een lek.
3. Er is een concrete volgende stap te noemen, niet alleen "kijk hier eens naar".
4. Het was niet al zichtbaar in wat er net gewijzigd is.
5. Een mens die ernaar kijkt zou het eens zijn dat de onderbreking terecht was.

Valt er één af, dan wordt het **stil gelogd** in `.claude/wachtpost.log` en niet gemeld. Dat
logboek is er om later te kunnen zien wat hij níét gezegd heeft — dat is de enige manier om te
merken dat hij te stil staat afgesteld.

**Vaste bovengrens: hoogstens drie meldingen per sessie.** Zijn er meer, dan meldt hij de drie
zwaarste en zegt hij erbij hoeveel er nog in het logboek staan. Een controle die zeven dingen
tegelijk roept, wordt weggeklikt.

---

## Hoe een melding eruitziet

Kort, met bewijs, met een volgende stap. Niet meer dan vier regels.

```
⚠ detectPartialFromSiblings gewijzigd (work/syncjournal.html:5832)
  Over dit pad lopen: blofin, mexc, kraken, hyperliquid, okx.
  De commit-message noemt alleen blofin.
  → draai: node tests/partial-alle-exchanges.spec.js
```

En zo ziet een stille regel eruit — die zie je alleen als je het logboek opent:

```
2026-09-27 14:02  stil  pgAnalytics gewijzigd (225 regels, boven de drempel)
                        reden: leesbaarheid, geen aanwijsbare schade
```

---

## Wat hij van de repo moet weten

Om te kunnen oordelen heeft hij een klein beeld nodig van waar we mee bezig zijn. Dat hoeft geen
geheugen over sessies heen te zijn — dat is precies het deel dat in de bronprompt staat en dat
wij níét gaan bouwen, zie hieronder. Genoeg is:

- **De lijst gedeelde helpers** en welke adapters erover lopen. Staat al in `CLAUDE.md` en in
  `refactor-coach-nl`; hij leest 'm uit één plek.
- **De zes adapternamen**, uit `ExchangeAPI` zelf, niet uit een lijst die kan verouderen.
- **Wat er open staat** in de backlog, zodat hij niet meldt wat er al als story staat. Dit is de
  goedkoopste manier om herhaling te voorkomen.

---

## Wat we bewust niet bouwen

De bronprompt vraagt om een agent die leert van terugkoppeling: bijhouden welke meldingen werden
geaccepteerd en welke genegeerd, en de drempels daarop bijstellen. Dat laten we weg, om twee
redenen.

**Het is niet te meten bij deze hoeveelheid.** Een leerlus heeft tientallen meldingen per week
nodig om ergens op te slaan. Wij verwachten er een paar. Wat je dan krijgt is geen leren maar
ruis die zichzelf versterkt.

**Het verschuift de fout naar een plek waar je 'm niet ziet.** Een drempel die zichzelf bijstelt,
kan stilletjes zó ver dichtgaan dat de wachtpost nooit meer iets zegt — en dan lijkt alles goed.
Een vaste, uitgeschreven drempel is minder slim en veel beter te controleren.

**In plaats daarvan**: het stille logboek, en eens per maand er even doorheen. Zie je daar drie
keer hetzelfde staan wat je wél had willen weten, dan verhoog je dat signaal met de hand. Dat is
langzamer en het werkt.

Ook weggelaten: de meetlat uit de bronprompt (IDQ, CGS, Hit@K, false-interruption rate). Dat zijn
maatstaven voor een product met gebruikers, niet voor twee mensen en één repo. Onze meetlat is
één vraag: **meldde hij iets wat wij anders pas van een member hadden gehoord?**

---

## Hoe je 'm zou bouwen

Zonder nieuw gereedschap. De haken die deze opzet gebruikt, gebruiken we al.

| Onderdeel | Waar | Omvang |
|---|---|---|
| Niveau 3 — de diff-controle | `PostToolUse` op `Edit|Write`, alleen voor `work/syncjournal.html` | één Node-script, ~150 regels |
| Niveau 2 — de dagelijkse controle | los script, aan te roepen met de hand, via CI of via `SessionStart` | ~80 regels |
| Het logboek | `.claude/wachtpost.log`, gitignored | — |
| Registratie | `.claude/settings.json`, naast de bestaande theme-hook | een paar regels |

Twee dingen om op te letten bij het bouwen:

- **Hij mag nooit blokkeren.** De theme-hook doet dat wel en dat is daar terecht: die heeft een
  eenduidig antwoord. De wachtpost oordeelt, en een oordeel hoort niet te kunnen tegenhouden.
- **Hij moet snel zijn.** Een `PostToolUse` die een seconde kost, kost dat bij elke bewerking.
  Regex over de diff, niet over het hele bestand.

---

## Volgorde

Dit ontwerp is af, maar er is geen haast bij het bouwen. Drie van de signalen verdwijnen namelijk
zodra de bijbehorende backlog-story is opgelost:

| Signaal | Vervalt zodra |
|---|---|
| Nieuwe spec staat niet in de CI-lijst | story 10 klaar is (lijst wordt automatisch) |
| `graphify-src/` is verouderd | story 7 klaar is (verversen of instructie schrappen) |
| `innerHTML` zonder `esc()` | story 2 klaar is, als daar een vaste helper uit komt |

**Advies: bouw de wachtpost ná die drie.** Anders bouw je bewaking voor problemen die je net aan
het oplossen bent, en begint hij zijn leven met valse meldingen — de snelste manier om 'm
genegeerd te krijgen.

---

## Herkomst

De opzet — drie niveaus proactiviteit, een expliciete beslisregel (monitoren → wegen → beslissen →
onderbouwen), en een onderbrekingsdrempel in plaats van "zo veel mogelijk helpen" — is een
bewerking van `prompts/proactive_coding_agent_architect.txt` uit ai-boost/awesome-prompts
(GPL-3.0). De signalen, de drempels en de weglatingen komen uit deze repo en uit wat er dit jaar
daadwerkelijk is misgegaan.
