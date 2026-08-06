/**
 * Persian NEURAL restorer — UNFOLDED IRANIAN production eval. Puts a real number on the shipped seq2seq path:
 * how often does phonemizeFaNeural (lexicon → neural → default) produce the correct IRANIAN pronunciation on
 * UNSEEN words, with the SHORT VOWELS COUNTED (unfolded — not the current referee's skeleton fold)?
 *
 * Reference: the classical wikipron gold, mapped to Iranian (short i→e, u→o, final ه→e) — Iranian Persian genuinely
 * merges classical i/u→e/o, so this is the Iranian form, not a fold that hides errors. Comparison is unfolded
 * (a/e/o counted); only notation is unified (χ~x, ɾ~r, ɒ~aː, stress/tie). The neural (restore) is already Iranian.
 *
 * The held-out split must be the NEURAL's test set (else words leak from training). Regenerate fa_test.tsv with the
 * training seed:  python3 -c "import random;random.seed(1234);
 *   R=[l.split(chr(9)) for l in open('fa_gold_aligned.tsv') if l.strip() and not l.startswith('#') and len(l.split(chr(9)))>=3];
 *   random.shuffle(R); [print(r[0]+chr(9)+r[2].split('|')[0]) for r in R[int(len(R)*.9):]]" > fa_test.tsv
 * (fa_gold_aligned.tsv = word⇥fa-engine-ipa⇥gold, from tools/persian/fa-abjad-ipa-gold.tsv via the fa engine.)
 *   npx tsx tools/persian/eval_iranian.ts <dir-with-fa_test.tsv>
 *
 * RESULT (2026-07-20, 926 unseen words): fa current 45.6% → SHIPPED 49.0% (+3.5pp); on the 559 OOV words the
 * neural serves, 43.8% → 49.6% (+5.7pp). Real, positive, modest — the homograph/ezafe ceiling (the context model /
 * parallel corpus) is the next lever.
 */
import { readFileSync } from "fs";
import { createFaVowelRestorer } from "../../src/languages/persian/vowelRestorer.ts";
import { phonemizeWord as faSync, harakatLexicon } from "../../src/languages/persian/persian.ts";
import { stripHarakat } from "../../src/core/harakatLexicon.ts";
const SP=process.argv[2];
const iranianize=(ipa:string,w:string)=>{let s=ipa.replace(/i(?!ː)/gu,"e").replace(/u(?!ː)/gu,"o"); if(/ه$/u.test(w))s=s.replace(/a$/u,"e"); return s;};
const cmp=(s:string)=>s.replace(/[ˈˌ͡]/gu,"").replace(/χ/gu,"x").replace(/ɾ/gu,"r").replace(/ɒ/gu,"aː").replace(/ʔ/gu,"");
const rows=readFileSync(`${SP}/fa_test.tsv`,"utf8").split("\n").filter(Boolean).map(l=>l.split("\t"));
async function main(){
  const r=await createFaVowelRestorer(); if(!r){console.log("no restorer");return;}
  const lex=harakatLexicon();
  let allBase=0,allShip=0,tot=0, oov=0,oovBase=0,oovNeural=0;
  for(const [w,gold] of rows){
    const g=cmp(iranianize(gold!,w!)); const covered=lex.has(stripHarakat(w!)); tot++;
    const base=cmp(faSync(w!)); if(base===g)allBase++;
    // shipped: covered→sync ; OOV≥3→neural ; else sync
    const ship = covered ? base : ([...w!].length>=3 ? cmp(await r.restore(w!)) : base);
    if(ship===g)allShip++;
    if(!covered && [...w!].length>=3){ oov++; if(base===g)oovBase++; const nu=cmp(await r.restore(w!)); if(nu===g)oovNeural++; }
  }
  console.log(`UNFOLDED IRANIAN eval — ${tot} unseen words (short vowels counted):`);
  console.log(`  fa CURRENT sync (lexicon+default): ${allBase} (${(100*allBase/tot).toFixed(1)}%)`);
  console.log(`  SHIPPED (lexicon→neural→default):  ${allShip} (${(100*allShip/tot).toFixed(1)}%)  (+${(100*(allShip-allBase)/tot).toFixed(1)}pp)`);
  console.log(`  -- on the ${oov} OOV words the neural actually serves --`);
  console.log(`     fa default [a]: ${oovBase} (${(100*oovBase/oov).toFixed(1)}%)   NEURAL: ${oovNeural} (${(100*oovNeural/oov).toFixed(1)}%)  (+${(100*(oovNeural-oovBase)/oov).toFixed(1)}pp)`);
}
main();
