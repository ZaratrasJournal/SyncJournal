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

## Verdict
_(invullen na Denny's keuze; daarna demo verwijderen en het plan schrijven)_
