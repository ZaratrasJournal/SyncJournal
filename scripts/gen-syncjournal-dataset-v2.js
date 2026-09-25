#!/usr/bin/env node
// Genereert de SyncJournal-voorbeelddata v2 (25-09-2026): één realistische trader, 20 maanden,
// data tot en met vandaag. Winstgevend over het geheel, met echte pieken en dalen (drie
// drawdown-periodes, winning- en losing-streaks), trades geclusterd op handelsdagen en sessies,
// stappen (fills) bij exchange-trades, playbooks, tags, handmatige accounts, én een TradingPlan-blok
// (week-/dagplannen, poort-beoordelingen, dagafsluitingen) dat al aan de trades gekoppeld is.
//
// Gebruik:  node scripts/gen-syncjournal-dataset-v2.js [uitvoer.json]   (standaard: site/demo-dataset.json)
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// ── deterministische PRNG ──
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(20260925);
const pick = a => a[Math.floor(rnd()*a.length)];
const rint = (a,b) => Math.floor(a+rnd()*(b-a+1));
const rf = (a,b) => a+rnd()*(b-a);
const chance = p => rnd() < p;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

// ── minimale PNG (solide kleur) → echte data-URI voor screenshots/voorbeeldcharts ──
const CRC=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=CRC[(c^buf[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);const t=Buffer.from(type,'ascii');const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([len,t,data,crc]);}
function pngDataURI(r,g,b,size=56){const w=size,h=size,raw=Buffer.alloc((w*3+1)*h);let p=0;for(let y=0;y<h;y++){raw[p++]=0;for(let x=0;x<w;x++){const edge=(x<3||y<3||x>=w-3||y>=h-3);raw[p++]=edge?255:r;raw[p++]=edge?255:g;raw[p++]=edge?255:b;}}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);return 'data:image/png;base64,'+png.toString('base64');}
const SHOTS=[[36,91,217],[16,179,163],[123,143,148],[167,139,250],[247,147,26],[214,66,89]].map(c=>pngDataURI(c[0],c[1],c[2]));

// ── vocabulaire ──
const PAIRS={'BTC/USDT':78000,'ETH/USDT':3300,'SOL/USDT':185,'XRP/USDT':0.62,'DOGE/USDT':0.15,'LINK/USDT':19,'AVAX/USDT':36,'BNB/USDT':600,'ARB/USDT':1.05,'OP/USDT':2.2};
const PAIRK=Object.keys(PAIRS);
const PAIR_W=['BTC/USDT','BTC/USDT','BTC/USDT','ETH/USDT','ETH/USDT','SOL/USDT','SOL/USDT','XRP/USDT','LINK/USDT','AVAX/USDT','BNB/USDT','ARB/USDT','OP/USDT','DOGE/USDT'];   // BTC/ETH/SOL het vaakst
const SESSIONS=['Asia','London','US AM','US PM'];
const SESS_W=['London','London','London','US AM','US AM','US PM','Asia'];
const MARKETS=['Trending','Ranging','Volatiel','Rustig'];
const EMOTIONS=['Rustig','Zelfverzekerd','Geduldig','FOMO','Gehaast','Twijfels'];
const MISTAKES=['Te vroeg in','SL te krap','SL te wijd','Geen plan','Overtrading','TP te vroeg','Positie te groot','Revenge trade'];
const CONFIRM=['Liquidity Sweep','OB','FVG','EQL/EQH','Flat candle','Session sweep','VAH / VAL / POC','Range retest','Spot koop'];
const TF=['5M','15M','30M','1H','4H'];
const CUSTOM=['A+ setup','herhaalbaar','nieuwsdag','high conviction'];

