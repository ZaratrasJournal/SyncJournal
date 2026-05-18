# Playbook-coaching AI voor TradeJournal — Research & v1-spec aanbeveling

**Datum**: 2026-05-18
**Source**: [`playbook-coaching-ai/report.md`](../playbook-coaching-ai/report.md) — 28 items volledig onderzocht (10 Tier-1, 11 Tier-2, 7 Tier-3 + 4 frameworks + 4 patterns)
**Doel**: backlog-entry "Playbook-coaching AI" uitwerken naar concrete v1-spec

---

## 🎯 Executive Summary

**De gap bestaat écht en is verdedigbaar.** Het marktlandschap heeft ~20 AI-flavored trading-journals, maar **niemand combineert structured-playbook + LLM narrative + crypto-perp + partial-close awareness**. Onze positie:

- **6-12 maanden window** voordat competitors deze quadrant claimen (uit batch-3 onderzoek)
- **Stack-trend bevestigd**: 4 moderne AI-journals gebruiken Claude (TradeJournal.AI, MRT Journal, TradeOS, Chartlog.ai). Onze Anthropic-keuze zit in het juiste kamp.
- **Pre-trade validation is NIET volledig green-field**: Tradexis ("Pre-Trade Mirror") en TradeJournal.AI ("Ask AI pressure-test") hebben het al — maar **niet voor crypto-perp**.
- **Onze unieke combo voor v1**:
  > **Auto pre-trade validation + crypto-perp + multi-TP partial-close awareness + funding-rate context + session-aware cadence**

---

## 📊 Competitive Landscape (top 8 relevant)

| Tool | Playbook maturity | Pre-trade AI | Crypto-perp | AI-stack | Sterkte voor ons |
|---|---|---|---|---|---|
| **TradeOS (Wyckofflabs)** | structured-rules + 0-10 setup-grading | Indirect (Smart Alerts) | ✅ Blofin/Hyperliquid/Bybit/Binance/Bitget (geen MEXC) | Claude Sonnet | Onze meest directe concurrent qua exchange-overlap |
| **JournalPlus** | structured-rules + NL-chat | ❌ | ❌ CSV-only | Niet disclosed | Sterkste NL-chat ("What's WR on morning breakouts when VIX>20?") |
| **TraderSync Cypher AI** | rule-adherence-scored + push-alerts | ❌ | ❌ Binance/Bybit/Coinbase (geen Hyperliquid/Blofin) | Niet disclosed | Enige geshipte proactive coach ($79.95/mo Elite) |
| **TradeJournal.AI** | AI-coached (hoogste in cohort) | ✅ "Ask AI pressure-test" button | ❌ | Claude Sonnet + own-key | Pioneer pre-trade UX, inspiratie voor onze versie |
| **RizeTrade** | rule-adherence-scored (foundation) | ❌ | ❌ | Geen AI | Beste compliance-scoring (% per playbook), foundation voor elk AI |
| **MRT Journal** | structured-rules + Claude Q&A | ❌ | ❌ | Claude (expliciet) | Bewijst dat Claude direct-call met own-key werkt |
| **Tradingtick** | rule-adherence-scored + 101 psych quizzes | Rule-based (geen AI) | ❌ | Pre-launch | Gamification-angle uniek, lifetime-pro early bird |
| **Tradexis** | AI-coached + Pre-Trade Mirror | ✅ Auto (geen knop) | ❌ | Niet disclosed | **Strongest pre-trade UX**: auto-verdict voor click |

**Bevestigingen**:
- **TradeZella's Zella AI is NIET geshipped** (waitlist mei 2026 — marketing-claim ≠ productie)
- **Tradervue heeft 0 AI features** (gevestigde speler die de boot mist)
- **MEXC is door geen enkele tool gedekt** — versterkt onze niche-positie
- **Partial-close as first-class concept**: alleen TradesViz + Tradezella expliciet (rest "post-import-derived")
- **Funding-rate context in setup-AI**: ZÉRO journals doen dit

---

## 🧠 Framework-translatie naar AI-prompts

Vier coaching-frameworks geven gestructureerde substraat voor onze AI-prompts:

