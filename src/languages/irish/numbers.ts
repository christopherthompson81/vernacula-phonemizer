/**
 * Irish number → words (minimal Run-1 stub: 0–10). Irish counting is complex (special counting forms, initial
 * mutation after numerals, the vigesimal traditional system) — a proper compositor is deferred to a later run.
 */
import { MANIFEST } from "./manifest.ts";

const ONES = MANIFEST.numbers.ones;

/** Non-negative integer → Irish words; 0–10 lexical, larger → digit-by-digit for now. */
export function numberToWords(n: number): string {
    if (Number.isSafeInteger(n) && n >= 0 && n <= 10) return ONES[n]!;
    return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
}
