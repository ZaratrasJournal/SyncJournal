# FAQ-demo: keuzes (25-10-2026)

Demo: `demos/faq-demo.html` (open via localhost, bv. `python3 -m http.server` in de repo-root →
`http://localhost:8000/demos/faq-demo.html`). Schakelaars bovenin: variant, Licht/Donker,
Desktop/390px. Ook via de URL: `?v=A|B|C&t=light|dark&w=390`.
Onderzoek: `docs/research-faq-design-2026-10-25.md`.

**Inhoud.** De demo gebruikt de echte `FAQS` van branch **`faq-update`** (10 categorieën,
**71 vragen**, met visie-categorie en Mori), niet die van `main`: daar staat de nagelopen versie
nog niet. De teksten zijn letterlijk gekopieerd, op één ding na (zie *Bevindingen*).

## Wat in alle drie hetzelfde is

- **Antwoorden**: 15 px (C: 15,5 px), gewone tekstkleur `--ink`, regelhoogte 1,65, maximaal
  68 tekens per regel, echte alinea's (`<p>` met witruimte) in plaats van `<br><br>`.
- **Kort antwoord**: de eerste zin staat apart en vet. Dat gebeurt automatisch: de audit heeft
  elk antwoord al met het antwoord laten beginnen. Gecontroleerd op alle 66 helpdesk-antwoorden:
  elk krijgt een korte eerste zin (3 tot 137 tekens, mediaan 61). Twee keer is dat alleen "Ja.",
  dat leest prima.
- **Stappen**: de bestaande `<ol>`/`<ul>` krijgen nette nummer-bolletjes en stippen. De ene
  inline-opsomming ("(1) … (2) … (3) …" bij Tendencies) wordt automatisch een genummerde lijst.
- **Van de maker**: de visie-categorie is een eigen blok: paarse accentlijn, avatar "Z", het
  eerste zinnetje als citaat, ondertekend *Zaratras*. Na "Aan de slag" (A), onder de tegels (B),
  of als brief in het leesvenster (C).
- **Zoeken**: live, op elk woord (alle woorden moeten voorkomen), ongevoelig voor accenten en
  streepjes ("backup" vindt "back-up"). Staat het woord alleen in het antwoord, dan zie je onder
  de vraag een stukje antwoord met het woord gemarkeerd. Zo snap je waarom een vraag matcht.
- **Lege staat**: "Niets gevonden voor …", vijf zoeksuggesties als knoppen, en de weg naar Mori
  en de Morani Discord.
- **Toegankelijk**: `<details>`/`<button>`, zichtbare focus, toetsenbord getest (Tab + Enter,
  in C ook pijltjes en Enter = eerste treffer). axe-core (WCAG 2.2 AA) op 26 schermen: **0
  overtredingen**, licht én donker. Alleen CSS-variabelen; afgeleide kleuren via `color-mix`.
- Onderaan "Meer van Morani: X · YouTube · moranitraden.nl".

## Variant A · Inhoudsopgave

Links een meescrollende inhoudsopgave met de 10 onderwerpen en aantallen (actief onderwerp licht
mee op tijdens scrollen); rechts zoeken, "Veel gevraagd", en per categorie één kaart met rijen
en een groot kopje met één regel uitleg. Op telefoon wordt de inhoudsopgave een plakkende rij chips.

| Voor | Tegen |
|---|---|
| Alles op één pagina: bladeren, zoeken én Ctrl+F werken | Blijft een lange pagina (71 vragen) |
| Vult het lege vlak op desktop met navigatie, niet met bredere tekst | Op telefoon zie je maar 2-3 chips; de rest moet je swipen |
| Dichtst bij de huidige opzet: `faqFilter`, `faqGoto` en de visie-links blijven werken | Scroll-spy is een extra scroll-listener in een SPA |
| Zoekresultaten tonen meteen de telling per onderwerp | |

**10-secondentest**: desktop ja (alle onderwerpen staan direct links). Telefoon: twijfel.

## Variant B · Tegels

Groot zoekveld, daaronder 9 onderwerp-tegels (icoon, naam, uitleg, aantal), dan "Populaire
vragen" en het maker-blok. Klik op een tegel = alleen die categorie, met "← Alle onderwerpen" en
"Andere onderwerpen" onderaan. Zoeken toont treffers gegroepeerd per onderwerp.

| Voor | Tegen |
|---|---|
| Beste overzicht voor beginners, ook op telefoon (tegels in 2 kolommen) | Een klik extra vóór je een vraag ziet |
| Uitleg per onderwerp is zichtbaar vóór je klikt | Je kunt niet alle vragen in één keer scannen |
| Rustigste eerste indruk | Nieuwe weergave-staat in de app (welke tegel open is); de terug-knop van de browser werkt niet zonder extra werk |

**10-secondentest**: ja, desktop en telefoon. Dit is de sterkste variant op vinden.

