/**
 * Nogai (nog) phonemizer — a near-deterministic digraph-aware Cyrillic grapheme scan + word-final
 * (oxytone) stress, canonical IPA. This file owns the position rules: coda ⟨в⟩→[w] vs onset [v], ⟨е⟩
 * iotation, stray ⟨ъ⟩→[ʔ], and the maximal-onset stress placement. The letter/digraph tables and the
 * encyclopedic record (written uvulars, attestation caveat) live in nogai.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeNogai } from "./normalize.ts";

interface NogaiDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    digraphs: Record<string, string>;
    vowelLetters: readonly string[];
}
const DEF = loadManifest<NogaiDef>(import.meta.url, "nogai.jsonc");
// Letter → IPA tables (nogai.jsonc). The position-dependent ⟨в е ъ⟩ are handled in the scan below.
const CONS = DEF.consonants;
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
const DIGRAPH = DEF.digraphs;
const CYR_VOWEL = new Set(DEF.vowelLetters);
/** Is an emitted IPA segment a vowel (or vowel-bearing)? Used for the coda-⟨в⟩, ⟨е⟩-iotation, and stress tests. */
const isVowelSeg = (s: string | undefined): boolean => s !== undefined && [...s].some((c) => IPA_VOWEL.has(c));

/** Phonemize one Nogai (Cyrillic) word → canonical IPA: digraph-aware grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()];
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        const pair = ch + (chars[i + 1] ?? "");
        if (DIGRAPH[pair] !== undefined) {
            segs.push(DIGRAPH[pair]!);
            i++; // consumed the second character
            continue;
        }
        // ⟨в⟩ → [w] in a post-vocalic coda (before a consonant or word-final): сув→suw, тав→taw; else [v] (onset/loan).
        // The "previous vowel" test reads the last EMITTED segment (not the raw prior char), so a front-vowel DIGRAPH
        // ⟨аь оь уь⟩ — whose second char is the soft sign ь — still counts as the preceding vowel.
        if (ch === "в") {
            const nx = chars[i + 1];
            const coda = nx === undefined || !CYR_VOWEL.has(nx);
            segs.push(isVowelSeg(segs[segs.length - 1]) && coda ? "w" : "v");
            continue;
        }
        // word-initial / post-vocalic ⟨е⟩ → [je]; after a consonant → [e]. Uses the last emitted segment so a preceding
        // front-vowel digraph counts as a vowel too.
        if (ch === "е") {
            segs.push(segs.length === 0 || isVowelSeg(segs[segs.length - 1]) ? "je" : "e");
            continue;
        }
        if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        else if (ch === "ъ") segs.push("ʔ"); // a stray hard sign (not part of гъ/къ/нъ) — glottal / hiatus
        // ь (a stray soft sign, not part of аь/оь/уь): loan palatalization — dropped
    }
    // Word-final (oxytone) stress — the Turkic default: ˈ before the onset of the last vowel's syllable.
    // ⚠ ONE ONSET CONSONANT WORD-INTERNALLY: native Nogai has no onset clusters, so a medial cluster splits
    // (китап.лар). Only a word-INITIAL cluster, with no vowel before it, is a whole onset — the loans спорт→ˈsport.
    // The sonority walk this replaces took a medial obstruent+liquid as an onset and gave *kitaˈplar*; tk and tt
    // had the same walk and the same fix (#1576, #1581).
    const nucleus = segs.findLastIndex(isVowelSeg);
    if (nucleus >= 0) {
        let at = nucleus;
        if (at > 0 && !isVowelSeg(segs[at - 1]!)) at--; // the immediate onset consonant
        if (!segs.slice(0, at).some(isVowelSeg)) at = 0; // a word-initial cluster is the whole onset
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/** A digit run → spoken Nogai, phonemized through the same Cyrillic g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    if (!Number.isSafeInteger(n))
        return [...digits].flatMap((d) => numberToWords(Number(d))).map(phonemizeWord).join(" ");
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A word (Cyrillic letters) / number / punctuation token.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class NogaiPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeNogai(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Nogai phonemizer (digraph-aware Cyrillic g2p + final stress). */
export function createNogai(): Phonemizer {
    return new NogaiPhonemizer();
}
