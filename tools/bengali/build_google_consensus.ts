/**
 * Expand the Bengali ɔ/o + medial-deletion lexicon (bengali-lexicon.tsv) using a THIRD independent source:
 * Google `language-resources/bn` (CC-BY-4.0, ~65k words, non-Wiktionary, retroflex-correct). Run 12 established
 * that Bengali's ɔ→o raising + medial-vowel deletion is NOT cleanly rule-derivable (two rule re-derivations crashed
 * the gold), so Google's reliability is applied PER-WORD via cross-source consensus: pin a word ONLY where Google
 * AND wikipron ben AGREE on the reading, it differs from our rule engine, only the vowels differ (consonant
 * skeleton exact-match), and it is not a hand-adjudicated gold word. Two independent sources agreeing filters
 * both wikipron noise and Google's own dialect/FST quirks.
 *
 *   curl -sL https://raw.githubusercontent.com/google/language-resources/master/bn/data/lexicon.tsv -o /tmp/google_bn_lexicon.tsv
 *   npx tsx tools/bengali/build_google_consensus.ts   # prints new entries (merge into bengali-lexicon.tsv, re-sort)
 */
import { readFileSync, existsSync } from "node:fs";
import { phonemizeWordRules as R } from "../../src/languages/bengali/bengali.ts";

const DUMP = "/tmp/google_bn_lexicon.tsv";
const HERE = import.meta.dirname;
// Google phone-code → our canonical IPA (Bengali c/ɟ realized as affricates; offglides → plain vowels).
const MAP: Record<string, string> = {
    O: "ɔ", a: "a", i: "i", u: "u", e: "e", E: "æ", o: "o", "i^": "i", "u^": "u", "e^": "e", "o^": "o",
    k: "k", kh: "kʰ", g: "ɡ", gh: "ɡʰ", N: "ŋ", c: "t͡ʃ", ch: "t͡ʃʰ", j: "d͡ʒ", jh: "d͡ʒʰ",
    T: "ʈ", Th: "ʈʰ", D: "ɖ", Dh: "ɖʰ", t: "t̪", th: "t̪ʰ", d: "d̪", dh: "d̪ʰ", n: "n", p: "p",
    f: "f", b: "b", bh: "bʰ", m: "m", r: "ɾ", l: "l", sh: "ʃ", s: "s", h: "h",
};
const g2ipa = (t: string): string => t.split(/\s+/).filter((x) => x !== ".").map((x) => MAP[x] ?? "").join("");
// COMMON comparison fold — neutralise convention (retroflex↔dental, ɾ/r, ties, æ/e, ɕ/ʃ, pʰ/f, geminate) so two
// independent sources can "agree" on the substance (vowels incl. ɔ/o + rough consonants).
const cf = (s: string): string =>
    s.normalize("NFD").replace(/[ˈˌ]/gu, "").replace(/[ʈɖ]/gu, (m) => (m === "ʈ" ? "t" : "d")).replace(/̪/gu, "")
        .replace(/[ɾɹr]/gu, "r").replace(/d͡?[ʒʑ]/gu, "j").replace(/t͡?[ʃɕ]/gu, "c").replace(/[ɕʃ]/gu, "s")
        .replace(/[æɛe]/gu, "e").replace(/pʰ/gu, "f").replace(/(.)\1/gu, "$1");
// STRICT consonant skeleton — drop only vowels + offglide mark; everything else must match EXACTLY (vowel-only diff).
const CS = (s: string): string => s.normalize("NFD").replace(/[ˈˌ]/gu, "").replace(/[aiueoɔæɛ̯]/gu, "");

function load(file: string, ipaCol: number): Map<string, string> {
    const m = new Map<string, string>();
    for (const l of readFileSync(file, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const p = l.split("\t");
        if (!m.has(p[0]!)) m.set(p[0]!, p[ipaCol]!.replace(/ /gu, ""));
    }
    return m;
}

if (!existsSync(DUMP)) { console.error(`missing ${DUMP} — download the Google bn lexicon first (see header)`); process.exit(1); }
const G = new Map<string, string>();
for (const l of readFileSync(DUMP, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const p = l.split("\t"); if (!G.has(p[0]!)) G.set(p[0]!, g2ipa(p[1]!));
}
const W = load(`${HERE}/../referee-eval/referees/bn.wikipron-ben-broad.tsv`, 1);
const existing = new Set([...load(`${HERE}/../../src/languages/bengali/bengali-lexicon.tsv`, 1).keys()]);
const gold = new Set([...load(`${HERE}/../referee-eval/referees/bn.gold-adjudicated.tsv`, 1).keys()]);

const out: [string, string][] = [];
for (const [w, gi] of G) {
    const wi = W.get(w); if (!wi) continue;
    if ([...w].length < 2 || !/^[ঀ-৿]+$/u.test(w) || existing.has(w) || gold.has(w)) continue;
    const e = R(w); if (!e) continue;
    const ec = e.replace(/[ˈˌ]/gu, "");
    if (cf(gi) === cf(wi) && cf(gi) !== cf(e) && CS(gi) === CS(ec)) out.push([w, gi.replace(/[ˈˌ]/gu, "")]);
}
out.sort(([a], [b]) => (a < b ? -1 : 1));
for (const [w, ip] of out) process.stdout.write(`${w}\t${ip}\n`);
process.stderr.write(`${out.length} Google∩wikipron consensus entries (vowel-only, non-gold, new)\n`);
