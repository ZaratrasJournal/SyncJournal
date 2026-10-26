# Onderzoeken en demo's

Overzicht van de onderzoeken in `docs/` en de demo's met een keuzedocument. Alles staat op `main`;
er hoeft niets meer van een losse branch gehaald te worden. Demo's open je via localhost
(bv. `python3 -m http.server` in de repo-root), niet via `file://`.

## Onderzoeken

| Datum | Onderzoek | Waar het over gaat |
|---|---|---|
| 25-10-2026 | [FAQ: overzichtelijk en leesbaar](research-faq-design-2026-10-25.md) | Principes (NN/g, GOV.UK, WCAG) en voorbeelden voor de opbouw en leesbaarheid van de FAQ. |
| 25-10-2026 | [Een echte AI-coach (eigen sleutel)](research-ai-coach-2026-10-25.md) | Hoe Mori werkt met de eigen Anthropic-sleutel van een lid, wat er verstuurd wordt en in welke volgorde gebouwd. |
| 24-10-2026 | [Funded modus (prop-firm challenges)](research-funded-modus-2026-10-24.md) | Hoe andere journals en prop firms challenges en funded accounts tonen, zonder je eigen balans scheef te trekken. |
| 26-09-2026 | [Kraken Futures REST API + account-log CSV](research-kraken-api-2026-09-26.md) | Endpoints en CSV-velden van Kraken Futures, live geverifieerd, voor de trade-reconstructie. |
| 26-09-2026 | [Hoe derden Kraken-posities reconstrueren](research-kraken-thirdparty-2026-09-26.md) | Hoe andere tools gesloten Kraken Futures-posities opbouwen, met bron per claim. |
| 17-06-2026 | [OKX Perpetual Swaps](exchange-research-okx-perps-2026-06-17.md) | Implementatie-onderzoek voor de OKX-koppeling via de Worker. |
| 17-06-2026 | [Bybit EU Perpetual Futures](exchange-research-bybit-eu-perps-2026-06-17.md) | Verkenning; perps op bybit.eu waren nog niet live. Geen bouwopdracht. |
| 06-06-2026 | [Funding-fees per trade](research-funding-fees-2026-06-06.md) | Welke exchange-API's funding per trade geven en hoe je die toewijst. |
| 06-06-2026 | [Analytics-redesign, v1](analytics-redesign-research-2026-06-06.md) en [v2](analytics-redesign-research-v2-2026-06-06.md) | Navigatie en uitleg op de Analytics-pagina; v2 gaat dieper dan de UX-patronen van v1. |
| 18-05-2026 | [Playbook-coaching AI](research-playbook-coaching-2026-05-18.md) | Onderzoek naar coaching op basis van je playbook, met aanbeveling voor een eerste versie. |

## Demo's met een keuzedocument

| Datum | Demo | Keuzes | Waar het over gaat |
|---|---|---|---|
| 25-10-2026 | [faq-demo.html](../demos/faq-demo.html) | [demo-faq-keuzes.md](demo-faq-keuzes.md) | Drie opmaken voor de FAQ; Zaratras koos B, tegels; die staat nu in de app. |
| 25-10-2026 | [funded-demo.html](../demos/funded-demo.html) | [demo-funded-keuzes.md](demo-funded-keuzes.md) | Eén eenvoudig ontwerp voor de funded modus, met alle toestanden om door te klikken. |
| 25-10-2026 | [socials-demo.html](../demos/socials-demo.html) | [demo-socials-keuzes.md](demo-socials-keuzes.md) | Plaatsing van de Morani-links (X, YouTube, website) in menu en FAQ. |

De overige bestanden in `demos/` zijn losse UI-proefjes zonder keuzedocument.
