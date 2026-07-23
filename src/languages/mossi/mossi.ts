/**
 * Mooré (mos) phonemizer — Niger-Congo GUR (Oti-Volta), the Latin (Burkinabé) orthography, canonical IPA,
 * espeak-independent. The largest language of Burkina Faso (~8M) and the FIRST Gur language in the fleet. A greedy
 * longest-match scan over the grapheme table (manifest.ts) with two code rules: CONSONANT GEMINATION — a doubled
 * consonant is a geminate [Cː] (yelle→jélːé) — and NASAL place assimilation — ⟨n⟩→[ŋ] before g/k (tenga→teŋɡa).
 * Grounded on TWO independent authorities: the en.wiktionary Moore referee (modern orthography) + the FSI Moré
 * Basic Course (Lehr, Redden & Balima 1966) phonology. Signatures: ATR-ish 9-vowel system with dedicated letters ⟨ɛ⟩=ɛ,
 * ⟨ɩ⟩=ɪ, ⟨ʋ⟩=ʊ (⟨o⟩=o always — no ⟨ɔ⟩ letter); DOUBLING = LENGTH (aa→aː, ʋʋ→ʊː); NASAL = TILDE (ã ẽ ĩ õ ũ);
 * ⟨r⟩=ɾ (tap), ⟨y⟩=j, ⟨ny⟩=ɲ, ⟨ʼ⟩=ʔ. TONE (2-tone H/L) is not written in the orthography (contextual) → not
 * emitted. Numbers deferred. See docs/investigations/mos_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Base vowel letters — used only to keep the consonant-gemination rule from firing on a doubled vowel (vowel
// length is the digraph table's job). The nasal tilde vowels start with one of these, so a doubled consonant is
// unambiguously a consonant letter followed by itself.
const VOWEL_LETTERS = new Set(["a", "e", "ɛ", "i", "ɩ", "o", "u", "ʋ", "ã", "ẽ", "ĩ", "õ", "ũ"]);

/** Phonemize a single Mooré word to canonical IPA (segmental; gemination; non-tonal — tone not in the orthography). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        // consonant gemination: a doubled consonant letter → geminate [Cː]
        if (!VOWEL_LETTERS.has(c) && w[i + 1] === c && G[c]) {
            out += G[c]! + "ː";
            i += 2;
            continue;
        }
        // nasal place assimilation: ⟨n⟩ → [ŋ] before a velar g/k (tenga→teŋɡa, kEEngda→keːŋɡda) — /n/ has a
        // velar allophone before velars (FSI Lehr/Redden/Balima 1966, /n/⁴ = [n, ŋ]; the Wolof rule).
        if (c === "n" && (w[i + 1] === "g" || w[i + 1] === "k")) {
            out += "ŋ";
            i += 1;
            continue;
        }
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        if (!matched) i += 1; // unknown char → skip
    }
    return out;
}

// A word (Mooré Latin letters + diacritics: ɛ ɩ ʋ ŋ, tilde nasals, combining tilde, glottal ʼ) / number /
// punctuation token. \p{L}+\p{M} captures the letters and the combining tilde (ɛ̃ ɩ̃ ʋ̃) as one run.
const TOKEN = /([\p{L}\p{M}ʼ']+)|(\d+)|([.!?…,;:])/gu;

class MossiPhonemizer implements Phonemizer {
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

/** Build the Mooré phonemizer (greedy g2p + gemination; tone + numbers deferred). */
export function createMossi(): Phonemizer {
    return new MossiPhonemizer();
}
