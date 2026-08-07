/**
 * Croatian (hr, hrvatski) phonemizer — South Slavic, Gaj's Latin, fully phonemic. Croatian and
 * Serbian are the pluricentric standards of one phonological system (Serbo-Croatian); the SEGMENTAL grapheme→IPA is
 * IDENTICAL, so this module reuses the Serbian engine's word g2p (phonemizeWord) directly. The only Croatian-specific
 * delta is the CARDINAL NUMBER WORDS (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta) — a thin
 * numbers override (numbers.ts) over the shared agreement compositor. Croatian is written exclusively in Latin, so
 * the tokenizer is Latin-only. Pitch accent is unwritten and DEFERRED (as in Serbian).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { phonemizeWord } from "../serbian/serbian.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeCroatian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Croatian word (Gaj's Latin incl. diacritics č ć š ž đ) / number / punctuation token. Latin-only: modern Croatian
// is written exclusively in Latin (the Serbian engine's Cyrillic path is not exposed here).
// the corpus groups thousands with PERIODS (2.500, 40.000) and writes decimals with COMMAS (2,4 Ghz).
// The de-grouping happens in normalize.ts; the TOKEN here swallows the comma so the tier can see the number.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+,\\d+|\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zčćšžđ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

// symbol normalization — Croatian: % is "posto" (indecilnable), the units/rates/exponents follow the
// Serbian tier, and the currency signs the corpus writes (¥, $, €, £) are declared. Kept in the ENGINE
// file so the review tool's sourcing check can see the words.
export const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "puta" },
    percent: ["posto"],
    // `jen` — the PR asked for an attestation, and there is one in the repo, from the SISTER STANDARD.
    // Croatian and Serbian are two standards of one language, and the Serbian corpus renders THIS VERY
    // FLEURS SENTENCE with the word spelled out: "od 2500 i 130.000 japanskih jena" (Cyrillic "јапанских
    // јена") where the Croatian translation writes "2.500 ¥ … 130.000 ¥". That sentence is the whole of the
    // evidence: the Serbian referee does NOT carry the word (its `jen*` entries are jendek/jenjati), so the
    // attestation is the corpus's genitive plural *jena*, which is the lemma in one of its forms.
    currency: { "¥": ["jen"], "$": ["dolar", "dolara"], "€": ["euro"], "£": ["funta"] },
    units: {
        km: ["kilometar", "kilometra", "kilometara"],
        m: ["metar", "metra", "metara"],
        mm: ["milimetar", "milimetra", "milimetara"],
        cm: ["centimetar", "centimetra", "centimetara"],
        mi: ["milja", "milje", "milja"],
        ghz: ["gigaherc", "gigaherca", "gigaherca"],
    },
    unitPer: "na", // 70 km/h -> sedamdeset kilometara NA sat
    rateDenominators: { h: "sat", s: "sekunda" },
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratnih"],
        cubed: ["kubni", "kubna", "kubnih"],
        position: "before",
    },
    countForm: slavicCountForm,
});

class CroatianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/rate steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeCroatian(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]))); // shared Serbo-Croatian g2p
            else if (m[2])
                for (const wd of numberToWords(Number(m[2].replace(/\./gu, "").replace(/,/gu, ""))).split(" ")) sink.emit(phonemizeWord(wd)); // Croatian numbers
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
