# Plan: €/%/R-weergaveschakelaar (zoals de originele Morani-journal)

**Status:** plan + klikbare demo ([demos/unit-toggle-demo.html](../demos/unit-toggle-demo.html)); bouw start na Denny's akkoord.
**Referentie:** Denny's screenshot 2026-09-17 — seg [€ | % | R] rechts in de dashboard-hero; "Gerealiseerd deze maand +762,0R · YTD +0,0%" terwijl de balans gewoon $ 4.722 blijft.

## Onderzoek: hoe doen anderen dit

- **De originele Morani-journal** (het screenshot): één seg in de hero; de gekozen unit bepaalt hoe álle P&L-achtige waarden op het dashboard tonen; de balans zelf blijft altijd valuta. De share-cards kenden al "Pro-mode · R-multiples" — R-weergave is daar óók een privacy-functie (bedragen delen zonder bedragen te tonen).
- **Edgewonk**: $/%/R-switch in de statistieken. Belangrijkste les: trades zonder gedefinieerd risico worden **buiten** de R-statistieken gehouden en apart geteld — nooit als 0R meegemiddeld.
- **Tradezella / TraderSync**: globale weergave-switch; percentages t.o.v. de accountgrootte op het moment van de trade (exact wat wij sinds v0.9.89 al berekenen).
- **Prop-dashboards (FTMO-stijl)**: alles in % van een vaste accountgrootte — gedekt door onze bestaande "vast referentiebedrag"-instelling.

Vier lessen: (1) balans blijft valuta; (2) R-modus is ook privacy; (3) trades zonder R apart tellen, nooit als 0; (4) **percentages nooit optellen**.

## Kernbesluiten

- `STATE.unit`: `'val' | 'pct' | 'r'` (persist, default `'val'`). Seg rechts in de hero; het €-teken volgt de valuta-instelling ($/€).
- De instelling geldt app-breed (één bron), maar we bouwen in fases (zie Scope).
- **Balans-pill en Totale balans blijven altijd valuta** — "34% balans" bestaat niet.
- Geen betrouwbare waarde in de gekozen unit (basis onbekend / R onbekend) → **"—"**, nooit een verzonnen getal (zelfde principe als v0.9.89).
- Privacy-oog: in %- en R-modus zijn P&L-bedragen al onzichtbaar; de balans blijft gemaskt zoals nu.

## De berekeningen (dubbel nagerekend)

**Per trade**
- € : `t.pnl` (bestaand)
- % : `pnlPctOf(t)` (bestaand sinds v0.9.89 — balans op het moment van de trade; `null` → "—")
- R : nieuw `tradeROrNull(t)`: geldige `t.r`, anders theoretische R, anders **null**. Let op: de bestaande `tradeR()` geeft 0 bij onbekend — prima voor interne sorteringen, **fout** voor weergave/gemiddelden; die blijft ongemoeid, weergave gebruikt de null-variant.

**Aggregaties (periode of selectie)**
- € : som van pnl (bestaand)
- R : som van géldige R's, met teller ernaast bij ontbrekende ("+7,5R · 2 zonder R"); gemiddelde alleen over geldige R's
- % : **nooit** de per-trade-percentages optellen. Formule: `netto€ ÷ balans-bij-periodestart`, met balans-bij-start = `totalBalance() − pnl(alle gesloten trades in en ná de periode…start)` — exact de reconstructie die YTD al gebruikt. Basis ≤ 0 → "—".

**Controlevoorbeeld (met de hand nagerekend)**
Balans nu $1.000. Gesloten trades: t1 (1 sep) +$80 · risk $40, t2 (5 sep) −$30 · géén stop, t3 (10 sep) +$150 · risk $75.
- t1: basis 1.000−(80−30+150)=**800** → **+10,00%** · **+2,0R**
- t2: basis 880 → **−3,41%** · R **—** (géén 0!)
- t3: basis 850 → **+17,65%** · **+2,0R**
- Maand als geheel: netto +$200 op startbasis 800 → **+25,00%**. De som van de per-trade-percentages is 24,24% — het bewijs waarom optellen fout is.
- Maand in R: **+4,0R over 2 trades · 1 zonder R** (t2 telt niet als 0R mee; gemiddelde is +2,0R, niet +1,33R).

**Maand-P&L-chart in %**: per maand dezelfde formule met de balans bij díe maandstart. Bewust géén cumulatieve samengestelde rendementen (eerlijk, simpel, per-maand-vergelijkbaar); de chip labelt "t.o.v. maandstart".

## Scope

**Fase 1 — dashboard (dit plan):**
| Widget | € | % | R |
|---|---|---|---|
| Hero "Gerealiseerd deze maand" + YTD | bestaand | maand-/jaar-% (startbasis) | ΣR (+ n zonder R) |
| KPI Netto P&L | bestaand | periode-% | ΣR |
| KPI Expectancy (per trade) | €/trade | periode-% ÷ n | gem. geldige R |
| KPI Win-rate / Profit factor / Gem. R | ongewijzigd — unit-loos | ← | ← |
| Maand-P&L-staafjes | bestaand | % per maand | ΣR per maand |
| Recente trades (P&L-cel) | bestaand | per-trade % | R-badge |

**Fase 2 (na fase-1-feedback):** Trades-tabel (P&L-kolom + totaalregel), Analytics-panelen, chart-tooltips/assen.

## Tests (nieuwe spec `unit-toggle.spec.js`)

Het controlevoorbeeld hierboven 1-op-1 als checks; plus: % ≠ som-van-% bewaakt; R-onbekend nooit als 0; unit persist na herlaad; seg-render + klikgedrag; balans blijft valuta in alle drie de standen; "—" bij ontbrekende basis; samenspel met het privacy-oog.

## Inschatting

Fase 1 inclusief tests: ±3 uur. De demo staat klaar om het gevoel te checken vóór de bouw.
