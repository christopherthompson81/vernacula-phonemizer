/**
 * Kinyarwanda / Ikinyarwanda (rw) phonemizer — Bantu (JD61, Rwanda-Rundi), the Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (manifest.ts): Kinyarwanda
 * syllables are open CV, so no coda/syllabification logic is needed. Signatures: PALATALISATION ⟨Cy⟩→[Cʲ] (Cox
 * K&KCG grammar, Table 25) — ⟨cy⟩→kʲ, ⟨jy⟩→ɡʲ, ⟨shy⟩→ʃʲ, ⟨by⟩→bʲ, ⟨ry⟩→ɾʲ, ⟨my⟩→mʲ (⟨ny⟩→ɲ phonemic); the plain
 * ⟨c⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨sh⟩→ʃ (epitran is wrong on these three); ⟨ng⟩→ŋ; double vowels → long. Tone (H/L) unwritten → DEFERRED.
 * See docs/investigations/rw_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Kinyarwanda word to canonical IPA (segmental; no tone — Kinyarwanda tone is unwritten). */
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

// A word (Kinyarwanda letters; the apostrophe marks vowel elision — a boundary, so it splits tokens) / number /
// punctuation.
const TOKEN = /([a-z]+)|(\d+)|([.!?…,;:])/giu;

class KinyarwandaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Kinyarwanda phonemizer (greedy rule g2p; tone deferred). */
export function createKinyarwanda(): Phonemizer {
    return new KinyarwandaPhonemizer();
}
