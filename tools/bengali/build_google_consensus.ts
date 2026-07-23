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
import { googleToIpa as g2ipa, isBengaliWord } from "./googlePhoneMap.ts";

const DUMP = "/tmp/google_bn_lexicon.tsv";
const HERE = import.meta.dirname;
// COMMON comparison fold — neutralise convention (retroflex↔dental, ɾ/r, ties, æ/e, ɕ/ʃ, pʰ/f, geminate) so two
// independent sources can "agree" on the substance (vowels incl. ɔ/o + rough consonants).
const cf = (s: string): string =>
    s.normalize("NFD").replace(/[ˈˌ]/gu, "").replace(/[ʈɖ]/gu, (m) => (m === "ʈ" ? "t" : "d")).replace(/̪/gu, "")
        .replace(/[ɾɹr]/gu, "r").replace(/d͡?[ʒʑ]/gu, "j").replace(/t͡?[ʃɕ]/gu, "c").replace(/[ɕʃ]/gu, "s")
        .replace(/[æɛe]/gu, "e").replace(/pʰ/gu, "f").replace(/ː/gu, "").replace(/(.)\1/gu, "$1");
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
// Collect ALL of Google's pronunciations per word: it lists POS-tagged heteronyms as separate rows (উত্তর noun
// utːɔr vs verb utːor). A word with >1 distinct reading is a genuine ɔ/o heteronym — ABSTAIN (a context-free
// whole-word override can only pin one sense and would suppress the other), mirroring the lexicon's abstention.
const gAll = new Map<string, Set<string>>();
for (const l of readFileSync(DUMP, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const p = l.split("\t"); const ipa = g2ipa(p[1]!);
    if (ipa === null) continue;
    (gAll.get(p[0]!) ?? gAll.set(p[0]!, new Set()).get(p[0]!)!).add(ipa);
}
const G = new Map<string, string>();
for (const [w, prons] of gAll) if (prons.size === 1) G.set(w, [...prons][0]!);
const W = load(`${HERE}/../referee-eval/referees/bn.wikipron-ben-broad.tsv`, 1);
const existing = new Set([...load(`${HERE}/../../src/languages/bengali/bengali-lexicon.tsv`, 1).keys()]);
const gold = new Set([...load(`${HERE}/../referee-eval/referees/bn.gold-adjudicated.tsv`, 1).keys()]);

const out: [string, string][] = [];
for (const [w, gi] of G) {
    const wi = W.get(w); if (!wi) continue;
    if (!isBengaliWord(w) || existing.has(w) || gold.has(w)) continue;
    const e = R(w); if (!e) continue;
    const ec = e.replace(/[ˈˌ]/gu, "");
    if (cf(gi) === cf(wi) && cf(gi) !== cf(e) && CS(gi) === CS(ec)) out.push([w, gi.replace(/[ˈˌ]/gu, "")]);
}
out.sort(([a], [b]) => (a < b ? -1 : 1));
for (const [w, ip] of out) process.stdout.write(`${w}\t${ip}\n`);
process.stderr.write(`${out.length} Google∩wikipron consensus entries (vowel-only, non-gold, new)\n`);
