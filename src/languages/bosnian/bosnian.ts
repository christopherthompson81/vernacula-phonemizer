/**
 * Bosnian (bs, bosanski) phonemizer — South Slavic, the third Serbo-Croatian standard, ~2.5M.
 * Bosnian, Croatian and Serbian are pluricentric standards of ONE phonological system (Serbo-Croatian); the SEGMENTAL
 * grapheme→IPA is IDENTICAL (the same 30-phoneme inventory + fully-phonemic orthography — a linguistic fact), so this
 * module reuses the Serbian engine's word g2p (phonemizeWord) directly. Bosnian is written in BOTH Gaj's Latin
 * (predominant) and Cyrillic, so the tokenizer admits both scripts. The only Bosnian-specific delta is the CARDINAL
 * NUMBER WORDS (Serbian hiljada/milion lexemes + the ijekavian dvjesta — numbers.ts) over the shared agreement
 * compositor. STRESS POSITION arrives with the shared g2p — phonemizeWord is Serbian's, and it now reads the
 * unified Serbo-Croatian accent lexicon, including the four-way contour.
 * docs/investigations/normalization/south_slavic_stress_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { foreignLetters, phonemizeWord } from "../serbian/serbian.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeBosnian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Bosnian word — both scripts (Cyrillic + Gaj's Latin incl. diacritics č ć š ž đ) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "а-шђјљњћџ")})|(\\d+)|([.!?…,;:])`, "giu");
/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where the
 * SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A token
 * this class REJECTS carries a letter the language does not use — i.e. a foreign name. See core/hostWord.ts.
 *
 * ⚠ `й` IS EXCLUDED, and it is the one part of this that is not a straight lift. The old class used the coarse
 * range `а-ш`, which sweeps up `й` — a RUSSIAN letter that Serbian/Bosnian Cyrillic does not have (this
 * orthography writes `ј`, U+0458, which sits outside the range entirely and is listed separately). The g2p has no
 * rule for `й` and dropped it. Excluding it from the inventory hands it to the fold instead, and `й` DOES
 * decompose — и + combining breve — so `Толстой` reads with a final /i/ rather than losing the letter.
 * The TOKEN above deliberately stays wide: claiming the whole Cyrillic run is the SCRIPT question, and getting
 * that right is what puts the letter in front of the fold at all.
 */
const NATIVE_CLASS = "[а-ик-шђјљњћџa-zčćšžđ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class BosnianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its de-grouping, ordinal, clock, degree and range steps all need the figure
        // and its mark still ADJACENT, which the tokenizer's clause split would break (the grouping dot and
        // the ordinal period are both `.`, i.e. clause punctuation, until this pass removes them). The
        // shared symbol tier runs inside that pass, in the ordered position its neighbours require.
        return assembleClauses(normalizeBosnian(input), TOKEN, (m, sink) => {
            // `foreignLetters` BEFORE `nat`: the fold is spelled in Gaj's Latin, so what reaches the
            // script normaliser is already native spelling. Without it ⟨q w x y⟩ are DELETED.
            if (m[1]) sink.emit(phonemizeWord(nat(foreignLetters(m[1])))); // shared Serbo-Croatian g2p
            else if (m[2])
                // ⚠ THE TOKEN STRING IS PASSED AS `raw` (#1059) — the digit-by-digit fallback cannot recover
                // the digits from the double. The arm is bare `\d+`, so the token IS the digit string.
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd)); // Bosnian numbers
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
