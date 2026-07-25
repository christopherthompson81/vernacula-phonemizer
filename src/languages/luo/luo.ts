/**
 * Luo / Dholuo (luo) phonemizer — Western Nilotic (Luo group), the Latin orthography, canonical IPA,
 * espeak-independent. Spoken around Lake Victoria in Kenya + Tanzania (~4–5M). The FIRST Nilotic language in the repo.
 * A greedy longest-match scan over the grapheme table (manifest.ts) with ONE code rule: a high vowel ⟨i u⟩ before
 * another vowel becomes the glide ⟨j w⟩ (dhiang'→ðjaŋ, chieng'→t͡ʃjeŋ). Signatures: the DENTAL vs ALVEOLAR contrast
 * (⟨th dh⟩→θ ð vs ⟨t d⟩→t d); PRENASALISED voiced stops as single units (mb→ᵐb, nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ); ⟨ng'⟩→ŋ vs
 * ⟨ng⟩→ᵑɡ; ⟨ny⟩→ɲ; the palatals ⟨ch⟩→t͡ʃ, ⟨j⟩→d͡ʒ; ⟨r⟩→ɾ. The 9-vowel ±ATR distinction and register TONE (H/L) are
 * UNWRITTEN in the orthography → emitted at a +ATR/toneless default (folded in the eval). See
 * docs/investigations/luo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u"]);

/** Phonemize a single Dholuo word to canonical IPA (segmental; +ATR/toneless default — ATR + tone are unwritten). A
 *  tone-marked citation spelling (chíeng', à) is normalised to its base letters first — the orthography proper is
 *  unaccented, and we emit no tone. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "");
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        // GLIDE: a high vowel ⟨i u⟩ immediately before a DIFFERENT vowel letter is the glide [j]/[w] (dhiang'→ðjaŋ).
        // Guarded to a different following vowel so a doubled ⟨ii⟩/⟨uu⟩ (hiatus/length) is not glided.
        const nx = w[i + 1] ?? "";
        if ((c === "i" || c === "u") && VOWEL_LETTERS.has(nx) && nx !== c) {
            out += c === "i" ? "j" : "w";
            i += 1;
            continue;
        }
        // greedy longest-match grapheme (ng' → the two-letter digraphs → singles); skip an unknown char
        const k = GRAPHEME_KEYS.find((key) => w.startsWith(key, i));
        if (k) { out += G[k]!; i += k.length; continue; }
        i += 1;
    }
    return out;
}

// A word (Dholuo letters + the ⟨ng'⟩ apostrophe; also accented citation vowels, normalised away in phonemizeWord) /
// number / punctuation token.
const TOKEN = /([a-zàáâãäèéêëìíîïòóôõöùúûü'’]+)|(\d+)|([.!?…,;:])/giu;

class LuoPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/gu, "'")));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Luo (Dholuo) phonemizer (greedy g2p + glide; ATR, tone, numbers deferred). */
export function createLuo(): Phonemizer {
    return new LuoPhonemizer();
}
