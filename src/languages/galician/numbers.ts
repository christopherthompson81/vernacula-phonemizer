/**
 * Galician number → words (standard RAG cardinals). The words then phonemize through the same g2p as any other
 * word, so digits read like written Galician. Covers 0 … <10⁹. Tens juxtapose with the connector "e"
 * (vinte e un, trinta e dous — Galician has no compound single-word 21–29, unlike Spanish veintiuno).
 */

import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** 0 ≤ n < 100. 0..19 are single words; 20+ join tens + units with "e" (vinte e un). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${N.connector} ${ONES[u]}`;
}

/** 1 ≤ n < 1000. Exactly 100 = cen; else cento/-centos + remainder. */
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

/** Non-negative integer → Galician words (long scale: millón = 10⁶, billón = 10¹²; 10⁹ = "mil millóns").
 *  Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e18)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!;
    if (n < 1e6) return below1e6(n);
    if (n < 1e12) {
        // 10⁶ … <10¹²: the millóns band. 10⁹ falls out naturally as "mil millóns" (below1e6(1000) = "mil").
        const mil = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = mil === 1 ? N.million.one : `${below1e6(mil)} ${N.million.many}`;
        return r ? `${head} ${numberToWords(r)}` : head;
    }
    // 10¹² … <10¹⁸: the billóns band (long scale).
    const bil = Math.floor(n / 1e12),
        r = n % 1e12;
    const head = bil === 1 ? N.billion.one : `${below1e6(bil)} ${N.billion.many}`;
    return r ? `${head} ${numberToWords(r)}` : head;
}