// ── playbooks: bewust gemengd, maar samen winstgevend ──
const PB_DEF=[
  {name:'Trend-pullback',oneLiner:'Koop de pullback naar de OB in een schone trend.',status:'active',grade:'A',tf:['1H','4H'],bias:'Bullish',baseWR:0.52,E:0.30,w:5},
  {name:'London SFP',oneLiner:'Sweep van de London-low, reclaim en terug de range in.',status:'active',grade:'A',tf:['15M','1H'],bias:'Bullish',baseWR:0.49,E:0.24,w:5},
  {name:'BOS-retest',oneLiner:'Break of structure, dan entry op de retest van de breakout.',status:'active',grade:'B',tf:['15M','4H'],bias:'Bullish',baseWR:0.46,E:0.10,w:4},
  {name:'Range-fade',oneLiner:'Fade de extremes van een duidelijke range naar het midden.',status:'active',grade:'B',tf:['5M','15M'],bias:'Neutraal',baseWR:0.44,E:-0.02,w:3},
  {name:'Reclaim',oneLiner:'Verlies + reclaim van een belangrijk niveau als trigger.',status:'testing',grade:'C',tf:['15M','30M'],bias:'Neutraal',baseWR:0.41,E:-0.15,w:2},
  {name:'VWAP-bounce',oneLiner:'Mean-reversion bounce op de dagelijkse VWAP.',status:'testing',grade:'C',tf:['5M','15M'],bias:'Neutraal',baseWR:0.38,E:-0.25,w:1},
];
const PB_POOL=[];PB_DEF.forEach(d=>{for(let i=0;i<d.w;i++)PB_POOL.push(d);});
const PB_BY_NAME={};PB_DEF.forEach(d=>PB_BY_NAME[d.name]=d);
function buildPlaybooks(){
  const pbook={};
  PB_DEF.forEach((d,i)=>{pbook[d.name]={name:d.name,oneLiner:d.oneLiner,
    layers:[{timeframe:d.tf[0],bias:d.bias,setups:[d.name],confirmations:[pick(CONFIRM),pick(CONFIRM)]},{timeframe:d.tf[1]||d.tf[0],bias:d.bias,setups:[],confirmations:[pick(CONFIRM)]}],
    criteria:[{text:'Duidelijke '+d.tf[0]+'-structuur',mandatory:true},{text:pick(CONFIRM)+' als bevestiging',mandatory:true},{text:'R:R minimaal 2:1',mandatory:false}],
    antiCriteria:[{text:'Vlak vóór high-impact nieuws',mandatory:true},{text:'Geen duidelijke liquidity-target',mandatory:false}],
    status:d.status,defaultGrade:d.grade,stop:'onder/boven de sweep',target:'volgende liquidity-pool',minRR:'2',
    bigPicture:'Werkt het best wanneer de hogere TF meebeweegt met de setup-richting.',tape:'Let op afnemend volume in de aanloop, dan expansie op de trigger.',intuition:'Voelt schoon als de sweep snel wordt teruggekocht.',
    examples:[{id:'ex'+i+'a',dataUrl:SHOTS[i%6],caption:'Schoolvoorbeeld',kind:'win'},{id:'ex'+i+'b',dataUrl:SHOTS[(i+2)%6],caption:'Marginale entry',kind:'marginal'},{id:'ex'+i+'c',dataUrl:SHOTS[(i+4)%6],caption:'Wat ging mis',kind:'fail'}],
    tradingViewUrl:'https://www.tradingview.com/chart/',referenceUrl:'',referenceLabel:'',pairs:[pick(PAIRK),pick(PAIRK)],sessions:[pick(SESSIONS)]};});
  return pbook;
}

// ── accounts: exchanges + handmatig ──
const EX_POOL=['blofin','blofin','blofin','okx','okx','okx','hyperliquid','hyperliquid','kraken','m_ftmo','m_ftmo','m_reserve'];
const MANUAL=[
  {id:'m_ftmo',name:'FTMO Challenge 100K',transactions:[
    {id:'tx1',type:'deposit',amount:'100000',date:'2025-03-01',note:'Challenge-account'},
    {id:'tx2',type:'withdrawal',amount:'8200',date:'2025-06-15',note:'Eerste payout'},
    {id:'tx3',type:'withdrawal',amount:'6400',date:'2025-09-10',note:'Payout'},
    {id:'tx4',type:'correction',amount:'96000',date:'2026-01-05',note:'Reconciliatie na reset'},
    {id:'tx5',type:'withdrawal',amount:'7100',date:'2026-05-02',note:'Payout'},
    {id:'tx6',type:'withdrawal',amount:'5900',date:'2026-08-28',note:'Payout'}]},
  {id:'m_reserve',name:'Spot Reserve',transactions:[
    {id:'tx7',type:'deposit',amount:'5000',date:'2025-02-01',note:'Startkapitaal'},
    {id:'tx8',type:'deposit',amount:'3000',date:'2025-07-01',note:'Bijstorting'},
    {id:'tx9',type:'withdrawal',amount:'1500',date:'2025-11-20',note:'Winst opgenomen'},
    {id:'tx10',type:'deposit',amount:'2500',date:'2026-06-10',note:'Bijstorting'}]},
];

