// Backtest inbox for SyncJournal (Denny, 18-10-2026).
// Claude writes backtest trades read from TradingView as JSON files into the inbox folder; the Tampermonkey
// script (syncjournal-inbox.user.js) asks this server for them while the journal is open, merges them into the
// journal in the browser, and reports back so the file moves to verwerkt/. Listens on 127.0.0.1 only.
//
//   node scripts/backtest-inbox/server.js            (inbox: %USERPROFILE%\SyncJournal-inbox)
//   GET  /trades                → { bestanden: [{ file, trades }] }   files not yet processed
//   POST /verwerkt?file=<name>  → moves the file to verwerkt/
//   GET  /syncjournal-inbox.user.js → the Tampermonkey script (open this URL once to install it)
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');

const POORT = +process.env.SJ_POORT || 8765;   // the userscript expects 8765
const INBOX = process.env.SJ_INBOX || path.join(os.homedir(), 'SyncJournal-inbox');
const KLAAR = path.join(INBOX, 'verwerkt');
fs.mkdirSync(KLAAR, { recursive: true });

const veiligeNaam = n => /^[\w.-]+\.json$/.test(n || '');   // no paths, no traversal
const stuur = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  console.log(new Date().toLocaleTimeString('nl-NL'), req.method, url.pathname, req.headers.origin || '');
  try {
    if (req.method === 'GET' && url.pathname === '/trades') {
      const bestanden = fs.readdirSync(INBOX).filter(veiligeNaam).sort().map(file => {
        try { const d = JSON.parse(fs.readFileSync(path.join(INBOX, file), 'utf8')); return { file, trades: Array.isArray(d) ? d : (d.trades || []) }; }
        catch (e) { return { file, fout: 'geen geldige JSON' }; }
      });
      return stuur(res, 200, { bestanden });
    }
    if (req.method === 'GET' && url.pathname === '/syncjournal-inbox.user.js') {   // one-click install in Tampermonkey
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'syncjournal-inbox.user.js')));
    }
    if (req.method === 'POST' && url.pathname === '/verwerkt') {
      const file = url.searchParams.get('file');
      if (!veiligeNaam(file) || !fs.existsSync(path.join(INBOX, file))) return stuur(res, 404, { fout: 'onbekend bestand' });
      fs.renameSync(path.join(INBOX, file), path.join(KLAAR, file));
      return stuur(res, 200, { ok: true });
    }
    stuur(res, 404, { fout: 'onbekend' });
  } catch (e) { stuur(res, 500, { fout: String(e && e.message || e) }); }
}).listen(POORT, '127.0.0.1', () => console.log(`backtest-inbox op http://127.0.0.1:${POORT} · map ${INBOX}`));
