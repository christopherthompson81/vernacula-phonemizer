/**
 * Azerbaijani (az) phonemizer — North Azerbaijani (Latin), canonical IPA. Rule-based g2p
 * (g2p.ts) + final-syllable stress (the Turkic default). text() tokenizes words / numbers / punctuation.
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
// ⚠ AZERBAIJANI GROUPS THOUSANDS WITH A SPACE (400 000) OR A PERIOD (1.234) and takes a COMMA decimal (6,5).
// With a bare `(\d+)` number group both the space-group and the comma fall through to clausePunctuation:
// "400 000" reads *dörd yüz sıfır* and "6,5" *altı , beş*. normalize.ts claims clocks and the version dot
// first, so a comma reaching here is a decimal, a period-thousands is a group, and a plain digit run is a
// bare number.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+\\.\\d{3}(?:\\.\\d{3})*|\\d+,\\d+|\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zçğəıiöşüx]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

// Azerbaijani measure and currency nouns are INVARIANT after a numeral
// ("üç faiz", "80 kilometr"). `m` is a standalone metre unit (4892 m, 3,50 m).
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the `x` as a
    // LETTER NAME, and `NxN` is the commoner written form. One word, so `by` defaults to it — Azerbaijani does
    // not split dimension from product.
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
        // Normalise the Azerbaijani dotted-I pair before TOKENIZING: capital İ (U+0130) has no Unicode simple
        // case-fold to i, so the /i/-flag TOKEN class would silently DROP it (İki → ki). Map İ→i and I→ı
        // (azLower does the same per-token, but the tokenizer must see the lowercase forms to match at all).
        //
        // ⚠ AFTER normalize.ts, NOT BEFORE IT, and this line is why. Folding up front does not merely change
        // case — it DESTROYS THE ALL-CAPS SIGNAL, because `ı` and `i` are lowercase letters and an acronym
        // containing either capital I stops being a `\p{Lu}{2,}` run. The initialism pass then never sees it:
        //
        //     "IBM sistemi"  → /ˈɯbm sistemˈi/    read as a WORD — the pass matched nothing at all
        //     "İTV kanalı"   → /ˈitv kɑnɑɫˈɯ/     likewise
        //
        // Every other acronym in the language spelled out correctly (BMT → *be em te*), so the failure was
        // invisible except on the letter that caused it. Moved down here, where the only consumer left is the
        // tokenizer that genuinely needs the lowercase forms.
        const normalized = SYMBOLS(normalizeAzerbaijani(input)).replace(/İ/gu, "i").replace(/I/gu, "ı");
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/clock/era steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(normalized, TOKEN, (m, sink) => {
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
