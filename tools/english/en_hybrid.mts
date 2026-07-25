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
// bilstm predictions
const bl=new Map<string,string>();
for (const l of readFileSync("/tmp/en_bilstm_holdout.tsv","utf8").split("\n")) { if(!l.includes("\t"))continue; const [w,,pred]=l.split("\t"); if(w) bl.set(w, pred==="DECLINED"?"":pred!); }
const de=(s:string)=>s.split(" ").map(t=>t.replace(/[012]$/,"")).join(" ");
const by:Record<string,{n:number,pipe:number,pipeD:number,blstm:number,blstmD:number}>={C:{n:0,pipe:0,pipeD:0,blstm:0,blstmD:0},M:{n:0,pipe:0,pipeD:0,blstm:0,blstmD:0},N:{n:0,pipe:0,pipeD:0,blstm:0,blstmD:0}};
let hybrid=0,hybridD=0,ntot=0;
for (const [w,truth] of full) { if(!heldout(w))continue; ntot++; const t=truth.join(" ");
  const d=g2p.decompose(w); const p=d.phones.join(" "); const b=bl.get(w)??"";
  const g=by[d.source]!; g.n++;
  if(p===t)g.pipe++; if(de(p)===de(t))g.pipeD++; if(b===t)g.blstm++; if(de(b)===de(t))g.blstmD++;
  // HYBRID: dict-backed compound/morph from the pipeline, BiLSTM for the n-gram tail
  const hy = (d.source==="N") ? b : p;
  if(hy===t)hybrid++; if(de(hy)===de(t))hybridD++;
}
console.log("per-path exact% (incl stress) — pipeline vs BiLSTM:");
for (const k of ["C","M","N"]) { const g=by[k]!; console.log(`  ${ {C:"compound",M:"morph   ",N:"n-gram  "}[k] } (${String(g.n).padStart(5)}): pipeline ${(100*g.pipe/g.n).toFixed(1)}%  BiLSTM ${(100*g.blstm/g.n).toFixed(1)}%   [stress-indep: pipe ${(100*g.pipeD/g.n).toFixed(1)}% / BiLSTM ${(100*g.blstmD/g.n).toFixed(1)}%]`); }
console.log(`\nHYBRID (compound+morph from dict, BiLSTM for n-gram tail): exact ${(100*hybrid/ntot).toFixed(1)}%  stress-indep ${(100*hybridD/ntot).toFixed(1)}%  (n=${ntot})`);
