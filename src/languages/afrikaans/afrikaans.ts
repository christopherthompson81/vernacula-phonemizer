/**
 * Afrikaans (af) phonemizer — Indo-European (West Germanic), Latin script, Standard Afrikaans, espeak-independent
 * canonical IPA. A greedy longest-match scan over the fixed graphemes (digraphs/consonants, length-desc) PLUS two
 * code rules the table can't express: the Germanic OPEN/CLOSED-SYLLABLE vowel-length rule (a bare vowel is long/tense
 * in an open syllable V.CV, short/lax in a closed one VC#/VCC — via lookahead) and word-final obstruent DEVOICING
 * (b→p, d→t; g→χ and v→f are unconditional). The long mid vowels are centering diphthongs (ee/open-e = iə, oo/open-o
 * = uə). Stress + schwa-reduction of unstressed vowels are not modelled (folded). See
 * docs/investigations/af_afrikaans_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, FIXED_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { decompose } from "./morphology.ts";

const FIXED = MANIFEST.fixed;
const LONG = MANIFEST.vowelsLong;
const SHORT = MANIFEST.vowelsShort;
const DIA = MANIFEST.diacriticVowels;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const BARE_VOWELS = new Set(["a", "e", "i", "o", "u"]); // vowels routed through the length rule
const DEVOICE: Record<string, string> = { b: "p", d: "t", z: "s" }; // word-final devoicing (g→χ, v→f already fixed)
// every letter that heads a vowel/nucleus — bounds the consonant run in the open/closed lookahead
const VOWEL_LETTER = new Set(["a", "e", "i", "o", "u", "y", "ê", "ô", "û", "î", "ë", "ï", "é", "è", "á", "à", "ó", "ú", "ü", "ö"]);

/** Is the bare vowel at index `i` in an OPEN syllable (→ long/tense)? V ends a syllable when ≤1 consonant separates
 *  it from the next vowel: V# / V.V / V.CV are open; VC# and VCC are closed. */
function isOpen(w: string, i: number): boolean {
    let j = i + 1;
    while (j < w.length && !VOWEL_LETTER.has(w[j]!)) j++;
    const cons = j - (i + 1);
    if (cons === 0) return true; // vowel at word end, or a following vowel (hiatus)
    return cons === 1 && j < w.length; // exactly one consonant before another vowel → open
}

// UNSTRESSED bare vowels reduce: the open/closed length rule only lengthens in a STRESSED syllable; elsewhere a
// vowel stays short and ⟨e⟩/⟨i⟩ centralise to schwa. (Stress ≈ first syllable — the Germanic default; not yet
// prefix-aware.) Digraph vowels (aa, ee=iə …) are inherently long and unaffected.
const REDUCE: Record<string, string> = { a: "a", e: "ə", i: "ə", o: "ɔ", u: "œ" };

// Unstressed one-syllable prefixes: stress falls on the following syllable (begín, gemáák, verstáán, ontdék, herháál).
const UNSTRESSED_PREFIX = /^(be|ge|ver|ont|her|er)[^aeiouyêôûîëïéèáàóúü]*[aeiouyêôûîëïéèáàóúü]/u;
const VOWEL_GROUP = /[aeiouyêôûîëïéèáàóúü]+/gu;

/** The (0-based) nucleus that carries primary stress. Native default = the first syllable (past an unstressed
 *  prefix); loan suffixes shift it: -ie/-sie/-asie → penultimate (aborsie→a·BOR·sie), -eer/-eur/-teit → final. */
function stressedNucleus(w: string): number {
    const n = (w.match(VOWEL_GROUP) ?? []).length;
    if (n <= 1) return 0;
    if (/(eer|eur|oor|oon|yn|ees|teit|siteit|isme)$/u.test(w)) return n - 1; // stress-final loan suffixes
    if (/ie$/u.test(w)) return n - 2; // -ie / -sie / -asie / -osie → penultimate
    return UNSTRESSED_PREFIX.test(w) ? 1 : 0;
}

