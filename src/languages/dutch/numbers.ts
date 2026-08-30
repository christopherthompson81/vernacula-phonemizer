/**
 * Dutch number → words (cardinals). Dutch writes numbers as single compound words with units before tens joined
 * by -en- (eenentwintig); a trema marks the connector after a vowel-final unit (tweeëntwintig, drieëntwintig).
 * Output is space-separated at the thousand/million boundaries so each chunk reads through the g2p; within a
 * chunk it stays compounded. Covers 0 … <10¹².
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS } = N;

/** The -en- connector, with a trema on ⟨e⟩ after a vowel-final unit (twee→tweeën, drie→drieën). */
function connect(unit: string): string {
    return /[aeiou]$/.test(unit) ? N.connectorTrema : N.connector;
}

/** 1 ≤ n < 100 (compounded: eenentwintig, tweeëntwintig). */
function below100(n: number): string {
    if (n < 20) return ONES[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return TENS[t]!;
    return `${ONES[u]}${connect(ONES[u]!)}${TENS[t]}`;
}

/** 1 ≤ n < 1000 (honderd, tweehonderddrieëntwintig). Dutch 100 = honderd (no leading een). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = `${h === 1 ? "" : ONES[h]}${N.hundred}`;
    return r ? `${hundred}${below100(r)}` : hundred;
}

/** Non-negative integer (< 10¹²) → Dutch words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // nul
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    const mrd = Math.floor(n / 1e9),
        mil = Math.floor((n % 1e9) / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    // miljard / miljoen stay separate words; thousands compound onto their group (tweeduizend, honderdduizend).
    if (mrd) parts.push(mrd === 1 ? N.milliard.sg : `${below1000(mrd)} ${N.milliard.pl}`);
    if (mil) parts.push(mil === 1 ? N.million.sg : `${below1000(mil)} ${N.million.pl}`);
    if (th) parts.push(`${th === 1 ? "" : below1000(th)}${N.thousand}`);
    if (r) parts.push(below1000(r));
    return parts.join(" ");
}
