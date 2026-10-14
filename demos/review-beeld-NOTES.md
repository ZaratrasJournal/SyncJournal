# Review: beeld-modus — notities bij de demo (13-10-2026)

**Demo:** `demos/review-beeld-demo.html` (openen in de browser; wisselen met de balk onderin of ← →,
`?variant=A|B|C|D`). Nep-data, niets wordt opgeslagen. Weggooi-code: na de keuze verdwijnt de demo.

## De vraag
Denny: op de reviewpagina een modus met alleen afbeeldingen en TradingView-links, gefilterd op tag of
playbook; elke afbeelding te vergroten, met datum en een weg naar de trade — om er met de coach doorheen
te gaan. Hoe ziet dat eruit? En: is het delen in de huidige vorm handig, en hoe staat de reviewpagina?

Antwoorden van Denny vooraf: met de coach **allebei** (samen doorlopen én vooraf opsturen); delen vooral
voor **Discord/community en de coach**.

## De varianten
| | Wat | Sterk in | Zwakker in |
|---|---|---|---|
| **A — Stroom** | Elke trade als blok onder elkaar: datum, pair, setup, R, grote chart, notitie, TV-links | Rustig scrollen, samen doorlopen in een call | Veel scrollen bij veel trades; weinig overzicht |
| **B — Raster + presentatie** | Alle beelden als tegels per maand; "▶ Presenteer" opent volledig scherm met de trade ernaast | Overzicht in één oogopslag; presenteren met de coach | De tegels zelf zeggen weinig zonder te klikken |
| **C — Coach-sessie** | Lijst met vinkjes → een "sessie" in jouw volgorde → samen doorlopen, coach-pakket of kopiëren voor Discord | Beide coach-situaties + Discord in één plek | Een stap meer (eerst kiezen) |
| **D — Per trade, nieuwe indeling** | Voorstel voor de gewone reviewpagina: lijst links met mini-beeld, chart groot bovenaan, feiten in één rij, review-velden eronder | Lost de smalle middenkolom op | Is een herbouw van de bestaande pagina |

Bovenaan staat een schakelaar **Per trade | 🖼 Beeld**: de beeld-modus is een tweede weergave van
dezelfde reviewpagina, met dezelfde filters (playbook, tags, uitkomst, periode).

## Mijn advies (Claude)
1. **Beeld-modus = B als basis, met de selectie uit C.** Het raster geeft overzicht, "Presenteer" is
   precies wat je met de coach in een call doet. De vinkjes en "sessie in jouw volgorde" uit C maken
   er ook de opstuur-variant van.
2. **Delen vereenvoudigen tot twee knoppen**, beide vanuit dezelfde selectie:
   - *Coach-pakket* — het huidige HTML-bestand (werkt al, coach hoeft niets te installeren).
   - *Kopieer voor Discord* — de screenshot met een smalle balk eronder (pair · setup · R · datum,
     standaard zónder bedragen) plus een korte tekst naar je klembord. Op Discord wil men de chart
     zien; meer hoeft niet. Een aparte "deelkaart" maken is overbodig: de TradingView-screenshot ís de
     kaart.
3. **De reviewpagina is inderdaad niet af.** Op een laptopscherm is de middenkolom te smal: de kop
   breekt over drie regels, de stappentabel en het plan-blok worden afgesneden, en de chart (het
   belangrijkste bij een review) staat in een aparte kolom met een groot leeg uploadvak. Variant D
   zet de chart groot bovenaan, de feiten in één rij en de review-velden (notitie, emotie, checklist)
   eronder. Lijstitems worden compacter met een mini-beeldje.

## Open vragen voor Denny
- Welke variant (of welke combinatie) voor de beeld-modus?
- Moet "coach-feedback" (veld in de presentatie) echt bewaard worden bij de trade?
- Variant D: nu meenemen of later als aparte stap?

## Ronde 2 (14-10-2026) — `demos/review-beeld-demo-v2.html`
Denny koos **C** (coach-sessie), met: meer info per trade, de trade kunnen **reviewen** in de beeld-modus,
**blokken per maand** (‹ › tussen maanden, minder op je scherm, grotere miniaturen), werkende knoppen, en de
**Presenteer**-functie uit B erbij.

In alle drie de indelingen werken: *Samen doorlopen* (volledig scherm, info + review + coach-feedback ernaast),
*Presenteer maand* (hele maand, zonder eerst te kiezen), *Coach-pakket* (downloadt een echt HTML-bestand met
beelden, info, review en coach-feedback; beelden vergroten in het bestand) en *Kopieer voor Discord* (beeld met
balk + tekst op het klembord; anders download). ← → = vorige/volgende maand.

