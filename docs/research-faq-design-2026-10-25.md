# Onderzoek: een overzichtelijke, goed leesbare FAQ (25-10-2026)

Doel: de FAQ in `work/syncjournal.html` (10 categorieën, 71 vragen op branch `faq-update`) beter
**vindbaar** en **leesbaar** maken. Inhoud blijft zoals hij is (zie `docs/faq-audit-2026-10-25.md`).
Lezers zijn vaak beginners: weinig kennis van traden en van een journal.

> **Over de bronnen.** Ik heb gezocht via een zoekmachine. Van een paar NN/g-artikelen kreeg ik
> alleen de samenvatting, niet de volle tekst; waar een punt uit een secundaire bron komt, staat
> dat erbij. Van Notion en Edgewonk vond ik geen bruikbare helpcenter-pagina's, die laat ik weg.

## De 10 belangrijkste principes

| # | Principe | Bron |
|---|---|---|
| 1 | **Kort antwoord eerst.** Begin met de conclusie, details daarna. Wie na één zin stopt, heeft het antwoord al. | NN/g, omgekeerde piramide (via [AIOSEO](https://aioseo.com/how-to-use-the-inverted-pyramid-to-improve-web-content/), secundair); [SJSU Writing for the Web](https://sjsu.edu/digital/standards/writing-for-the-web.php) |
| 2 | **Groepeer per onderwerp en laat de groepen zien.** Een goede FAQ is "chunked by topic and designed to be visually scanned". Bij een lange FAQ: eerst een lijst van onderwerpen/vragen, dan de antwoorden. | [NN/g, FAQs Still Deliver Great Value](https://www.nngroup.com/articles/faqs-deliver-value/) |
| 3 | **Zoeken én bladeren.** Zoeken alleen is niet genoeg: lezers gebruiken andere woorden dan de maker ("geld kwijt" vs. "lek"). Bladeren via categorieën vangt dat op. | [NN/g, FAQs Still Deliver Great Value](https://www.nngroup.com/articles/faqs-deliver-value/) |
| 4 | **Inhoudsopgave voor een lange pagina.** Mensen kijken vooral bovenaan; onderaan een lange pagina wordt weinig gelezen. Een inhoudsopgave (op desktop vaak in een zijkolom, sticky; op mobiel een uitklaplijst) laat zien wat er nog komt, en elk deel krijgt een eigen link. | [NN/g, Table of Contents](https://nngroup.com/articles/table-of-contents); [Keystone design system (PA)](https://wcmauthorguide.pa.gov/en/keystone-design-system/design-system-components/Table-of-Contents.html) |
| 5 | **Accordions: goed voor veel korte antwoorden waarvan je er maar een paar nodig hebt.** Ze besparen scrollen, maar verbergen inhoud en kosten een klik. Niet gebruiken voor iets wat iedereen moet lezen. Een duidelijk uitklap-icoon (caret / plus) helpt. | [NN/g, Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/); [NN/g video, 5 scenario's](https://www.nngroup.com/videos/avoid-accordions/); [GOV.UK Accordion](https://design-system.service.gov.uk/components/accordion) |
| 6 | **Regellengte 50 tot 75 tekens.** Te lange regels schrikken af; lezers slaan de tekst dan vaker over. WCAG noemt 80 tekens als bovengrens. | [Baymard, Line Length](https://baymard.com/blog/line-length-readability); [WCAG 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation) |
| 7 | **Ruime regelhoogte en echte alinea's.** Regelhoogte minstens 1,5; ruimte tussen alinea's minstens 1,5× de regelhoogte. Dat helpt vooral lezers die moeite hebben om regels te volgen. Een alinea is een blok met marge, geen dubbele `<br>`. | [WCAG 1.4.8 (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation) |
| 8 | **Leesbare lettergrootte voor lopende tekst.** Platformrichtlijnen zetten bodytekst op 16-17 pt (Apple Body 17 pt, Material Body 16 sp). In een compacte app van 13,5 px is 15 px voor antwoorden een redelijk compromis. | [Apple HIG, Typography](https://developer.apple.com/design/human-interface-guidelines/typography); getallen via [uxdesign.cc](https://uxdesign.cc/guide-for-designing-better-mobile-apps-typography-5796495ef86f) (secundair) |
| 9 | **Toegankelijk uitklappen.** Elke kop is een echte knop, werkt met toetsenbord (Enter/Spatie), heeft zichtbare focus, en de staat (open/dicht) is voor een schermlezer te horen. Tekstcontrast minstens 4,5:1 (WCAG AA). | [WAI-ARIA APG Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/); [GOV.UK Publishing, Accordion](https://components.publishing.service.gov.uk/component-guide/accordion) |
| 10 | **Gewone taal, korte zinnen, één idee per zin.** GOV.UK schrijft voor een leesleeftijd van 9 jaar; ook experts lezen dat sneller. Zinnen onder ±20 woorden, alinea's van 3-4 zinnen. Lezers scannen: de eerste twee woorden van een kop dragen het meeste. | [Writing for GOV.UK (archief 2022)](https://govdiff.njk.onl/update/2022-05-05T11:26:00+01:00/www.gov.uk/guidance/content-design/writing-for-gov-uk); [Surrey CC](https://www.surreycc.gov.uk/website/writing-guide/reading-levels-for-web-pages); NN/g F-patroon via [SSW](https://www.ssw.com.au/rules-legacy/f-shaped-pattern) (secundair) |

## Wat de voorbeelden goed doen

- **[Stripe Support](https://support.stripe.com/)**: groot zoekveld met "How can we help?",
  daaronder **Popular articles** en een rij **onderwerpen**. Bij elk artikel staat hoeveel procent
  er geholpen mee was. Zoeken en bladeren staan naast elkaar.
- **[Linear Docs](https://linear.app/docs)** (beschreven in [deze teardown](https://docsio.co/blog/linear-docs-teardown)):
  een hub met twee blokken, *Popular* en *Linear basics*, als kaartenraster. **Elke kaart heeft
  één regel uitleg.** Links een vaste zijbalk, bovenaan zoeken.
- **[Revolut Help](https://help.revolut.com/en-AT/help/profile-and-plan/getting-started-with-revolut)**:
  een zijbalk met categorieën, met **"Getting started"** bovenaan. Je ziet altijd waar je bent.
- **[TradingView Help Center](https://www.tradingview.com/support/solutions/43000698097-how-to-get-help-support-on-tradingview)**:
  zoeken of bladeren per categorie, en wie het niet vindt wordt **doorverwezen** (eerst de
  kennisbank of AI-assistent, dan pas support). Vergelijkbaar met onze "vraag het Mori / de Discord".
- **[TradeZella Help](https://help.tradezella.com/en/collections/3281450-faqs)**: helpcenter in
  **collecties** (FAQ, account, import); support via chat, helpcenter én Discord.
- **[Tradervue Help](https://www.tradervue.com/help/reports)**: categorieën **met het aantal
  artikelen** erbij (getting started 6, import trades 12, ...), plus video's om te beginnen.
- **bunq** stuurt gewone vragen naar de community ([together.bunq.com](https://doc.bunq.com/support)):
  de community is daar het vangnet, zoals de Morani Discord bij ons.

Rode draad: **zoekveld bovenaan, categorieën altijd zichtbaar (met aantal of één regel uitleg),
een paar "populaire" vragen, en een duidelijke uitweg als je het niet vindt.**

## Wat dit betekent voor de SyncJournal-FAQ

| Probleem nu | Wat het onderzoek zegt | Voorstel |
|---|---|---|
| 71 gelijke witte kaarten onder elkaar | Groeperen en scanbaar maken (2), inhoudsopgave (4) | Per categorie **één kaart met rijen** (dunne lijnen), niet 71 losse kaarten. Een inhoudsopgave met aantallen. |
| Categorie = klein grijs kopje in hoofdletters | Laat de groepen zien (2), één regel uitleg (Linear) | Groot categoriekopje met icoon en **één regel uitleg** ("Back-ups, overzetten, privacy"). |
| Antwoord 13 px, grijs, dubbele `<br>` | 15 px (8), gewone tekstkleur, echte alinea's en regelhoogte 1,6 (7) | `font-size:15px; color:var(--ink); line-height:1.65`, `<br><br>` wordt `<p>`. |
| Kort antwoord valt niet op | Kort antwoord eerst (1) | De **eerste zin vet**, als "kort antwoord". De teksten beginnen al zo (afspraak uit de audit), dus dit kan automatisch. |
| Stappen als "1. ... 2. ..." in één zin | Lijsten voor stappen (10) | Inline "1. … 2. …" omzetten naar een `<ol>`. |
| Visie-blok lijkt een helpdesk-vraag | Andere soort inhoud, andere vorm | Eigen blok **"Van de maker"**: citaatstijl, accentlijn, ondertekend *Zaratras*. |
| Smalle kolom links, leeg rechts | Inhoudsopgave in de zijkolom (4), regellengte 65-75 (6) | De lege ruimte vullen met navigatie, **niet** met bredere tekst: de antwoordkolom blijft rond 68 tekens. |
| Zoeken vindt niets → korte grijze regel | Uitweg bieden (TradingView, bunq) | Lege staat met suggesties ("probeer: back-up, R, koppelen") en de weg naar **Mori** en de **Morani Discord**. |
| Beginners weten niet waar te starten | "Getting started" bovenaan (Revolut), populair (Stripe, Linear) | **"Populaire vragen"** (4-6) en "Aan de slag" als eerste categorie. |

Wat ik **niet** zou doen: aparte pagina per vraag (te zwaar voor 71 korte antwoorden, en de
single-file-app heeft geen router voor helpartikelen), en geen "was dit nuttig?"-knop zoals Stripe:
zonder backend gaat die feedback nergens heen.
