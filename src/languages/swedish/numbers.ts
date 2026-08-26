/**
 * Swedish number → words (cardinals). Swedish compounds tens-first (tjugoett = 21, trettiotvå = 32) as a single
 * word, and splits at the thousand/million boundaries so each chunk reads through the g2p. Covers 0 … <10⁹.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS } = N;

/** 1 ≤ n < 100 (compounded, tens-first: tjugoett). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]}${ONES[u]}`;
}

/** 1 ≤ n < 1000 (etthundra­tjugotre). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = `${ONES[h]}${N.hundred}`; // etthundra, tvåhundra
    return r ? `${hundred}${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Swedish words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // noll
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (mil) parts.push(mil === 1 ? N.million.sg : `${below1000(mil)} ${N.million.pl}`);
    if (th) {
        const t = below1000(th); // ett+tusen elides to ettusen (tjugoett+tusen → tjugoettusen)
        parts.push((t.endsWith("ett") ? t.slice(0, -1) : t) + N.thousand);
    }
    if (r) parts.push(below1000(r));
    return parts.join(" ");
}
