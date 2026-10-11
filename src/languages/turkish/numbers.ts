/**
 * Turkish cardinal number → words (space-separated). Turkish scales by thousands: on/yüz/bin/milyon/…
 * "bir" is dropped before yüz and bin (100 → yüz, 1000 → bin) but kept before milyon+ (bir milyon).
 * 1985 → bin dokuz yüz seksen beş.
 */
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in turkish.jsonc; the thousands-scale compositor is the algorithm.
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
        } // "bin", not "bir bin"
        parts.push(...below1000(v));
        if (g > 0) parts.push(SCALES[g]!);
    }
    return parts.join(" ");
}

/** Non-negative integer → Turkish words. "" past the largest scale word (10³⁶ and up), which no caller that
 *  reads text reaches: a written numeral goes through `digitsToWords`, which keeps every digit. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n === 0) return N.zero;
    const groups: number[] = [];
    let x = Math.floor(n);
    while (x > 0) {
        groups.push(x % 1000);
        x = Math.floor(x / 1000);
    }
    return composeGroups(groups);
}

/**
 * A written digit string → Turkish words, grouped from the STRING rather than from `Number(digits)`.
 * ⚠ THE NUMBER PATH CANNOT READ A LONG NUMERAL. Past 2⁵³ a double no longer holds every digit, so
 * `Number("1234567890123456789012")` is already a different number before any word is chosen. Grouping the
 * digits by threes keeps them exact. A numeral with more groups than there are scale words (10³⁶ and up) is
 * read digit by digit, so no group is ever spoken without its scale word — before #1523 the list stopped at
 * katrilyon and `1000000000000000000000` read *bir*.
 */
export function digitsToWords(digits: string): string {
    const d = digits.replace(/^0+(?=\d)/u, "");
    if (d === "0") return N.zero;
    const groups: number[] = [];
    for (let end = d.length; end > 0; end -= 3) groups.push(Number(d.slice(Math.max(0, end - 3), end)));
    if (groups.length > SCALES.length) return [...d].map((c) => (c === "0" ? N.zero : ONES[Number(c)]!)).join(" ");
    return composeGroups(groups);
}
