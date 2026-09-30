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

| Regel | Bron | Account | Moet aan staan |
|---|---|---|---|
| Bezoekers | Cloudflare Web Analytics | jouw account (`CF_ACCOUNT_ID`) | het meetscript in de pagina's (sinds v1.3.4) |
| Worker | Worker-statistieken van `morani-proxy` | Morani's account (`CF_ACCOUNT_ID_WORKER`) | niets, altijd beschikbaar |
| Exchanges en fouten | Workers Analytics Engine, dataset `sj_proxy` | Morani's account | de monitoring in de Worker: `docs/worker-monitoring.md` |

Staat een bron nog niet aan, dan meldt het rapport dat in één regel en komt de rest gewoon door.

## Installeren op de NUC

Zoals ffalert: één installatiescript, met sudo. Het zet de code in `/opt/sj-dagrapport`, je
instellingen in `/etc/sj-dagrapport/dagrapport.env` (alleen leesbaar voor root en de dienst), het log
in `/var/lib/sj-dagrapport`, en een systemd-timer voor elke ochtend 08:00 Amsterdamse tijd. Stond de
NUC om 08:00 uit, dan komt het rapport zodra hij weer aanstaat.

**1. Instellingen invullen, op je laptop.** `dagrapport.env` staat in deze map (door git genegeerd;
de Telegram-token staat er al in). Vul de Cloudflare-regels in; de chat-id mag nog leeg, zie stap 3.

**2. Kopiëren en installeren**, vanaf je laptop in deze map:

```powershell
scp dagrapport-install.sh dagrapport.env nuc:~
```
```bash
ssh nuc
sudo bash dagrapport-install.sh dagrapport.env
```

Het installatiescript verplaatst `dagrapport.env` naar `/etc`; er blijft geen kopie met tokens in je
home staan. Zonder dat bestand installeert hij ook, met een leeg voorbeeld dat je daarna invult met
`sudo nano /etc/sj-dagrapport/dagrapport.env`.

**3. Controleren**, bron voor bron (stuurt niets):

```bash
sudo python3 /opt/sj-dagrapport/dagrapport.py controleer
```

Bij elke bron wil je gegevens zien, geen `FOUT`. Is de chat-id nog leeg, dan zoekt hij hem op: stuur
je bot eerst `/start` in Telegram, draai `controleer` opnieuw, en zet het getal dat hij
toont achter `TELEGRAM_CHAT_ID=` (`sudo nano /etc/sj-dagrapport/dagrapport.env`).

**4. Proberen:**

```bash
sudo python3 /opt/sj-dagrapport/dagrapport.py droog              # alleen tonen
sudo systemctl start sj-dagrapport && tail /var/lib/sj-dagrapport/dagrapport.log   # echt versturen
systemctl list-timers sj-dagrapport.timer                        # wanneer de volgende komt
```

**Bijwerken** na een wijziging: `python scripts/dagrapport/bouw-installer.py` op je laptop, dan
opnieuw `scp` + `sudo bash dagrapport-install.sh` (zonder `dagrapport.env`: je instellingen blijven
staan). Een rapport over een andere dag: `sudo python3 /opt/sj-dagrapport/dagrapport.py droog --datum 2026-09-29`.

## Testen

```bash
python test_dagrapport.py         # in deze map; geen netwerk nodig. Controleert ook dat de installer bij is.
```
