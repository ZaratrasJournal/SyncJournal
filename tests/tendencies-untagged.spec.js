// Tag-loze tendency-detectoren — verificatie dat users zónder setup/emotion/mistake/timeframe
// tags nog steeds patronen krijgen via de 5 tag-loze detectoren (#4 weekend, #8 pair × session,
// #9 direction-bias, #10 day-of-week, #11 overtrading-cluster).
//
// Plus de empty-state hint die zichtbaar moet zijn als <10% van de trades getagd is.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Genereert een dataset zonder tags die meerdere detectoren moet triggeren:
//   - 20 BTC long winners (US AM session) → pair × session sterke kant
//   - 12 ETH long losers (London AM session) → pair × session zwakke kant
//   - 8 BTC short losers → direction-bias trigger
//   - 2 clusters van 6 trades binnen 2u, beide verlies → overtrading
// Dates relatief t.o.v. nu, allemaal binnen 30d zodat de default period-filter niks afkapt.
function makeUntaggedTrades() {
  const trades = [];
  let id = 0;
  const now = new Date();
  const dateMinus = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString().split('T')[0];
  };
  const baseTrade = {
    entry: '50000', stopLoss: '49500', positionSize: '5000',
    positionSizeAsset: '0.1', leverage: '10', source: 'blofin', status: 'closed',
    setupTags: [], emotionTags: [], mistakeTags: [], timeframeTags: [], confirmationTags: [],
  };

  // 20 BTC LONG winners — US AM session (16:00 UTC = ~17:00 Amsterdam, valt in US AM 15:30-19:00)
  for (let i = 0; i < 20; i++) {
    trades.push({ ...baseTrade,
      id: `t_${++id}`,
      date: dateMinus(2 + (i % 14)),
      time: '16:00:00',
      pair: 'BTC/USDT', direction: 'long',
      exit: '50500', pnl: '25',
    });
  }

  // 12 ETH LONG losers — London AM session (10:00 Amsterdam = London AM 09:00-11:30)
  for (let i = 0; i < 12; i++) {
    trades.push({ ...baseTrade,
      id: `t_${++id}`,
      date: dateMinus(3 + i),
      time: '10:00:00',
      pair: 'ETH/USDT', direction: 'long',
      exit: '2980', entry: '3000', pnl: '-30',
      stopLoss: '2990', positionSize: '3000', positionSizeAsset: '1',
    });
  }

  // 8 BTC SHORT losers — direction-bias trigger (12 long winners exist, 8 short losers)
  for (let i = 0; i < 8; i++) {
    trades.push({ ...baseTrade,
      id: `t_${++id}`,
      date: dateMinus(4 + i),
      time: '17:00:00',
      pair: 'BTC/USDT', direction: 'short',
      exit: '50200', pnl: '-25',
    });
  }

  // 2 verlies-clusters van 6 trades binnen 2u → overtrading
  for (let cluster = 0; cluster < 2; cluster++) {
    const day = dateMinus(8 + cluster * 4);
    for (let i = 0; i < 6; i++) {
      const totalMinutes = 20 * i; // 0, 20, 40, 60, 80, 100 — alles binnen 2u
      const hh = String(13 + Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      trades.push({ ...baseTrade,
        id: `t_${++id}`,
        date: day,
        time: `${hh}:${mm}:00`,
        pair: 'BTC/USDT', direction: 'long',
        exit: '49900', pnl: '-20',
      });
    }
  }

  return trades;
}

test.describe('Tag-loze tendency-detectoren', () => {
  test('produceert ≥3 patronen op trades zonder tags + toont empty-state hint', async ({ page }) => {
    const fixture = { trades: makeUntaggedTrades() };
    await page.addInitScript(seedLocalStorage, fixture);
    // Skip alle milestone-modals (anders blokkeren ze klikken op de Tendencies-page)
    await page.addInitScript(() => {
      localStorage.setItem('tj_milestones_seen', JSON.stringify([
        'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
        'win-streak-5','win-streak-10','first-win'
      ]));
    });

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    // Navigeer via hash naar Tendencies-tab
    await page.evaluate(() => { window.location.hash = '#/tendencies'; });
    await page.waitForFunction(() => /Tendencies/i.test(document.body.innerText), { timeout: 5_000 });
    await page.waitForTimeout(800);

    // Periode op "Alles" zodat we niet door de 30d-filter beperkt worden bij CI-tijdzones
    const allBtn = page.getByRole('button', { name: 'Alles', exact: true }).last();
    if (await allBtn.isVisible({ timeout: 2_000 }).catch(()=>false)) {
      await allBtn.click();
      await page.waitForTimeout(300);
    }

    // Tel het aantal getoonde tendency-cards via de pnlSum-aggregaat-strip ("Cumulatief")
    const cardCount = await page.locator('div:has-text("Cumulatief")').filter({ hasText: 'Trades' }).count();
    console.log(`Tag-less detectors fired ${cardCount} card(s) zichtbaar`);
    expect(cardCount, 'minstens 3 tag-loze detectoren moeten triggeren').toBeGreaterThanOrEqual(3);

    // Empty-state hint moet zichtbaar zijn (taggedFrac=0 < 0.10)
    const html = await page.content();
    expect(html).toMatch(/Patronen-bibliotheek/);
    expect(html).toMatch(/van 11 actief/);

    // Specifieke detector-titles moeten verschijnen
    expect(html, 'overtrading-detector moet fired hebben').toMatch(/Overtrading.*verlies-burst/i);

    await page.screenshot({
      path: path.join(__dirname, 'screenshots/tendencies-untagged.png'),
      fullPage: true,
    });
  });

  test('hint kan gedismissed worden + verdwijnt persistent', async ({ page }) => {
    const fixture = { trades: makeUntaggedTrades() };
    await page.addInitScript(seedLocalStorage, fixture);
    await page.addInitScript(() => {
      // Skip alle milestone-modals zodat clicks niet onderschept worden.
      // BELANGRIJK: addInitScript draait OOK op page.reload() — dus geen
      // tj_tendencies_taghint_dismissed wegvegen, anders test-2 verliest persistentie.
      if(!localStorage.getItem('tj_milestones_seen')){
        localStorage.setItem('tj_milestones_seen', JSON.stringify([
          'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
          'win-streak-5','win-streak-10','first-win'
        ]));
      }
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tendencies'; });
    await page.waitForTimeout(800);

    // Hint moet eerst zichtbaar zijn
    const hintHeading = page.getByText(/Patronen-bibliotheek/i).first();
    await expect(hintHeading).toBeVisible({ timeout: 5_000 });

    // Klik op "Niet meer tonen"
    const dismissBtn = page.getByRole('button', { name: /Niet meer tonen/i });
    await dismissBtn.click();

    // Hint verdwijnt na click
    await expect(hintHeading).toBeHidden({ timeout: 3_000 });

    // localStorage-flag moet gezet zijn
    const flag = await page.evaluate(() => localStorage.getItem('tj_tendencies_taghint_dismissed'));
    expect(flag).toBe('1');

    // Reload — hint blijft weg
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tendencies'; });
    await page.waitForTimeout(800);
    await expect(page.getByText(/Patronen-bibliotheek/i)).toBeHidden({ timeout: 3_000 });
  });
});
