/**
 * Kikuyu / Gĩkũyũ (ki) cardinal number → words (space-separated; each word then runs through the g2p, so the IPA
 * stays consistent with the word engine). The FORM emitted is the CITATION / COUNTING series (ĩmwe, igĩrĩ,
 * ithatũ …) — the shape used counting aloud with no noun present; the adjectival concord forms of 1–5 are
 * contextual and a bare TTS integer has no noun to agree with.
 *
 * The ALGORITHM is shared with Kamba (the same E5x formation) → e5xNumbers.ts; the WORDS are data (kikuyu.jsonc
 * "numbers", where the sources and the extrapolations are cited).
 */
import { MANIFEST } from "./manifest.ts";
import { renderE5xNumber } from "./e5xNumbers.ts";

/** A non-negative integer → space-separated Kikuyu cardinal words (10⁹ = mĩrioni ngiri ĩmwe, "a thousand million"). */
export function numberToWords(n: number): string {
    return renderE5xNumber(n, MANIFEST.numbers);
}
