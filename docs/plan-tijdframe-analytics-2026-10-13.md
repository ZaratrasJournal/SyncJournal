# Tijdframe-analytics — implementatieplan (stap 2 van 2, v1.8)

> **Voor wie dit uitvoert:** werk taak voor taak (superpowers:executing-plans). Stappen hebben
> checkboxes (`- [ ]`).

**Doel:** laten zien hoe je trades het doen per entry-tijdframe, per tijdframe-combinatie, met of
tegen de HTF-bias, en per lagen-patroon binnen een playbook.

**Besluiten** (Denny, 13-10-2026, grill-me — zie ook `docs/plan-lagen-topdown-2026-10-13.md`):
1. **Tendencies** krijgt drie dimensies: *Tijdframe* (entry, `t.timeframe`), *TF-combinatie*
   (alleen tijdframes, top-down: `Daily > 1H`) en *HTF-bias* (mee / tegen / geen).
2. **HTF-bias** = de bias van de **hoogste** laag met Bullish of Bearish (Neutraal/leeg overslaan).
   Mee = Bullish+long of Bearish+short; tegen = andersom; geen = nergens Bullish/Bearish.
3. **Analytics** krijgt een paneel *HTF-bias: mee of tegen* (drie rijen).
4. **Playbook-pagina** krijgt *Lagen-patronen*: tijdframe **plus setup** per laag
   (`4H SFP → 1H BOS`), vanaf 2 trades per patroon. Ontwerp: `demos/playbook-layer-breakdown-demo.html`
   (gemaakt voor de zes oude thema's; bouwen in licht/donker met bestaande tokens).
5. Alles rekent op **afgelopen trades** (`CLOSED` / `heeftUitkomst`), zoals elke uitsplitsing sinds
   v1.5; het live/oefen-filter geldt zoals overal.

**Tech:** `work/syncjournal.html` (`TDIM`, `TDIM_ORDER`, `pgAnalytics`, `playbookDetail`),
Playwright-specs als losse Node-scripts.

## Vaste regels
- Versie **v1.8** (minor: nieuwe functie).
- R altijd via `tradeROrNull` / `gemR` (geen R → niet meetellen, streepje bij `n===0`).
- Lege staten via `emptyState(key)` met een regel in `EMPTY`: zeg wat ontbreekt en wat de volgende
  stap is. Niet-genoeg-data is een andere melding dan leeg.
- Bedragen in een `.mask`-element; kleuren alleen via tokens; licht én donker screenshotten.
- Tag-tekst altijd via `esc()` (lessen van v1.7: tags komen uit back-ups).

## Waar het op kan stuklopen (review focus)
1. **Trade zonder lagen**: Tijdframe valt terug op `t.timeframe`; combinatie en patroon = "—"
   (komt niet in de patronenlijst).
2. **Laag zonder tijdframe of zonder setup** in een patroon: `?` voor het tijdframe, alleen het
   tijdframe als er geen setup is; meerdere setups als `SFP+BOS`.
3. **Kleine aantallen**: Tendencies toont pas vanaf `TEND_MINN` (8) trades. Het Analytics-paneel
   toont elke rij met `n` erbij; de playbook-patronen vanaf 2.
4. **Bias-schrijfwijze**: v11 heeft het gelijkgetrokken, maar vergelijk toch hoofdletter-ongevoelig
   (data uit een import van vóór de migratie).
5. **Een patroon of tag met HTML of een apostrof** in naam: als tekst tonen.

---

### Task 1: Helpers en Tendencies-dimensies

**Levert:** `tfCombo(t)`, `htfBias(t)`, `biasRelatie(t)`, `laagPatroon(t)`.

- [ ] **Stap 1: test die faalt** (`tests/tijdframe-analytics.spec.js`): pure gevallen —
  `tfCombo` op lagen `[Daily, 1H]` → `Daily > 1H`, zonder lagen → `—`; `htfBias` op
  `[Daily Bearish, 4H Bullish, 15M]` → `Bearish`, op `[Daily Neutraal, 4H bullish]` → `Bullish`;
  `biasRelatie` → mee/tegen/geen voor long/short; `laagPatroon` op `[4H {SFP}, 1H {BOS,MSB}]` →
  `4H SFP → 1H BOS+MSB`, laag zonder tijdframe → `? …`. Tendencies: de dimensie-keuzelijst bevat
  *Tijdframe*, *TF-combinatie* en *HTF-bias*; met ≥8 trades per waarde verschijnen ze in de
  kruistabel.
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie.** Helpers bij `sorteerLagen`; in `TDIM`:

```js
  tf:{label:'Tijdframe',get:t=>t.timeframe||entryTF(t.layers)||'—'},
  tfcombo:{label:'TF-combinatie',get:t=>tfCombo(t)},
  htf:{label:'HTF-bias',get:t=>({mee:'Mee met HTF',tegen:'Tegen HTF',geen:'Geen bias'})[biasRelatie(t)]},
```

  en achteraan `TDIM_ORDER`: `'tf','tfcombo','htf'`. Controleer of `tendEdgeLeak` een vaste
  lijst dimensieparen heeft; voeg zinvolle paren toe (setup × tfcombo, setup × htf).
- [ ] **Stap 4: draaien, groen.**

### Task 2: Analytics-paneel "HTF-bias: mee of tegen"

- [ ] **Stap 1: test die faalt.** Fixture met trades mee/tegen/geen (met stops voor R). Paneel
  toont drie rijen met aantal, win-rate, gem. R (`gemR`) en netto (`.mask`). Zonder enige bias:
  lege staat "Nog geen bias in je lagen — kies Bullish of Bearish bij je hoogste laag".
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie** in `pgAnalytics`, bij de andere panelen (rijen via bestaande
  `hbars` of de stijl van "Long / short"). Regel in `EMPTY`.
- [ ] **Stap 4: draaien, groen;** screenshot licht/donker.

### Task 3: Playbook-pagina "Lagen-patronen"

- [ ] **Stap 1: test die faalt.** Playbook met trades in drie patronen (5, 3, 1 trade). Paneel toont
  de twee patronen met ≥2 trades, gesorteerd op gem. R, met aantal, win-rate, gem. R en netto; label
  *Beste* en *Zwakste* bij de uitersten; de 1-trade-groep niet, met de regel "1 patroon met te weinig
  trades". Lege staten: geen lagen → "Vul setup-lagen in je trades in…"; wel lagen maar geen patroon
  ≥2 → "Nog te weinig trades per patroon".
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie** in `playbookDetail` (na de hoofdstats), op `closed`
  (`heeftUitkomst`), patroontekst via `esc()`.
- [ ] **Stap 4: draaien, groen;** screenshot licht/donker.

### Task 4: Release v1.8
- [ ] `tests/release-set.js`: `'tijdframe-analytics'`.
- [ ] `APP_VERSION='v1.8'`, `site/version.json`, CHANGELOG `## [v1.8]` **Toegevoegd**.
- [ ] `cp work/syncjournal.html site/app.html`, demo-data verversen, `pr-reviewer-nl`, poort groen,
  één release-commit, `site/` naar de deploy-repo committen. **Niet pushen** zonder "push".
