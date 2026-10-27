# TradingPlan v3 — prototype-rapport (27-10-2026)

Prototype: `demos/plan-v3-demo.html`. Serveer de repo-root lokaal (bv. `python3 -m http.server`) en open
`/demos/plan-v3-demo.html`. Niet via `file://`, want de demo haalt `site/demo-dataset.json` op.
Handige adresparameters: `?tab=dag|week|afsluiting|log`, `?v=A|B|C` (Dag-variant), `?theme=light|dark`.
Screenshots (licht/donker, 1280 en 390 breed) staan in `demos/plan-v3-screenshots/`.

Wat er echt werkt: tabs Week · Dag · Afsluiting · Log, het tandwiel (risico per grade, 3 pre-flight-vinkjes),
tag-chips per laag uit `tagConfig` (ook een nieuwe tag toevoegen), geërfde chips gedimd en per scenario
uit te zetten, confirmations afvinken, status met één tik, "Zet om in trade" als modal, een scenario
toevoegen of bewerken (met een playbook kiezen vult hij de entry-laag en grade al in), en de edge per
scenario, live berekend op de 1.141 trades van de dataset. Er wordt niets opgeslagen.

## De drie Dag-varianten

**A · Kaarten.** Bovenaan één strook met pre-flight, mentaal en een samenvatting van de context (die klapt
open). Daaronder één kaart per scenario, gesorteerd op edge, met Live en Backtest als twee blokken met
grote cijfers. Werkt voor wie 's ochtends alles in één oogopslag naast elkaar wil zien en scenario's
vergelijkt. Op de telefoon worden het lange kaarten onder elkaar.

**B · Cockpit.** Links de trechter week → dag → levels → pre-flight → mentaal. Rechts een gerangschikte
lijst: per scenario één regel (`Live 18 · 39% · +0,00R | Backtest 19 · 32% · −0,03R`). Tik je erop, dan klapt
hij open met trigger, geërfde tags, confirmations en de volledige edge-tabel. Werkt voor wie veel scenario's
heeft en snel wil kiezen: het compactst, en de meeste data per pixel. Op de telefoon is de trechter
ingeklapt tot pre-flight en mentaal.

**C · Flow.** Verticale stappen: 1 Pre-flight → 2 Context → 3 Scenario's → 4 Na de sessie. Elk scenario is
een afvinklijst met voortgangsbalk; zijn alle confirmations af, dan wordt de kaart groen met "Klaar om te
nemen · 1% risico". De edge staat er als zin: "Volgens je eigen trades: 18 live, 39% winst, gemiddeld
+0,00R". Werkt voor wie een vaste routine wil en tijdens de sessie wil afvinken. Het beste op de telefoon.

## Advies

**B (Cockpit) als basis, met de afvinklijst en het "klaar om te nemen" uit C.**
- Het ontwerp zegt "één regel per scenario, standaard zichtbaar". B doet dat letterlijk; A maakt er een
  blok van dat de kaart lang maakt, en C een zin die je moet lezen.
- De ranking is het punt van blok A. In B is de volgorde (1, 2, 3, met "sterkste") het eerste wat je ziet.
- B blijft rustig met 6–8 scenario's; A wordt dan een muur van kaarten.
- De trechter links maakt week → dag → scenario zichtbaar zonder extra tik. Op de telefoon klapt hij in.
- Wat B mist is het moment "nu nemen". Neem uit C de voortgangsbalk van de confirmations en de groene
  "klaar"-staat over in de opengeklapte rij.

## Wat ik anders deed dan het ontwerp

1. **Weekly/Daily tellen niet mee in de edge.** Geen enkele trade in de dataset heeft een Weekly- of
   Daily-laag (`timeframeTags` is 5M–4H). Telden ze mee, dan viel elke week-tag er bij elk scenario af.
   Ze erven door als context en bias, maar de matching gebruikt alleen tijdframes uit `timeframeTags`.
   Daar staat één regel over in de context, niet op elke kaart.
2. **Matching per tijdframe.** Een tag telt als de trade hem in de láág met hetzelfde tijdframe heeft
   (1H BOS ≠ 15M BOS). De platte `t.tags` en de bias tellen niet mee. Richting ook niet (zie vragen).
