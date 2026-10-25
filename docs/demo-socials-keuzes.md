# Morani-links in SyncJournal: keuzes

Demo: `demos/socials-demo.html` (via localhost openen). Bovenin schakel je tussen plaatsing A/B/C,
licht/donker, desktop/390 px en Dashboard/FAQ. De stand staat in de URL, dus je kunt hem delen
(bv. `?p=B&t=dark&w=390&open=1`). "Markeer wat nieuw is" omlijnt wat er bijkomt.

Links: X `https://x.com/moranitrading`, YouTube `https://www.youtube.com/@moranitraden`,
website `https://moranitraden.nl/`. Alle drie openen in een nieuw tabblad met
`rel="noopener noreferrer"`, met tooltip en aria-label ("Morani op X", "Morani op YouTube",
"moranitraden.nl") en een zichtbare focusrand bij Tab.

## Plaatsingen

### A · Onderaan het linkermenu
Drie iconen van 17 px onder AI-coach, boven "Powered by Morani". Op telefoon onderaan het uitklapmenu.
Variant met en zonder kopje "Morani" (schakelaar).

- **Voor:** altijd binnen bereik voor leden, kost geen ruimte, geen extra tekst.
- **Nadeel:** het menu zegt al "Powered by Morani" in de voet. Iconen plus kopje "Morani" plus
  "Powered by Morani" is drie keer Morani binnen 80 px. **Advies: zonder kopje**, de voet doet dat werk al.
- **Nadeel:** op een laag scherm (laptop 768 px hoog) schuift het menu net iets eerder in de scroll.

### B · A plus de footer van de landingspagina
Zelfde iconen in de footer van syncjournal.nl, met optioneel de regel
"SyncJournal is gemaakt voor de community van Morani".

- **Voor:** bezoekers die nog geen lid zijn zien meteen bij wie SyncJournal hoort. Dat is de plek waar
  het iets oplevert: in de app zit je al in de community.
- **Nadeel:** weinig. Footer is de gangbare plek voor socials.

### C · B plus één regel onderaan de FAQ
"Meer van Morani: X · YouTube · moranitraden.nl" als tekstlinks onder de laatste vraag.

- **Voor:** natuurlijke plek voor "waar vind ik meer?".
- **Nadeel:** derde plek met dezelfde links. Weinig mensen scrollen de FAQ helemaal af, en in de app
  stonden ze al in het menu. Voegt het minst toe.

**Mijn advies: B, zonder kopje in het menu, mét de tekstregel op de landing.** C is ruis.

## Wat er moet veranderen

### `work/syncjournal.html`
1. CSS bij de sidebar-regels (rond `.side-foot`): de blokken `.soc`, `.soc a`, `.side-soc` uit de demo
   (sectie "NIEUW · Morani-links"). Alleen tokens (`--muted`, `--accent`, `--hover`, `--faint`), dus
   licht en donker werken vanzelf.
2. HTML in `<aside class="side">`: tussen `<nav id="navbot">` en `<div class="side-foot">` een
   `<div class="side-soc"><div class="soc" id="sideSoc"></div></div>`.
3. JS: een `MORANI`-lijst (href, label, svg) en `socIcons()` uit de demo, één keer bij het opstarten
   in `#sideSoc` zetten. Niet in `renderNav()`: de links veranderen nooit.
4. Alleen bij C: `socLine()` onderaan `pgFaq()`, na `#faqNone`, en de `.morline`-CSS.
5. Release: patch (`v1.15.1` → `v1.15.2`), het is een kleine toevoeging zonder invloed op cijfers.
   Changelog onder **Toegevoegd**.

### `site/index.html`
In `<footer class="foot">` vóór de bestaande tekst de `.foot-mor`-rij (regel + drie iconen) uit de demo,
plus de bijbehorende CSS (`.foot-mor`, `.soc`). De landing kent licht en donker via
`prefers-color-scheme`/`data-theme`; omdat alles tokens zijn, werkt dat zonder extra regels.

## Open vragen voor Denny

1. **Kopje "Morani" in het menu:** wel of niet? (advies: niet, zie A)
2. **Wereldbol of Morani-logo** voor de website? Een eigen logo is herkenbaarder, maar dan moet het
   eenkleurig kunnen (één vorm, `currentColor`) en mag Morani het goedkeuren. Wereldbol is neutraal en
   past bij de lijniconen van de app.
3. **Tekstregel op de landing:** "SyncJournal is gemaakt voor de community van Morani" goed zo, of
   korter ("Gemaakt voor de community van Morani")? Mag Morani hem lezen voordat hij live gaat?
4. **Volgorde:** X, YouTube, website. Of YouTube eerst, als dat Morani's hoofdkanaal is?
5. **Icoon-gewicht:** het X-logo is een volle, hoekige vorm en oogt in donker iets zwaarder dan de
   wereldbol (lijn). Acceptabel, of de bol iets dikker (stroke 2 i.p.v. 1,8)?

## Bijvangst (buiten deze demo, niet aangepast)

In de app staat de schaduw van het mobiele menu (`box-shadow:0 0 46px …` op `.side` bij
`max-width:720px`) ook als het menu dicht is. In de demo gaf dat een grijze waas langs de linkerrand;
ik heb hem daar alleen op het open menu gezet. In de app vermoedelijk hetzelfde, niet nagemeten.
