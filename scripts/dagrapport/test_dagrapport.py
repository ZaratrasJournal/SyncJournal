"""Tests voor het dagrapport, zonder netwerk: Cloudflare en Telegram zijn nagemaakt.

    python3 -m unittest scripts/dagrapport/test_dagrapport.py      (vanuit de repo)
    python3 test_dagrapport.py                                     (vanuit deze map, ook op de NUC)
"""
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dagrapport as dr  # noqa: E402

DAG = date(2026, 9, 29)
VAN, TOT = dr.dagvenster(DAG)
CFG = {'CF_API_TOKEN': 'geheim-token', 'CF_ACCOUNT_ID': 'abc123', 'CF_WA_SITE_TAG': 'site42', 'CF_WORKER': 'morani-proxy',
       'CF_AE_DATASET': 'sj_proxy', 'HOST': 'syncjournal.nl', 'TELEGRAM_TOKEN': '123:ABC', 'TELEGRAM_CHAT_ID': '42'}


def uur(dag, h=10):
    """Epoch van een uur op een Amsterdamse dag, zoals Analytics Engine hem teruggeeft (als tekst)."""
    return str(int(datetime(dag.year, dag.month, dag.day, h, tzinfo=dr.AMS).timestamp()))


class NepCloudflare:
    def __init__(self, **kw):
        self.kapot = kw.get('kapot', set())   # 'ae', 'worker', 'requestPath', ...
        self.gisteren = kw.get('gisteren', [
            {'exchange': 'okx', 'uitkomst': 'ok', 'client': 'syncjournal-web', 'koppeling': 'aaaa1111', 'fout': '', 'n': '3000'},
            {'exchange': 'kraken', 'uitkomst': 'ok', 'client': 'syncjournal-web', 'koppeling': 'bbbb2222', 'fout': '', 'n': '900'},
            {'exchange': 'okx', 'uitkomst': 'ok', 'client': 'onbekend', 'koppeling': '', 'fout': '', 'n': '120'},
            {'exchange': 'okx', 'uitkomst': 'ip-whitelist', 'client': 'syncjournal-web', 'koppeling': 'cccc3333', 'fout': 'OKX /api/v5/account/balance: Your IP [ip] is not included', 'n': '180'},
            {'exchange': 'okx', 'uitkomst': 'sleutel', 'client': 'syncjournal-web', 'koppeling': 'dddd4444', 'fout': 'Invalid OK-ACCESS-KEY', 'n': '8'},
            {'exchange': 'kraken', 'uitkomst': 'exchange-fout', 'client': 'syncjournal-web', 'koppeling': 'bbbb2222', 'fout': 'System busy', 'n': '2'},
        ])
        # cccc3333 had de IP-fout ook de twee dagen ervoor; dddd4444 alleen vandaag
        self.eerder = kw.get('eerder', [
            {'uur': uur(DAG - timedelta(days=2)), 'koppeling': 'cccc3333', 'exchange': 'okx', 'uitkomst': 'ip-whitelist', 'n': '190'},
            {'uur': uur(DAG - timedelta(days=1)), 'koppeling': 'cccc3333', 'exchange': 'okx', 'uitkomst': 'ip-whitelist', 'n': '190'},
            {'uur': uur(DAG), 'koppeling': 'cccc3333', 'exchange': 'okx', 'uitkomst': 'ip-whitelist', 'n': '180'},
            {'uur': uur(DAG), 'koppeling': 'dddd4444', 'exchange': 'okx', 'uitkomst': 'sleutel', 'n': '8'},
            {'uur': uur(DAG), 'koppeling': 'bbbb2222', 'exchange': 'kraken', 'uitkomst': 'exchange-fout', 'n': '2'},
        ])
        self.verzonden, self.vragen = [], []

    def __call__(self, url, data, headers):
        body = data.decode()
        self.vragen.append((url, body, headers))
        if url.endswith('/graphql'):
            q = json.loads(body)['query']
            if 'workersInvocationsAdaptive' in q:
                if 'worker' in self.kapot:
                    return 500, 'stuk'
                groepen = [{'sum': {'requests': 4180, 'errors': 0, 'subrequests': 5000}, 'quantiles': {'cpuTimeP99': 3100}, 'dimensions': {'status': 'success'}},
                           {'sum': {'requests': 30, 'errors': 0, 'subrequests': 0}, 'quantiles': {'cpuTimeP99': 1200}, 'dimensions': {'status': 'clientDisconnected'}}]
                return 200, json.dumps({'data': {'viewer': {'accounts': [{'workersInvocationsAdaptive': groepen}]}}})
            for dim, groepen in (('requestHost', [('syncjournal.nl', 118), ('work.syncjournal.nl', 6)]),
                                 ('requestPath', [('/app', 90), ('/', 24), ('/plan/', 10)]),
                                 ('countryName', [('NL', 100), ('BE', 15), ('DE', 5), ('ES', 4)])):
                if f'dimensions {{ {dim} }}' in q:
                    if dim in self.kapot:
                        return 200, json.dumps({'errors': [{'message': f'unknown field "{dim}"'}]})
                    rijen = [{'count': n * 2, 'sum': {'visits': n}, 'dimensions': {dim: k}} for k, n in groepen]
                    return 200, json.dumps({'data': {'viewer': {'accounts': [{'rumPageloadEventsAdaptiveGroups': rijen}]}}})
            return 200, json.dumps({'data': {'viewer': {'accounts': [{'rumPageloadEventsAdaptiveGroups': [{'count': 310, 'sum': {'visits': 124}}]}]}}})
        if '/analytics_engine/sql' in url:
            if 'ae' in self.kapot:
                return 500, '{"errors":[{"message":"dataset not found"}]}'
            rijen = self.eerder if 'toStartOfHour' in body else self.gisteren
            return 200, json.dumps({'meta': [], 'data': rijen, 'rows': len(rijen)})
        if 'api.telegram.org' in url:
            if url.endswith('/sendMessage'):
                self.verzonden.append(json.loads(body))
            return 200, '{"ok":true}'
        raise AssertionError('onverwachte URL ' + url)


