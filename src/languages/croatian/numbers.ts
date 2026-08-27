/**
 * Croatian cardinal number → words. Reuses the shared Serbo-Croatian agreement compositor (serbian/numbers.ts
 * composeSlavicNumber) with the CROATIAN number-word table (tisuća/milijun/dvjesto vs the Serbian hiljada/milion/
 * dvesta). Each word is phonemized downstream through the shared g2p.
 */
import { composeSlavicNumber } from "../serbian/numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Non-negative integer (< 10⁹) → Croatian words; larger / non-finite → digit-by-digit.
 *  ⚠ `raw` IS THE TOKEN STRING AND THE CALLER MUST PASS IT (#1059): the digit-by-digit fallback cannot
 *  recover the digits from `n`, which is a double — above 2^53 it has rounded, and above 1e21 `String(n)`
 *  is exponent form (`"1e+21"`), whose `e` and `+` are undefined table lookups joined as empty strings.
 *  ⚠ AND IT IS THE SEPARATOR-STRIPPED STRING, NOT THE RAW MATCH: Croatian's number token carries the
 *  thousands PERIODS and the decimal COMMA, and croatian.ts strips both before `Number()`. Handing the
 *  match itself would spell the separators out among the digits. */
export function numberToWords(n: number, raw?: string): string {
    return composeSlavicNumber(n, MANIFEST.numbers, raw);
}
