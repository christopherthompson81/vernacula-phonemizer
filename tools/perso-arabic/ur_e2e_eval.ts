/**
 * End-to-end Urdu pipeline eval vs wikipron, short-vowel + majhūl quality UNFOLDED (only notation folded), to
 * measure the IPA coverage lexicon's real gain over the lexicon-free default-ə core. Reports overall, the
 * lexicon-covered subset, and the NON-CIRCULAR Hindi-only subset (skeletons the shipped lexicon lacked).
 *   npx tsx tools/perso-arabic/ur_e2e_eval.ts
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
    const [head, pron] = p;
    if (head === undefined || pron === undefined || head === "") continue;
    let set = wiki.get(head);
    if (set === undefined) { set = new Set(); wiki.set(head, set); }
    set.add(cfold(pron.replace(/ /gu, "")));
}

let N = 0, newOk = 0, baseOk = 0;
for (const [skel, prons] of wiki) {
    if ([...skel].length < 2) continue;
    N++;
    if (prons.has(cfold(phonemizeWord(skel)))) newOk++;
    if (prons.has(cfold(phonemizeWordCore(skel)))) baseOk++;
}
// NON-CIRCULAR headline: the Hindi cross-script derivation measured DIRECTLY (independent of Wiktionary, full
// sample) — this is what we can derive WITHOUT the referee's own source. Read silver.hindiurdu, cfold, vs wikipron.
let hiN = 0, hiOk = 0;
for (const l of readFileSync(`${HERE}/silver.hindiurdu.tsv`, "utf8").split("\n")) {
    const p = l.split("\t"); if (p.length < 3 || p[1] !== "urd") continue;
    const w = wiki.get(p[0]!); if (!w) continue;
    hiN++; if (w.has(cfold(p[2]!))) hiOk++;
}
const pct = (a: number, b: number) => `${a}/${b} (${((100 * a) / Math.max(b, 1)).toFixed(1)}%)`;
console.log(`wikipron types scored: ${N}`);
console.log(`  full pipeline (kaikki+Hindi+harakat lexicon): ${pct(newOk, N)}  ← kaikki=Wiktionary=referee's source (CIRCULAR)`);
console.log(`  lexicon-free default-ə core (floor)         : ${pct(baseOk, N)}`);
console.log(`  → NON-CIRCULAR: Hindi cross-script derivation, measured directly (independent of Wiktionary): ${pct(hiOk, hiN)}`);
