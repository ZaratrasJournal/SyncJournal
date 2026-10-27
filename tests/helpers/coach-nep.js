// Nep-Anthropic voor de AI-coach-specs. NOOIT een echte sleutel, NOOIT een echte aanroep.
//
// Vervangt window.fetch in de pagina, alleen voor https://api.anthropic.com/v1/messages. Dat kan wat een
// Playwright-route niet kan: een antwoord in losse stukjes sturen (streaming), blijven hangen tot de app
// afbreekt (time-out, Stop), en een netwerkfout geven. Elk verzoek wordt bewaard in window.__nep.verzoeken.
//
// Een antwoord in de wachtrij (window.__nep.wachtrij, op volgorde) is één van:
//   { sse: ['event: …\ndata: …\n\n', …], pauze: ms }   gestreamd, stukjes met een pauze ertussen
//   { status: 401, json: {...} }                         een fout (of een gewoon JSON-antwoord bij 200)
//   { netwerk: true }                                    fetch faalt (geen verbinding)
//   { hangt: true }                                      geen enkel byte, tot de app afbreekt
// Is de wachtrij leeg, dan komt er een kort gestreamd "OK".
const API = 'https://api.anthropic.com/v1/messages';
const NEP = 'sk-ant-api03-NEPSLEUTEL-alleen-voor-specs-WXYZ';

const ev = (type, data) => 'event: ' + type + '\ndata: ' + JSON.stringify({ type, ...data }) + '\n\n';
const USAGE = { input_tokens: 1200, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

// Een volledig gestreamd bericht uit blokken: {type:'text', text} | {type:'tool_use', id, name, input} | {type:'thinking'}.
// Tekst gaat in `stukjes` delen, zodat de spec kan zien dat het antwoord binnenkomt terwijl het loopt.
function bericht(blokken, o) {
  o = o || {};
  const u = { ...USAGE, ...(o.usage || {}) };
  const uit = [ev('message_start', { message: { id: 'msg_nep', type: 'message', role: 'assistant', model: o.model || 'claude-sonnet-5-5', content: [], stop_reason: null,
    usage: { input_tokens: u.input_tokens, cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens, output_tokens: 1 } } }), ev('ping', {})];
  blokken.forEach((b, i) => {
    if (b.type === 'thinking') {
      uit.push(ev('content_block_start', { index: i, content_block: { type: 'thinking', thinking: '' } }));
      uit.push(ev('content_block_delta', { index: i, delta: { type: 'signature_delta', signature: 'sig_nep_' + i } }));
    } else if (b.type === 'tool_use') {
      uit.push(ev('content_block_start', { index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }));
      const js = JSON.stringify(b.input || {}), half = Math.ceil(js.length / 2);
      uit.push(ev('content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: js.slice(0, half) } }));
      uit.push(ev('content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: js.slice(half) } }));
    } else {
      uit.push(ev('content_block_start', { index: i, content_block: { type: 'text', text: '' } }));
      const n = o.stukjes || 1, t = b.text, stap = Math.ceil(t.length / n);
      for (let k = 0; k < t.length; k += stap) uit.push(ev('content_block_delta', { index: i, delta: { type: 'text_delta', text: t.slice(k, k + stap) } }));
    }
    uit.push(ev('content_block_stop', { index: i }));
  });
  uit.push(ev('message_delta', { delta: { stop_reason: o.stop || (blokken.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn') }, usage: { output_tokens: u.output_tokens || 80 } }));
  uit.push(ev('message_stop', {}));
  return uit;
}
const tekst = (t, o) => ({ sse: bericht([{ type: 'thinking' }, { type: 'text', text: t }], o), pauze: (o && o.pauze) || 0 });
const tools = (calls, o) => ({ sse: bericht([{ type: 'thinking' }, ...calls.map((c, i) => ({ type: 'tool_use', id: 'toolu_nep_' + i + '_' + c.name, name: c.name, input: c.input }))], o), pauze: 0 });
const fout = (status, type, message) => ({ status, json: { type: 'error', error: { type, message: message || type } } });

// Draait in de pagina: via p.evaluate (installeer) of als init-script vóór de app start (vooraf).
function nepFetch({ API, wachtrij }) {
    if (window.__nep) { window.__nep.wachtrij = []; window.__nep.verzoeken = []; return; }
    const echt = window.fetch.bind(window);
    window.__nep = { wachtrij: [], verzoeken: [] };
    const afgebroken = () => new DOMException('The user aborted a request.', 'AbortError');
    window.fetch = async (url, init) => {
      if (String(url) !== API) return echt(url, init);
      init = init || {};
      let body = {}; try { body = JSON.parse(init.body || '{}'); } catch (e) {}
      window.__nep.verzoeken.push({ url: String(url), method: init.method, headers: { ...(init.headers || {}) }, body });
      const a = window.__nep.wachtrij.shift() || { sse: ['event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":1}}}\n\n', 'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n', 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"OK"}}\n\n', 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}\n\n'] };
      const sig = init.signal;
      if (sig && sig.aborted) throw afgebroken();
      if (a.netwerk) throw new TypeError('Failed to fetch');
      if (a.hangt) return new Promise((_, rej) => { if (sig) sig.addEventListener('abort', () => rej(afgebroken())); });
      if (a.json) return new Response(JSON.stringify(a.json), { status: a.status || 200, headers: { 'content-type': 'application/json' } });
      const enc = new TextEncoder(); let i = 0;
      const stroom = new ReadableStream({
        start(c) { if (sig) sig.addEventListener('abort', () => { try { c.error(afgebroken()); } catch (e) {} }); },
        async pull(c) {
          if (i >= a.sse.length) { c.close(); return; }
          if (a.pauze) await new Promise(r => setTimeout(r, a.pauze));
          if (sig && sig.aborted) return;
          try { c.enqueue(enc.encode(a.sse[i++])); } catch (e) {}
        },
      });
      return new Response(stroom, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };
    if (wachtrij) window.__nep.wachtrij.push(...wachtrij);
}
async function installeer(p) { await p.evaluate(nepFetch, { API }); }
// Voor een app die bij het laden al verstuurt (een overdracht uit het plan): elke pagina in deze context krijgt
// de nep-fetch vóór haar eigen scripts, met deze antwoorden in de wachtrij.
const vooraf = (ctx, ...antwoorden) => ctx.addInitScript(nepFetch, { API, wachtrij: antwoorden });
const zet = (p, ...antwoorden) => p.evaluate(a => { window.__nep.wachtrij.push(...a); }, antwoorden);
const verzoeken = p => p.evaluate(() => window.__nep.verzoeken);
const sleutel = p => p.evaluate(k => { localStorage.setItem('sj_ai_key', k); render(); }, NEP);

module.exports = { API, NEP, ev, bericht, tekst, tools, fout, installeer, vooraf, zet, verzoeken, sleutel };