| Framework | Bijdrage aan onze v1 |
|---|---|
| **Bellafiore (One Good Trade / SMB)** | **Meest AI-vriendelijk**. Z'n 5-variable PlayBook (Big Picture / Tape / Reading / Setup / Exits) is letterlijk de template-structuur voor onze playbook-objecten + pre-trade validation. |
| **Van Tharp (System Development)** | **Wiskunde-laag**. R-multiples / SQN / expectancy-per-setup geven coachable signals zodra je geaggregeerd hebt. |
| **Brett Steenbarger (Solution-focused)** | **Cadans + tone**. Weekly Best-Trade-of-Week ritueel + monthly strength-mining. Tone: "do-more-of-what-works" i.p.v. punish-mistakes. |
| **Mark Douglas (Trading in the Zone)** | **Pre-trade gate**. Probabilistic-mindset acceptance vóór entry. AI vraagt: *"Heb je geaccepteerd dat deze trade kan verliezen?"* |

**Concrete prompt-templates** (uit batch-3 onderzoek, voor implementatie):
- **Pre-trade (Bellafiore + Douglas)**: *"Loop de 5 SMB-variabelen langs voor deze setup [BOS+FVG, BTC/USDT, London-session]: Big Picture / Tape / Reading / Setup / Exits. Mark elke als ✓/✗/?. Voeg Douglas-vraag toe: heb je deze verliesscenario geaccepteerd?"*
- **Per-setup wekelijks (Tharp + Steenbarger)**: *"Per playbook deze week: R-multiple distributie, SQN, expectancy-delta vs vorige periode. Top winning trade + 3 vragen Steenbarger-style: welke entry-trigger / waarom durfde je deze size / wat maakte dit pivotal?"*
- **Tilt-gate (Douglas + Tharp)**: *"Na 2+ verlies in 24u: pause-suggestie. Avg R na 2L is -1.4R in 11 historische cases. Voor je entry, herschrijf je 5 fundamentele truths."*

---

## 💎 Onze defensible niche — v1 feature-shortlist

### **Tier-A: must-have voor v1** (haalbaar in 2-3 weken)

1. **Auto pre-trade validation** (à la Tradexis)
   - Trigger: bij open van TradeForm met playbookId gevuld
   - Input: huidige playbook + laatste 20 same-setup trades + actuele session/dag/funding-context
   - Output: kort verdict-blok bovenaan modal — *"Avg R deze setup op vrijdag-NY: +0.8R (8/12 wins). Funding -0.05%/8h. Discipline-score deze week: 78%."* + Bellafiore-5-check ✓/✗/?
   - Niet-blokkerend (informationeel), niet "trade wordt geweigerd"

2. **Per-playbook AI weekly digest** (à la Edgewonk Edge Finder + Steenbarger Best Trade)
   - Trigger: zondag 18:00 CET (NY-close), notification met digest
   - Input: alle trades vorige week met R-data, gegroepeerd per playbook
   - Output: 1-2 paragraaf per top-3 playbooks — *"Je BOS+FVG: 6 trades, 67% WR, +1.4R avg. Best moment: London opening 09:00-10:00 (3/3 wins, +2.3R). Steenbarger-vragen voor top-trade: …"*
   - Save als notitie in nieuw `tj_ai_weeklies` localStorage

3. **Crypto-context augmentation** (geen concurrent doet dit)
   - Funding rate per trade (huidige + 8h gemiddeld) auto-fetch via Worker
   - Session-tag automatisch (Asia/Europe/US — niet stock-exchange hours)
   - Liquidation cluster context (optioneel, complexer)

### **Tier-B: nice-to-have v1.5**

4. **Playbook-promotion system** (à la TSB)
   - Setups starten als "testing", auto-promoten naar "active" bij N trades + edge-criteria
   - Drift-detection: bij degradatie van active-setup → "warning" status

5. **Voice-pre-trade journaling** (à la Process Trader)
   - 30-sec voice memo vóór entry, transcribed via Web Speech API
   - Auto-attach aan trade als entryNote
   - AI mood-detection uit transcript

6. **Setup × session breakdown matrix** (à la "BOS+FVG: 62% WR London vs 38% NY")
   - 2D-grid in Analytics: setups × sessions met WR/avgR cell-coloring
   - Klik = drill-down naar de trades

### **Tier-C: na v1 (apart project)**

7. **Mentor mode** (à la Tradezella) — community-leden delen anonymized playbook-stats voor peer-review
8. **Pre-trade pressure-test button** (à la TradeJournal.AI) — extra zware analyse "is dit nu écht een goed moment?"

---

## 🛠 Stack-keuze: Claude via own API-key (BYOK)

**Onderbouwing**:

