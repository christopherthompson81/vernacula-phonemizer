import { readFileSync } from "node:fs";
import { phonemizeWord } from "../src/languages/german/german.ts";
const ref=new Map<string,string>();
for(const l of readFileSync("/mnt/data/de_kaikki.tsv","utf8").split("\n")){const t=l.indexOf("\t");if(t<0)continue;const w=l.slice(0,t).toLowerCase();if(!/^[a-zäöüß]+$/.test(w)||ref.has(w))continue;ref.set(w,l.slice(t+1));}
const V="aɐeɛiɪoɔuʊøœyʏə";
const preVowel=(s:string)=>s.replace(new RegExp(`ˈ([^${V}ˈ]*)([${V}])`,"g"),"$1ˈ$2");
// fold referee conventions that aren't our errors: secondary stress, glottal stop, syllabic consonants,
// ə/ɐ-r spelling, tie-bar on affricates, eu/äu ɔʏ̯~ɔɪ̯, loanword r~ʁ.
const fold=(s:string)=>preVowel(s.replace(/ˌ/g,"").replace(/ʔ/g,"").replace(/ər/g,"ɐ").replace(/n̩/g,"ən").replace(/l̩/g,"əl").replace(/m̩/g,"əm").replace(/t͡s/g,"ts").replace(/d͡ʒ/g,"dʒ").replace(/t͡ʃ/g,"tʃ").replace(/ɔʏ̯/g,"ɔɪ̯").replace(/ʁ/g,"r").replace(/ɐ̯/g,"r"));
const keys=[...ref.keys()]; const stride=Math.max(1,Math.floor(keys.length/4000)); const sample=keys.filter((_,i)=>i%stride===0);
let m=0,t=0; const b=new Map<string,{n:number,ex:string[]}>();
for(const w of sample){const g=fold(ref.get(w)!); const o=fold(phonemizeWord(w)); t++; if(o===g){m++;continue;}
  let p=0;while(p<o.length&&p<g.length&&o[p]===g[p])p++; let s=0;while(s<o.length-p&&s<g.length-p&&o[o.length-1-s]===g[g.length-1-s])s++;
  const k=`«${o.slice(p,o.length-s)||"∅"}»≠«${g.slice(p,g.length-s)||"∅"}»`; const x=b.get(k)||{n:0,ex:[]}; x.n++; if(x.ex.length<3)x.ex.push(`${w}:${o}|${g}`); b.set(k,x);}
console.log(`kaikki referee, sample ${t}: match ${m}/${t} = ${(100*m/t).toFixed(1)}%\n`);
[...b.entries()].sort((a,b)=>b[1].n-a[1].n).slice(0,14).forEach(([k,v])=>console.log(`  ${String(v.n).padStart(3)} ${k}   ${v.ex[0]}`));
