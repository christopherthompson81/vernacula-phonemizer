/**
 * Bosnian (bs, bosanski) phonemizer — South Slavic, the third Serbo-Croatian standard, ~2.5M, espeak-independent.
 * Bosnian, Croatian and Serbian are pluricentric standards of ONE phonological system (Serbo-Croatian); the SEGMENTAL
 * grapheme→IPA is IDENTICAL (the same 30-phoneme inventory + fully-phonemic orthography — a linguistic fact), so this
 * module reuses the Serbian engine's word g2p (phonemizeWord) directly. Bosnian is written in BOTH Gaj's Latin
 * (predominant) and Cyrillic, so the tokenizer admits both scripts. The only Bosnian-specific delta is the CARDINAL
 * NUMBER WORDS (Serbian hiljada/milion lexemes + the ijekavian dvjesta — numbers.ts) over the shared agreement
 * compositor. Pitch accent is unwritten and DEFERRED (as in Serbian/Croatian). See docs/investigations/bs_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "../serbian/serbian.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Bosnian word — both scripts (Cyrillic + Gaj's Latin incl. diacritics č ć š ž đ) / number / punctuation token.
const TOKEN = /([а-шђјљњћџa-zčćšžđ]+)|(\d+)|([.!?…,;:])/giu;

class BosnianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1])); // shared Serbo-Croatian g2p
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd)); // Bosnian numbers
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Bosnian phonemizer (shared Serbo-Croatian g2p + Bosnian cardinal numbers). */
export function createBosnian(): Phonemizer {
    return new BosnianPhonemizer();
}