// ── tijd: 20 maanden tot en met vandaag ──
const TODAY=new Date(); TODAY.setHours(12,0,0,0);
const END=TODAY.getTime(), START=END-608*864e5;   // ≈ 20 maanden
const dk=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return t.getUTCFullYear()+'-W'+String(Math.ceil(((t-y0)/864e5+1)/7)).padStart(2,'0');}
function sessTime(s){const h=s==='Asia'?rint(2,7):s==='London'?rint(8,12):s==='US AM'?rint(13,17):rint(18,22);return [h,rint(0,59)];}

/* Vorm over de tijd: een trader die groeit, met drie echte dips en een sterke laatste maand.
   De factor verschuift de win-rate (±) en de verwachting; zo ontstaan streaks en drawdowns. */
function formFactor(dateMs){
  const t=(dateMs-START)/(END-START);   // 0..1
  let f=Math.sin(t*Math.PI*2.6)*0.05+Math.sin(t*Math.PI*9)*0.025;
  if(t>0.20&&t<0.29)f-=0.20;            // dip 1: eerste echte drawdown (revenge-periode)
  if(t>0.50&&t<0.57)f-=0.17;            // dip 2: overtrading in een range-markt
  if(t>0.78&&t<0.85)f-=0.19;            // dip 3: zomerslump
  if(t>0.33&&t<0.40)f+=0.08;            // hot streak
  if(t>0.90)f+=0.07;                    // sterke laatste weken
  return f;
}
function outcome(kind,pb,dateMs){
  const k=kind==='backtest'?{dW:0.08,dE:0.30}:kind==='paper'?{dW:0.04,dE:0.14}:{dW:0,dE:0};
  const wr=clamp(pb.baseWR+k.dW+formFactor(dateMs),0.26,0.74);
  const E=pb.E+k.dE+formFactor(dateMs)*2.2;
  const avgWin=clamp((E+(1-wr))/wr,0.8,3.4);
  const win=chance(wr);
  let r;
  if(win)r=+rf(avgWin*0.55,avgWin*1.55).toFixed(2);
  else{const roll=rnd();r=roll<0.15?-+rf(0.2,0.6).toFixed(2):roll>0.9?-+rf(1.05,1.5).toFixed(2):-+rf(0.9,1.05).toFixed(2);}
  return {win,r};
}

