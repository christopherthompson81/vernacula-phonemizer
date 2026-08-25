/**
 * Native Amharic / አማርኛ (am) text phonemizer — canonical IPA. Ethiopian Semitic, written in
 * the Ge'ez/Fidäl SYLLABARY-abugida: each codepoint is a whole CV syllable (the vowel is baked into the glyph),
 * so the g2p is a flat lookup (fidel.tsv, one Ethiopic codepoint → its CV) rather than a Brahmic matra/virama
 * engine. Two features are UNWRITTEN: GEMINATION (phonemic but unmarked — rendered single, folded vs the referee)
 * and the 6th-order vowel [ɨ], which is epenthetic and DELETED word-finally (ሁለት→hulət) and before a vowel.
 * Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ.
 */
import type { Phonemizer } from "../../registry.ts";
import type { SymbolData } from "../../core/normalizeSymbols.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeGeezG2P } from "../../core/geez.ts";
import { MANIFEST } from "./manifest.ts";
import { makeAmharicNormalizer } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teenPrefix: string;
    tens: Record<string, string>;
    hundred: string;
    thousand: string;
    million: string;
    billion: string;
}
export interface AmharicDef {
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc.
     *  Typed off `SymbolData` itself so the declaration cannot drift from what the engine reads. */
    symbolTier: Required<Pick<SymbolData, "percent" | "currency" | "units" | "magnitudes" | "exponentWords" | "multiply" | "ampersand">>;
}
const DEF = MANIFEST;
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

/** One Amharic word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
export const phonemizeWord = makeGeezG2P(import.meta.url, "fidel.tsv");

// ── Numbers (decimal; Amharic) ────────────────────────────────────────────────
function numberToText(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.teenPrefix} ${NUM.units[n - 10]}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        // ⚠ THE TENS ARE KEYED "20".."90", not "2".."9". Looking up the digit alone returns undefined and the
        // ten is silently DROPPED — 25 reads "amɨst", 1998 reads thousand-nine-hundred-EIGHT.
        return NUM.tens[String(t * 10)]! + (u ? ` ${NUM.units[u]}` : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return `${h > 1 ? NUM.units[h] + " " : ""}${NUM.hundred}${r ? " " + numberToText(r) : ""}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return `${th > 1 ? numberToText(th) + " " : ""}${NUM.thousand}${r ? " " + numberToText(r) : ""}`;
    }
    // ⚠ Scales above ሺ are European loans (ሚሊዮን / ቢሊዮን) and, unlike the bare ሺ / መቶ, KEEP their multiplier at
    // 1 — 10⁶ is አንድ ሚሊዮን. Without a composer for them the digit string is emitted raw, and the fidel g2p then
    // renders it as EMPTY IPA.
    for (const [value, scale] of [[1_000_000_000, NUM.billion], [1_000_000, NUM.million]] as const) {
        if (n >= value) {
            const q = Math.floor(n / value), r = n % value;
            return `${numberToText(q)} ${scale}${r ? " " + numberToText(r) : ""}`;
        }
    }
    return String(n);
}
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ OUT OF RANGE MUST STILL BE READ. Returning `digits` leaks ASCII into the IPA — the 10¹² cap is a
    // limit of the authored magnitude words, not a reason to stop speaking. Digit-at-a-time, the same
    // fallback the fleet uses at the 2^53 cliff; see docs/investigations/bignum_fallback_investigation.md.
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...digits].map((c) => numberToText(Number(c))).map(phonemizeWord).join(" ");
    return numberToText(n).split(" ").map(phonemizeWord).join(" ");
}

// Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
//
// ⚠ THE LETTER CLASS MUST NOT REACH THE PUNCTUATION SUB-BLOCK. This is the known hazard for a script whose
// punctuation lives inside its own Unicode block — Burmese and Khmer each dropped EVERY sentence boundary that
// way. Here the class ends at ፚ = U+135A while ። ፣ ፤ ፥ ፦ ፧ ፨ are U+1362–U+1368, above the range, so the letter
// branch cannot swallow them. DO NOT widen this to the full block without moving the punctuation branch ahead
// of it.
const TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

// በመቶ "in a hundred" is the standard percent construction, postposed; the currency and unit words are the
// standard loans, emitted in Ge'ez script and read by the ordinary fidel g2p. The per-key evidence — the
// corpus counts, the two exponent words that sit on opposite sides, why the magnitude list is load-bearing —
// travelled to amharic.jsonc with the values it explains.
const SYMBOLS = makeSymbolNormalizer({
    percent: DEF.symbolTier.percent,
    currency: DEF.symbolTier.currency,
    units: DEF.symbolTier.units,
    magnitudes: DEF.symbolTier.magnitudes,
    exponentWords: DEF.symbolTier.exponentWords,
    multiply: DEF.symbolTier.multiply,
    ampersand: DEF.symbolTier.ampersand,
});

/** Text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9). */
const NORMALIZE = makeAmharicNormalizer(numberToText, SYMBOLS);

class AmharicPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(NORMALIZE(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Amharic phonemizer. `foreign` handles embedded Latin runs. */
export function createAmharic(foreign?: ForeignPhonemizer): Phonemizer {
    return new AmharicPhonemizer(foreign);
}