| | Indeling |
|---|---|
| **1 — Kaarten** | 2 trades per rij: grote chart, info-raster, review uitklapbaar |
| **2 — Rijen** | per trade één rij: beeld · info · review naast elkaar, alles direct zichtbaar |
| **3 — Focus** | de maand als filmstrip bovenaan, één trade groot met review ernaast |

## Ronde 3 (14-10-2026) — `demos/review-beeld-demo-v3.html`
Denny koos **indeling 1 (kaarten)**: 3 per rij, kaarten selecteerbaar (vinkje linksboven, toont je
volgorde-nummer), *Presenteer maand* wordt *Presenteer geselecteerde (n)* zodra je iets kiest, plus
"Selecteer maand". De sessie-kolom is vervangen door een **selectiebalk** onderin (volgorde, presenteer,
coach-pakket, Discord, bedragen verbergen, naam, wissen) — zo blijft er ruimte voor 3 kaarten. In de
presentatie staat een **strook met miniaturen** onder het beeld: klik om direct naar een trade te gaan.

## Ronde 4 (14-10-2026) — `demos/review-beeld-demo-v4.html`
- Deel-paneel terug als kolom rechts, nu **"Selectie & delen"**: geselecteerde trades in volgorde, *+ Hele
  maand*, naam, bedragen verbergen, *Presenteer geselecteerde*, *Coach-pakket*, *Kopieer voor Discord*. De
  selectiebalk onderin is vervallen.
- De **gewone filterbalk van de app** (accounts, pairs, setups, sessies, long & short, statussen, tags, fouten,
  live trades, datums); de review-status (Alles / Te reviewen / Gereviewd) staat als segment bij de maand.
- **Presentatie**: meer trade-info (exchange, richting, sessie, entry/stop/exit, size, leverage, risk, R:R
  gepland vs behaald, P&L, fees, duur, grade, lagen top-down met bias en confirmaties, TP's, tags en fouten).
  Coach-feedback blijft (Denny vindt die mooi).
- **Discord-beeld**: chart links, trade-info rechts (pair, richting, setup + lagen, R groot, datum, sessie,
  HTF-bias, entry/stop/exit, R:R gepland, TP geraakt, duur, confirmaties/tags), voetbalk met notitie. De tekst
  bevat dezelfde kern.

## Daarna (Denny 14-10-2026)
- **Filter "Alle playbooks" in de filterbalk.** Nu mengt "Alle setups" playbook-namen, setup-tags uit de lagen
  en `t.setup`, en filtert alleen op `t.setup` (work/syncjournal.html, `filterBar`: `setups=[...PBOOK, ...setupTags,
  ...t.setup]`). Voorstel: splitsen in *Alle playbooks* (de playbook van de trade) en *Alle setups* (setup-tags in
  de lagen, over playbooks heen).

## Ronde 5 (14-10-2026) — `demos/review-beeld-demo-v5.html` (volledige uitwerking)
- Schakelaar **Per trade | 🖼 Beeld** werkt; "Open trade →" (kaart en presentatie) gaat naar Per trade.
- **Per trade, nieuwe indeling**: lijst links (mini-beeld, pair, richting, datum, setup, R, gereviewd, 💬), rechts
  de trade: kop (selecteren, pair · setup, richting, R, ‹ n/N ›, Markeer gereviewd, Discord, bewerken), chart
  groot (max ~44% van het scherm, klik = groot), extra beelden + TV-links, 18 info-tegels, lagen + TP's, stappen (uitklap),
  review in twee kolommen (wat gebeurde er, leerpunt, coach-feedback | emotie, discipline, rating, tags/fouten).
  ← → = vorige/volgende trade.
- **Coach-feedback wordt bewaard bij de trade**: invullen in presentatie, kaart-review of per trade; zichtbaar op de
  kaart (💬), in de lijst en in het coach-pakket.

## Verdict (Denny, 14-10-2026)
- Beeld-modus: **kaarten (indeling 1), 3 per rij, stijl "rand"** (groene/rode streep links), kop + setupregel
  boven de afbeelding, selectievakje in de kopregel, info-vakken als tegels.
- **Selectie & delen**-paneel rechts; presenteerknop past zich aan (maand / geselecteerde); miniaturen-strook in de
  presentatie; gewone filterbalk van de app.
- **Coach-feedback bewaren bij de trade** (ja).
- **Per-trade-pagina meenemen** in dezelfde ronde.
- Daarna: filter "Alle playbooks" (zie boven).
