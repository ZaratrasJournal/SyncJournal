// Fase 4: performance-meting met 1000 trades (demo-dataset-1000.json).
// Ad-hoc runner (geen spec) — meet app-start en tab-switch-tijden, 2 runs.
// Gebruik: node tests/perf-measure.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const DATASET = JSON.parse(fs.readFileSync(path.join(__dirname, '../demo-dataset-1000.json'), 'utf8'));
  const APP = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').split(path.sep).join('/');
  const TABS = ['trades', 'analytics', 'calendar', 'review', 'playbook', 'tendencies', 'accounts', 'dashboard'];

  const b = await chromium.launch();
  for (let run = 1; run <= 2; run++) {
    const p = await b.newPage();
    await p.addInitScript((d) => {
      localStorage.setItem('tj_trades', JSON.stringify(d.trades));
      localStorage.setItem('tj_config', JSON.stringify({ ...(d.config || {}), accountsSchema: 2, theme: 'sync' }));
      localStorage.setItem('tj_accounts', JSON.stringify(d.accounts || []));
      localStorage.setItem('tj_playbooks', JSON.stringify(d.playbooks || []));
      localStorage.setItem('tj_tags', JSON.stringify(d.tagConfig || {}));
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_backup_onboarding_shown', '1');
      localStorage.setItem('tj_last_backup_at', String(Date.now()));
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000','win-streak-5','win-streak-10','first-win']));
    }, DATASET);

    const t0 = Date.now();
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 60_000 });
    const tInteractive = Date.now() - t0;
    // wacht tot trades geladen zijn (1000 in state → topbar/inhoud)
    await p.waitForFunction(() => {
      const ls = JSON.parse(localStorage.getItem('tj_trades') || '[]');
      return ls.length >= 1000;
    }, { timeout: 60_000 });
    const tLoaded = Date.now() - t0;

    const rows = [];
    for (const tab of TABS) {
      const s = Date.now();
      await p.evaluate((t) => { location.hash = '#/' + t; }, tab);
      // wacht tot React de tab gecommit heeft: dubbele rAF na hash-change
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      // plus settle: geen layout-shift meer (kort)
      await p.waitForTimeout(150);
      rows.push({ tab, ms: Date.now() - s - 150 });
    }
    console.log(`run ${run}: interactive ${tInteractive}ms · trades-loaded ${tLoaded}ms`);
    console.log('  tab-switches:', rows.map(r => `${r.tab} ${r.ms}ms`).join(' · '));
    await p.close();
  }
  await b.close();
})();
