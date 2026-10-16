/**
 * Vietnamese cardinal number → words (space-separated syllables). Handles the common sound changes:
 * 5 in a unit slot after a ten → "lăm" (hai mươi lăm), 1 after a ten → "mốt" (hai mươi mốt), a zero tens slot
 * with a nonzero unit → "linh" (một trăm linh năm). Scales by thousands: nghìn / triệu / tỷ.
 */
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in vietnamese.jsonc; the thousands-scale compositor is the algorithm.
const N = MANIFEST.numbers;
const ONES = N.ones,
    SCALES = N.scales;

/** 1 ≤ n < 1000 → words. `lead` = this group is not the most significant (force the hundreds slot). */
function below1000(n: number, lead: boolean): string[] {
    const h = Math.floor(n / 100),
        t = Math.floor((n % 100) / 10),
        u = n % 10;
    const parts: string[] = [];
    if (h > 0 || lead) {
        parts.push(ONES[h]!, N.hundred);
    }
    if (t === 0) {
        if (u > 0 && (h > 0 || lead)) parts.push(N.zeroTens); // 105 → một trăm linh năm
        if (u > 0) parts.push(ONES[u]!);
    } else {
        parts.push(t === 1 ? N.ten : ONES[t]!);
        if (t >= 2) parts.push(N.tensMultiplier);
        if (u === 1 && t >= 2)
            parts.push(N.unitOneAfterTen); // 21 → hai mươi mốt
        else if (u === 5 && t >= 1)
            parts.push(N.unitFiveAfterTen); // 15/25 → mười/hai mươi lăm
        else if (u > 0) parts.push(ONES[u]!);
    }
    return parts;
}

/** 1 ≤ x < 1000^(SCALES.length) → words, one scale word per non-zero thousands group. `lead` = higher digits
 *  precede x, so its most significant group also forces the hundreds slot. */
function belowTop(x: number, lead: boolean): string[] {
    const groups: number[] = [];
    while (x > 0) {
        groups.push(x % 1000);
        x = Math.floor(x / 1000);
    }
    const parts: string[] = [];
    for (let g = groups.length - 1; g >= 0; g--) {
        if (groups[g] === 0) continue;
        parts.push(...below1000(groups[g]!, lead || g < groups.length - 1));
        if (g > 0) parts.push(SCALES[g]!);
    }
    return parts;
}

/**
 * ⚠ ABOVE THE TOP SCALE WORD (tỷ, 10⁹) THE COUNT OF tỷ IS READ AS A NUMBER, then tỷ: 10¹² is *một nghìn tỷ*, 10¹⁵
 * *một triệu tỷ*. Vietnamese has no native word for 10¹², and running text composes this way (FLEURS vi: *hàng
 * nghìn tỷ dặm*, *hàng ngàn tỷ nguyên*). The ladder used to stop at tỷ, and `SCALES[4]` was undefined, which
 * `join` rendered as nothing: `1000000000000` read *một* (#1589).
 */
function wordsOf(x: number, lead: boolean): string[] {
    const top = SCALES.length - 1;
    const big = 1000 ** top;
    if (x < big) return belowTop(x, lead);
    const hi = Math.floor(x / big),
        lo = x % big;
    const parts = [...wordsOf(hi, lead), SCALES[top]!];
    if (lo > 0) parts.push(...belowTop(lo, true));
    return parts;
}

/** Non-negative integer → Vietnamese words. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n === 0) return ONES[0]!;
    return wordsOf(Math.floor(n), false).join(" ");
}
