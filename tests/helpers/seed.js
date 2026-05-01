// Helpers voor het seeden van localStorage in Playwright-tests.
// Gebruik via `await page.addInitScript(seed, fixture)` ZODAT 't werkt vóór React mount.
//
// Belangrijk: alle keys hebben prefix `tj_` (zie CLAUDE.md). Niet zomaar andere keys
// zetten — anders krijg je schemaVersion-mismatches met migratie-code.

/**
 * Seedt localStorage met een fixture-object. Roep aan via page.addInitScript.
 * @param {{trades?: Array, config?: Object, accounts?: Array, playbooks?: Array}} fixture
 */
function seedLocalStorage(fixture){
  if(fixture.trades)localStorage.setItem("tj_trades",JSON.stringify(fixture.trades));
  if(fixture.config)localStorage.setItem("tj_config",JSON.stringify(fixture.config));
  if(fixture.accounts)localStorage.setItem("tj_accounts",JSON.stringify(fixture.accounts));
  if(fixture.playbooks)localStorage.setItem("tj_playbooks",JSON.stringify(fixture.playbooks));
  if(fixture.welcomed!==false)localStorage.setItem("tj_welcomed","1");// skip welcome modal
}

module.exports={seedLocalStorage};