class Tests(unittest.TestCase):
    def rapport(self, **kw):
        nep = NepCloudflare(**kw)
        dr._post = nep
        return dr.maak_rapport(DAG, CFG, dr.verzamel(CFG, DAG)), nep

    def test_dag_is_een_amsterdamse_dag(self):
        self.assertEqual(dr.iso(VAN), '2026-09-28T22:00:00Z')
        self.assertEqual(dr.iso(TOT), '2026-09-29T22:00:00Z')

    def test_klokwissel_geeft_een_dag_van_25_uur(self):
        van, tot = dr.dagvenster(date(2026, 10, 25))
        self.assertEqual(tot - van, timedelta(hours=25))
        self.assertEqual(dr.iso(van), '2026-10-24T22:00:00Z')

    def test_volledig_rapport(self):
        tekst, nep = self.rapport()
        print('\n' + tekst)
        self.assertIn('📊 SyncJournal — di 29 sep 2026', tekst)
        self.assertIn('Bezoeken 118 · paginaweergaven 310 · werkversie 6', tekst)
        self.assertIn('app 90 · landing 24 · plan 10', tekst)
        self.assertIn('NL 81% · BE 12% · DE 4,0% · overig 3,2%', tekst)
        self.assertIn('4.210 verzoeken, 4,2% van de daglimiet (100.000)', tekst)
        self.assertIn('Overbelast 0 · Worker-fouten 0 · CPU p99 3,1 ms (limiet 10 ms)', tekst)
        self.assertIn('SyncJournal: OKX 3.188 · Kraken 902', tekst)
        self.assertIn('Oude journal en andere apps: 120 verzoeken', tekst)
        self.assertIn('OKX · IP-whitelist: 1 koppeling (3e dag op rij → DM sturen?), 180×', tekst)
        self.assertIn('OKX · sleutel ongeldig: 1 koppeling (nieuw), 8×', tekst)
        self.assertIn('Kraken · fout bij de exchange: 1 koppeling (nieuw), 2× — "System busy"', tekst)
        self.assertIn('⚠️ Fouten: 190× (4,5% van de verzoeken), 3 koppelingen', tekst)

    def test_queries_vragen_precies_gisteren_en_bevatten_geen_token(self):
        _, nep = self.rapport()
        sql = [b for u, b, _ in nep.vragen if 'analytics_engine' in u]
        self.assertTrue(all(f'>= {int(VAN.timestamp())}' in s or f'>= {int(VAN.timestamp()) - 7 * 86400}' in s for s in sql), sql)
        self.assertTrue(all(f'< {int(TOT.timestamp())}' in s for s in sql), sql)
        self.assertFalse(any('geheim-token' in b for _, b, _ in nep.vragen))
        self.assertTrue(all(h.get('Authorization') == 'Bearer geheim-token' for u, _, h in nep.vragen if 'cloudflare' in u))

    def test_geen_fouten(self):
        tekst, _ = self.rapport(gisteren=[{'exchange': 'okx', 'uitkomst': 'ok', 'client': 'syncjournal-web', 'koppeling': 'a', 'fout': '', 'n': '50'}], eerder=[])
        self.assertIn('✅ Geen fouten', tekst)
        self.assertNotIn('⚠️', tekst)

    def test_zonder_vingerafdruk_alleen_aantallen(self):
        tekst, _ = self.rapport(gisteren=[{'exchange': 'okx', 'uitkomst': 'sleutel', 'client': 'syncjournal-web', 'koppeling': '', 'fout': 'x', 'n': '12'}], eerder=[])
        self.assertIn('OKX · sleutel ongeldig: 12×', tekst)

    def test_een_bron_valt_weg_de_rest_komt_door(self):
        tekst, _ = self.rapport(kapot={'ae'})
        self.assertIn('⚠ Exchanges niet opgehaald: Analytics Engine HTTP 500', tekst)
        self.assertIn('Bezoeken 118', tekst)
        self.assertIn('4.210 verzoeken', tekst)

    def test_een_uitsplitsing_ontbreekt_alleen_die_regel_valt_weg(self):
        tekst, _ = self.rapport(kapot={'requestPath', 'requestHost'})
        self.assertIn('Bezoeken 124 · paginaweergaven 310', tekst)   # zonder host-uitsplitsing: alle bezoeken
        self.assertNotIn('landing', tekst)
        self.assertIn('NL 81%', tekst)

    def test_worker_statistieken_weg(self):
        tekst, _ = self.rapport(kapot={'worker'})
        self.assertIn('⚠ Worker niet opgehaald: GraphQL HTTP 500', tekst)

    def test_vreemde_tekens_in_de_instellingen_komen_niet_in_een_query(self):
        cfg = dict(CFG, CF_WA_SITE_TAG='x"}) { evil }')
        dr._post = NepCloudflare()
        tekst = dr.maak_rapport(DAG, cfg, dr.verzamel(cfg, DAG))
        self.assertIn('⚠ Bezoekers niet opgehaald: CF_WA_SITE_TAG ontbreekt of bevat vreemde tekens', tekst)

    def test_worker_in_een_ander_account(self):
        cfg = dict(CFG, CF_ACCOUNT_ID_WORKER='morani99', CF_API_TOKEN_WORKER='morani-token')
        nep = NepCloudflare()
        dr._post = nep
        dr.maak_rapport(DAG, cfg, dr.verzamel(cfg, DAG))
        wa = [(b, h) for u, b, h in nep.vragen if u.endswith('/graphql') and 'rumPageload' in b]
        wk = [(b, h) for u, b, h in nep.vragen if u.endswith('/graphql') and 'workersInvocations' in b]
        ae = [(u, h) for u, b, h in nep.vragen if 'analytics_engine' in u]
        self.assertTrue(wa and all('abc123' in b and h['Authorization'] == 'Bearer geheim-token' for b, h in wa))
        self.assertTrue(wk and all('morani99' in b and h['Authorization'] == 'Bearer morani-token' for b, h in wk))
        self.assertTrue(ae and all('/accounts/morani99/' in u and h['Authorization'] == 'Bearer morani-token' for u, h in ae))

    def test_versturen_en_droog(self):
        with tempfile.TemporaryDirectory() as d:
            pad = os.path.join(d, 'dagrapport.env')
            with open(pad, 'w', encoding='utf-8') as f:
                f.write('# test\n' + '\n'.join(f'{k}={v}' for k, v in CFG.items()) + '\n')
            nep = NepCloudflare()
            dr._post = nep
            self.assertEqual(dr.main(['--config', pad, '--datum', '2026-09-29', '--droog']), 0)
            self.assertEqual(nep.verzonden, [])
            self.assertEqual(dr.main(['--config', pad, '--datum', '2026-09-29']), 0)
            self.assertEqual(len(nep.verzonden), 1)
            self.assertEqual(nep.verzonden[0]['chat_id'], '42')
            self.assertIn('📊 SyncJournal — di 29 sep 2026', nep.verzonden[0]['text'])

    def test_zonder_telegram_token_een_duidelijke_fout(self):
        with self.assertRaisesRegex(ValueError, 'TELEGRAM_TOKEN'):
            dr.stuur_telegram(dict(CFG, TELEGRAM_TOKEN=''), 'x')


if __name__ == '__main__':
    unittest.main(verbosity=2)
