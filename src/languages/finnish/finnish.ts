/**
 * Finnish (fi) phonemizer — Standard Finnish (yleiskieli), the Latin orthography, canonical IPA, espeak-independent.
 * The national language of Finland (~5.4M). Finnish is one of the most PHONEMICALLY TRANSPARENT orthographies in the
 * world (very nearly one grapheme ↔ one phoneme), so this is a greedy longest-match scan over the grapheme table
 * (manifest.ts) with three code rules: CONSONANT GEMINATION — a doubled consonant → geminate [Cː] (kukka→kukːɑ,
 * tullut→tulːut) — and the velar-nasal rules ⟨ng⟩→ŋː (a LONG velar nasal: kengät→keŋːæt, rengas→reŋːɑs) and ⟨nk⟩→ŋk
 * (⟨n⟩→ŋ before k: sänky→sæŋky). Signatures: 8 vowels with ⟨a⟩=ɑ (BACK); DOUBLING = LENGTH (aa→ɑː …); the 18
 * diphthongs mark the 2nd vowel as the non-syllabic offglide (au→ɑu̯, uo→uo̯) in the table; ⟨v⟩=ʋ (approximant),
 * ⟨r⟩=r (trill), ⟨j⟩=j. Consonant GRADATION is already spelled out in the orthography → no gradation logic needed.
 * Fixed word-initial primary stress is predictable + unwritten → not emitted (folded in the referee eval).
 * See docs/investigations/fi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u", "y", "ä", "ö", "å"]);

/** Phonemize a single Finnish word to canonical IPA (segmental; gemination + velar-nasal rules; length + diphthong
 *  offglides emitted). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        const next = w[i + 1] ?? "";
        // ⟨ng⟩ → ŋː (a long velar nasal), consuming both letters — before gemination so the ⟨n⟩ isn't mishandled.
        if (c === "n" && next === "g") { out += "ŋː"; i += 2; continue; }
        // ⟨nk⟩ → ŋk (⟨n⟩ → ŋ before a velar k); emit ŋ and let the k be scanned next (so kk-gemination still holds).
        if (c === "n" && next === "k") { out += "ŋ"; i += 1; continue; }
        // consonant gemination: a doubled consonant letter → geminate [Cː].
        if (!VOWEL_LETTERS.has(c) && next === c && G[c]) { out += G[c]! + "ː"; i += 2; continue; }
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) { out += G[key]!; i += key.length; matched = true; break; }
        }
        if (!matched) i += 1; // unknown char → skip
    }
    return out;
}

// A word (Finnish Latin letters incl. ä ö å + loan š ž) / number / punctuation token.
const TOKEN = /([a-zäöåšž]+)|(\d+)|([.!?…,;:])/giu;

class FinnishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // ≤9 digits fits a safe integer (<1e9) → compose; longer → read the raw string digit-by-digit so the
                // float conversion can't lose precision or go exponential (1e21 → "1e+21").
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Finnish phonemizer (greedy g2p + gemination + velar-nasal rules + cardinal numbers). */
export function createFinnish(): Phonemizer {
    return new FinnishPhonemizer();
}
