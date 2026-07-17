/**
 * Hungarian cardinal number → words. Hungarian writes a number as ONE concatenated word (kétszázharmincnégy);
 * the tens 20 use the bound form "huszon-" (huszonegy) and "tíz" the "tizen-" teens; "2" is "két" before a scale
 * (kétszáz, kétezer) but "kettő" standalone/final. Covers 0 … <10⁹ (a space precedes millió/ezer groups only at
 * the millió boundary). Larger / non-finite → digit-by-digit.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100 (one word: huszonegy, harmincnégy). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n < 20) return N.teens[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (t === 2) return u === 0 ? N.tens[2]! : `${N.tensPrefix["20"]}${N.units[u]}`;
    return u === 0 ? N.tens[t]! : `${N.tens[t]}${N.units[u]}`;
}

/** 1 ≤ n < 1000 (kétszázharmincnégy). "2" before száz → "két". */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? N.hundred : `${h === 2 ? "két" : N.units[h]}${N.hundred}`;
    return r ? `${hundred}${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Hungarian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // nulla
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6),
        thg = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (mil) parts.push(`${mil === 1 ? "egy" : below1000(mil)} ${N.million}`);
    // thousands + remainder concatenate into one word (kétezer-…); "2" before ezer → "két".
    let word = "";
    if (thg) word += thg === 1 ? N.thousand : `${thg === 2 ? "két" : below1000(thg)}${N.thousand}`;
    if (r) word += below1000(r);
    if (word) parts.push(word);
    return parts.join(" ");
}
