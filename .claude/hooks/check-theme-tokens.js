#!/usr/bin/env node
// PreToolUse hook — block Edit/Write op work/tradejournal.html
// als hardcoded theme-kleuren (wit/zwart/goud) in inline JSX style verschijnen
// zonder var(--...) wrapper.
//
// Achtergrond: CLAUDE.md voorschrift "nooit hardcoded #fff/#000/#C9A84C in JSX,
// gebruik var(--text|text2|gold|bg|...)". Deze hook dwingt het af.
//
// Niet-blokkerende edge-cases (whitelist):
//   - <style> CSS-blok met body.theme-X .sel {...}  → check enkel JSX inline
//   - data:image/... base64 strings                  → bevat # in payload
//   - regels die al var(--...) gebruiken naast een #fff → toch flag, edit moet schoon zijn

const fs = require('fs');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let input;
try { input = JSON.parse(raw); } catch { process.exit(0); }

const { tool_name, tool_input = {} } = input;
if (tool_name !== 'Edit' && tool_name !== 'Write') process.exit(0);

const filePath = tool_input.file_path || '';
// Check alleen work/tradejournal.html (de live dev-file)
if (!/[\\/]work[\\/]tradejournal\.html$/i.test(filePath)) process.exit(0);

const text = tool_input.new_string || tool_input.content || '';
if (!text) process.exit(0);

// Patterns: hardcoded colors die een var() vervanging zouden moeten zijn
const FORBIDDEN_RE = /#(?:fff|FFF|ffffff|FFFFFF|000|000000|C9A84C|c9a84c)\b|rgba?\(\s*255\s*,\s*255\s*,\s*255/g;

const lines = text.split('\n');
const hits = [];

lines.forEach((line, idx) => {
  // Alleen JSX inline-style regels (style={{...}}) — CSS in <style> blok mag wel
  if (!/style\s*=\s*\{\{/.test(line)) return;
  // Skip als regel data:image base64 bevat (toevallige # match)
  if (/data:image\//.test(line)) return;

  const matches = line.match(FORBIDDEN_RE);
  if (!matches) return;

  hits.push({ line: idx + 1, snippet: line.trim().slice(0, 140), found: matches });
});

if (hits.length === 0) process.exit(0);

console.error('');
console.error(`Theme-token check FAILED voor ${filePath}`);
console.error(`Reden: hardcoded kleur in JSX inline style — gebruik var(--...).`);
console.error('');
hits.slice(0, 6).forEach(h => {
  console.error(`  L~${h.line}: ${h.snippet}`);
  console.error(`         hardcoded: ${h.found.join(', ')}`);
});
if (hits.length > 6) console.error(`  ... en ${hits.length - 6} meer hits`);
console.error('');
console.error('Toegestane vervangingen:');
console.error('  #fff/wit       → var(--text)  of var(--text2)');
console.error('  #000/zwart     → var(--bg)    of var(--bg2)');
console.error('  #C9A84C goud   → var(--gold)  of var(--gold-dim)');
console.error('');
console.error('Of: per-thema override in <style> blok via body.theme-light .selector {...}.');
process.exit(2);
