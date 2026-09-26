// Usage: node scripts/kraken-recon.js <kraken-account-log.csv> <syncjournal-backup.json>
// Reconstructs Kraken Futures positions from the account-log CSV (ground truth: old/new balance per fill)
// and compares them with the Kraken trades in a SyncJournal backup. See docs/opdracht-kraken-fix-2026-09-26.md.
// Reconstruct Kraken Futures positions from the account-log CSV (ground truth) and compare with the journal export.
const fs=require("fs");
const csvPath=process.argv[2], bakPath=process.argv[3];
const lines=fs.readFileSync(csvPath,"utf8").trim().split(/\r?\n/);
const hdr=lines[0].split(",");
const rows=lines.slice(1).map(l=>{const c=l.split(","); const o={}; hdr.forEach((h,i)=>o[h]=c[i]); return o;});
const ft=rows.filter(r=>r.type==="futures trade");
// CSV is UTC (assumed). Pair contract-row and usd-row of the same fill: same dateTime+contract+trade price, consumed in order.
const contractRows=ft.filter(r=>r.symbol===r.contract);
const usdRows=ft.filter(r=>r.symbol!==r.contract);
const key=r=>r.dateTime+"|"+r.contract+"|"+(+r["trade price"]).toFixed(2);
const usdBy={}; for(const r of usdRows){(usdBy[key(r)]=usdBy[key(r)]||[]).push(r);}
let unpaired=0;
const fills=contractRows.map(r=>{
  const u=(usdBy[key(r)]||[]).shift(); if(!u) unpaired++;
  return {t:Date.parse(r.dateTime.replace(" ","T")+"Z"), dt:r.dateTime, contract:r.contract, qty:+r.change, bal:+r["new balance"], avgEntry:+r["new average entry price"]||null,
          price:+r["trade price"], pnl:u?+u["realized pnl"]||0:0, fee:u?+u.fee||0:0, uid:r.uid};
}).sort((a,b)=>a.t-b.t || (Math.abs(a.bal)>Math.abs(b.bal)?-1:1));
console.log("fills:",fills.length,"unpaired usd rows:",unpaired);
// lifecycle
const pos=[]; const open={};
for(const f of fills){
  const c=f.contract; let p=open[c];
  const prevBal = p ? p.bal : 0;
  const newBal = f.bal;
  if(!p){ p=open[c]={contract:c, dir: f.qty>0?"long":"short", openT:f.t, opens:[], closes:[], fee:0, pnl:0, bal:0, flip:false}; }
  const sameDir = (p.dir==="long"&&f.qty>0)||(p.dir==="short"&&f.qty<0);
  if(sameDir){ p.opens.push(f); } else { p.closes.push(f); p.pnl+=f.pnl; }
  p.fee+=f.fee; p.bal=newBal;
  if(Math.abs(newBal)<1e-9){ p.closeT=f.t; finish(p); delete open[c]; }
  else if(Math.sign(newBal)!==(p.dir==="long"?1:-1)){ // flipped through zero
    p.closeT=f.t; p.flip=true; finish(p); delete open[c];
    open[c]={contract:c, dir:newBal>0?"long":"short", openT:f.t, opens:[{...f,qty:newBal}], closes:[], fee:0, pnl:0, bal:newBal, flip:true};
  }
}
function finish(p){
  const w=(arr)=>{let q=0,v=0; for(const f of arr){q+=Math.abs(f.qty); v+=Math.abs(f.qty)*f.price;} return q?{qty:q,avg:v/q}:{qty:0,avg:null};};
  const o=w(p.opens), c=w(p.closes);
  pos.push({contract:p.contract, dir:p.dir, openT:p.openT, closeT:p.closeT, qty:o.qty, entry:o.avg, exit:c.avg, notional:o.qty*(o.avg||0), gross:p.pnl, fee:p.fee, net:p.pnl-p.fee, nOpens:p.opens.length, nCloses:p.closes.length, flip:p.flip});
}
for(const c in open){ const p=open[c]; p.closeT=null; finish(p); }
const fmt=ms=>ms?new Date(ms).toISOString().replace("T"," ").slice(0,16):"OPEN";
console.log("positions reconstructed:",pos.length," (closed:",pos.filter(p=>p.closeT).length,", flips:",pos.filter(p=>p.flip).length,")");
const pm={}; for(const p of pos){const k=fmt(p.openT).slice(0,7); pm[k]=(pm[k]||0)+1;} console.log("positions per month:",pm);
const multi=pos.filter(p=>p.nCloses>1).length, multiOpen=pos.filter(p=>p.nOpens>1).length;
console.log("positions with >1 close fill:",multi," with >1 open fill:",multiOpen);
// journal
const b=JSON.parse(fs.readFileSync(bakPath,"utf8"));
const kr=b.trades.filter(t=>t.exchange==="kraken");
const used=new Set();
let matched=0, dirMis=0, sizeMis=0, pnlMis=0;
console.log("\n=== CSV positions (UTC) vs journal ===");
console.log("status | contract dir open->close qty entry exit gross fee net nO/nC | journal: id dir entry exit size pnl");
for(const p of pos.sort((a,b)=>a.openT-b.openT)){
  let best=null,bd=Infinity;
  for(const t of kr){ if(used.has(t.id)) continue; const d=Math.min(Math.abs(+t.closeTime-p.closeT),Math.abs(+t.openTime-p.openT)); if(d<bd){bd=d;best=t;} }
  const ok = best && bd<=3*60*1000;
  const line = `${p.contract} ${p.dir} ${fmt(p.openT)}->${fmt(p.closeT)} qty ${p.qty.toFixed(4)} e ${p.entry&&p.entry.toFixed(1)} x ${p.exit&&p.exit.toFixed(1)} gross ${p.gross.toFixed(2)} fee ${p.fee.toFixed(2)} net ${p.net.toFixed(2)} ${p.nOpens}/${p.nCloses}${p.flip?" FLIP":""}`;
  if(ok){ used.add(best.id); matched++;
    const flags=[]; if((best.dir||"").toLowerCase()!==p.dir&&!((best.dir||"").toLowerCase().startsWith(p.dir.slice(0,1)))) {flags.push("DIR");dirMis++;}
    if(Math.abs(+best.size-p.notional)/p.notional>0.05){flags.push("SIZE");sizeMis++;}
    if(Math.abs(+best.pnl-p.net)>0.5){flags.push("PNL");pnlMis++;}
    console.log(`${flags.length?"MISMATCH "+flags.join(","):"ok"} | ${line} | #${best.id} ${best.dir} e ${best.entry} x ${best.exit} sz ${best.size} pnl ${best.pnl}`);
  } else console.log(`MISSING  | ${line}`);
}
console.log("\njournal kraken trades not matched to any CSV position:");
for(const t of kr) if(!used.has(t.id)) console.log(` #${t.id} ${t.dir} open ${fmt(+t.openTime)} close ${fmt(+t.closeTime)} e ${t.entry} x ${t.exit} sz ${t.size} pnl ${t.pnl}`);
console.log(`\nSUMMARY: csv closed positions ${pos.filter(p=>p.closeT).length}, journal ${kr.length}, matched ${matched}, missing ${pos.filter(p=>p.closeT).length-matched}, dir-mismatch ${dirMis}, size-mismatch ${sizeMis}, pnl-mismatch ${pnlMis}`);
const totCsv=pos.reduce((s,p)=>s+p.net,0), totJ=kr.reduce((s,t)=>s+(+t.pnl||0),0);
console.log(`net PnL csv ${totCsv.toFixed(2)} vs journal ${totJ.toFixed(2)}`);
