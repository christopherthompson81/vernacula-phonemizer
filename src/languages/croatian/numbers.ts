/**
 * Croatian cardinal number → words. Reuses the shared Serbo-Croatian agreement compositor (serbian/numbers.ts
 * composeSlavicNumber) with the CROATIAN number-word table (tisuća/milijun/dvjesto vs the Serbian hiljada/milion/
 * dvesta). Each word is phonemized downstream through the shared g2p.
 */
import { composeSlavicNumber } from "../serbian/numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Non-negative integer (< 10⁹) → Croatian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return composeSlavicNumber(n, MANIFEST.numbers);
}
