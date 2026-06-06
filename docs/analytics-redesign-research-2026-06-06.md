# Analytics-pagina redesign — research
**Datum**: 2026-06-06
**Aanleiding**: Denny vindt huidige Analytics-pagina (~21 widgets in scroll-feed) onoverzichtelijk. Wil snellere navigatie + info-tooltips per widget.

## Executive summary
Top journals zijn vrijwel allemaal afgestapt van één lange scroll-feed:
- **KPI-strip + drill-down** (Stripe/Datadog-patroon)
- **Top-level tabs per analyse-as** (Tradervue Reports, Chartlog Insights, Edgewonk Edge Finder)
- **Side-nav met collapsible sections** (Edgewonk's nieuwe Expanded Analysis Panels, mei 2026)

Voor 20+ widgets is **sticky-TOC + sectie-anchors** de meest geprezen middenweg. Tooltips zijn industry-standaard via een `?`/`i`-icoon, hover+focus, max 2-4 woorden, WCAG 1.4.13-compliant.

---

## Findings per journal

| Journal | Navigatie | Default-view | Info-help |
|---|---|---|---|
| **Tradervue** | Top-tabs Trades/Journal/Reports/Community; Reports = aparte tab | Drag-and-drop widgets (Cumul. PnL, performance per time/price/size). Calendar P&L bovenaan | Geen inline tooltips; help leeft op aparte help.tradervue.com |
| **Edgewonk** | Linker sidebar + top-tabs | Edge Finder = **6 vaste categorieën** (behavior + performance) | ✨ **Mei 2026**: collapsible analysis panels met interpretatie-tekst per chart = exact wat Denny wil |
| **TraderSync (Cypher AI)** | KPI-strip met top + side widgets | Customizable trades-table tussenin | **Cypher praat conversational** over patronen i.p.v. statisch tooltip |
| **TradesViz** | Drag-and-drop builder | 50+ widget-types. Heatmaps (time-of-day/dow) signature | Multi-dimensional filter (20+ dims) i.p.v. tooltips |
| **Tradezella** | Customizable rearrange | Zella Score + Net PnL + PF + Max DD KPI-strip + Calendar bovenaan. **View-toggle ($ / R / Ticks / Pips) globaal** | 7+ views, 50+ reports onder aparte tab |
| **Deltalytix** | Drag-and-drop | Decile stats + calendar bovenaan | AI-agents per widget die interpretatie geven |
| **Chartlog.ai** | 4 top-tabs Dashboard / Trades / Strategies / **Insights** | Insights: filter-strip (symbol/tag/strategy/timeframe) → Equity → day/hour heatmap | AI Brief = ochtend-samenvatting met focus + warning + lesson |

## 3 industry-best-practices

1. **KPI-strip → trend-charts → tables** (Datadog/Stripe progressive disclosure): top-row = 4-6 primary KPIs altijd zichtbaar, midband = trend, onder = granulair. Drill-down via click i.p.v. alles tegelijk tonen.
2. **Sectie-nav voor lange pages**: NN/G zegt accordeon bij véél korte secties, tabs bij weinig lange. Voor 20+ widgets is **sticky-TOC met anchor-links** de meest schaalbare (combineert overzicht + jump). Sidebar (Edgewonk) werkt zodra je >15 secties hebt en mobile-collapse hebt.
3. **Tooltips**: `i`-icoon naast titel; WCAG 1.4.13 = dismissible, hoverable, persistent; ook keyboard-focusable (tabindex=0); max 2-4 zinnen; voorbeeld + formule bij metrics. NN/G: lijntekst alleen, geen interactieve elementen erin.

## Top-5 trader-vragen (uit forums/coaches)
1. "Welke setup heeft mijn beste expectancy/R-multiple?" — Edgewonk top-10 metrics gids
2. "Wanneer (uur/dag) presteer ik het best vs. slechtst?" — Steenbarger pattern #3
3. "Volgde ik m'n plan, of week ik af?" — JournalPlus: "single most useful binary tag"
4. "Wat is mijn profit factor / win-rate van de laatste 20-50 trades?" — sample-size benchmark
5. "Hou ik losers langer dan winners?" — Steenbarger's #1 leak-pattern

→ Deze 5 vragen mappen 1-op-1 op een logische sectie-volgorde:
**1. Overview → 2. Per setup → 3. Per timing → 4. Per emotie/discipline → 5. Edge-drains/leaks**

## 3 concrete aanbevelingen voor SyncJournal

### Aanbeveling 1 — Sticky-TOC links + KPI-strip bovenaan
- **KPI-strip** (5 cards, altijd zichtbaar): Net PnL · Win-rate · Profit factor · Expectancy · Plan-adherence%
- **Sticky-TOC links** groepeert 21 widgets in 5 secties zoals hierboven (Overview / Setup / Timing / Emotie&Discipline / Edge-drains)
- Volgorde matched Steenbarger's review-loop (plan → act → review → refine) en wat traders in forums eerst noemen.

### Aanbeveling 2 — Inline info-tooltips via `i`-icoon
- Rechts naast widget-titel
- Hover + focus (keyboard-reachable, WCAG 1.4.13 compliant)
- 2-4 zinnen + 1 voorbeeld + formule waar relevant
- Voorbeeld: `Expectancy = win% × avg_win − loss% × avg_loss; positief = edge`
- Edgewonk's mei-2026 "Expanded Analysis Panels" is het bewezen patroon: tooltip = "wat-is-het", panel = "wat-betekent-dit-voor-mij"

### Aanbeveling 3 — View-mode globaal in sticky filter-strip
- Behoud proces/winst/beide-toggle
- Maar verplaats naar **sticky filter-strip onder KPI**, niet per widget
- Tradezella's view-toggle (R / $ / Ticks / Pips) zit globaal bovenaan; Chartlog's Insights filter-strip idem
- Voorkomt cognitive load van per-widget toggles
- Mental model: "ik kies eerst de lens, dan kijk ik rond"

## Bronnen
1. [Tradervue dashboard customization](https://help.tradervue.com/article/3434-customize-your-dashboard)
2. [Edgewonk Expanded Analysis Panels (mei 2026)](https://edgewonk.com/changelog)
3. [Edgewonk Edge Finder 6-category structure](https://edgewonk.com/edge-finder)
4. [TraderSync Cypher AI conversational analytics](https://tradersync.com/cypher/)
5. [Tradezella 8 KPIs that matter](https://www.tradezella.com/blog/trading-dashboard)
6. [TradesViz 600+ stats, 50+ widget-types crypto](https://www.tradesviz.com/crypto/)
7. [Chartlog Insights tab + AI Brief](https://www.chartlog.ai/)
8. [NN/G tooltip best practices](https://www.nngroup.com/articles/tooltip-guidelines/)
9. [WCAG 1.4.13 tooltip accessibility](https://www.wcag.com/authors/1-4-13-content-on-hover-or-focus/)
10. [NN/G tabs vs accordions vs TOC](https://www.nngroup.com/videos/tabs-vs-accordions/)
11. [Edgewonk 10 most important trading metrics](https://edgewonk.com/blog/the-ultimate-guide-to-the-10-most-important-trading-metrics)
12. [Tradezella weekly trade review (Steenbarger-aligned)](https://www.tradezella.com/blog/weekly-trade-review-process)
