/**
 * Somali (so) phonemizer — Af-Soomaali (1972 Latin orthography), canonical IPA. Rule-based
 * g2p (g2p.ts). Somali prominence is a grammatical pitch-ACCENT (tone), not lexical stress, and it is unwritten,
 * so no stress/tone mark is emitted (segmental output only — tone deferred). text() tokenizes words / numbers /
 * punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeSomali } from "./normalize.ts";

/** Phonemize a single Somali word to canonical IPA (no tone/stress mark — Somali tone is unwritten). */
export function phonemizeWord(word: string): string {
    return toSegments(word)
        .map((s) => s.ph)
        .join("");
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Somali letters + apostrophe for the glottal stop, incl. the typographic ’) / number / punctuation.
// g2p normalizes ’→', but the tokenizer must accept ’ or it would split su’aal and drop the glottal.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'ʼ’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-z'ʼ’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SomaliPhonemizer implements Phonemizer {
    text(input: string): string {
        // NORMALIZATION runs first — pure text→text, so everything it emits is then read by the ordinary word,
        // number and clause paths below. It must see the text BEFORE tokenization, because most of what it
        // repairs (a grouping `,`, a decimal `.`, a clock `:`) is a character `TOKEN` would otherwise hand to
        // `clausePunctuation` as a pause.
        return assembleClauses(normalizeSomali(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Somali phonemizer (rule g2p; tone deferred). */
export function createSomali(): Phonemizer {
    return new SomaliPhonemizer();
}
