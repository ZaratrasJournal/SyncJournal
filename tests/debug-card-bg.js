// Debug: open share modal voor dossier, dan inspect de tc-card computed styles.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1500 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });

  await page.addInitScript((fx) => {
    if (fx.trades) localStorage.setItem('tj_trades', JSON.stringify(fx.trades));
    if (fx.config) localStorage.setItem('tj_config', JSON.stringify(fx.config));
    if (fx.accounts) localStorage.setItem('tj_accounts', JSON.stringify(fx.accounts));
    if (fx.playbooks) localStorage.setItem('tj_playbooks', JSON.stringify(fx.playbooks));
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000','win-streak-5','win-streak-10','first-win']));
    window.location.hash = '#/trades';
  }, FIXTURE);

  const APP = path.resolve(__dirname, '../work/tradejournal.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => /Trades/i.test(document.body.innerText), { timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr')).filter(r => /WIN|LOSS|PARTIAL/.test(r.innerText));
    rows[0]?.click();
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /Deel kaart/i.test(b.innerText));
    btn?.click();
  });
  await page.waitForTimeout(1500);

  // Switch to dossier
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /^\s*Dossier/i.test(b.innerText));
    btn?.click();
  });
  await page.waitForTimeout(800);

  // Inspect computed styles on .tc-card
  const result = await page.evaluate(() => {
    const card = document.querySelector('.tc-card');
    if (!card) return { error: 'no card' };
    const cs = getComputedStyle(card);
    const parent = card.parentElement;
    const parentCs = parent ? getComputedStyle(parent) : null;
    return {
      cardClasses: card.className,
      cardBg: cs.backgroundColor,
      cardBgImage: cs.backgroundImage,
      cardWidth: cs.width,
      cardHeight: cs.height,
      parentClasses: parent?.className,
      parentBg: parentCs?.backgroundColor,
      // Find the tc-dir-X wrapper
      dirWrap: card.closest('[class*="tc-dir-"]')?.className,
      // Check FOUR keypoints in tc- CSS: early reactions, mid (cinema), late (mono)
      checkpoints: (() => {
        try {
          const s = document.styleSheets[2];
          const rules = Array.from(s.cssRules);
          const all = rules.map(r => r.cssText || '').join('\n');
          return {
            tcCard: all.indexOf('tc-card{position:relative;overflow:hidden;border-radius:20px') >= 0,
            tcVGood: all.indexOf('tc-v-goodfellas{') >= 0,
            tcVPablo: all.indexOf('tc-v-pablo{') >= 0,
            tcCinemaCard: all.indexOf('tc-dir-cinema .tc-card') >= 0,
            tcCinema16: all.indexOf('tc-cinema-16x9') >= 0,
            tcDossierCard: all.indexOf('tc-dir-dossier .tc-card') >= 0,
            tcDossier16: all.indexOf('tc-dossier-16x9') >= 0,
            tcMono16: all.indexOf('tc-mono-16x9') >= 0,
            sheetTotalLength: all.length,
          };
        } catch (e) { return 'err: ' + e.message; }
      })(),
    };
  });
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
