#!/usr/bin/env python3
"""SyncJournal-dagrapport: de cijfers van gisteren uit Cloudflare, als één bericht in Telegram.

Draait dagelijks op de NUC via cron. Alleen de standaardbibliotheek van Python 3.9+, geen pakketten.

    python3 dagrapport.py                     rapport over gisteren naar Telegram
    python3 dagrapport.py droog               rapport alleen tonen, niet versturen
    python3 dagrapport.py controleer          elke bron los opvragen en tonen wat er terugkomt
    python3 dagrapport.py --datum 2026-09-29  rapport over een andere dag

Instellingen: dagrapport.env naast dit script, anders /etc/sj-dagrapport/dagrapport.env (daar zet
dagrapport-install.sh hem neer), of het bestand dat je met --config meegeeft. Uitleg: README.md.

Valt één bron weg (een API die niet antwoordt, een onderdeel dat nog niet aanstaat), dan komt het
rapport er toch, met een regel over wat er ontbrak. Een half rapport is beter dan geen rapport.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

AMS = ZoneInfo('Europe/Amsterdam')
CF_API = 'https://api.cloudflare.com/client/v4'
# Workers Free: 100.000 verzoeken per dag en 10 ms CPU per verzoek
DAGLIMIET_VERZOEKEN = 100_000
CPU_LIMIET_MS = 10
SYNCJOURNAL_CLIENT = 'syncjournal-web'   # het kenmerk dat de app meestuurt (CLIENT_TAG)
REEKS_DAGEN = 7          # hoe ver terug we kijken om "3e dag op rij" te tellen
DM_VANAF_DAGEN = 3       # een blijvende sleutelfout zo lang: tijd voor een berichtje aan dat lid

UITKOMST = {'ip-whitelist': 'IP-whitelist', 'sleutel': 'sleutel ongeldig', 'rate-limit': 'rate-limit',
            'exchange-fout': 'fout bij de exchange', 'verzoek': 'kapot verzoek', 'worker-fout': 'Worker-fout'}
BLIJVEND = {'ip-whitelist', 'sleutel'}   # gaat niet vanzelf over: het lid moet zijn koppeling herstellen
EXCHANGE_NAAM = {'okx': 'OKX', 'kraken': 'Kraken', 'mexc': 'MEXC', 'blofin': 'Blofin'}
DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']


# ── Instellingen ────────────────────────────────────────────────────────────────────────────
CONFIG_OP_DE_NUC = '/etc/sj-dagrapport/dagrapport.env'


def standaard_config():
    naast = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dagrapport.env')
    return naast if os.path.exists(naast) else CONFIG_OP_DE_NUC


def laad_config(pad):
    cfg = {'CF_WORKER': 'morani-proxy', 'CF_AE_DATASET': 'sj_proxy', 'HOST': 'syncjournal.nl'}
    if pad and os.path.exists(pad):
        with open(pad, encoding='utf-8') as f:
            for regel in f:
                regel = regel.strip()
                if regel and not regel.startswith('#') and '=' in regel:
                    k, v = regel.split('=', 1)
                    cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in list(cfg) + ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_WA_SITE_TAG', 'CF_ACCOUNT_ID_WORKER', 'CF_API_TOKEN_WORKER',
                          'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID']:
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def worker_account(cfg):
    """De Worker draait in Morani's account, de website in dat van Denny. Leeg = hetzelfde account."""
    return cfg.get('CF_ACCOUNT_ID_WORKER') or cfg.get('CF_ACCOUNT_ID'), cfg.get('CF_API_TOKEN_WORKER') or cfg.get('CF_API_TOKEN')


def veilig(waarde, naam):
    """Waarden die in een query belanden: alleen letters, cijfers, - _ en punt."""
    if not re.fullmatch(r'[A-Za-z0-9_.\-]+', str(waarde or '')):
        raise ValueError(f'{naam} ontbreekt of bevat vreemde tekens')
    return waarde


