/**
 * Cross-check the Khmer engine against a SECOND independent human source — the aakanee.com Khmer-English
 * dictionary, as distributed by open-dict-data/ipa-dict (data/km.txt).
 *
 * Run: npx tsx tools/khmer/aakanee-crosscheck.ts <path to ipa-dict km.txt>
 *
 * ⚠ THE DATA IS CC BY-NC-SA 4.0 AND MUST NEVER BE COMMITTED OR SHIPPED. NonCommercial is stricter than
 * anything this repo distributes (see LICENSES/PROVENANCE.md), so the file lives outside the tree and only
 * MEASUREMENTS derived from it are recorded — the same arrangement as Urdu's NC silver dictionary. This tool
 * and the numbers it prints are committed; the TSV it reads is not, and `.gitignore` guards the filename.
 *
 * ## Why this source, and what it is independent OF
 *
 * km's 🔷 caveat has always been "no second large independent referee": wikipron and kaikki are the same
 * Wiktionary lineage, and the google/language-resources dictionary is consumed as a LEXICON TIER, so scoring
 * the shipped path against it would be circular. The aakanee dictionary is a third lineage — a human-authored
 * learner's dictionary, independent of Wiktionary AND of Google — which makes it the first source that can
 * corroborate all three at once:
 *
 *   · aakanee vs wikipron on their overlap        → referee health (are the two human sources consistent?)
 *   · rules vs aakanee                            → an INDEPENDENT second engine corroboration
 *   · shipped vs aakanee, split by answering tier → the dictionary-tier rows are a Google-vs-aakanee
 *     cross-validation, two independent sources checking each other with our conversion in the middle
 *
 * ## The notation mapping
 *
 * aakanee writes a romanization-flavoured IPA: length by doubling (aa), the implosives as plain d/b, onset
 * /ʋ/ as v, ⟨ៅ⟩ as av, ⟨ែ⟩ as ae. The mapping below was derived by ITERATION AGAINST WIKIPRON AGREEMENT on
 * the ~1,700-word overlap (the method the dict tier's mapping was derived with): first pass 68.6%, closing
 * the systematic classes (d→ɗ, b→ɓ, positional v, ʊə→uə, ee→ei) reached 93.1%, and the residual reads as
 * genuine source variance (wikipron's own e~ei inconsistency, loanword vowels), not as unclosed notation.
 * ⚠ ee→ei FOLLOWS WIKIPRON'S BROAD CONVENTION, not phonetic reality — the point of the mapping is
 * comparability with the referee, so where wikipron is convention-bound the mapping follows it.
 */
import { readFileSync } from "node:fs";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";
import { phonemizeWordRules, phonemizeWord } from "../../src/languages/khmer/khmer.ts";

const src = process.argv[2];
if (src === undefined) {
    console.error("usage: aakanee-crosscheck.ts <ipa-dict data/km.txt — CC BY-NC-SA, keep OUTSIDE the repo>");
    process.exit(2);
}

/** aakanee notation → this project's IPA. Order is load-bearing: diphthongs before doubling, digraph
 *  aspiration before single letters, the vowel-context ʋ before the coda w fallback. */
