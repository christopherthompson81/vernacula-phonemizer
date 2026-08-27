/**
 * Kamba / Kĩkamba (kam) cardinal number → words (space-separated; each word then runs through the g2p, so the IPA
 * stays consistent with the word engine). The FORM emitted is the CITATION / COUNTING series — literally the
 * Peace Corps Kikamba manual's kũtala ("to count") list (ĩmwe, ĩlĩ, itatũ …) — not a concord form for some
 * arbitrary noun class: the manual notes that 1–5 take the prefix agreeing with the noun modified, and a bare
 * TTS integer has no such noun.
 *
 * The ALGORITHM is shared with Kikuyu (the same E5x formation) → ../kikuyu/e5xNumbers.ts, where the attested
 * Kikamba strings that pin the "na"-before-the-last-component rule are quoted; the WORDS are data
 * (kamba.jsonc "numbers", with sources + extrapolations cited there).
 */
import { MANIFEST } from "./manifest.ts";
import { renderE5xNumber } from "../kikuyu/e5xNumbers.ts";

/** A non-negative integer → space-separated Kamba cardinal words (10⁹ = milioni ngili ĩmwe, "a thousand million"). */
// ⚠ THE WRAPPER MUST NOT DROP `raw` (#1095) — see kikuyu/numbers.ts.
export function numberToWords(n: number, raw?: string): string {
    return renderE5xNumber(n, MANIFEST.numbers, raw);
}
