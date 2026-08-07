/**
 * Cherokee / ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ (chr) phonemizer — Iroquoian, ~2k L1 speakers (Oklahoma / North Carolina), written in the
 * CHEROKEE SYLLABARY (Sequoyah, 85 characters, U+13A0–U+13F4 + Supplement U+AB70–U+ABBF), canonical IPA.
 * The g2p is AUTHORED FROM Montgomery-Anderson, *Cherokee, A Reference Grammar of Oklahoma* (the falsifiable
 * published phonology — the bho/Crawford mold).
 *   ⚠ Deterministic per-CHARACTER lookup over the 85-char syllabary (Table 13). Each char → its CV IPA. 6 vowels
 *     a e i o u + ⟨v⟩→[ə̃] (nasal mid-central). Obstruents are PHONEMICALLY VOICELESS (Cherokee contrasts
 *     aspiration, NOT voicing): the g/d/ts/tl/qu series → unaspirated [k t t͡s t͡ɬ kʷ]; the aspirated split-cell
 *     chars (Ꭷ→kʰ, Ꮤ/Ꮦ/Ꮨ→tʰ, Ꮭ→t͡ɬ) emit the richer aspirated form. Bare Ꮝ = /s/.
 *   ⚠ THE SYLLABARY IS A SHALLOW PHONEMIC SKELETON (grammar §4, p.95): it does NOT differentiate aspiration
 *     (EXCEPT in the split cells ga/ka, da/ta, de/te, di/ti, dla/tla — handled above), and never marks tone,
 *     vowel length, the glottal stop, or the intrusive /h/. So this recovers the SEGMENTAL melody only — the 6
 *     tones, length, most aspiration, glottalisation and intrusive-h are the disclosed folded residual (SYMBOL
 *     accuracy is the honest headline). Referee: wikipron chr_cher_broad (primary) + kaikki (secondary).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

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
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
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
