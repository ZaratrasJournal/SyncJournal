// v12.122: closeData-flow tests voor markAllHit/markAllMissed op manual + exchange trades.
// Repliceert logic uit work/tradejournal.html om input/output te verifiëren.

function computeCloseData(trade){
  const tps=trade.tpLevels||[];
  const entryN=parseFloat(trade.entry);
  const slN=parseFloat(trade.stopLoss);
  const sizeN=parseFloat(trade.positionSize);
  const isLong=trade.direction==="long";
  const isManual=trade.source==="manual";
  if(!(isManual&&tps.length>0&&entryN>0&&sizeN>0))return null;

  const hitTps=tps.filter(tp=>tp.status==="hit"&&parseFloat(tp.price)>0);
  const hitPctSum=hitTps.reduce((s,tp)=>s+(parseFloat(tp.pct)||0),0);
  const missedTps=tps.filter(tp=>tp.status==="missed");
  const missedPctSum=missedTps.reduce((s,tp)=>s+(parseFloat(tp.pct)||0),0);
  const fees=parseFloat(trade.fees)||0;

  if(hitPctSum>=99.99&&hitTps.length>0){
    const wExit=hitTps.reduce((s,tp)=>s+parseFloat(tp.price)*parseFloat(tp.pct||0),0)/hitPctSum;
    const grossPnl=hitTps.reduce((s,tp)=>{
      const tpPrice=parseFloat(tp.price),pct=parseFloat(tp.pct)/100;
      return s+(isLong?(tpPrice-entryN)*sizeN*pct/entryN:(entryN-tpPrice)*sizeN*pct/entryN);
    },0);
    const netPnl=grossPnl-fees;
    if(trade.status==="open"||trade.status==="partial"){
      return{mode:"close",netPnl,wExit,hitCount:hitTps.length};
    }else if(trade.status==="closed"){
      const currentPnl=parseFloat(trade.pnl)||0;
      if(Math.abs(netPnl-currentPnl)>1){
        return{mode:"update",netPnl,wExit,hitCount:hitTps.length,currentPnl};
      }
    }
    return null;
  }else if(missedPctSum>=99.99&&missedTps.length>0&&slN>0){
    const grossPnl=isLong?(slN-entryN)*sizeN/entryN:(entryN-slN)*sizeN/entryN;
    const netPnl=grossPnl-fees;
    if(trade.status==="open"||trade.status==="partial"){
      return{mode:"close-loss",netPnl,wExit:slN,hitCount:0};
    }else if(trade.status==="closed"){
      const currentPnl=parseFloat(trade.pnl)||0;
      if(Math.abs(netPnl-currentPnl)>1){
        return{mode:"update-loss",netPnl,wExit:slN,hitCount:0,currentPnl};
      }
    }
    return null;
  }
  return null;
}

const tests=[];
const t=(name,fn)=>tests.push({name,fn});

