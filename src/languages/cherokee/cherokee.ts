/**
 * Cherokee (chr) phonemizer — a deterministic per-character lookup over the 85-char syllabary, canonical
 * IPA. This file builds the char → IPA table from the ordered syllable values (U+13A0 + index) and folds
 * the Supplement lowercase block on via toUpperCase(). The syllable list, onset/vowel values and the
 * encyclopedic record (the shallow-skeleton caveat, referees) live in cherokee.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeCherokee } from "./normalize.ts";

interface CherokeeDef {
    syllables: string[];
    onsets: Record<string, string>;
    vowels: Record<string, string>;
}
// The 85 syllabary values in U+13A0 order, the onset → IPA map, and the vowels (cherokee.jsonc).
const DEF = loadManifest<CherokeeDef>(import.meta.url, "cherokee.jsonc");
const SYLLABLES = DEF.syllables;
const ONSET = DEF.onsets;
const VOWEL = DEF.vowels;

// Build the char → IPA table from the ordered values (U+13A0 + index).
const CHAR_IPA: Record<string, string> = {};
for (let idx = 0; idx < SYLLABLES.length; idx++) {
    const syl = SYLLABLES[idx]!;
    const ch = String.fromCodePoint(0x13a0 + idx);
    if (syl === "s") { CHAR_IPA[ch] = "s"; continue; }
    if (syl === "nah") { CHAR_IPA[ch] = "na"; continue; } // obsolete; now written ⟨na⟩ (grammar §4)
    const v = syl.slice(-1); // the vowel is always the last character
    const onset = syl.slice(0, -1);
    CHAR_IPA[ch] = (ONSET[onset] ?? "") + (VOWEL[v] ?? "");
}
// CHEROKEE LETTER MV (U+13F5). Montgomery-Anderson (p.95) calls /mv/ "the non-existent sound" — "the only gap
// in the table" — but Unicode encodes the character and the referees attest it, so we map it pragmatically to
// [mə̃] rather than drop it. The Supplement lowercase ꮿ uppercases here too.
CHAR_IPA["Ᏽ"] = "m" + VOWEL["v"];

/** One Cherokee syllabary word → canonical IPA (segmental skeleton; tone/length/aspiration/glottal unwritten). */
export function phonemizeWord(word: string): string {
    // Fold the Cherokee Supplement lowercase (U+AB70+) onto the main block, then look up each character.
    const t = word.toUpperCase();
    let out = "";
    for (const ch of t) out += CHAR_IPA[ch] ?? "";
    return out.normalize("NFC");
}

// Cherokee syllabary (main block + Supplement) / number / punctuation.
const TOKEN = /([Ꭰ-Ᏽꭰ-ꮿ]+)|(\d+)|([.?!,;:…])/gu;

class CherokeePhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ NORMALIZE BEFORE TOKENIZING, and after NFC — normalize.ts matches ASCII separators around
        // digits, so it must see the same string the tokenizer will. Its whole job is to spend marks that
        // `[.?!,;:…]` below would otherwise read as clause punctuation INSIDE a number.
        return assembleClauses(normalizeCherokee(input.normalize("NFC")), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Cherokee phonemizer (syllabary → phonemic segmental IPA; Montgomery-Anderson-grounded). */
export function createCherokee(): Phonemizer {
    return new CherokeePhonemizer();
}
