// v12.119 Phase 2 Playbook Analytics — logica-tests voor groupBy helpers.
// Repliceert logic uit work/tradejournal.html om input/output te verifiëren.

function _tradeR(t){
  if(!t)return null;
  if(t.status!=="missed"){
    // Real trade — calcRMultiple
    const entry=parseFloat(t.entry),sl=parseFloat(t.stopLoss),pnl=parseFloat(t.pnl);
    if(!entry||!sl||sl===entry||isNaN(pnl))return null;
    const size=parseFloat(t.positionSize)||1;
    const risk=Math.abs(entry-sl);
    const riskUsdt=risk*size/entry;
    if(riskUsdt<=0)return null;
    return pnl/riskUsdt;
  }
  // Sim trade — _simTradeExit + R-derivation
  const entry=parseFloat(t.entry),sl=parseFloat(t.stopLoss);
  if(!isFinite(entry)||!isFinite(sl)||entry<=0||sl===entry)return null;
  const directExit=parseFloat(t.exit);
  let exit=null;
  if(isFinite(directExit)&&directExit>0){exit=directExit;}
  else{
    const tps=t.tpLevels||[];
    const hitTps=tps.filter(tp=>tp&&tp.status==="hit"&&parseFloat(tp.price)>0);
    const hitPctSum=hitTps.reduce((s,tp)=>s+(parseFloat(tp.pct)||0),0);
    if(hitPctSum>=99.99&&hitTps.length>0){
      exit=hitTps.reduce((s,tp)=>s+parseFloat(tp.price)*parseFloat(tp.pct||0),0)/hitPctSum;
    }
  }
  if(exit===null){
    const hx=parseFloat(t.hindsightExit);
    if(isFinite(hx)&&hx>0)exit=hx;
  }
  if(exit===null)return null;
  const dirSign=t.direction==="short"?-1:1;
  const risk=Math.abs(entry-sl);
  if(risk<=0)return null;
  return((exit-entry)*dirSign)/risk;
}

function _tradePnl(t){
  if(!t)return 0;
  if(t.status!=="missed"){
    if(t.pnl===""||isNaN(parseFloat(t.pnl)))return 0;
    const p=parseFloat(t.pnl);
    if(t.source&&t.source!=="manual")return p;
    return p-(parseFloat(t.fees)||0);
  }
  const p=parseFloat(t.pnl);
  if(!isNaN(p))return p;
  return 0; // theoretical fallback in actual code
}

function _groupBy(trades,keyFn){
  const map=new Map();
  for(const t of trades){
    const r=_tradeR(t);
    if(r===null)continue;
    const k=keyFn(t);
    if(k===null||k===undefined||k==="")continue;
    if(!map.has(k))map.set(k,{key:k,n:0,sumR:0,sumPnl:0,wins:0});
    const g=map.get(k);
    g.n++;g.sumR+=r;g.sumPnl+=_tradePnl(t);if(r>0)g.wins++;
  }
  return[...map.values()].map(g=>({...g,avgR:g.n?g.sumR/g.n:0,wr:g.n?g.wins/g.n*100:0}));
}

function _layerKey(t){
  const layers=t.layers||[];
  if(!layers.length)return(t.setupTags||[]).slice(0,3).join("+")||null;
  return layers.map(l=>{
    const tf=l.timeframe||"?";
    const setups=(l.setups||[]).join("+");
    return setups?`${tf}+${setups}`:tf;
  }).join(" → ");
}

const tests=[];
const t=(name,fn)=>tests.push({name,fn});

t('Layer-pattern key uit layers array', () => {
  const trade = { layers: [
    { timeframe: '4H', setups: ['SFP'] },
    { timeframe: '15m', setups: ['BOS', 'MSB'] }
  ]};
  if (_layerKey(trade) !== '4H+SFP → 15m+BOS+MSB') throw new Error('layer key fout');
});

t('Layer-pattern fallback naar setupTags', () => {
  const trade = { layers: [], setupTags: ['SFP', 'BOS'] };
  if (_layerKey(trade) !== 'SFP+BOS') throw new Error('fallback key fout');
});

