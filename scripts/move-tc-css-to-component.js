// Verplaats tc-CSS van head <style> block naar TradeCardExport component (inline <style> tag).
// Het inline-style approach werkt gegarandeerd want React/Babel injecteert het bij component-mount.
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '../work/tradejournal.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');
const NL = html.includes('\r\n') ? '\r\n' : '\n';

// Find the tc-CSS block boundaries in head <style>
const startMarker = '/* === SHARE CARD v2';
const endMarker = '/* END SHARE CARD v2 */';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find CSS block boundaries');
  process.exit(1);
}
const blockEndIdx = endIdx + endMarker.length;

// Extract the CSS content (without the wrapping comments)
const cssBlock = html.slice(startIdx, blockEndIdx);
console.log('CSS block size:', cssBlock.length, 'bytes');

// Strip the head <style> injection
html = html.slice(0, startIdx) + html.slice(blockEndIdx).replace(/^[\r\n\s]+/, NL);

// Now find TradeCardExport function start
const tcStart = 'function TradeCardExport({trade,onClose}){';
const tcStartIdx = html.indexOf(tcStart);
if (tcStartIdx === -1) { console.error('TradeCardExport not found'); process.exit(1); }

// Insert <style> with the CSS via dangerouslySetInnerHTML right BEFORE the return statement.
// We find the first `return(<div onClick={onClose}` inside the function.
const returnMarker = 'return(<div onClick={onClose} style={{position:"fixed"';
const returnIdx = html.indexOf(returnMarker, tcStartIdx);
if (returnIdx === -1) { console.error('return marker not found'); process.exit(1); }

// Build the new return: wrap the existing div in a fragment with <style> first
const oldReturn = 'return(<div onClick={onClose}';
const newReturn = 'return(<>' + NL + '    <style dangerouslySetInnerHTML={{__html:TC_STYLE}}/>' + NL + '    <div onClick={onClose}';

// Replace ONLY this first occurrence within the function
const before = html.slice(0, returnIdx);
const after = html.slice(returnIdx);
const replaced = after.replace(oldReturn, newReturn);
html = before + replaced;

// Find the closing of return + function - the existing pattern is: `</div>);\n}\n` for end of function
// The return statement opens with `<div onClick={onClose}` and ends right before `}\n` (closing of function).
// We need to wrap with `</>` instead of just closing `</div>`.
// Find the "end of TradeCardExport" via the next `function ` keyword.
const nextFnIdx = html.indexOf(NL + 'function ', tcStartIdx + tcStart.length);
if (nextFnIdx === -1) { console.error('next function not found'); process.exit(1); }

// The function ends with `</div>);\r\n}\r\n` just before next function. Find that:
const endPattern = '</div>);' + NL + '}' + NL;
const endOfTcExport = html.lastIndexOf(endPattern, nextFnIdx);
if (endOfTcExport === -1 || endOfTcExport < tcStartIdx) {
  console.error('end of TradeCardExport return not found');
  process.exit(1);
}

// Replace the closing to add </> wrap
const newEnd = '</div></>);' + NL + '}' + NL;
html = html.slice(0, endOfTcExport) + newEnd + html.slice(endOfTcExport + endPattern.length);

// Now add TC_STYLE constant just before the function declaration
const tcStartIdxNew = html.indexOf(tcStart);
const tcStyleConst = NL + 'const TC_STYLE = ' + JSON.stringify(cssBlock) + ';' + NL + NL;
html = html.slice(0, tcStartIdxNew) + tcStyleConst + html.slice(tcStartIdxNew);

fs.writeFileSync(HTML_PATH, html);
console.log('Done. File size:', (html.length / 1024 / 1024).toFixed(2), 'MB');
