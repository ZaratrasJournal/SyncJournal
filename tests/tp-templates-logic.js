// v12.123 Fase 1: tests voor TP-template helpers.
// Repliceert exact de helper-implementaties uit work/tradejournal.html.

function equalDistribution(count){
  if(!Number.isInteger(count)||count<=0)return[];
  if(count===1)return[100];
  const base=Math.floor(100/count);
  const remainder=100-base*count;
  return Array.from({length:count},(_,i)=>i<remainder?base+1:base);
}

function getDistributionForCount(templateId,count,templates){
  if(!templateId||!Array.isArray(templates))return equalDistribution(count);
  const tpl=templates.find(t=>t&&t.id===templateId);
  if(!tpl||!tpl.distributions)return equalDistribution(count);
  const dist=tpl.distributions[String(count)];
  if(!Array.isArray(dist)||dist.length!==count)return equalDistribution(count);
  return dist.slice();
}

function applyDistributionToTps(tps,distribution){
  if(!Array.isArray(tps))return[];
  return tps.map((tp,i)=>({...tp,pct:String(distribution[i]??Math.floor(100/tps.length))}));
}

function isManualDistribution(tps,templateId,templates){
  if(!Array.isArray(tps)||tps.length===0)return false;
  if(!templateId)return true;
  const expected=getDistributionForCount(templateId,tps.length,templates);
  return tps.some((tp,i)=>(parseInt(tp.pct,10)||0)!==expected[i]);
}

function recalcLastAbsorbs(tps,idx,newPctRaw){
  if(!Array.isArray(tps)||tps.length===0)return tps;
  const n=tps.length;
  if(idx<0||idx>=n)return tps;
  let newPct=parseInt(newPctRaw,10);
  if(!Number.isFinite(newPct)||newPct<0)newPct=0;
  if(newPct>100)newPct=100;
  if(n===1)return[{...tps[0],pct:"100"}];
  const result=tps.map(tp=>({...tp,_pct:parseInt(tp.pct,10)||0}));
  result[idx]._pct=newPct;
  let diff=result.reduce((s,tp)=>s+tp._pct,0)-100;
  for(let j=n-1;j>=0&&diff!==0;j--){
    if(j===idx)continue;
    if(diff>0){
      const canTake=Math.max(0,result[j]._pct-1);
      const take=Math.min(canTake,diff);
      result[j]._pct-=take;
      diff-=take;
    }else{
      result[j]._pct+=-diff;
      diff=0;
    }
  }
  if(diff>0){result[idx]._pct-=diff;}
  return result.map(({_pct,...tp})=>({...tp,pct:String(_pct)}));
}

function validateTpTemplate(tpl,allTemplates,currentId){
  const errors={};
  const name=(tpl?.name||"").trim();
  if(!name){errors.name="Naam is verplicht";}
  else if(Array.isArray(allTemplates)&&allTemplates.some(t=>t&&t.id!==currentId&&(t.name||"").trim().toLowerCase()===name.toLowerCase())){
    errors.name="Naam moet uniek zijn";
  }
  let hasAnyDistribution=false;
  for(const count of[1,2,3,4,5]){
    const dist=tpl?.distributions?.[String(count)];
    if(!Array.isArray(dist)||dist.length===0)continue;
    hasAnyDistribution=true;
    if(dist.length!==count){errors["dist_"+count]=`Verdeling moet ${count} waarde(n) hebben`;continue;}
    if(dist.some(v=>!Number.isInteger(v))){errors["dist_"+count]="Alleen hele getallen toegestaan";continue;}
    if(dist.some(v=>v<=0)){errors["dist_"+count]="Geen 0%-waarden toegestaan";continue;}
    const sum=dist.reduce((s,v)=>s+v,0);
    if(sum!==100){errors["dist_"+count]=`Som moet 100 zijn (nu ${sum})`;}
  }
  if(!hasAnyDistribution){errors.distributions="Minimaal 1 verdeling vereist (bijv. voor 3 TPs)";}
  return errors;
}

const PRE_BUILT=[
  {id:"equal_default",name:"Equal",distributions:{"1":[100],"2":[50,50],"3":[34,33,33],"4":[25,25,25,25],"5":[20,20,20,20,20]}},
  {id:"frontloaded_default",name:"Front-loaded",distributions:{"1":[100],"2":[70,30],"3":[50,30,20],"4":[40,30,20,10],"5":[40,25,15,10,10]}},
  {id:"runner_default",name:"Runner",distributions:{"1":[100],"2":[30,70],"3":[20,30,50],"4":[10,20,30,40],"5":[10,15,20,25,30]}},
];

const tests=[];
const t=(name,fn)=>tests.push({name,fn});
const eq=(a,b,msg)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${msg||"mismatch"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);};