t('Group BT trades by layer-pattern, compute avgR', () => {
  const trades = [
    { status:'missed', simType:'backtest', direction:'long', entry:'70000', stopLoss:'69000', exit:'72000', positionSize:'1000',
      layers:[{timeframe:'4H',setups:['SFP']},{timeframe:'15m',setups:['BOS']}]},
    { status:'missed', simType:'backtest', direction:'long', entry:'70000', stopLoss:'69000', exit:'71500', positionSize:'1000',
      layers:[{timeframe:'4H',setups:['SFP']},{timeframe:'15m',setups:['BOS']}]},
    { status:'missed', simType:'backtest', direction:'long', entry:'70000', stopLoss:'69000', exit:'68500', positionSize:'1000',
      layers:[{timeframe:'1H',setups:['SFP']},{timeframe:'5m',setups:['BOS']}]},
  ];
  const groups = _groupBy(trades, _layerKey);
  const big = groups.find(g => g.key.includes('4H'));
  const small = groups.find(g => g.key.includes('1H'));
  if (!big || big.n !== 2) throw new Error(`big group n=${big?.n}, expected 2`);
  // Trade 1: R = (72000-70000)/1000 = 2.0
  // Trade 2: R = (71500-70000)/1000 = 1.5
  // avgR = 1.75
  if (big.avgR.toFixed(2) !== '1.75') throw new Error(`big avgR=${big.avgR}`);
  if (big.wr !== 100) throw new Error('all wins');
  if (!small || small.avgR.toFixed(2) !== '-1.50') throw new Error(`small avgR=${small?.avgR}`);
});

t('Real trades met PnL → groupBy gebruikt calcRMultiple', () => {
  const trades = [
    { status:'closed', source:'manual', direction:'long', entry:'70000', stopLoss:'69000', positionSize:'1000', pnl:'14.29',
      pair:'BTC/USDT' },
    { status:'closed', source:'manual', direction:'long', entry:'70000', stopLoss:'69000', positionSize:'1000', pnl:'-14.29',
      pair:'BTC/USDT' },
  ];
  const groups = _groupBy(trades, t => t.pair);
  const btc = groups.find(g => g.key === 'BTC/USDT');
  if (!btc) throw new Error('no BTC group');
  if (btc.n !== 2) throw new Error(`n=${btc.n}`);
  if (btc.wr !== 50) throw new Error(`wr=${btc.wr}`);
});

t('Skip trades zonder R-data (geen exit voor sim, geen pnl voor real)', () => {
  const trades = [
    { status:'missed', simType:'backtest', direction:'long', entry:'70000', stopLoss:'69000' }, // geen exit
    { status:'missed', simType:'backtest', direction:'long', entry:'70000', stopLoss:'69000', exit:'72000', positionSize:'1000' },
  ];
  const groups = _groupBy(trades, () => 'all');
  if (groups[0].n !== 1) throw new Error(`expected 1 valid trade, got ${groups[0].n}`);
});

t('Tag-frequency: emotion-tags ranking', () => {
  function _tagFreq(trades, tagsFn) {
    const map = new Map();
    for (const t of trades) {
      const r = _tradeR(t);
      if (r === null) continue;
      const tags = tagsFn(t) || [];
      for (const tag of tags) {
        if (!tag) continue;
        if (!map.has(tag)) map.set(tag, { key: tag, n: 0, sumR: 0, sumPnl: 0, wins: 0 });
        const g = map.get(tag);
        g.n++; g.sumR += r; g.sumPnl += _tradePnl(t); if (r > 0) g.wins++;
      }
    }
    return [...map.values()].map(g => ({...g, avgR: g.n?g.sumR/g.n:0, wr: g.n?g.wins/g.n*100:0}));
  }
  const trades = [
    { status:'closed', source:'manual', direction:'long', entry:'70000', stopLoss:'69000', positionSize:'1000', pnl:'14.29',
      emotionTags:['Geduldig','Kalm']},
    { status:'closed', source:'manual', direction:'long', entry:'70000', stopLoss:'69000', positionSize:'1000', pnl:'-14.29',
      emotionTags:['FOMO']},
  ];
  const tags = _tagFreq(trades, t => t.emotionTags);
  const fomo = tags.find(t => t.key === 'FOMO');
  const ged = tags.find(t => t.key === 'Geduldig');
  if (!fomo || fomo.avgR.toFixed(2) !== '-1.00') throw new Error('FOMO');
  if (!ged || ged.avgR.toFixed(2) !== '1.00') throw new Error('Geduldig');
});

let passed = 0, failed = 0;
for (const x of tests) {
  try { x.fn(); console.log(`✓ ${x.name}`); passed++; }
  catch (e) { console.error(`✗ ${x.name}: ${e.message}`); failed++; }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
