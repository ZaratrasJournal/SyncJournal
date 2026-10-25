# Onderzoek: een echte AI-coach in SyncJournal (eigen sleutel)

**Datum**: 25-10-2026 · **Status**: onderzoek, geen app-code · **Besluit vooraf (Denny)**: de coach blijft,
wordt echt, en blijft één plek. Geen automatische AI-inzichten op Dashboard of Analytics.

Bronlabels: **[P]** primair (docs, prijspagina, eigen code), **[V]** marketing van het product zelf,
**[S]** secundair (reviews, vergelijkingssites, forums). Bronnen staan onderaan, genummerd.
Waar ik iets niet kon controleren, staat dat erbij.

---

## Samenvatting in 10 regels

1. De huidige coach in SyncJournal is een regex-demo: hij herkent woorden en vult vaste zinnen in met cijfers die de app zelf al berekent. Er praat geen taalmodel mee.
2. De oude TradeJournal-coach (Mori) was technisch goed: rechtstreeks naar Anthropic, cijfers voorgerekend door de app, budgetbewaking. Maar hij was verstopt, stond standaard uit en had vijf instellingensecties vóór je één vraag kon stellen.
3. Waarom niemand hem gebruikte is niet gemeten. Meest waarschijnlijk: de drempel van een eigen Anthropic-account met betaalgegevens, gevolgd door vindbaarheid en complexiteit. Kosten waren het probleem niet.
4. De grote journals (TradeZella, TraderSync, TradesViz) bouwen de chat in het abonnement in, met credits of een dagelijks berichtenlimiet. Niemand van de groten werkt met een eigen sleutel. Edgewonk doet een wekelijks rapport, Tradervue en Journalytix hebben geen AI.
5. Het sterkste ontwerpprincipe uit de markt: **de app rekent, het model leest** (TradesViz zegt het letterlijk). Dat sluit aan op wat de oude coach al leerde in v12.144.
6. Een Claude-abonnement (Pro/Max) gebruiken in plaats van een API-sleutel mag niet: Anthropic verbiedt dat expliciet voor apps van derden.
7. Kosten zijn verwaarloosbaar: 4 weekreviews + 20 vragen kost met Sonnet 5.5 ongeveer **$0,30 tot $1 per maand**, met Haiku 5.5 ongeveer **2 tot 5 cent**. Alleen "alle trades meesturen" maakt het duur.
8. Sleutel bewaren: lokaal in een eigen sleutel buiten elke export en back-up, met een knop "alleen deze sessie" voor gedeelde pc's. Versleutelen zonder wachtwoord voegt niets toe. De echte vangrails zitten bij Anthropic: een aparte sleutel met vervaldatum en een bestedingslimiet.
9. De regel in CLAUDE.md ("geen API-sleutels in de browser zonder backend") botst met BYOK. Voorstel: de regel preciezer maken, niet negeren. Dat is Denny's besluit.
10. Bouwvolgorde: eerst de "coach-pakket"-functie die cijfers voorrekent en te testen is zonder sleutel (S/M), dan sleutel + één echte vraag (M), dan weekreview, budget en foutstaten (S per stuk).

---

## 1. De stand in SyncJournal (work/syncjournal.html)

### Wat er nu is [P, eigen code]

| Onderdeel | Waar | Wat het doet |
|---|---|---|
| `pgAI()` | regel ~5350 | Chatpagina: berichtenlijst `#aiFeed`, suggestie-chips, invoerveld `#aiInput`, disclaimer. Lege staat als de coach uit staat. |
| `aiReply(q)` | ~5333 | Regex op de vraag (`/emotie\|psych/`, `/lek\|verlies/`, `/edge\|beste/`, `/week\|maand/` …) en dan een vaste zin met cijfers uit `agg()`, `groupRows('session')`, `tradeMistakes`, `tradeEmotions`. Geen taalmodel. |
| `aiStyle(txt)` | ~5328 | Plakt een toon-opener ervoor ("Even eerlijk: ") en maskeert bedragen met een regex. |
| `aiSuggest` / `aiSend` | ~5348 | Zet vraag + antwoord in `AIMSGS` (alleen in geheugen, weg na herladen). |
| `AIPREFS` | ~5318 | `{enabled, tone, focus:{discipline,risk,psychologie}, hideAmounts}` in `sj_ai_prefs`. Gaat mee in de export (`aiPrefs`) en in "Data overzetten". |
| Instellingen → AI-coach | ~4433 | Aan/uit, toon (mild/neutraal/direct), bedragen verbergen, drie focus-schakelaars die extra chips tonen. |
| Weergave-presets | ~2527 | `pgAI` staat **uit** in "rustig" én "standaard", alleen aan in "alles". De nav-knop verdwijnt dan (`renderNav`, ~10096). |

### Wat ik tegenkwam (feiten, geen meningen)

- **De begroeting zegt "Hoi Denny"** (`AIMSGS`, regel ~5316) voor elk lid. Kleine fix, maar elk lid ziet het.
- **De coach rekent op `CLOSED`**, dus op de gesloten trades na het globale filter (`render`, ~5396). Dat klopt met "je zichtbare trades".
- **"Bedragen verbergen" lekt bij kleine bedragen.** De regex `/([€$])\s?[\d.]+/` stopt bij de komma. Getest: `−€ 1.234,56` wordt `−€ •••,56`. Bedragen boven de centengrens worden afgerond en lekken niet. Voor een echte coach is deze regex sowieso de verkeerde plek: maskeren moet gebeuren vóór de data het apparaat verlaat, niet op het antwoord.
- **De coach is in de standaardweergave niet te vinden.** Alleen wie "alles" kiest of de schakelaar vindt, ziet hem. FAQ en de FAQ-zoekbalk verwijzen wel naar de coach (`go('ai')`), dus die links werken, de nav-knop niet.
- De 13 specs `tests/aicoach-*.spec.js` beschrijven de **oude** coach (`sec-chat`) en draaien hier rood (backlog-archief story 17).

### Wat herbruikbaar is

| Herbruikbaar | Waarom |
|---|---|
| De pagina zelf (`.aiwrap`, `.aifeed`, `.aichip`, `.aiinput`, `.aioff`) | Layout, beide thema's via tokens, lege staat "coach staat uit" bestaat al. |
| `aiReply` als **fallback zonder sleutel** | Geen sleutel? Dan blijft de demo beschikbaar, duidelijk gelabeld. Zo is de pagina nooit leeg. |
| De rekenhelpers: `aggOf`, `gemR`/`tradeROrNull`, `groupRows`, `tradeMistakes`, `tradeEmotions`, `sessionOf`, `periodTrades`, `pfTxt` | Dit zijn precies de bouwstenen van het "coach-pakket" (zie §6). En ze volgen de R-regel uit CLAUDE.md: `0` is niet "onbekend". |
| `AIPREFS` (toon, focus, hideAmounts) | Toon wordt een regel in de systeemprompt, focus bepaalt de chips, hideAmounts bepaalt wat er mee gaat. |
| `DB.load/DB.save` (`sj_`), `dovStripKeys`-patroon | Patroon om geheimen uit een export te houden bestaat al. |

