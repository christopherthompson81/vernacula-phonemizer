/**
 * Catalan number → words (cardinals, masculine). Emits SPACE-separated words so each reads through the g2p
 * (the orthographic hyphens of vint-i-un / dos-cents are dropped to spaces). Covers 0 … <10⁹.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS, hundreds: HUNDREDS } = N;

/** 1 ≤ n < 100. 20s take the -i- connector (vint-i-un); 30–90 juxtapose (trenta-un). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10), u = n % 10;
    if (u === 0) return TENS[t]!;
    const conn = t === 2 ? " i " : " "; // vint i un; trenta un
    return `${TENS[t]}${conn}${ONES[u]}`;
}

/** 1 ≤ n < 1000. cent / dos-cents … + remainder. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const hundred = HUNDREDS[h]!;
    return r ? `${hundred} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Catalan words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // zero
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (mil) parts.push(mil === 1 ? N.million.sg : `${below1000(mil)} ${N.million.pl}`);
    if (th) parts.push(th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`); // mil, dos mil
    if (r) parts.push(below1000(r));
    return parts.join(" ");
}