## Variant C · Lezen

Links een lijst met alle vragen (per onderwerp, met zoekveld en een "Spring naar"-keuzelijst),
rechts het antwoord groot in een leesvenster, met "Meer over …" en Vorige/Volgende. De visie
staat als één doorlopende brief. Op telefoon: eerst de lijst, tik = antwoord met "← Alle vragen".

| Voor | Tegen |
|---|---|
| Prettigst om te lezen: groot, rustig, één antwoord tegelijk | Onderwerp vinden is het traagst: 71 vragen onder elkaar |
| "Meer over" en Vorige/Volgende nodigen uit tot doorlezen | Op telefoon twee schermen (lijst ↔ antwoord) |
| Visie als brief voelt het meest persoonlijk | Meeste nieuwe code en staat; wijkt het verst af van de rest van de app |

**10-secondentest**: nee. De keuzelijst helpt, maar een beginner moet weten dat hij er is.

## Wat er in `work/syncjournal.html` moet veranderen

**`FAQS` kan blijven zoals hij is** (`[categorie, [[vraag, antwoord, id?], …]]`). Nodig:

1. **Uitleg per categorie**: een derde element in de categorie, `['🚀 Aan de slag', [...], 'Wat het is, wat het kost en hoe je begint']`,
   of een losse map. Teksten staan in de demo (`DESC`).
2. **`fmtAnswer(a)`** (±40 regels, uit de demo): `<br><br>` → `<p>`, lijsten los, inline stappen →
   `<ol>`, eerste zin → `p.kort`. Liever bij het renderen dan in de data: de data blijft dan
   leesbaar en de audit-regel "antwoord eerst" doet het werk.
3. **`pgFaq`** herschrijven naar de gekozen variant; **CSS** van `details.faq` en `.faqcat`
   vervangen.
4. **`faqFilter`** uitbreiden: per woord, zonder accenten, met snippet en tellers. `faqGoto`
   blijft zoals hij is.
5. **Tests**: `tests/faq.spec.js` (op `faq-update`) kijkt naar `.faqcat`, `.faqcat-h`,
   `details.faq`, `.faq-a` en `.faqhero .faqsearch`, en verwacht dat álle treffers openklappen.
   Die selectors en die ene verwachting moeten mee. Voeg één check toe: elk helpdesk-antwoord
   heeft een `p.kort` en er staat geen `<br>` meer in.
6. Het zoekveld krijgt een `id`, zodat de focusbewaking van `render()` het meeneemt.

**Bouwgrootte**: A = **M** (±150 regels JS/CSS, spec aanpassen), B = **M/L** (+ weergave-staat en
terug-navigatie), C = **L** (+ selectie-staat, twee mobiele schermen, toetsenbordnavigatie).

## Bevindingen buiten de opmaak

- **"Denny" staat in zichtbare tekst.** Het eerste visie-antwoord ("Waarom heb je SyncJournal
  gebouwd?") eindigt op branch `faq-update` met `<i>Denny</i>`. In de demo staat daar *Zaratras*.
  Dat moet in de data worden aangepast vóór `faq-update` naar `main` gaat.
- **"Meer van Morani"-regel haalt in licht geen AA.** `.morline` gebruikt `--muted` op `--bg`:
  4,39:1 (norm 4,5). In de demo `--ink2` (6,4:1). Dat zit zo in de hele app, niet alleen de FAQ.
- Ook `--muted` voor tellers en `--violet` als tekstkleur op een lichte paarse achtergrond halen
  in licht net geen 4,5:1. In de demo opgelost met `--ink2` en een donkerder paars
  (`color-mix(var(--violet) 78%, var(--ink))`). Let op: zo'n afgeleide variabele moet op `body`
  staan, niet op `:root`, anders rekent hij in donker met de lichte kleuren (axe ving dat).

## Aanbeveling

**Variant A**, met één ding van B: **op telefoon de onderwerpen als compact 2-koloms raster
bovenaan** in plaats van de chip-balk. Waarom:

- A lost alle vijf de klachten op (muur, inhoudsopgave, leesbaarheid, visie, leeg vlak) en
  houdt alles op één pagina. Zoeken, bladeren en Ctrl+F blijven werken; dat past bij een FAQ van
  korte antwoorden (NN/g: accordions voor veel korte antwoorden waarvan je er een paar nodig hebt).
- Het is de kleinste ombouw: dezelfde data, dezelfde `faqGoto`, geen nieuwe navigatie-staat.
- Het zwakke punt van A zit op telefoon (chips verstoppen de meeste onderwerpen). Daar is B
  juist sterk. Tegels op telefoon, inhoudsopgave op desktop, dekt beide.

C is het mooiste om te lezen, maar de FAQ is geen handleiding: de meeste antwoorden zijn 3-6
zinnen. Daarvoor is een leesvenster met lijst te zwaar, en vinden wordt er trager door.