// === equalDistribution ===
t('equalDistribution: 1 TP → [100]',()=>eq(equalDistribution(1),[100]));
t('equalDistribution: 2 TPs → [50,50]',()=>eq(equalDistribution(2),[50,50]));
t('equalDistribution: 3 TPs → [34,33,33] (remainder eerst)',()=>eq(equalDistribution(3),[34,33,33]));
t('equalDistribution: 4 TPs → [25,25,25,25]',()=>eq(equalDistribution(4),[25,25,25,25]));
t('equalDistribution: 5 TPs → [20,20,20,20,20]',()=>eq(equalDistribution(5),[20,20,20,20,20]));
t('equalDistribution: 6 TPs → [17,17,17,17,16,16] (sum=100)',()=>{
  const r=equalDistribution(6);
  if(r.reduce((s,v)=>s+v,0)!==100)throw new Error(`sum=${r.reduce((s,v)=>s+v,0)}`);
});
t('equalDistribution: 0/negative/non-integer → []',()=>{
  eq(equalDistribution(0),[]);
  eq(equalDistribution(-1),[]);
  eq(equalDistribution(2.5),[]);
});

// === getDistributionForCount ===
t('getDistributionForCount: bestaande template + count → uit template',()=>{
  eq(getDistributionForCount("frontloaded_default",3,PRE_BUILT),[50,30,20]);
  eq(getDistributionForCount("runner_default",4,PRE_BUILT),[10,20,30,40]);
});
t('getDistributionForCount: niet-bestaande template → equal-fallback',()=>{
  eq(getDistributionForCount("nope",3,PRE_BUILT),[34,33,33]);
});
t('getDistributionForCount: bestaande template zonder distribution-for-count → equal',()=>{
  const partialTpl=[{id:"partial",name:"P",distributions:{"3":[50,30,20]}}];
  eq(getDistributionForCount("partial",4,partialTpl),[25,25,25,25]);
  eq(getDistributionForCount("partial",3,partialTpl),[50,30,20]);
});
t('getDistributionForCount: lege templateId → equal',()=>eq(getDistributionForCount("",3,PRE_BUILT),[34,33,33]));
t('getDistributionForCount: geen templates-array → equal',()=>eq(getDistributionForCount("x",2,null),[50,50]));

// === applyDistributionToTps ===
t('applyDistributionToTps: pcts worden overschreven, andere velden behouden',()=>{
  const tps=[{id:"a",price:"100",status:"hit",pct:"50"},{id:"b",price:"110",status:"open",pct:"50"}];
  const r=applyDistributionToTps(tps,[70,30]);
  eq(r[0],{id:"a",price:"100",status:"hit",pct:"70"});
  eq(r[1],{id:"b",price:"110",status:"open",pct:"30"});
});
t('applyDistributionToTps: lege array → lege array',()=>eq(applyDistributionToTps([],[100]),[]));

// === isManualDistribution ===
t('isManualDistribution: lege tps → false',()=>{if(isManualDistribution([],"equal_default",PRE_BUILT))throw new Error();});
t('isManualDistribution: lege templateId met tps → true (= Custom)',()=>{
  if(!isManualDistribution([{pct:"100"}],"",PRE_BUILT))throw new Error();
});
t('isManualDistribution: pcts matchen template → false',()=>{
  const tps=[{pct:"34"},{pct:"33"},{pct:"33"}];
  if(isManualDistribution(tps,"equal_default",PRE_BUILT))throw new Error();
});
t('isManualDistribution: pcts wijken af → true',()=>{
  const tps=[{pct:"60"},{pct:"30"},{pct:"10"}];
  if(!isManualDistribution(tps,"equal_default",PRE_BUILT))throw new Error();
});
t('isManualDistribution: non-integer pcts uit exchange → true (= Custom auto-detect)',()=>{
  const tps=[{pct:"33.5"},{pct:"33.5"},{pct:"33.0"}];
  if(!isManualDistribution(tps,"equal_default",PRE_BUILT))throw new Error();
});

