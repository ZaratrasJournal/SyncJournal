# Jev (TypeSafe AI) — is er een use-case voor SyncJournal?

*Onderzoek op verzoek van Denny, 28-09-2026. Aanleiding: hij overweegt er geld in te steken en
wil eerst weten of we het ergens voor kunnen inzetten.*

---

## Korte versie

Het product is echt en de makers zijn serieus. **Maar de site waar je naartoe werd gestuurd is
niet van hen.** En voor SyncJournal is er precies één plek waar Jev iets oplost zonder onze
belofte te breken: het herkennen van CSV-kolommen bij import. De rest is óf niet nodig, óf zou
de app slechter maken.

---

## 1 · Wie is wie

| | |
|---|---|
| **TypeSafe AI** | De makers. Opgericht door **Diogo Almeida**, ex-OpenAI, mede-uitvinder van RLHF (InstructGPT, ChatGPT). **$40 miljoen** opgehaald, uit stealth op 15-09-2026. API: `api.typesafe.ai`, early access via wachtlijst. Prijs: $0,042 per miljoen invoer-tokens, uitvoer gratis |
| **thejevai.com** | **Niet van hen.** Op de site staat letterlijk: *"Jev AI is an independently operated product and is not affiliated with, operated by, or endorsed by TypeSafe."* Geen bedrijfsnaam, geen team, geen adres. Verkoopt credit-pakketten van $10 / $100 / $1.000 |
| **De HuggingFace-post** | Geen bron. Geschreven door een gebruikersaccount (`sora-2`), geen benchmarks, geen onafhankelijke test. In de reacties: *"Looks like a heavily AI-generated article. Plz read it before publishing."* De schrijver geeft toe dat hij AI heeft gebruikt |

**Koop niets op thejevai.com.** Als je Jev wilt gebruiken, ga naar TypeSafe zelf.

En als je met "geld in steken" bedoelde *investeren in het bedrijf*: TypeSafe heeft $40M
risicokapitaal opgehaald en is niet open voor particuliere investeerders. Dat is geen optie.

## 2 · Wat Jev doet

Geen tekst, maar beslissingen. Je geeft context plus een getypeerde vraag, je krijgt een
antwoord met een waarschijnlijkheid:

- **choice** — kies uit een lijst die jij aanlevert
- **score** — cijfer op een schaal die jij bepaalt
- **yes/no** — kans dat een stelling waar is

Claim van de makers: 20–200× sneller en 40–400× goedkoper dan een chatmodel voor dit soort werk,
met 70–500 ms responstijd. Onafhankelijk getoetst heb ik dat niet; de cijfers komen van henzelf
en uit reviews die hun materiaal overnemen.

## 3 · De harde grens voor ons

**SyncJournal doet vandaag geen enkele AI-aanroep.** Nagelopen op 28-09-2026: elke `fetch()` in
de app gaat naar de versiecheck, wisselkoersen, Google Drive, de exchange-proxy of een publiek
exchange-endpoint. De AI-coach draait volledig lokaal op je eigen trades.

Dat is precies wat we vandaag aan de community hebben verteld: *geen account, geen server, je
data blijft in je eigen browser.*

Elke Jev-functie breekt dat. Er is geen backend, dus de aanroep moet via de Worker, en dan
stroomt data van leden via jouw infrastructuur naar een derde partij. Dat kán — het is hetzelfde
patroon als de exchange-proxy — maar het is een **verandering van de belofte**, geen technisch
detail. Wat je ook bouwt: het moet standaard uit staan en de gebruiker moet het zelf aanzetten.

## 4 · Waar het wél iets oplost

### 🟢 CSV-kolommen herkennen bij import — de enige sterke

