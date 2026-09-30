"""Maakt dagrapport-install.sh: één bestand dat het dagrapport op de NUC installeert.

    python scripts/dagrapport/bouw-installer.py

Draai dit na elke wijziging aan dagrapport.py of dagrapport.env.voorbeeld. De test
(test_dagrapport.py) faalt zolang de installer een oude versie van het script bevat.
"""
import os

MAP = os.path.dirname(os.path.abspath(__file__))
PY_EINDE, ENV_EINDE = 'SJ_DAGRAPPORT_PY', 'SJ_DAGRAPPORT_ENV'   # heredoc-grenzen; mogen niet als regel in de bronnen staan

KOP = r'''#!/usr/bin/env bash
# SyncJournal-dagrapport op de NUC installeren of bijwerken.
#
#   scp dagrapport-install.sh nuc:~                  (vanaf je laptop, in scripts/dagrapport)
#   ssh nuc
#   sudo bash dagrapport-install.sh
#
# Heb je dagrapport.env al ingevuld op je laptop? Stuur hem mee en geef hem op:
#   scp dagrapport-install.sh dagrapport.env nuc:~
#   sudo bash dagrapport-install.sh dagrapport.env   (wordt verplaatst naar /etc, met de juiste rechten)
#
# Opnieuw draaien = bijwerken: de code wordt vervangen, je instellingen blijven staan.
# GEGENEREERD door scripts/dagrapport/bouw-installer.py uit dagrapport.py — niet met de hand bewerken.
set -euo pipefail

NAAM=sj-dagrapport
GEBRUIKER=sjrapport
CODE=/opt/$NAAM
CONFIG=/etc/$NAAM
DATA=/var/lib/$NAAM

[ "$(id -u)" -eq 0 ] || { echo "Draai dit met sudo: sudo bash $0"; exit 1; }
PY=$(command -v python3) || { echo "python3 ontbreekt: sudo apt install python3"; exit 1; }
"$PY" -c 'import sys, zoneinfo; zoneinfo.ZoneInfo("Europe/Amsterdam")' 2>/dev/null \
  || { echo "Python 3.9 of nieuwer met tijdzones nodig (nu: $("$PY" --version)). Probeer: sudo apt install tzdata"; exit 1; }

id "$GEBRUIKER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$GEBRUIKER"
install -d -m 755 "$CODE"
install -d -m 750 -o root -g "$GEBRUIKER" "$CONFIG"
install -d -m 750 -o "$GEBRUIKER" -g "$GEBRUIKER" "$DATA"

cat > "$CODE/dagrapport.py" <<'SJ_DAGRAPPORT_PY'
'''

MIDDEN = r'''SJ_DAGRAPPORT_PY
chmod 755 "$CODE/dagrapport.py"

# Instellingen: meegegeven bestand wint; anders een leeg voorbeeld, maar alleen als er nog niets staat.
NIEUW=0
if [ -n "${1:-}" ]; then
  [ -f "$1" ] || { echo "Bestand $1 niet gevonden"; exit 1; }
  [ -f "$CONFIG/dagrapport.env" ] && cp -p "$CONFIG/dagrapport.env" "$CONFIG/dagrapport.env.vorige"
  install -m 640 -o root -g "$GEBRUIKER" "$1" "$CONFIG/dagrapport.env"
  rm -f "$1"
  echo "Instellingen uit $1 staan nu in $CONFIG/dagrapport.env (het bestand in je home is weg)."
elif [ ! -f "$CONFIG/dagrapport.env" ]; then
  cat > "$CONFIG/dagrapport.env" <<'SJ_DAGRAPPORT_ENV'
'''

STAART = r'''SJ_DAGRAPPORT_ENV
  NIEUW=1
fi
chown root:"$GEBRUIKER" "$CONFIG/dagrapport.env"
chmod 640 "$CONFIG/dagrapport.env"

cat > /etc/systemd/system/$NAAM.service <<EOF
[Unit]
Description=SyncJournal-dagrapport naar Telegram
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=$GEBRUIKER
ExecStart=$PY $CODE/dagrapport.py --config $CONFIG/dagrapport.env
StandardOutput=append:$DATA/dagrapport.log
StandardError=append:$DATA/dagrapport.log
EOF

# 08:00 Amsterdamse tijd, ook rond de klokwissel. Persistent: stond de NUC om 08:00 uit, dan
# komt het rapport zodra hij weer aanstaat.
cat > /etc/systemd/system/$NAAM.timer <<EOF
[Unit]
Description=SyncJournal-dagrapport elke ochtend om 08:00

[Timer]
OnCalendar=*-*-* 08:00:00 Europe/Amsterdam
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now $NAAM.timer >/dev/null

echo
echo "✓ SyncJournal-dagrapport geïnstalleerd."
echo "  code:         $CODE/dagrapport.py"
echo "  instellingen: $CONFIG/dagrapport.env"
echo "  log:          $DATA/dagrapport.log"
echo "  volgende:     $(systemctl list-timers $NAAM.timer --no-legend | awk '{print $1, $2, $3}')"
echo
if [ "$NIEUW" = 1 ]; then
  echo "Nu de tokens invullen:  sudo nano $CONFIG/dagrapport.env"
fi
echo "Controleren:            sudo python3 $CODE/dagrapport.py controleer"
echo "Proefrapport tonen:     sudo python3 $CODE/dagrapport.py droog"
echo "Nu echt versturen:      sudo systemctl start $NAAM && tail $DATA/dagrapport.log"
'''


def lees(naam):
    with open(os.path.join(MAP, naam), encoding='utf-8') as f:
        return f.read()


def bouw():
    py, env = lees('dagrapport.py'), lees('dagrapport.env.voorbeeld')
    for bron, grens in ((py, PY_EINDE), (env, ENV_EINDE)):
        if grens in bron.splitlines():
            raise SystemExit(f'{grens} staat als regel in een bron; kies een andere heredoc-grens')
    return KOP + py.rstrip('\n') + '\n' + MIDDEN + env.rstrip('\n') + '\n' + STAART


if __name__ == '__main__':
    doel = os.path.join(MAP, 'dagrapport-install.sh')
    # LF, ook op Windows: bash op de NUC struikelt over CRLF
    with open(doel, 'w', encoding='utf-8', newline='\n') as f:
        f.write(bouw())
    print('geschreven:', doel)
