/**
 * Chuvash Roman-numeral reading. A century is an ORDINAL: `XVIII ӗмӗр` is *вун саккӑрмӗш ӗмӗр*; the shared
 * cardinal pass gives *вун саккӑр ӗмӗр*, which means "eighteen centuries". `roman` is **7,191** instances
 * corpus-wide in `tools/corpus/mined/chv.jsonc`, and the retained text writes `XVIII ӗмӗр варринче`,
 * `XIII—XIV ĕмĕрсем хушшинче`, `XX вĕçĕнче — XXI ĕмĕр пуçламăшĕнче`, `XVII ӗмӗр варричен`, `XX ӗмӗрччен`.
 *
 * ⚠ NO SEPARATE ORDINAL TABLE. Chuvash ordinal formation is an invariant `-мӗш` on the full numeral, so
 * this file imports `normalize.ts`'s derivation rather than authoring a second copy — the same division
 * ba and tt use, and the opposite of what the East Slavic policies next door must do, because their
 * -ый/-ое series is suppletive and cannot be derived from the cardinal at all.
 *
 * ⚠ AND THERE IS NO GENDER TO GET WRONG, which is the limitation ru/uk/be each have to record. The
 * remaining limitation is CASE — `XX ӗмӗрччен` wants the terminative, and the ordinal is emitted
 * uninflected while the noun keeps whatever ending the writer typed. That is the right division of labour
 * here: only the last element of a Turkic noun phrase takes the case ending, and that element is the noun.
 *
 * ⚠ A REGNAL NUMBER TAKES THE CARDINAL and is left to the shared pass — `Екатерина II` reads *иккӗ*, which
 * is what the corpus's own sentence wants ("Императрица Екатерина II ҫулхи ноябрьте").
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { ordinalOf } from "./normalize.ts";

/** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
function ordinal(n: number): string | undefined {
    return Number.isInteger(n) && n >= 1 && n <= 100 ? ordinalOf(n) : undefined;
}

/**
 * `ӗмӗр` (century) in the cases the corpus writes — ⚠ AND IN BOTH ENCODINGS, WHICH IS NOT OPTIONAL AND
 * WHICH I FIRST GOT BACKWARDS. `core/roman.ts` runs in `registry.ts` at `romanPass`, and the shared
 * character-level pre-passes — including `foldCyrillicConfusables` — run AFTER it. So this policy sees
 * the text as the writer typed it, with the Latin ⟨ĕ⟩, and a regex written for the folded ⟨ӗ⟩ alone
 * matched nothing: `XVIII ĕмĕр` stayed *вун саккӑр ĕмĕр*, "eighteen centuries", with every gate green
 * over it. The proportions make this the majority case, not an edge: `ĕмĕр` is ×61 in cv.wikipedia and
 * `ӗмӗр` came back **ABSENT** from the same probe.
 *
 * ⚠ AND THAT IS ALSO A CAUTION ABOUT THE INSTRUMENT. `attest.ts` reporting a word ABSENT from a wiki
 * written in the wrong codepoints is a confident negative produced by the very defect under
 * investigation (trap 42's family). The word is on every history page in the language.
 *
 * No event noun is listed: none occurs beside a Roman numeral in the retained text, and a trigger with no
 * attested instance is a misfire generator (trap 9).
 */
const CONTEXT = /^([ӗĕ]м[ӗĕ]р(те|тен|ти|ччен|че|сем|сене|сенче|[ӗĕ]|[ӗĕ]нче|[ӗĕ]н)?)$/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