---

## 2. De oude coach (work/tradejournal.html, BEVROREN, alleen gelezen)

### Hoe het werkte [P, eigen code]

**Sleutel.** In `localStorage` onder `tj_ai_config.byok.key`, als platte tekst (~regel 3230, 17425).
Bewust **niet** in de JSON-export: `exportTrades` (~20935) neemt `config` mee maar niet `tj_ai_config`.
Chats (`tj_ai_chats`, max 50), weekreviews (`tj_ai_weeklies`, max 26) en de laatst verstuurde prompt
(`tj_ai_last_prompt`) stonden ook lokaal en gingen ook niet mee in de export. Standaardmodel
`claude-sonnet-4-6`, keuze uit Sonnet 4.6, Opus 4.7, Haiku 4.5. Een "Test verbinding"-knop stuurde
"Reply with only the word OK." met `max_tokens:20`.

**Aanroep.** `fetch("https://api.anthropic.com/v1/messages")` met `x-api-key`,
`anthropic-version: 2023-06-01` en `anthropic-dangerous-direct-browser-access: true`
(`callClaude` ~17580, `callClaudeChat` ~18302, test ~19345). Geen streaming, geen prompt caching.

**Context in de chat** (`buildChatSystemPrompt`, ~18153):
- Kerncijfers van de laatste 7 dagen (aantal, W/L, WR, PnL, gem. R, PF, gemiste TP's, top-symbolen).
- Per playbook, over alle trades, apart voor real/backtest/paper/missed: WR, PnL, avgR, **avgWinR, avgLossR, expectancy**, voorgerekend.
- Definities van de eerste 5 playbooks.
- De 25 meest recente trades op één regel: datum, tijd, sessie, type, symbool, richting, PnL, R, playbook, setups, grade, eerste 60 tekens van de notitie.
- Samenvatting + actie van de laatste weekreview.
- De hele chatgeschiedenis van dat gesprek, zonder afkapping.

**Prompts.** Persona "Mori", stijl Steenbarger + Douglas + Bellafiore, Nederlands, "gebruik specifieke
cijfers uit de data", en een lange uitleg hoe je de R-cijfers leest. Die uitleg kwam er in v12.144 omdat
het model `avgR` vergeleek met de `minRR` van het playbook en ten onrechte concludeerde dat een winstgevend
playbook tekortschoot. **Les: het model leest cijfers verkeerd als je de betekenis niet meelevert.**
Weekreview (~17945) en pre-trade-check (~17655) vroegen strikt JSON terug met een vast schema
(`summary`, `best_trade`, `worst_trade`, `discipline_trend`, `action` / `severity`, Bellafiore-scores),
met een terugval op ruwe tekst als JSON-parsen faalde.

**Budget.** Maandlimiet standaard $5, waarschuwing bij 80%, check vóór elke aanroep, kosten berekend uit
`usage` met een eigen prijstabel (`AI_PRICING`, ~17432), reset per kalendermaand.
**Die prijstabel klopte al niet meer**: Haiku 4.5 stond op $0,80/$4 (is $1/$5), Opus 4.7 op $15/$75
(is $5/$25) [P, prijspagina 1]. Het budget liep dus scheef zonder dat iemand het merkte.

**Privacy.** Drie lagen: tickers vervangen door `COIN_A`, `COIN_B` (standaard aan), bedragen als labels
(`$X1`) of buckets (`$middel`) (standaard uit), en een scherm "wat is er verstuurd?" met de laatste prompt.

**Fouten.** Elke fout ging als ruwe Engelse API-melding naar een toast ("Chat mislukt: invalid x-api-key").
Geen onderscheid tussen sleutel fout, tegoed op, overbelast of geen internet.

**UI.** Eigen tab met vijf secties en een scroll-spy (Algemeen, API-key, Pre-trade, Budget, Weekly, Privacy),
een zwevende chat-popup, een melding in de topbar als de weekreview "due" was. Master-schakelaar standaard
**uit** (`DEFAULT_AI_CONFIG.enabled:false`).

### Overnemen of anders doen

| Onderdeel | Oordeel | Wat we doen |
|---|---|---|
| App rekent cijfers voor, inclusief expectancy | **Overnemen** | Kern van het ontwerp. Uitbreiden met per-groep tabellen (§6). |
| Uitleg van de metrics in de prompt | **Overnemen** | Kort en per veld. Plus de SyncJournal-regel: geen R = "onbekend", niet 0. |
| Sleutel buiten de export | **Overnemen** | Ook buiten auto-back-up en IDB-snapshots (die gebruiken `snapshotPayload`). |
| Weekreview met vast schema | **Overnemen, iets losser** | Structured output (`output_config.format`) in plaats van "beloof JSON" en zelf parsen [P, 3]. |
| "Wat is er verstuurd?" | **Overnemen** | Goedkoop, en het beste antwoord op "wat weet de coach van mij". |
| Budget-guard vóór de aanroep | **Overnemen** | Met actuele prijzen en cache-velden uit `usage`. |
| Ticker-maskering `COIN_A` | **Niet overnemen** | BTC is niet geheim. Maskeren maakt crypto-advies slechter (funding, sessies, volatiliteit verschillen per munt). Bedragen zijn het gevoelige deel. |
| Hele chatgeschiedenis meesturen | **Anders** | Laatste ~10 beurten + prompt caching. |
| Ruwe Engelse fouten in een toast | **Anders** | Vaste Nederlandse fouttoestanden in het gesprek zelf (§7). |
| Vijf secties, scroll-spy, popup, topbar-melding | **Niet overnemen** | Botst met "één plek" en met "journal blijft clean". Instellingen worden één paneel. |
| Pre-trade-check als formulier | **Later, als knop** | Waardevol, maar pas na de basis. Geen apart formulier: een chip "Check een trade die ik wil nemen". |
| Standaard uit + master-schakelaar | **Anders** | Coach zichtbaar in de nav; zonder sleutel toont hij uitleg en de demo. |
| `anthropic-version: 2023-06-01` | **Bijwerken** | De docs noemen nu `2026-10-21` als voorbeeld [P, 4]. Die versie weigert `temperature`/`top_p`/`top_k` [P, 3]. |

---

## 3. Andere journals met een chat-coach

Let op: vrijwel alle prijzen en features komen uit vergelijkingssites en vendorpagina's, en die spreken
elkaar tegen. De vendorsites zelf kon ik vanuit deze omgeving niet openen. Behandel de bedragen als
orde van grootte.

| Journal | Wat de AI kan | Context voor het model | Prijs (per maand) | Sleutel | Privacy |
|---|---|---|---|---|---|
| **TradeZella** (Zella AI) | Vragen over je trades, regels en journal; prestatieanalyse; auto-tagging en sessiereviews op hogere plannen; week- en maandrapport automatisch [S 6, V 8] | Je gelogde trades en journal [S 6] | Na juli 2026: Essential $35, Pro $59, Ultra $99; daarvoor $29/$49 [S 6]. Gemeten in credits: ~500 / 1.500 / 3.000 per maand [S 6] | Ingebouwd | Niet gevonden |
| **TraderSync** (Cypher) | Strategie reviewen, P&L per dag/tijd, check op je tradeplan, journal filteren op verzoek; **Cypher Coach** (proactief) alleen op Elite [S 7] | Je tradehistorie | Pro $29,95 (5 berichten/dag), Premium $49,95 (15/dag), Elite $79,95 (60/dag) [S 7; limieten uit een concurrentpagina] | Ingebouwd | Niet gevonden |
| **TradesViz** | AI Trade Chat (vragen in gewone taal), AI Query (grafiek + tabel uit je trades), AI Coach met **16 vaste rekenchecks** die je 4 grootste lekken in dollars rangschikt [V 9, S 10] | Je trades; chat is opt-in "omdat externe AI toestemming vraagt" [V 9]. "De cijfers komen uit de database, de AI leest ze" [V 10] | Aandelen gratis; betaald vanaf ~$29 met 30 coachberichten/dag [S 10]; eerder 25/50 per dag op Pro/Platinum [V 9] | Ingebouwd | Expliciete toestemming |
| **Edgewonk** | **Edge Finder** (jan 2026): wekelijks rapport per e-mail met patronen, geen chat [S 11] | Hele journal | Eenmalig/jaarprijs, niet bevestigd | Ingebouwd | Niet gevonden |
| **Tradervue** | Geen AI [S 12] | n.v.t. | Silver $29,95, Gold $49,95 [S 12] | n.v.t. | n.v.t. |
| **Journalytix** | Geen AI gevonden; sterk in live sessies, nieuwsfeed, spraak-notities [P 13, S 13] | n.v.t. | ~$47 [S 13] | n.v.t. | n.v.t. |
| **Chartlog** | "AI insights" in het Pro-plan, verder onduidelijk; model niet genoemd [S 14] | Onbekend | Lite $14,99 · Standard $29,99 · Pro $39,99 of $49,99 [S 14] | Ingebouwd | Onbekend |
| **Tradexis** (AI-first) | AI Coach-chat + **Pre-Trade Mirror** (oordeel vóór je instapt), voor ICT/SMC [S 15] | Trades + backtests | Gratis: 5 coachberichten per sessie; Pro onbeperkt (bèta-prijs) [S 15] | Ingebouwd | Onbekend |
| **TradeOS** (Wyckoff Labs, AI-first) | AI Coach reviewt elke trade tegen een gekozen methode (ICT, SMC), Bybit-sync [S 15] | Trades + methode | Niet gevonden | Ingebouwd | Onbekend |
| **Kleine BYOK-journals** (TJA, Daytraders, Chartself) | AI-coach op **jouw** sleutel (Perplexity, OpenAI/Grok, onbekend) [V 16] | Lokaal opgeslagen entries (TJA) | Laag of gratis | **Eigen sleutel** | Daytraders: sleutel "AES-128 versleuteld" [V 16] |

**Wat opvalt**
- **Niemand van de grote spelers werkt met BYOK.** Ze hebben een backend en verdienen aan het abonnement. Ze rantsoeneren met credits of berichten per dag. BYOK zie je alleen bij kleine en lokale tools. Dat is precies onze situatie (geen backend, geen abonnement), dus BYOK is voor ons logisch. Het betekent wel dat wij de drempel van de eigen sleutel moeten wegnemen, want de grote jongens hebben die drempel niet.
- **De sterkste trend is "de app rekent".** TradesViz' AI Coach draait 16 vaste checks en laat de AI alleen uitleggen [V 10]. Edgewonk doet een vast weekrapport [S 11]. Dat is ook wat de oude coach in v12.144 moest leren.
- **Proactieve coaching zit achter de duurste plannen** (TraderSync Elite). Wij doen dat bewust niet (Denny's besluit: één plek, niets ongevraagd).

---

## 4. Wat traders er echt van vinden

**Eerlijk vooraf**: ik vond **geen bruikbare Reddit-threads** (r/Daytrading, r/Forex, r/FuturesTrading).
Zoeken met `site:reddit.com` leverde alleen verkooppagina's op [S 17]. YouTube heb ik niet kunnen
doorzoeken. Wat hieronder staat komt uit reviewsites en Trustpilot-samenvattingen. **Confidence: laag tot
middel.** Wil je dit harder hebben, dan is een korte vraag in onze eigen Discord betrouwbaarder dan elk
Reddit-draadje.

**Wat geprezen wordt**
- Vragen in gewone taal over je eigen cijfers ("wat is mijn winrate op ochtend-breakouts?") worden nuttig genoemd, *zodra je genoeg trades hebt* [S 18].
- TraderSync's Cypher wordt het meest analytische genoemd: patronen en fouten uit je hele historie [S 18].

**Wat kritiek krijgt of genegeerd wordt**
- **Prijs** is de nummer-één klacht bij TradeZella, en de AI zit in de duurdere lagen [S 19].
- **Betrouwbaarheid**: één gebruiker meldt dat Zella's auto-tagging de statistiek van ~200 trades "besmette" [S 19]. Eén geval, maar het raakt precies de angst: een AI die je data stuk maakt.
- **"Een journal met een chatvenster is geen AI-journal"**: als je het handwerk nog steeds zelf doet, voegt een chat weinig toe [S 18]. De coach-framing van TradeZella "leunt meer op aanmoediging dan op een snelle dagelijkse workflow" [S 18].

**Mijn lezing**: de chat zelf wordt gewaardeerd als hij **concrete vragen over je eigen cijfers snel en
juist** beantwoordt. Algemeen coach-praatje en aanmoediging wordt genegeerd. Fouten in cijfers kosten
direct vertrouwen.

### Waarom de oude coach waarschijnlijk niet gebruikt werd

De ruwe enquêtedata zit niet in deze repo. Ik weet alleen wat in `BACKLOG.md` en
`docs/discord-release-syncjournal.md` staat: "vereenvoudigen en stabiliseren", en de coach was het meest
genoemde schrap-antwoord. Dit zijn dus hypotheses, gerangschikt op wat ik het waarschijnlijkst vind.

| # | Oorzaak | Bewijs | Confidence |
|---|---|---|---|
| 1 | **Eigen sleutel = account bij Anthropic met betaalgegevens.** Een trader die een journal opent, gaat niet eerst een developer-console in. | Niemand van de grote journals vraagt dit (§3). De oude UI had een sectie "API-key (BYOK)" zonder stappenplan. | Hoog |
| 2 | **Niet te vinden en standaard uit.** Master-schakelaar `enabled:false`, label "BETA", les l23 stond op niveau "advanced". | Eigen code [P] | Hoog |
| 3 | **Te veel instellingen vóór de eerste waarde.** Vijf secties, privacy-modi, budget, weekdag, ticker-lijsten. | Eigen code [P]. ux-audit-deep 2026-06-02 noemde de coach een "rommel-hotspot (4/5 zwaar)". | Middel-hoog |
| 4 | **De oude journal was in het algemeen te vol.** De coach was het zichtbaarste "extra" en kreeg de schrap-stem namens alles. | Enquête-uitkomst "vereenvoudigen" | Middel |
| 5 | **Nut onduidelijk naast ChatGPT.** Waarom niet je CSV in ChatGPT plakken? | Geen data | Laag-middel |
| 6 | Kosten | Waarschijnlijk niet: een maand kostte cents tot een paar dollar. Maar *onzekerheid* over kosten kan wel remmen. | Laag |

**Wat dat betekent voor de nieuwe coach**
1. **De sleutel-drempel is de echte vijand.** Een stappenplan van drie stappen met schermvoorbeeld, een eerlijke kostenindicatie ("ongeveer een kwartje per maand"), en een demo die laat zien wat je krijgt **vóór** je een sleutel maakt.
2. **Zichtbaar in de nav**, ook in "standaard". Zonder sleutel geen dood scherm, maar uitleg + demo.
3. **Nul instellingen nodig om te beginnen.** Sleutel plakken, klaar. De rest heeft goede standaarden.
4. **Beter dan ChatGPT is het argument**: de coach kent je cijfers al, voorgerekend en juist, zonder dat je iets exporteert.
5. **Accepteer dat dit een minderheidsfunctie blijft.** Zonder ingebouwde AI zal maar een deel van de leden een sleutel maken. Dat is prima zolang de coach niemand in de weg zit (één plek, niets op Dashboard). Meet het: tel lokaal hoeveel leden een sleutel hebben (anoniem, als ze dat willen) of vraag het over een paar maanden opnieuw.

---

## 5. Eigen sleutel in een browser-app zonder backend

### Mag het, en hoe werkt het [P]
- Anthropic staat directe browser-aanroepen toe met de header `anthropic-dangerous-direct-browser-access: true`. Zonder die header geeft de API een 401 met de melding dat CORS-verzoeken hem moeten zetten [S 20, S 21]. De officiële TypeScript-SDK zet browsergebruik standaard uit "om je geheime sleutel niet bloot te stellen" en vraagt `dangerouslyAllowBrowser: true` [P 22]. In de huidige API-docs vond ik de header zelf niet terug [P 4]; hij werkt wel (de oude coach gebruikte hem tot 2026). **Confidence dat hij nog werkt: hoog, maar test het in stap 2 voordat we bouwen.**
- Simon Willison (bij de lancering in 2024): bedoeld voor interne tools of precies dit patroon, **"bring your own API key"** [S 20].
- Headers volgens de docs: `x-api-key` (of `Authorization: Bearer`), `anthropic-version`, `content-type`. Een sleutel die niet aan één workspace hangt, vraagt ook `anthropic-workspace-id`, anders 400 [P 4, P 5]. **Gevolg voor de uitleg**: laat leden een sleutel maken die aan één workspace vastzit.

### Kan het met een Claude-abonnement in plaats van een API-sleutel?
**Nee.** De Legal-pagina van Anthropic zegt: OAuth is alleen voor Anthropic's eigen apps, en
"Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to
route requests through Free, Pro, or Max plan credentials on behalf of their users" [P 23]. Sinds begin 2026
wordt dat ook technisch afgedwongen [S 24]. Een lid met Claude Pro heeft dus **ook** een aparte API-sleutel
nodig, met eigen tegoed. Zet dat in de uitleg, want dat is de eerste vraag die gaat komen.

### Waar bewaar je de sleutel

| Optie | Wat het beschermt | Wat niet | Gebruiksgemak |
|---|---|---|---|
| **A. Alleen deze sessie** (`sessionStorage` of alleen in geheugen) | Gedeelde pc: weg als het tabblad dicht gaat | XSS in hetzelfde tabblad kan hem lezen [S 25] | Slecht: elke keer plakken. Dit doodt gebruik. |
| **B. Lokaal, apart, nooit in export of back-up** (eigen sleutel `sj_ai_key`, buiten `snapshotPayload`) | Lekken via een gedeeld back-upbestand, Drive-sync, "Data overzetten" | XSS; iemand die aan je ontgrendelde pc zit | Goed: één keer plakken |
| **C. Lokaal versleuteld zonder wachtwoord** | Vrijwel niets extra. De app moet hem zelf kunnen ontsleutelen, dus een aanvaller met script in de pagina ook. Een niet-exporteerbare Web Crypto-sleutel kan door XSS nog steeds *gebruikt* worden [S 25]. | Zelfde als B | Zelfde als B, meer code |
| **D. Lokaal versleuteld mét wachtwoord** | Gedeelde pc en gekopieerde schijf | XSS terwijl je ontgrendeld bent | Slecht: wachtwoord per sessie |

**Aanbeveling: B als standaard, A als schakelaar** ("Sleutel alleen voor deze sessie onthouden", voor
gedeelde pc's). C niet doen: het voelt veilig maar is het niet. D pas als iemand erom vraagt.

**De echte vangrails zitten niet in de browser maar bij Anthropic** [P 5]:
- Maak een **aparte sleutel** voor SyncJournal, zodat je alleen die intrekt als er iets is.
- Kies een **vervaldatum** bij het aanmaken (presets 3 uur, 1 dag, 7 of 30 dagen, of zelf). Na verloop geeft de API een `401`, en Anthropic mailt vooraf [P 5].
- **Bestedingslimiet**: per workspace kan een maandlimiet, lager dan die van de organisatie [P 26]. Het instellen via de API staat in early access; in de Console zou het via een tabblad per workspace gaan, maar dat pad komt uit een blog [S 26]. **Controleer dit zelf voordat we het in de uitleg zetten.** Daarnaast koopt een nieuw account vooraf tegoed; wie $5 koopt, kan nooit meer dan $5 kwijt.

### Risico's, eerlijk gewogen

| Risico | Hoe erg | Wat we doen |
|---|---|---|
| **XSS** (kwaadaardig script in de pagina leest `localStorage`) | Dan zijn de **exchange-sleutels** ook weg, die al in `localStorage` staan. De AI-sleutel voegt weinig risico toe aan wat er al is. | De app laadt geen externe scripts (gecontroleerd: geen `<script src>`). Modelantwoorden **altijd escapen** vóór ze in `innerHTML` gaan (de demo zet `m.t` nu rauw in de pagina; dat mag alleen omdat de tekst nu van onszelf komt). Markdown via een kleine renderer die eerst escapet, zoals de oude `renderChatMarkdown`. Overweeg een CSP-meta met `connect-src` naar de exchanges, de Worker en `api.anthropic.com`. |
| **Gedeelde pc** | Wie aan de pc zit, kan op jouw sleutel vragen stellen, en zien wat je trades zijn (dat kan al). | Schakelaar "alleen deze sessie", knop "Vergeet sleutel", sleutel gemaskeerd tonen (`…ab12`). |
| **Back-up gedeeld of gelekt** | Exchange-sleutels zitten nu standaard **wel** in export, auto-back-up en IDB-snapshot (`snapshotPayload` neemt `conns:CONNS` mee, inclusief `apiKey`/`apiSecret`) [P, eigen code]. | AI-sleutel nooit in `snapshotPayload`. Los onderwerp, maar het verdient een eigen ticket: zouden de exchange-sleutels niet standaard uit de export moeten? |
| **Wat het gevolg is als de AI-sleutel lekt** | Iemand verbruikt jouw tegoed. Geen toegang tot je geld of exchange. | Tegoed laag houden, vervaldatum, aparte sleutel. Benoem dat zo in de uitleg: "het ergste wat kan gebeuren is dat iemand je tegoed opmaakt". |
| **Trade-data naar een derde** | Je trades gaan naar Anthropic. API-data wordt volgens Anthropic's commerciële voorwaarden niet gebruikt voor training. **Niet geverifieerd in dit onderzoek**, controleer de actuele tekst vóór het in de app komt. | Uitleg op de pagina + "Wat is er verstuurd?" + bedragen-verbergen. |

### De regel in CLAUDE.md

> "Geen API-keys in de browser persisten zolang er geen backend is."

Die regel is in de praktijk al losgelaten: exchange-sleutels staan in `localStorage` en in de export.
Dat moest ook, anders werkt de sync niet. Voor de AI-coach is BYOK zonder backend alleen mogelijk als de
sleutel in de browser staat. Je hebt drie keuzes:

1. **Regel handhaven** → geen echte coach. Botst met Denny's besluit.
2. **Regel negeren** → de regel wordt waardeloos, en de volgende die hem leest weet niet meer wat telt.
3. **Regel preciezer maken (aanbevolen)**, bijvoorbeeld:
   > *Sleutels die de gebruiker zelf invult, mogen lokaal op zijn apparaat staan. Nooit in een export of
   > back-up tenzij hij daar bewust voor kiest. Nooit een sleutel van ons (SyncJournal) in de browser.*

Optie 3 houdt de bedoeling van de regel heel (geen gedeelde geheimen in client-code) en maakt het
bestaande gedrag eerlijk. Het is Denny's besluit; zie de open vragen.

---

## 6. Voorstel

### 6.1 Sleutel invullen en bewaren

**Plek**: de coach-pagina zelf, niet een instellingen-tab. Zonder sleutel toont de pagina een kaart:

> **Zet je echte coach aan** · Je coach draait op Claude, met je eigen sleutel. Jij betaalt Anthropic
> direct, meestal minder dan $1 per maand. Een Claude Pro-abonnement werkt hier niet, je hebt een
> API-sleutel nodig.
> 1. Maak een account op console.anthropic.com en zet er $5 tegoed op.
> 2. Maak een sleutel aan voor één workspace. Kies een vervaldatum.
> 3. Plak hem hier. [ invoerveld ] [Koppelen]
> ☐ Alleen voor deze sessie onthouden (gedeelde pc)
>
> Nog twijfels? Probeer eerst de demo-coach hieronder.

- **Koppelen** = één kleine testaanroep (`max_tokens` laag). Bij succes: "Gekoppeld · sleutel …ab12".
- Opslag: optie B (eigen sleutel in localStorage, **nooit** in `snapshotPayload`, auto-back-up of IDB-snapshot); bij het vinkje optie A.
- In Instellingen → AI-coach één regel: status, "Vergeet sleutel", model, maandlimiet. Toon, focus en bedragen-verbergen blijven waar ze zijn.
- Een spec die controleert dat de sleutel **niet** in `exportJSON()`, de auto-back-up en "Data overzetten" zit. Dat is een test die iets echt kapots aanwijst.

### 6.2 Welke context de coach krijgt: het "coach-pakket"

**Principe: de app rekent, het model leest.** Het model krijgt nooit 500 ruwe trades om zelf te middelen.
Het krijgt een pakket dat de app uitrekent met de bestaande helpers.

```
## Over deze data
- R = winst/verlies in risico-eenheden. "geen R" = geen stop-loss, dus onbekend. Niet hetzelfde als 0.
- gem. R telt alleen trades mét R (n staat erbij).
- Expectancy = winrate × gem. winst-R − verliesrate × gem. verlies-R.
- Groepen met n < 5: te weinig om conclusies uit te trekken. Zeg dat.

## Kerncijfers         (deze week · vorige week · 30 dagen · alles)
n, netto, winrate, profit factor, gem. R (n), expectancy, fees, beste/slechtste trade

## Per groep           (alleen groepen met n ≥ 3, gesorteerd op impact)
setup/playbook · sessie · weekdag · richting · symbool · grade · fout-tag · emotie-tag
  → n, netto, winrate, gem. R (n), expectancy

## Trades in focus     (max ~30 regels, alleen de periode of trade waar de vraag over gaat)
id · datum/tijd (Amsterdam) · sessie · symbool · richting · R of "geen R" · netto · setup · grade · tags · notitie (≤120 tekens)

## Regels van de trader (als TradingPlan gekoppeld is)
risico per trade, max trades per dag, setups die mogen, anti-criteria
```

- **Grootte**: ongeveer 3.000 tot 6.000 tokens. Vast deel bovenaan (uitleg + kerncijfers + groepen) zodat **prompt caching** werkt; vraag-specifieke trades onderaan.
- **Bouwen als pure functie** `coachPakket(trades, opties)` die tekst teruggeeft. Te testen met Node tegen een fixture, **zonder sleutel en zonder netwerk**. Dat is stap 1 van de bouw.
- **Later (stap 6)**: tools in plaats van meer context. Het model vraagt `groep_stats(veld, periode)` of `zoek_trades(filter)` op, de app rekent en geeft het antwoord terug. Zo blijft de context klein én kan de coach vragen beantwoorden die niet in het pakket zitten. Tool use is gewoon een lus in JavaScript [P 3]. Let op: op de nieuwste modellen kun je een tool niet meer afdwingen (`tool_choice: any/tool` geeft 400); gebruik `auto` en zeg het in de prompt [P 3].

### 6.3 Geen verzonnen cijfers

Taalmodellen verzinnen cijfers of rekenen ernaast. Een voorbeeld uit de praktijk: een model noemde een
winrate van ~70% terwijl het 65,5% was [S 27]; in een benchmark op financiële vragen zat in 8 tot 23%
van de foute antwoorden een verzonnen getal [S 28]. Wat we doen:

1. **Alle getallen komen uit het pakket of een tool.** Systeemprompt: "Noem alleen getallen die in de data staan. Reken niet zelf, behalve aftrekken of vergelijken van twee getallen uit de data. Staat het er niet in, zeg dan dat je het niet weet en welke vraag je beter kunt stellen."
2. **Kleine aantallen benoemen.** De app zet `n` bij elk cijfer. Prompt: bij n < 5 geen conclusie, wel benoemen.
3. **Bron noemen.** Prompt: "zeg uit welke tabel een cijfer komt" ("uit je sessietabel: London, n=14"). Dat maakt fouten zichtbaar voor de trader.
4. **Weekreview met vast schema** (structured output) waarin de cijfervelden door de app worden ingevuld en het model alleen de tekstvelden schrijft. Dan kán de weekreview geen fout getal bevatten.

### 6.4 Privacy: bedragen verbergen

`hideAmounts` krijgt een echte betekenis: **wat er het apparaat verlaat**, niet wat er op het scherm staat.
- **Aan**: het pakket bevat geen bedragen, saldo of positiegrootte. Wel R, winrate, aantallen, en winst/verlies als **% van het account** als dat bekend is. Trades zonder R tonen alleen "winst" of "verlies".
- **Uit**: bedragen in de accountvaluta.
- **Notities meesturen**: aparte schakelaar, standaard aan (notities zijn vaak het nuttigste voor een review), met de uitleg dat ze naar Anthropic gaan.
- **Nooit mee**: exchange-sleutels, walletadres, accountnamen, accountsaldo.
- **"Wat is er verstuurd?"**: knop onder elk antwoord die het exacte pakket toont.
- Tickers niet maskeren (zie §2).

### 6.5 Budget en verbruik

**Actuele prijzen** [P 1], per miljoen tokens:

| Model | Invoer | Cache schrijven (5 min) | Cache lezen | Uitvoer |
|---|---|---|---|---|
| Claude Haiku 5.5 (prompt ≤ 100K) | $0,10 | $0,125 | $0,01 | $0,50 |
| Claude Haiku 5.5 (prompt > 100K) | $0,50 | $0,625 | $0,05 | $2,50 |
| Claude Sonnet 5.5 | $2 | $2,50 | $0,10 | $10 |
| *Ter vergelijking: Sonnet 4.6 (oude coach)* | *$3* | *$3,75* | *$0,30* | *$15* |

Caching: minimaal 512 tokens prefix op de nieuwste modellen, cache leeft 5 minuten en wordt bij elk gebruik
ververst [P 2, P 1]. Batch is de helft goedkoper maar asynchroon, niet nodig voor ons [P 1].

**Rekenvoorbeeld: een realistische maand** (4 weekreviews + 20 vragen, in 4 sessies van 5 vragen).
Aannames: vast pakket 5.500 tokens, per vraag nog ~1.100 tokens geschiedenis en vraag, ~500 tokens antwoord;
weekreview ~8.500 tokens in en ~1.200 uit.

| | Zonder caching | Met caching |
|---|---|---|
| **Sonnet 5.5** | 20 × $0,018 + 4 × $0,029 ≈ **$0,48** | ≈ **$0,32** |
| **Haiku 5.5** | 20 × $0,0009 + 4 × $0,0015 ≈ **$0,02** | ≈ **$0,015** |

- **Denkstappen tellen als uitvoer.** De nieuwe modellen denken standaard mee (adaptive thinking) en dat wordt als output-tokens betaald [P 3]. Reken daarom met een marge: **$0,30 tot $1 per maand op Sonnet 5.5**. Zet `effort` op `low` voor chat, `medium` voor de weekreview; Haiku 5.5 staat standaard al op `medium` [P 3]. Meet het in de eerste weken met de echte `usage`-cijfers.
- **Waarom het pakket belangrijk is**: wie élke trade meestuurt (zeg 30.000 tokens) en 100 vragen stelt, betaalt op Sonnet 5.5 ongeveer 100 × (30.000 × $2 + 800 × $10) / 1M ≈ **$7 per maand**. Twintig keer zoveel, voor slechtere antwoorden.
- **Tokenizer**: modellen vanaf Claude 4.7 tellen ~30% meer tokens voor dezelfde tekst dan Sonnet 4.6 [P 1]. Zit al in de marge.

**Verbruik tonen**
- Onder elk antwoord, klein: "≈ $0,01 · Sonnet 5.5".
- Op de pagina, één regel: "Deze maand: $0,23 van $3".
- Kosten uitrekenen uit `usage.input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens` met een prijstabel **die in één constante staat, met de datum erbij**. Les van de oude coach: die tabel veroudert ongemerkt. Benoem in de UI dat het een schatting is; de echte rekening staat bij Anthropic.
- **Maandlimiet** standaard $3, aan te passen. Check vóór elke aanroep. Bij 80% een regel "je zit op 80% van je limiet". Reset op de 1e (Amsterdam-tijd).

### 6.6 Modelkeuze

- **Standaard: Claude Sonnet 5.5** (`claude-sonnet-5-5`). Coaching is redeneren over je proces, en het verschil tussen $0,02 en $0,50 per maand valt weg tegen de waarde van een goed antwoord.
- **Optie "zuinig": Claude Haiku 5.5** (`claude-haiku-5-5`). Prima voor korte cijfervragen. Let op de duurdere prijs boven 100K tokens [P 1]; met het pakket kom je daar nooit.
- **Geen Opus** in de keuzelijst. Duurder, en voor deze taak niet nodig. Kan later als "grondig" voor de weekreview als iemand erom vraagt.
- Model-ID's alleen in één constante, zodat een nieuwe generatie één regel is.
- `anthropic-version` op de actuele versie (`2026-10-21`), geen `temperature` meesturen [P 3, P 4].
- **Streaming** aanzetten zodat het antwoord binnenloopt in plaats van na 10 seconden ineens te verschijnen. Optioneel in stap 2, wel in stap 3.

### 6.7 Toon en systeemprompt (kern)

- Rol: ervaren trader-coach. Proces boven resultaat. Kort, concreet, Nederlands.
- Toon uit `AIPREFS.tone`: mild = begin bij wat goed ging; neutraal; direct = benoem de fout eerst, zonder verzachting. Geen "Goed bezig 👍" als opener die de app ervoor plakt; dat doet het model zelf beter.
- Elk antwoord eindigt met **één concrete, meetbare actie** voor de volgende sessie of week. Geen "wees gedisciplineerd".
- Geen financieel advies, geen voorspellingen over de markt, geen entry-signalen. Wel: "volgens je eigen cijfers…".
- Weet wat het niet weet: "dat staat niet in je data".
- Op de nieuwste modellen werkt een korte, heldere prompt beter dan een lange lijst MOETEN-regels [P 3]. De oude Mori-prompt (met hoofdletters en "KRITIEK") moet je dus niet een-op-een overzetten.

### 6.8 Vragen en knoppen op de pagina

Vier vaste chips, de rest via het invoerveld. Elke chip stuurt een vraag én kiest welk deel van het
pakket meegaat.

| Chip | Wat de app meestuurt | Wat er terugkomt |
|---|---|---|
| **Review mijn week** | Kerncijfers deze vs vorige week, groepen van deze week, alle trades van deze week | Vast schema: samenvatting, beste en slechtste trade met les, patroon, één actie |
| **Waar lek ik geld?** | Groepen gesorteerd op negatieve impact (fout-tags, emoties, sessies, setups), met n | Top 3 lekken met cijfer en bron, één actie |
| **Wat ging er mis bij deze trade?** | Eén trade volledig (levensloop, TP's, notitie, tags) + de groepscijfers van zijn setup | Wat klopte met je plan en wat niet, één les |
| **Hoe is mijn discipline?** | Grades, regels uit TradingPlan, trades buiten de regels | Waar je je plan volgt en waar niet |

- **"Vraag de coach"-ingang vanuit een trade**: een klein knopje in de trade-detailweergave dat naar de coach gaat met die trade geselecteerd. Dat is geen AI-inzicht op een scherm, alleen een snelkoppeling. **Check met Denny** of dat binnen "één plek" valt.
- Focus-schakelaars (discipline/risk/psychologie) blijven: ze voegen chips toe.
- Gesprek bewaren: laatste gesprek lokaal (IndexedDB), knop "Nieuw gesprek". Niet in de export (kan gevoelig zijn, en hoort niet bij je tradedata). Geen lijst van 50 gesprekken.
- **Later**: chip "Check een trade die ik wil nemen" (pre-trade) en een weekreview-archief.

---

## 7. Toestanden: leeg, fout, bezig

Volgens de CLAUDE.md-regel "toestanden benoemen vóór je bouwt". Elke toestand verschijnt **in het
gesprek zelf** als een bericht van de coach, niet als toast. Foutcodes volgens de API-docs [P 29].

| Toestand | Hoe herken je het | Wat de gebruiker ziet |
|---|---|---|
| **Coach uit** | `AIPREFS.enabled=false` | Bestaat al (`.aioff`). |
| **Geen sleutel** | Geen `sj_ai_key` | Kaart uit §6.1 + demo-coach eronder, gelabeld "demo, zonder taalmodel". |
| **Bezig** | Aanvraag loopt | Typ-indicator, invoer en chips uit, knop "Stop". Bij streaming loopt de tekst binnen. |
| **Ongeldige of verlopen sleutel** | `401 authentication_error` | "Anthropic herkent deze sleutel niet. Misschien is hij verlopen of verwijderd. Maak een nieuwe aan en plak hem hier." + invoerveld. Sleutel niet automatisch wissen. |
| **Tegoed op / betaalprobleem** | `402 billing_error` (soms als 400 met een tegoedmelding, niet zelf gezien) | "Je tegoed bij Anthropic is op. Zet er tegoed bij in je Console, dan werkt de coach meteen weer." + link. |
| **Geen rechten / workspace** | `403`, of `400` over `anthropic-workspace-id` | "Deze sleutel mag dit niet. Maak een sleutel aan voor één workspace." |
| **Eigen maandlimiet bereikt** | Lokale teller ≥ limiet, vóór de aanroep | "Je hebt je limiet van $3 deze maand bereikt ($3,02). Verhoog hem in Instellingen of wacht tot 1 november." Geen aanroep gedaan. |
| **Te druk** | `429` (met `retry-after`) of `529 overloaded_error` | "Claude is even druk. Probeer het over een minuut opnieuw." + knop Opnieuw. Eén automatische herhaling na de wachttijd, niet meer. |
| **Storing bij Anthropic** | `500` | "Er ging iets mis bij Anthropic, niet bij jou." + Opnieuw. |
| **Geen internet** | `fetch` gooit `TypeError`, of `navigator.onLine=false` | "Geen verbinding. Je vraag staat nog in het invoerveld." Vraag niet kwijtraken. |
| **Antwoord afgekapt** | `stop_reason: max_tokens` | Toon wat er is + "Antwoord was te lang, vraag 'ga door'". |
| **Geweigerd** | `stop_reason: refusal` [P 3] | "De coach kan deze vraag niet beantwoorden. Probeer hem anders te stellen." |
| **Geen trades** | `T` leeg | Geen aanroep. "Nog geen trades. Start een sync of importeer een CSV, dan heb ik iets om naar te kijken." |
| **Filter laat niets over** | `CLOSED` leeg, `T` niet leeg | Geen aanroep. "In je huidige filter staan geen gesloten trades. Zet het filter ruimer." |
| **Te weinig trades** | n < 10 | Wel aanroepen, maar het pakket zegt het en de coach begint met "je hebt nog maar 7 trades, dus dit is een eerste indruk". |
| **Alleen trades zonder stop-loss** | `gemR(rows).n === 0` | Pakket zegt "geen R bekend". Coach praat in winrate en netto, en raadt aan stop-losses vast te leggen. |
| **Model bestaat niet meer** | `404 not_found_error` | "Dit model is niet meer beschikbaar, de coach schakelt over naar Sonnet 5.5." Na een update van de constante. |

---

## 8. Bouwvolgorde

Klein, elk los te testen en los terug te draaien. Grootte: S = een avond, M = een paar avonden, L = meer.

| # | Stap | Grootte | Test | Release |
|---|---|---|---|---|
| 0 | **Besluit CLAUDE.md-regel** + fix "Hoi Denny" + coach zichtbaar in preset "standaard" | S | Bestaande specs | patch |
| 1 | **`coachPakket()`**: pure functie die het pakket uit §6.2 bouwt met de bestaande helpers, inclusief `hideAmounts` en de R-regel. Nog geen netwerk. | M | Node-spec tegen een fixture: cijfers kloppen met Analytics, geen bedragen bij hideAmounts, n bij elke groep, "geen R" bij trades zonder SL | geen (intern) |
| 2 | **Sleutel + één echte vraag**: kaart "zet je coach aan", opslag (B/A), testaanroep, de vrije vraag via het invoerveld met het pakket, antwoord escapen + simpele markdown. Demo blijft als fallback. | M | Spec met een nep-`fetch` (geen echte sleutel): goede aanroep met juiste headers; sleutel niet in `exportJSON`, auto-back-up en "Data overzetten" | minor |
| 3 | **Foutstaten uit §7** + streaming | S–M | Spec per foutcode met nep-`fetch` | patch |
| 4 | **Verbruik en maandlimiet** | S | Spec: guard blokkeert boven limiet, kosten uit `usage` incl. cache-velden | patch |
| 5 | **Vier chips** met hun eigen pakket-deel, weekreview met vast schema, "Wat is er verstuurd?" | M | Spec: juiste deel van het pakket per chip; weekreview-cijfers komen uit de app | minor |
| 6 | **Tools** (`groep_stats`, `zoek_trades`) i.p.v. meer context | M–L | Node-spec op de tool-handlers; lus met nep-`fetch` | minor |
| 7 | **Pre-trade check** als chip, met TradingPlan-regels | M | Spec | minor |
| 8 | **Oude `aicoach-*`-specs** opruimen: schrappen wat de oude UI test, vervangen door de specs hierboven | S | n.v.t. | geen |

Stap 1 en 2 samen zijn het minimum dat iets bewijst. Na stap 2 kun je een paar leden laten proberen
voordat je 3 tot en met 5 bouwt.

---

## 9. Open vragen voor Denny

1. **CLAUDE.md-regel**: akkoord met de preciezere versie uit §5 (eigen sleutels lokaal mag, nooit in export, nooit onze sleutel in de browser)?
2. **Exchange-sleutels in de export**: die zitten er nu standaard in. Los ticket om ze standaard uit te zetten (met een vinkje "sleutels meenemen")?
3. **Standaardmodel**: Sonnet 5.5 (~$0,50/maand, beter) of Haiku 5.5 (~2 cent, goed genoeg voor cijfervragen)?
4. **Notities meesturen** standaard aan of uit?
5. **"Vraag de coach"-knopje bij een trade**: valt dat binnen "de coach is één plek", of is dat al te veel?
6. **Demo-coach houden** als voorproefje zonder sleutel, of weg zodra de echte er is?
7. **Gebruik meten**: willen we weten hoeveel leden een sleutel koppelen (anoniem, opt-in), of vragen we het over drie maanden gewoon in Discord?
8. **Wie helpt leden bij hun eerste sleutel?** Een kort filmpje of een Discord-post met screenshots scheelt waarschijnlijk meer dan elke UI-verbetering.

---

## Bronnen

1. [P] Anthropic, *Pricing* (prijstabel, cache, batch, long context, tokenizer). https://platform.claude.com/docs/en/about-claude/pricing (geraadpleegd 25-10-2026)
2. [P] Anthropic, *Prompt caching* (minimum prefix, TTL, multipliers). https://platform.claude.com/docs/en/build-with-claude/prompt-caching (via de meegeleverde Claude API-referentie, cache van 06-10-2026)
3. [P] Anthropic, Claude API-referentie (modellen, adaptive thinking, effort-standaarden, structured outputs, tool use, `refusal`, API-versie `2026-10-21` zonder sampling-parameters). Bron: de Claude API-skill van Claude Code, gesynchroniseerd met https://platform.claude.com/docs (cache 06-10-2026)
4. [P] Anthropic, *API overview* (headers, `anthropic-version`). https://platform.claude.com/docs/en/api/overview
5. [P] Anthropic, *Authentication* (sleuteltypes, workspace, vervaldatum). https://platform.claude.com/docs/en/manage-claude/authentication
6. [S] StockBrokers.com, Bullish Bears, QuantVPS, TradersSecondBrain e.a., TradeZella-reviews 2026. https://www.stockbrokers.com/review/tools/tradezella · https://bullishbears.com/tradezella-review/ · https://traderssecondbrain.com/guides/tradezella-vs-tradersync
7. [S] daytradingtoolkit.com, *TraderSync Pricing Explained*; TradersSecondBrain, *TraderSync review*; TradeZella, *vs TraderSync* (concurrent, met voorzichtigheid). https://daytradingtoolkit.com/trading-tools-tutorials/tradersync-pricing-explained · https://traderssecondbrain.com/guides/tradersync-review · https://www.tradezella.com/vs/tradersync
8. [V] TradeZella, *Zella AI* en *Introducing Zella AI*. https://tradezella.com/zella-ai · https://www.tradezella.com/blog/zella-ai-your-ai-trading-partner
9. [V] TradesViz, *AI Trade Chat* (blog) en *Pricing*. https://www.tradesviz.com/blog/ai-trade-chat/ · https://www.tradesviz.com/pricing
10. [V/S] TradesViz, *AI trading journal* ("the numbers come from the database"); Capterra-vermelding. https://www.tradesviz.com/ai-trading-journal/ · https://www.capterra.com/p/10043539/TradingJournal/
11. [S] TradersSecondBrain, *Edgewonk alternative*; daytradingtoolkit.com, *Edgewonk review*. https://traderssecondbrain.com/guides/edgewonk-alternative · https://daytradingtoolkit.com/reviews/edgewonk-review
12. [S] TraderInsight.pro, TradesViz vs Tradervue, Lune. https://traderinsight.pro/blog/tradervue-vs-tradezella-vs-traderinsightpro-2026 · https://www.tradesviz.com/tradesviz-vs-tradervue/
13. [P] Journalytix help; [S] TradeZella vs Journalytix, CrossTrade. https://help.journalytix.me/welcome.html · https://tradezella.com/vs/journalytix · https://crosstrade.io/compare/crosstrade-vs-journalytix
14. [S] NexusFi, Bullish Bears, Pineify over Chartlog. https://nexusfi.com/d/journals/chartlog/ · https://bullishbears.com/chartlog-review/ · https://pineify.app/alternatives/chartlog
15. [S] NexusFi (Tradexis), Trustpilot/SaaSHub (TradeOS). https://nexusfi.com/d/journals/tradexis/ · https://dk.trustpilot.com/review/wyckofflabs.com
16. [V] TJA (Chrome Web Store), Daytraders help, Chartself (Product Hunt). https://chromewebstore.google.com/detail/eeahnbjhbngiidoghdfdfhfochodmill · https://daytraders.com/help/articles/13431247-journaling-system-quick-start-guide · https://hunted.space/product/chartself
17. [S] Zoekopdracht `site:reddit.com trading journal AI coach`, 25-10-2026: geen relevante threads.
18. [S] JournalX, *AI Trading Journal: the tools actually using AI*; StockBrokers.com, *Best trading journals 2026*. https://www.journalx.io/blog/ai-trading-journal · https://www.stockbrokers.com/guides/best-trading-journals
19. [S] thegodfunded.com (samenvatting Trustpilot-reviews TradeZella); Trustpilot. https://thegodfunded.com/en/tools/tradezella/ · https://au.trustpilot.com/review/tradezella.com?page=4
20. [S] Simon Willison, *Claude's API now supports CORS requests* (23-08-2024). https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access
21. [S] GitHub-issues met de 401-foutmelding zonder header. https://github.com/n4ze3m/page-assist/issues/511 · https://github.com/ChatGPTNextWeb/NextChat/issues/5452
22. [P] Anthropic TypeScript SDK, README (`dangerouslyAllowBrowser`). https://github.com/anthropics/anthropic-sdk-typescript
23. [P] Anthropic, *Legal and compliance* (Claude Code docs), sectie *Authentication and credential use*. https://code.claude.com/docs/en/legal-and-compliance
24. [S] The Register, *Anthropic clarifies ban on third-party tool access to Claude* (20-02-2026). https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546
25. [P] OWASP WSTG, *Testing Browser Storage*; [S] Auth0, *Secure browser storage: the facts*. https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/12-Testing_Browser_Storage · https://auth0.com/blog/secure-browser-storage-the-facts/
26. [P] Anthropic, *Workspaces* en *Set spend limit* (early access); [S] xray.tech (Console-stappen). https://platform.claude.com/docs/en/manage-claude/workspaces · https://platform.claude.com/docs/en/api/admin/spend_limits/create.md · https://www.xray.tech/post/how-to-set-spend-limits-in-claude-console
27. [S] DEV Community, *Trust the server, not the LLM*. https://dev.to/nodefiend/trust-the-server-not-the-llm-a-deterministic-approach-to-llm-accuracy-20ag
28. [S] arXiv 2607.15414, *AI Trading: Evaluating LLMs for Technical Market Analysis* (preprint, methode niet zelf gecontroleerd). https://arxiv.org/pdf/2607.15414
29. [P] Anthropic, foutcodes (400/401/402/403/404/413/429/500/529). Via de Claude API-referentie, zie 3.
30. [P] Eigen code: `work/syncjournal.html` (regelnummers bij benadering, stand `6b4c037`) en `work/tradejournal.html` (bevroren, alleen gelezen).
