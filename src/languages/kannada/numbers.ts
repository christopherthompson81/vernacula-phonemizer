/**
 * Kannada cardinal number → words, Indian grouping (ಸಾವಿರ 10³ / ಲಕ್ಷ 10⁵ / ಕೋಟಿ 10⁷).
 *
 * WHY KANNADA CANNOT USE THE SHARED `indicNumberWords` COMPOSER. Three independent reasons, each of
 * which the shared composer's data schema has no way to express. Measured over the kn_in FLEURS corpus
 * (561 bare numerals): 73 two-digit non-round, 75 three-digit, 146 in the 1000-2999 band.
 *
 *   1. FUSION. Kannada 21-99 is ONE word — ಇಪ್ಪತ್ತೊಂದು, not ಇಪ್ಪತ್ತು ಒಂದು. The shared composer has a
 *      `compound` map for exactly this and it now carries all 72 forms (see kannada.jsonc), so this
 *      reason alone would not need a private composer; the next two do.
 *   2. IRREGULAR ROUND HUNDREDS. 200 is ಇನ್ನೂರು, 300 ಮುನ್ನೂರು, 500 ಐನೂರು, 900 ಒಂಬೈನೂರು — fused and
 *      suppletive. The shared composer writes `units[h] + magnitudes.hundred` unconditionally, so it
 *      read 200 as ಎರಡು ನೂರು and 500 as ಐದು ನೂರು. `NumbersDef.hundreds` exists for the Western
 *      composer but `indicNumberWords` never reads it.
 *   3. COMBINING (oblique) MAGNITUDE FORMS. When a remainder follows, the magnitude takes -ಾ / -ದ:
 *      150 is ನೂರಾ ಐವತ್ತು and 1976 is ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. The shared composer emits the bare
 *      noun in every position, so 1976 came out ಸಾವಿರ ಒಂಬತ್ತು ನೂರು ಎಪ್ಪತ್ತು ಆರು — five words where
 *      Kannada says three, with the wrong hundred and no linkage at all.
 *
 * THIS IS A CORE LIMITATION, NOT A CORE BUG, and it is reported rather than patched: `core/numbers.ts`
 * is shared by 191 languages and #562 forbids editing it from a single language's run. The same shape
 * was found and solved the same way by the Tamil (sandhi fusion) and Telugu (magnitude agreement) runs.
 *
 * EVERY SPELLING IS SOURCED — espeak-ng dictsource/kn_list plus this corpus plus the repo's own kaikki
 * referee; the full provenance note lives at the `numbers` block in kannada.jsonc. espeak is a PHONEME
 * source, so each derived orthography was round-tripped back through this repo's G2P and checked to
 * reproduce espeak's reading before it was written down.
 *
 * YEARS NEED NO SPECIAL RULE. Unlike Telugu (which reads 1976 as "nineteen hundred seventy-six" and had
 * to arbitrate that on audio), the ordinary Kannada cardinal already IS the year reading:
 * ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. No kn_in audio is cached under corpus/audio_cache/data/, so no arbitration
 * was possible here in any case — see the report.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const ONES = N.units,
    TEENS = N.teens,
    TENS = N.tens,
    COMPOUND = N.compound,
    HUNDREDS = N.hundredForms,
    F = N.magnitudeForms;

/** The decimal separator word (espeak kn_list `_dpt`); read by normalize.ts. */
export const DECIMAL_WORD = N.decimalWord;

/** 1-99. Round tens from `tens`, everything else 21-99 from the fused `compound` map. */
function below100(n: number): string[] {
    if (n <= 0) return [];
    if (n < 10) return [ONES[n]!];
    if (n < 20) return [TEENS[n - 10]!];
    if (n % 10 === 0) return [TENS[String(n)]!];
    return [COMPOUND[String(n)]!];
}

/**
 * 1-999. The hundreds are fused and partly suppletive: 1/2/3/5/9 have their own single word, the rest
 * fall back to count + ನೂರು (two words) exactly as espeak's own composer does for the entries its
 * kn_list omits. The form is `combining` whenever a remainder follows.
 */
function below1000(n: number): string[] {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(r);
    const irregular = HUNDREDS[String(h)];
    const head = irregular
        ? [r > 0 ? irregular.combining : irregular.bare]
        : [ONES[h]!, r > 0 ? F.hundred.combining : F.hundred.bare];
    return [...head, ...below100(r)];
}

/** A magnitude group: its count (spelled by below1000) plus the magnitude noun in the right form. */
function group(key: "thousand" | "lakh" | "crore", count: number, hasRemainder: boolean): string[] {
    const mag = hasRemainder ? F[key].combining : F[key].bare;
    // A count of exactly one is NOT spelled: 1000 is ಸಾವಿರ and 1976 is ಸಾವಿರದ …, never *ಒಂದು ಸಾವಿರ.
    return count === 1 ? [mag] : [...below1000(count), mag];
}

/** Non-negative integer → Kannada words, space-separated. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n === 0) return ONES[0]!;
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thou = Math.floor(n / 1000);
    n %= 1000;
    if (crore > 0) parts.push(...group("crore", crore, lakh + thou + n > 0));
    if (lakh > 0) parts.push(...group("lakh", lakh, thou + n > 0));
    if (thou > 0) parts.push(...group("thousand", thou, n > 0));
    parts.push(...below1000(n));
    return parts.join(" ");
}

/**
 * The ORDINAL stem of a cardinal word. Kannada forms an ordinal by attaching ನೇ (or ನೆಯ) to the LAST
 * word of the cardinal after dropping its final -ು, and writes it FUSED. Emitted apart — which is what
 * the corpus's "15 ನೇ" produced before normalize.ts step 4 — ನೇ reaches the G2P as a stray syllable
 * carrying its own primary stress, [nˈeː].
 *
 * The -ು → ∅ rule is not invented: this corpus writes the fused result for thirteen different cardinals
 * — ಎರಡನೇ, ಮೂರನೇ, ನಾಲ್ಕನೇ, ಐದನೇ, ಏಳನೇ, ಒಂಬತ್ತನೇ, ಹತ್ತನೇ, ಹನ್ನೊಂದನೇ, ಹನ್ನೆರಡನೇ, ಹದಿಮೂರನೇ, ಹದಿನಾರನೇ,
 * ಹತ್ತೊಂಬತ್ತನೇ, ಇಪ್ಪತ್ತನೇ — and every one of them is its cardinal minus the final -ು plus ನೇ.
 * A word with no final -ು (ಸಾವಿರ, ಲಕ್ಷ) takes the suffix directly.
 */
export function ordinalStem(word: string): string {
    return word.endsWith("ು") ? word.slice(0, -1) : word;
}

/** N + ನೇ, fused onto the final cardinal word (15ನೇ → ಹದಿನೈದನೇ, 20ನೇ → ಇಪ್ಪತ್ತನೇ). */
export function ordinalToWords(n: number, suffix = "ನೇ"): string {
    const words = numberToWords(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return "";
    words[words.length - 1] = `${ordinalStem(last)}${suffix}`;
    return words.join(" ");
}