let SEQ=0;
function genTrade(id,kind,dateMs,session,hm){
  const pb=pick(PB_POOL), pbName=pb.name;
  const exchange=pick(EX_POOL);
  const pair0=pick(PAIR_W), base=PAIRS[pair0]*(1+rf(-0.22,0.22));
  const pair=pair0.replace('/USDT',exchange==='hyperliquid'?'/USDC':(exchange==='kraken'||exchange==='m_ftmo')?'/USD':'/USDT');
  const dir=chance(pb.bias==='Bullish'?0.62:0.5)?'long':'short', dsign=dir==='long'?1:-1;
  const dec=base>1000?1:base>10?2:base>1?4:5;
  const entry=+base.toFixed(dec);
  const riskFrac=rf(0.004,0.02);
  const stop=+(entry*(1-dsign*riskFrac)).toFixed(dec);
  const riskDoel=kind==='live'?rf(120,400):rf(60,200);                       // ~0,5–1,6% van ±$25k
  const size=Math.round(clamp(riskDoel/(Math.abs(entry-stop)/entry),300,60000));
  const risk$=Math.abs(entry-stop)/entry*size;
  const rrPlanned=+rf(1.5,3.5).toFixed(1);
  const tpPrice=+(entry*(1+dsign*riskFrac*rrPlanned)).toFixed(dec);
  const {win,r}=outcome(kind,pb,dateMs);
  const fees=+(size*0.0006*rf(0.5,2)).toFixed(2);
  const exit=+(entry*(1+dsign*r*risk$/size)).toFixed(dec);
  const grossActual=(exit-entry)/entry*size*dsign;
  const pnl=+(grossActual-fees).toFixed(2);
  const rActual=risk$?+(grossActual/risk$).toFixed(2):r;
  const hindsightExit=kind!=='live'?+(entry*(1+dsign*riskFrac*rrPlanned*rf(0.75,1.05))).toFixed(dec):'';
  const nTP=rint(1,3); const tps=[]; let rem=100;
  for(let k=0;k<nTP;k++){const frac=(k+1)/nTP;const price=+(entry*(1+dsign*riskFrac*rrPlanned*frac)).toFixed(dec);const pct=k===nTP-1?rem:Math.min(rem-1,rint(25,50));rem-=pct;const hit=win?chance(0.85):(k===0&&chance(0.25));tps.push({price,pct,r:+(rrPlanned*frac).toFixed(1),hit});}
  const d=new Date(dateMs); const date=dk(d);
  const time=String(hm[0]).padStart(2,'0')+':'+String(hm[1]).padStart(2,'0');
  const emo=win?pick(['Rustig','Zelfverzekerd','Geduldig']):pick(EMOTIONS);
  const emotions=[emo]; if(chance(0.25))emotions.push(pick(EMOTIONS));
  const mistakes=(!win&&chance(0.55))?[pick(MISTAKES)]:[]; if(mistakes.length&&chance(0.2))mistakes.push(pick(MISTAKES));
  const tags=[...new Set([...(chance(0.4)?[pick(CUSTOM)]:[]),...(chance(0.5)?[pick(CONFIRM)]:[])])];
  const layers=[{timeframe:pb.tf[0],bias:pb.bias,setups:[pbName],confirmations:[pick(CONFIRM)]}];
  if(chance(0.5))layers.push({timeframe:pb.tf[1]||pb.tf[0],bias:pb.bias,setups:[],confirmations:[pick(CONFIRM)]});
  const shots=chance(0.2)?Array.from({length:rint(1,3)},()=>pick(SHOTS)):[];
  const durationMin=Math.round(win?rf(20,320):rf(6,140));
  const mae=+(win?rf(0.1,0.55):Math.abs(r)*rf(0.75,1.1)).toFixed(2);
  const mfe=+(win?r*rf(1.02,1.5):rf(0.15,0.9)).toFixed(2);
  const openMs=+new Date(`${date}T${time}:00`);
  // open: alleen live, alleen de laatste twee dagen (een echte journal heeft 0–2 open posities)
  const isOpen=kind==='live'&&(END-dateMs)<2*864e5&&chance(0.35);
  const closeMs=isOpen?0:openMs+durationMin*60000;
  if(closeMs)tps.forEach((tp,k)=>{if(tp.hit)tp.ts=openMs+Math.round(durationMin*60000*(k+1)/(tps.length+1));});
  const isEx=!/^m_/.test(exchange);
  // stappen (fills) voor exchange-trades: 1 instap (soms 2), afbouw per gehaalde TP, rest op de exit
  let fills=null;
  if(isEx&&!isOpen){
    const qtyA=+(size/entry).toFixed(6), sideIn=dir==='long'?'buy':'sell', sideOut=dir==='long'?'sell':'buy';
    fills=[]; let pos=0;
    const adds=chance(0.2)?2:1;
    for(let a=0;a<adds;a++){const q=+(qtyA/adds).toFixed(6);pos=+(pos+q).toFixed(6);fills.push({ts:openMs+a*rint(2,9)*60000,side:sideIn,kind:a?'add':'open',qty:q,qtyAsset:q,price:+(entry*(1+dsign*rf(-0.0008,0.0008))).toFixed(dec),fee:+(fees/(adds+2)).toFixed(4),posAfter:pos,posAfterAsset:pos,dirAfter:dir,avgEntry:entry,pnl:null,pnlCalc:null,ordId:'o'+(id*10+a)});}
    const hits=tps.filter(t=>t.hit); let remQ=pos;
    hits.forEach((tp,k)=>{const q=k===hits.length-1&&!(!win)?remQ:+(pos*tp.pct/100).toFixed(6);const qq=Math.min(q,remQ);remQ=+(remQ-qq).toFixed(6);const p=(tp.price-entry)*qq*dsign;fills.push({ts:tp.ts||closeMs,side:sideOut,kind:'close',qty:qq,qtyAsset:qq,price:tp.price,fee:+(fees/(adds+2)).toFixed(4),posAfter:remQ,posAfterAsset:remQ,dirAfter:remQ>0?dir:'',avgEntry:entry,pnl:+p.toFixed(4),pnlCalc:+p.toFixed(4),ordId:'o'+(id*10+5+k)});});
    if(remQ>0){const p=(exit-entry)*remQ*dsign;fills.push({ts:closeMs,side:sideOut,kind:'close',qty:remQ,qtyAsset:remQ,price:exit,fee:+(fees/(adds+2)).toFixed(4),posAfter:0,posAfterAsset:0,dirAfter:'',avgEntry:entry,pnl:+p.toFixed(4),pnlCalc:+p.toFixed(4),ordId:'o'+(id*10+9)});}
    fills.sort((a,b)=>a.ts-b.ts);
  }
  const t={
    openTime:String(openMs),closeTime:closeMs?String(closeMs):'',
    id,date,time,pair,dir,setup:pbName,session,timeframe:pb.tf[0],market:pick(MARKETS),grade:chance(0.85)?pb.grade:pick(['A','B','C']),
    entry,exit:isOpen?'':exit,stop,tp:tpPrice,tps,hindsightExit,
    size,leverage:pick([3,5,10,20,25]),fees:isOpen?'':fees,risk:+(risk$/24663*100).toFixed(2),rrPlanned,
    pnl:isOpen?'':pnl,pnlPct:isOpen?0:+(pnl/24663*100).toFixed(2),r:isOpen?0:rActual,
    status:isOpen?'open':'closed',
    emotion:emotions[0],emotions,mistake:mistakes[0]||'',mistakes,
    kind,missedReasons:[],tags,layers,exchange,account:'',
    notes:win?pick(['Schone entry, plan gevolgd.','Mooie setup, geduldig gewacht.','Precies volgens playbook.','']):pick(['Te vroeg ingestapt.','Had op bevestiging moeten wachten.','Emotie speelde mee.','']),
    lessons:!win&&chance(0.5)?pick(['Volgende keer wachten op de retest.','Kleiner sizen bij twijfel.','Niet forceren buiten de sessie.']):'',
    durationMin,mae,mfe,screenshots:shots,rating:win?rint(3,5):rint(1,3),checks:[],realizedPnl:'',
  };
  if(isEx&&kind==='live'){t.srcId=exchange+'_'+(700000000+id)+'_'+openMs;t.positionId=String(700000000+id);}   // gesynct: entry/exit/size van de exchange
  if(fills)t.fills=fills;
  if(isOpen){t.unrealizedPnl=+(risk$*rf(-0.6,1.4)).toFixed(2);t.liq=+(entry*(1-dsign*0.09)).toFixed(dec);}
  return t;
}

