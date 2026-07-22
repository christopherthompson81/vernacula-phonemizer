/**
 * End-to-end Urdu pipeline eval vs wikipron, short-vowel + majhūl quality UNFOLDED (only notation folded), to
 * measure the IPA coverage lexicon's real gain over the lexicon-free default-ə core. Reports overall, the
 * lexicon-covered subset, and the NON-CIRCULAR Hindi-only subset (skeletons the shipped lexicon lacked).
 *   npx tsx tools/arabic-restorer/ur_e2e_eval.ts
 */
import { readFileSync } from "node:fs";
import { phonemizeWord, phonemizeWordCore } from "../../src/languages/urdu/urdu.ts";

const HERE = import.meta.dirname;
const U = ["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i","b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"].sort((a, b) => b.length - a.length);
function toks(s: string): string[] {
    const o: string[] = [];
    let i = 0;
    outer: while (i < s.length) { for (const u of U) if (s.startsWith(u, i)) { o.push(u); i += u.length; continue outer; } o.push(s[i]!); i++; }
    return o;
}
function cfold(ipa: string): string {
    let s = ipa.replace(/[ˈˌ]/gu, "").normalize("NFD").replace(/̃ː/gu, "ː̃");
    s = s.replace(/n̪/gu, "n").replace(/ɳ/gu, "n").replace(/ɲ/gu, "n").replace(/ʋ/gu, "v").replace(/ɾ/gu, "r");
    const out: string[] = [];
    for (const t of toks(s)) { if (t === "ː") continue; if (out.at(-1) === t) continue; out.push(t); }
    return out.join("");
}

const wiki = new Map<string, Set<string>>();
for (const l of readFileSync(`${HERE}/../../tools/referee-eval/referees/ur.wikipron-urd-broad.tsv`, "utf8").split("\n")) {
    const p = l.split("\t");
    if (p.length < 2 || !p[0]) continue;
    (wiki.get(p[0]) ?? wiki.set(p[0], new Set()).get(p[0])!).add(cfold(p[1].replace(/ /gu, "")));
}
// skeletons that were NOT in the OLD shipped harakat lexicon → the Hindi-sourced (non-circular) expansion
const shipped = new Set<string>();
for (const l of readFileSync(`${HERE}/../../src/languages/urdu/lexicon.tsv`, "utf8").split("\n")) {
    if (!l.startsWith("#") && l.includes("\t")) shipped.add(l.split("\t")[0]!.normalize("NFC"));
}

let N = 0, newOk = 0, baseOk = 0, covered = 0, covOk = 0, nc = 0, ncOk = 0;
for (const [skel, prons] of wiki) {
    if ([...skel].length < 2) continue;
    N++;
    const np = cfold(phonemizeWord(skel));
    const bp = cfold(phonemizeWordCore(skel));
    if (prons.has(np)) newOk++;
    if (prons.has(bp)) baseOk++;
    if (np !== bp) { covered++; if (prons.has(np)) covOk++; }        // lexicon changed the output
    if (np !== bp && !shipped.has(skel.normalize("NFC"))) { nc++; if (prons.has(np)) ncOk++; } // non-circular expansion
}
const pct = (a: number, b: number) => `${a}/${b} (${((100 * a) / Math.max(b, 1)).toFixed(1)}%)`;
console.log(`wikipron types scored: ${N}`);
console.log(`  NEW pipeline (IPA lexicon)   : ${pct(newOk, N)}`);
console.log(`  OLD baseline (default-ə core): ${pct(baseOk, N)}`);
console.log(`  on lexicon-COVERED words (${covered}): ${pct(covOk, covered)}  [default gets these ~wrong]`);
console.log(`  NON-CIRCULAR subset (Hindi-sourced, not in old shipped lexicon): ${pct(ncOk, nc)}`);
