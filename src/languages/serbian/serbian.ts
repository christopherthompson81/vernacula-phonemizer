/**
 * Serbian (sr, српски) phonemizer — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully phonemic, espeak-
 * independent. A digraph-aware left-to-right scan (g2p reads serbian.jsonc): the Latin digraphs ⟨dž lj nj dj⟩
 * first, then the single Cyrillic OR Latin letters — every grapheme is one phoneme, no vowel reduction. Serbian's
 * lexical PITCH ACCENT (4-way) + length are unwritten and DEFERRED — no stress/tone mark is emitted (the referee
 * eval folds them). text() tokenizes words / numbers / punctuation. See docs/investigations/sr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const DIGRAPHS = MANIFEST.digraphs;
const LETTERS = MANIFEST.letters;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Serbian word (either script) to canonical IPA. Digraphs are longest-match; every other
 *  grapheme is a one-letter lookup. No accent/length is emitted (deferred). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    for (let i = 0; i < w.length; ) {
        const two = w.slice(i, i + 2);
        if (DIGRAPHS[two]) {
            out += DIGRAPHS[two];
            i += 2;
            continue;
        }
        const c = w[i]!;
        if (LETTERS[c] !== undefined) out += LETTERS[c];
        i++; // unknown char (punctuation) → skip
    }
    return out;
}

// A word (Serbian Cyrillic + Latin incl. diacritics) / number / punctuation token.
const TOKEN = /([а-шђјљњћџa-zčćšžđ]+)|(\d+)|([.!?…,;:])/giu;

class SerbianPhonemizer implements Phonemizer {
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

/** Build the Serbian phonemizer (phonemic dual-script g2p; pitch accent deferred). */
export function createSerbian(): Phonemizer {
    return new SerbianPhonemizer();
}
