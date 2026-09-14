#!/usr/bin/env node
// Genereert een volledige, realistische SyncJournal-dataset (native sj-formaat).
// 2000 live + 500 paper + 500 backtest trades, met meerdere TP's, screenshots,
// 6 playbooks (incl. voorbeeld-charts), handmatige accounts met kapitaal-ledger,
// exchange-koppelingen, tags/emoties/fouten. Edge-erosion-bias: backtest > paper > live.
//
// Gebruik:  node scripts/gen-syncjournal-dataset.js [uitvoer.json]
// Import:   open work/syncjournal.html → Instellingen → Data → Importeer.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// ── deterministische PRNG ──
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(20260905);
const pick = a => a[Math.floor(rnd()*a.length)];
const rint = (a,b) => Math.floor(a+rnd()*(b-a+1));
const rf = (a,b) => a+rnd()*(b-a);
const chance = p => rnd() < p;

// ── minimale PNG-encoder (solide kleur) → echte, decodeerbare data-URI ──
const CRC=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=CRC[(c^buf[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);const t=Buffer.from(type,'ascii');const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([len,t,data,crc]);}
function pngDataURI(r,g,b,size=56){
  const w=size,h=size,raw=Buffer.alloc((w*3+1)*h);let p=0;
  for(let y=0;y<h;y++){raw[p++]=0;for(let x=0;x<w;x++){const edge=(x<3||y<3||x>=w-3||y>=h-3);raw[p++]=edge?255:r;raw[p++]=edge?255:g;raw[p++]=edge?255:b;}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
  return 'data:image/png;base64,'+png.toString('base64');
}
const SHOTS=[[36,91,217],[16,179,163],[123,143,148],[167,139,250],[247,147,26],[214,66,89]].map(c=>pngDataURI(c[0],c[1],c[2]));

// ── vocabulaire ──
const PAIRS={'BTC/USDT':64000,'ETH/USDT':3200,'SOL/USDT':175,'XRP/USDT':0.61,'DOGE/USDT':0.14,'LINK/USDT':18,'AVAX/USDT':38,'BNB/USDT':590,'ARB/USDT':1.1,'OP/USDT':2.4};
const PAIRK=Object.keys(PAIRS);
const SESSIONS=['Asia','London','US AM','US PM'];
const MARKETS=['Trending','Ranging','Volatiel','Rustig'];
const EMOTIONS=['Rustig','Zelfverzekerd','Geduldig','FOMO','Gehaast','Twijfels'];
const NEG_EMO=['FOMO','Gehaast','Twijfels'];
const MISTAKES=['Te vroeg in','SL te krap','SL te wijd','Geen plan','Overtrading','TP te vroeg','Positie te groot','Revenge trade'];
const CONFIRM=['Liquidity Sweep','OB','FVG','EQL/EQH','Flat candle','Session sweep','VAH / VAL / POC','Range retest','Spot koop'];
const TF=['5M','15M','30M','1H','4H'];
// 'weekend' verwijderd: dubbelop met de sessie "Weekend" (feedback Denny 2026-09-14).
const CUSTOM=['A+ setup','herhaalbaar','nieuwsdag','high conviction'];

// ── playbooks (naam = setup) ──
// baseWR/E = werkelijke LIVE win-rate en verwachting (in R) per setup.
// Sommige setups verdienen geld, andere kosten geld — bewust gemengd voor realisme.
const PB_DEF=[
  {name:'Trend-pullback',oneLiner:'Koop de pullback naar de OB in een schone trend.',status:'active',grade:'A',tf:['1H','4H'],bias:'Bullish',baseWR:0.49,E:0.25},   // ster-setup
  {name:'London SFP',oneLiner:'Sweep van de London-low, reclaim en terug de range in.',status:'active',grade:'A',tf:['15M','1H'],bias:'Bullish',baseWR:0.47,E:0.15},   // solide
  {name:'BOS-retest',oneLiner:'Break of structure, dan entry op de retest van de breakout.',status:'active',grade:'B',tf:['15M','4H'],bias:'Bullish',baseWR:0.45,E:0.05}, // net positief
  {name:'Range-fade',oneLiner:'Fade de extremes van een duidelijke range naar het midden.',status:'active',grade:'B',tf:['5M','15M'],bias:'Neutraal',baseWR:0.43,E:-0.05},// marginaal verlies
  {name:'Reclaim',oneLiner:'Verlies + reclaim van een belangrijk niveau als trigger.',status:'testing',grade:'C',tf:['15M','30M'],bias:'Neutraal',baseWR:0.41,E:-0.11}, // verliesgevend
  {name:'VWAP-bounce',oneLiner:'Mean-reversion bounce op de dagelijkse VWAP.',status:'testing',grade:'C',tf:['5M','15M'],bias:'Neutraal',baseWR:0.39,E:-0.19},          // duidelijk lek
];
function buildPlaybooks(){
  const pbook={};
  PB_DEF.forEach((d,i)=>{
    pbook[d.name]={
      name:d.name, oneLiner:d.oneLiner,
      layers:[{timeframe:d.tf[0],bias:d.bias,setups:[d.name],confirmations:[pick(CONFIRM),pick(CONFIRM)]},
              {timeframe:d.tf[1]||d.tf[0],bias:d.bias,setups:[],confirmations:[pick(CONFIRM)]}],
      criteria:[{text:'Duidelijke '+d.tf[0]+'-structuur',mandatory:true},{text:pick(CONFIRM)+' als bevestiging',mandatory:true},{text:'R:R minimaal 2:1',mandatory:false}],
      antiCriteria:[{text:'Vlak vóór high-impact nieuws',mandatory:true},{text:'Geen duidelijke liquidity-target',mandatory:false}],
      status:d.status, defaultGrade:d.grade,
      stop:'onder/boven de sweep', target:'volgende liquidity-pool', minRR:'2',
      bigPicture:'Werkt het best wanneer de hogere TF meebeweegt met de setup-richting.',
      tape:'Let op afnemend volume in de aanloop, dan expansie op de trigger.',
      intuition:'Voelt schoon als de sweep snel wordt teruggekocht.',
      examples:[{id:'ex'+i+'a',dataUrl:SHOTS[i%SHOTS.length],caption:'Schoolvoorbeeld',kind:'win'},
                {id:'ex'+i+'b',dataUrl:SHOTS[(i+2)%SHOTS.length],caption:'Marginale entry',kind:'marginal'},
                {id:'ex'+i+'c',dataUrl:SHOTS[(i+4)%SHOTS.length],caption:'Wat ging mis',kind:'fail'}],
      tradingViewUrl:'https://www.tradingview.com/chart/', referenceUrl:'', referenceLabel:'',
      pairs:[pick(PAIRK),pick(PAIRK)], sessions:[pick(SESSIONS)],
    };
  });
  return pbook;
}
const PB_BY_NAME={}; PB_DEF.forEach(d=>PB_BY_NAME[d.name]=d);

// ── accounts ──
const EX_IDS=['mexc','blofin','okx','hyperliquid'];
const MANUAL=[
  {id:'m_ftmo',name:'FTMO Challenge 100K',transactions:[
    {id:'tx1',type:'deposit',amount:'100000',date:'2025-03-01',note:'Challenge fee-account'},
    {id:'tx2',type:'withdrawal',amount:'8200',date:'2025-06-15',note:'Eerste payout'},
    {id:'tx3',type:'withdrawal',amount:'6400',date:'2025-09-10',note:'Payout'},
    {id:'tx4',type:'correction',amount:'96000',date:'2026-01-05',note:'Reconciliatie na reset'},
  ]},
  {id:'m_reserve',name:'Spot Reserve',transactions:[
    {id:'tx5',type:'deposit',amount:'5000',date:'2025-02-01',note:'Startkapitaal'},
    {id:'tx6',type:'deposit',amount:'3000',date:'2025-07-01',note:'Bijstorting'},
    {id:'tx7',type:'withdrawal',amount:'1500',date:'2025-11-20',note:'Winst opgenomen'},
  ]},
];
const ACCOUNT_POOL=[...EX_IDS,...EX_IDS,'m_ftmo','m_reserve']; // exchanges vaker dan manual

// ── datum/tijd ──
const START=new Date('2025-02-01').getTime(), END=new Date('2026-09-01').getTime();
function sessTime(s){const h=s==='Asia'?rint(2,7):s==='London'?rint(8,12):s==='US AM'?rint(13,17):rint(18,22);return String(h).padStart(2,'0')+':'+String(rint(0,59)).padStart(2,'0');}

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// Vorm/mood over de tijd: langzame golven + één duidelijke drawdown-periode → winning/losing streaks.
function formFactor(dateMs){
  const t=(dateMs-START)/(END-START);                 // 0..1
  let f=Math.sin(t*Math.PI*3.3)*0.05+Math.sin(t*Math.PI*7.0)*0.03;
  if(t>0.55&&t<0.68)f-=0.11;                           // rough patch (slump)
  return f;                                             // verschuift de win-rate ±
}
// Edge-erosie: backtest > paper > live. Losers ≈ −1R (volledige stop), winners variëren.
function outcome(kind,pbName,dateMs){
  const pb=PB_BY_NAME[pbName];
  const k=kind==='backtest'?{dW:0.08,dE:0.30}:kind==='paper'?{dW:0.04,dE:0.14}:{dW:0,dE:0};
  const wr=clamp(pb.baseWR+k.dW+formFactor(dateMs),0.28,0.72);
  const E=pb.E+k.dE;
  const avgWin=clamp((E+(1-wr))/wr,0.8,3.2);           // gem. winnaar-R uit verwachting + WR
  const win=chance(wr);
  let r;
  if(win){ r=+rf(avgWin*0.55,avgWin*1.5).toFixed(2); } // rechts-scheve winnaars
  else { const roll=rnd();                             // meeste verliezen = volle stop
    r=roll<0.15?-+rf(0.2,0.6).toFixed(2):roll>0.9?-+rf(1.05,1.5).toFixed(2):-+rf(0.9,1.05).toFixed(2); }
  return {win,r};
}

function genTrade(id,kind,dateMs){
  const pbName=pick(PB_DEF).name, pb=PB_BY_NAME[pbName];
  const pair=pick(PAIRK), base=PAIRS[pair]*(1+rf(-0.18,0.18));
  const dir=chance(pb.bias==='Bullish'?0.62:0.5)?'long':'short';
  const dsign=dir==='long'?1:-1;
  const dec=base>1000?1:base>10?2:base>1?4:5;
  const entry=+base.toFixed(dec);
  const riskFrac=rf(0.004,0.02);
  const stop=+(entry*(1-dsign*riskFrac)).toFixed(dec);
  const size=rint(600,22000);
  const risk$=Math.abs(entry-stop)/entry*size;
  const rrPlanned=+rf(1.5,3.5).toFixed(1);
  const tpPrice=+(entry*(1+dsign*riskFrac*rrPlanned)).toFixed(dec);
  const {win,r}=outcome(kind,pbName,dateMs);
  const fees=+(size*0.0006*rf(0.5,2)).toFixed(2);
  const grossPnl=r*risk$;
  const exit=+(entry*(1+dsign*grossPnl/size)).toFixed(dec);
  // pnl én r afleiden uit de AFGERONDE exit → exit ↔ pnl ↔ R zijn exact coherent (geen afrondingsdrift).
  const grossActual=(exit-entry)/entry*size*dsign;
  const pnl=+(grossActual-fees).toFixed(2);
  const rActual=risk$?+(grossActual/risk$).toFixed(2):r;
  const hindsightExit=kind!=='live'?+(entry*(1+dsign*riskFrac*rrPlanned*rf(0.75,1.05))).toFixed(dec):'';
  // TP-niveaus
  const nTP=rint(1,4); const tps=[]; let rem=100;
  for(let k=0;k<nTP;k++){const frac=(k+1)/nTP;
    const price=+(entry*(1+dsign*riskFrac*rrPlanned*frac)).toFixed(dec);
    const pct=k===nTP-1?rem:Math.min(rem-1,rint(20,45)); rem-=pct;
    const hit=win?chance(0.85):(k===0&&chance(0.25));
    tps.push({price,pct,r:+(rrPlanned*frac).toFixed(1),hit});
  }
  const d=new Date(dateMs); const date=d.toISOString().slice(0,10);
  const session=pick(SESSIONS); const time=sessTime(session);
  const emo=win?pick(['Rustig','Zelfverzekerd','Geduldig']):pick(EMOTIONS);
  const emotions=[emo]; if(chance(0.25))emotions.push(pick(EMOTIONS));
  const mistakes=(!win&&chance(0.55))?[pick(MISTAKES)]:[]; if(mistakes.length&&chance(0.2))mistakes.push(pick(MISTAKES));
  const tags=[...new Set([...(pb.tf?[]:[]),...(chance(0.4)?[pick(CUSTOM)]:[]),...(chance(0.5)?[pick(CONFIRM)]:[])])];
  const layers=[{timeframe:pb.tf[0],bias:pb.bias,setups:[pbName],confirmations:[pick(CONFIRM)]}];
  if(chance(0.5))layers.push({timeframe:pb.tf[1]||pb.tf[0],bias:pb.bias,setups:[],confirmations:[pick(CONFIRM)]});
  const shots=chance(0.22)?Array.from({length:rint(1,3)},()=>pick(SHOTS)):[];
  const exchange=pick(ACCOUNT_POOL);
  const durationMin=Math.round(win?rf(20,320):rf(6,140));
  const mae=+(win?rf(0.1,0.55):Math.abs(r)*rf(0.75,1.1)).toFixed(2);
  const mfe=+(win?r*rf(1.02,1.5):rf(0.15,0.9)).toFixed(2);
  // ~2% live open (geen exit/pnl)
  const isOpen=kind==='live'&&chance(0.02);
  // Open/Close-timestamps (v0.9.46): open = datum+tijd, close = open + duur.
  const openMs=+new Date(`${date}T${time}:00`);
  const closeMs=isOpen?0:openMs+durationMin*60000;
  // TP-hits krijgen een tijdstip verdeeld over de looptijd (voor de review-tijdlijn).
  if(closeMs)tps.forEach((tp,k)=>{if(tp.hit)tp.ts=openMs+Math.round(durationMin*60000*(k+1)/(tps.length+1));});
  return {
    openTime:String(openMs),closeTime:closeMs?String(closeMs):'',
    id,date,time,pair,dir,setup:pbName,session,timeframe:pb.tf[0],market:pick(MARKETS),grade:pb.grade&&chance(0.85)?pb.grade:pick(['A','B','C']),
    entry,exit:isOpen?'':exit,stop,tp:tpPrice,tps,hindsightExit,
    // risk = percentage van het account (zoals het formulier-veld "Risk (%)"), niet een $-bedrag
    size,leverage:pick([3,5,10,20,25]),fees:isOpen?'':fees,risk:+(risk$/24663*100).toFixed(2),rrPlanned,
    pnl:isOpen?'':pnl,pnlPct:isOpen?0:+(pnl/24663*100).toFixed(2),r:isOpen?0:rActual,
    status:isOpen?'open':(win&&chance(0.12)?'partial':'closed'),
    emotion:emotions[0],emotions,mistake:mistakes[0]||'',mistakes,
    kind,missedReasons:[],tags,layers,exchange,account:'',
    notes:win?pick(['Schone entry, plan gevolgd.','Mooie setup, geduldig gewacht.','Precies volgens playbook.','']):pick(['Te vroeg ingestapt.','Had op bevestiging moeten wachten.','Emotie speelde mee.','']),
    lessons:!win&&chance(0.5)?pick(['Volgende keer wachten op de retest.','Kleiner sizen bij twijfel.','Niet forceren buiten de sessie.']):'',
    durationMin,mae,mfe,screenshots:shots,rating:win?rint(3,5):rint(1,3),checks:[],realizedPnl:'',
  };
}

// ── assembleer ──
function build(){
  const spec=[['live',2000],['paper',500],['backtest',500]];
  const trades=[]; let id=0;
  spec.forEach(([kind,count])=>{ for(let i=0;i<count;i++){ const dateMs=START+rnd()*(END-START); trades.push(genTrade(id++,kind,dateMs)); } });
  trades.sort((a,b)=>(a.date+a.time<b.date+b.time?1:-1)); // nieuwste eerst
  trades.forEach((t,i)=>t.id=i);
  const tagConfig={
    setupTags:PB_DEF.map(d=>d.name),
    confirmationTags:CONFIRM, timeframeTags:TF,
    emotionTags:EMOTIONS, mistakeTags:MISTAKES,
    missedReasonTags:['🐢 Durf','🔪 Buiten regels','⏰ Te laat gespot','💰 Kapitaal vol'],
    customTags:CUSTOM,
  };
  return {
    app:'SyncJournal', appVersion:'v0.9.0', schemaVersion:1, exported:new Date().toISOString(),
    _note:'Volledige demo-dataset — gegenereerd door scripts/gen-syncjournal-dataset.js',
    tagConfig,
    pbook:buildPlaybooks(),
    conns:{mexc:{connected:true,autoSync:true,hint:'8241'},blofin:{connected:true,autoSync:false,hint:'5533'},okx:{connected:false,autoSync:false,hint:''}},
    manual:MANUAL,
    sync:{auto:true,interval:'15m'},
    aiPrefs:{enabled:true,tone:'neutraal',focus:{discipline:true,risk:true,psychologie:true},hideAmounts:false},
    sections:{hero:true,kpis:true,equity:true,monthly:true,edge:true,recent:true},
    settings:{theme:'dark',currency:'USD',priv:false,density:'comfy'},
    trades,
  };
}

const out=process.argv[2]||'demo-dataset-3000.json';
const outPath=path.resolve(__dirname,'..',out);
const data=build();
fs.writeFileSync(outPath,JSON.stringify(data));
const kb=Math.round(fs.statSync(outPath).size/1024);
const byKind=data.trades.reduce((a,t)=>{a[t.kind]=(a[t.kind]||0)+1;return a;},{});
const withShots=data.trades.filter(t=>t.screenshots.length).length;
const multiTp=data.trades.filter(t=>t.tps.length>1).length;
console.log(`✓ ${data.trades.length} trades → ${out} (~${kb} KB)`);
console.log(`  kinds: ${JSON.stringify(byKind)}`);
console.log(`  playbooks: ${Object.keys(data.pbook).length} · manual accounts: ${data.manual.length} · trades met screenshots: ${withShots} · trades met >1 TP: ${multiTp}`);
