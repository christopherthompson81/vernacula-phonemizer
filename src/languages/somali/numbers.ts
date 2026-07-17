/**
 * Somali cardinal number → words. Somali joins with "iyo" (and): within 1-99 it is units-FIRST (21 → kow iyo
 * labaatan), while hundreds/thousands come first (234 → laba boqol iyo afar iyo soddon). Covers 0 … <10⁶.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS } = N;

/** 1 ≤ n < 100 (units-first: kow iyo labaatan). */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    const t = Math.floor(n / 10),
        o = n % 10;
    if (o === 0) return TENS[t]!;
    return `${ONES[o]} ${N.connector} ${TENS[t]}`;
}

/** 1 ≤ n < 1000 (hundreds first: laba boqol iyo …). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? N.hundred : `${ONES[h]} ${N.hundred}`;
    return r ? `${hundred} ${N.connector} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Somali words; larger / non-finite → digit-by-digit. Chains kun (10³) and
 *  malyuun (10⁶) with the "iyo" connector, largest-first. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // eber
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
        return r ? `${thousand} ${N.connector} ${below1000(r)}` : thousand;
    }
    const mil = Math.floor(n / 1e6),
        r = n % 1e6;
    const million = `${below1000(mil)} ${N.million}`; // kow malyuun, laba malyuun, …
    return r ? `${million} ${N.connector} ${numberToWords(r)}` : million;
}