/* Handelsdagen: doordeweeks 0–4 trades (meestal 1–2), weekend zelden. Paper/backtest komen
   in blokken ("even een setup testen"). */
function buildTrades(){
  const trades=[]; let id=0;
  for(let ms=START;ms<=END;ms+=864e5){
    const d=new Date(ms), wd=d.getDay(), t=(ms-START)/(END-START);
    const weekend=wd===0||wd===6;
    let n=weekend?(chance(0.12)?1:0):pick([0,1,1,1,2,2,2,3,3,4]);
    if(t>0.50&&t<0.56)n+=chance(0.6)?2:1;                       // overtrading-periode: meer trades, slechter
    if(chance(0.06))n=0;                                          // vrije dag
    const sessions=[]; for(let i=0;i<n;i++)sessions.push(pick(SESS_W));
    sessions.sort((a,b)=>SESSIONS.indexOf(a)-SESSIONS.indexOf(b));
    sessions.forEach(s=>{trades.push(genTrade(id++,'live',ms,s,sessTime(s)));});
    if(chance(0.25)){const k=chance(0.5)?'paper':'backtest';const m=rint(1,3);for(let i=0;i<m;i++){const s=pick(SESS_W);trades.push(genTrade(id++,k,ms,s,sessTime(s)));}}
  }
  trades.sort((a,b)=>(a.openTime<b.openTime?1:-1));
  trades.forEach((t,i)=>t.id=i);
  return trades;
}

