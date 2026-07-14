/**
 * Welsh number → words (minimal Run-1 stub: 0–10). Welsh counting is complex (vigesimal traditional forms,
 * feminine variants, initial mutations after numerals) — a proper compositor is a later phase.
 */
import { MANIFEST } from "./manifest.ts";

const ONES = MANIFEST.numbers.ones;

/** Non-negative integer → Welsh words; 0–10 lexical, larger → digit-by-digit for now. */
export function numberToWords(n: number): string {
    if (Number.isSafeInteger(n) && n >= 0 && n <= 10) return ONES[n]!;
    return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
}
