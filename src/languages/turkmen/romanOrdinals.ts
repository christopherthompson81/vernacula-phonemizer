/**
 * Turkmen Roman-numeral reading. A century is an ORDINAL: `XX asyr` is *ýigriminji asyr*; the shared
 * cardinal pass gives *ýigrimi asyr*, which means "twenty centuries". `roman` is **1,695** instances
 * corpus-wide in `tools/corpus/mined/tk.jsonc`, and the retained text writes `B.e.ö. VI asyrda`,
 * `B.e. öňki III asyryň ikinji ýarymynda`, `XX asyr`, `XIX asyryň`.
 *
 * ⚠ NO SEPARATE ORDINAL TABLE. Turkmen ordinal formation is regular and `normalize.ts` already derives
 * it, so this file imports that function rather than authoring a second copy — the same division ba, tt
 * and chv use, and the opposite of what the East Slavic policies must do, because their -ый/-ое series is
 * suppletive and cannot be derived from the cardinal at all.
 *
 * ⚠ AND THE BACKNESS HAS TO BE DECIDED HERE, WHICH IS THE ONE THING THAT IS NOT FREE. `ordinalOf` takes
 * the choice from the suffix the WRITER typed — that is the whole point of the Basque finding — and a
 * Roman numeral has no written suffix. So the policy has to derive it, and Turkmen's rule is the ordinary
 * one: the suffix harmonises with the last vowel of the numeral's final word. `üç` → *üçünji*, `alty` →
 * *altynjy*. The helper below reads that vowel and passes the answer in.
 *
 * There is no gender to get wrong, and the remaining limitation is CASE — `XIX asyryň` wants the
 * genitive, and the ordinal is emitted uninflected while the noun keeps whatever ending the writer typed.
 * That is the right division of labour: only the last element of a Turkic noun phrase takes the case
 * ending, and that element is the noun.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { ordinalOf } from "./normalize.ts";
import { numberToWords } from "./numbers.ts";

const FRONT = "äeiöü";
const VOWELS = "aäeioöuüy";

/** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    const words = numberToWords(n);
    const last = words[words.length - 1];
    if (last === undefined) return undefined;
    const vowels = [...last].filter((c) => VOWELS.includes(c));
    const v = vowels[vowels.length - 1];
    if (v === undefined) return undefined;
    return ordinalOf(n, FRONT.includes(v));
}

/**
 * `asyr` (century) in the cases the corpus writes. ⚠ `ýyl` (year) is NOT here: a Roman numeral beside a
 * year would be a regnal or volume number, and this corpus writes its years in digits. No event noun is
 * listed either — none occurs beside a Roman numeral in the retained text, and a trigger with no attested
 * instance is a misfire generator (trap 9).
 */
const CONTEXT = /^(asyr(yň|da|dan|a|y|lar|laryň|larda|lardan)?)$/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
