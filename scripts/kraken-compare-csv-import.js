// Usage: node scripts/kraken-compare-csv-import.js <kraken-account-log.csv> <import-result.json>
// Compares the app's Kraken CSV-import output (from kraken-csv-import-adhoc.js) with the account-log reconstruction.
// Compare the app's Kraken CSV-import output with the independent account-log reconstruction.
const fs=require("fs");
const [csvPath, importPath]=process.argv.slice(2);
// --- reuse recon (inline, trimmed) ---
const lines=fs.readFileSync(csvPath,"utf8").trim().split(/\r?\n/); const hdr=lines[0].split(",");
const rows=lines.slice(1).map(l=>{const c=l.split(","); const o={}; hdr.forEach((h,i)=>o[h]=c[i]); return o;});
const ft=rows.filter(r=>r.type==="futures trade");
const cRows=ft.filter(r=>r.symbol===r.contract), uRows=ft.filter(r=>r.symbol!==r.contract);
const key=r=>r.dateTime+"|"+r.contract+"|"+(+r["trade price"]).toFixed(2); const usdBy={}; for(const r of uRows)(usdBy[key(r)]=usdBy[key(r)]||[]).push(r);
const fills=cRows.map(r=>{const u=(usdBy[key(r)]||[]).shift(); return {t:Date.parse(r.dateTime.replace(" ","T")+"Z"),contract:r.contract,qty:+r.change,bal:+r["new balance"],price:+r["trade price"],pnl:u?+u["realized pnl"]||0:0,fee:u?+u.fee||0:0};}).sort((a,b)=>a.t-b.t||(Math.abs(a.bal)>Math.abs(b.bal)?-1:1));
const pos=[],open={};
for(const f of fills){const c=f.contract; let p=open[c]; if(!p)p=open[c]={contract:c,dir:f.qty>0?"long":"short",openT:f.t,opens:[],closes:[],fee:0,pnl:0};
 const same=(p.dir==="long"&&f.qty>0)||(p.dir==="short"&&f.qty<0); if(same)p.opens.push(f); else {p.closes.push(f); p.pnl+=f.pnl;} p.fee+=f.fee;
 if(Math.abs(f.bal)<1e-9){p.closeT=f.t; const w=a=>{let q=0,v=0;for(const x of a){q+=Math.abs(x.qty);v+=Math.abs(x.qty)*x.price;}return q?{qty:q,avg:v/q}:{qty:0,avg:null};}; const o=w(p.opens),cl=w(p.closes);
   pos.push({contract:c,dir:p.dir,openT:p.openT,closeT:p.closeT,qty:o.qty,entry:o.avg,exit:cl.avg,gross:p.pnl,fee:p.fee,net:p.pnl-p.fee,nC:p.closes.length}); delete open[c];}}
// --- import output ---
const imp=JSON.parse(fs.readFileSync(importPath,"utf8"));
const fmt=ms=>new Date(ms).toISOString().replace("T"," ").slice(0,16);
let ok=0,dirBad=0,entryBad=0,exitBad=0,pnlNet=0,pnlGross=0,pnlOther=0,sizeIsQty=0,timeUtc=0,unmatched=0; const bad=[];
const used=new Set();
for(const p of pos){
  const openStr=fmt(p.openT); // UTC
  let m=imp.find(t=>!used.has(t.id)&&t.date+" "+t.time===openStr&&t.pair.startsWith(p.contract.replace("pf_","").replace("xbt","btc").toUpperCase().slice(0,3)));
  if(!m){ // try match by entry price
    m=imp.find(t=>!used.has(t.id)&&Math.abs(t.entry-p.entry)<0.6&&Math.abs(t.exit-p.exit)<0.6);
  } else timeUtc++;
  if(!m){unmatched++; bad.push("UNMATCHED "+p.contract+" "+p.dir+" "+openStr); continue;}
  used.add(m.id);
  const f=[];
  if(m.dir!==p.dir){dirBad++;f.push("DIR "+m.dir);}
  if(Math.abs(m.entry-p.entry)>0.6){entryBad++;f.push("ENTRY "+m.entry.toFixed(1)+" vs "+p.entry.toFixed(1));}
  if(Math.abs(m.exit-p.exit)>0.6){exitBad++;f.push("EXIT "+m.exit.toFixed(1)+" vs "+p.exit.toFixed(1));}
  if(Math.abs(m.pnl-p.net)<0.02)pnlNet++; else if(Math.abs(m.pnl-p.gross)<0.02)pnlGross++; else {pnlOther++;f.push("PNL "+m.pnl+" vs gross "+p.gross.toFixed(4)+" net "+p.net.toFixed(4));}
  if(Math.abs(+m.size-p.qty)<1e-6)sizeIsQty++;
  if(f.length)bad.push(p.contract+" "+p.dir+" "+openStr+" -> "+f.join(", ")); else ok++;
}
console.log(`CSV positions ${pos.length} | import trades ${imp.length} | fully ok ${ok} | unmatched ${unmatched}`);
console.log(`dir wrong ${dirBad} | entry wrong ${entryBad} | exit wrong ${exitBad}`);
console.log(`pnl == net ${pnlNet} | pnl == gross (fees not deducted) ${pnlGross} | pnl other ${pnlOther}`);
console.log(`size stored as asset qty (not USD notional) ${sizeIsQty}/${pos.length} | date+time equals UTC open (no Amsterdam conversion) ${timeUtc}/${pos.length}`);
console.log("open/closeTime empty:", imp.filter(t=>!t.openTime&&!t.closeTime).length, "| fills empty:", imp.filter(t=>!t.fills).length, "| tps>0:", imp.filter(t=>t.tps>0).length);
console.log("\nfirst 25 deviations:"); bad.slice(0,25).forEach(l=>console.log(" ",l));
