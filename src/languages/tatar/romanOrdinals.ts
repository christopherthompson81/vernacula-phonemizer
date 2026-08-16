/**
 * Tatar Roman-numeral reading. A century is an ORDINAL: `XX гасыр` is *егерменче гасыр*; the shared
 * cardinal pass gives *егерме гасыр*, which means "twenty centuries". `roman` is **18,850** instances
 * corpus-wide in `tools/corpus/mined/tt.jsonc`, and the retained text writes `XXI век`, `VIII—III
 * гасырларда`, `IX—X гасырларда`, `VII гасыр азагында`, `IV гасырдан`.
 *
 * ⚠ THIS POLICY IS NOT INFERRED — tt.wikipedia SPELLS THE READING OUT, in the title of every century
 * article: "**XL (кырыгынчы) гасыр** — безнең эрага кадәр 3901 елдан…" and "**VI (алтынчы) гасыр** —
 * безнең эрага кадәр 501 елдан…". The Roman numeral and its ordinal stand in one sentence, so the
 * trigger noun, the ordinal form and the century sense are all attested together. The `XL` instance is
 * also the corpus's own confirmation of the ⟨к⟩→⟨г⟩ lenition that `normalize.ts` derives (*кырыгынчы*,
 * not *кырыкынчы*).
 *
 * ⚠ NO SEPARATE ORDINAL TABLE. Turkic ordinal formation is regular and `normalize.ts` already derives it
 * from vowel harmony, so this file imports that function rather than authoring a second copy — the same
 * division ba uses, and the opposite of what the East Slavic policies next door must do, because their
 * -ый/-ое series is suppletive and cannot be derived from the cardinal at all.
 *
 * ⚠ AND THERE IS NO GENDER TO GET WRONG, which is the limitation ru/uk/be each have to record: Tatar has
 * no grammatical gender and its ordinal is invariant before any noun. The remaining limitation is CASE —
 * `IV гасырдан` wants the ablative, and the ordinal is emitted uninflected while the noun keeps whatever
 * ending the writer typed. That is the right division of labour: only the last element of a Turkic noun
 * phrase takes the case ending, and that element is the noun.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { ordinalOf } from "./normalize.ts";

/** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
function ordinal(n: number): string | undefined {
    return Number.isInteger(n) && n >= 1 && n <= 100 ? ordinalOf(n) : undefined;
}

/**
 * `гасыр` (century) in the cases the corpus writes, plus `йөзьеллык`, the native synonym its own article
 * gives ("Гасыр (йөзъеллык) — 100 елга тиң булган вакытны үлчәү берәмлеге"). ⚠ Russian `век` is NOT here
 * even though the retained text contains it: every instance is inside a Russian-language citation
 * ("Химия и жизнь — XXI век"), where a Tatar ordinal would be the wrong language, not merely the wrong
 * word. A regnal number (`Александр III`, `Елизавета II`) takes the CARDINAL and is left to the shared
 * pass — no event noun is listed, because none occurs beside a Roman numeral here and a trigger with no
 * attested instance is a misfire generator (trap 9).
 */
const CONTEXT = /^(гасыр(да|дан|ның|га|ны|лар|ларда|лардан|ларның)?|йөз[ьъ]еллык(та|тан|ның|ка)?)$/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