| Optie | Pros | Cons | Verdict |
|---|---|---|---|
| **(A) BYOK — user-supplied Anthropic API key** | Privacy (data → user's eigen Anthropic-account), geen kosten voor ons, in lijn met 4 competitor-trend (TradeJournal.AI, MRT, TradeOS, Chartlog.ai) | Sluit non-techies uit (moet API-key plakken), onboarding-friction | **✅ Aanbevolen voor v1** |
| **(B) Shared Cloudflare Worker met community-budget** | Geen onboarding-friction, 1-klik adoption | Kosten per active user (~$5-15/mo bij realistic gebruik), wij dragen privacy-verantwoording, schaalt slecht zonder backend-billing | Latere optie wanneer community groter is |
| **(C) Hybrid** | Beste van beiden | 2× UI/UX, complexer | Overweging voor v1.5 |

**Concrete keuzes voor v1**:
- **Settings → AI-coach** sectie met Anthropic API-key input (vergelijk met exchange API-keys-UI patroon)
- **Local validation** voor key-format
- **Veilige opslag** in localStorage (zelfde patroon als exchange-keys, met disclaimer)
- **Model default**: `claude-sonnet-4-6` (snel + goed genoeg). Override via Settings.
- **Cost-display**: per-call token-count en geschatte kosten in UI (transparant voor user)
- **Cold-start gracefully**: bij <20 trades op een playbook → AI weigert *"Te weinig sample (3/20) — playbook-coaching activeert vanaf 20 trades"*

---

## 🔐 Privacy

- **Data blijft op user's device** behalve tijdens API-call (Anthropic Claude API ontvangt prompt + trade-data)
- **Anonimisatie optie** in Settings: trade-IDs hashed vóór verzenden (default OFF, opt-in voor paranoid users)
- **Geen trade-data persistence buiten user's localStorage** — wij zien niets
- **No-train flag** in Anthropic API-call standaard aan
- **Documentatie**: nieuwe sectie in [CLAUDE.md](../CLAUDE.md) "AI-coach privacy model"

---

## 📅 Trigger-momenten (UX)

| Trigger | Wanneer | Effort | Mode |
|---|---|---|---|
| Pre-trade validation | Bij open TradeForm (met playbookId) | Auto | Information block bovenaan modal |
| Per-trade autopsy | Knop in TradeDetailModal | Manual | Modal met multi-paragraph response |
| Weekly digest | Zondag 18:00 CET | Auto (scheduled) | Notification + permanent entry in Dashboard |
| Ad-hoc playbook-query | Knop in Playbook Detail | Manual | Chat-style modal (input + scrollable response) |

---

## 📏 Scope-schatting v1

| Component | Effort | Dependencies |
|---|---|---|
| Settings → AI-coach + BYOK input + key-test | 4h | Niets |
| Anthropic API client + prompt-templates | 6h | API key validation |
| Pre-trade validation block in TradeForm | 8h | Funding-rate auto-fetch (via Worker) |
| Per-trade autopsy modal | 6h | API client |
| Weekly digest scheduler + storage | 6h | Native browser scheduler? Of polling? |
| Per-playbook ad-hoc query modal | 6h | API client |
| Cost-display + token-counting | 3h | Anthropic SDK |
| Funding-rate Worker addition | 4h | Worker-deploy |
| Tests (mock Anthropic) | 5h | API client |
| CHANGELOG + docs + privacy-section | 3h | Final |
| **TOTAAL** | **~51h = ~7 dagen focused werk** | |

---

## ❓ Open beslissingen vóór bouw

1. **Scheduler voor weekly digest**: native browser-Notification + setInterval, of vereist het backend? *(geen backend = service-worker-based polling, fragile op file://)*
2. **Funding-rate bron**: voor alle 5 exchanges? Of starten met Blofin + MEXC + Hyperliquid (de partial-close trio)?
3. **Token-budget warnings**: vanaf welke threshold ($ per maand) waarschuwen we? Default conservatief op $5/mo?
4. **Cold-start**: 20 trades min — of dynamic (10 voor BT/paper, 20 voor real)?
5. **AI-output opslaan**: in trade-object zelf (`aiAutopsy`/`aiPreTradeBlock`), of separate `tj_ai_outputs` key (privacy bij export)?

---

## 🎯 Aanbeveling

**Bouw Tier-A (3 features) als v12.140 milestone**. Stack: Claude BYOK. Effort ~3 weken.

**Risico-mitigaties**:
- Cold-start: weiger gracefully bij <20 trades + duidelijke "X/20" voortgang
- BYOK-friction: stap-voor-stap onboarding-wizard met screenshot van Anthropic-console
- Cost-controle: hard-cap default $10/mo met user-override + dagelijkse usage-summary

**Volgende stap**: `/to-prd` (mattpocock skill) om dit document tot een formele PRD om te zetten, OF direct `/grill-me` om de 5 open beslissingen door te lopen voor we bouwen.
