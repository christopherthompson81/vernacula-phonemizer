/**
 * Adlam (𞤀𞤁𞤂𞤃, U+1E900–1E95F) → Fula Boko/Latin transliteration — the second-script front-end for Fula (ff), the
 * Tashelhit/Tifinagh pattern. Adlam is the modern (1989, the Barry brothers) phonemic alphabet for Fulfulde/Pular,
 * now in wide diaspora + West-African use. Each Adlam letter maps 1:1 to a Fula phoneme, so we transliterate Adlam →
 * the Latin (Boko) orthography and reuse the existing longest-match g2p (g2p.ts) — prenasalisation (a nasal letter +
 * stop → mb/nd/nj/ng), gemination and vowel length all fall out of the same Latin rules.
 *
 * Adlam is caseless for phonemics (we fold the uppercase U+1E900–1E921 onto the lowercase U+1E922–1E943) and marks
 * length / gemination with COMBINING marks rather than doubling — so the VOWEL/ALIF LENGTHENER doubles the preceding
 * vowel (𞤢𞥅 → "aa" → [aː]) and the GEMINATION MARK doubles the preceding consonant (𞤦𞥆 → "bb" → [bː]); HAMZA →
 * the glottal ⟨q⟩→[ʔ]; the CONSONANT MODIFIER / GEMINATE-CONSONANT-MODIFIER / NUKTA (rare foreign-sound marks) are
 * dropped. The extra loan letters (va x gb z kp sh) transliterate to their Boko equivalents — identical to how the
 * Latin engine already treats them, so the two scripts stay consistent.
 */
import { foldDigitChar } from "../../core/unicode.ts";
import { MANIFEST } from "./manifest.ts";

// The Adlam tables (fula.jsonc `adlam`): letter → Boko/Latin, and the combining marks. The TRANSLITERATION
// LOGIC — case folding, and that a lengthener/gemination mark doubles what was just emitted rather than
// mapping to anything — is the scan below.
const ADLAM = MANIFEST.adlam.letters;
const LENGTHENER = new Set(MANIFEST.adlam.lengtheners);
const GEMINATION = MANIFEST.adlam.gemination;
const HAMZA = MANIFEST.adlam.hamza;
const DROP = new Set(MANIFEST.adlam.drop);
const ADLAM_DIGIT = /[\u{1E950}-\u{1E959}]/u; // 𞥐–𞥙, the only digits this scan may fold
const VOWELS = new Set(MANIFEST.latinVowels); // the LATIN spelling vowels (fula.jsonc)

/** Is any character of `s` in the Adlam block (U+1E900–1E95F)? */
export function isAdlam(s: string): boolean {
    for (const ch of s) { const c = ch.codePointAt(0)!; if (c >= 0x1e900 && c <= 0x1e95f) return true; }
    return false;
}

/** Fold an Adlam char to its lowercase form (uppercase U+1E900–1E921 → lowercase U+1E922–1E943). */
function toLower(ch: string): string {
    const c = ch.codePointAt(0)!;
    return c >= 0x1e900 && c <= 0x1e921 ? String.fromCodePoint(c + 0x22) : ch;
}

/** Transliterate an Adlam word → the Fula Boko/Latin orthography (then the caller runs the normal g2p). */
export function adlamToLatin(word: string): string {
    let out = "";
    let lastBase = ""; // the Latin emitted for the previous base letter (for gemination doubling)
    for (const raw of word) {
        const ch = toLower(raw);
        if (LENGTHENER.has(ch)) { const v = out.at(-1); if (v && VOWELS.has(v)) out += v; continue; }
        if (ch === GEMINATION) { out += lastBase; continue; }
        if (ch === HAMZA) { out += "q"; lastBase = "q"; continue; }
        if (DROP.has(ch)) continue;
        // ⚠ THE DIGIT TEST MUST STAY NARROW. foldDigitChar folds EVERY script's digits and returns a
        // non-digit unchanged, so calling it unguarded would (a) make `lat` never undefined, killing the
        // pass-through below, and (b) set lastBase — the gemination target — from a character that is not
        // an Adlam letter at all. Guarding on the Adlam digit range keeps the undefined signal intact.
        const lat = ADLAM[ch] ?? (ADLAM_DIGIT.test(ch) ? foldDigitChar(ch) : undefined);
        if (lat !== undefined) { out += lat; lastBase = lat; } else out += raw; // pass unknown through
    }
    return out;
}
