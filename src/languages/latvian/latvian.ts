/**
 * Latvian (lv) phonemizer — canonical IPA, latviešu, Baltic. Rule g2p (g2p.ts) + FIXED
 * first-syllable stress (emitted before the first nucleus — Latvian stress is predictable, unlike Lithuanian).
 * Written length (macrons) + written palatals are emitted directly; the syllable tone the narrow referee carries is
 * unwritten → folded. text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeLatvian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

/** One Latvian word → canonical IPA with fixed first-syllable stress (ˈ before the first nucleus). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const first = segs.findIndex((s) => s.nucleus);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === first) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name, which `nat`
 * then folds to a base the g2p does have a rule for. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "gu");

class LatvianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeLatvian(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const words = m[2].length <= 9 ? numberToWords(Number(m[2]), m[2]) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Latvian phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
export function createLatvian(): Phonemizer {
    return new LatvianPhonemizer();
}
