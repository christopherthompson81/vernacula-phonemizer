import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnglishG2p, type EnglishG2pModel } from "../../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../../src/languages/english/manifest.ts";
const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "languages", "english");
const full = new Map<string, string[]>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) { if (l.startsWith("#")||!l.includes("\t"))continue; const [w,ph]=l.split("\t"); const wl=w!.toLowerCase(); if(/^[a-z]+$/.test(wl)) full.set(wl, ph!.split(" ")); }
const heldout = (w: string) => BigInt("0x"+createHash("md5").update("en:"+w).digest("hex"))%10n===0n;
const train=new Map<string,string[]>(); for (const [w,p] of full) if(!heldout(w)) train.set(w,p);
const model=JSON.parse(readFileSync(join(EN,"g2p-model.json"),"utf8")) as EnglishG2pModel;
const common=new Set(readFileSync(join(EN,"g2p-common.txt"),"utf8").split("\n").map(s=>s.trim()).filter(Boolean));
const g2p=createEnglishG2p(model,train,common,(ph:string[])=>ph.join(" "),{...MANIFEST.g2pClasses,vowels:MANIFEST.arpabet.vowels});
const bl=new Map<string,string[]>();
for (const l of readFileSync("/tmp/en_bilstm_holdout.tsv","utf8").split("\n")) { if(!l.includes("\t"))continue; const [w,,pred]=l.split("\t"); if(w&&pred&&pred!=="DECLINED") bl.set(w, pred.split(" ")); }
const ds=(ts:string[])=>ts.map(t=>t.replace(/[012]$/,""));
const lev=(a:string[],b:string[])=>{const d=Array(b.length+1).fill(0).map((_,j)=>j);for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];};
let n=0, pW=0,bW=0, pErr=0,bErr=0,tot=0;
for (const [w,truth] of full){ if(!heldout(w))continue; n++;
  const T=ds(truth); const P=ds(g2p.decompose(w).phones); const B=ds(bl.get(w)??[]);
  if(P.join(" ")===T.join(" "))pW++; if(B.join(" ")===T.join(" "))bW++;
  pErr+=lev(P,T); bErr+=lev(B,T); tot+=T.length;
}
const pct=(x:number)=>(100*x).toFixed(1)+"%";
console.log(`clean CMUdict held-out (${n} words), stress-independent phones:`);
console.log(`                        WORD-exact     PHONE-acc (1−PER)`);
console.log(`  current pipeline      ${pct(pW/n).padEnd(14)} ${pct(1-pErr/tot)}`);
console.log(`  BiLSTM tagger         ${pct(bW/n).padEnd(14)} ${pct(1-bErr/tot)}`);
console.log(`  → phone-error-rate:   pipeline ${pct(pErr/tot)}  vs  BiLSTM ${pct(bErr/tot)}  (${((pErr-bErr)/pErr*100).toFixed(0)}% fewer phone errors)`);