/** Phonemize a single MORPHEME (a whole non-compound word, or one element of a compound) — its own first-syllable
 *  stress, open/closed length, and word-/morpheme-final devoicing. */
function phonemizeMorpheme(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const stressNucleus = stressedNucleus(w); // primary-stress nucleus (native first-syllable + loan-suffix overrides)
    let out = "";
    let i = 0;
    let nucleus = 0; // count of vowel nuclei emitted so far
    while (i < w.length) {
        const c = w[i]!;
        if (DIA[c]) { out += DIA[c]; i += 1; nucleus += 1; continue; } // diacritic vowel (single char)
        // Code rules that must beat the fixed table:
        if (!VOWEL_LETTER.has(c) && w[i + 1] === c && c !== "'") { i += 1; continue; } // doubled consonant = single phoneme (appel→ˈapəl)
        if (c === "c") { out += "eiyêéè".includes(w[i + 1] ?? "") ? "s" : "k"; i += 1; continue; } // ⟨c⟩ soft [s] before front vowel, else [k]
        let matched = false;
        for (const key of FIXED_KEYS) {
            if (w.startsWith(key, i)) {
                const next = w[i + key.length];
                // devoicing: a voiced obstruent devoices word-finally OR before a VOICELESS consonant (aandklok→ɑnt);
                // it stays voiced before a vowel or a voiced consonant.
                const devoiceHere = next === undefined || "ptksfcgx".includes(next);
                out += (devoiceHere && DEVOICE[key]) ? DEVOICE[key]! : FIXED[key]!;
                if (VOWEL_LETTER.has(key[0]!)) nucleus += 1; // a vowel digraph is a nucleus
                i += key.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        if (BARE_VOWELS.has(c)) {
            const stressed = nucleus === stressNucleus;
            if (c === "e" && i === w.length - 1) out += "ə"; // final unstressed ⟨e⟩ → schwa
            else if (c === "i") out += isOpen(w, i) ? "i" : "ə"; // ⟨i⟩ is tense [i]/lax [ə] by syllable, not by stress
            else if (stressed) out += isOpen(w, i) ? LONG[c]! : SHORT[c]!; // length rule in the stressed syllable
            else out += REDUCE[c]!; // other unstressed vowels → short / schwa
            i += 1;
            nucleus += 1;
            continue;
        }
        i += 1; // unknown char → skip
    }
    return out;
}

// Reduced IPA for the UNSTRESSED (inseparable) prefixes — phonemised standalone they'd wrongly stress their vowel
// (ver→fɛr), but as a prefix the vowel reduces (ver·staan → fər·stɑːn). Separable prefixes (aan/af…) carry stress and
// take the normal morpheme path.
const PREFIX_IPA: Record<string, string> = { be: "bə", ge: "χə", ver: "fər", ont: "ɔnt", her: "ɦər", er: "ər" };

/** Phonemize one Afrikaans word to canonical IPA. Compounds/affixed words are DECOMPOSED (shared morphology) and
 *  each morpheme phonemized independently — so each element keeps its OWN stressed vowel (no cross-element reduction:
 *  aand·ete → ɑnt·iətə) and devoices at its own boundary; an unstressed prefix reduces. Single morpheme → direct. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    if (w === "'n" || w === "’n") return "ə"; // the indefinite article ⟨'n⟩ = [ə]
    const d = decompose(w);
    if (d.parts.length <= 1) return phonemizeMorpheme(w);
    return d.parts
        .map((p, idx) => (d.kinds[idx] === "prefix" && idx < d.stressPart ? (PREFIX_IPA[p] ?? phonemizeMorpheme(p)) : phonemizeMorpheme(p)))
        .join("");
}

const TOKEN = /([\p{L}\p{M}'’]+)|(\d+)|([.!?…,;:])/gu;

class AfrikaansPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd)); // cardinal → words → IPA

            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Afrikaans phonemizer (greedy g2p + open/closed vowel length + final devoicing). */
export function createAfrikaans(): Phonemizer {
    return new AfrikaansPhonemizer();
}