// === recalcLastAbsorbs (Option B) ===
t('recalcLastAbsorbs: 3 TPs 50/30/20 → TP1 naar 60 → 60/30/10 (TPn absorbeert)',()=>{
  const tps=[{id:"a",pct:"50"},{id:"b",pct:"30"},{id:"c",pct:"20"}];
  const r=recalcLastAbsorbs(tps,0,60);
  eq(r.map(t=>t.pct),["60","30","10"]);
});
t('recalcLastAbsorbs: 3 TPs 50/30/20 → TP1 naar 70 → cascade naar TP2 (20→1=19 te kort, TP2 levert 11)',()=>{
  const tps=[{pct:"50"},{pct:"30"},{pct:"20"}];
  // newPct=70 (+20). TPn(20)→1 (canTake=19). diff=20-19=1. TPn-1(30)→29 (-1). diff=0.
  const r=recalcLastAbsorbs(tps,0,70);
  eq(r.map(t=>parseInt(t.pct,10)),[70,29,1]);
});
t('recalcLastAbsorbs: 3 TPs 50/30/20 → TP1 naar 90 → cascade uitgeput, terug-correctie',()=>{
  const tps=[{pct:"50"},{pct:"30"},{pct:"20"}];
  // newPct=90 (+40). TPn(20)→1 (take 19). diff=21. TPn-1(30)→1 (take 29). diff=-8? Wait.
  // canTake=Math.max(0,30-1)=29. take=Math.min(29,21)=21. result[1]=30-21=9. diff=0.
  const r=recalcLastAbsorbs(tps,0,90);
  eq(r.map(t=>parseInt(t.pct,10)),[90,9,1]);
});
t('recalcLastAbsorbs: 3 TPs → TP1 naar 99 → cascade uitgeput, modifying-TP terug',()=>{
  const tps=[{pct:"50"},{pct:"30"},{pct:"20"}];
  // newPct=99 (+49). TPn(20)→1 (take 19). diff=30. TPn-1(30)→1 (take 29). diff=1. diff>0 → modifying-TP-=1 → 98.
  const r=recalcLastAbsorbs(tps,0,99);
  eq(r.map(t=>parseInt(t.pct,10)),[98,1,1]);
});
t('recalcLastAbsorbs: 3 TPs → TP1 naar 100 → alle anderen 1%, TP1 corrigeert naar 98',()=>{
  const tps=[{pct:"50"},{pct:"30"},{pct:"20"}];
  // newPct=100 (+50). TPn(20)→1 (take 19). diff=31. TPn-1(30)→1 (take 29). diff=2. modifying→98.
  const r=recalcLastAbsorbs(tps,0,100);
  eq(r.map(t=>parseInt(t.pct,10)),[98,1,1]);
  if(r.reduce((s,tp)=>s+parseInt(tp.pct,10),0)!==100)throw new Error("sum!=100");
});
t('recalcLastAbsorbs: 3 TPs 50/30/20 → TP1 naar 30 (negatieve delta) → TPn krijgt het volledige verschil',()=>{
  const tps=[{pct:"50"},{pct:"30"},{pct:"20"}];
  // newPct=30 (-20). diff=-20. Cascade: TPn(20)+20=40. diff=0.
  const r=recalcLastAbsorbs(tps,0,30);
  eq(r.map(t=>parseInt(t.pct,10)),[30,30,40]);
});
t('recalcLastAbsorbs: 2 TPs 50/50 → TP1 naar 80 → 80/20',()=>{
  const tps=[{pct:"50"},{pct:"50"}];
  const r=recalcLastAbsorbs(tps,0,80);
  eq(r.map(t=>parseInt(t.pct,10)),[80,20]);
});
t('recalcLastAbsorbs: 1 TP → altijd 100',()=>{
  const r=recalcLastAbsorbs([{pct:"50"}],0,77);
  eq(r[0].pct,"100");
});
t('recalcLastAbsorbs: edit MIDDLE TP (idx=1 van 3 TPs) → cascade overslaat idx=1',()=>{
  const tps=[{pct:"40"},{pct:"30"},{pct:"30"}];
  // TP2 (idx=1) wordt 50 (+20). diff=20. Cascade: TPn(30)→10 (take 20). diff=0.
  const r=recalcLastAbsorbs(tps,1,50);
  eq(r.map(t=>parseInt(t.pct,10)),[40,50,10]);
});
t('recalcLastAbsorbs: edit LAST TP zelf → cascade gaat naar TPn-1',()=>{
  const tps=[{pct:"40"},{pct:"30"},{pct:"30"}];
  // TP3 (idx=2) wordt 50 (+20). diff=20. j=2 skip (===idx). j=1 (30)→10 (take 20). diff=0.
  const r=recalcLastAbsorbs(tps,2,50);
  eq(r.map(t=>parseInt(t.pct,10)),[40,10,50]);
});
t('recalcLastAbsorbs: input >100 wordt gecapped naar 100',()=>{
  const tps=[{pct:"50"},{pct:"50"}];
  const r=recalcLastAbsorbs(tps,0,150);
  // gecapped naar 100. cascade: TPn(50)→1 (take 49). diff=1. modifying→99.
  eq(r.map(t=>parseInt(t.pct,10)),[99,1]);
});
t('recalcLastAbsorbs: input negatief → behandeld als 0',()=>{
  const tps=[{pct:"50"},{pct:"50"}];
  const r=recalcLastAbsorbs(tps,0,-30);
  // newPct=0. diff=-50. cascade: TPn(50)+50=100. diff=0.
  eq(r.map(t=>parseInt(t.pct,10)),[0,100]);
});
t('recalcLastAbsorbs: som is altijd 100 na operatie (random fuzz)',()=>{
  // 100 random scenarios
  for(let i=0;i<100;i++){
    const n=2+Math.floor(Math.random()*4); // 2-5 TPs
    const tps=equalDistribution(n).map(p=>({pct:String(p)}));
    const idx=Math.floor(Math.random()*n);
    const newPct=Math.floor(Math.random()*120)-10; // -10..110
    const r=recalcLastAbsorbs(tps,idx,newPct);
    const sum=r.reduce((s,tp)=>s+parseInt(tp.pct,10),0);
    if(sum!==100)throw new Error(`fuzz: sum=${sum} (n=${n},idx=${idx},newPct=${newPct},result=${JSON.stringify(r.map(t=>t.pct))})`);
  }
});