/* ── TradingPlan-blok: laatste 8 weken plannen, poort-records bij de laatste ~70 live exchange-trades ── */
function buildTradingPlan(trades){
  const DEF_PT=[{k:"trend",t:"Trend mee",d:"Daily / 4h / 1h zelfde kant op. Anders: BoS op HTF."},{k:"zone",t:"Prijs in HP-zone",d:"High probability zone: supply, demand, OB of DOPS uit je dagstart."},{k:"trigger",t:"Trigger uit de lijst",d:"BoS/MSB, liquiditeit uitgenomen, SFP, structuur houdt. Op 15m."},{k:"sl",t:"SL op logisch level",d:"Invalidatie staat. Level 1, 2 of 3?"},{k:"rr",t:"Minimaal 2R naar TP1",d:"Gemeten, niet geschat."},{k:"ftmo",t:"FTMO-ruimte oké",d:"Daily loss en drawdown-buffer gecheckt.",hard:true},{k:"mind",t:"Mentaal oké",d:"Kalm. Geen revenge, geen verveling.",hard:true}];
  const DG_K=['start','trend','hl','flats','wknd','mon','hp','reclaim','range','news','ethbtc','tools'], WK_K=['review','monthly','wclose','wopen','levels','hp','liq','news','max','focus'];
  const plans={}, recs=[];
  const live=trades.filter(t=>t.kind==='live'&&t.status==='closed'&&t.srcId).slice(0,70);   // nieuwste eerst
  const SC=[['Sweep weekend-high','prijs sweept de weekend-high en geeft 15m SFP','short vanaf de 15m OB, TP1 POC','15m close boven de sweep-high'],['Reclaim POC','prijs verliest POC en reclaimt binnen 2 candles','long naar VAH, halve size','15m close onder VAL'],['BOS-retest','15m BoS omhoog en retest van de breakout','long vanaf de retest, SL onder de low','structuur breekt terug'],['Afwijzing 4h OB','prijs tikt de 4h OB aan met afwijzing','short naar de 1h POC','15m close door de OB']];
  const LES=['Wacht op de 15m close vóór je short gaat.','Niet twee keer dezelfde zone shorten na een verlies.','Kleiner sizen op nieuwsdagen.','Eén setup per sessie is genoeg.','Na 2 verliezers: laptop dicht.','Geen entry zonder SFP — ook niet als het "wel goed voelt".'];
  live.forEach((t,i)=>{
    const setup=t.grade==='A'?'A':t.grade==='B'?'B':'C', exec=i%7===3?'HALF':(i%11===5?'NO':'VOL'), missing=exec==='HALF'?[pick(['rr','zone','trigger'])]:exec==='NO'?['trigger','rr']:[];
    const checks={};DEF_PT.forEach(p=>{checks[p.k]=missing.indexOf(p.k)<0;});
    const ts=new Date(+t.openTime-rint(4,22)*60000), mx=setup==='A'?2:setup==='B'?1:0.5;
    recs.push({id:800000+i,ts:ts.toISOString(),week:isoWeek(new Date(t.date+'T12:00:00')),day:t.date,sym:t.pair.split('/')[0],dir:t.dir==='short'?'Short':'Long',tf:t.timeframe==='4H'?'1h':'15m',setup,checks,missing,exec,grade:exec==='VOL'?'A':exec==='HALF'?'B':'NO',risk:exec==='VOL'?mx:exec==='HALF'?mx/2:0,taken:true,r:null,noTrade:exec==='NO'&&chance(0.4)?['Na 2 verliezers op één dag']:[],notes:exec==='NO'?pick(['Wilde het verlies goedmaken. Fout.','Buiten de sessie, toch geklikt.']):''});
    t.planRef=String(800000+i);
    const dag=t.date, pid='dag-'+dag;
    if(!plans[pid]){const sc=pick(SC),sc2=pick(SC),saved=new Date(dag+'T08:30:00').toISOString(),dayR=0;
      plans[pid]={id:pid,type:'dag',key:dag,checks:Object.fromEntries(DG_K.map(k=>[k,chance(0.85)])),images:[],links:[],saved:true,savedAt:saved,updatedAt:saved,
        bias:t.dir==='long'?'Bullish':'Bearish',tD:t.dir==='long'?'up':'down',t4:pick(['up','down','range']),t1:pick(['up','down','range']),levels:'POC / VAH / VAL gemarkeerd\nHP-zone op de 4h OB',ftmo:'daily loss nog '+rf(2,4.5).toFixed(1).replace('.',',')+'% over',mind:String(pick([1,2,2,2,3,3,4])),
        scenarios:[{title:sc[0],als:sc[1],dan:sc[2],ongeldig:sc[3],text:'',images:[],links:[]},{title:sc2[0],als:sc2[1],dan:sc2[2],ongeldig:sc2[3],text:'',images:[],links:[]}],
        close:{scenario:chance(0.7)?0:'geen',gevolgd:exec==='NO'?'nee':pick(['ja','ja','deels']),les:pick(LES),r:null,saved:true,savedAt:new Date(dag+'T18:10:00').toISOString()}};}
  });
  // weekplannen voor de weken waarin die dagen vallen
  Object.values(plans).forEach(p=>{const wk=isoWeek(new Date(p.key+'T12:00:00')),wid='week-'+wk;if(plans[wid])return;const saved=new Date(p.key+'T20:00:00').toISOString();
    plans[wid]={id:wid,type:'week',key:wk,checks:Object.fromEntries(WK_K.map(k=>[k,true])),images:[],links:[],saved:true,savedAt:saved,updatedAt:saved,bias:pick(['Bullish','Bearish','Range']),open:'',range:'',levels:'Weekly high/low, 4h OB\'s, POC van vorige week',liq:'Weekend high/low, Monday range, flats',maxtrades:String(pick([4,5,6])),news:'wo CPI 14:30 · do claims 14:30',focus:pick(['Geen entry zonder SFP','Eén trade per sessie','Kleiner sizen na een verlies','Geen counter-trend vóór 12:00']),notrade:'Binnen 2 minuten na high-impact nieuws\nNa 2 verliezers op één dag\nBuiten de London- of NY-sessie'};});
  const cfg={pt:DEF_PT,dg:[{g:"Timeframe"},{k:"start",t:"Start op het juiste timeframe",d:""},{g:"Trend"},{k:"trend",t:"Trend bepaald op Daily / 4h / 1h",d:"Bullish of bearish, per timeframe."},{k:"hl",t:"Belangrijke highs / lows gereclaimed of verloren?",d:"Let op cowboys en clowns."},{g:"Liquiditeit"},{k:"flats",t:"Flats gemarkeerd"},{k:"wknd",t:"Weekend liquiditeit gemarkeerd"},{k:"mon",t:"Monday range gemarkeerd"},{g:"Zones"},{k:"hp",t:"High probability zones gemarkeerd",d:"Supply / demand / OB's / DOPS."},{k:"reclaim",t:"Zones die je wilt zien reclaimen of vasthouden"},{k:"range",t:"Range gemarkeerd",d:"Market Monkey of FRVP. Komen POC / VAH / VAL overeen met de HP-zones?"},{g:"Extra"},{k:"news",t:"US nieuws gecheckt",d:"Tijden staan in het weekplan."},{k:"ethbtc",t:"ETH/BTC bekeken"},{k:"tools",t:"Live data tools open"}],
    wk:[{g:"Context"},{k:"review",t:"Vorige week gereviewd",d:"Trades, R, regelbreuken. Wat neem je mee?"},{k:"monthly",t:"Monthly context bekeken",d:"Waar zitten we in de maandcandle?"},{k:"wclose",t:"Weekly close van vorige week beoordeeld",d:"Sterk of zwak gesloten? Boven of onder key level?"},{g:"Levels"},{k:"wopen",t:"Weekly open gemarkeerd"},{k:"levels",t:"Key levels Daily / 4h gemarkeerd"},{k:"hp",t:"High probability zones voor de week"},{k:"liq",t:"Liquiditeit vorige week gemarkeerd",d:"Weekend high/low, ongeteste highs/lows, flats."},{g:"Regels"},{k:"news",t:"Nieuwskalender ingevuld",d:"CPI, FOMC, NFP. Dag en tijd."},{k:"max",t:"Max trades voor de week bepaald"},{k:"focus",t:"Eén focuspunt gekozen",d:"Niet drie. Eén."}],
    gradeMode:'assen',max:{A:2,B:1,C:0.5},matchMin:45};
  const meta={schema:2,introSeen:true,pbSeen:true,pbTouched:true};
  // het blok zoals de journal-back-up het draagt: per sleutel de JSON-tekst
  return {trades:JSON.stringify(recs),plans:JSON.stringify(plans),cfg:JSON.stringify(cfg),meta:JSON.stringify(meta)};
}

