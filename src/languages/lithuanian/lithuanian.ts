/**
 * Lithuanian / lietuvių (lt) phonemizer — Baltic (Indo-European), Latin script, ~3M. A RULE-based
 * g2p (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (consonants → Cʲ before front vowels /
 * the softening ⟨i⟩, spreading through clusters) + regressive VOICING assimilation + n→ŋ before velars. STRESS is
 * lexical + pitch-accented (unpredictable from spelling) → not marked. Numbers are composed by numbers.ts (the
 * Baltic three-way counted-noun concord).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Lithuanian word → canonical IPA (segmental; stress not marked). */
export function phonemizeWord(word: string): string {
    return toSegments(word).map((s) => s.ph).join("");
}

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name, which `nat`
 * then folds to a base the g2p does have a rule for. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "gu");

class LithuanianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Lithuanian phonemizer (rule g2p; stress not marked). */
export function createLithuanian(): Phonemizer {
    return new LithuanianPhonemizer();
}
