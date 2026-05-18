# Playbook-coaching AI — Research Report

**Datum**: 2026-05-18
**Topic**: Playbook-coaching AI in trading journals — concurrent-analyse + framework-translatie voor TradeJournal v1-spec
**Items onderzocht**: 28 (10 Tier-1, 11 Tier-2, ~7 Tier-3 + frameworks/patterns)

---

## 📋 Table of Contents

### 🥇 Tier 1 (top-relevant)

1. [TradeOS](#tradeos) — playbook concept maturity: structured-rules (leaning toward rule-adherence-s…
2. [JournalPlus](#journalplus) — playbook concept maturity: structured-rules. JournalPlus has an explicit Pla…
3. [TraderSync (Cypher AI)](#tradersync-cypher-ai) — playbook concept maturity: rule-adherence-scored. TraderSync lets users desi…
4. [TradeJournal.AI](#tradejournalai) — playbook concept maturity: AI-coached. The playbook is a first-class object … · pre trade validation: Yes — explicit and unique. The 'Ask AI pressure-t…
5. [RizeTrade](#rizetrade) — playbook concept maturity: rule-adherence-scored. RizeTrade explicitly build…
6. [MRT Journal](#mrt-journal) — playbook concept maturity: structured-rules (leaning toward rule-adherence-s…
7. [Tradingtick](#tradingtick) — playbook concept maturity: rule-adherence-scored. Playbook Builder ships fre… · pre trade validation: Yes (rule-based, not AI). Risk Enforcer 'alerts y…
8. [Mark Douglas — Trading in the Zone](#mark-douglas-trading-in-the-zone)
9. [Brett Steenbarger — Solution-focused](#brett-steenbarger-solution-focused)
10. [Setup/playbook-level coaching pattern](#setupplaybook-level-coaching-pattern) — playbook concept maturity: Frontier pattern. Most journals stop at 'tag-only… · pre trade validation: Natural extension — once a playbook has structure…
11. [Pre-trade validation pattern](#pre-trade-validation-pattern) — playbook concept maturity: Pre-trade validation requires structured-rules le… · pre trade validation: This IS the pattern. Implementation: each playboo…
12. [Crypto-perp playbook-AI (gap quadrant)](#crypto-perp-playbook-ai-gap-quadrant) — playbook concept maturity: Target: rule-adherence-scored + AI-coached. Subst… · crypto perp exchange support: Blofin, MEXC, Kraken Futures, Hyperliquid, FTMO-M… · pre trade validation: Pressure-test button with auto-filled crypto-cont…

### 🥈 Tier 2 (good context)

1. [Tradezella](#tradezella) — playbook concept maturity: rule-adherence-scored. Playbook is the central pa…
2. [Edgewonk](#edgewonk) — playbook concept maturity: structured-rules + rule-adherence-scored (Trade E… · crypto perp exchange support: Crypto coverage limited: Bybit and Coinbase named…
3. [TradesViz](#tradesviz) — playbook concept maturity: structured-rules. 'Trade Plans & Mistake Analysis…
4. [Trader's Second Brain (TSB)](#traders-second-brain-tsb) — playbook concept maturity: tag-only — but with AI auto-tagging based on tech… · crypto perp exchange support: None. Stocks + options brokers only (Interactive …
5. [Plancana](#plancana) — playbook concept maturity: structured-rules. AI-generated trading plan codif… · crypto perp exchange support: Only ByBit Futures (single crypto exchange). No H…
6. [Process Trader](#process-trader) — playbook concept maturity: structured-rules, approaching AI-coached. 'Build … · crypto perp exchange support: No native crypto exchange support. Imports focus … · pre trade validation: Yes via pre-market baselines + routine builder. U…
7. [Van Tharp — System Development](#van-tharp-system-development)
8. [Mike Bellafiore — One Good Trade (SMB)](#mike-bellafiore-one-good-trade-smb) — playbook concept maturity: Bellafiore's framework represents the highest end… · pre trade validation: Native fit — the 5-variable check IS pre-trade va…
9. [Per-trade autopsy pattern](#per-trade-autopsy-pattern)

### 🥉 Tier 3 (reference)

1. [Tradervue](#tradervue) — playbook concept maturity: named-strategy with rule-tracking (mid-maturity).… · crypto perp exchange support: Weak. 80+ broker integrations but primarily equit… · pre trade validation: No. Strictly post-trade journaling and analysis. …
2. [Chartlog](#chartlog) — playbook concept maturity: Chartlog.com: tag-only with named strategies (Sta… · crypto perp exchange support: Chartlog.com: ~10 US stock/options brokers only (…
3. [MM Platinum](#mm-platinum) — playbook concept maturity: named-strategy / rule-adherence-scored — the Mine… · crypto perp exchange support: None. US equity-only platform. No crypto, no futu… · pre trade validation: Yes — MAI + MonAlert evaluate stocks in real-time…
4. [Deltalytix](#deltalytix) — playbook concept maturity: tag-only / approaching named-strategy. Advanced t… · crypto perp exchange support: None native. Pure futures focus (Rithmic, Tradova…
5. [TradeFuse](#tradefuse) — playbook concept maturity: tag-only with named strategies. Trades can be tag… · pre trade validation: No. Post-trade only. Monte Carlo simulator projec…
6. [Trader Sage](#trader-sage) — playbook concept maturity: tag-only — but with AI auto-tagging based on tech… · crypto perp exchange support: None. Stocks + options brokers only (Interactive …
7. [Tradexis](#tradexis) — playbook concept maturity: AI-coached / approaching rule-adherence-scored. S… · pre trade validation: STRONGEST in cohort. Pre-Trade Mirror is the head…

---

## 📊 Detailed Findings

### TradeOS
<a id='tradeos'></a>

Tier **1** · [https://wyckofflabs.com/](https://wyckofflabs.com/)

> _Why researched_: Meest directe concurrent — exact dezelfde crypto-perp exchanges als Denny (Blofin, Hyperliquid, MEXC, FTMO). AI is per-trade — playbook-niveau is hun gap.

#### Basis

- **target market**: Serious retail traders and prop-firm funded traders (FTMO, FundedNext, The5ers, Topstep). Global, English-first.
**pricing model**:
Freemium. Free Forever plan: 4 journals, 25 trades/month, full trade logging, dashboard. Pro from $14.95/mo. Marketed as bundling features other journals charge $50-80/mo for.

#### AI-Features

- **feature name**: AI Trade Coach / AI Review (powered by Claude Sonnet)
**ai scope**:
Per-trade analysis (click 'AI Review' on individual trades for methodology-specific Wyckoff analysis) plus per-period pattern detection (revenge trading, tilt, overtrading) and per-portfolio dimension scoring (8-dimension performance score).
**ai proactive vs reactive**:
Hybrid. Pull: user clicks 'AI Review' on a trade for on-demand methodology analysis. Push: Smart Alerts proactively detect revenge trading, tilt, overtrading 'before you see them yourself'; Telegram bot pushes real-time discipline alerts (e.g. position size above average after consecutive losses).
- **ai underlying tech**: Claude Sonnet (Anthropic) for AI Review/coaching. AWS infrastructure, AES-256-GCM encryption.
**output format**:
Structured per-trade text analysis tabs (methodology-specific), 0-10 setup scoring, 8-dimension performance scorecard, Telegram push alerts, in-app Smart Alert cards.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules (leaning toward rule-adherence-scored). Trades are tagged by Wyckoff schematic type; each setup is scored 0-10 and tracked over time to see which setups produce edge. Prop-firm rules (daily drawdown, profit-split) are first-class structured constraints.
**setup level ai**:
Yes — setup-level AI is a core feature. Trades are tagged by Wyckoff schematic (accumulation vs distribution, spring, upthrust, etc) and the AI compares the user's per-schematic win-rate cohorts. Setup quality is scored 0-10 and tracked longitudinally, so the AI can answer 'which Wyckoff schematic is your actual edge?' rather than only per-trade critique. Methodology-specific analysis tabs render on each trade.
**playbook template library**:
Pre-built Wyckoff schematic tags ship out of the box (accumulation/distribution phases). 30+ pre-built CSV import templates for broker mapping. Custom strategies/playbooks user-defined.

#### Privacy & Stack

**privacy model**:
Vendor-hosted only. Claude Sonnet is called server-side by Wyckofflabs; no bring-your-own-API-key documented. AES-256-GCM encryption at rest, bcrypt-12 password hashing.
- **cost per month user**: $0 (free forever tier) to $14.95/mo (Pro). AI coaching included in plan — no separate API costs to the user.

#### Crypto-Fit

- **multi asset**: Forex, Crypto (spot + perps), Stocks, Indices, Commodities, Prediction Markets (Polymarket).

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. The combination of methodology-specific Wyckoff analysis, 8-dimension performance scoring, tilt/revenge/overtrading detection with proactive Telegram nudges, and 0-10 setup quality grading moves well past surface metrics into causal coaching territory.
**psychology metrics**:
Revenge-trading detection, tilt detection, overtrading detection, discipline scoring across 8 dimensions, position-sizing-after-losses alerts. No explicit Tiltmeter-style numeric meter named, but functionally equivalent.

_Uncertain fields_: founded, ai_minimum_trade_threshold, notable_prompts, rule_adherence_scoring, pre_trade_validation, data_residency, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, voice_journaling, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### JournalPlus
<a id='journalplus'></a>

Tier **1** · [https://journalplus.co/](https://journalplus.co/)

> _Why researched_: Sterkste playbook-AI implementatie gevonden. Playbook attach + rule-compliance scored + NL-chat. CSV-only, geen crypto-perp.

#### Basis

- **founded**: 2025 — publicly launched April 2025, built in Mumbai by a husband-wife duo.
**target market**:
Retail traders, student traders, value-conscious global market (strong India + global pitch). Targets ~15,000+ traders per about-page.
**pricing model**:
One-time lifetime: ₹6,599 (India) or $159 globally. 7-day money-back guarantee. No subscription. Positions explicitly against monthly-fee competitors.

#### AI-Features

- **feature name**: JournalPlus AI (AI chat + pattern detection)
**ai scope**:
Per-portfolio pattern detection across all logged trades; per-period natural-language Q&A. Not advertised as per-playbook or per-trade unit specifically.
**ai proactive vs reactive**:
Mostly pull (user asks chat questions like 'Which setups have highest win rate?'). Some reactive pattern surfacing ('AI finds patterns you miss—like identifying when you lose 78% of Friday trades').
- **output format**: Conversational chat (text) + auto-surfaced pattern callouts in dashboard.
**notable prompts**:
Marketed example prompts: 'What's my win rate on morning breakouts when VIX is above 20?', 'Which setups have highest win rate?', 'How do my trades perform after a losing streak?'. Auto-detected insights example: 'You lose 78% of Friday trades.' AI is positioned to replace manual filtering/pivoting.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules. JournalPlus has an explicit Playbook feature where users document setup criteria before entering trades. Used to monitor strategy adherence. Not advertised as AI-coached on the playbook itself.
**setup level ai**:
Limited — AI lets users ask setup-level questions ('What's my win rate on morning breakouts?') so the AI reasons across setup cohorts, but there is no advertised per-playbook auto-generated coaching report. The setup-level analysis is user-driven via natural-language queries rather than AI auto-curating per-playbook insights.

#### Privacy & Stack

- **cost per month user**: Effectively $0/mo amortized after one-time $159 (lifetime). No separate AI-feature charge.

#### Crypto-Fit

- **multi asset**: Stocks, futures, forex, options, crypto (via CSV).

#### Coaching Depth

**coaching depth level**:
Between surface_metrics and deep_pattern_analysis. AI surfaces concrete time/day patterns ('78% Friday losses') and emotional pattern callouts, but coaching is reactive Q&A rather than structured causal coaching frameworks.

_Uncertain fields_: ai_minimum_trade_threshold, ai_underlying_tech, rule_adherence_scoring, pre_trade_validation, playbook_template_library, privacy_model, data_residency, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, psychology_metrics, voice_journaling, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### TraderSync (Cypher AI)
<a id='tradersync-cypher-ai'></a>

Tier **1** · [https://tradersync.com/cypher/](https://tradersync.com/cypher/)

> _Why researched_: Enige journal met geshipte proactive AI-coach (Elite $79.95/mo). Per-strategy WR/expectancy + push-notificaties. Vereist 100+ trades.

#### Basis

**target market**:
Active retail traders across stocks, options, futures, forex, crypto. Global, professional-leaning. Used by thousands of traders worldwide.
**pricing model**:
Subscription only (no free tier). Pro $29.95/mo, Premium $49.95/mo, Elite $79.95/mo. Annual billing ~45% off. 7-day free trial on all plans, no CC.

#### AI-Features

- **feature name**: Cypher AI — AI Performance Assistant
**ai scope**:
Per-trade (every trade monitored for plan-adherence), per-period (pattern detection across history, alerts when underperformance starts), per-playbook (plan-adherence analysis per strategy).
**ai proactive vs reactive**:
Hybrid (strongly proactive). Push: 'Cypher AI detects patterns across your trade history without you asking' and 'sends alerts when underperformance begins'. Pull: conversational Q&A about performance.
- **output format**: Conversational chat, push alerts, accountability reports (text-based), plan-adherence stats dashboards.

#### Playbook & Setup-Level

**playbook concept maturity**:
rule-adherence-scored. TraderSync lets users design a strategy checklist + comprehensive trading plan with rules (max loss per day, max trades per session, market sentiment, drawdown limits) and tracks adherence with reports. Cypher AI quantifies the financial impact of rule breaks.
**setup level ai**:
Yes — Cypher monitors plan-adherence per strategy and flags when a specific strategy's adherence drops. The AI works across the user's defined plan rules and reports which setups deviated. Not advertised as auto-generating new setup-level insights without a defined playbook, but it does setup-level reasoning on top of the user's playbook.
**rule adherence scoring**:
Yes, explicit. 'Rule tracking lets you measure adherence to your plan with greater precision' and 'if you break your rules, TraderSync spots it and tallies up the financial impact.' Accountability reports include plan-adherence stats.

#### Privacy & Stack

- **cost per month user**: $29.95-$79.95/mo. AI included in plan; no separate API charge.

#### Crypto-Fit

- **multi asset**: Stocks, options, futures, futures options, forex, crypto.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Cypher quantifies behavioral patterns ('holding non-adherent trades 20 minutes longer'), tallies financial impact of rule breaks, sends proactive underperformance alerts, monitors discipline — well beyond surface metrics.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, pre_trade_validation, playbook_template_library, privacy_model, data_residency, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, psychology_metrics, voice_journaling, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### TradeJournal.AI
<a id='tradejournalai'></a>

Tier **1** · [https://tradejournal.ai/](https://tradejournal.ai/)

> _Why researched_: Enige met pre-trade pressure-test knop ('Ask AI op deze setup vóór entry'). Green-field opportunity die niemand anders heeft.

#### Basis

**target market**:
Active futures and crypto traders specifically. Single-tier flat pricing positions it for serious retail traders who want AI without upsell complexity.
**pricing model**:
Subscription, single flat tier: $19.95/month. 7-day free trial. 30-day money-back guarantee. Honest flat pricing with no upsell tiers.

#### AI-Features

- **feature name**: AI Coach (per-trade critique + Weekly Digest + Ask AI)
**ai scope**:
Per-trade (per-trade critique on every trade), per-period (weekly digest of patterns), per-playbook (Ask AI grounded in user's playbook setups and own journal notes).
**ai proactive vs reactive**:
Hybrid. Push: per-trade critique auto-runs on each new trade; weekly digest pushed on schedule. Pull: 'Ask AI' button on any trade for conversational deep-dive.
**ai underlying tech**:
Claude Sonnet (Anthropic). Bring-your-own-Anthropic-key supported in Settings for unlimited usage. Default plan includes fair-use daily token cap covered by subscription.
**output format**:
Per-trade critique cards, weekly digest report, conversational Ask AI chat — all text. AI 'quotes your own notes back' so the output references user's own journal entries.
**notable prompts**:
Marketed concrete prompts/features: 'Ask AI pressure-test button that reads your past trades on the same setup' (pre-entry validation), 'per-trade critique' (auto-runs each trade), 'weekly digest' (scheduled), 'Ask AI on any trade' (conversational). AI is 'grounded in your own journal' and 'quotes your own notes back'.

#### Playbook & Setup-Level

**playbook concept maturity**:
AI-coached. The playbook is a first-class object with custom setups, each shipping 6 setups per session (London/NY/overlap) with entry trigger, invalidation rule, screenshot reference, AND an 'Ask AI pressure-test button' tied directly to the setup. Custom Pine Script v6 indicators can be auto-generated. Setups are copy-shareable between accounts.
**setup level ai**:
Yes — explicit and best-in-class for this list. Each setup has its own 'Ask AI' button that reads the user's past trades on the same setup. This is setup-level AI by design, not per-trade AI bolted onto a tag. Combined with session-aware setups (London/NY/overlap), the AI reasons cohort-style at the setup level.
**pre trade validation**:
Yes — explicit and unique. The 'Ask AI pressure-test button' on each setup is designed to be hit BEFORE entry, reading past trades on the same setup to validate the current opportunity. This is the closest match in this batch to a true green-field pre-trade AI workflow.
**playbook template library**:
Ships 6 setups per session (London / NY / overlap) out of the box. Custom Pine Script v6 indicators can be auto-generated. Custom-setup-first architecture rather than huge library of canned templates.

#### Privacy & Stack

**privacy model**:
Hybrid. Vendor-hosted (TradeJournal.AI's Anthropic key with fair-use daily cap) OR bring-your-own-Anthropic-key in Settings for unlimited usage. Best-in-class flexibility on this dimension.
**cost per month user**:
$19.95/mo flat (AI included up to fair-use cap). Optional own-Anthropic-key cost on top (Sonnet API: ~$3 in / $15 out per M tokens) for power users.

#### Crypto-Fit

- **multi asset**: Built for active futures and crypto traders (named focus). Stocks/options not the headline positioning.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. AI Coach reads the full journal, quotes user notes back, pressure-tests setups against history, runs scheduled weekly digest, and provides per-trade critique. Combined with Claude Sonnet, this lands squarely in causal coaching territory.

_Uncertain fields_: founded, ai_minimum_trade_threshold, rule_adherence_scoring, data_residency, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, psychology_metrics, voice_journaling, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### RizeTrade
<a id='rizetrade'></a>

Tier **1** · [https://rizetrade.com/](https://rizetrade.com/)

> _Why researched_: Playbook als checklist + rule-follow scoring per trade. Geen AI, maar de foundation die elke AI nodig heeft.

#### Basis

**target market**:
Discipline-first retail traders (day-trader leaning), specifically those who want post-session improvement via rule-adherence over real-time dashboards. Stocks, options, futures, forex.
**pricing model**:
Freemium. Free tier (1 account, 1 CSV import, 50MB storage). Essential $19/mo billed annually ($228/yr): unlimited imports, 1GB storage, up to 3 strategies, advanced analytics, trade replay. Pro $49/mo: unlimited everything, voice notes, priority support.

#### AI-Features

- **feature name**: AI-powered trading journal (discipline/compliance-AI focus, no marketed product name)
**ai scope**:
Per-trade (each trade scored against rule criteria), per-playbook (compliance percentage per strategy), per-period (P&L lost to emotions over time).
**output format**:
Compliance percentage scores per trade/strategy, emotion-tagged P&L filters, structured review templates, voice notes (Pro), reports broken down by time-of-day (15-min blocks), symbol, strategy, tags, R-multiples, position size.

#### Playbook & Setup-Level

**playbook concept maturity**:
rule-adherence-scored. RizeTrade explicitly builds the playbook into a rule-checked engine: 'you build your rules into the platform, each trade gets checked against your criteria, and you get a compliance percentage.' This is the most explicit compliance-scoring framing in this batch.
**setup level ai**:
Yes at setup-level — playbook compliance scoring runs per strategy, and rule-adherence is reported per strategy with separate strategy-evolution tracking. The 'AI' here is more a structured scoring engine than a generative coach, but it works at the setup/strategy unit, not just per trade.
**rule adherence scoring**:
Yes, explicit and headlined. Quantified compliance percentage per trade and per strategy. Separates strategy-failure (rules broken) from execution-failure (rules followed, still lost). This is RizeTrade's signature feature.

#### Privacy & Stack

- **cost per month user**: $0 (free tier) / $19/mo (Essential, annual) / $49/mo (Pro). AI included in plan.

#### Crypto-Fit

- **multi asset**: Stocks, options, futures, forex. Crypto not in headline asset list (CSV-only at best).

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Compliance scoring + emotion-P&L correlation + 15-min block analytics + voice notes give multi-axis causal coaching, not just summary metrics.
**psychology metrics**:
Emotion tags: FOMO, revenge trade, anxiety, overconfidence, boredom, fear, overtrading, early exit. P&L can be filtered by emotion tag. Rule-adherence-per-strategy metric.
**voice journaling**:
Yes — voice notes are a Pro-tier feature (only journal in this batch besides Tradingtick-roadmap to ship voice as a current paid feature).

_Uncertain fields_: founded, ai_proactive_vs_reactive, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, pre_trade_validation, playbook_template_library, privacy_model, data_residency, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### MRT Journal
<a id='mrt-journal'></a>

Tier **1** · [https://mrtjournal.com/](https://mrtjournal.com/)

> _Why researched_: Enige journal die expliciet Claude API gebruikt. Inspiration voor onze stack-keuze (eigen API-key vs shared Worker).

#### Basis

**target market**:
Serious retail traders, explicitly built for ICT / Smart Money Concept (SMC) practitioners from day one. Global, English-first.

#### AI-Features

- **feature name**: MRT AI Coach (Claude-powered)
**ai scope**:
Per-trade (full access to every logged trade), per-period (session, day, week patterns via color-coded calendar), per-playbook (named strategy models tracked separately), per-portfolio (full journal context for Coach Q&A).
**output format**:
Conversational chat with Coach (text), color-coded calendar heatmap, mistake-type breakdowns (dollar cost + frequency), strategy model performance reports. Can analyze chart screenshots (multimodal).
**notable prompts**:
Marketed example questions for the Coach: 'what's killing my P&L?', 'which session should I cut?', 'analyze this chart screenshot'. Coach has full access to every trade ever logged. ICT/SMC log fields: grade, session, bias, confluences, mistakes, chart screenshots.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules (leaning toward rule-adherence-scored). Named strategy models tracked separately with live performance per model. Each trade logs grade, session, bias, confluences, mistakes. Mistake-tracking with dollar cost per mistake type. Pre-built ICT/SMC tagging is the structured backbone.
**setup level ai**:
Yes at setup-level — 'create named strategy models and track their live performance separately, seeing which model wins, which session it performs in, and how each evolves over time'. The Coach can answer per-strategy questions. ICT/SMC-native log fields (grade, session, bias, confluences) make setup-cohort reasoning the default.

#### Crypto-Fit

**gap session breakdown per setup**:
Yes — 'session performance' is auto-calculated alongside expectancy, profit-factor, performance-by-grade, direction-split, clean-vs-mistake P&L. Combined with named-strategy-models, the per-setup × session view is core to the data model. Whether the AI Coach auto-renders 'BOS+FVG London vs NY' as a one-click report is not explicit, but the data substrate is there.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Mistake-tagging by type (psychology, execution, market read, risk) with dollar-cost-per-mistake-type, plus Claude-powered Coach with full journal context plus chart-screenshot multimodal analysis. Among the deepest coaching loops in this batch.
**psychology metrics**:
Mistake categories (psychology / execution / market read / risk), clean-vs-mistake P&L, grade per trade, session performance, color-coded calendar (best/worst days, weekly patterns). Specific named tags (Tiltmeter, revenge-detection) not headlined but mistake-typing is granular.

_Uncertain fields_: founded, pricing_model, ai_proactive_vs_reactive, ai_minimum_trade_threshold, ai_underlying_tech, rule_adherence_scoring, pre_trade_validation, playbook_template_library, privacy_model, data_residency, cost_per_month_user, crypto_perp_exchange_support, multi_asset, partial_close_awareness, funding_rate_context, voice_journaling, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### Tradingtick
<a id='tradingtick'></a>

Tier **1** · [https://tradingtick.com/](https://tradingtick.com/)

> _Why researched_: Free forever met Playbook Builder + pre-launch AI. 101 psychology quizzes + XP-streaks gamification. Lifetime-pro early bird model.

#### Basis

**target market**:
Serious retail traders prioritizing discipline / psychology / risk-rule enforcement. Gamified XP/streaks framing suggests broad retail (including younger traders).
**pricing model**:
Freemium. Free forever for the core journal + risk enforcer + playbook builder + quizzes. Pro tier coming with AI coaching, voice journaling, custom quizzes; pre-launch users get lifetime Pro free (founder-tier benefit).

#### AI-Features

- **feature name**: AI Coaching (planned, Pro tier) + 101 Adaptive Quizzes (live)
**output format**:
XP / streaks / discipline score (gamified), risk-rule push alerts, adaptive quiz Q&A, post-trade debriefs. Future: AI coaching chat + voice journaling.

#### Playbook & Setup-Level

**playbook concept maturity**:
rule-adherence-scored. Playbook Builder ships free; users define risk rules + document setups. Risk Enforcer auto-blocks rule violations. Discipline score is a quantified metric tracked over time. Among the strongest 'discipline-as-core' framings on the market.
**rule adherence scoring**:
Yes, explicit and headlined: 'discipline score' tracked over time (user case: 34 → 89 in two months). Risk Enforcer auto-blocks rule violations. Daily loss limits, max position size, per-trade risk rules all quantified.
**pre trade validation**:
Yes (rule-based, not AI). Risk Enforcer 'alerts you before you blow your account' and auto-prevents rule-breaking trades. This is pre-trade enforcement, not pre-trade AI pressure-testing — but it lives in the same UX slot.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis on the psychology axis (101 adaptive quizzes, post-trade debriefs, discipline score, risk enforcer with measurable improvements). Surface on the trade-pattern axis until AI Coach launches.
**psychology metrics**:
Discipline score (numeric, trended over time), XP / streaks / levels (gamified), 101 adaptive psychology quizzes, post-trade emotional-pattern debriefs, risk-rule enforcement.
- **voice journaling**: Planned (Pro tier roadmap), not yet shipped.

_Uncertain fields_: founded, ai_scope, ai_proactive_vs_reactive, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, setup_level_ai, playbook_template_library, privacy_model, data_residency, cost_per_month_user, crypto_perp_exchange_support, multi_asset, partial_close_awareness, funding_rate_context, gap_session_breakdown_per_setup, mentor_mode, community_driven_ai, changelog_ai_velocity

---

### Mark Douglas — Trading in the Zone
<a id='mark-douglas-trading-in-the-zone'></a>

Tier **1** · [https://www.amazon.com/Trading-Zone-Confidence-Discipline-Attitude/dp/0735201447](https://www.amazon.com/Trading-Zone-Confidence-Discipline-Attitude/dp/0735201447)

> _Why researched_: Probabilities mindset + emotional consistency. AI-prompts kunnen probabilistische framing afdwingen.

#### AI-Features

**ai proactive vs reactive**:
Hybrid recommended. Pre-trade probabilistic-framing should be PROACTIVE (auto-trigger on entry-modal open, gating the submit). Post-trade reframe is REACTIVE (button: 'Reframe this trade'). Weekly five-truths audit is SCHEDULED-PROACTIVE (Monday morning push).

#### Coaching Depth

**psychology metrics**:
Douglas-aligned metrics: (1) pre-acceptance score (did user explicitly accept risk before entry — yes/no), (2) post-outcome regret score (1-5 self-report), (3) rule-violation count tagged by emotional driver (fear-of-missing-out / loss-aversion / revenge / proving-right), (4) consistency score = std-dev of R-multiples within a single setup (lower = more consistent execution, the Douglas ideal).

#### Framework (alleen frameworks-items)

- **author**: Mark Douglas — 'Trading in the Zone' (2000) and 'The Disciplined Trader' (1990)
**core principle**:
Trading success is 80% psychology and 20% strategy. The trader must adopt a 'probabilistic mindset' — accepting that any single trade outcome is unknowable, but a defined edge will pay out across a large enough sample. Emotional consistency comes from pre-accepting risk BEFORE entry (not when stop is hit) and treating each trade as one of many.
**translation to ai prompts**:
Douglas's framework translates into AI-prompts that enforce probabilistic framing on EVERY trade-interaction, both pre- and post-trade. Five concrete prompt-templates we could ship: (1) PRE-TRADE PROBABILISTIC FRAMING: 'You are about to enter {setup_name}. Across your last 50 {setup_name} trades, your hit-rate was {WR}% and average R was {avg_R}. This trade is one sample from that distribution — not a prediction. Confirm: (a) your risk is pre-defined and pre-accepted, (b) you would take this trade again with identical info, (c) you have NO expectation about THIS specific outcome. Type 'accepted' to proceed.' (2) POST-LOSS REFRAME: 'You lost -1R on {trade}. Was the SETUP valid per your playbook? [Yes/No]. If Yes: this is a normal probabilistic outcome — 1 of the {1-WR}% expected losers. No process-error occurred. Reflect: did your reaction match a trader who has accepted random distribution?' (3) WINNER-AS-RANDOM CHECK: 'You won +3R on {trade}. Was the setup valid? Or did you break rules and got lucky? Distinguish: process-success vs outcome-luck. Lucky wins reinforce bad habits.' (4) FIVE TRUTHS DAILY CHECK-IN: 'Restate today the 5 Truths in your own words: (1) Anything can happen, (2) You don't need to know what happens next to make money, (3) Wins/losses are randomly distributed within your edge, (4) An edge is just a higher probability — not certainty, (5) Every moment is unique. Which one is hardest to hold today?' (5) UNCONSCIOUS-INTENT SCAN (weekly): 'Looking at your last 20 trades, where did you violate rules? For each violation, hypothesise: were you trying to AVOID a loss, CHASE a winner, PROVE you were right, or REVENGE-trade? Douglas: trading errors are unresolved emotional needs leaking into execution.'
**best fit scope**:
Per-trade (pre-trade pre-acceptance + post-trade reframe) AND periodic (weekly/monthly probabilistic-mindset audit). Douglas is fundamentally about MOMENT-OF-DECISION psychology, so per-trade pre-entry prompts have the highest leverage. Less suited to setup-level statistical analysis (Van Tharp's territory) or pattern recognition (Steenbarger's territory). Especially valuable for our community given partial-close culture: each TP is a probabilistic event, not a 'should I have held?' regret-trigger.

_Uncertain fields_: Exact original wording of the Five Fundamental Truths verified across multiple sources but minor paraphrasing may exist in popular summaries, Whether any existing trading journal has explicitly implemented Douglas-style pre-acceptance gating (no public examples found)

---

### Brett Steenbarger — Solution-focused
<a id='brett-steenbarger-solution-focused'></a>

Tier **1** · [https://traderfeed.blogspot.com/](https://traderfeed.blogspot.com/)

> _Why researched_: Best Trade of Week / solution-focused reviews. AI-prompt-template: 'wat maakte dit pivotal?'. Past op onze backlog 🧠-features.

#### AI-Features

**ai proactive vs reactive**:
Mostly PROACTIVE/scheduled — Steenbarger's leverage is in the regular reflection cadence (Friday best-trade, monthly strength-mining). Reactive 'mark pivotal' button complements.
**ai minimum trade threshold**:
Lower than Tharp — Steenbarger can find signal in 5-10 trades for best-of-week. Monthly strength-mining wants 20+. The cold-start problem is mild because the first trade can already be a 'pivotal moment'.
**output format**:
Structured-card with a SINGLE concrete next-week action — Steenbarger emphasizes that reflection without behavior-change is masturbation. Each prompt-cycle must produce ONE commitment.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis — Steenbarger's whole craft is causal explanation ('what was DIFFERENT about your best trade?') plus actionable next-step. Surface-metrics (win-rate, P&L) are inputs, not outputs.
**psychology metrics**:
Steenbarger-aligned: (1) pre-trade prep checklist completion, (2) self-rated state-of-mind score (calm/focused/distracted/tilted), (3) pivotal-moment count per period (markers user flags), (4) strength-zone WR vs out-of-zone WR delta.

#### Framework (alleen frameworks-items)

**author**:
Brett N. Steenbarger PhD — 'The Daily Trading Coach: 101 Lessons for Becoming Your Own Trading Psychologist' (2009), 'Enhancing Trader Performance' (2006), 'The Psychology of Trading' (2002), TraderFeed blog (active since 2005). Performance coach to hedge funds and prop firms.
**core principle**:
Solution-focused coaching inverts traditional therapy: instead of analysing what's wrong, identify what's RIGHT and do more of it. Traders grow by studying their BEST trades — what cognitive, interpersonal, and personality strengths were active — and reverse-engineering the conditions that produced them. The pivotal questions are 'When are you at your best? What's different about those moments?' Steenbarger's 'Best Trade of the Week' exercise is the canonical implementation: pick your one best trade, dissect what enabled it (preparation, mindset, market read, execution), then design next week to recreate those conditions.
**translation to ai prompts**:
Steenbarger's framework maps almost 1:1 onto AI prompts because his entire method is QUESTIONS, not lectures. Five concrete prompt-templates: (1) BEST-TRADE-OF-WEEK (Friday close, proactive push): 'Looking at this week's trades, your best trade by quality (not just P&L) was {trade}. Walk through: (a) What did you SEE before entry that others missed? (b) What was your STATE — well-rested, focused, calm, prepared? (c) What rule did you follow that you sometimes break? (d) What conditions in the market FAVOURED this setup? Now: what specific routine, prep, or environmental factor next week would make this MORE likely to repeat?' (2) STRENGTH-PATTERN MINING (monthly): 'I've grouped your top-10 P&L trades and your top-10 process-quality trades from this month. The overlap is {N}. The common factors are: {time-of-day}, {setup}, {market-regime}, {pre-trade-prep state}. Your strength-zone appears to be: {summary}. Trade type to AVOID until further data: {weak-zone}.' (3) PEAK-AND-TROUGH SINE-WAVE (quarterly reflection): 'Plot your trading-life peaks (best months, best trades, best decisions) and troughs (blow-ups, tilt-spirals, doubts). What themes connect the peaks? What themes connect the troughs? Steenbarger: peaks reveal your authentic edge — design your trading-life around them.' (4) DO-MORE-OF-WHAT-WORKS (weekly proactive): 'Your discipline-checkin shows you completed pre-market prep on {X} of 5 days. On prep days your hit-rate was {WR_prep}%, on no-prep days {WR_noprep}%. The difference is your strength. Action for next week: pre-commit to {N+1} prep days. What single obstacle removes the friction?' (5) PIVOTAL-MOMENT JOURNALING (reactive button): 'You marked this trade pivotal. What's the SHIFT this represents? New rule? Recovered confidence? Recognised an old pattern in real-time? Pivotal moments are the leverage-points of growth — write 3 sentences capturing the shift so you can recreate the conditions.'
**best fit scope**:
Periodic (weekly + monthly + quarterly) with single-trade reactive triggers. Steenbarger is NOT a per-trade framework — his unit of analysis is the PATTERN ACROSS TRADES (a week's best trade, a month's strength-zone, a quarter's peaks). Best fit as the 'weekly review' AI-feature in our journal. Pairs beautifully with Tharp's quantitative R-metrics (Tharp shows WHAT works, Steenbarger reveals WHY) and complements Douglas's pre-trade mindset (Steenbarger handles post-trade learning loop).

_Uncertain fields_: Whether Steenbarger has personally commented on AI-coaching tools (his TraderFeed blog likely has but not verified in this research pass), Exact wording of 'Best Trade of the Week' exercise — synthesized from secondary sources, not verified against The Daily Trading Coach lesson numbers

---

### Setup/playbook-level coaching pattern
<a id='setupplaybook-level-coaching-pattern'></a>

Tier **1**

> _Why researched_: DE GAP die we onderzoeken. Wie doet wat? Welke proactive-vs-reactive aanpak? Pre-trade vs post-trade?

#### AI-Features

**feature name**:
Closest live examples: JournalPlus 'Playbook & rule tracker', Tradezella 'Playbook templates' (no AI yet), TraderSync per-strategy expectancy view (statistical, not narrative-AI), Tradingtick 'Playbook Builder' (pre-AI). No vendor has shipped a 'Playbook Coach' as a named first-class AI-feature in 2026.
- **ai scope**: Per-playbook / per-setup — aggregated trades sharing one named strategy.
**ai proactive vs reactive**:
Best fit PROACTIVE / scheduled (weekly playbook-stats push; cross-setup leaderboard) with a REACTIVE 'Coach this playbook' chat-button for deep dives. Per-trade pop-ups would over-trigger.
**ai minimum trade threshold**:
Setup-level analysis needs ~15-20 trades per playbook for any directional claims, 30+ for SQN/expectancy (Tharp standard). Cold-start handled by 'directional read only, not statistical' caveats below 15.
**ai underlying tech**:
LLM (Claude or GPT-4-class) over a structured aggregation layer — SQL/JS that pre-computes WR / R-mean / R-stdev / session-breakdown / regime-breakdown per playbook, then feeds the table to LLM for narrative + recommendation.
**output format**:
Structured-card per playbook (WR, expectancy, sample-size badge, regime-WR breakdown, next-action chip) + free-form narrative summary + chat for follow-up. Possibly a 'playbook health' green/amber/red badge.
**notable prompts**:
(1) 'Given the table {playbook_stats_per_session_per_regime}, summarise the strongest sub-condition for {playbook}. Recommend: split into two playbooks, refine entry rule, retire, or scale.' (2) 'For each playbook with N>=15, identify whether rule-adherence correlates with R. If rule-followed-R > rule-broken-R by >0.3 then strengthen rule-enforcement; if equal, consider dropping the rule.' (3) 'Detect playbook DECAY: compare last 10 trades to prior 20 — is expectancy degrading?'

#### Playbook & Setup-Level

**playbook concept maturity**:
Frontier pattern. Most journals stop at 'tag-only'. RizeTrade and JournalPlus reach 'structured-rules + adherence-scored'. None of the AI-coach players yet ship 'AI-coached at playbook-LEVEL' as a primary feature.
**setup level ai**:
The empty quadrant. JournalPlus comes closest with rule-adherence correlation insights ('compliance drops to 45% after starting with a loss') — but that's behavior-level, not setup-level. TraderSync's per-strategy expectancy is statistical-only (no narrative coach). Killer feature gap: per-playbook AI that combines stats + narrative + actionable refinement.
**rule adherence scoring**:
Required substrate — without it the AI has no signal to coach on. Implementation: each playbook is a structured object {name, conditions: [check1, check2, ...], targets: [...], invalidation: ...}; each trade records which conditions were satisfied; adherence-score = met/total.
**pre trade validation**:
Natural extension — once a playbook has structured conditions, the same conditions can run as a pre-trade checklist. See pattern_pre_trade_validation.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis — this is exactly the layer where causal claims become defensible because n>>1. A statement like 'your BOS+FVG fails 71% of the time when funding is positive >0.02% at entry' is real signal, not platitude.

_Uncertain fields_: Whether JournalPlus's pattern-detection counts as 'AI-coached at playbook-level' or stays at behavior-level (need product walkthrough to verify), Whether any 2026 stealth-mode startup has shipped exactly this (probability moderate; check Hacker News / Product Hunt monthly)

---

### Pre-trade validation pattern
<a id='pre-trade-validation-pattern'></a>

Tier **1**

> _Why researched_: Alleen TradeJournal.AI heeft het. Green-field opportunity. Hoe zou een 'pressure-test deze setup' UX er uitzien?

#### AI-Features

**feature name**:
Closest live examples: TradeJournal.AI 'Ask AI / Pressure-test'. SMB-style mental-pre-trade-checklist (manual). Bellafiore PlayBook-checkup adapted for pre-trade. No widely-marketed pattern-name yet — opportunity to coin one ('PlayCheck' / 'Pre-Trade Coach' / 'GoCheck').
- **ai scope**: Per-candidate-trade BEFORE entry — analysis unit is a not-yet-executed setup.
**ai proactive vs reactive**:
REACTIVE (user clicks 'pressure-test this' from entry-modal). Could become PROACTIVE on hosted+live exchanges with browser-extension watching DOM, but that crosses into trading-signal territory — explicitly out-of-scope for a journal.
**ai minimum trade threshold**:
Needs >=10 historical trades on the SAME playbook to deliver meaningful 'your past stats say X'. Below that, falls back to rule-checklist-only mode ('we don't have history yet, but your defined entry-conditions are: [list]. {N}/{total} are met right now.').
**ai underlying tech**:
LLM (Claude/GPT-4) + structured lookup over the user's playbook + trade-history table. Optional: live market-data feed (price / funding / OI for crypto-perps; sector / VIX for stocks) but data-source cost grows fast.
**output format**:
Structured card with three sections: (1) PLAYBOOK CHECKLIST (visual checks: green/amber/red per condition), (2) HISTORICAL COMPARISON (this looks most like {N} prior trades, their outcome was {result}), (3) LLM SYNTHESIS (1-paragraph go/no-go with the single most important risk to monitor).
**notable prompts**:
(1) 'Given setup {playbook_name} with current conditions {filled_values}, lookup user's history. Return {n_match, hit_rate_match, common_failure_mode}.' (2) 'Pressure-test this trade: argue the BEAR case in 3 bullets. What's the single reason this trade fails?' (3) 'Compare current conditions to user's BEST 5 and WORST 5 instances of this playbook. Which set does it resemble more?' (4) Bellafiore-style: 'Pre-trade variable check: for each of the 5 SMB variables, current-state vs play-required-state. <4/5 met = size down or skip.'

#### Playbook & Setup-Level

**playbook concept maturity**:
Pre-trade validation requires structured-rules level minimum — without explicit entry-conditions there's nothing to check. AI-coached level adds: 'your stated rules are these, but your WINNING trades reveal an unstated rule [X] that's actually doing the work — make it explicit'.
**setup level ai**:
Tightly coupled — the same playbook entity used for setup-level coaching is the substrate for pre-trade validation. Build one, get both.
**pre trade validation**:
This IS the pattern. Implementation: each playbook's entry-conditions become a runnable checklist on the entry-modal; user fills/auto-fills current values; AI checks; user gates or proceeds.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis when history exists, structured_checklist when cold. Most powerful because it intervenes BEFORE the mistake — Steenbarger argues this is 100x more behavior-changing than post-mortem analysis.

_Uncertain fields_: Exact UX of TradeJournal.AI's 'Ask AI' button (whether it's pre-trade or only post-trade) — needs product walkthrough to verify, Whether any prop-firm (FTMO, Funding Pips) ships a similar pre-trade AI internally to enforce risk rules

---

### Crypto-perp playbook-AI (gap quadrant)
<a id='crypto-perp-playbook-ai-gap-quadrant'></a>

Tier **1**

> _Why researched_: Niemand combineert dit. Onze defensible niche. Concretiseer wat 'partial-close awareness' + 'funding-rate context' + 'session-aware cadence' in een AI-coach betekent.

#### AI-Features

- **feature name**: Proposed: 'PerpCoach' (or align with existing TradeJournal naming) — a playbook-AI that natively speaks crypto-perp.
- **ai scope**: Per-playbook with per-trade context-enrichment (funding/OI/session/liquidation-cluster fed in automatically).
**ai proactive vs reactive**:
Hybrid: PROACTIVE weekly per-playbook digest + REACTIVE per-trade pressure-test + REACTIVE per-trade autopsy on close. Cadence ties to crypto's 24/7 session rhythm rather than stock-market open/close.
- **ai minimum trade threshold**: 15+ per playbook for setup-coaching, 10+ for pre-trade history-lookup, n=1 always supported (graceful degradation).
**ai underlying tech**:
Claude API (own-key model preferred for privacy + cost-pass-through, given community is small and Denny's user-base is Dutch/EU). Structured aggregation layer in JS over localStorage trade-table + cached market-context (funding/OI snapshot at entry/exit per trade).
- **output format**: Per-playbook cards + per-trade modals + weekly digest. Honest sample-size badges. Plain Dutch optional. Mobile-readable.
**notable prompts**:
Combinations of pattern_setup_playbook_coaching + pattern_pre_trade_validation + pattern_per_trade_autopsy prompts, all enriched with crypto-specific context fields.

#### Playbook & Setup-Level

**playbook concept maturity**:
Target: rule-adherence-scored + AI-coached. Substrate: Bellafiore-style 5-variable playbook adapted for perps (Big Picture = BTC regime + BTC.D + risk-on/off; Catalyst = token-unlock / CEX-listing / macro print; Setup = SMC pattern library: BOS/FVG/OB/liquidity-sweep; Tape = DOM + funding-rate + OI-delta + liquidation-clusters; Intuition = user gut score).
**setup level ai**:
Killer feature: 'BOS+FVG: 62% WR London / 38% NY / fails 71% when funding > 0.02% at entry / TP3-hit-rate drops 40% in low-OI regimes' — auto-generated per playbook.
**rule adherence scoring**:
A/B/C grade per Bellafiore. A = all 5 SMB-vars met. B = 4/5. C = 3 or fewer (forced trade). Discipline-score = A% over rolling window.
**pre trade validation**:
Pressure-test button with auto-filled crypto-context (funding, OI-delta, BTC.D direction, session, liquidation-cluster distances).
**playbook template library**:
Ship 5-7 SMC-native templates: BOS+FVG long/short, Liquidity-sweep reversal, Range-break continuation, OB-retest, Session-open momentum. Each with default conditions tailored to perps.

#### Crypto-Fit

**crypto perp exchange support**:
Blofin, MEXC, Kraken Futures, Hyperliquid, FTMO-MT5 (CFD). Already integrated. Bybit/OKX/Binance later if community demand.
- **multi asset**: Crypto-perp primary, FX/CFD via FTMO MT5 secondary. Spot crypto out-of-scope (different mental model).
**partial close awareness**:
First-class — multi-TP partial-close is the DEFAULT trade-model in our community (per project memory). Each TP-leg has its own R, hit-status, MFE/MAE. Aggregate trade is weighted-R across legs. No competitor models this correctly.
**funding rate context**:
Each trade snapshots funding-rate at entry + max funding during hold + funding-flip-event flag. Fed into per-trade autopsy AND per-playbook aggregation (e.g. 'this playbook's failure-mode correlates with funding>X').
**gap session breakdown per setup**:
Auto-computed: Amsterdam-tz session bucketing (Asia / London / NY-open / NY-close) x playbook = WR / avg-R grid. Headline insight per playbook in the weekly digest.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis powered by structured aggregation. Causal claims defensible because crypto-context fields (funding/OI/session) are objective inputs.
**psychology metrics**:
Tilt-meter triggered by post-loss revenge-trade pattern (next trade within X minutes, oversized). Discipline-score from A/B/C playbook-grades. Mindset prompts (already in app) tied to sessional cadence.
- **voice journaling**: Optional, low-priority for v1.
**mentor mode**:
Future: community members (Sebas+Denny first) can review each other's playbook stats — but stats only, never trades themselves, to respect privacy-mode (per v12.127 release).

_Uncertain fields_: Whether any new entrant has shipped a Bellafiore-grade playbook + Claude-API + Hyperliquid native combo in stealth (low probability but worth a quarterly check), Exact funding-rate threshold values that correlate with our community's playbook failures (need actual aggregate data — currently using illustrative numbers in prompts), Cost-per-month for end-user when using own-Claude-API-key at production scale (depends heavily on prompt-design — target <$2/mo through aggressive caching of playbook-stats)

---

### Tradezella
<a id='tradezella'></a>

Tier **2** · [https://www.tradezella.com/](https://www.tradezella.com/)

> _Why researched_: Marktleider. Zella AI is gepromoot maar nog niet geshipped (waitlist mei 2026). Zella Score + playbook-templates relevant.

#### Basis

**target market**:
Active retail traders (day-traders heavy). Multi-asset: stocks, options, futures, forex, crypto. Global with strong North-America community via Discord.
**pricing model**:
Subscription. Essential $24/mo (annual): full analytics, backtesting, Trade Replay, 3 Playbooks. Pro $33/mo (annual): unlimited accounts, unlimited Playbooks. 500+ broker sync, Zella University education, Discord community.

#### AI-Features

**feature name**:
Zella AI (conversational, coming soon late 2026) + Zella Insights (per-trade, live) + AI weekly/monthly reports (live) + AI first-import analysis (live)
**ai scope**:
Live: per-trade (Zella Insights on every trade), per-period (AI-powered weekly + monthly performance reports), per-portfolio (AI first-import analysis evaluates complete trade history on first connect). Coming: per-portfolio conversational chat (Zella AI).
**ai proactive vs reactive**:
Hybrid today. Push: per-trade Zella Insights run automatically, weekly + monthly reports auto-generated, first-import analysis runs on connect. Pull (coming): conversational Zella AI Q&A.
**output format**:
Per-trade insight cards (Zella Insights), scheduled performance reports (weekly + monthly), first-import analysis dossier. Coming: conversational chat. Plus rich structured analytics (50+ reports), trade replay (3 modes).

#### Playbook & Setup-Level

**playbook concept maturity**:
rule-adherence-scored. Playbook is the central paradigm: 'separating the quality of your strategy from the quality of your execution'. Playbooks have Groups, Criteria, and Rules; Tradezella reports how well the trader adhered to Playbook rules and the performance difference between rule-followed vs rule-broken trades.
**rule adherence scoring**:
Yes, explicit. Playbook rules can be defined; Tradezella reports 'how well the trader adhered to the Playbook rules and what the performance difference looks like between trades that followed the rules versus those that did not'. Has a 'Rule Adherence Score' blog framework.
**playbook template library**:
25+ ready-made strategy templates (community playbooks viewable). Includes named strategies like 'PO3, OTE + ADR Forex Playbook by NBB Trader'. Users can see other traders' strategies and success rates.

#### Privacy & Stack

- **cost per month user**: $24-33/mo (annual billing). AI features included; no separate AI charge.

#### Crypto-Fit

- **multi asset**: Stocks, options, futures, forex, crypto. Multi-asset across all tiers.
**partial close awareness**:
Yes — Tradezella explicitly counts partial closes separately: 'Multiple partial exits count separately.' This indicates first-class multi-TP awareness in trade modeling.

#### Coaching Depth

**coaching depth level**:
Between surface_metrics and deep_pattern_analysis today. Per-trade Zella Insights + auto weekly/monthly reports + first-import analysis + Spaces (mentor mode) give multi-axis structure, but the deep conversational coaching depth is gated on Zella AI launching.
**psychology metrics**:
Tilt and revenge-trading detection are the marketed Zella AI promises. Mistake tracking + playbook adherence already exist. Specific named scores (Tiltmeter, FOMO-tag) not Tradezella's framing.
**mentor mode**:
Yes — 'Spaces' (rebrand of Mentor Mode). A trader shares their full journal with a mentor / trading group / accountability partner; mentor views trades in real time, leaves notes, tracks progress.

#### Community

**community driven ai**:
Yes for community-shared playbooks: 'view other traders' strategies and see their success rates'. Active Discord community. 25+ ready-made strategy templates shared. Zella University education hub.
**changelog ai velocity**:
Multiple live AI features (Insights, weekly/monthly reports, first-import analysis); flagship Zella AI conversational chat expected late 2026. Active AI roadmap.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, setup_level_ai, pre_trade_validation, privacy_model, data_residency, crypto_perp_exchange_support, funding_rate_context, gap_session_breakdown_per_setup, voice_journaling

---

### Edgewonk
<a id='edgewonk'></a>

Tier **2** · [https://edgewonk.com/](https://edgewonk.com/)

> _Why researched_: Edge Finder (algorithmic pattern detection, weekly email Jan 2026). Tiltmeter voor psychology. Geen generative AI.

#### Basis

**founded**:
2014 by Moritz Czubatinski. Web-based Edgewonk 3 launched 6 Feb 2024 (full rebuild, cloud-hosted in Germany). 'Decade of trust' marketed.
**target market**:
Serious retail traders globally with psychology-first orientation. Strong forex/futures heritage, multi-asset (forex, stocks, futures, crypto, options, CFDs, indices, commodities). 200+ brokers, strong MT4/MT5 install base.
- **pricing model**: Subscription, upfront full term. 12 months $197, 24 months $297. 14-day 100% money-back guarantee. No monthly plan.

#### AI-Features

- **feature name**: Edge Finder (launched 6 Jan 2026) — marketed as 'AI-Driven'
**ai scope**:
Per-portfolio + per-period analysis. Edge Finder examines every variable across the journal: asset class, time-of-day, day-of-week, position size, setup type, holding duration, market conditions, custom tags. Ranks variables by impact.
**ai proactive vs reactive**:
Push (scheduled). Edge Finder 'runs automatically every week' without user prompting. No conversational pull interface advertised — pure scheduled auto-analysis. Output is delivered as a structured weekly digest.
**ai underlying tech**:
Algorithmic pattern detection / classical ML, NOT generative LLM. Multiple reviews explicitly call out: 'Edgewonk markets its Edge Finder as AI-Driven — but it's algorithmic pattern detection, not generative AI.' Built on 10+ years of trader journal data.
**output format**:
Structured weekly digest with 6 core categories of insights, each with concrete data points + practical observations. Variables ranked by impact. Includes specific metrics: winrate + weekly change, break-even R:R, time-period strength callouts, 'Total Edge Leak' (P&L lost to discipline drops).
**notable prompts**:
Edge Finder is not prompt-driven (no chat). Concrete output framings: 'Your winrate, its weekly change, and the break even reward to risk ratio reveal whether your current performance is sustainable.' 'This view highlights the specific time periods where your performance is strongest so you can concentrate your energy where it pays.' 'The Total Edge Leak shows exactly how much performance slips away when discipline drops.' Six insight categories per weekly run.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules + rule-adherence-scored (Trade Economy / Tiltmeter). Trade checklists, mistake tracking, custom tags per setup. Edge Finder reports per-tag/setup performance ranked by impact.
**setup level ai**:
Partial. Edge Finder ranks 'setup type' as one of its variables, so it does setup-level cohort analysis — but not interactively per-playbook. The user can see which setup tag drives edge, not have an AI coach on that specific playbook.
**rule adherence scoring**:
Yes — 'Total Edge Leak' quantifies P&L lost when discipline drops. Mistake tracking + trade checklists + Tiltmeter together produce a measurable discipline-cost number. This is one of the older and more refined implementations of the concept (decade-plus track record).

#### Privacy & Stack

**privacy model**:
Vendor-hosted (Edgewonk 3 cloud). No bring-your-own-key (because Edge Finder is not generative-LLM). Independent penetration testing for security.
**data residency**:
Cloud-hosted on servers in Germany — strong privacy/GDPR posture (one of few in this batch with explicit data-residency claim).
- **cost per month user**: $197/year = ~$16.40/mo, or $297/24mo = ~$12.40/mo. No separate AI cost (Edge Finder included).

#### Crypto-Fit

**crypto perp exchange support**:
Crypto coverage limited: Bybit and Coinbase named. Hyperliquid, Blofin, MEXC not listed. Strong MT4/MT5 ecosystem (200+ brokers) so crypto via MetaTrader bridges is possible but not native to top perp exchanges.
**multi asset**:
Forex, stocks, futures, crypto, options, CFDs, indices, commodities. Multi-asset is broad but skewed forex/futures heritage.
**gap session breakdown per setup**:
Yes via Edge Finder — explicitly ranks time-of-day, day-of-week, and setup tags by impact. 'BOS+FVG London vs NY' style cohort breakdown is functionally what Edge Finder produces, just not in that exact ICT framing.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis on the algorithmic side. Tiltmeter (numeric emotional rating per trade correlated with P&L), mistake tracking with cost-quantification, Edge Finder weekly digest with 6 insight categories. Lacks the conversational depth of LLM-powered competitors.
**psychology metrics**:
Tiltmeter (signature feature — numeric emotional rating per trade correlated with win-rate and P&L), trading psychology lab, discipline tracking, mindset tools, mistake tracking with dollar cost. One of the original psychology-first journals.
**mentor mode**:
Not advertised — 'unlike some competitors that host vibrant Discord or Slack servers for users to network, Edgewonk does not offer an official social community. The focus is strictly on your personal data and development.'

#### Community

- **community driven ai**: Explicitly NOT community-oriented; Edgewonk positions itself as personal-data-focused with no social/Discord component.
**changelog ai velocity**:
Edge Finder AI launched 6 Jan 2026. Edgewonk 3 web-app launched 6 Feb 2024. Public changelog at edgewonk.com/changelog. Cadence appears infrequent-but-major (year-scale releases for AI/platform jumps).

_Uncertain fields_: ai_minimum_trade_threshold, pre_trade_validation, playbook_template_library, partial_close_awareness, funding_rate_context, voice_journaling

---

### TradesViz
<a id='tradesviz'></a>

Tier **2** · [https://www.tradesviz.com/](https://www.tradesviz.com/)

> _Why researched_: Hyperliquid native support (zeldzaam). AI Chat + AI Q&A (NL→DB queries). 600+ stats. Analyst-style i.p.v. coaching.

#### Basis

**target market**:
Multi-asset retail traders globally (USA, Canada, India, Australia exchanges + forex/crypto/indices). Heavy options/multi-asset depth makes it a power-user product.
**pricing model**:
Freemium. Free: 3,000 executions/month, 50+ visualizations. Pro €17/mo (~$19.99/mo) (€161/yr with 25% discount): unlimited imports, 400+ visualizations, AI features. Platinum €25/mo (~$29.99/mo) (€233/yr): custom dashboards, pivot grid, trading simulator, options flow, AI Q&A.

#### AI-Features

- **feature name**: AI Suite — AI Q&A, AI Summary, AI Notes, AI Trade Chat, AI Widgets, Fundamentals AI Q&A
**ai scope**:
Per-trade (AI Notes per-trade summaries combining trade data + market data), per-period (AI Summary daily performance summaries), per-portfolio (AI Q&A in natural language across all trades, AI Trade Chat conversational with follow-ups), custom (AI Widgets for dashboard analytics powered by AI queries).
**ai proactive vs reactive**:
Hybrid. Push: AI Summary delivers daily performance summaries with personalized improvement suggestions; AI Notes auto-generates on trades. Pull: AI Q&A (40,000+ user queries run to date), AI Trade Chat conversational, AI Widgets user-configured.
**ai underlying tech**:
Hybrid mix. AI Q&A: 'no data is sent outside TradesViz' (in-house implementation). AI Notes: explicitly sends data to OpenAI / Google AI servers to use their models. Combination of 'state-of-the-art LLM models with chain-of-thought reasoning'. Most transparent AI-tech disclosure in this batch.
**output format**:
Charts + text (AI Q&A returns answers WITH charts), structured daily summaries, per-trade notes, conversational chat with follow-ups, configurable AI Widgets on dashboard.
**notable prompts**:
Concrete published examples (TradesViz has a public 'Queries list and cheatsheet guide' blog): 'what is the most successful tags with highest pnl on tuesdays between 9 and 10 am?'. AI Q&A is search/analysis via natural language. AI Notes auto-summarizes trade data + market context (trends, volatility, candlestick patterns, chart formations, support/resistance). AI Trade Chat supports follow-ups and pattern discovery.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules. 'Trade Plans & Mistake Analysis' lets users create detailed trading plans and checklists per trade and per trading day, and analyze how well rules are followed + impact on P&L. Tagging system for setups. Less playbook-as-primary-paradigm than Tradezella/RizeTrade, but the concept is present.
**setup level ai**:
Yes via natural-language queries on user-defined tags. Users can ask the AI 'highest-PnL tags on Tuesdays 9-10am' — this is setup-level cohort analysis on demand. Not auto-curated per-playbook coaching, but the AI can be pointed at any setup cohort the user has tagged.
**rule adherence scoring**:
Yes via Trade Plans + Mistake Analysis: 'helps you analyze how well you adhere to your rules and how deviations impact your P&L'. Quantified at the rule-deviation × P&L level. Not as compliance-percentage-headlined as RizeTrade.

#### Privacy & Stack

**privacy model**:
Hybrid + transparent. AI Q&A: in-house, no external data egress. AI Notes: explicit user-consent egress to OpenAI / Google AI. No bring-your-own-key documented but the privacy separation per AI feature is the strongest in this batch.
**cost per month user**:
$0 (free), $19.99/mo Pro (or $14.99/mo annual), $29.99/mo Platinum (or $22.49/mo annual). AI features included in Pro+; Platinum unlocks AI Q&A.

#### Crypto-Fit

**multi asset**:
Stocks, futures, options (deep — multi-leg, Greeks, payoff charts, 0DTE), forex, cryptocurrency (spot + perps), indices. 15,000+ tickers, 6 asset classes. Strongest options support in this batch.
**partial close awareness**:
Yes — explicitly built for it: 'TradesViz was built to handle multi-leg spreads, partial closes, rolls, assignments, exercises, 0DTE turnover, and broker exports.' First-class multi-TP / partial close awareness — among the best in this batch.
**funding rate context**:
Yes — 'funding/fee impact' explicitly mentioned in the unified crypto trading journal for spot/futures/perpetuals. 'Funding, Fees & Volatility Analytics' is a marketed feature for crypto.
**gap session breakdown per setup**:
Yes via AI Q&A — explicit example: 'most successful tags with highest pnl on tuesdays between 9 and 10 am'. User can phrase any setup × session/time combination. 600+ statistics for Platinum users. Not auto-curated per-playbook, but on-demand via NL queries.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Combination of 6 AI features (Q&A, Summary, Notes, Chat, Widgets, Fundamentals), 400-600+ visualizations, options-flow integration, Monte Carlo risk sim, AI Notes that combine trade-level + market-condition context. Coaching is data-rich but more analytical-companion than human-coach-style; lacks an explicit accountability/discipline framing.

#### Community

**changelog ai velocity**:
Active AI development — multiple AI features shipped (Q&A, Summary, Notes, Trade Chat, Widgets, Fundamentals AI Q&A). TradesViz blog regularly publishes AI-feature posts (e.g. AI Trade Chat, AI Notes, AI query examples cheatsheet, Fundamentals AI Q&A). One of the more AI-prolific journals in this list.

_Uncertain fields_: founded, ai_minimum_trade_threshold, pre_trade_validation, playbook_template_library, data_residency, crypto_perp_exchange_support, psychology_metrics, voice_journaling, mentor_mode, community_driven_ai

---

### Trader's Second Brain (TSB)
<a id='traders-second-brain-tsb'></a>

Tier **2** · [https://traderssecondbrain.com/](https://traderssecondbrain.com/)

> _Why researched_: TSB Expert markets AI Trading Coach met setup-specific pattern recognition. Onafhankelijke claim, te verifieren.

#### Basis

**target market**:
US-equity stock + options retail traders. Heavy options-strategy focus (Iron Condors, Spreads auto-detection). Primarily Interactive Brokers / Schwab / Fidelity / Tasty Trade / Tradovate users. Not for crypto-perp / forex / futures-only traders.
**pricing model**:
Freemium. Basic: free (1 import source, 3 statement uploads/month, basic stats, automatic spread detection). Pro: $10/mo or $100/yr (save 17%) — unlimited import sources + unlimited statement uploads + Broker Sync + technical/fundamental analysis stats + daily journal + AI insights.

#### AI-Features

- **feature name**: AI Insights + Automatic Trade Tagging + Smart Option Strategy Detection
**ai scope**:
Per-trade (automatic tagging based on technical + fundamental analysis; auto-detects option spreads), per-portfolio (AI Insights analyze complete trading history for patterns + recommendations).
**ai proactive vs reactive**:
Push leaning. AI auto-tags each trade on import (push). AI continuously 'keeps suggesting areas you can improve' (push). User can also view AI Insights on demand (pull).
**output format**:
Auto-applied tags on trades (technical + fundamental classification), AI Insights cards (personalized recommendations), calendar view (weekly performance), comprehensive analytics dashboard, option-strategy groupings.

#### Playbook & Setup-Level

**playbook concept maturity**:
tag-only — but with AI auto-tagging based on technical + fundamental analysis (vs user-defined tags). Tag your setups and analyze them. Not a structured-rules / promotion-rule playbook system.
**setup level ai**:
AI automatically groups trades by detected technical pattern + fundamental setup. Per-setup performance can then be analyzed. Smart Option Strategy Detection groups multi-leg trades automatically — important for options traders.

#### Privacy & Stack

**privacy model**:
Vendor-hosted only. Bank-level encryption in transit + at rest. Enterprise-grade cloud infrastructure with regular security audits. No own-API-key option for AI.
- **cost per month user**: $10/mo Pro tier ($100/yr). AI Insights included — no separate API surcharge. Cheapest AI-bundled tier in this cohort.

#### Crypto-Fit

**crypto perp exchange support**:
None. Stocks + options brokers only (Interactive Brokers, Schwab, Fidelity, Tasty Trade, Tradovate). 'We support stocks and options trading on the following brokers'. No crypto/forex/perp.
**multi asset**:
Stocks + options (primary). Futures via Tradovate. Complex option strategies (Iron Condors, Spreads) auto-detected — strong options coverage. No crypto/forex.
- **funding rate context**: N/A — not crypto.
**gap session breakdown per setup**:
Calendar view (weekly performance) + 'Comprehensive Analysis'. Per-setup × per-session not explicitly marketed for stocks (less relevant than for crypto/forex).

#### Coaching Depth

**coaching depth level**:
Approaches deep_pattern_analysis via AI Insights (identifies successful patterns + pitfalls + provides personalized recommendations) but stays at surface_metrics for most dashboards. Best-in-cohort for options-strategy classification.
- **mentor mode**: No formal coach-review-student feature.

#### Community

- **community driven ai**: No shared-AI templates or collective insights model marketed. Per-user analytics.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, rule_adherence_scoring, pre_trade_validation, playbook_template_library, data_residency, partial_close_awareness, psychology_metrics, voice_journaling, changelog_ai_velocity

---

### Plancana
<a id='plancana'></a>

Tier **2** · [https://plancana.com/](https://plancana.com/)

> _Why researched_: iOS-first (4.7★). AI-generated rules + emotional pattern detection. Psychology-focused alternatief.

#### Basis

**target market**:
Retail traders, prop-firm traders, forex/MT4-MT5 traders, ByBit-futures crypto traders. Mobile-first (iOS + Android). 12,000+ active traders. Global, English-speaking. Positions itself as 'mobile-first psychology-driven' alternative to TradeZella/TraderSync.
**pricing model**:
Freemium. Free tier (manual journaling, no card required). Paid plans from $2.99/week. Specific monthly/annual price tiers not transparently listed in marketing — emphasis on app-store subscription model.

#### AI-Features

- **feature name**: AI Psychology Coach / AI Emotional Analysis / Trading Plan Builder
**ai scope**:
Per-period (per-session and post-trade) emotion analysis; per-trader rule synthesis (AI generates trading plan from style and goals). Less per-setup focused.
**ai proactive vs reactive**:
Hybrid leaning push. AI auto-analyzes after each trading session and surfaces emotional patterns; AI also enforces psychology rules every session (push). Users can also query for insights (pull).
**output format**:
In-app cards, push notifications, weekly summaries on mobile. Conversational AI mentor delivers post-session insights. Simple metrics (win rate, R:R, drawdown, time-of-day) presented as digestible mobile UI.

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules. AI-generated trading plan codifies strategy, risk limits, and psychology rules. Less 'multiple named setups with edge stats per setup' (TSB/Process Trader style); more 'one personalized plan with do's and don'ts'.
**rule adherence scoring**:
Yes via Psychology Rules feature ('Set do's and don'ts. AI enforces them every session'). Quantified rule-following is implied but specific scoring methodology not detailed.
- **playbook template library**: Trading Plan Builder generates personalized plan from user input; no shared template library mentioned.

#### Privacy & Stack

- **privacy model**: Vendor-hosted only. Read-only encrypted broker connections. No own-API-key option.
- **data residency**: Cloud (vendor servers). Mobile-first SaaS.

#### Crypto-Fit

**crypto perp exchange support**:
Only ByBit Futures (single crypto exchange). No Hyperliquid, Blofin, MEXC, OKX, or Binance support. Weak crypto coverage.
- **multi asset**: Forex (MT4/MT5), ByBit Futures (crypto-perp), Tradelocker (CFD/futures). No stocks-native, no options.
**gap session breakdown per setup**:
Time-of-day patterns are computed at the trader level (not per-setup). No marketed 'BOS+FVG: 62% WR London' per-setup session split.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis on psychology side; surface_metrics on technical side. Strong on emotional pattern detection (revenge, FOMO, fear) with causal narrative + action. Weaker on edge analysis per setup.
**psychology metrics**:
Fear-of-loss detection, Greed/FOMO oversizing detection, Revenge-trading spirals, emotional state tagging per trade sequence. Explicitly the core marketing differentiator.
- **mentor mode**: Trading Circle: share stats with trusted trader friends privately. Limited peer-review; no formal coach-review feature.

#### Community

- **community driven ai**: Trading Circle for private stat-sharing among trusted friends. No shared-AI templates or collective insights model.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, setup_level_ai, pre_trade_validation, cost_per_month_user, partial_close_awareness, funding_rate_context, voice_journaling, changelog_ai_velocity

---

### Process Trader
<a id='process-trader'></a>

Tier **2** · [https://processtrader.com/](https://processtrader.com/)

> _Why researched_: 'First AI journal that cares about why you trade'. Voice transcription + pre-market routines + hard rules. Process-discipline angle.

#### Basis

**target market**:
Pro/serious retail futures and prop-firm traders (MetaTrader 5, Tradovate, NinjaTrader, cTrader, Rithmic, Top One Trader, ProjectX, The Futures Desk). Endorsed by trading psychologists Dr Brett Steenbarger and Andrew Menaker. Positioned as 'intelligence layer for serious traders' — process-over-outcome philosophy.
**pricing model**:
Freemium. Free tier: journal entries, trades, missed trades, reports archive, routine builder, 1 trading account. Pro tier: $12/mo or $120/yr (currently 50% off forever). Pro adds advanced analytics, edge finder, Monte Carlo, process impact, AI chat coach + weekly reviews, up to 5 trading accounts.

#### AI-Features

- **feature name**: AI Coach (24/7 conversational) + Edge Finder + Process Impact + Mood Detection
**ai scope**:
Per-trade (mood detection auto-tags emotional state from voice/text logs); per-period (weekly AI reviews); per-trader (coach knows full history including rules, values, pre-market state); per-pattern (FOMO triggers, hesitation leaks).
**ai proactive vs reactive**:
Hybrid. Push: weekly AI reviews auto-generated + automatic mood detection links emotion to P&L. Pull: 24/7 AI chat coach answers user questions about specific patterns.
**output format**:
Conversational chat (24/7 AI Coach), structured cards (Edge Finder green/red heatmap by time-block/hold-time/mindset), $-Value cards (Process Impact quantifies dollar cost of skipping a plan / trading frustrated), voice transcription for live reality logging, weekly written reviews.
**notable prompts**:
Documented examples include: 'Ask about specific patterns, FOMO triggers, or hesitation leaks in real-time conversations.' Marketing implies prompts like: 'What did skipping my plan cost me this week?', 'Why am I trading worse when frustrated?', 'Which time blocks actually put money in my pocket?', 'How is my pre-market state affecting today's trades?'. AI is positioned to link mood + pre-market state + execution back to P&L causally. [partial - inferred from marketing]

#### Playbook & Setup-Level

**playbook concept maturity**:
structured-rules, approaching AI-coached. 'Build Your System' pillar: pre-market routines, hard rules, core values. The AI Coach knows these rules and references them during chats. Less per-setup playbook structure than TSB/Tradervue; more 'one personal trading system with rules + values'.
**setup level ai**:
Edge Finder is the closest analog — surfaces time-blocks, hold-times, and mind-sets that work (green=exploit, red=trim). Per-setup analysis exists ('Symbol analysis and edge finder' Pro feature) but the framing is process/routine-centric rather than 'named setup library with WR-per-session' approach.
**rule adherence scoring**:
Yes via Process Impact (quantifies $-cost of rule violations — what skipping a plan or trading frustrated costs you in actual dollars). 'Top Trades by Process Score' implies a per-trade discipline scoring system.
**pre trade validation**:
Yes via pre-market baselines + routine builder. User logs pre-market state before trading; AI then compares actual trading against pre-market plan. Not a 'pressure-test a specific setup before entry' tool, but rather a 'are you in the right state to trade today' check.
**playbook template library**:
Free Learning Vault has curated strategies (ORB 5-min, Expectancy psychology guides). Not user-installable playbook templates per se, but educational templates exist.

#### Privacy & Stack

**privacy model**:
Vendor-hosted only. Data 'encrypted at rest and in transit' per FAQ; 'never share trading data with third parties'. No own-API-key option visible.
- **cost per month user**: $12/mo (Pro tier, current 50% promo). $120/yr. AI Coach chats included in Pro — no separate AI surcharge.

#### Crypto-Fit

**crypto perp exchange support**:
No native crypto exchange support. Imports focus on futures brokers (MetaTrader 5, Tradovate, NinjaTrader, cTrader, Rithmic). 'Any Broker (AI)' CSV import promises broad support via AI parsing, but crypto-perp is not a marketed use case.
**multi asset**:
Primarily futures + forex (MT5). Stocks indirectly via NinjaTrader/cTrader brokers. Crypto only via generic CSV upload. No native options support marketed.
- **funding rate context**: Not applicable / not mentioned (not crypto-focused).
**gap session breakdown per setup**:
Edge Finder shows time-block performance but framed at trader level, not 'per setup × per session'. Closest equivalent: see which sessions × hold-times × mindset combos make money.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Explicitly designed to link 'invisible data' (mood, pre-market state, routine) to P&L causally. Goes beyond surface metrics — quantifies dollar cost of behavioral leaks.
**psychology metrics**:
Mood detection (auto-tags psychological state from voice/text), pre-market baseline tracking, hesitation-leak detection, FOMO trigger identification, frustration-impact quantification, Process Score per trade. Also includes grounding tools (bilateral stimulation, box breathing) for emotional regulation during sessions — unusual feature.
**voice journaling**:
Yes — first-class feature. Voice transcription to record 'live reality' while trading; AI detects mood/psychological state and auto-links to P&L.
- **mentor mode**: AI Coach acts as personal mentor; no human-coach-reviewing-students mode marketed.

#### Community

**community driven ai**:
Open Learning Vault provides shared educational content (strategies, psychology guides, expert podcasts), but each user's AI Coach is private to them. No collective AI insights / shared template marketplace.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, data_residency, partial_close_awareness, changelog_ai_velocity

---

### Van Tharp — System Development
<a id='van-tharp-system-development'></a>

Tier **2** · [https://www.vantharp.com/](https://www.vantharp.com/)

> _Why researched_: R-multiples, position sizing, system development. Quantitative coaching-framework dat goed past bij AI-analyse.

#### AI-Features

**ai proactive vs reactive**:
Mostly PROACTIVE / scheduled. Tharp metrics make sense as periodic dashboard pushes (per-setup weekly, beliefs-audit monthly, objectives-fit quarterly) rather than per-trade pop-ups.
**ai minimum trade threshold**:
Tharp himself suggests 30 trades minimum for any meaningful expectancy estimate, 100+ for confident SQN. AI-prompts using Tharp metrics should be GATED on N >= 30 with explicit 'small-sample warning' messaging below that.

#### Playbook & Setup-Level

**rule adherence scoring**:
Tharp connects rule-adherence to R-distribution: rule-followed trades should produce a different R-distribution than rule-broken trades. Concrete metric: SQN(rule-followed) vs SQN(rule-broken) per setup. If they're equal, the rule isn't doing work — drop it. If rule-broken SQN is much lower, the rule is real edge — enforce it harder.

#### Framework (alleen frameworks-items)

**author**:
Van K. Tharp — 'Trade Your Way to Financial Freedom' (1998, multiple editions), 'Definitive Guide to Position Sizing Strategies', founder Van Tharp Institute. Coined 'Tharp Think'.
**core principle**:
Trading success is a QUANTITATIVE engineering problem on top of a psychological one. Three pillars: (1) develop a SYSTEM that fits YOUR personality and objectives — no universal system works, (2) measure every trade in R-multiples (profit/loss divided by initial risk R) so trades become comparable, (3) position-sizing is the most important variable for meeting objectives — not entry, not exit. The System Quality Number (SQN = mean(R) / stdev(R) * sqrt(N)) is his single-number system-quality metric. Tharp's mantra: 'You don't trade the markets — you trade your beliefs about the markets.'
**translation to ai prompts**:
Tharp's framework translates into highly QUANTITATIVE AI-prompts that turn every trade into a data-point and every setup into a system-under-evaluation. Five concrete prompt-templates: (1) R-MULTIPLE EXTRACTION (automatic on close): 'Trade closed: entry={E}, stop={S}, exit={X}, side={side}. Initial risk R = |E-S| * size. Realised R = (X-E)/(E-S) for long. This trade was {+/-N.NN}R. Add to {setup_name} distribution. New SQN for this setup over {N} trades: {SQN}.' (2) SETUP-AS-SYSTEM EVALUATION (per playbook, on every Nth trade): 'Setup {name} now has {N} samples. Expectancy = {mean_R}R per trade. SQN = {value} (Tharp scale: <1.7 poor, 1.7-2.5 average, 2.5-3.0 good, 3.0-5.0 excellent, 5.0-7.0 superb, >7.0 holy grail). Standard-dev of R = {std}. Hit-rate = {WR}%. Recommendation: {trade-more / refine-rules / cut-this-setup}.' (3) POSITION-SIZING SANITY (pre-trade): 'Account = ${equity}. Risk per trade target = {pct}% = ${$R}. This trade's stop distance = {N} ticks/points. Max size = {qty}. You're entering with {actual_qty}. {Within / Exceeds} sizing rules.' (4) BELIEFS-AUDIT (monthly): 'List your top 5 beliefs about {market}. For each: what trades did it cause this month? Did the outcome support or contradict the belief? Tharp: trades that don't fit a belief = noise; trades that do = signal-or-bias — distinguish.' (5) OBJECTIVES-FIT CHECK (quarterly): 'Your stated objective: {target_return} per {period} with max-drawdown {max_dd}. Realised: {actual_return}, max-DD {actual_dd}. System-fit verdict: which setups contributed positively to objective? Which dragged? Drop / tune / scale.'
**best fit scope**:
Setup-level + portfolio-level. Tharp's R-multiple and SQN math come alive at the AGGREGATE — single trades carry no signal in his framework, only distributions do. Best fit for our playbook-AI: auto-compute SQN per playbook, surface 'this setup graduated to Good' or 'this setup is dropping below average — investigate' as proactive coaching moments. Less suited to per-trade emotional coaching (Douglas/Steenbarger) or single-trade autopsy (Bellafiore). Especially powerful for partial-close traders: realised-R per leg + weighted-R per full trade is a Tharp-native concept that current journals butcher.

_Uncertain fields_: Exact SQN tier thresholds vary slightly across Tharp editions; the 1.7/2.5/3.0/5.0/7.0 scale comes from popular summaries and may not match Tharp's most recent definitions, Whether Tharp Institute has any AI-coaching product themselves in 2026

---

### Mike Bellafiore — One Good Trade (SMB)
<a id='mike-bellafiore-one-good-trade-smb'></a>

Tier **2** · [https://www.smbtraining.com/](https://www.smbtraining.com/)

> _Why researched_: Big Picture / Tape / Intuition framework. Drie-laagse pre-trade-validatie die we al deels in playbook hebben.

#### AI-Features

**ai proactive vs reactive**:
Hybrid. Per-trade Checkup is REACTIVE (user-initiated 'make this a play'). Pre-trade variable-check is PROACTIVE (gates the entry button when an existing play is selected). Play-performance leaderboard is SCHEDULED-PROACTIVE (weekly push).
- **output format**: Structured 5-card layout (one card per SMB variable) on entry and exit; play-leaderboard as sortable table.
**notable prompts**:
'What are the 3 repeatable conditions that must be true to take this trade again?' is the canonical SMB question and the single most leverageable prompt to embed in any playbook-AI.

#### Playbook & Setup-Level

**playbook concept maturity**:
Bellafiore's framework represents the highest end: AI-coached, structured-rules, rule-adherence-scored. The PlayBook is literally a NAMED set of plays with explicit entry-criteria — exactly what our app's playbook concept should aspire to.
**rule adherence scoring**:
Native to Bellafiore — every trade gets graded A/B/C against the play it was taken under (A = all conditions met, B = most met, C = forced/improvised). A-grade percentage IS the discipline-score.
- **pre trade validation**: Native fit — the 5-variable check IS pre-trade validation. Maps directly onto a pressure-test-this-setup AI button.

#### Framework (alleen frameworks-items)

**author**:
Mike Bellafiore — co-founder SMB Capital (NYC prop firm). Books: 'One Good Trade' (2010), 'The PlayBook: An Inside Look at How to Think Like a Professional Trader' (2013). YouTube: SMB Capital channel.
**core principle**:
Trading is a series of one-good-trades — never about a single home-run, always about the next high-quality decision. The PlayBook formalises this into a 5-variable framework: every trade is decomposed into Big Picture (macro/market context), Intraday Fundamentals (news/catalyst making the stock 'in play'), Technical Analysis (chart structure / S&R), Tape Reading (Level II order-flow), and Intuition (pattern-recognition built from screen-time). The PlayBook Checkup is the canonical practice: a junior trader presents their best trade across these 5 variables, then defines the REPEATABLE conditions under which they would take this trade again — that becomes a 'play' in their playbook. Over years a trader accumulates 5-15 personal plays and grades each trade against them.
**translation to ai prompts**:
Bellafiore's framework is unusually AI-friendly because it's already a STRUCTURED 5-FIELD TEMPLATE. Five concrete prompt-templates: (1) PLAYBOOK-CHECKUP (post-trade, reactive button 'Make this a play'): 'You just closed {trade} with +{R}R. Let's add it to your PlayBook. Answer the 5 SMB variables: (a) Big Picture — what was SPY/sector/regime doing? (b) Intraday Fundamentals — what catalyst/news/level made {symbol} in-play? (c) Technical Analysis — what chart pattern (FVG, BOS, VWAP-bounce, range-break)? (d) Tape Reading / Order Flow — what did you see in DOM / liquidations / funding (for perps: what did funding-rate / OI / liquidation-cluster show)? (e) Intuition — what felt right that you can't fully articulate? Then: what are the 3 REPEATABLE conditions that must be true to take this trade again?' (2) PRE-TRADE VARIABLE-CHECK (entry gate against a saved play): 'You're entering {symbol} as {play_name}. Required conditions per your own playbook: [1] Big-Picture: {market_in_uptrend? regime_risk-on?} — Current: {auto-detected}. [2] Catalyst: {must_have_news_in_24h} — Current: {Y/N}. [3] Setup: {pattern} — Current: {chart_check}. [4] Tape/Flow: {confirmation} — Current: {OI/funding/DOM check}. [5] Intuition: {gut_score 1-5}. {N}/5 conditions met. Bellafiore-rule: <4/5 = skip or size down.' (3) ONE-GOOD-TRADE STREAK (intraday session prompt): 'Your last 3 trades scored {A/B/C} on PlayBook adherence. SMB rule: focus only on the NEXT one good trade — not on making back P&L, not on revenge. Reset. What's the next A-grade setup you see right now?' (4) PLAY-PERFORMANCE LEADERBOARD (weekly proactive): 'Your PlayBook has {N} plays. Performance this month: {play_A}: +{R}R over {n} trades (KEEP), {play_B}: -{R}R over {n} (CUT or REFINE), {play_C}: 0R over {n} (NEEDS SAMPLES). Bellafiore-rule: max 5-7 active plays. Which to retire?' (5) JUNIOR-TRADER PRESENTATION SIMULATION (training mode): 'Pretend you're presenting {trade} to the SMB desk. Steel-man your decision in 90 seconds. Then I'll counter-argue (where was the risk you didn't see? what would Bella critique?).'
**best fit scope**:
Per-trade STRUCTURE (the 5-variable template fits every entry) + per-playbook performance review. Bellafiore's framework is the rare one that makes sense at BOTH ends of the scope-spectrum: each trade is decomposed via 5 variables, AND the aggregate of trades-per-play tells you which plays earn their keep. Best fit for our journal: ship 5 fields on every trade-entry modal (or 5 toggle-able checkbox-groups) + auto-aggregate per-play stats. For crypto-perps the framework adapts cleanly: Tape Reading -> DOM + liquidations + funding-rate-flip; Intraday Fundamentals -> token-unlock-news / TGE / CEX-listing.

_Uncertain fields_: Exact A/B/C grading rubric — synthesized from secondary sources / TraderLion summaries, may differ from Bellafiore's own definitions, Whether SMB itself uses any AI tooling internally in 2026 (likely yes given prop-firm tech adoption, but not publicly verified)

---

### Per-trade autopsy pattern
<a id='per-trade-autopsy-pattern'></a>

Tier **2**

> _Why researched_: Bestaande implementaties: TraderSync, TradeJournal.AI, MRT. Onze 🥇 backlog. Wat is de stand van de art?

#### AI-Features

**feature name**:
Common names: 'AI Trade Review' (generic), 'Cypher AI' (TraderSync), 'Zella Insights' (Tradezella, scoped to behaviors), 'AI Coach' (TradeJournal.AI / MRT), 'Trade Autopsy' (community term).
- **ai scope**: Per-trade — a single closed trade is the analysis unit.
**ai proactive vs reactive**:
Mostly REACTIVE (button: 'Review with AI'). Some (TraderSync Elite) push insights post-import. PROACTIVE per-trade is rare because it gets noisy fast at >5 trades/day.
**ai minimum trade threshold**:
Per-trade itself has no threshold (always n=1), but its USEFULNESS requires reference-data (the same setup's history, the user's prior trades). Without that context the AI produces generic advice.
**ai underlying tech**:
Mostly OpenAI GPT-4-class via vendor-hosted API. Tradezella details unclear. MRT Journal explicitly uses Claude. Some use classical-ML (Edgewonk's Edge Finder) layered with light NLG.
**output format**:
Text paragraph, structured-card with sections (What worked / What didn't / Next time), or chat-thread allowing follow-up questions.
**notable prompts**:
Examples reverse-engineered from output: (1) 'Analyse this trade. Was the entry timing aligned with the user's stated setup? What was the MFE-vs-realised gap? Suggest one improvement.' (2) Cypher-style: 'Compare this trade to the user's last 10 same-setup trades. Where does it fall in the distribution? Any rule-violation tags?' (3) Zella-style (narrower, behavior-focused): 'Detect any of {revenge-trade, overtrade, FOMO-entry, premature-exit, no-stop, oversized}.'

#### Playbook & Setup-Level

**setup level ai**:
Weak in most implementations — per-trade autopsy rarely connects upward to setup-level aggregation. Cypher AI and Zella Insights start to bridge this (e.g., 'most rule-violations happen in this setup, in afternoon sessions'), but the analysis unit remains the single trade.
**rule adherence scoring**:
Some implementations (TraderSync, Tradezella) flag 'non-adherent' but the rule-set is often shallow (max-risk-per-trade, max-trades-per-day) rather than per-setup playbook rules.

#### Coaching Depth

**coaching depth level**:
Mostly surface_metrics + light pattern-call-outs. Genuine deep_pattern_analysis (causal hypothesis + actionable next-step) is rare because n=1 prevents statistical claims, and the AI has to either be vague ('consider tighter stop') or invent context.

_Uncertain fields_: Exact internal prompts used by Cypher AI / Zella Insights / MRT — reverse-engineered from output, not from vendor documentation, User-retention numbers for per-trade autopsy features (no public data)

---

### Tradervue
<a id='tradervue'></a>

Tier **3** · [https://www.tradervue.com/](https://www.tradervue.com/)

> _Why researched_: Gevestigde tag-based, beperkte AI. Goede referentie voor traditionele journaling-flows.

#### Basis

- **founded**: 2011 (long-established, one of the oldest dedicated trading journals — owned by SureSwift Capital, Inc.)
**target market**:
Pro and serious retail equity/options/futures day-traders. 207,623+ traders. Strong US-equity focus with heavy DAS Trader / Interactive Brokers / TradeStation / Ameritrade integrations. Used by prop-firm-funded traders. Global English.
**pricing model**:
Freemium. Free tier (basic). Silver $29.95/mo (advanced analytics + unlimited trades), Gold $49.95/mo (adds MFE/MAE analysis + advanced reports). Alternative pricing breakdown: Basic $29/mo (1 account, 3 playbooks, 1GB storage), Premium $49/mo (unlimited accounts/playbooks, 5GB). Some sources list Essential $24/mo annual. No one-time / lifetime option.

#### AI-Features

- **feature name**: None — Tradervue has zero native AI features as of 2026.
**ai scope**:
N/A. No trade-analysis AI, no behavioral detection, no pattern recognition, no AI coaching, no automated insights. Pure classical analytics + manual journaling.
- **ai proactive vs reactive**: N/A. Analytics are reactive only (user generates reports). No AI push or chat.
- **ai minimum trade threshold**: N/A — no AI features.
- **ai underlying tech**: None.
**output format**:
Classical reports (tables, charts, calendar P&L view), TradingView charts auto-loaded per trade, MFE/MAE statistics tables, hourly heatmaps. No conversational AI, no natural-language summaries.
- **notable prompts**: N/A — no AI prompts (no AI feature). Manual journaling notes only.

#### Playbook & Setup-Level

**playbook concept maturity**:
named-strategy with rule-tracking (mid-maturity). Tradervue has a 'playbook' concept — users can create named strategies (Basic 3 playbooks, Premium unlimited) and tag trades against them. Performance is computed per playbook. No AI-coached promotion of setups.
**setup level ai**:
None. Setup-level analytics exist (per-tag stats, MFE/MAE per playbook) but no AI commentary or auto-suggestions. User manually inspects per-setup reports.
**rule adherence scoring**:
Limited — no automated rule-adherence score. User can tag mistakes manually and filter reports by tag. No quantified 'did you follow your playbook?' metric out of the box.
- **pre trade validation**: No. Strictly post-trade journaling and analysis. No pre-entry pressure-test of setups.
- **playbook template library**: No shared/pre-built template library. Users define their own playbooks from scratch.

#### Privacy & Stack

- **privacy model**: Vendor-hosted (web app). No own-API-key option (no AI). Subscription-based access — data tied to active subscription.
- **data residency**: Cloud (SureSwift servers).
- **cost per month user**: $29.95-$49.95/mo subscription. No additional AI cost (no AI). Annual discount via Essential tier $24/mo equivalent.

#### Crypto-Fit

**crypto perp exchange support**:
Weak. 80+ broker integrations but primarily equity/futures-focused. No first-class native support for Hyperliquid / Blofin / MEXC / Bybit perps. Crypto would be via generic CSV upload only.
- **multi asset**: Stocks (primary), options, futures, forex. Crypto via CSV only. Strong equity/options coverage.
- **funding rate context**: No (not crypto-focused).
**gap session breakdown per setup**:
Per-playbook + per-hour reports exist (e.g., 'this trader loses most from lunch to PH'), but not the 'per-setup × per-session WR matrix' KILLER feature in the exact form described. Manual cross-tagging required.

#### Coaching Depth

**coaching depth level**:
surface_metrics only. Strong on classical metrics (profit factor, win/loss ratios, hourly performance, MFE/MAE, balance/drawdown) but no causal explanation or action recommendations. User must interpret reports themselves.
**psychology metrics**:
None automated. Users can manually tag emotions/mistakes (revenge, FOMO, overtrading, early exit) via custom tags and review aggregated stats. No tiltmeter / discipline score / revenge-detection auto-feature.
- **voice journaling**: No. Text journal notes only.
**mentor mode**:
Limited — shared trades feature lets traders share specific trade reviews publicly. No formal coach-review-student-stats workflow.

#### Community

- **community driven ai**: No AI to share. Community-shared trades for educational viewing exist but not collective AI insights.

_Uncertain fields_: partial_close_awareness, changelog_ai_velocity

---

### Chartlog
<a id='chartlog'></a>

Tier **3** · [https://chartlog.com/](https://chartlog.com/)

> _Why researched_: Strategy rules + AI-feedback. Minder pubblicke detail, snelle scan.

#### Basis

**founded**:
2019 (founders Adrian Campos and Igor Milivojevic). Note: a separate but related domain chartlog.ai launched 2025-2026 as an AI-first product positioning. The .com brand remains an active equity-trader journal; this entry primarily references the original chartlog.com.
**target market**:
Active US equity day-traders and options traders. Endorsed by Max Madaz (madazmoney.com), Andrew Aziz (BearBullTraders), and Ed Martin (averagejoetrader.com). Retail prosumer. The newer chartlog.ai brand targets European/global retail with multi-asset (DAX, S&P, Forex, crypto).
**pricing model**:
Chartlog.com: Lite $14.99/mo ($13.49/mo annual), Standard $29.99/mo ($25.49/mo annual), Pro $39.99/mo ($31.99/mo annual). 7-day free trial. Chartlog.ai (separate): Free (15 trades/mo, 5 AI analyses/mo), Trader EUR 19/mo (unlimited trades + AI Coach + 50 AI analyses), Pro EUR 39/mo (unlimited AI + multi-account).

#### AI-Features

- **feature name**: Chartlog.com: none. Chartlog.ai: AI Coach + Trade Replay AI + Morning Brief + Evening Review.
**ai scope**:
Chartlog.com: no AI. Chartlog.ai: per-trade (Trade Replay scores entry/risk/exit out of 10), per-period (Morning Brief generated from last trades, Evening Review closes loop), per-trader (AI Coach knows full history and adapts to style/strategy).
**ai proactive vs reactive**:
Chartlog.ai is hybrid leaning push: Morning Brief auto-generated each session (push), Trade Replay auto-runs after each trade save (push), AI Coach chat is pull. Chartlog.com is pure analytics (no AI push).
**ai underlying tech**:
Chartlog.ai explicitly uses Claude by Anthropic ('one of the most capable AI models available today, adapted specifically for trading analysis'). Chartlog.com has no AI.
**output format**:
Chartlog.ai: AI chat (conversational), Trade Replay (scored card with concrete improvement tips, 0-10 scale per dimension), Morning Brief (focus point + warning signals + one lesson), Discipline score, hourly heatmap (e.g., 'You lose 75% of trades 14h-15h. Avoid this window'), AI-filled forms from screenshot uploads. Chartlog.com: classical dashboards + TradingView charts.
**notable prompts**:
Documented chartlog.ai examples: 'Why do I keep exiting early?' (AI replies: 'Looking at your trades, 73% of early exits happen after a quick initial move of 0.5R. This suggests anxiety about giving back profits. Consider setting your SL to breakeven after 0.8R instead of exiting...'). Also: 'Your win rate on Sc.1 is 78% — your strongest setup. However, you're exiting 0.8R early on average. On your last 5 trades, trailing after 1R would have added +4R total.' AI Coach 'Latest insight' example: 'Discipline +1.4pts this week. Early exits still your main leak — avg +0.8R left on table. Try trailing after 1R.'

#### Playbook & Setup-Level

**playbook concept maturity**:
Chartlog.com: tag-only with named strategies (Standard tier adds strategy tracking with per-strategy performance). Chartlog.ai: structured-rules approaching AI-coached — each trade specifies indicator/strategy, AI adapts its analysis to that strategy, and a Trading Plan lives in the app with Morning Brief keeping it top of mind.
**setup level ai**:
Chartlog.ai computes per-strategy ('Scenario') stats with AI commentary — e.g., 'Sc.1 win rate 78% — strongest setup'. AI gives specific per-setup trailing/exit tips. Chartlog.com has per-strategy performance but no AI commentary.
**rule adherence scoring**:
Chartlog.ai has explicit 'Discipline' score (e.g., 8.2/10) tracking week-over-week deltas. Chartlog.com has no discipline score.

#### Privacy & Stack

**privacy model**:
Chartlog.ai: vendor-hosted (Supabase with row-level security). No own-API-key option for AI (uses vendor's Anthropic Claude integration). Chartlog.com: vendor-hosted.
**cost per month user**:
Chartlog.com: $14.99-$39.99/mo. Chartlog.ai: free (15 trades + 5 AI/mo), Trader EUR 19/mo (~$20.50), Pro EUR 39/mo (~$42). AI included in tier — no additional API surcharge.

#### Crypto-Fit

**crypto perp exchange support**:
Chartlog.com: ~10 US stock/options brokers only (no crypto). Chartlog.ai: Binance listed; broader 'crypto' mentioned but no Hyperliquid/Blofin/MEXC specifics. Compatible with MetaTrader 4/5, TradingView, Interactive Brokers, NinjaTrader, ProRealTime, Binance.
**multi asset**:
Chartlog.com: US stocks + options primarily. Chartlog.ai: indices (DAX, S&P500, Nasdaq, CAC40, FTSE), stocks, Forex, crypto, commodities — 'if you can trade it, you can journal it'.
**gap session breakdown per setup**:
Chartlog.ai has 'Performance Heatmap — Win rate by hour' (Mon-Fri × hour grid) at trader level. Per-strategy × per-session combined breakdown is not the marketed killer feature, though per-strategy stats exist.

#### Coaching Depth

**coaching depth level**:
Chartlog.com: surface_metrics. Chartlog.ai: deep_pattern_analysis — AI explains causally (e.g., '73% of early exits happen after a 0.5R move = anxiety') and gives concrete action ('Set SL to BE after 0.8R').
**psychology metrics**:
Chartlog.ai has Discipline score (auto-computed), emotion logging per trade, anxiety/early-exit pattern detection. Less explicit emotion-tagging taxonomy than Plancana, more behavior-pattern AI inference.
- **mentor mode**: No formal coach-review-student feature.

#### Community

**community driven ai**:
Referral program (10 referrals = free subscription) and content creator affiliate program (20% recurring commission). No collective AI insights or shared templates.

_Uncertain fields_: ai_minimum_trade_threshold, pre_trade_validation, playbook_template_library, data_residency, partial_close_awareness, funding_rate_context, voice_journaling, changelog_ai_velocity

---

### MM Platinum
<a id='mm-platinum'></a>

Tier **3** · [https://www.minervini.com/mm-platinum](https://www.minervini.com/mm-platinum)

> _Why researched_: Mark Minervini's journal, methodology-driven. US-stocks focus.

#### Basis

**target market**:
Pro/serious US equity swing-traders following Mark Minervini's SEPA / VCP methodology. US Investing Champions audience. High-net-worth retail. Strongly USA-stocks-focused. Not for crypto/futures/forex/options day-traders.
**pricing model**:
Subscription only — very premium. Annual: $499/mo billed as 2x $2,994 installments ($5,988/yr). Quarterly: $699/mo ($2,097 quarterly). Monthly trial: $999/mo. Minervini Private Access membership is included in Minervini Markets 360. The Master Trader Program live workshop is separately priced (typically several thousand dollars).

#### AI-Features

- **feature name**: MAI (Minervini AI) + TradeGrader + TradingLogger Analytics + MonAlert
**ai scope**:
Per-stock (MAI interprets behavioral patterns + chart price action + delivers real-time stock-specific commentary); per-trade (TradeGrader post-analyzes individual trades, identifying what was done right/wrong); per-period (TradingLogger gives expectancy/win-loss efficiency/consistency metrics).
**ai proactive vs reactive**:
Hybrid. MonAlert + MAI push real-time confirmations/violations + behavioral commentary as price action unfolds. TradeGrader is reactive (post-trade grading). User-initiated chat with MAI for specific stock queries.
- **ai minimum trade threshold**: Not stated; MAI works on individual stock charts (no portfolio sample needed). TradeGrader works trade-by-trade.
**output format**:
Real-time stock-specific written commentary (MAI), TradeGrader scorecards per trade with grade + specific feedback, MonAlert visual annotations on chart (Mark's Fab 5 Rankings), TradingLogger statistical tables (expectancy, win/loss efficiency).

#### Playbook & Setup-Level

**playbook concept maturity**:
named-strategy / rule-adherence-scored — the Minervini methodology IS the playbook. Single named strategy (SEPA + VCP + Trend Template) with hard rules (e.g., 50/150/200 MA stack, 30% from 52w high, 25% above 52w low, 1.5+ EPS growth). TradeGrader scores adherence to these rules.
**setup level ai**:
MAI operates at setup level (per-stock pattern recognition for VCP / pivot points / Fab 5 leadership). It is essentially a 'setup detector + reviewer' for one specific methodology. Highly opinionated — does not learn the user's own setups (vs TSB/Chartlog.ai which adapt to user's strategy).
**rule adherence scoring**:
Yes via TradeGrader — explicit per-trade grading that 'pinpoints exactly what you did right and where you went wrong' and 'reinforces strengths, eliminates costly habits'. Scoring is against the Minervini ruleset.
**pre trade validation**:
Yes — MAI + MonAlert evaluate stocks in real-time before entry against SEPA/VCP criteria. MonAlert flags Mark's confirmations and violations as they happen, helping decide if a stock is constructive or warning. This is one of the strongest pre-trade validation features in the cohort.
**playbook template library**:
Mark Minervini's personal stock screens are bundled (high-momentum criteria, fresh IPOs, etc.) — essentially Minervini-curated setup templates. Not user-shareable templates; these are vendor-curated.

#### Privacy & Stack

**privacy model**:
Vendor-hosted only. No own-API-key. Full vertical integration — broker linkage for portfolio management dashboard. Premium SaaS.
**cost per month user**:
$499-$999/mo depending on commitment. MAI + TradeGrader + TradingLogger + MonAlert all bundled in one premium price — no separate AI surcharge. By far the most expensive in this cohort.

#### Crypto-Fit

- **crypto perp exchange support**: None. US equity-only platform. No crypto, no futures, no forex.
- **multi asset**: US stocks only (long and possibly short via stock screener). No options/futures/forex/crypto.
- **funding rate context**: N/A — not crypto.
- **gap session breakdown per setup**: N/A — US equity swing-trading (not session-relevant in crypto-perp sense). Stage-based pattern analysis instead.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis — but constrained to the Minervini methodology. MAI + TradeGrader give causal feedback within SEPA/VCP framework. If you trade by Mark's rules, it's deep; if you trade differently, it doesn't generalize. Also includes Live Weekly Q&A with Mark Minervini personally + ongoing mentorship structure.
**mentor mode**:
Strongest in cohort for human-mentor: Live Weekly Q&A with Mark Minervini, real-time market commentary, daily buys/sells from Mark, structured SEPA lessons. This is half-platform / half-mentorship-program.

#### Community

**community driven ai**:
Member community via Private Access + Gala event. Shared methodology (Minervini's SEPA) is the unifying playbook. AI itself is not community-shared — each user gets their own MAI instance.

_Uncertain fields_: founded, ai_underlying_tech, notable_prompts, data_residency, partial_close_awareness, psychology_metrics, voice_journaling, changelog_ai_velocity

---

### Deltalytix
<a id='deltalytix'></a>

Tier **3** · [https://www.deltalytix.app/](https://www.deltalytix.app/)

> _Why researched_: Nieuwere AI-native speler met open GitHub repo (interesse: hoe bouwen ze AI?).

#### Basis

**founded**:
2023 (open-source on GitHub by Hugo Demenez, hugodemenez/deltalytix repository; TypeScript, CC-BY-NC-4.0 license; ~112 stars as of 2026)
**target market**:
Futures traders specifically (Rithmic, Tradovate, NinjaTrader, Quantower, Topstep, Thor copier). Heavy prop-firm-futures focus. Engineering-friendly (open-source, GitHub). Global, English. Smaller community than TradeZella/Tradervue but transparent and developer-trusted.
**pricing model**:
Freemium with strong free tier. Basic: free (multiple accounts, 14 rolling days of data storage, basic CSV imports, all core AI features). Plus: paid (monthly/quarterly/yearly with a 'lifetime access' limited-time one-time payment option — actual prices appear dynamically loaded and not visible in static scrape; redacted as $000$000 placeholders in HTML). Plus adds unlimited accounts, unlimited data storage, chat with data using advanced AI models. [uncertain on exact Plus pricing]

#### AI-Features

- **feature name**: AI Trading Coach + AI-Powered Journaling + AI Data Analytics + 'Chat with your data'
**ai scope**:
Per-trade (AI-assisted journal entries analyze for emotional patterns + biases), per-period (pattern identification, note-taking summaries), per-portfolio (chat with full data using LLM). Data-aware conversations.
**ai proactive vs reactive**:
Hybrid. Push: AI auto-analyzes journal entries for emotional patterns + biases, generates summaries, identifies patterns. Pull: Chat-with-data interface lets user query trading history in natural language.
**output format**:
Conversational chat with data, AI-generated journal summaries, pattern-identification cards, interactive charts/graphs, calendar view (daily/weekly P&L with high-impact news filter), drag-and-drop dashboard widgets.

#### Playbook & Setup-Level

**playbook concept maturity**:
tag-only / approaching named-strategy. Advanced tagging is a Basic feature. No explicit 'playbook with promotion rules' like TSB. AI helps with pattern identification but no rule-adherence scoring system marketed.

#### Privacy & Stack

**privacy model**:
Hybrid leaning vendor-hosted, but with strong privacy posture. Open-source codebase (auditable). Rithmic credentials stored locally on user's computer (not on vendor servers) for security reasons — sync engine accesses them only when user is connected. Tradovate uses OAuth (read-only). Thor uploads via user-controlled software. Local-only option under development.
**data residency**:
Cloud (vendor servers) for synced trade history. Rithmic credentials stay local. Plus plan: 'Cloud storage guaranteed for 1 year, then subject to availability'. GitHub repo enables self-hosting (advanced users).

#### Crypto-Fit

**crypto perp exchange support**:
None native. Pure futures focus (Rithmic, Tradovate, NinjaTrader). No Hyperliquid/Blofin/MEXC/Bybit/Binance support. Crypto would be via generic CSV only.
**multi asset**:
Futures (primary, native sync). Some support for any CSV-importable asset class but not marketed. No stocks/options/forex/crypto native.
- **funding rate context**: N/A — not crypto.
**gap session breakdown per setup**:
Calendar view with Max Profit & Max DD by week + daily impact-filtered news, plus decile statistics. Per-setup × per-session not explicitly marketed.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis on the journaling side (AI analyzes entries for emotional patterns + biases); approaches surface_metrics on the analytics side (interactive charts/graphs/calendar — user-driven interpretation).
- **mentor mode**: Discord community for peer discussion. Open-source contribution model. No formal coach-review-student feature.

#### Community

- **community driven ai**: Discord community + GitHub repo for open-source contributions. AI itself is per-user, not community-shared.

_Uncertain fields_: ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, setup_level_ai, rule_adherence_scoring, pre_trade_validation, playbook_template_library, cost_per_month_user, partial_close_awareness, psychology_metrics, voice_journaling, changelog_ai_velocity

---

### TradeFuse
<a id='tradefuse'></a>

Tier **3** · [https://tradefuse.app/](https://tradefuse.app/)

> _Why researched_: Real-time broker import + Compare & Conquer multi-metric. Freemium. AI-insights light.

#### Basis

**founded**:
Existed pre-2024; AI-powered trading journal repositioning launched July 2025 per LinkedIn announcement. App URL is tradefuse.app (homepage), logbook.tradefuse.app (web app), with Auth0 authentication. Note: Cloudflare protection blocked direct scraping of the homepage during research; information assembled from secondary sources (SourceForge, Slashdot, Tradervue/TradeZella/JournalPlus comparison articles, official LinkedIn announcement).
**target market**:
Multi-asset retail traders (MetaTrader 4/5, Robinhood, Tradovate). 'Gold Standard Trading Journal' marketing positioning. Discord-friendly (Discord login supported via Auth0). Global English.
**pricing model**:
Free sign-up with no credit card required. Paid tier(s) exist but exact pricing not publicly transparent in available sources. [uncertain — likely freemium with paid pro tier]

#### AI-Features

- **feature name**: QuantumQuery (custom fine-tuned AI)
**ai scope**:
Per-portfolio (QuantumQuery answers any question about trading journal data — metrics, graphs, comparisons, analysis, even general trading questions). Open-domain conversational analytics over user's data.
**ai proactive vs reactive**:
Pull-only (reactive). User asks QuantumQuery questions; AI delivers answers in seconds. No push notifications or scheduled AI reviews marketed.
**output format**:
Conversational chat (QuantumQuery), customizable dashboard with pinnable metrics + graphs, calendar (monthly P/L by day with notes + trade counts + strategies), Compare & Conquer side-by-side metric comparison reports, Monte Carlo simulator projections, TradingView integration for chart-with-trade overlay.

#### Playbook & Setup-Level

**playbook concept maturity**:
tag-only with named strategies. Trades can be tagged with strategies, mistakes, custom tags. Compare & Conquer enables side-by-side strategy comparison. No promotion-rule / playbook-maturity scoring system marketed. No AI-coached promotion of setups.
**setup level ai**:
QuantumQuery can answer per-strategy questions on demand (pull), but doesn't push setup-level insights or maintain a setup-evidence ledger. Less opinionated than TSB / Chartlog.ai.
- **pre trade validation**: No. Post-trade only. Monte Carlo simulator projects forward outcomes but not pre-trade pressure-test.

#### Privacy & Stack

**privacy model**:
Vendor-hosted (web app on logbook.tradefuse.app). Auth0 authentication. No own-API-key option visible. Cloudflare-protected.

#### Crypto-Fit

**multi asset**:
Marketing claim: 'built for all asset classes'. Native integrations skew stocks/forex/futures (MT4/MT5 + Robinhood + Tradovate). Options not explicitly emphasized.
**gap session breakdown per setup**:
Compare & Conquer enables custom side-by-side comparisons across strategies/mistakes/days-of-week. Per-setup × per-session breakdown is possible via custom comparisons but not pre-built.

#### Coaching Depth

**coaching depth level**:
Approaches deep_pattern_analysis via QuantumQuery (open-Q&A on data) but is fundamentally reactive — depends on user knowing what to ask. No proactive coaching, no auto-generated insights, no causal explanations pushed.
- **mentor mode**: No formal coach-review-student feature.

#### Community

**community driven ai**:
Discord-login support implies community presence; no shared-AI templates or collective insights model. QuantumQuery is per-user.

_Uncertain fields_: ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, rule_adherence_scoring, playbook_template_library, data_residency, cost_per_month_user, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, psychology_metrics, voice_journaling, changelog_ai_velocity

---

### Trader Sage
<a id='trader-sage'></a>

Tier **3** · [https://tradersage.ai/](https://tradersage.ai/)

> _Why researched_: US-broker focus (IBKR/Schwab/Fidelity/Tasty). Generic AI-insights.

#### Basis

**target market**:
US-equity stock + options retail traders. Heavy options-strategy focus (Iron Condors, Spreads auto-detection). Primarily Interactive Brokers / Schwab / Fidelity / Tasty Trade / Tradovate users. Not for crypto-perp / forex / futures-only traders.
**pricing model**:
Freemium. Basic: free (1 import source, 3 statement uploads/month, basic stats, automatic spread detection). Pro: $10/mo or $100/yr (save 17%) — unlimited import sources + unlimited statement uploads + Broker Sync + technical/fundamental analysis stats + daily journal + AI insights.

#### AI-Features

- **feature name**: AI Insights + Automatic Trade Tagging + Smart Option Strategy Detection
**ai scope**:
Per-trade (automatic tagging based on technical + fundamental analysis; auto-detects option spreads), per-portfolio (AI Insights analyze complete trading history for patterns + recommendations).
**ai proactive vs reactive**:
Push leaning. AI auto-tags each trade on import (push). AI continuously 'keeps suggesting areas you can improve' (push). User can also view AI Insights on demand (pull).
**output format**:
Auto-applied tags on trades (technical + fundamental classification), AI Insights cards (personalized recommendations), calendar view (weekly performance), comprehensive analytics dashboard, option-strategy groupings.

#### Playbook & Setup-Level

**playbook concept maturity**:
tag-only — but with AI auto-tagging based on technical + fundamental analysis (vs user-defined tags). Tag your setups and analyze them. Not a structured-rules / promotion-rule playbook system.
**setup level ai**:
AI automatically groups trades by detected technical pattern + fundamental setup. Per-setup performance can then be analyzed. Smart Option Strategy Detection groups multi-leg trades automatically — important for options traders.

#### Privacy & Stack

**privacy model**:
Vendor-hosted only. Bank-level encryption in transit + at rest. Enterprise-grade cloud infrastructure with regular security audits. No own-API-key option for AI.
- **cost per month user**: $10/mo Pro tier ($100/yr). AI Insights included — no separate API surcharge. Cheapest AI-bundled tier in this cohort.

#### Crypto-Fit

**crypto perp exchange support**:
None. Stocks + options brokers only (Interactive Brokers, Schwab, Fidelity, Tasty Trade, Tradovate). 'We support stocks and options trading on the following brokers'. No crypto/forex/perp.
**multi asset**:
Stocks + options (primary). Futures via Tradovate. Complex option strategies (Iron Condors, Spreads) auto-detected — strong options coverage. No crypto/forex.
- **funding rate context**: N/A — not crypto.
**gap session breakdown per setup**:
Calendar view (weekly performance) + 'Comprehensive Analysis'. Per-setup × per-session not explicitly marketed for stocks (less relevant than for crypto/forex).

#### Coaching Depth

**coaching depth level**:
Approaches deep_pattern_analysis via AI Insights (identifies successful patterns + pitfalls + provides personalized recommendations) but stays at surface_metrics for most dashboards. Best-in-cohort for options-strategy classification.
- **mentor mode**: No formal coach-review-student feature.

#### Community

- **community driven ai**: No shared-AI templates or collective insights model marketed. Per-user analytics.

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, notable_prompts, rule_adherence_scoring, pre_trade_validation, playbook_template_library, data_residency, partial_close_awareness, psychology_metrics, voice_journaling, changelog_ai_velocity

---

### Tradexis
<a id='tradexis'></a>

Tier **3** · [https://www.tradexis.ai/](https://www.tradexis.ai/)

> _Why researched_: R-multiple en expectancy optimization focus. Beperkt publiek detail.

#### Basis

**target market**:
Prop-firm traders (explicit support for FTMO, MyFundedFx, TopStep — eval + challenge tracking is a headline feature), index-futures day-traders (NAS100, NQ, ES, YM, RTY, EURUSD, GBPUSD, BTCUSD streamed in ticker). Smart-money-concepts (SMC) crowd (FVG, BOS, OB, BSL terminology throughout marketing). Global English.
**pricing model**:
Free during beta. Pro tier 'coming' — pricing TBD. Prop-trader plan included in Pro when released. Notify-me list for Pro launch.

#### AI-Features

- **feature name**: Pre-Trade Mirror + AI Journal + Drill Mode (the three core pillars) — backed by a unified AI 'trained on you'
**ai scope**:
Per-trade (Pre-Trade Mirror fires verdict before the click; AI Journal generates per-trade behavioral insight); per-pattern (Drill Mode queues targeted practice for detected weakness patterns); per-portfolio (one AI engine spans backtest + live + prop accounts).
**ai proactive vs reactive**:
Strongest PUSH model in the cohort. Pre-Trade Mirror auto-fires the moment the user's cursor reaches BUY/SELL — surfaces one-line verdict from their own history. Drill Mode auto-queues practice when weakness detected. Most explicitly real-time-coaching positioning of any item.
**output format**:
Single-line pre-trade verdicts ('3L streak. Avg R after 2+ losses: -1.4R across 11 trades. Pause.'), AI Journal entries with one-line plain-English insight per trade ('You enter 3x faster in losing sessions', 'Counter-trend after 2pm: 18% win rate', 'You've left +1.2R avg on the table by exiting early'), Drill Mode queue (20-rep targeted practice sessions), Prop account compliance dashboard (daily loss / max DD / days remaining + AI compliance commentary).
**notable prompts**:
Strongest published prompt examples in cohort. Real verdicts include: '3L streak. Avg R after 2+ losses: -1.4R across 11 trades. Pause.' — 'You enter 3x faster in losing sessions. This was trade #4 today.' — 'Counter-trend after 2pm: 18% win rate.' — 'You've left +1.2R avg on the table by exiting early.' — 'You've blown 2 previous challenges on trade #4 of day 3.' — 'FVG+BOS long: 14 trades, 71% win, avg +2.3R. Send it.' Pattern: single-line specific number + verb (Pause / Send it / Skip). Drill Mode prompts queue specific weakness contexts ('Wick traps: 8 losses in last 20 similar setups. Start drill · 20 reps').

#### Playbook & Setup-Level

**playbook concept maturity**:
AI-coached / approaching rule-adherence-scored. Setups (FVG+BOS, OTE, etc.) get per-setup verdicts with sample/WR/avgR. Backtester scan engine detects setups automatically. The AI verdicts effectively ARE the playbook coaching — 'you keep losing on context X, so drill it'.
**setup level ai**:
Strongest setup-level AI in cohort. Pre-Trade Mirror compares the current context to ALL similar past contexts ('11 similar trades') and produces a specific R/WR verdict before entry. AI Journal entries are per-setup verdicts. Scan engine on backtester detects setups by name (FVG, BOS, OB, BSL, OTE).
**rule adherence scoring**:
Prop-account view shows compliance tracking ('Daily Loss: -$0/$500', 'Max DD: -$340/$1000', 'Days: 7/30') with AI commentary linking past challenge failures to specific behavioral triggers. Implicit consistency score. Drill Mode threshold-scoring ('run until your score crosses the threshold').
**pre trade validation**:
STRONGEST in cohort. Pre-Trade Mirror is the headline feature — 'before you click' real-time verdict from user's own history. 'The moment your cursor reaches BUY or SELL, Tradexis checks your entire trade history for similar contexts and surfaces one line.' Explicitly designed as the differentiator vs TradingView/Edgewonk ('TRADINGVIEW DOESN'T KNOW YOUR STREAK. EDGEWONK CAN'T STOP YOU IN TIME. TRADEXIS FIRES BEFORE THE CLICK').

#### Privacy & Stack

- **privacy model**: Vendor-hosted (web app). No own-API-key option visible. Beta phase — privacy specifics not yet detailed.

#### Crypto-Fit

**multi asset**:
Index futures (NQ, ES, YM, RTY, NAS100), forex (EURUSD, GBPUSD), BTC mentioned. Prop-firm-eval focused (forex/futures CFDs). Not options/stocks-native.
**gap session breakdown per setup**:
Strong. AI Journal entries explicitly call out session-specific patterns ('Counter-trend after 2pm: 18% win rate', 'NY_OPEN', 'NY_MID', 'LONDON' sessions tagged on every trade). Combined with named setups (FVG+BOS), per-setup × per-session is implicit in the verdicts. Probably the closest in this cohort to the 'BOS+FVG: 62% WR London vs 38% NY' killer feature.

#### Coaching Depth

**coaching depth level**:
deep_pattern_analysis. Marketing positioning: 'Most platforms record what happened. Tradexis records why.' AI doesn't summarize — it finds specific conditions where user loses money and tells them in plain language. Causal + actionable + specific numbers in every verdict.
- **mentor mode**: No human coach-review feature. AI-only coaching.

#### Community

**community driven ai**:
Per-user AI ('One AI, trained on you'). No shared-AI templates or collective insights model — explicitly anti-generic ('No generic advice. Ever.').

_Uncertain fields_: founded, ai_minimum_trade_threshold, ai_underlying_tech, playbook_template_library, data_residency, cost_per_month_user, crypto_perp_exchange_support, partial_close_awareness, funding_rate_context, psychology_metrics, voice_journaling, changelog_ai_velocity

---
