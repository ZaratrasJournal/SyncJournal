# Dagrapport naar Telegram

Elke ochtend één bericht met de cijfers van gisteren: bezoekers, hoe druk de Worker het had, en
welke exchange-fouten leden kregen. Draait op de NUC via cron; alleen Python 3.9+, geen pakketten.

```
📊 SyncJournal — di 29 sep 2026

👥 Bezoekers
Bezoeken 118 · paginaweergaven 310 · werkversie 6
app 90 · landing 24 · plan 10
NL 81% · BE 12% · DE 4,0% · overig 3,2%

⚙️ Worker (morani-proxy)
4.210 verzoeken, 4,2% van de daglimiet (100.000)
Overbelast 0 · Worker-fouten 0 · CPU p99 3,1 ms (limiet 10 ms)

🔌 Exchanges via de Worker
SyncJournal: OKX 3.188 · Kraken 902
Oude journal en andere apps: 120 verzoeken

⚠️ Fouten: 190× (4,5% van de verzoeken), 3 koppelingen
OKX · IP-whitelist: 1 koppeling (3e dag op rij → DM sturen?), 180×
OKX · sleutel ongeldig: 1 koppeling (nieuw), 8×
Kraken · fout bij de exchange: 1 koppeling (nieuw), 2× — "System busy"
```

(voorbeeld uit de test, geen echte cijfers)

## Hoe je het leest

- **Fouten zijn verzoeken, geen mensen.** Een *koppeling* is één exchange-sleutel van één lid; je
  ziet niet wie. Sinds v1.3.4 stopt auto-sync bij een blijvende fout, dus één lid geeft dan nog maar
  een paar fouten per dag in plaats van honderden.
- **IP-whitelist / sleutel ongeldig** gaan niet vanzelf over. Staat er *3e dag op rij → DM sturen?*,
  dan ziet dat lid de melding in de app kennelijk niet: een berichtje in Discord helpt.
- **Fout bij de exchange** (met de meest voorkomende tekst) is meestal tijdelijk. Pas iets als het
  bij veel koppelingen tegelijk gebeurt: dan ligt de exchange eruit of is de API veranderd.
- **Blofin en Hyperliquid** staan er niet in: die gaan niet via de Worker.

## Waar de cijfers vandaan komen

| Regel | Bron | Moet aan staan |
|---|---|---|
| Bezoekers | Cloudflare Web Analytics | Web Analytics op het Pages-project |
| Worker | Worker-statistieken van `morani-proxy` | niets, altijd beschikbaar |
| Exchanges en fouten | Workers Analytics Engine, dataset `sj_proxy` | de monitoring in de Worker: `docs/worker-monitoring.md` |

Staat een bron nog niet aan, dan meldt het rapport dat in één regel en komt de rest gewoon door.

## Installeren op de NUC

1. **Kopieer deze map** vanaf je laptop (pas gebruiker en host aan):
   ```bash
   scp -r scripts/dagrapport denny@nuc:~/sj-dagrapport
   ```
2. **Instellingen**: op de NUC
   ```bash
   cd ~/sj-dagrapport
   cp dagrapport.env.voorbeeld dagrapport.env
   nano dagrapport.env          # tokens invullen, uitleg staat erin
   chmod 600 dagrapport.env
   ```
3. **Controleren**, bron voor bron (stuurt niets naar Telegram):
   ```bash
   python3 dagrapport.py --controleer
   ```
   Een `FOUT` bij één bron? Meestal ontbreekt een recht op het API-token of staat de bron nog niet aan.
4. **Proefrapport** in je terminal, en daarna echt:
   ```bash
   python3 dagrapport.py --droog
   python3 dagrapport.py
   ```
5. **Elke ochtend om 08:00**: `crontab -e` en deze regel toevoegen
   ```
   0 8 * * * /usr/bin/python3 /home/denny/sj-dagrapport/dagrapport.py >> /home/denny/sj-dagrapport/dagrapport.log 2>&1
   ```
   Cron gebruikt de tijdzone van de NUC: `timedatectl` moet `Europe/Amsterdam` tonen. Zo niet:
   `sudo timedatectl set-timezone Europe/Amsterdam`.

Een rapport over een andere dag: `python3 dagrapport.py --datum 2026-09-29`.

## Testen

```bash
python3 test_dagrapport.py        # in deze map, ook op de NUC; geen netwerk nodig
```
