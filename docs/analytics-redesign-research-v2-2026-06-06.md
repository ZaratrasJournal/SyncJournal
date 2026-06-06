# Analytics-pagina redesign — research v2 (diep)
**Datum**: 2026-06-06
**Vervangt**: research v1 (was te tactisch — alleen UX-patterns)
**Aanleiding**: Denny vroeg om diep onderzoek naar wat traders ÉCHT moeten weten. Plus beginner/advanced-modes + breder layout.

---

## Executive summary

Mainstream journals (Tradervue/Edgewonk/TraderSync/Tradezella) tracken oppervlakkige metrics. Pro-trader coaches (**Steenbarger, Tharp, Douglas, Bellafiore, Faith, Minervini**) en propfirms (**FTMO, Topstep, Apex**) wijzen op **5 verborgen metrics** die het verschil maken — die mainstream journals missen.

SyncJournal kan zich onderscheiden door **deze diepe metrics naast de standaard** te bieden, met een **beginner/advanced-toggle** zodat de pagina niet overweldigt.

---

## 1. Pro-coach metrics (specifiek per auteur)

### Brett Steenbarger (TraderFeed, Daily Trading Coach)
- **Hold-time asymmetry** = avg minuten verliezers / avg minuten winnaars. >1 = leak (klassiek "let winners run, cut losers fast" omgekeerd)
- **Long/short ratio per marktregime** — long-bias in downtrend = vroege diagnose-marker
- **Best Processes ≠ Best Practices** — track herhaalbare processen, niet incident-trades
- **Daily 10-question checklist** (self-talk, off-hours werk, risk-mgmt, sizing, loss-handling, emoties, motivatie, commitment, edge, discipline)

### Van K. Tharp (Trade Your Way…)
- **R-multiples** per trade — vergelijkbaar over symbols/sizes
- **Expectancy** = mean(R)
- **System Quality Number (SQN)** = `(E / σR) × √n`. **>1.6** = solide, **>2.5** = zeer goed, **>7** = overfit-verdacht. Minimaal 100 trades voor betrouwbaarheid.

### Mark Douglas (Trading in the Zone)
- Mindset zelf is niet-meetbaar → gedrag wel
- **5-step adherence**: edge-defined / rules-defined / probabilistic-mindset / detached-identity / flawless-execution per trade
- **Probabilistic acceptance**: was risk pre-trade geaccepteerd? Binary tag.

### Mike Bellafiore (One Good Trade, Playbook — SMB)
- **Process grade A+/A/B/C** elke trade — niet op P&L
- **Playbook-codification**: elke setup heeft eigen identity, track per playbook
- **5 decision-indicators** pre-trade ticklist: Big Picture / Fundamentals / Technicals / Tape / Intuition

### Curtis Faith / John Sweeney (Way of the Turtle)
- **MFE/MAE** per trade
- **E-Ratio** = avg-MFE / avg-MAE (ATR-genormaliseerd). **>1** = edge ongeacht WR
- **Capture-ratio** = realized R / MFE — sluit je winners te vroeg?

### Mark Minervini (SEPA)
- **Risk per trade**: 1.25–2.5% equity. Hard stop ≤7-8%
- Combo **Batting avg × Payoff** — 40% WR + 2:1 = geometrische groei
- Pyramiding alleen op confirmed winners

---

## 2. Propfirm KPI's (de "verborgen" maatstaven)

| Firm | Hoofdmetric | Drempel |
|---|---|---|
| **FTMO** Account MetriX | Per-trade + dag/week/maand/jaar aggregaat | Geen consistency, wel daily DD |
| **Topstep** | **Single-day profit concentration** | ≤40% van totaal (50% in Combine) |
| **Apex** | Consistency + intraday trailing DD | ≤30% (strenger) |
| **MyFundedFutures** | End-of-day DD | Soepeler |

→ **Universele MUST-HAVE**: `(largest single-day profit) ÷ (total net profit)` — verbergt 1-trade-helden + voorspelt propfirm-rejection.

---

## 3. Crypto-perpetuals must-haves (mainstream journals missen dit)

1. **Funding rate kostpost** cumulatief per trade. Bijv. $51/8h op $10k long bij 0.51%/8h = 27% margin/maand verlies bij 10× leverage.
2. **Funding cycle awareness** — Binance/Bybit 8h, Hyperliquid 1h. Sluiten *vóór* settlement = $0 funding.
3. **Liquidation distance** in % en ATR-eenheden, per trade
4. **Slippage** (actual vs projected, vooral op Hyperliquid)
5. **Per-exchange funding split** (Blofin / MEXC / Hyperliquid)

---

## 4. ICT / SMC specifiek (Denny's community)

- **Killzone hit-rate** per zone (London Open 02-05 EST / NY AM 07-10 / NY PM / Asia / London Close)
- **HTF bias-alignment** (Daily/4H) — gewonnen met-bias vs counter-trend
- **Setup-type WR**: OB / FVG / Breaker / Unicorn / Judas Swing / Silver Bullet
- **Killzone × Setup matrix** (2D grid van WR + expectancy per cel)
- **Liquidity sweep success** — % gewonnen na confirmed sweep vs valse breakout

---

## 5. Verborgen psycho/gedrags-metrics (de differentiators)

