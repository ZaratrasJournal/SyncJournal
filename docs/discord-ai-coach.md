# Concept: Discord-post AI-coach

> Concept voor Denny. De plekken met `[screenshot: …]` vul je zelf in met schermafbeeldingen van de Anthropic-console.
> **Controleer bij het maken van de screenshots de menunamen**: Anthropic verandert die geregeld, en de namen hieronder
> komen uit de docs van oktober 2026 (de console heet inmiddels ook platform.claude.com; console.anthropic.com stuurt
> je daarheen). Zet daarna de link naar deze post in `AI_DISCORD_UITLEG` in `work/syncjournal.html`, dan verschijnt hij
> op de coach-pagina.

---

**🤖 Nieuw in SyncJournal: een echte AI-coach**

Traders, de AI-coach is terug, en dit keer echt. Je chat met de coach over je **eigen** trades:

- **Waar lek ik geld?**
- **Waar zit mijn edge?**
- **Review mijn week** (wat ging goed, wat kostte geld, één ding om volgende week anders te doen)
- **Hoe ging mijn laatste trade?**
- en **Check mijn trade-idee**: vul pair, richting, setup, entry en stop in, en de coach zegt wat je eigen cijfers en
  regels erover zeggen. Geen koop- of verkoopadvies, hij houdt je je eigen regels voor.

De journal rekent alle cijfers uit; de coach leest ze alleen. Zo kloppen zijn cijfers met wat je in Analytics ziet.

**Wat kost het?** Je gebruikt je eigen sleutel van Anthropic (de maker van Claude) en betaalt hen direct, niet ons. Met
een paar vragen per week en een weekreview is dat **ongeveer 30 cent tot een dollar per maand**. In SyncJournal zie je
per vraag en per maand wat het ongeveer kost.

**Let op:** een Claude Pro- of Max-abonnement werkt hier niet. Anthropic staat niet toe dat andere apps dat gebruiken.
Je hebt een losse API-sleutel nodig. Dat is in vijf minuten geregeld:

---

**Stap 1 · Maak een account**

Ga naar **console.anthropic.com** en maak een account (dat is een ander account dan je Claude-app, ook als je die al
hebt).

[screenshot: het aanmeldscherm van de console]

**Stap 2 · Zet er tegoed op**

Ga naar **Billing** en koop tegoed. **$5 is ruim genoeg** voor maanden coachen. Je betaalt vooraf, dus je kunt nooit meer
kwijt dan wat erop staat.

[screenshot: Billing, tegoed kopen]

**Stap 3 · Stel een maandlimiet in**

Zet een **maandlimiet van een paar dollar**, bijvoorbeeld $3. Dan weet je zeker dat het nooit meer wordt, ook niet als
er iets misgaat. Je vindt dit bij de limieten van je organisatie of je workspace.

[screenshot: de maandlimiet instellen]

**Stap 4 · Maak een sleutel**

Ga naar **API keys** en klik **Create key**.

- Geef hem een naam, bijvoorbeeld **SyncJournal**.
- Kies **één workspace** voor de sleutel.
- Kies een **vervaldatum** als je wilt (bijvoorbeeld 30 dagen); dan maak je daarna gewoon een nieuwe.

Kopieer de sleutel meteen: hij begint met `sk-ant-` en je ziet hem maar één keer.

[screenshot: Create key, met naam, workspace en vervaldatum]

**Stap 5 · Plak hem in SyncJournal**

Open SyncJournal, ga naar **AI-coach** (in het menu), plak je sleutel en klik **Koppelen**. De journal kijkt even of
Anthropic hem kent, en dan kun je beginnen.

Zit je op een gedeelde computer? Vink dan **Alleen voor deze sessie onthouden** aan. Dan is de sleutel weg zodra je het
tabblad sluit.

[screenshot: de coach-pagina in SyncJournal met het sleutelveld]

---

**Privacy, kort**

- Je sleutel blijft **op jouw apparaat**. Hij gaat nooit mee in een export, een back-up of Data overzetten.
- Je cijfers en notities gaan naar **Anthropic**, niet naar ons. Onder elk antwoord zie je bij **Wat is er verstuurd?**
  precies wat de coach kreeg.
- Liever geen bedragen of notities meesturen? Zet het uit in **Instellingen → AI-coach**.
- Je exchange-sleutels, je walletadres en je saldo gaan nooit mee.

**Lukt het niet?**

- *"Anthropic herkent deze sleutel niet"*: hij is verkeerd geplakt, verlopen of verwijderd. Maak een nieuwe.
- *"Je tegoed bij Anthropic is op"*: zet er tegoed bij in de console (Billing).
- *"Je limiet bij Anthropic is bereikt"*: verhoog je maandlimiet, of wacht tot volgende maand.
- *"Te veel vragen achter elkaar"* of *"Claude is overbelast"*: even wachten en opnieuw proberen.

Vragen? Drop ze hier in de thread. En vertel vooral wat je aan de coach hebt (of niet): eind januari doen we een korte
poll.
