/**
 * Umbundu (umb) phonemizer — Bantu (R11, Angola), the Latin orthography, canonical IPA, espeak-independent. A pure
 * greedy longest-match scan over the grapheme table (manifest.ts): Umbundu is open CV with prenasalised clusters as
 * single onset units, so no coda/syllabification logic is needed. Signatures: VOICED obstruents ONLY prenasalised
 * (⟨mb nd nj ng⟩→ᵐb ⁿd ᶮd͡ʒ ᵑɡ), ⟨c⟩→t͡ʃ, ⟨v⟩→v, ⟨ñ⟩/⟨ny⟩→ɲ, ⟨ng'⟩→ŋ, ⟨l⟩→l. Tone (H á / L à + downstep) is often
 * unwritten → the accents are STRIPPED (tone DEFERRED); nasal-vowel tildes are kept. See
 * docs/investigations/umb_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Strip the tone accents (acute U+0301 = H, grave U+0300 = L; tone is DEFERRED) but KEEP the nasalisation tilde
 *  (U+0303) — decompose, drop only the tone marks, recompose. */
function stripTone(w: string): string {
    return w.normalize("NFD").replace(/[̀́]/gu, "").normalize("NFC");
}

/** Phonemize a single Umbundu word to canonical IPA (segmental; tone unwritten/deferred). */
export function phonemizeWord(word: string): string {
    const w = stripTone(word.toLowerCase());
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

// A word (Umbundu letters incl. ⟨ñ⟩ + the ⟨ng'⟩ apostrophe, and tone/nasal diacritics) / number / punctuation token.
const TOKEN = /([\p{L}\p{M}'’]+)|(\d+)|([.!?…,;:])/gu;

class UmbunduPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/gu, "'")));
            // numbers deferred (Umbundu cardinal compositor not yet authored)
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Umbundu phonemizer (greedy rule g2p; tone deferred). */
export function createUmbundu(): Phonemizer {
    return new UmbunduPhonemizer();
}
