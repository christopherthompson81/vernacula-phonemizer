/**
 * Cross-script GOLD harakat generator for Punjabi Shahmukhi, from the Gurmukhi sister-script.
 *
 * Punjabi is written in both Gurmukhi (a fully-voweled abugida) and Shahmukhi (a vowel-dropping abjad). Gurmukhi
 * writes the very vowels Shahmukhi omits — including the ੁ/ʊ vs ੂ/uː and ੇ/eː vs ੋ/oː distinctions that cap the
 * abjad. So: transliterate each Gurmukhi word to a fully-vocalized Shahmukhi form (short vowels → harakat, ੂ →
 * damma+waw = uː), then KEEP ONLY pairs whose Shahmukhi form phonemizes to the SAME IPA as the Gurmukhi original
 * (a hard correctness gate). The kept vocalizations are GOLD — the vowels come from Gurmukhi, not a guess. skeleton
 * = the harakat stripped off. This is the sister-script mechanism (generalizes to ur↔Hindi, sd↔Devanagari, …).
 *
 *   npx tsx crossscript_pa.ts            # over the pan_guru Gurmukhi wordlist
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// ⚠ phonemizeWordEval, NOT the shipped phonemizeWord: the shipped path is now gurmukhi-lexicon-first
// (wikipron-mined), and this tool feeds/derives eval-side data — through the shipped function a REGENERATION
// would launder wikipron readings into files the eval consumes against a same-tradition referee.
import { phonemizeWordEval as pa } from "../../src/languages/punjabi/punjabi.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Gurmukhi consonant → Shahmukhi letter(s) (by shared sound; aspirates are 2 letters). Voiced-aspirate tone
// letters (ਘਝਢਧਭ) map to their C+ھ digraph so tonogenesis fires identically on both sides.
const CONS: Record<string, string> = {
    "ਕ": "ک", "ਖ": "کھ", "ਗ": "گ", "ਘ": "گھ", "ਙ": "ن", "ਚ": "چ", "ਛ": "چھ", "ਜ": "ج", "ਝ": "جھ", "ਞ": "ن",
    "ਟ": "ٹ", "ਠ": "ٹھ", "ਡ": "ڈ", "ਢ": "ڈھ", "ਣ": "ݨ", "ਤ": "ت", "ਥ": "تھ", "ਦ": "د", "ਧ": "دھ", "ਨ": "ن",
    "ਪ": "پ", "ਫ": "پھ", "ਬ": "ب", "ਭ": "بھ", "ਮ": "م", "ਯ": "ی", "ਰ": "ر", "ਲ": "ل", "ਵ": "و", "ੜ": "ڑ",
    "ਸ": "س", "ਹ": "ہ", "ਸ਼": "ش", "ਖ਼": "خ", "ਗ਼": "غ", "ਜ਼": "ز", "ਫ਼": "ف", "ਲ਼": "ࣇ",
};
// Independent (word-initial) vowels → Shahmukhi.
const IVOWEL: Record<string, string> = {
    "ਅ": "ا", "ਆ": "آ", "ਇ": "ا", "ਈ": "ای", "ਉ": "ا", "ਊ": "او", "ਏ": "اے", "ਐ": "اے", "ਓ": "او", "ਔ": "او",
};
// Dependent vowel signs (matras) → Shahmukhi harakat / long-vowel letters. ੂ = damma+waw (uː), ੁ = damma (ʊ).
const MATRA: Record<string, string> = {
    "ਾ": "ا", "ਿ": "ِ", "ੀ": "ی", "ੁ": "ُ", "ੂ": "ُو", "ੇ": "ے", "ੈ": "ے", "ੋ": "و", "ੌ": "و",
};
const NUKTA = "਼", ADDAK = "ੱ", VIRAMA = "੍", TIPPI = "ੰ", BINDI = "ਂ";
const SHADDA = "ّ", NASAL = "ں";
const HARAKAT_STRIP = /[ً-ْ]/gu; // skeleton = vocalized minus the harakat diacritics

/** Transliterate one Gurmukhi word to a fully-vocalized Shahmukhi form. null if it hits an unmapped letter. */
function translit(word: string): string | null {
    const s = [...word.normalize("NFC")];
    let out = "";
    let pendingShadda = false;
    for (let i = 0; i < s.length; i++) {
        let c = s[i]!;
        if (s[i + 1] === NUKTA && CONS[c + NUKTA]) { c = c + NUKTA; i++; } // compose nukta consonant
        if (CONS[c]) {
            out += CONS[c];
            if (pendingShadda) { out += SHADDA; pendingShadda = false; }
        } else if (IVOWEL[c]) {
            out += IVOWEL[c];
        } else if (MATRA[c]) {
            out += MATRA[c];
        } else if (c === ADDAK) {
            pendingShadda = true; // geminates the FOLLOWING consonant
        } else if (c === VIRAMA) {
            out += "ْ"; // sukun — suppress the inherent vowel (cluster)
        } else if (c === TIPPI || c === BINDI) {
            out += NASAL;
        } else {
            return null; // unmapped (e.g. ੈ/ੌ edge, stray sign) → let the verify gate skip it anyway
        }
    }
    return out;
}

function main(): void {
    const fold = makeFold(CONFIG["pa"]!);
    const words = readFileSync(join(HERE, "..", "referee-eval", "referees", "pa.wikipron-pan-broad.tsv"), "utf8")
        .split("\n").map((l) => l.split("\t")[0]).filter((w): w is string => !!w && [...w].length >= 2);
    const seen = new Set<string>();

    const pairs: string[] = [];
    let ok = 0, mismatch = 0, unmapped = 0;
    for (const g of words) {
        if (seen.has(g)) continue;
        seen.add(g);
        const voc = translit(g);
        if (voc === null) { unmapped++; continue; }
        const gIpa = fold(pa(g));
        if (fold(pa(voc)) === gIpa) {
            const skel = voc.replace(HARAKAT_STRIP, "");
            pairs.push(`${skel}\tpa\t${voc}`);
            ok++;
        } else mismatch++;
    }

    const out = join(HERE, "harakat.pa.crossscript.tsv");
    writeFileSync(out, pairs.join("\n") + (pairs.length ? "\n" : ""));
    const tot = ok + mismatch + unmapped;
    console.log(`Gurmukhi source words: ${tot}`);
    console.log(`  GOLD pairs (Shahmukhi ⇒ same IPA as Gurmukhi): ${ok}  (${(100 * ok / tot).toFixed(1)}%)`);
    console.log(`  transliteration mismatch (rejected by gate):   ${mismatch}`);
    console.log(`  unmapped letter:                               ${unmapped}`);
    console.log(`  wrote ${pairs.length} → harakat.pa.crossscript.tsv`);
}

main();
