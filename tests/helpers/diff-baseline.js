// Pixel-diff helper — vergelijkt actual screenshot tegen baseline,
// schrijft diff-image, retourneert ratio.
//
// Gebruikt pixelmatch (anti-aliasing aware) + pngjs.
// Threshold = per-pixel kleur-tolerantie (0.0 = exact, 1.0 = elke kleur OK).
// Default 0.15 = ~10% kleur-shift tolereren (anti-aliasing op tekst).
//
// Use case: dynamic content (live tickers, timestamps, mindset-quote rotatie)
// veroorzaakt altijd een kleine baseline-drift. We loggen ratio maar laten
// tests groen zolang ratio < softFailRatio (default 8% van pixels veranderd).
// Pas softFailRatio aan in design-review.spec.js als je strakker wilt.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
// pixelmatch v7 is ESM-only — dynamic import in async wrapper

/**
 * @param {string} actualPath - pad naar nieuwe screenshot
 * @param {string} baselinePath - pad naar baseline
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.15] - per-pixel kleur-tolerantie (0..1)
 * @param {string} [opts.diffPath] - waarheen de diff-image schrijven (optioneel)
 * @returns {Promise<{numDiff:number, total:number, ratio:number, missingBaseline?:boolean, sizeMismatch?:boolean}>}
 */
async function diffPng(actualPath, baselinePath, opts = {}) {
  const { default: pixelmatch } = await import('pixelmatch');
  const { threshold = 0.15, diffPath } = opts;

  if (!fs.existsSync(baselinePath)) {
    return { numDiff: 0, total: 0, ratio: 0, missingBaseline: true };
  }

  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));

  // Resize-mismatch is een hard fail — kan niet diffen
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      numDiff: actual.width * actual.height,
      total: actual.width * actual.height,
      ratio: 1,
      sizeMismatch: true,
    };
  }

  const { width, height } = actual;
  const diff = new PNG({ width, height });
  const numDiff = pixelmatch(actual.data, baseline.data, diff.data, width, height, {
    threshold,
    includeAA: false, // skip anti-alias pixels
  });

  if (diffPath && numDiff > 0) {
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return {
    numDiff,
    total: width * height,
    ratio: numDiff / (width * height),
  };
}

module.exports = { diffPng };
