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
  // v12.233 (fase-4 audit): milestone-popup ("Eerste winst!" etc.) lag als overlay over de
  // UI zodra de seed-data winnende trades bevatte → click-timeouts in ~28 specs (flaky
  // cluster uit fase 1). Markeer alle milestones als gezien, tenzij een spec ze expliciet
  // wil testen via fixture.milestonesSeen === false.
  if(fixture.milestonesSeen!==false){
    const allIds=["trades-10","trades-50","trades-100","trades-250","trades-500","trades-1000","win-streak-5","win-streak-10","first-win"];
    localStorage.setItem("tj_milestones_seen",JSON.stringify(allIds));
  }
  // Backup-onboarding modal ("Even iets belangrijks") triggert bij ≥5 trades zonder
  // eerdere backup — DIT was de overlay die clicks blokkeerde in het flaky cluster.
  // Backup-reminder (≥7d) idem. Beide onderdrukken tenzij een spec ze expliciet test.
  if(fixture.backupModals!==false){
    localStorage.setItem("tj_backup_onboarding_shown","1");
    localStorage.setItem("tj_last_backup_at",String(Date.now()));
  }
}

module.exports={seedLocalStorage};
