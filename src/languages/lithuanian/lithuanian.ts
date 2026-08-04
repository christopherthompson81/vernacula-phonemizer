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
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Lithuanian word → canonical IPA (segmental; stress not marked). */
export function phonemizeWord(word: string): string {
    return toSegments(word).map((s) => s.ph).join("");
}

// A word (Lithuanian Latin letters incl. ą č ę ė į š ų ū ž) / number / punctuation token.
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions (#657).
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
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