# ── Tijd: "gisteren" is een Amsterdamse dag ──────────────────────────────────────────────────
def dagvenster(dag):
    """Begin en eind (UTC) van een Amsterdamse kalenderdag; 23 of 25 uur rond de klokwissel."""
    van = datetime.combine(dag, time(0), AMS).astimezone(timezone.utc)
    tot = datetime.combine(dag + timedelta(days=1), time(0), AMS).astimezone(timezone.utc)
    return van, tot


def meetvenster(dag, nu=None):
    """Het venster dat we opvragen: de hele dag, of tot nu (op de minuut) als de dag nog loopt.
    Cloudflare's GraphQL geeft voor een inhoudelijk gelijke vraag een bewaard antwoord terug (gemeten
    30-09-2026: na ruim 20 minuten nog het oude). Een dag die nog loopt krijgt zo elke minuut een
    andere vraag, dus verse cijfers; een afgesloten dag verandert toch niet meer."""
    van, tot = dagvenster(dag)
    nu = (nu or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
    return van, min(tot, nu)


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


# ── HTTP ────────────────────────────────────────────────────────────────────────────────────
def _post(url, data, headers):
    """Eén POST. Los gehouden zodat de tests hem kunnen vervangen."""
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def graphql(token, query):
    status, tekst = _post(f'{CF_API}/graphql', json.dumps({'query': query}).encode(),
                          {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    if status != 200:
        raise RuntimeError(f'GraphQL HTTP {status}: {tekst[:200]}')
    d = json.loads(tekst)
    if d.get('errors'):
        raise RuntimeError('GraphQL: ' + '; '.join(e.get('message', '?') for e in d['errors'])[:300])
    return d['data']['viewer']['accounts'][0]


def ae_sql(cfg, sql):
    acc, token = worker_account(cfg)
    acc = veilig(acc, 'CF_ACCOUNT_ID_WORKER')
    status, tekst = _post(f'{CF_API}/accounts/{acc}/analytics_engine/sql', (sql + ' FORMAT JSON').encode(),
                          {'Authorization': f'Bearer {token}'})
    if status != 200:
        raise RuntimeError(f'Analytics Engine HTTP {status}: {tekst[:200]}')
    return json.loads(tekst).get('data', [])


def getal(x):
    """Analytics Engine geeft grote getallen soms als tekst terug."""
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


# ── Bronnen ─────────────────────────────────────────────────────────────────────────────────
def haal_bezoeken(cfg, van, tot):
    acc, site = veilig(cfg.get('CF_ACCOUNT_ID'), 'CF_ACCOUNT_ID'), veilig(cfg.get('CF_WA_SITE_TAG'), 'CF_WA_SITE_TAG')
    # bot: 0 — zonder bots, zoals het dashboard standaard toont ("Exclude bots: Yes")
    filt = f'filter: {{siteTag: "{site}", bot: 0, datetime_geq: "{iso(van)}", datetime_leq: "{iso(tot - timedelta(seconds=1))}"}}'

    def vraag(dims, limit):
        velden = f'dimensions {{ {dims} }}' if dims else ''
        q = (f'{{ viewer {{ accounts(filter: {{accountTag: "{acc}"}}) {{ rumPageloadEventsAdaptiveGroups(limit: {limit}, {filt}) '
             f'{{ count sum {{ visits }} {velden} }} }} }} }}')
        return graphql(cfg.get('CF_API_TOKEN'), q)['rumPageloadEventsAdaptiveGroups']

    totaal = vraag('', 1)
    uit = {'bezoeken': int(sum(getal(g['sum']['visits']) for g in totaal)), 'weergaven': int(sum(getal(g['count']) for g in totaal)), 'mist': []}
    # De uitsplitsingen elk los: bestaat een veld niet (meer), dan valt alleen die regel weg.
    for dim in ('requestHost', 'requestPath', 'countryName'):
        try:
            # per pagina weergaven: een bezoek telt alleen bij de pagina waar het begon, dus /app kreeg er 0
            veld = (lambda g: g['count']) if dim == 'requestPath' else (lambda g: g['sum']['visits'])
            uit[dim] = {g['dimensions'][dim] or '?': int(getal(veld(g))) for g in vraag(dim, 200)}
        except Exception as e:
            uit['mist'].append(f'{dim}: {e}')
    return uit


def haal_worker(cfg, van, tot):
    acc, token = worker_account(cfg)
    acc, naam = veilig(acc, 'CF_ACCOUNT_ID_WORKER'), veilig(cfg.get('CF_WORKER'), 'CF_WORKER')
    q = (f'{{ viewer {{ accounts(filter: {{accountTag: "{acc}"}}) {{ workersInvocationsAdaptive(limit: 100, '
         f'filter: {{scriptName: "{naam}", datetime_geq: "{iso(van)}", datetime_leq: "{iso(tot - timedelta(seconds=1))}"}}) '
         f'{{ sum {{ requests errors subrequests }} quantiles {{ cpuTimeP99 }} dimensions {{ status }} }} }} }} }}')
    groepen = graphql(token, q)['workersInvocationsAdaptive']
    per_status = defaultdict(int)
    for g in groepen:
        per_status[g['dimensions']['status']] += int(getal(g['sum']['requests']))
    cpu = max((getal(g['quantiles']['cpuTimeP99']) for g in groepen), default=0) / 1000   # microseconden → ms
    return {'verzoeken': sum(per_status.values()), 'per_status': dict(per_status), 'cpu_p99_ms': cpu}


def haal_exchanges(cfg, van, tot):
    ds = veilig(cfg.get('CF_AE_DATASET'), 'CF_AE_DATASET')
    v, t = int(van.timestamp()), int(tot.timestamp())
    gisteren = ae_sql(cfg, f"SELECT blob1 AS exchange, blob3 AS uitkomst, blob5 AS client, index1 AS koppeling, blob4 AS fout, "
                           f"SUM(_sample_interval) AS n FROM {ds} WHERE toUnixTimestamp(timestamp) >= {v} AND toUnixTimestamp(timestamp) < {t} "
                           f"GROUP BY exchange, uitkomst, client, koppeling, fout")
    # Per uur (een getal, los van tijdzones), zodat we hier zelf de Amsterdamse dag bepalen.
    eerder = ae_sql(cfg, f"SELECT toUnixTimestamp(toStartOfHour(timestamp)) AS uur, index1 AS koppeling, blob1 AS exchange, blob3 AS uitkomst, "
                         f"SUM(_sample_interval) AS n FROM {ds} WHERE toUnixTimestamp(timestamp) >= {v - REEKS_DAGEN * 86400} "
                         f"AND toUnixTimestamp(timestamp) < {t} AND blob3 != 'ok' GROUP BY uur, koppeling, exchange, uitkomst")
    # De drukste minuut: daarmee kies je een snelheidslimiet (binding LIMIET) die niemand raakt.
    piek = ae_sql(cfg, f"SELECT toUnixTimestamp(toStartOfMinute(timestamp)) AS minuut, SUM(_sample_interval) AS n FROM {ds} "
                       f"WHERE toUnixTimestamp(timestamp) >= {v} AND toUnixTimestamp(timestamp) < {t} GROUP BY minuut ORDER BY n DESC LIMIT 1")
    return {'gisteren': gisteren, 'eerder': eerder, 'piek': piek}


def reeks(eerder, dag, sleutel):
    """Hoeveel dagen op rij, eindigend op `dag`, deze koppeling deze fout gaf."""
    dagen = set()
    for r in eerder:
        if (r.get('koppeling'), r.get('exchange'), r.get('uitkomst')) == sleutel:
            dagen.add(datetime.fromtimestamp(int(getal(r['uur'])), AMS).date())
    n = 0
    while dag - timedelta(days=n) in dagen:
        n += 1
    return n


# ── Het bericht ─────────────────────────────────────────────────────────────────────────────
def nl(n):
    return f'{int(round(n)):,}'.replace(',', '.')


def pct(deel, geheel):
    if not geheel:
        return '0%'
    p = deel / geheel * 100
    return (f'{p:.1f}'.replace('.', ',') if p < 10 else f'{p:.0f}') + '%'


def korte_fout(e):
    return str(e).splitlines()[0][:160]


def pagina(pad):
    pad = (pad or '').split('?')[0].rstrip('/') or '/'
    if pad in ('/', '/index.html'):
        return 'landing'
    if pad in ('/app', '/app.html'):
        return 'app'
    if pad.startswith('/plan'):
        return 'plan'
    return 'overig'


def blok_bezoeken(b, host):
    regels = ['👥 Bezoekers']
    per_host = b.get('requestHost')
    bezoeken = per_host.get(host, 0) if per_host else b['bezoeken']
    regels.append(f"Bezoeken {nl(bezoeken)} · paginaweergaven {nl(b['weergaven'])}")
    if per_host:
        werk = sum(n for h, n in per_host.items() if h != host)
        if werk:
            regels[-1] += f' · werkversie {nl(werk)}'
    if b.get('requestPath'):
        per = defaultdict(int)
        for pad, n in b['requestPath'].items():
            per[pagina(pad)] += n
        regels.append('Weergaven: ' + ' · '.join(f'{k} {nl(per[k])}' for k in ('app', 'landing', 'plan', 'overig') if per[k]))
    if b.get('countryName'):
        tot = sum(b['countryName'].values())
        top = sorted(b['countryName'].items(), key=lambda x: -x[1])[:3]
        rest = tot - sum(n for _, n in top)
        regels.append(' · '.join(f'{land} {pct(n, tot)}' for land, n in top) + (f' · overig {pct(rest, tot)}' if rest else ''))
    return regels


def blok_worker(w, naam):
    s = w['per_status']
    fouten = s.get('scriptThrewException', 0) + s.get('internalError', 0)
    cpu = f"{w['cpu_p99_ms']:.1f}".replace('.', ',')
    return ['⚙️ Worker (' + naam + ')',
            f"{nl(w['verzoeken'])} verzoeken, {pct(w['verzoeken'], DAGLIMIET_VERZOEKEN)} van de daglimiet ({nl(DAGLIMIET_VERZOEKEN)})",
            f"Overbelast {nl(s.get('exceededResources', 0))} · Worker-fouten {nl(fouten)} · CPU p99 {cpu} ms (limiet {CPU_LIMIET_MS} ms)"]


def blok_exchanges(x, dag):
    rijen, eerder = x['gisteren'], x['eerder']
    totaal = sum(getal(r['n']) for r in rijen)
    sj, ander = defaultdict(float), 0.0
    for r in rijen:
        if r.get('client') == SYNCJOURNAL_CLIENT:
            sj[r.get('exchange') or '?'] += getal(r['n'])
        else:
            ander += getal(r['n'])
    regels = ['🔌 Exchanges via de Worker']
    volgorde = sorted(sj, key=lambda e: (list(EXCHANGE_NAAM).index(e) if e in EXCHANGE_NAAM else 9, e))
    regels.append('SyncJournal: ' + (' · '.join(f'{EXCHANGE_NAAM.get(e, e)} {nl(sj[e])}' for e in volgorde) or 'geen verzoeken'))
    if ander:
        regels.append(f'Oude journal en andere apps: {nl(ander)} verzoeken')
    if x.get('piek'):
        p = x['piek'][0]
        regels.append(f"Drukste minuut: {nl(getal(p['n']))} verzoeken, om {datetime.fromtimestamp(int(getal(p['minuut'])), AMS):%H:%M}")

    # fouten per (exchange, uitkomst): hoeveel keer, welke koppelingen, meest voorkomende tekst
    groep = defaultdict(lambda: {'n': 0.0, 'koppelingen': set(), 'teksten': defaultdict(float)})
    for r in rijen:
        if r.get('uitkomst') in (None, '', 'ok'):
            continue
        g = groep[(r.get('exchange') or '?', r['uitkomst'])]
        g['n'] += getal(r['n'])
        if r.get('koppeling'):
            g['koppelingen'].add(r['koppeling'])
        if r.get('fout'):
            g['teksten'][r['fout']] += getal(r['n'])
    if not groep:
        return regels + ['', '✅ Geen fouten']
    n_fout = sum(g['n'] for g in groep.values())
    alle_kopp = set().union(*(g['koppelingen'] for g in groep.values()))
    kop = f'⚠️ Fouten: {nl(n_fout)}× ({pct(n_fout, totaal)} van de verzoeken)'
    if alle_kopp:
        kop += f', {len(alle_kopp)} koppeling' + ('en' if len(alle_kopp) != 1 else '')
    regels += ['', kop]
    for (ex, uitk), g in sorted(groep.items(), key=lambda x: -x[1]['n']):
        regel = f'{EXCHANGE_NAAM.get(ex, ex)} · {UITKOMST.get(uitk, uitk)}: '
        if g['koppelingen']:
            delen = []
            for k in sorted(g['koppelingen']):
                d = reeks(eerder, dag, (k, ex, uitk))
                delen.append('nieuw' if d <= 1 else f'{d}e dag op rij')
                if uitk in BLIJVEND and d >= DM_VANAF_DAGEN:
                    delen[-1] += ' → DM sturen?'
            regel += f"{len(g['koppelingen'])} koppeling" + ('en' if len(g['koppelingen']) != 1 else '') + f" ({', '.join(delen)}), {nl(g['n'])}×"
        else:
            regel += f"{nl(g['n'])}×"
        if uitk not in BLIJVEND and g['teksten']:
            tekst = max(g['teksten'].items(), key=lambda x: x[1])[0]
            regel += f' — "{tekst[:70]}"'
        regels.append(regel)
    return regels


def maak_rapport(dag, cfg, bronnen):
    regels = [f'📊 SyncJournal — {DAGEN[dag.weekday()]} {dag.day} {MAANDEN[dag.month - 1]} {dag.year}', '']
    delen = [('bezoeken', 'Bezoekers', lambda b: blok_bezoeken(b, cfg.get('HOST', 'syncjournal.nl'))),
             ('worker', 'Worker', lambda w: blok_worker(w, cfg.get('CF_WORKER', 'morani-proxy'))),
             ('exchanges', 'Exchanges', lambda x: blok_exchanges(x, dag))]
    for sleutel, naam, maak in delen:
        b = bronnen.get(sleutel)
        if isinstance(b, Exception):
            regels.append(f'⚠ {naam} niet opgehaald: {korte_fout(b)}')
        elif b is not None:
            try:
                regels += maak(b)
            except Exception as e:   # een onverwacht antwoord mag de rest van het rapport niet kosten
                regels.append(f'⚠ {naam} niet te lezen: {korte_fout(e)}')
        regels.append('')
    return '\n'.join(regels).strip()


def verzamel(cfg, dag):
    van, tot = meetvenster(dag)
    bronnen = {}
    for sleutel, haal in (('bezoeken', haal_bezoeken), ('worker', haal_worker), ('exchanges', haal_exchanges)):
        try:
            bronnen[sleutel] = haal(cfg, van, tot)
        except Exception as e:
            bronnen[sleutel] = e
    return bronnen


def stuur_telegram(cfg, tekst):
    token = cfg.get('TELEGRAM_TOKEN', '')
    if not re.fullmatch(r'\d+:[A-Za-z0-9_\-]+', token) or not cfg.get('TELEGRAM_CHAT_ID'):
        raise ValueError('TELEGRAM_TOKEN of TELEGRAM_CHAT_ID ontbreekt')
    status, antwoord = _post(f'https://api.telegram.org/bot{token}/sendMessage',
                             json.dumps({'chat_id': cfg['TELEGRAM_CHAT_ID'], 'text': tekst[:4000], 'disable_web_page_preview': True}).encode(),
                             {'Content-Type': 'application/json'})
    if status != 200:
        raise RuntimeError(f'Telegram HTTP {status}: {antwoord[:200]}')


def controleer(cfg, dag):
    """Elke bron los, met de ruwe uitkomst of de fout: voor het eerste keer instellen."""
    ontbreekt = [k for k in ('CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_WA_SITE_TAG', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID') if not cfg.get(k)]
    print('Instellingen:', 'compleet' if not ontbreekt else 'ONTBREEKT ' + ', '.join(ontbreekt))
    van, tot = meetvenster(dag)
    for naam, haal in (('Bezoekers (Web Analytics)', haal_bezoeken), ('Worker-statistieken', haal_worker), ('Exchange-tellingen (Analytics Engine)', haal_exchanges)):
        print(f'\n── {naam} ──')
        try:
            print(json.dumps(haal(cfg, van, tot), indent=1, default=str, ensure_ascii=False)[:2000])
        except Exception as e:
            print('FOUT:', e)
    print('\n── Telegram ──')
    token = cfg.get('TELEGRAM_TOKEN', '')
    status, antwoord = _post(f'https://api.telegram.org/bot{token}/getMe', b'{}', {'Content-Type': 'application/json'}) if token else (0, 'geen token')
    print('OK:' if status == 200 else f'FOUT (HTTP {status}):', antwoord[:200])
    if status == 200 and not cfg.get('TELEGRAM_CHAT_ID'):
        # De chat-id staat in de berichten die de bot kreeg: stuur hem eerst zelf iets (/start).
        _, upd = _post(f'https://api.telegram.org/bot{token}/getUpdates', b'{}', {'Content-Type': 'application/json'})
        chats = {}
        for u in json.loads(upd).get('result', []):
            c = (u.get('message') or u.get('channel_post') or {}).get('chat') or {}
            if c.get('id') is not None:
                chats[c['id']] = c.get('first_name') or c.get('title') or c.get('type', '')
        if chats:
            print('TELEGRAM_CHAT_ID is nog leeg. Gevonden: ' + ', '.join(f'{i} ({n})' for i, n in chats.items())
                  + ' — zet de juiste in dagrapport.env.')
        else:
            print('TELEGRAM_CHAT_ID is nog leeg en de bot kreeg nog geen bericht. Stuur hem /start in Telegram en draai dit opnieuw.')


def main(argv=None):
    ap = argparse.ArgumentParser(description='SyncJournal-dagrapport naar Telegram')
    ap.add_argument('opdracht', nargs='?', default='stuur', choices=['stuur', 'droog', 'controleer'],
                    help='stuur (standaard): naar Telegram · droog: alleen tonen · controleer: elke bron los opvragen')
    ap.add_argument('--config', default=None, help=f'standaard dagrapport.env naast dit script, anders {CONFIG_OP_DE_NUC}')
    ap.add_argument('--datum', help='JJJJ-MM-DD, standaard gisteren')
    a = ap.parse_args(argv)
    pad = a.config or standaard_config()
    if not os.path.exists(pad):
        print(f'Geen instellingen gevonden ({pad}). Vul dagrapport.env in, zie README.md.', file=sys.stderr)
        return 1
    cfg = laad_config(pad)
    dag = date.fromisoformat(a.datum) if a.datum else datetime.now(AMS).date() - timedelta(days=1)
    if a.opdracht == 'controleer':
        controleer(cfg, dag)
        return 0
    tekst = maak_rapport(dag, cfg, verzamel(cfg, dag))
    if a.opdracht == 'droog':
        print(tekst)
        return 0
    stuur_telegram(cfg, tekst)
    print(f'{datetime.now(AMS):%Y-%m-%d %H:%M} rapport over {dag} verstuurd')
    return 0


if __name__ == '__main__':
    sys.exit(main())
