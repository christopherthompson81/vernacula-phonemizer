/**
 * Bosnian cardinal number → words. Reuses the shared Serbo-Croatian agreement compositor (serbian/numbers.ts
 * composeSlavicNumber) with the BOSNIAN number-word table (Serbian hiljada/milion + the ijekavian dvjesta). Each word
 * is phonemized downstream through the shared g2p.
 */
import { composeSlavicNumber } from "../serbian/numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Non-negative integer (< 10⁹) → Bosnian words; larger / non-finite → digit-by-digit.
 *  ⚠ `raw` IS THE TOKEN STRING AND THE CALLER MUST PASS IT (#1059): the digit-by-digit fallback cannot
 *  recover the digits from `n`, which is a double — above 2^53 it has rounded, and above 1e21 `String(n)`
 *  is exponent form (`"1e+21"`), whose `e` and `+` are undefined table lookups joined as empty strings. */
export function numberToWords(n: number, raw?: string): string {
    return composeSlavicNumber(n, MANIFEST.numbers, raw);
}
