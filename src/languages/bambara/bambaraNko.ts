/**
 * N'Ko (ߒߞߏ, U+07C0–07FF) → Bambara Latin transliteration — the second-script front-end for Bambara (bm), the
 * Tashelhit/Fula pattern. N'Ko is the modern (1949, Solomana Kanté) right-to-left phonemic alphabet for the Manding
 * languages; its codepoints are stored in LOGICAL (reading) order, so a left-to-right scan is correct. Each N'Ko
 * letter maps to a Bambara phoneme, so we transliterate N'Ko → the Latin orthography and reuse the existing greedy
 * g2p — the nasalisation rule (a syllable-final ⟨n⟩ nasalises the preceding vowel) is reused by turning the N'Ko
 * NASALIZATION MARK into that syllable-final ⟨n⟩.
 *
 * N'Ko vowel naming is the classic trap: LETTER EE = /e/, LETTER E = /ɛ/, LETTER OO = /o/, LETTER O = /ɔ/. TONE is
 * written in N'Ko (7 combining tone marks + the tone apostrophes) but Bambara's Latin orthography + this engine are
 * TONELESS, so the tone marks are dropped (matching the Latin path); likewise the LAJANYALAN lengthener and the
 * DAGBASINNA carrier. The JONA letters (foreign-loan j/ch/r) map to their nearest Bambara consonant.
 */

// N'Ko letter → Bambara Latin. (EE→e / E→ɛ / OO→o / O→ɔ — mind the naming.)
const NKO: Record<string, string> = {
    "ߊ": "a", "ߋ": "e", "ߌ": "i", "ߍ": "ɛ", "ߎ": "u", "ߏ": "o", "ߐ": "ɔ",
    "ߒ": "n", "ߓ": "b", "ߔ": "p", "ߕ": "t", "ߖ": "j", "ߗ": "c", "ߘ": "d", "ߙ": "r", "ߚ": "r", "ߛ": "s",
    "ߜ": "g", "ߝ": "f", "ߞ": "k", "ߟ": "l", "ߠ": "ŋ", "ߡ": "m", "ߢ": "ny", "ߣ": "n", "ߤ": "h", "ߥ": "w",
    "ߦ": "y", "ߧ": "ny", "ߨ": "j", "ߩ": "c", "ߪ": "r",
};
const NASAL = "߲"; // COMBINING NASALIZATION MARK → a syllable-final ⟨n⟩ (nasalises the preceding vowel in the g2p)
// tone marks (07EB–07F1), double-dot (07F3), tone apostrophes (07F4/07F5), LAJANYALAN lengthener (07FA),
// DANTAYALAN (07FD), and the DAGBASINNA carrier (07D1) carry no segmental value here → dropped.
const DROP = /[߫-߱߳ߴߵߺ߽ߑ]/u;

/** Is any character of `s` in the N'Ko letter/mark range (U+07CA–07FF)? */
export function isNko(s: string): boolean {
    for (const ch of s) { const c = ch.codePointAt(0)!; if (c >= 0x07ca && c <= 0x07ff) return true; }
    return false;
}

/** Transliterate an N'Ko word → the Bambara Latin orthography (the caller then runs the normal g2p). */
export function nkoToLatin(word: string): string {
    let out = "";
    for (const ch of word) {
        if (ch === NASAL) { out += "n"; continue; } // nasal vowel → V + syllable-final n
        if (DROP.test(ch)) continue;
        out += NKO[ch] ?? ""; // unknown N'Ko codepoint (digit/punct/symbol) → drop
    }
    return out;
}
