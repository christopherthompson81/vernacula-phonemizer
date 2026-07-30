/**
 * Lithuanian / lietuvių (lt) phonemizer — Baltic (Indo-European), Latin script, ~3M, espeak-independent. A RULE-based
 * g2p (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (consonants → Cʲ before front vowels /
 * the softening ⟨i⟩, spreading through clusters) + regressive VOICING assimilation + n→ŋ before velars. STRESS is
 * lexical + pitch-accented (unpredictable from spelling) → not marked. Numbers are composed by numbers.ts (the
 * Baltic three-way counted-noun concord). See
 * docs/investigations/lt_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Lithuanian word → canonical IPA (segmental; stress not marked). */
export function phonemizeWord(word: string): string {
    return toSegments(word).map((s) => s.ph).join("");
}

// A word (Lithuanian Latin letters incl. ą č ę ė į š ų ū ž) / number / punctuation token.
const TOKEN = /([A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]+)|(\d+)|([.!?…,;:])/gu;

class LithuanianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
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
