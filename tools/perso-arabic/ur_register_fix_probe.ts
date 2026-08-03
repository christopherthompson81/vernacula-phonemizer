/**
 * Run 6 fix-lever probe: for register-suspect covered-misses (Perso-Arabic words where our Hindi-sourced reading
 * misses wikipron), would preferring the OLD harakat lexicon's Urdu-native reading (g2p-converted) match wikipron?
 * Measures the headroom of a register-aware precedence flip (harakat wins over Hindi for Perso-Arabic skeletons).
 *   npx tsx tools/perso-arabic/ur_register_fix_probe.ts
 */
import { readFileSync } from "node:fs";
import { phonemizeWord as g2p } from "../../src/languages/urdu/g2p.ts";
import { finalizeUrduIpa } from "../../src/languages/urdu/urdu.ts";

const HERE = import.meta.dirname;
const PA = new Set("عحذضظطصثق");
const U = ["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i","b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"].sort((a, b) => b.length - a.length);
function toks(s: string): string[] { const o: string[] = []; let i = 0; outer: while (i < s.length) { for (const u of U) if (s.startsWith(u, i)) { o.push(u); i += u.length; continue outer; } o.push(s[i]!); i++; } return o; }
function cfold(ipa: string): string {
    let s = ipa.replace(/[ˈˌ]/gu, "").normalize("NFD").replace(/̃ː/gu, "ː̃").replace(/n̪/gu, "n").replace(/ɳ/gu, "n").replace(/ɲ/gu, "n").replace(/ʋ/gu, "v").replace(/ɾ/gu, "r");
    const out: string[] = []; for (const t of toks(s)) { if (t === "ː") continue; if (out.at(-1) === t) continue; out.push(t); } return out.join("");
}
const wiki = new Map<string, Set<string>>();
for (const l of readFileSync(`${HERE}/../../tools/referee-eval/referees/ur.wikipron-urd-broad.tsv`, "utf8").split("\n")) {
    const [head, pron] = l.split("\t");
    if (head === undefined || pron === undefined || head === "") continue;
    let set = wiki.get(head);
    if (set === undefined) { set = new Set(); wiki.set(head, set); }
    set.add(cfold(pron.replace(/ /gu, "")));
}
const lex = new Map<string, string>();
for (const l of readFileSync(`${HERE}/../../src/languages/urdu/lexicon-ipa.tsv`, "utf8").split("\n")) { if (l.startsWith("#") || !l.includes("\t")) continue; const [k, v] = l.split("\t"); lex.set(k!, v!); }
// old harakat lexicon: skeleton → vocalized (harakat)
const harakat = new Map<string, string>();
const HARAKAT_G = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
for (const l of readFileSync(`${HERE}/../../src/languages/urdu/lexicon.tsv`, "utf8").split("\n")) { if (l.startsWith("#") || !l.includes("\t")) continue; const [k, v] = l.split("\t"); harakat.set(k!.normalize("NFC"), v!.normalize("NFC")); }

let regMiss = 0, hasHarakat = 0, harakatFixes = 0, harakatAlsoMiss = 0;
const ex: string[] = [];
for (const [sk, ipa] of lex) {
    const w = wiki.get(sk); if (!w) continue;
    if (w.has(cfold(ipa))) continue;                       // already correct
    if (![...sk].some((c) => PA.has(c))) continue;          // register-suspect only
    regMiss++;
    const voc = harakat.get(sk.normalize("NFC")); if (!voc) continue;
    hasHarakat++;
    const hIpa = cfold(finalizeUrduIpa(g2p(voc)));
    if (w.has(hIpa)) { harakatFixes++; if (ex.length < 15) ex.push(`  ${sk}\tHindi=${cfold(ipa)} → harakat=${hIpa} ✓ (${[...w][0]})`); }
    else harakatAlsoMiss++;
}
console.log(`register-suspect covered-misses: ${regMiss}`);
console.log(`  have an old-harakat-lexicon entry: ${hasHarakat}`);
console.log(`  …whose harakat reading MATCHES wikipron (fixable by precedence flip): ${harakatFixes}`);
console.log(`  …harakat entry also misses (real noise / divergence): ${harakatAlsoMiss}`);
console.log(`\nfixable examples:\n${ex.join("\n")}`);
