// ==UserScript==
// @name         SyncJournal · backtest-inbox
// @namespace    syncjournal
// @version      1.2
// @updateURL    http://127.0.0.1:8765/syncjournal-inbox.user.js
// @downloadURL  http://127.0.0.1:8765/syncjournal-inbox.user.js
// @description  Haalt backtest-trades die Claude uit TradingView las automatisch in je journal (lokale inbox op deze pc).
// @match        https://work.syncjournal.nl/app*
// @match        https://syncjournal.nl/app*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==
/* Outside the journal on purpose (Denny 18-10-2026): the journal itself stays unchanged. Every 15 s, while the
   journal is open, this asks the local inbox server (scripts/backtest-inbox/server.js) for new files and merges
   their trades in the page itself, with the journal's own rules: sanitizeTrade + nextId, a safety snapshot
   first, then persist and render.
   Every logged backtest is a new trade (v1.2, Denny 18-10-2026), also when it has the same values as an earlier one.
   Each log carries its own inboxId; only that id is checked, so the same file never comes in twice (two open tabs). */
(function () {
  const SERVER = 'http://127.0.0.1:8765';
  const ELKE_MS = 15000;
  const vraag = (method, pad) => new Promise((ok, nee) => GM_xmlhttpRequest({ method, url: SERVER + pad, timeout: 5000,
    onload: r => { try { ok(JSON.parse(r.responseText)); } catch (e) { nee(e); } }, onerror: nee, ontimeout: nee }));

  // The journal keeps its trades in top-level `let` bindings, which only a script in the page itself can reach.
  const voegToe = (file, trades) => new Promise(ok => {
    const id = 'sjinbox' + Math.random().toString(36).slice(2);
    document.addEventListener(id, e => ok(JSON.parse(e.detail)), { once: true });
    const s = document.createElement('script');
    s.textContent = `(async()=>{const terug=d=>document.dispatchEvent(new CustomEvent(${JSON.stringify(id)},{detail:JSON.stringify(d)}));
      try{if(typeof T==='undefined'||typeof dovTradeKey!=='function'||typeof sanitizeTrade!=='function')return terug({wacht:true});
        const inc=${JSON.stringify(trades)}.filter(t=>t&&typeof t==='object');
        const al=new Set(T.filter(o=>o&&o.inboxId).map(o=>o.inboxId));
        const nieuw=inc.filter(t=>!t.inboxId||!al.has(t.inboxId));
        if(nieuw.length){try{await Snapshots.create('vóór backtest-inbox');}catch(e){}
          nieuw.forEach(t=>T.push(sanitizeTrade({...t},nextId())));persist();try{render();}catch(e){}
          try{toast('✓ '+nieuw.length+' backtest-trade'+(nieuw.length>1?'s':'')+' uit TradingView toegevoegd','ok');}catch(e){}}
        terug({nieuw:nieuw.length,overgeslagen:inc.length-nieuw.length});
      }catch(e){terug({fout:String(e&&e.message||e)});}})();`;
    document.documentElement.appendChild(s); s.remove();
  });

  let bezig = false;
  async function kijk() {
    if (bezig) return; bezig = true;
    try {
      const { bestanden } = await vraag('GET', '/trades');
      for (const b of bestanden || []) {
        if (b.fout) { console.warn('[backtest-inbox]', b.file, b.fout); continue; }
        const r = await voegToe(b.file, b.trades || []);
        if (r.wacht) break;                                   // journal still loading: next round
        if (r.fout) { console.warn('[backtest-inbox]', b.file, r.fout); continue; }
        await vraag('POST', '/verwerkt?file=' + encodeURIComponent(b.file));
        console.log('[backtest-inbox]', b.file, r);
      }
    } catch (e) { /* server not running: nothing to do */ }
    bezig = false;
  }
  setTimeout(kijk, 4000);
  setInterval(kijk, ELKE_MS);
})();
