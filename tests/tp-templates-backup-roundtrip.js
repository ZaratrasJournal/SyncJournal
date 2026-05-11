// v12.123 Fase 4: backup round-trip test voor tp-templates + tp-defaults.
// Simuleert wat exportTrades + handleBackup/handleDrop doen.

const PRE_BUILT=[
  {id:"equal_default",name:"Equal",distributions:{"1":[100],"2":[50,50],"3":[34,33,33],"4":[25,25,25,25],"5":[20,20,20,20,20]}},
  {id:"frontloaded_default",name:"Front-loaded",distributions:{"1":[100],"2":[70,30],"3":[50,30,20],"4":[40,30,20,10],"5":[40,25,15,10,10]}},
];
const DEFAULTS={"1":"equal_default","2":"equal_default","3":"frontloaded_default","4":"equal_default","5":"equal_default"};

// Simuleer exportTrades payload-shape
function exportPayload(state){
  return{
    version:12,schemaVersion:12,exportDate:new Date().toISOString(),
    trades:state.trades||[],
    tagConfig:state.tagConfig||{},
    accounts:state.accounts||[],
    config:state.config||{},
    playbooks:state.playbooks||[],
    tpTemplates:state.tpTemplates||[],
    tpDefaults:state.tpDefaults||{},
  };
}

// Simuleer wat handleBackup/handleDrop doen bij restore
function restoreFromBackup(d){
  const restored={};
  if(Array.isArray(d.trades))restored.trades=d.trades;
  if(Array.isArray(d.tpTemplates))restored.tpTemplates=d.tpTemplates;
  if(d.tpDefaults&&typeof d.tpDefaults==="object"){
    restored.tpDefaults={...DEFAULTS,...d.tpDefaults};
  }
  return restored;
}

const tests=[];
const t=(name,fn)=>tests.push({name,fn});

t('Round-trip: export → import → templates + defaults zijn intact',()=>{
  const customTpl={id:"custom_x",name:"Mijn aggressief",distributions:{"3":[60,30,10]}};
  const initial={
    trades:[],
    tpTemplates:[...PRE_BUILT,customTpl],
    tpDefaults:{...DEFAULTS,"3":"custom_x"},
  };
  const payload=exportPayload(initial);
  const serialized=JSON.stringify(payload);
  const reparsed=JSON.parse(serialized);
  const restored=restoreFromBackup(reparsed);

  // Templates moeten ALL intact zijn
  if(restored.tpTemplates.length!==3)throw new Error(`expected 3 templates, got ${restored.tpTemplates.length}`);
  if(!restored.tpTemplates.find(t=>t.id==="custom_x"))throw new Error("custom template missing");
  // Defaults moeten intact zijn, met fallback voor missende keys
  if(restored.tpDefaults["3"]!=="custom_x")throw new Error(`default 3 = ${restored.tpDefaults["3"]}`);
  if(restored.tpDefaults["1"]!=="equal_default")throw new Error("default 1 lost");
});

t('Round-trip: lege state → import → fallback DEFAULTS toegepast',()=>{
  const payload=exportPayload({tpTemplates:[],tpDefaults:{}});
  const reparsed=JSON.parse(JSON.stringify(payload));
  const restored=restoreFromBackup(reparsed);
  // Templates leeg = leeg behouden
  if(restored.tpTemplates.length!==0)throw new Error();
  // Defaults moeten DEFAULTS-merge zijn (lege override → originele DEFAULTS)
  if(restored.tpDefaults["3"]!=="frontloaded_default")throw new Error(`fallback 3 = ${restored.tpDefaults["3"]}`);
});

t('Round-trip: oude backup zonder tpTemplates field → niet crashen',()=>{
  const oldBackup={version:12,trades:[],tagConfig:{},accounts:[]};
  const restored=restoreFromBackup(oldBackup);
  if(restored.tpTemplates!==undefined)throw new Error("should not set tpTemplates when absent");
  if(restored.tpDefaults!==undefined)throw new Error("should not set tpDefaults when absent");
});

t('Round-trip: partial tpDefaults wordt gemerged met defaults',()=>{
  // User heeft alleen default voor 4 TPs aangepast
  const payload=exportPayload({tpTemplates:PRE_BUILT,tpDefaults:{"4":"frontloaded_default"}});
  const restored=restoreFromBackup(JSON.parse(JSON.stringify(payload)));
  if(restored.tpDefaults["4"]!=="frontloaded_default")throw new Error();
  if(restored.tpDefaults["3"]!=="frontloaded_default")throw new Error("default 3 lost");
  if(restored.tpDefaults["1"]!=="equal_default")throw new Error("default 1 lost");
});

let passed=0,failed=0;
for(const x of tests){
  try{x.fn();console.log(`✓ ${x.name}`);passed++}
  catch(e){console.error(`✗ ${x.name}: ${e.message}`);failed++}
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed>0?1:0);