function build(){
  const trades=buildTrades();
  const tradingplan=buildTradingPlan(trades);
  const tagConfig={setupTags:PB_DEF.map(d=>d.name),confirmationTags:CONFIRM,timeframeTags:TF,emotionTags:EMOTIONS,mistakeTags:MISTAKES,missedReasonTags:['🐢 Durf','🔪 Buiten regels','⏰ Te laat gespot','💰 Kapitaal vol'],customTags:CUSTOM};
  return {
    app:'SyncJournal',appVersion:'v0.9.134',schemaVersion:8,exported:new Date().toISOString(),
    _note:'Voorbeelddata v2 — gegenereerd door scripts/gen-syncjournal-dataset-v2.js (data t/m vandaag, incl. TradingPlan-blok)',
    tagConfig,pbook:buildPlaybooks(),
    conns:{blofin:{connected:true,autoSync:true,hint:'5533'},okx:{connected:true,autoSync:true,hint:'318f'},hyperliquid:{connected:true,autoSync:false,wallet:'0x1d14…3E70'}},
    manual:MANUAL,sync:{auto:true,interval:'15m'},
    aiPrefs:{enabled:true,tone:'neutraal',focus:{discipline:true,risk:true,psychologie:true},hideAmounts:false},
    sections:{hero:true,kpis:true,equity:true,monthly:true,edge:true,recent:true},
    exMeta:{blofin:{val:10527,acct:'Swing'},okx:{val:6240,acct:'OKX'},hyperliquid:{val:2115,acct:'HL'},kraken:{val:1480,acct:'Kraken'}},
    settings:{theme:'dark',currency:'USD',priv:false,density:'comfy'},
    tradingplan,
    trades,
  };
}