| Metric | Wat | Mainstream tracking? |
|---|---|---|
| **Revenge-detection** | Time-since-last-loss <15 min entry | Tradezella alleen |
| **Size-creep** | Trade ≥25% boven baseline size | Edgewonk alleen |
| **Tilt-cascade** | ≥3 snelle trades na DD met decreasing hold-time | **Niemand** ← differentiator |
| **Plan-deviation rate** | % trades waar exit afwijkt van pre-trade thesis | **Niemand** ← differentiator |
| **Conviction-after-loss** | Position-size na 3 losses (overconfidence trigger) | **Niemand** ← differentiator |

---

## 6. Review-cadence (pro-trader workflows)

- **Daily** 10-15 min: Steenbarger checklist + A/B/C grading
- **Weekly** 30 min (Tradezella framework): WR / payoff / PF / # trades / max intra-week DD + 1 "doen / stoppen / blijven"
- **Monthly** 30 min: Playbook-update, expectancy per setup, baseline-shift 30/60/90 dag
- **30/30/30 framework** komt terug bij Topstep + SMB

---

## 7. Top-10 consensus metrics (élke pro tracked deze)

1. Expectancy (R)
2. R-multiple distribution
3. Profit factor (>1.5 solide)
4. Win rate (alleen ICOMBO met payoff)
5. Payoff ratio (avg-win / avg-loss)
6. MFE/MAE → E-Ratio
7. Max drawdown (intra-day + cumulative)
8. **Hold-time asymmetry**
9. Setup-tagged performance
10. SQN (na ≥100 trades) **OF** single-day concentration

---

## 8. Amateur-traps (te vermijden)

1. Obsessie met **WR** zonder payoff context → leidt tot winners-te-vroeg + stops-verwijden
2. **Single trade R** bewonderen i.p.v. expectancy over 100+
3. **Total P&L** als enige metric — verbergt 1-day-80% concentratie
4. **Geen risk pre-trade** → R-multiple onmeetbaar
5. **Tags zonder reflectie** — museum, geen tool

---

## 9. Beginner vs Advanced — toggle-rationale

**Probleem**: 21+ widgets in één weergave overweldigt beginners. Advanced traders willen alles + extras.

**Oplossing**: 3-mode toggle:

### 🌱 Beginner (default voor <100 trades)
**Wat ze nodig hebben**: leren wat metrics betekenen, zien of edge bestaat, begrijpen waar verbeteringen liggen.

**Welke widgets** (max 12 zichtbaar in 5 secties):
- KPI-strip: Net PnL · WR · PF · Expectancy · Plan-adherence
- Equity curve · Calendar PnL · Sample-size status
- Setup-insights tabel · Alignment-patronen
- Day×Hour heatmap · Per-sessie
- Plan-adherence donut · Emotie-impact
- Rolling 20-trade edge · Mistake-impact · **Hold-time asymmetry** (Steenbarger #1 leak)

**Tooltips**: rijk met "Wat is dit?" + formule + voorbeeld (educatief).

### 🚀 Advanced (default voor ≥100 trades of opt-in)
**Wat ze nodig hebben**: granulair detecteren waar edge lekt, welke trades te skippen.

**Extra widgets** (totaal 21+ in 8 secties):
- Alles van Beginner +
- **Sectie 6 — Risk & Sizing**: Position-size distribution · R-multiple distribution · MFE/MAE · E-Ratio · SQN
- **Sectie 7 — Funding & Costs** (crypto-only): Funding ledger · Per-exchange split · Settlement-timing
- **Sectie 8 — Propfirm compliance** (FTMO/Topstep): Single-day concentration · Drawdown rules · Consistency score
- **Behavioral tilt-panel** in sectie 4 (Tilt-cascade + Size-creep + Conviction-after-loss)
- **Killzone × Setup matrix** in sectie 3 (ICT/SMC)
- **Process grade distribution** A+/A/B/C in sectie 2 (Bellafiore)

**Tooltips**: kort + technisch (assumed knowledge).

### 🛠 Custom
Toggle elke widget aan/uit individueel. Slaat per gebruiker op in `tj_analytics_layout_custom`.

---

## 10. Layout-keuzes

### Breder
- Was: 1480px max → **1680px max** (Denny's wens)
- Sidebar TOC: 240px → **220px** (iets compacter)
- Main: meer 2/3-column grids voor compact zicht

### Sticky-TOC met sectie-counters
- Toont aantal widgets per sectie (`📊 Overview · 3`)
- Active-state met gold accent

### KPI-strip altijd zichtbaar
- 5 cards in Beginner / 6-7 in Advanced (+ Max DD, + Days Traded)

### Sticky filter-strip onder KPI
- Mode-toggle (Beginner/Advanced/Custom)
- View-lens (Proces/Winst/Beide)
- Periode
- Geen per-widget toggles meer

---

## 11. 5 unieke widgets voor SyncJournal (mainstream niet)

1. **Hold-time asymmetry chart** (Steenbarger #1 leak) — gemiddelde min winners vs losers per setup-tag
2. **Behavioral tilt-panel** — combineert revenge + size-creep + entries-na-DD in heatmap
3. **Funding-cost ledger** — cumulatieve funding per trade + per setup + % weggehapt
4. **Killzone × Setup matrix** — ICT/SMC differentiator
5. **Single-day concentration + propfirm-compliance widget** — direct relevant voor FTMO/Topstep traders

---

## 12. Bronnen

Steenbarger TraderFeed · Van Tharp SQN · Bellafiore Playbook · FTMO Account MetriX · Topstep Consistency Rule · MAE/MFE/E-Ratio QuantStrategies · Hyperliquid funding docs · ICT Unicorn backtest · Tradezella revenge-detection criteria · NN/G tooltip best practices · WCAG 1.4.13.
