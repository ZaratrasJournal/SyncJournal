// v12.119: visuele check Phase 2 sections op Playbook Analytics
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(__dirname, '../work/tradejournal.html');
const OUT = path.resolve(__dirname, 'screenshots/pb-phase2');

const TEST_TRADES = [];
const TEST_PB = {
  id: 'pb_test_phase2',
  name: '1H BOS+MSB',
  status: 'active',
  setupTags: ['BOS', 'MSB'],
  confirmations: ['Liquidity Sweep', 'OB'],
  pairs: ['BTC/USDT'],
  defaultGrade: 'A',
  criteria: [
    { id: 'c1', text: 'HTF-trend bevestigd', mandatory: true },
    { id: 'c2', text: 'Volume-spike op LTF BOS', mandatory: false },
    { id: 'c3', text: 'FOMO-check (3 min wachten)', mandatory: false },
  ],
  bigPicture: '', tape: '', intuition: '', oneLiner: '', stop: '', target: '', minRR: '',
  layers: [{ id: 'L1', timeframe: '1H', setups: ['BOS', 'MSB'], confirmations: ['Liquidity Sweep'] }],
  examples: [], antiCriteria: [], mistakePatterns: [], pairsExclude: [], sessions: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-05-08T00:00:00.000Z',
  schemaVersion: 1,
};

// Generate 10 BT trades with various outcomes + setup variations
const dates = ['2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-07','2026-01-09','2026-01-12','2026-04-05','2026-05-06','2026-05-08'];
const times = ['16:00','10:00','18:00','13:08','01:00','11:00','13:00','13:00','20:44','14:24'];
const directions = ['long','long','long','short','short','long','long','short','long','short'];
const exits = ['89030','89634','91261','93939','93478','90098','90733','73213','75559','95201'];
const sls = ['89400','90100','91900','93400','93000','89500','90200','73600','76000','94800']; // SL above entry for shorts
const entries = ['89030','89634','91261','93939','93478','90098','90733','73213','75559','95201'];

for (let i = 0; i < 10; i++) {
  const dir = directions[i];
  const entry = parseFloat(entries[i]);
  const sl = parseFloat(sls[i]);
  // Random win/loss outcome — 90% WR like Denny's screenshot
  const isWin = i !== 0 && i !== 5 && i !== 9; // 7 wins / 3 losses
  let exit;
  if (isWin) {
    // Profit exit: 1.5R-3R away from entry
    const r = 1 + Math.random() * 2;
    const move = Math.abs(entry - sl) * r;
    exit = dir === 'long' ? entry + move : entry - move;
  } else {
    exit = sl; // SL hit
  }
  TEST_TRADES.push({
    id: `bt_test_${i}`,
    source: 'manual',
    status: 'missed',
    simType: 'backtest',
    direction: dir,
    pair: 'BTC/USDT',
    entry: String(entry),
    stopLoss: String(sl),
    exit: String(Math.round(exit)),
    positionSize: '1000',
    positionSizeAsset: '0.0105',
    pnl: '',
    fees: '0',
    leverage: '10',
    date: dates[i],
    time: times[i],
    setupTags: ['BOS', 'MSB'],
    confirmationTags: i % 2 === 0 ? ['Liquidity Sweep'] : ['Liquidity Sweep', 'OB'],
    timeframeTags: ['1H'],
    emotionTags: i % 3 === 0 ? ['Geduldig'] : (i % 3 === 1 ? ['Kalm'] : ['FOMO']),
    mistakeTags: !isWin ? ['SL te krap'] : [],
    customTags: [],
    rating: isWin ? 4 : 2,
    screenshot: null,
    notes: '',
    links: [],
    layers: [{ id: 'L1', timeframe: '1H', setups: ['BOS', 'MSB'], confirmations: ['Liquidity Sweep'] }],
    manualOverrides: [],
    tradeGrade: i % 4 === 0 ? 'A+' : (i % 4 === 1 ? 'A' : (i % 4 === 2 ? 'B' : 'C')),
    complianceChecks: [],
    complianceScore: null,
    playbookId: 'pb_test_phase2',
    tpLevels: [],
    hindsightExit: '',
  });
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('console', msg => { if (msg.type()==='error' && !/BABEL/.test(msg.text())) console.error('CONSOLE:', msg.text()); });

  // Seed via localStorage — app falls back to localStorage als IDB leeg is
  await page.addInitScript(({trades, pb}) => {
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_playbooks', JSON.stringify([pb]));
    localStorage.setItem('tj_trades', JSON.stringify(trades));
    // Wipe IDB om zeker te zijn dat localStorage-fallback fired
    try { indexedDB.deleteDatabase('TradeJournalDB'); } catch(e) {}
  }, { trades: TEST_TRADES, pb: TEST_PB });

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // app boot

  // Navigate to Playbook tab
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const pb = btns.find(b => /^Playbook$/.test(b.textContent.trim()));
    if (pb) pb.click();
  });
  await page.waitForTimeout(800);

  // Click Analytics toggle
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const ab = btns.find(b => b.textContent && /Analytics/.test(b.textContent) && b.style.fontFamily?.includes('mono'));
    if (ab) ab.click();
    else {
      // Fallback: find button with 📊 emoji
      const ab2 = btns.find(b => /📊/.test(b.textContent));
      if (ab2) ab2.click();
    }
  });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT, '01-overview-fullpage.png'), fullPage: true });
  console.log('✓ 01-overview-fullpage');

  await browser.close();
})();
