# Worker v25 deployen — stappenplan

*Voor Zaratras, 25-10-2026. Backlog W5 + W1. Code: [worker-v25.js](worker-v25.js), test: `node tests/worker-v25.spec.js`.*

## Wat v25 anders doet

1. **OKX alleen nog naar OKX.** Tot nu toe kon wie de Worker aanriep zelf een OKX-adres meegeven (`okxHost`), en de Worker
   stuurde daar de getekende sleutelgegevens naartoe. Nu mag dat alleen `eea.okx.com`, `www.okx.com` of `us.okx.com`; al het
   andere wordt stil `eea.okx.com`. SyncJournal stuurt dat veld nooit mee, dus voor de leden verandert niets.
2. **Minder verzoeken bij OKX.** De actie voor de stop-loss haalde ook de gewone order-historie op (tot 10 verzoeken per sync);
   de app gebruikt die niet. Die verzoeken zijn weg.
3. **Welke websites de Worker mogen gebruiken.** Tot nu toe stond de deur open voor elke website (`*`). Eén schakelaar
   bovenin het bestand, `ORIGIN_MODUS`:
   - `'meten'` (zo staat hij nu): alles werkt zoals altijd, en het dagrapport toont per dag een regel
     **"Websites: syncjournal.nl … · localhost:8765 … · bestand (oude journal) … · zonder website …"**.
   - `'afdwingen'`: alleen de websites uit `ORIGINS` (syncjournal.nl, www, work), localhost/127.0.0.1 en de oude TradeJournal
     als bestand mogen nog. Een andere website krijgt "Origin niet toegestaan" (403), en dat telt in het dagrapport als
     uitkomst `origin`.

## Stap 1 · Deployen (5 minuten)

1. Cloudflare-dashboard → Workers & Pages → **morani-proxy** → **Edit code**.
2. Selecteer alles, plak de inhoud van `docs/worker-v25.js`, klik **Deploy**.
3. Controleer in SyncJournal: Instellingen → Accounts → **Sync** bij OKX en Kraken. Groen = goed.
4. Het dagrapport hoeft niet opnieuw geïnstalleerd voor de Worker; voor de nieuwe regel "Websites" wel:
   `python scripts/dagrapport/bouw-installer.py` op je laptop en daarna op de NUC
   `sudo bash dagrapport-install.sh` (zie `scripts/dagrapport/README.md`).

## Stap 2 · Een week meten

Lees een paar dagen de regel "Websites" in het dagrapport. Je ziet daar welk adres **Morani's journal** gebruikt (iets anders
dan syncjournal.nl, localhost of "bestand"). Vraag het Morani eventueel ook even.

## Stap 3 · Afdwingen

1. Open de Worker weer in het dashboard.
2. Zet bij `const ORIGINS = [` het adres van Morani's journal erbij, bijvoorbeeld `'https://journal.moranitraden.nl',`
   (precies zoals in het dagrapport, met `https://`, zonder `/` aan het eind).
3. Zet `const ORIGIN_MODUS = 'meten';` op `'afdwingen'`. Deploy.
4. Controleer: sync in SyncJournal werkt, en vraag Morani of zijn journal nog synct. Het dagrapport toont daarna onder de
   fouten eventueel `origin`: dat zijn geweigerde websites.

## Terugdraaien

Gaat er iets mis: plak `docs/worker-v24.js` terug en deploy, of zet alleen `ORIGIN_MODUS` terug op `'meten'`.

## Goed om te weten

De websitecontrole houdt alleen **browsers** tegen. Iemand met een eigen script kan de Worker nog steeds aanroepen; daarvoor is
de snelheidslimiet (binding `LIMIET`, zie [worker-monitoring.md](worker-monitoring.md)), die staat nog uit. Zet die aan
zodra je in het dagrapport de drukste minuut kent.
