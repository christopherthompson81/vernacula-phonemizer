/**
 * Xhosa (xh) cardinal number compositor — agglutinative Nguni, the same algorithm as Zulu (units 1–5 have
 * standalone ku-/connective na-/multiplier ama- stems; 6–9 are isi- nouns; tens/hundreds/thousands are noun
 * classes with an ama-/izi- multiplier), reading the Xhosa number words (2 = -bini, 6–9 differ from Zulu).
 * Returns space-separated Xhosa TEXT; the phonemizer runs each word through the shared g2p.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const KU = N.ku,
    NA = N.na,
    AMA = N.ama;

/**
 * Read a digit STRING one digit at a time, in the standalone counting stems — the same reading
 * `normalize.ts`'s `spell()` already gives a decimal's fractional part, and for the same reason: `34` read as
 * a number is *amashumi amathathu nane*, a different quantity. ⚠ `KU[0]` is the empty string (there is no
 * `ku-` form of zero), so the zero word is taken from the manifest directly.
 */
function readDigits(digits: string): string {
    return [...digits].map((d) => (d === "0" ? N.zero : (KU[digitIndex(d)] ?? d))).join(" ");
}

/**
 * A non-negative integer → space-separated Xhosa cardinal words.
 *
 * ⚠ ABOVE 2⁵³ THE DOUBLE IS NO LONGER THE NUMBER, so the compositor is handed digits it does not have.
 * It has no ceiling of its own — it recurses through `izigidi` multipliers forever — so it composed right
 * past the rounding and `1000000000000000000001` and `…009` both read *izigidi izigidi izigidi iwaka*
 * (#1059's "no fallback at all" class). `raw` is the TOKEN STRING the caller matched, which still has every
 * digit; above the safe range the digits are read one at a time. ⚠ The caller must pass the
 * SEPARATOR-STRIPPED string — for xh it is, by construction: step 4 of `normalize.ts` removes the grouping
 * commas and spaces from the text, so the tokenizer's `\d+` match is already separator-free.
 */
export function numberToWords(n: number, raw?: string): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return N.zero;
    if (!Number.isSafeInteger(n)) return readDigits(raw ?? String(n));
    if (n >= 1000000) {
        const m = Math.floor(n / 1000000),
            rem = n % 1000000;
        const mil = m === 1 ? N.million.one : `${N.million.many} ${AMA[m] ?? numberToWords(m)}`;
        return rem ? `${mil} ${numberToWords(rem)}` : mil;
    }
    const parts: string[] = [];
    const th = Math.floor(n / 1000),
        h = Math.floor((n % 1000) / 100),
        t = Math.floor((n % 100) / 10),
        u = n % 10;
    if (th === 1) parts.push(N.thousand.one);
    else if (th >= 2) parts.push(N.thousand.many, AMA[th] ?? numberToWords(th));
    if (h === 1) parts.push(N.hundred.one);
    else if (h >= 2) parts.push(N.hundred.many, AMA[h]!);
    if (t === 1) parts.push(N.ten.one);
    else if (t >= 2) parts.push(N.ten.many, AMA[t]!);
    if (u > 0) parts.push(parts.length === 0 ? KU[u]! : NA[u]!);
    return parts.join(" ");
}
