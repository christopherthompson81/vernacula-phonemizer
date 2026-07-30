/**
 * Kirundi cardinal number → words. Kirundi's numeral morphology is the same Rwanda-Rundi system as Kinyarwanda's,
 * so the compositor itself lives in kinyarwanda/numbers.ts (`composeRwandaRundi`) and is shared; only the word
 * table differs, and it lives in kirundi.jsonc. See that module's header for the concord/simplification notes.
 *
 * Kirundi-vs-Kinyarwanda deltas in the table (Omniglot "Numbers in Kirundi", omniglot.com/language/numbers/kirundi.htm;
 * languagesandnumbers.com/how-to-count-in-rundi (run) for the tens/hundreds rule): 7 is indwi (not karindwi),
 * 9 is icenda (Kirundi has no ⟨cy⟩), 20 is the regular mirongo ibiri (not the fused Kinyarwanda makumyabiri),
 * the plural of ijana is amajana (not magana), and 10⁶ is umuriyoni (not miriyoni).
 */
import { composeRwandaRundi } from "../kinyarwanda/numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Non-negative integer (< 10⁹) → Kirundi words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return composeRwandaRundi(n, MANIFEST.numbers);
}
