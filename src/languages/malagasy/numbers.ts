/**
 * Malagasy cardinal number → words. Malagasy composes UNITS-FIRST (smallest part first) joined by "amby" (over):
 * 21 → iraika amby roapolo, 234 → efatra amby telopolo amby roanjato. The unit 1 is "iray" alone but "iraika" in
 * a compound. Covers 0 … <10⁶; the higher joins use the same amby chaining. This is a broad compositor — Malagasy
 * number sandhi has finer detail this does not model.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS, hundreds: HUNDREDS } = N;

/** ones word, with the compound allomorph iraika for 1 (iray only stands alone). */
function ones1(o: number, compound: boolean): string {
    return compound && o === 1 ? "iraika" : ONES[o]!;
}

/** 1 ≤ n < 100. */
function below100(n: number, compound = false): string {
    if (n < 10) return ones1(n, compound);
    const t = Math.floor(n / 10),
        o = n % 10;
    if (o === 0) return TENS[t]!;
    return `${ones1(o, true)} ${N.connector} ${TENS[t]}`; // units-first: iraika amby roapolo
}

/** 1 ≤ n < 1000. */
function below1000(n: number, compound = false): string {
    if (n < 100) return below100(n, compound);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${below100(r, true)} ${N.connector} ${HUNDREDS[h]}` : HUNDREDS[h]!;
}

/** Non-negative integer (< 10⁹) → Malagasy words; larger / non-finite → digit-by-digit. Units-first "amby"
 *  chaining across the arivo (10³) and tapitrisa (10⁶) scales.
 *
 *  `compound` is the same allomorph flag the two helpers take, threaded through the RECURSION: the
 *  tapitrisa branch reads its remainder with this function, and that remainder sits in an `amby` compound
 *  exactly as the arivo branch's does. Without it 1 000 001 read *iray amby iray tapitrisa* while 1 001
 *  read *iraika amby arivo* — the same slot, two different unit words. */
export function numberToWords(n: number, compound = false, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[Number(d)] || N.zero).join(" ");
    if (n === 0) return N.zero;
    if (n < 1000) return below1000(n, compound);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
        return r ? `${below1000(r, true)} ${N.connector} ${thousand}` : thousand;
    }
    // Millions and up: read the million group + the remainder, units-first (remainder amby million-part).
    const mil = Math.floor(n / 1e6),
        r = n % 1e6;
    const million = `${below1000(mil)} ${N.million}`; // iray tapitrisa, roa tapitrisa, …
    return r ? `${numberToWords(r, true)} ${N.connector} ${million}` : million;
}