`parseExchangeCsvText` ([work/syncjournal.html:7722](work/syncjournal.html#L7722)) is met 333
regels de langste functie in de app, met zes handgeschreven herkenners. Een zevende exchange
toevoegen betekent twee lange negatie-kettingen bijwerken ([:8001](work/syncjournal.html#L8001)).
Zie backlog-story 6.

Jev past hier goed: geef de **kopregel** en vraag per kolom wat het is — instapprijs, uitstap,
PnL, richting, tijdstip. Dat is precies een *choice*-vraag.

**En het privacy-bezwaar geldt hier bijna niet**, want je stuurt alleen de kolomnamen. Geen
bedragen, geen trades. `"Futures Trading Pair,Closing PNL,Avg Entry Price"` verlaat de browser,
meer niet.

Winst: onbekende exchanges werken meteen in plaats van na een nieuwe release. Dat is een echt
probleem — leden met een beurs die wij niet kennen, kunnen nu niets.

### 🟡 Vrije tekst omzetten naar tags — alleen met opt-in

Iemand schrijft *"te vroeg in, FOMO na dat verlies"* en de app stelt de tags **FOMO** en
**vroege entry** voor uit je eigen lijst. Dat is een goede *choice*-vraag en het scheelt klikken.

Maar hier stuur je wél wat de gebruiker heeft getypt, en notities zijn het persoonlijkste in de
hele journal. Alleen als: standaard uit, expliciet aanzetten, en zichtbaar in beeld wanneer het
gebeurt.

### 🔴 Waar je het níét moet gebruiken

**Import, dedup en partial-detectie.** Dat zijn nu deterministische beslissingen: is deze binnenkomende
trade dezelfde als die daar? Een waarschijnlijkheid van 0,87 is daar geen verbetering maar een
regressie. Elke dure bug van dit jaar — de Kraken 20→43, het Hyperliquid-duplicaat, de MEXC-size —
zat in dit soort logica. Daar wil je juist *minder* onvoorspelbaarheid, niet meer.

**Analyse en scores.** Trade-score, R-multiple, welke trades review verdienen: dat rekenen we uit
getallen die we al hebben. Uitrekenen is beter dan schatten, en het werkt offline.

**De AI-coach routeren.** Dat is een oplossing voor een probleem dat we niet hebben — er is geen
LLM om naartoe te routeren.

## 5 · Wat het kost

Verwaarloosbaar. Bij $0,042 per miljoen invoer-tokens kost een kopregel van een CSV ongeveer
niets. De rekening is hier niet het bezwaar; de afhankelijkheid en de privacy zijn dat.

Wel iets om mee te wegen: Jev is **early access via een wachtlijst**. Je kunt er dus vandaag geen
functie op bouwen die morgen af moet zijn.

## 6 · Advies

**Niet nu.** Drie redenen, in volgorde van gewicht:

1. **We hebben net 1.0 uitgebracht met "je data blijft in je browser" als kernbelofte.** Binnen
   een maand een functie toevoegen die data naar buiten stuurt, ondermijnt precies datgene
   waarmee je de community hebt overtuigd.
2. **De ene sterke use-case lost een probleem op dat we ook zelf kunnen oplossen.** De CSV-parser
   opknippen per adapter (story 6) maakt een nieuwe exchange toevoegen al een stuk makkelijker,
   zonder afhankelijkheid.
3. **Early access.** Je kunt er nu niet op bouwen.

**Wat ik wél zou doen**: zet jezelf op de wachtlijst bij TypeSafe en probeer het in de playground
op een paar van onze echte CSV-kopregels — MEXC, Blofin, Kraken, FTMO, OKX. Dat kost niets en
beantwoordt de enige vraag die er nog toe doet: *herkent het onze kolommen beter dan onze eigen
detectie?* Doet het dat overtuigend, dan is het de moeite waard om er na de CSV-refactor nog eens
naar te kijken.

En de vraag waarvoor je ermee begon, voor de zekerheid nog een keer: **niet betalen op
thejevai.com**.

---

## Bronnen

- [thejevai.com](https://thejevai.com/) — de niet-gelieerde site met de credit-pakketten
- [docs.typesafe.ai/models](https://docs.typesafe.ai/models) — officiële documentatie
- [Check Point: prompt injection tegen Jev](https://blog.checkpoint.com/ai-security/jev-is-not-a-language-model-but-it-breaks-like-one-prompt-injection-against-a-typed-decision-model/) — de enige echt kritische bron die ik vond
- [MindStudio: 12 use-cases getest](https://www.mindstudio.ai/blog/jev-use-cases-automation)
- [Developers Digest: benchmarks en prijzen](https://www.developersdigest.tech/blog/typesafe-jev-system-one-models-release-guide-2026)
- [HuggingFace-post](https://huggingface.co/blog/sora-2/what-is-jev-ai-a-practical-guide-to-system-one-and) — als voorbeeld van wat géén bron is