3. **"Minst specifiek" = hoogste tijdframe eerst, binnen een tijdframe eerst confirmations, dan setups.**
   Dat valt weg tot er ≥ 5 trades zijn (Live + Backtest + Paper samen). Het ontwerp definieert "minst
   specifiek" niet. In de dataset valt er vaak meer dan één tag weg ("zonder 4H Liquidity Sweep, 1H BOS").
4. **Geërfde tags zijn per scenario uit te zetten** (tik op de gedimde chip). Zonder dat moet een
   Trend-pullback op 1H MSB ook de 1H BOS van de dag hebben, en dan matcht er bijna niets.
5. **Ranking op gem. R in plaats van expectancy in $.** Gem. R ís de expectancy in R, en die kun je
   tussen Live en Backtest vergelijken, wat met dollars niet kan. De tabel toont beide. De
   R-logica is gekopieerd uit de journal (`tradeROrNull`, `rNetto`, `theoR`, `aggR`, `gemR`, `aggOf`):
   alleen trades mét stop tellen.
6. **Betrouwbaarheid:** < 10 trades weinig, 10–29 redelijk, ≥ 30 genoeg (op de basis Live of Backtest).
7. **"Zet om in trade" voegt lagen met hetzelfde tijdframe samen** en neemt alleen de áfgevinkte
   confirmations mee. Niet afgevinkte staan eronder met "gaat niet mee".
8. **Voorspel-score:** "uitgekomen" = genomen + uitgekomen-niet-genomen, gedeeld door alle scenario's
   die niet meer open staan. Ongeldig telt als niet uitgekomen.
9. **Nagemaakte data:** de dataset heeft geen trades met `kind:'gemist'`. Voor de demo krijgt elke 14e
   live-trade een gemiste tweeling. De Log-historie (10 dagen) is gemaakt uit echte live-trades van die
   dagen: A/B-trades horen meestal bij een scenario, C-trades meestal niet. Aangevuld met gemiste,
   niet-uitgekomen en ongeldige scenario's. Het generatorscript zou zelf gemiste trades moeten maken.
10. **Themaknop in de demo**, terwijl het ontwerp (besluit 10) zegt: geen eigen themaknop. Dat is alleen
    om beide thema's te laten zien. In de echte build volgt het plan `sj_state.theme`.

## Wat opvalt aan de cijfers

De demo-dataset is willekeurig gegenereerd en heeft dus nauwelijks edge: alle scenario's zitten rond
0R, en in de Log scoort "buiten plan" zelfs béter dan "binnen plan" (5 trades, dus weinig zeggend).
Het prototype laat de vorm zien, niet een echte uitkomst. Met echte trades wordt het pas interessant.

## Open vragen voor Zaratras

1. Welke variant: B met de afvinklijst uit C (mijn advies), of toch A of C?
2. **Richting meenemen in de matching?** Een long en een short op hetzelfde playbook zijn vaak echt
   verschillend, maar dan halveert n.
3. **Bias meenemen in de matching?** Nu niet. "4H Bullish" is misschien juist de belangrijkste tag.
4. **Weekly/Daily-lagen op trades:** moeten trades die lagen ook krijgen (`timeframeTags` uitbreiden),
   zodat de week-context meetelt? Of blijft de week puur context?
5. Klopt "minst specifiek = hoogste tijdframe eerst"? Een alternatief is de tag die de minste trades
   overlaat eerst laten vallen. Dat geeft meer data, maar is lastiger uit te leggen.
6. Telt **ongeldig** in de voorspel-score als "niet uitgekomen", of laten we hem helemaal weg?
7. **Pre-flight niet af:** blokkeert dat iets (bv. "Zet om in trade" grijs), of is het alleen een
   herinnering? In het prototype is het alleen een herinnering.
8. **Mentaal ≤ 2:** in C staat dan "overweeg alleen A-setups". Willen we dat overal, of nergens?
9. Moet de Afsluiting standaard op vandaag openen, of op de laatste dag met trades?