const out=process.argv[2]||'site/demo-dataset.json';
const outPath=path.resolve(__dirname,'..',out);
const data=build();
fs.writeFileSync(outPath,JSON.stringify(data));
const kb=Math.round(fs.statSync(outPath).size/1024);
const live=data.trades.filter(t=>t.kind==='live'&&t.status==='closed');
const netR=live.reduce((s,t)=>s+(+t.r||0),0), netP=live.reduce((s,t)=>s+(+t.pnl||0),0), wins=live.filter(t=>t.pnl>0).length;
// drawdown op de cumulatieve R (chronologisch)
let cum=0,peak=0,dd=0;live.slice().reverse().forEach(t=>{cum+=+t.r||0;peak=Math.max(peak,cum);dd=Math.min(dd,cum-peak);});
const byKind=data.trades.reduce((a,t)=>{a[t.kind]=(a[t.kind]||0)+1;return a;},{});
console.log(`✓ ${data.trades.length} trades → ${out} (~${kb} KB) · ${data.trades[0].date} … ${data.trades[data.trades.length-1].date}`);
console.log(`  kinds ${JSON.stringify(byKind)} · open: ${data.trades.filter(t=>t.status==='open').length} · met stappen: ${data.trades.filter(t=>t.fills).length} · gesynct: ${data.trades.filter(t=>t.srcId).length}`);
console.log(`  live gesloten: ${live.length} · winrate ${Math.round(wins/live.length*100)}% · netto ${netR.toFixed(1)}R / $${netP.toFixed(0)} · max drawdown ${dd.toFixed(1)}R`);
console.log(`  tradingplan: ${JSON.parse(data.tradingplan.trades).length} poort-records · ${Object.keys(JSON.parse(data.tradingplan.plans)).length} plannen · gekoppeld: ${data.trades.filter(t=>t.planRef).length}`);
