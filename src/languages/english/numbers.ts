/**
 * English number → spoken words (short scale). Clean reimplementation: digit input becomes the same WORDS
 * a person would type, which then resolve through the lexicon like any other word — so 42 == "forty two"
 * with no fragment-table indirection. Covers 0 … nonillion (bigint). Cardinal + ordinal.
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in english.jsonc; the composition logic below is the algorithm.
const {
    ones: ONES,
    tens: TENS,
    hundred: HUNDRED,
    scale: SCALE,
    ordinals: ORDINAL,
} = MANIFEST.numbers;
// scale is ascending (thousand=10³ … nonillion=10³⁰); GROUPS is descending {value, name} for the greedy loop.
const GROUPS: ReadonlyArray<{ value: bigint; name: string }> = SCALE.map(
    (name, i) => ({
        value: 10n ** BigInt(3 * (i + 1)),
        name,
    }),
).reverse();
const MAX = 10n ** BigInt(3 * (SCALE.length + 1)) - 1n; // nonillion → up to <10³³

/** cardinal words for 0 ≤ n < 1000. */
function below1000(n: number): string[] {
    const out: string[] = [];
    if (n >= 100) {
        out.push(ONES[Math.floor(n / 100)]!, HUNDRED);
        n %= 100;
    }
    if (n >= 20) {
        out.push(TENS[Math.floor(n / 10)]!);
        if (n % 10) out.push(ONES[n % 10]!);
    } else if (n > 0) out.push(ONES[n]!);
    return out;
}

/** Cardinal number → words. `1234` → ["one","thousand","two","hundred","thirty","four"]. */
export function numberToWords(n: bigint): string[] {
    if (n < 0n || n > MAX) return [String(n)];
    if (n === 0n) return ["zero"];
    const out: string[] = [];
    for (const g of GROUPS) {
        if (n >= g.value) {
            out.push(...below1000(Number(n / g.value)), g.name);
            n %= g.value;
        }
    }
    if (n > 0n) out.push(...below1000(Number(n)));
    return out;
}

/** Ordinal number → words (English marks only the LAST word: `21` → ["twenty","first"]). */
export function ordinalToWords(n: bigint): string[] {
    const words = numberToWords(n);
    const last = words[words.length - 1];
    if (last !== undefined && ORDINAL[last] !== undefined)
        words[words.length - 1] = ORDINAL[last]!;
    return words;
}
