/**
 * Spanish number → words (long scale: millón = 10⁶). The words then phonemize through the same g2p as any
 * other word, so digits read like written Spanish. Covers 0 … <10¹².
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in spanish.jsonc; the long-scale compositor is the algorithm.
const N = MANIFEST.numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds,
    SCALES = N.scales;

/** 0 ≤ n < 100 */
function below100(n: number): string {
    if (n < 30) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${N.connector} ${ONES[u]}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
    if (n === 100) return N.hundredExact;
    const h = Math.floor(n / 100),
        r = n % 100;
    const parts: string[] = [];
    if (h) parts.push(HUNDREDS[h]!);
    if (r) parts.push(below100(r));
    return parts.join(" ");
}

/** 1 ≤ n < 10⁶ */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Spanish words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e18)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)]!).join(" ");
    if (n === 0) return ONES[0]!;
    if (n < 1e6) return below1e6(n);
    for (const sc of SCALES) {
        if (n < sc.value) continue;
        const q = Math.floor(n / sc.value),
            r = n % sc.value;
        const head = q === 1 ? sc.one : `${below1e6(q)} ${sc.many}`;
        return r ? `${head} ${numberToWords(r)}` : head;
    }
    return below1e6(n); // unreachable (n ≥ 1e6 matched a scale)
}