t('Manual OPEN trade, all TPs hit → close mode (win)',()=>{
  const trade={source:"manual",status:"open",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",fees:"5",
    tpLevels:[{price:"71000",pct:"50",status:"hit"},{price:"72000",pct:"50",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="close")throw new Error(`mode=${cd.mode}`);
  // wExit = (71000*50 + 72000*50)/100 = 71500
  if(Math.abs(cd.wExit-71500)>0.01)throw new Error(`wExit=${cd.wExit}`);
  // gross = (71000-70000)*1000*0.5/70000 + (72000-70000)*1000*0.5/70000 = 7.143+14.286 ≈ 21.43
  // net = 21.43 - 5 = 16.43
  if(Math.abs(cd.netPnl-16.428)>0.01)throw new Error(`netPnl=${cd.netPnl}`);
});

t('Manual OPEN trade, all TPs missed → close-loss mode',()=>{
  const trade={source:"manual",status:"open",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",fees:"5",
    tpLevels:[{price:"71000",pct:"50",status:"missed"},{price:"72000",pct:"50",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="close-loss")throw new Error(`mode=${cd.mode}`);
  if(cd.wExit!==69000)throw new Error(`wExit=${cd.wExit}`);
  // gross long-loss = (69000-70000)*1000/70000 = -14.286
  // net = -14.286 - 5 = -19.286
  if(Math.abs(cd.netPnl-(-19.286))>0.01)throw new Error(`netPnl=${cd.netPnl}`);
});

t('Manual OPEN short trade, all missed → close-loss mode',()=>{
  const trade={source:"manual",status:"open",direction:"short",entry:"70000",stopLoss:"71000",positionSize:"1000",fees:"5",
    tpLevels:[{price:"69000",pct:"100",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="close-loss")throw new Error(`mode=${cd.mode}`);
  if(cd.wExit!==71000)throw new Error(`wExit=${cd.wExit}`);
  // short loss: (entry-SL)*size/entry = (70000-71000)*1000/70000 = -14.286
  if(Math.abs(cd.netPnl-(-19.286))>0.01)throw new Error(`netPnl=${cd.netPnl}`);
});

t('Manual CLOSED trade, all hit, pnl matches → no closeData (no drift)',()=>{
  const trade={source:"manual",status:"closed",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",fees:"5",pnl:"16.43",
    tpLevels:[{price:"71000",pct:"50",status:"hit"},{price:"72000",pct:"50",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null but got ${cd.mode}`);
});

t('Manual CLOSED trade, all hit but pnl drift > $1 → update mode',()=>{
  const trade={source:"manual",status:"closed",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",fees:"5",pnl:"50",
    tpLevels:[{price:"71000",pct:"50",status:"hit"},{price:"72000",pct:"50",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="update")throw new Error(`mode=${cd.mode}`);
  if(Math.abs(cd.currentPnl-50)>0.01)throw new Error(`currentPnl=${cd.currentPnl}`);
});

t('Manual CLOSED trade, all missed, pnl drift > $1 → update-loss mode',()=>{
  const trade={source:"manual",status:"closed",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",fees:"5",pnl:"50",
    tpLevels:[{price:"71000",pct:"100",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="update-loss")throw new Error(`mode=${cd.mode}`);
  if(Math.abs(cd.currentPnl-50)>0.01)throw new Error(`currentPnl=${cd.currentPnl}`);
  // expected SL pnl = -14.286 - 5 = -19.286
  if(Math.abs(cd.netPnl-(-19.286))>0.01)throw new Error(`netPnl=${cd.netPnl}`);
});

t('Exchange trade (source=blofin), all hit → no closeData (isManual=false)',()=>{
  const trade={source:"blofin",status:"closed",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",pnl:"50",
    tpLevels:[{price:"71000",pct:"100",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null for exchange, got ${cd.mode}`);
});

t('Exchange trade (source=mexc), all missed → no closeData (pnl untouched)',()=>{
  const trade={source:"mexc",status:"closed",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",pnl:"50",
    tpLevels:[{price:"71000",pct:"100",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null for exchange, got ${cd.mode}`);
});

t('Missed BT trade (source=manual, status=missed) → no closeData',()=>{
  const trade={source:"manual",status:"missed",simType:"backtest",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",
    tpLevels:[{price:"71000",pct:"100",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null for missed/BT, got ${cd.mode}`);
});

t('Missed BT trade with all-missed → no closeData (status=missed not handled)',()=>{
  const trade={source:"manual",status:"missed",simType:"backtest",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",
    tpLevels:[{price:"71000",pct:"100",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null for missed/BT, got ${cd.mode}`);
});

t('Manual partial trade, all hit → close mode',()=>{
  const trade={source:"manual",status:"partial",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",
    tpLevels:[{price:"71000",pct:"100",status:"hit"}]};
  const cd=computeCloseData(trade);
  if(!cd)throw new Error("expected closeData");
  if(cd.mode!=="close")throw new Error(`mode=${cd.mode}`);
});

t('Manual mixed (50% hit + 50% missed) → no closeData (neither sums to 100)',()=>{
  const trade={source:"manual",status:"open",direction:"long",entry:"70000",stopLoss:"69000",positionSize:"1000",
    tpLevels:[{price:"71000",pct:"50",status:"hit"},{price:"72000",pct:"50",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null for mixed, got ${cd.mode}`);
});

t('Manual all missed but no SL set → no closeData',()=>{
  const trade={source:"manual",status:"open",direction:"long",entry:"70000",positionSize:"1000",
    tpLevels:[{price:"71000",pct:"100",status:"missed"}]};
  const cd=computeCloseData(trade);
  if(cd)throw new Error(`expected null without SL, got ${cd.mode}`);
});

let passed=0,failed=0;
for(const x of tests){
  try{x.fn();console.log(`✓ ${x.name}`);passed++}
  catch(e){console.error(`✗ ${x.name}: ${e.message}`);failed++}
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed>0?1:0);
