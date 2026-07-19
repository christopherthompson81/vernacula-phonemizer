/**
 * Setswana / Tswana (tn) phonemizer — Bantu (Sotho-Tswana, S31), the Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (manifest.ts): Setswana is open CV
 * with the syllabic-nasal + C clusters as onset units, so no coda/syllabification logic is needed. Signatures:
 * the dorsal-fricative ⟨g⟩→x (NO /g/ phoneme — a beyond-epitran divergence), dorsal aspirates ⟨kg kh⟩→k͡xʰ kʰ,
 * lateral affricates ⟨tl tlh⟩→t͡ɬ t͡ɬʰ, ⟨tš š⟩→t͡ʃ ʃ, ⟨ny ng⟩→ɲ ŋ. Vowel height (⟨e⟩ [e]~[ɛ], ⟨o⟩ [o]~[ɔ]) is
 * underdetermined by the standard spelling → close-mid default, folded for scoring. Tone (H/L) is unwritten →
 * DEFERRED (segmental output only). See docs/investigations/tn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Setswana word to canonical IPA (segmental; no tone — Setswana tone is unwritten). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        if (!matched) i++; // unknown char → skip
    }
    return out;
}

// A word (Setswana letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
const TOKEN = /([a-zšêô]+)|(\d+)|([.!?…,;:])/giu;

class SetswanaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Setswana phonemizer (greedy rule g2p; tone + numbers deferred). */
export function createSetswana(): Phonemizer {
    return new SetswanaPhonemizer();
}
