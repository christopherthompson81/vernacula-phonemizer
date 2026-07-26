/**
 * Slovenian (sl) phonemizer — canonical IPA, slovenščina, espeak-independent. Rule g2p (g2p.ts): consonant scan +
 * l-vocalization + lj/nj + syllabic-r + voicing/devoicing. NO stress mark is emitted — Slovene stress is free/lexical
 * and unwritten (a stress lexicon is the deferred fix), and the vowel quality/length/pitch the referee carries are
 * all unwritten too. text() tokenizes words / numbers / punctuation. See docs/investigations/sl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Slovene word → canonical IPA (segments joined; stress deferred). */
export function phonemizeWord(word: string): string {
    return toSegments(word)
        .map((s) => s.ph)
        .join("");
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([A-Za-zČčŠšŽžĆćĐđ]+)|(\d+)|([.!?…,;:])/gu;

class SlovenianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // ≤15 digits stays a safe integer → hand to numberToWords (which composes <1e12 and reads the rest
                // digit-by-digit); 16+ digits → read the raw string so the float conversion can't lose precision.
                const words = m[2].length <= 15 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Slovenian phonemizer (rule g2p + cardinal numbers; stress deferred). */
export function createSlovenian(): Phonemizer {
    return new SlovenianPhonemizer();
}
