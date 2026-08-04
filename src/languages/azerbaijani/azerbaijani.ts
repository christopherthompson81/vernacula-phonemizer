/**
 * Azerbaijani (az) phonemizer — North Azerbaijani (Latin), canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts) + final-syllable stress (the Turkic default). text() tokenizes words / numbers / punctuation. See
 * docs/investigations/az_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeAzerbaijani } from "./normalize.ts";

/** Phonemize a single Azerbaijani word to canonical IPA (final-syllable stress, before the stressed vowel). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    const stressIdx = nuclei[nuclei.length - 1]!; // final-syllable default
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// #562 — Azerbaijani groups thousands with a SPACE (400 000) or a PERIOD (1.234 — the old class's "."
// thousands sep, still the idiomatic reading) and takes a COMMA decimal (6,5). The old class was a bare
// `(\d+)`, so BOTH the space-group and the comma fell through: "400 000" read *dörd yüz sıfır* and "6,5"
// *altı , beş*. normalize.ts claims clocks and the version dot first; a comma reaching here is a decimal
// (the TOKEN's `\d+,\d+`), a period-thousands is a group (the TOKEN's `\d+\.\d{3}`), and a plain digit run
// is a bare number.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+\\.\\d{3}(?:\\.\\d{3})*|\\d+,\\d+|\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zçğəıiöşüx]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

// #562 symbol normalization — Azerbaijani measure and currency nouns are INVARIANT after a numeral
// ("üç faiz", "80 kilometr"). `m` is a standalone metre unit (4892 m, 3,50 m).
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "vur" },
    percent: ["faiz"],
    currency: { "€": ["avro"], "$": ["dollar"], "£": ["funt sterlinq"], "¥": ["yen"] },
    units: {
        km: ["kilometr"], sm: ["santimetr"], mm: ["millimetr"], kg: ["kilogram"],
        m: ["metr"], mil: ["mil"], mi: ["mil"], yard: ["yard"],
    },
    exponentWords: { squared: ["kvadrat"], cubed: ["kub"], position: "before" },
    magnitudes: ["milyon", "milyard", "trilyon"],
});

/** A number token (Azerbaijani space-/period-thousands, comma-decimal) → spoken words. */
function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/[ .]/gu, "")));
    if (frac !== undefined)
        words +=
            ` ${MANIFEST.numbers.decimalConnector} ` +
            [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}

class AzerbaijaniPhonemizer implements Phonemizer {
    text(input: string): string {
        // Normalise the Azerbaijani dotted-I pair BEFORE tokenizing: capital İ (U+0130) has no Unicode simple
        // case-fold to i, so the /i/-flag TOKEN class would silently DROP it (İki → ki). Map İ→i and I→ı up front
        // (azLower does the same per-token, but the tokenizer must see the lowercase forms to match at all).
        const normalized = input.replace(/İ/gu, "i").replace(/I/gu, "ı");
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/clock/era steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeAzerbaijani(normalized)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberTokenToWords(m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Azerbaijani phonemizer (rule g2p + final-syllable stress). */
export function createAzerbaijani(): Phonemizer {
    return new AzerbaijaniPhonemizer();
}
