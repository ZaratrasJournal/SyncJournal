# TradingPlan v3 — ronde 7, rapport (31-10-2026): charts al in het scenario-venster

Branch `plan-v3-ronde7`, gemaakt vanaf `release-v1.27.1` (de stand op work). Opdracht en logboek:
[plan-v3-ronde7-2026-10-31.md](plan-v3-ronde7-2026-10-31.md). Niets is gereleased: geen versienummer, geen CHANGELOG,
niets naar `site/` of de deploy-repo.

| Wat | Commit | Spec |
|---|---|---|
| Charts in het scenario-venster, concept tot Bewaar | `d71af5d` | `plan3-ronde7` 27/27 (nieuw, in de release-poort) |

Alle plan3-specs, `theme-hook`, `faq` en `faq-volledig` groen (22/22). De release-poort staat hieronder.

## Wat Zaratras vroeg

"Als je een scenario toevoegt en het scherm opent, dat je daar ook al direct je afbeeldingen of TradingView-link kan
toevoegen."

## Wat er veranderde

- **Het scenario-venster** (Nieuw scenario én Scenario bewerken) heeft onder Notitie een blok **Charts**, met dezelfde
  bediening als een opengeklapt scenario:
  - "+ Afbeelding" (kiezen), plakken met Ctrl/Cmd+V en slepen in het venster;
  - een linkveld met "+ Link" of Enter;
  - miniaturen met ×, de links met ×;
  - de teller "2/4 afbeeldingen · 1/4 links".
- **Eén code-pad:** het blok gebruikt dezelfde code als het opengeklapte scenario (`mediaBlok`, `voegBeeldToe`,
  `voegLinkToe`), op het concept van het venster (`doelMedia('draft')`). Verkleinen, de grens, de link-controle en de
  meldingen zijn dus gelijk.
- **Plakken met de cursor in een tekstveld:** een afbeelding gaat naar Charts, tekst blijft gewoon tekst.
- **Concept tot Bewaar.** Wat je toevoegt, hangt pas bij Bewaar aan het scenario. Annuleer, ×, Escape of een klik naast
  het venster laten niets achter, ook niet in IndexedDB `tp3`. Bij bewerken haal je iets weg in het venster; met
  Annuleer is er niets weg, met Bewaar is het weg (ook uit `tp3`).
- **Na Bewaar** staan de afbeeldingen en links:
  - in het opengeklapte scenario, de eerste groot (ronde 4);
  - in "Zet om in trade", waar staat hoeveel er meegaat (ronde 6);
  - bij "Nieuwe trade invullen", op het tradeformulier.
  De spec loopt dat hele pad door.
- **Vol:** "+ Afbeelding" (of het linkveld) staat uit, met "vol: hooguit 4 afbeeldingen per scenario". Dat geldt nu
  voor elk mediablok.
- **Fouten:** een link zonder http(s) ("Alleen http(s)-links …") en een bestand dat geen afbeelding is ("Alleen
  afbeeldingen …") geven de bestaande meldingen.
- **Telefoon (390 px):** één kolom, de knoppen van een mediablok minstens 38 px hoog, geen horizontale scroll.
- **FAQ:** "Kan ik screenshots en TradingView-links in mijn plan zetten?" zegt nu dat het al bij het maken kan, en dat
  Annuleer niets achterlaat.

## Besluiten

- Besluit: de grens in het venster is **4 afbeeldingen en 4 links**, niet 8 zoals de opdracht noemde — de opdracht
  vraagt hergebruik van de media-code van het scenario, en die grens is 4 per scenario (`MAX_MEDIA.scen`; 8 geldt voor
  een dag en een week). Een andere grens in het venster dan in het opengeklapte scenario zou twee varianten betekenen —
  als het fout is: `MAX_MEDIA.scen` naar 8 zetten is één getal, maar dan ook `plan3-media` (toetst 4) en de 16:9-strip
  (meer miniaturen) nalopen.
- Besluit: afbeeldingen gaan bij het toevoegen meteen naar IndexedDB `tp3` (zoals elders), en Annuleer wist ze weer — in
  plaats van ze pas bij Bewaar weg te schrijven — ze moeten toch verkleind en getoond worden (en ze in het geheugen
  houden tot Bewaar is een tweede pad); het venster houdt bij welke het toevoegde (`M.nieuw`) — als het fout is: sluit je
  het tabblad terwijl het venster open staat, dan blijven die paar afbeeldingen in `tp3` staan zonder scenario (ze komen
  nergens in beeld en gaan niet mee in de back-up van het plan, want die gaat over de plannen).
- Besluit: een afbeelding die je in het venster weghaalt, verdwijnt pas bij Bewaar uit `tp3` — anders is "weghalen +
  Annuleer = niets weg" niet waar te maken — als het fout is: geen.
- Besluit: het blok Charts staat onder Notitie, als laatste van het formulier — eerst de afspraken van het scenario,
  dan de plaatjes erbij; direct onder "Ongeldig als" zou Stop en TP's van de trigger losmaken — als het fout is: één regel
  verplaatsen.
- Besluit: de vol-staat ("+ Afbeelding" uit met uitleg) geldt voor elk mediablok, ook van dag en week — één bediening —
  als het fout is: geen; de melding bij plakken blijft er ook.
- Besluit: op de telefoon zijn de knoppen en het linkveld van een mediablok minstens 38 px hoog — "knoppen groot genoeg"
  — als het fout is: alleen opmaak.

## Release-poort

`node tests/run-release.js --hier` (werkmap): **176/179 groen** in 5,9 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten wisselkoersen bij `api.frankfurter.dev` (`FX_URL` in `work/syncjournal.html`); vanuit de container is die host niet bereikbaar (`curl` geeft `000`). In ronde 3 t/m 6 precies zo rood; deze ronde raakt in de journal alleen een FAQ-tekst. |

Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: 8 specs geheel of deels.

## Wat niet getest kon worden

- **Echt slepen vanuit de verkenner** in het venster. Getest zijn kiezen en plakken; slepen gebruikt dezelfde
  `.media`-afhandeling (`data-doel="draft"`) als elders, en die toetst `plan3-media`.
- **Het tabblad sluiten terwijl het venster open staat.** Dan blijven de in dat venster toegevoegde afbeeldingen in
  `tp3` staan zonder scenario (zie het tweede besluit). Niet te testen zonder een echte browser-afsluiting.
- **Safari en echte telefoons:** alleen Chromium.

## Screenshots

`docs/plan-v3-ronde7-screenshots/`, licht en donker, 1280 en 390:
- `voor-leeg-*` en `voor-bewerken-*`: het venster van v1.27.1, zonder Charts.
- `na-leeg-*`: met het lege blok Charts onderaan.
- `na-met-*`: met 2 afbeeldingen en 1 TradingView-link.
- `na-bewerken-*`: een bestaand scenario bewerken.

## Concept-CHANGELOG

```markdown
### Toegevoegd
- **Charts al bij het maken van een scenario.** In het venster Nieuw scenario (en Bewerken) staat onderaan Charts: kies,
  plak of sleep een afbeelding, of plak een TradingView-link. Ze komen bij Bewaar bij het scenario; Annuleer laat niets
  achter.
```
