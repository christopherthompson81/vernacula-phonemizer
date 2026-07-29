/**
 * Shahnameh parallel-corpus aligner — matches Ferdowsi's Persian (Ganjoor) to the Tajik Cyrillic edition
 * (HF TajikNLPWorld/shahnameh-tajik-corpus) by EXACT CONSONANT SKELETON, to build the fa↔tg↔IPA context corpus.
 *
 * Both are the same epic in reading order, but editions differ (variant lines/words) and the Tajik has section
 * headings — so a positional match fails. Instead: reduce each hemistich to its CONSONANT skeleton (drop the
 * matres ا و ی, which diverge because Tajik writes the short u→و and izofat -и→ی the Persian abjad omits) and
 * hash-match (position-agnostic). One variant word breaks a hemistich, so recall is ~6% but precision is high.
 * IPA = the Tajik pron via tajik-align + Iranian normalisation (short i→e, u→o, final ه→e).
 *
 * Inputs (regenerate): the Persian crawl (scratchpad crawl_shahnameh.py over Ganjoor cat 33 → fa_shahnameh.txt)
 * and the Tajik text (shahnameh-tajik-corpus parquet → tg_shahnameh.txt). See the fa restoration investigation doc.
 *   npx tsx tools/persian/align_shahnameh.ts <dir-with-fa_shahnameh.txt+tg_shahnameh.txt>
 */
import { translitToSkeleton, tajikIpaToPersian } from "../../persian/tajik-align.ts";
const SP=process.argv[2];
const NORM:Record<string,string>={"ص":"س","ث":"س","ذ":"ز","ض":"ز","ظ":"ز","ط":"ت","ح":"ه","آ":"ا","ي":"ی","ك":"ک","ٔ":"","ء":"ع","أ":"ا","إ":"ا","ؤ":"و"};
const HAR=/[ً-ْـ]/g; const CYR=/[Ѐ-ӿ]+/gu; const FAW=/[ء-ۿ]+/gu;
// fa hemistich → consonant skeleton (drop short-vowel matres kept: ا و ی stay; collapse Arabic classes; drop spaces)
const faSkel=(s:string)=>[...s.replace(HAR,"")].map(c=>NORM[c]??c).filter(c=>/[ء-ۿ]/u.test(c)).join("").replace(/[اويهءعآئؤ]/gu,"");
const tgSkel=(s:string)=>(s.match(CYR)||[]).map(w=>translitToSkeleton(w)).join("").replace(/[اويهءعآئؤ]/gu,"");
const iran=(ipa:string,w:string)=>{let x=ipa.replace(/i(?!ː)/g,"e").replace(/u(?!ː)/g,"o"); if(/ه$/.test(w))x=x.replace(/a$/,"e"); return x;};
const faLines=readFileSync(`${SP}/fa_shahnameh.txt`,"utf8").split("\n").map(s=>s.trim()).filter(Boolean);
const tgLines=readFileSync(`${SP}/tg_shahnameh.txt`,"utf8").split("\n").map(s=>s.trim()).filter(Boolean);
// index tg by skeleton (first occurrence)
const tgBySkel=new Map<string,string>();
for(const t of tgLines){const k=tgSkel(t); if(k.length>=6 && !tgBySkel.has(k)) tgBySkel.set(k,t);}
let matched=0; const out:string[]=[];
for(const fa of faLines){
  const k=faSkel(fa); if(k.length<6) continue;
  const tg=tgBySkel.get(k); if(!tg) continue;
  matched++;
  const ipa=(tg.match(CYR)||[]).map(w=>iran(tajikIpaToPersian(w),w).replace(/[ˈˌ]/g,"")).join(" ");
  out.push(`${fa}\t${tg}\t${ipa}`);
}
writeFileSync(`${SP}/shah_aligned.tsv`, out.join("\n")+"\n");
console.log(`fa lines: ${faLines.length} | tg lines: ${tgLines.length} | EXACT-skeleton aligned: ${matched} (${(100*matched/faLines.length).toFixed(1)}%)`);
console.log("sample:"); out.slice(0,4).forEach(l=>console.log("  "+l));