// === validateTpTemplate ===
t('validateTpTemplate: geldige template → geen errors',()=>{
  const tpl={name:"Mijn",distributions:{"3":[50,30,20]}};
  const e=validateTpTemplate(tpl,[]);
  if(Object.keys(e).length>0)throw new Error(JSON.stringify(e));
});
t('validateTpTemplate: lege naam → error',()=>{
  const e=validateTpTemplate({name:"",distributions:{"3":[50,30,20]}},[]);
  if(!e.name)throw new Error("expected name error");
});
t('validateTpTemplate: dubbele naam case-insensitive → error',()=>{
  const existing=[{id:"x",name:"Mijn template",distributions:{"3":[50,30,20]}}];
  const e=validateTpTemplate({name:"MIJN TEMPLATE",distributions:{"3":[50,30,20]}},existing,"new_id");
  if(!e.name)throw new Error("expected name uniqueness error");
});
t('validateTpTemplate: zelfde id bij hernoemen → geen uniqueness-error',()=>{
  const existing=[{id:"x",name:"Mijn",distributions:{"3":[50,30,20]}}];
  const e=validateTpTemplate({name:"Mijn",distributions:{"3":[50,30,20]}},existing,"x");
  if(e.name)throw new Error("should allow same id");
});
t('validateTpTemplate: 0%-waarde → error',()=>{
  const e=validateTpTemplate({name:"X",distributions:{"3":[50,50,0]}},[]);
  if(!e.dist_3)throw new Error();
});
t('validateTpTemplate: niet-integer → error',()=>{
  const e=validateTpTemplate({name:"X",distributions:{"3":[33.5,33.5,33]}},[]);
  if(!e.dist_3)throw new Error();
});
t('validateTpTemplate: som != 100 → error',()=>{
  const e=validateTpTemplate({name:"X",distributions:{"3":[50,30,10]}},[]);
  if(!e.dist_3)throw new Error();
});
t('validateTpTemplate: partial-distributions toegestaan (alleen 3 + 4)',()=>{
  const tpl={name:"X",distributions:{"3":[50,30,20],"4":[25,25,25,25]}};
  const e=validateTpTemplate(tpl,[]);
  if(Object.keys(e).length>0)throw new Error(JSON.stringify(e));
});
t('validateTpTemplate: geen enkele distribution → error',()=>{
  const e=validateTpTemplate({name:"X",distributions:{}},[]);
  if(!e.distributions)throw new Error();
});
t('validateTpTemplate: distribution-length mismatch → error',()=>{
  const e=validateTpTemplate({name:"X",distributions:{"3":[50,50]}},[]);
  if(!e.dist_3)throw new Error();
});

// === PRE_BUILT integriteit ===
t('Alle pre-built templates: alle distributions sommen tot 100',()=>{
  for(const tpl of PRE_BUILT){
    for(const [count,dist] of Object.entries(tpl.distributions)){
      const sum=dist.reduce((s,v)=>s+v,0);
      if(sum!==100)throw new Error(`${tpl.id} count=${count} sum=${sum}`);
      if(dist.length!==parseInt(count,10))throw new Error(`${tpl.id} count=${count} length=${dist.length}`);
    }
  }
});
t('Pre-built valideren als geldige templates',()=>{
  for(const tpl of PRE_BUILT){
    const e=validateTpTemplate(tpl,PRE_BUILT.filter(t=>t.id!==tpl.id),tpl.id);
    if(Object.keys(e).length>0)throw new Error(`${tpl.id}: ${JSON.stringify(e)}`);
  }
});

let passed=0,failed=0;
for(const x of tests){
  try{x.fn();console.log(`✓ ${x.name}`);passed++}
  catch(e){console.error(`✗ ${x.name}: ${e.message}`);failed++}
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed>0?1:0);
