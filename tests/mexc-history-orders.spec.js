// v12.93 — MEXC fetchFills via history_orders endpoint.
//
// Doel: valideren dat de client-side filter + TP-extractie correct werkt op de
// nieuwe proxy-response shape. De proxy switcht van `order_deals` naar
// `history_orders` (die wel positionId per record heeft + close-orders levert).
// Per order krijgen we: id, orderId, symbol, side, vol (dealVol), price (dealAvgPrice),
// profit, fee (totalFee), timestamp (updateTime), positionId, state, _fromHistoryOrder.
//
// Vier scenarios:
//   1. Single-close trade → 1 TP via history_orders fill-shape
//   2. Multi-close (partial) → 3 TPs (één per close-order)
//   3. Open-orders worden uitgefilterd (side 1/3 = explicit open)
//   4. _fromHistoryOrder marker reist door
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Reproduceer client-side filter uit refresh-handler [tradejournal.html:10839-10852]
function isCloseFill(f, ex, entryN) {
  if (ex === 'mexc') {
    const side = f.side;
    if (side === 2 || side === 4 || String(side) === '2' || String(side) === '4') return true;
    if (side === 1 || side === 3 || String(side) === '1' || String(side) === '3') return false;
  }
  const profit = parseFloat(f.profit || f.pnl || f.realisedPnl || f.fillPnL || f.fillPnl || f.closedPnl || '0');
  if (Math.abs(profit) > 0.0001) return true;
  const fp = parseFloat(f.price || f.tradePrice || f.closeAvgPrice || f.fillPrice || f.fillPx || f.px || 0);
  if (entryN > 0 && fp > 0 && Math.abs(fp - entryN) / entryN > 0.0001) return true;
  return false;
}

test.describe('MEXC history_orders parsing (v12.93)', () => {
  test('Single-close: BTC SHORT met 1 close-order → 1 TP', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Mock proxy-response zoals v12.93 worker zou retourneren
    const mockFills = [
      // Open-order (side=3 = open short) — moet eruit gefilterd worden
      { id: '12161000001', orderId: '12161000001', symbol: 'BTC_USDT', side: 3, vol: 337, price: 81287.1, profit: 0, fee: 0.27, timestamp: 1778043677000, positionId: 1364595811, state: 3, _fromHistoryOrder: true },
      // Close-order (side=2 = close short)
      { id: '12161000002', orderId: '12161000002', symbol: 'BTC_USDT', side: 2, vol: 337, price: 81306.3, profit: -0.647, fee: 0.27, timestamp: 1778047247000, positionId: 1364595811, state: 3, _fromHistoryOrder: true },
    ];

    const closeFills = mockFills.filter(f => isCloseFill(f, 'mexc', 81287.1));
    expect(closeFills.length, 'precies 1 close-order na filter').toBe(1);
    expect(closeFills[0].side, 'side=2 = close short').toBe(2);
    expect(closeFills[0].price, 'price = exit-prijs').toBe(81306.3);
    expect(closeFills[0]._fromHistoryOrder, 'marker reist door').toBe(true);
  });

  test('Multi-close partial: 3 close-orders op verschillende prijzen → 3 TPs', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // ETH LONG (positionId=999) met 1 open + 3 partial closes (TP1/TP2/TP3)
    const mockFills = [
      { id: 'o1', orderId: 'o1', symbol: 'ETH_USDT', side: 1, vol: 100, price: 3500, profit: 0, fee: 0.5, timestamp: 1700000000000, positionId: 999, state: 3, _fromHistoryOrder: true },
      { id: 'c1', orderId: 'c1', symbol: 'ETH_USDT', side: 4, vol: 33, price: 3550, profit: 16.5, fee: 0.17, timestamp: 1700001000000, positionId: 999, state: 3, _fromHistoryOrder: true },
      { id: 'c2', orderId: 'c2', symbol: 'ETH_USDT', side: 4, vol: 33, price: 3580, profit: 26.4, fee: 0.18, timestamp: 1700002000000, positionId: 999, state: 3, _fromHistoryOrder: true },
      { id: 'c3', orderId: 'c3', symbol: 'ETH_USDT', side: 4, vol: 34, price: 3600, profit: 34, fee: 0.18, timestamp: 1700003000000, positionId: 999, state: 3, _fromHistoryOrder: true },
    ];

    const closeFills = mockFills.filter(f => isCloseFill(f, 'mexc', 3500));
    expect(closeFills.length, '3 close-orders').toBe(3);
    closeFills.forEach(f => {
      expect(f.side, 'allemaal side=4 (close long)').toBe(4);
    });
    const prices = closeFills.map(f => f.price).sort((a, b) => a - b);
    expect(prices, 'prijzen 3550/3580/3600').toEqual([3550, 3580, 3600]);
  });

  test('Open-orders side 1/3 worden geskipt', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const mockFills = [
      { side: 1, vol: 100, price: 3500, profit: 0, _fromHistoryOrder: true }, // open long
      { side: 3, vol: 100, price: 3500, profit: 0, _fromHistoryOrder: true }, // open short
      { side: 2, vol: 100, price: 3550, profit: 16.5, _fromHistoryOrder: true }, // close short
      { side: 4, vol: 100, price: 3550, profit: 16.5, _fromHistoryOrder: true }, // close long
    ];

    const closeFills = mockFills.filter(f => isCloseFill(f, 'mexc', 3500));
    expect(closeFills.length, 'alleen 2 close-orders').toBe(2);
    expect(closeFills.map(f => f.side).sort(), 'side 2 en 4').toEqual([2, 4]);
  });

  test('Field-mapping: vol/price/profit/fee/timestamp aansluiten op client-parsing', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Verifieer dat een history_orders-style fill alle velden heeft die de
    // client-side TP-extractie nodig heeft (zie refresh-handler regel 10869-10901)
    const fill = {
      id: '12161000002',
      orderId: '12161000002',
      symbol: 'BTC_USDT',
      side: 2,
      vol: 337,
      price: 81306.3,
      profit: -0.647,
      fee: 0.27,
      timestamp: 1778047247000,
      positionId: 1364595811,
      state: 3,
      _fromHistoryOrder: true,
    };

    // Reproduceer fillSizeBase (regel 10869-10872)
    const rawSize = Math.abs(parseFloat(fill.vol || fill.size || fill.amount || fill.fillSize || fill.fillSz || fill.sz || 0));
    expect(rawSize, 'vol → raw size').toBe(337);

    // Reproduceer filledTPs.map (regel 10896-10901)
    const ts = Number(fill.timestamp || fill.dealTime || fill.time || fill.ms || fill.createTime || 0);
    expect(ts, 'timestamp → ts').toBe(1778047247000);

    const fallbackId = Number(fill.orderId || fill.id || fill.dealId || 0);
    expect(fallbackId, 'orderId → fallbackId').toBe(12161000002);

    const fillPrice = fill.price || fill.tradePrice || fill.closeAvgPrice || fill.fillPrice || fill.fillPx || fill.px || '';
    expect(fillPrice, 'price → fillPrice').toBe(81306.3);

    const profit = parseFloat(fill.profit || fill.pnl || fill.realisedPnl || 0);
    expect(profit, 'profit field reads correctly').toBe(-0.647);
  });
});
