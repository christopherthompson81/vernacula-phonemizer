/**
 * Croatian (hr, hrvatski) phonemizer — South Slavic, Gaj's Latin, fully phonemic, espeak-independent. Croatian and
 * Serbian are the pluricentric standards of one phonological system (Serbo-Croatian); the SEGMENTAL grapheme→IPA is
 * IDENTICAL, so this module reuses the Serbian engine's word g2p (phonemizeWord) directly. The only Croatian-specific
 * delta is the CARDINAL NUMBER WORDS (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta) — a thin
 * numbers override (numbers.ts) over the shared agreement compositor. Croatian is written exclusively in Latin, so
 * the tokenizer is Latin-only. Pitch accent is unwritten and DEFERRED (as in Serbian). See
 * docs/investigations/hr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "../serbian/serbian.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Croatian word (Gaj's Latin incl. diacritics č ć š ž đ) / number / punctuation token. Latin-only: modern Croatian
// is written exclusively in Latin (the Serbian engine's Cyrillic path is not exposed here).
const TOKEN = /([a-zčćšžđ]+)|(\d+)|([.!?…,;:])/giu;

class CroatianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1])); // shared Serbo-Croatian g2p
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd)); // Croatian numbers
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Croatian phonemizer (shared Serbo-Croatian g2p + Croatian cardinal numbers). */
export function createCroatian(): Phonemizer {
    return new CroatianPhonemizer();
}
