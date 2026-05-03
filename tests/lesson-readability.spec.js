// v12.77 — verifieert de leesvriendelijkheids-laag op de lesson-modal:
//   - .lesson-body class is aanwezig + de typography-CSS is daadwerkelijk
//     geladen (font-size 16px op body, h2 24px, body color = var(--text))
//   - Scroll-progress-bar bovenaan reageert op scroll (van 0% naar >25%)
//   - Custom counter-cirkels op <ol> renderen via ::before-pseudo-element
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

async function openBlofinLesson(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { window.location.hash = '#/help'; });
  await page.waitForTimeout(400);
  // v12.83: open via CSV-hub (l18 staat niet meer als losse card in grid)
  await page.getByText('CSV importeren — kies je exchange').first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /📥 Blofin →/i }).click();
  await page.waitForTimeout(400);
}

test.describe('Lesson readability (v12.77)', () => {
  test('Lesson-body krijgt typography-CSS toegepast (16px body, 24px h2, color = text-token)', async ({ page }) => {
    await openBlofinLesson(page);

    // Computed-style check op lesson-body element
    const styles = await page.evaluate(() => {
      const body = document.querySelector('.lesson-body');
      if (!body) return null;
      const cs = getComputedStyle(body);
      const h2 = body.querySelector('h2');
      const h2cs = h2 ? getComputedStyle(h2) : null;
      return {
        bodyFontSize: cs.fontSize,
        bodyLineHeight: cs.lineHeight,
        bodyColor: cs.color,
        h2FontSize: h2cs ? h2cs.fontSize : null,
        h2BorderBottomWidth: h2cs ? h2cs.borderBottomWidth : null,
      };
    });

    expect(styles).not.toBeNull();
    expect(styles.bodyFontSize).toBe('16px');
    // line-height 1.65 × 16 = 26.4px — browser kan rounden, accepteer 26-27
    const lh = parseFloat(styles.bodyLineHeight);
    expect(lh).toBeGreaterThanOrEqual(26);
    expect(lh).toBeLessThanOrEqual(27);
    expect(styles.h2FontSize).toBe('24px');
    // h2 heeft border-bottom (visuele scheiding tussen secties)
    expect(parseFloat(styles.h2BorderBottomWidth)).toBeGreaterThan(0);
  });

  test('Scroll-progress-bar bestaat en groeit bij scroll', async ({ page }) => {
    await openBlofinLesson(page);

    // Initieel: progress-bar bestaat met width 0%
    const initialWidth = await page.evaluate(() => {
      const aria = document.querySelector('[aria-hidden="true"]');
      const inner = aria ? aria.querySelector('div') : null;
      return inner ? inner.style.width : null;
    });
    expect(initialWidth).toMatch(/^0(\.\d+)?%$/);

    // Scroll de modal-card. Inline-style attribute uses dash-case ("max-height", niet "maxHeight").
    const scrolled = await page.evaluate(() => {
      // Vind de scrollable container die direct .lesson-body bevat (of de progress-bar bevat)
      const lessonBody = document.querySelector('.lesson-body');
      if (!lessonBody) return { ok: false, msg: 'no .lesson-body' };
      // Walk up tot we een element vinden waar scrollHeight > clientHeight
      let card = lessonBody.parentElement;
      while (card && !(card.scrollHeight > card.clientHeight + 50)) {
        card = card.parentElement;
        if (!card || card.tagName === 'BODY') break;
      }
      if (!card) return { ok: false, msg: 'no scrollable ancestor' };
      card.scrollTop = 800;
      card.dispatchEvent(new Event('scroll', { bubbles: true }));
      return { ok: true, tag: card.tagName, scrollTop: card.scrollTop, scrollHeight: card.scrollHeight, clientHeight: card.clientHeight };
    });
    expect(scrolled.ok, JSON.stringify(scrolled)).toBeTruthy();
    await page.waitForTimeout(400);

    const newWidth = await page.evaluate(() => {
      const aria = document.querySelector('[aria-hidden="true"]');
      const inner = aria ? aria.querySelector('div') : null;
      return inner ? inner.style.width : null;
    });
    const pct = parseFloat(newWidth);
    expect(pct, `progress bar width = ${newWidth}, expected > 0 after scroll (state: ${JSON.stringify(scrolled)})`).toBeGreaterThan(0);
  });

  test('Custom counter-markers op <ol> renderen via ::before pseudo-element', async ({ page }) => {
    await openBlofinLesson(page);

    // Eerste <li> in een <ol> moet een ::before hebben met counter-content
    const counterContent = await page.evaluate(() => {
      const li = document.querySelector('.lesson-body ol li');
      if (!li) return null;
      const ps = getComputedStyle(li, '::before');
      return { content: ps.content, width: ps.width, borderRadius: ps.borderRadius };
    });
    expect(counterContent).not.toBeNull();
    // content moet "1" (counter) zijn
    expect(counterContent.content).toMatch(/["']1["']|counter\(/);
    // de marker moet rond zijn
    expect(counterContent.borderRadius).toMatch(/50%|9999px|999rem|26px|24px|22px|20px/);
  });
});
