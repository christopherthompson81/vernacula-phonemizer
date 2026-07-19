/**
 * Bambara / Bamanankan (bm) phonemizer — Mande (Manding), the Latin orthography, canonical IPA,
 * espeak-independent. Mali's principal language (~14M incl. L2). A greedy longest-match scan over the grapheme
 * table (manifest.ts) with ONE piece of code logic — NASALISATION: a syllable-final ⟨n⟩ (word-final or before a
 * consonant) nasalises the preceding vowel [Ṽ] and is dropped (ban→bã, kunun→kunũ), while an onset ⟨n⟩ before a
 * vowel stays [n] (na→na); a word-initial nasal + C is a prenasal onset (mburu→mburu). Signatures: ⟨c⟩→t͡ʃ,
 * ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ, ⟨ny⟩=⟨ɲ⟩→ɲ, ⟨ŋ⟩→ŋ; 7 oral vowels i e ɛ a ɔ o u. Tone (2-level H/L + downstep) and vowel
 * LENGTH are lexical / unwritten in the standard orthography → DEFERRED (segmental + nasal backbone only). N'Ko
 * is a second script, deferred. See docs/investigations/bm_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const NASAL_TILDE = "̃"; // combining tilde — a nasalised vowel (matches the referee's ã õ ũ …)
const VOWELS = new Set(["i", "e", "ɛ", "a", "ɔ", "o", "u"]); // orthographic oral vowels
const IPA_VOWELS = new Set(["i", "e", "ɛ", "a", "ɔ", "o", "u"]); // their IPA (identical here)

/** Phonemize a single Bambara word to canonical IPA (segmental + nasalisation; tone + length deferred). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const out: string[] = []; // one entry per emitted segment (so we can nasalise the previous vowel)
    let i = 0;
    while (i < w.length) {
        // digraphs FIRST, so ⟨ny⟩→ɲ is not intercepted by the ⟨n⟩ nasalisation logic
        if (w.startsWith("ny", i)) { out.push("ɲ"); i += 2; continue; }
        if (w.startsWith("sh", i)) { out.push("ʃ"); i += 2; continue; }
        const c = w[i]!;
        // ⟨n m⟩ — nasalisation logic (not a plain grapheme)
        if (c === "n" || c === "m") {
            const next = w[i + 1];
            if (next !== undefined && VOWELS.has(next)) {
                out.push(c); // onset nasal before a vowel
            } else if (out.length > 0 && IPA_VOWELS.has(out[out.length - 1]!)) {
                out[out.length - 1] += NASAL_TILDE; // syllable-final n → nasalise the preceding vowel, drop the n
            } else {
                // word-initial / post-consonant prenasal: assimilate place to the following consonant
                out.push(next === "g" || next === "k" ? "ŋ" : c === "n" ? "n" : "m");
            }
            i += 1;
            continue;
        }
        const g = G[c];
        if (g !== undefined) out.push(g);
        i += 1; // single grapheme, or skip unknown
    }
    return out.join("");
}

// A word (Bambara Latin letters incl. ɛ ɔ ɲ ŋ) / number / punctuation token.
const TOKEN = /([a-zɛɔɲŋ]+)|(\d+)|([.!?…,;:])/giu;

class BambaraPhonemizer implements Phonemizer {
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

/** Build the Bambara phonemizer (greedy g2p + nasalisation; tone + length + numbers deferred). */
export function createBambara(): Phonemizer {
    return new BambaraPhonemizer();
}