const PAIRS: [RegExp, string][] = [
    [/ie/gu, "iə"], [/ue/gu, "uə"], [/oa/gu, "oə"], [/ea/gu, "eə"], [/ʊə/gu, "uə"],
    [/aa/gu, "aː"], [/ɑɑ/gu, "ɑː"], [/ee/gu, "ei"], [/əə/gu, "əː"], [/ii/gu, "iː"],
    [/oo/gu, "oː"], [/uu/gu, "uː"], [/ɛɛ/gu, "ɛː"], [/ɔɔ/gu, "ɔː"], [/ɨɨ/gu, "ɨː"],
    [/av/gu, "aw"], [/əv/gu, "əw"],
    [/ch/gu, "cʰ"], [/th/gu, "tʰ"], [/ph/gu, "pʰ"], [/kh/gu, "kʰ"],
    [/y/gu, "j"], [/g(?!h)/gu, "k"],
    [/d/gu, "ɗ"], [/b/gu, "ɓ"],
    [/v(?=[aeiouəɑɨɔɛ])/gu, "ʋ"], [/v/gu, "w"],
];
const convertOne = (s: string): string => {
    let x = s.replace(/\s+/gu, "");
    for (const [re, rep] of PAIRS) x = x.replace(re, rep);
    return x;
};
/** A row may carry several readings (`/kam.../, /kamma.../`); score a match against any, as eval.ts does. */
const convert = (i: string): string[] =>
    i.split(/\/\s*,\s*\//u).map((p) => p.replace(/^\/|\/$/gu, "")).map(convertOne);

const aak: [string, string][] = readFileSync(src, "utf8").split("\n")
    .filter((l) => l.includes("\t"))
    .map((l) => { const [w, i] = l.split("\t"); return [w!, i!.trim()] as [string, string]; })
    .filter(([w]) => /^[ក-៓ៜ-៝]+$/u.test(w));

const wik = new Map<string, string[]>();
for (const l of readFileSync("tools/referee-eval/referees/km.wikipron-khm-broad.tsv", "utf8").split("\n")) {
    if (!l.trim() || l.startsWith("#")) continue;
    const [w, i] = l.split("\t");
    wik.set(w!, [...(wik.get(w!) ?? []), i!]);
}
const exceptions = new Set(readFileSync("data/languages/khmer/km-lexicon.tsv", "utf8").split("\n")
    .filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0]!));
const dict = new Set(readFileSync("data/languages/khmer/km-lexicon-dict.tsv", "utf8").split("\n")
    .filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0]!));
const kaikki = new Set(readFileSync("data/languages/khmer/km-lexicon-kaikki.tsv", "utf8").split("\n")
    .filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0]!));

const fold = makeFold(CONFIG.km!);
const hit = (outs: string[], golds: string[]): boolean => {
    const gf = golds.map((g) => fold(g.replace(/\s+/gu, "")));
    return outs.map(fold).some((f) => gf.includes(f));
};

// 1 — source health: aakanee vs wikipron on the overlap (two humans, no engine involved).
let hN = 0, hOk = 0;
for (const [w, i] of aak) {
    const g = wik.get(w);
    if (!g) continue;
    hN++;
    if (hit(convert(i), g)) hOk++;
}

// 2 — the rules against aakanee, all words (fully independent of every tier).
// 3 — the shipped path against aakanee, split by which tier answered. The dictionary-tier rows are the
//     Google-vs-aakanee cross-validation; the exceptions- and kaikki-tier rows are Wiktionary-vs-aakanee via our lexicons (aakanee is independent of Wiktionary, so those are real checks, not echoes).
let rN = 0, rOk = 0;
const tiers = { exceptions: [0, 0], kaikki: [0, 0], dict: [0, 0], rules: [0, 0] } as Record<string, [number, number]>;
for (const [w, i] of aak) {
    const gold = convert(i);
    rN++;
    if (hit([phonemizeWordRules(w)], gold)) rOk++;
    const tier = exceptions.has(w) ? "exceptions" : kaikki.has(w) ? "kaikki" : dict.has(w) ? "dict" : "rules";
    tiers[tier]![0]++;
    if (hit([phonemizeWord(w)], gold)) tiers[tier]![1]++;
}
const sN = Object.values(tiers).reduce((a, [n]) => a + n, 0);
const sOk = Object.values(tiers).reduce((a, [, k]) => a + k, 0);

const pc = (x: number, n: number): string => n ? `${((100 * x) / n).toFixed(1)}%` : "—";
console.log(`aakanee single-word Khmer entries: ${aak.length}`);
console.log(`\n1. SOURCE HEALTH — aakanee vs wikipron, ${hN} overlapping words: ${hOk} (${pc(hOk, hN)}) folded agreement`);
console.log(`\n2. RULES vs aakanee (independent, all ${rN} words): ${rOk} (${pc(rOk, rN)})`);
console.log(`\n3. SHIPPED vs aakanee (${sN} words): ${sOk} (${pc(sOk, sN)})`);
for (const [t, [n, k]] of Object.entries(tiers))
    console.log(`     answered by ${t.padEnd(10)} n=${String(n).padStart(4)}  ${pc(k, n)}`);
