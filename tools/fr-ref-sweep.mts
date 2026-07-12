import { readFileSync } from "node:fs";
import { toIpa } from "../src/languages/french/g2p.ts";
const ref = readFileSync("/tmp/fr_wikipron_gold.tsv","utf8").split("\n").filter(Boolean);
let match=0,total=0; const b=new Map<string,{n:number;ex:string[]}>();
for (const line of ref){ const [w,exp]=line.split("\t"); if(!w||!exp)continue; total++;
  const a=toIpa(w); if(a===exp){match++;continue;}
  let p=0;while(p<a.length&&p<exp.length&&a[p]===exp[p])p++; let s=0;while(s<a.length-p&&s<exp.length-p&&a[a.length-1-s]===exp[exp.length-1-s])s++;
  const k=`«${a.slice(p,a.length-s)||"∅"}»≠«${exp.slice(p,exp.length-s)||"∅"}»`;
  const e=b.get(k)||{n:0,ex:[]}; e.n++; if(e.ex.length<2)e.ex.push(`${w}:${a}|${exp}`); b.set(k,e);
}
console.log(`exact: ${match}/${total} = ${(100*match/total).toFixed(1)}%`);
[...b.entries()].sort((x,y)=>y[1].n-x[1].n).slice(0,18).forEach(([k,v])=>console.log(`  ${String(v.n).padStart(3)} ${k}  e.g. ${v.ex[0]}`));
