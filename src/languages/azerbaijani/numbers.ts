/**
 * Azerbaijani cardinal number → words (space-separated). Like Turkish, it scales by thousands (on/yüz/min/milyon/…)
 * and drops "bir" before yüz and min (100 → yüz, 1000 → min) but keeps it before milyon+ (bir milyon).
 * 1985 → min doqquz yüz səksən beş.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const ONES = N.ones,
    TENS = N.tens,
    SCALES = N.scales;

/** 1 ≤ n < 1000 → words. */
function below1000(n: number): string[] {
    const parts: string[] = [];
    const h = Math.floor(n / 100),
        t = Math.floor((n % 100) / 10),
        o = n % 10;
    if (h > 0) {
        if (h > 1) parts.push(ONES[h]!);
        parts.push(N.hundred);
    } // "yüz", not "bir yüz"
    if (t > 0) parts.push(TENS[t]!);
    if (o > 0) parts.push(ONES[o]!);
    return parts;
}

/** Little-endian thousands groups (groups[g] multiplies 10³ᵍ) → words; "" when there are more groups than
 *  scale words. */
function composeGroups(groups: number[]): string {
    if (groups.length > SCALES.length) return "";
    const parts: string[] = [];
    for (let g = groups.length - 1; g >= 0; g--) {
        const v = groups[g]!;
        if (v === 0) continue;
        if (g === 1 && v === 1) {
            parts.push(SCALES[1]!);
            continue;
        } // "min", not "bir min"
        parts.push(...below1000(v));
        if (g > 0) parts.push(SCALES[g]!);
    }
    return parts.join(" ");
}

/** Non-negative integer → Azerbaijani words. "" for a number past 2⁵³, whose low digits the double has already
 *  lost: a written numeral goes through `digitsToWords`, which keeps every digit (#1576). */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    const x = Math.floor(n);
    if (!Number.isSafeInteger(x)) return "";
    if (x === 0) return N.zero;
    const groups: number[] = [];
    for (let y = x; y > 0; y = Math.floor(y / 1000)) groups.push(y % 1000);
    return composeGroups(groups);
}

/**
 * A written digit string → Azerbaijani words, grouped from the STRING rather than from `Number(digits)` — the
 * shape tr's #1523 gave Turkish. ⚠ Past 2⁵³ a double no longer holds every digit, so `Number(digits)` was already
 * a different number before any word was chosen (`12345678901234567890` ended *… yeddi sıfır sıfır sıfır*), and
 * from 10²¹ `String(n)` is exponent notation, which the old digit fallback read as *bir sıfır sıfır iki bir*
 * ("1e+21"). A numeral with more groups than there are scale words (10¹⁸ and up) is read digit by digit.
 */
export function digitsToWords(digits: string): string {
    const d = digits.replace(/^0+(?=\d)/u, "");
    if (d === "0") return N.zero;
    const groups: number[] = [];
    for (let end = d.length; end > 0; end -= 3) groups.push(Number(d.slice(Math.max(0, end - 3), end)));
    if (groups.length > SCALES.length) return [...d].map((c) => (c === "0" ? N.zero : ONES[Number(c)]!)).join(" ");
    return composeGroups(groups);
}
