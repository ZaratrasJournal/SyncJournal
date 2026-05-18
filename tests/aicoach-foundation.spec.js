// v12.135 — AI-coach foundation smoke-test.
// Verifieert:
//  - tab verschijnt ALLEEN met ?ai=1 (anders verborgen)
//  - AICoachPage rendert (alle 5 sub-secties zichtbaar)
//  - Master toggle persistent in localStorage
//  - BYOK key input + show/hide werkt
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

test.describe('AI-coach foundation',()=>{
  test('tab verborgen zonder ?ai=1',async({page})=>{
    await page.goto(FILE_URL,{waitUntil:'networkidle'});
    await page.waitForTimeout(500);
    const tabs=await page.locator('.tj-tabs button.tj-tab').allTextContents();
    expect(tabs.join(' ')).not.toMatch(/AI-coach/);
  });

  test('tab + page zichtbaar met ?ai=1',async({page})=>{
    // Pre-seed welcome-dismiss zodat de modal de screenshot niet blokkeert
    await page.addInitScript(()=>{localStorage.setItem('tj_welcomed','1');});
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(500);
    const tabs=await page.locator('.tj-tabs button.tj-tab').allTextContents();
    expect(tabs.join(' ')).toMatch(/AI-coach/);

    // Klik op tab — navigatie naar AI-coach page
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
      const b=btns.find(b=>b.textContent.includes('AI-coach'));
      if(b)b.click();
    });
    await page.waitForTimeout(300);

    // Alle 5 secties + Algemeen = 6
    const sections=await page.locator('.ai-section').count();
    expect(sections).toBe(6);

    // Sidebar nav-items aanwezig
    const navItems=await page.locator('.settings-sidebar a.settings-nav-item').allTextContents();
    expect(navItems.join(' ')).toMatch(/Algemeen/);
    expect(navItems.join(' ')).toMatch(/API-key/);
    expect(navItems.join(' ')).toMatch(/Pre-trade/);
    expect(navItems.join(' ')).toMatch(/Budget/);
    expect(navItems.join(' ')).toMatch(/Weekly/);
    expect(navItems.join(' ')).toMatch(/Privacy/);

    // Screenshot voor visuele review
    await page.screenshot({path:'tests/screenshots/aicoach-foundation.png',fullPage:true});
  });

  test('master toggle persistent in localStorage',async({page})=>{
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
      const b=btns.find(b=>b.textContent.includes('AI-coach'));
      if(b)b.click();
    });
    await page.waitForTimeout(300);

    // Klik master toggle (eerste checkbox in #sec-general)
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-general');
      const cb=sec&&sec.querySelector('input[type=checkbox]');
      if(cb)cb.click();
    });
    await page.waitForTimeout(200);

    const cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_config')||'{}'));
    expect(cfg.enabled).toBe(true);
  });

  test('BYOK toon/verberg key werkt',async({page})=>{
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
      const b=btns.find(b=>b.textContent.includes('AI-coach'));
      if(b)b.click();
    });
    await page.waitForTimeout(300);

    // Vul key + check type=password default
    const sel='#sec-byok input[placeholder^="sk-ant"]';
    await page.evaluate((s)=>{
      const inp=document.querySelector(s);
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp,'sk-ant-test-key-12345');
      inp.dispatchEvent(new Event('input',{bubbles:true}));
    },sel);
    await page.waitForTimeout(150);
    const t1=await page.locator(sel).getAttribute('type');
    expect(t1).toBe('password');

    // Klik "toon" knop
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('#sec-byok button'));
      const b=btns.find(b=>/toon|verberg/i.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForTimeout(150);
    const t2=await page.locator(sel).getAttribute('type');
    expect(t2).toBe('text');
  });
});
