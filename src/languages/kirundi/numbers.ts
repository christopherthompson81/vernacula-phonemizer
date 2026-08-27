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

/**
 * Non-negative integer (< 10⁹) → Kirundi words; larger / non-finite → digit-by-digit.
 *
 * ⚠ `raw` IS THE TOKEN TEXT, AND THE FALLBACK IS WRONG WITHOUT IT (#1075). The digit-at-a-time fallback
 * exists precisely BECAUSE the double cannot be trusted above 2^53 — so recovering the digits by
 * re-stringifying that same double reads a different quantity: `9007199254740993` came out …*ibiri* (992,
 * its neighbour's answer). A confidently wrong number, not a drop; the sentence still scans, which is why
 * no leak gate and no referee ever named it.
 *
 * ⚠ FOUND IN rw AND FIXED THERE FIRST (#1074), then reported rather than copied — a sibling is a hypothesis,
 * not a source (trap 55). What made it rn's defect too is that the compositor is genuinely SHARED
 * (`composeRwandaRundi` already took `raw`); only this wrapper and its one call site dropped it.
 */
export function numberToWords(n: number, raw?: string): string {
    return composeRwandaRundi(n, MANIFEST.numbers, raw);
}
