/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA (AUTHORED). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeHausa } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
// the corpus groups thousands with COMMAS (6,387, 783,562) and writes decimals with DOTS (1.5,
// 12.8); the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zɓɗƙƴA-ZƁƊƘƳ'’]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// symbol normalization — Hausa: % is "kashi" BEFORE the number (the corpus's "kashi 80%"); nouns
// stay SINGULAR after numerals; the unit words are the corpus's own borrowings (kilomita, mita).
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "sau" },
    percent: ["kashi"],
    percentPrefix: true,
    // `dala` is the Hausa dollar, and the corpus proves it in the two places it names the currency —
    // "dalar Amurka" and "biliyoyin dalolin Amurka". The shipped `dollar` was the English spelling and is
    // attested nowhere; the review tool's sourcing line flags exactly that. (`dala` is polysemous — it is
    // also "pyramid", which is what four of its seven corpus hits are — but the tier only emits it after a
    // currency sign, so the other sense cannot be reached.) `yen` is the standard borrowing and the corpus
    // does write ¥ ×2, but the word itself is unattested here: a stated assumption, not a source.
    currency: { "$": ["dala"], "€": ["euro"], "¥": ["yen"], "£": ["fam"] },
    units: { km: ["kilomita"], m: ["mita"], kg: ["kilogram"], mm: ["milimita"], cm: ["santimita"] },
    exponentWords: { squared: ["murabba'i"], cubed: ["cubic"] },
});

class HausaPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's era/version/rate steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeHausa(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]).replace(/’/g, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2].replace(/,/gu, ""))).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hausa phonemizer (authored Boko g2p + tone lexicon). */
export function createHausa(): Phonemizer {
    return new HausaPhonemizer();
}
