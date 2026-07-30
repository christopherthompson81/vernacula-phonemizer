/**
 * Hungarian Roman-numeral reading. A century is read as an ORDINAL: `XIX. század` is *tizenkilencedik század*;
 * the cardinal *tizenkilenc század* would mean "nineteen centuries". Sources: Hungarian orthography — a Roman
 * numeral followed by a PERIOD is itself the ordinal marker (the period is what "th" is in English), so
 * `XIX.` = *tizenkilencedik*; the spelled form is attested as a book title ("A tizenkilencedik század
 * története", Magyar századok series).
 *
 * FORM: Hungarian has no gender or adjectival case agreement, so the single form *-dik* is unconditionally
 * correct for every context — century, district, congress, anniversary, regnal name alike. This is the only
 * language in this group with no agreement limitation to declare.
 *
 * THE PERIOD, which sits between the numeral and the context word (`XIX. század`):
 *  - Matching is unaffected: the shared pass looks at the next WORD, skipping intervening non-letters, so
 *    `század` is still seen and the ordinal fires.
 *  - The period itself used to SURVIVE into the output as a clause pause — `tizenkilencedik . ˈsaːzɒd`. That
 *    is now consumed by the Hungarian-side pre-pass this file previously said it would take: step 9d of
 *    normalize.ts drops a period between an ordinal word and a following LOWERCASE word, which is safe
 *    because Hungarian starts sentences with a capital.
 *
 * ORDINAL FORMATION lives in numbers.ts (`ordinalWords`), shared with normalize.ts — Hungarian writes the
 * ARABIC ordinal the same way (`19. század`), so the same morphology serves both and neither has a range
 * cap: the ordinal is the cardinal with its final morph replaced (*kétszáznegyvenhetedik*, *ezredik*).
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { ordinalWords } from "./numbers.ts";

/**
 * Hungarian is agglutinative, so the context patterns are UNANCHORED at the end: `század` also matches
 * században, századi, századtól, századok, századokban. Covered: (év)század, évezred, évforduló, kerület
 * (Budapest districts — "XIII. kerület" is one of the highest-frequency ordinal Romans in Hungarian text),
 * kongresszus, fejezet, olimpia, világháború (`az I. és a II. világháború` ×3 in the hu_hu corpus).
 */
const CONTEXT = /^((év)?század|évezred|évfordul|kerület|kongresszus|fejezet|olimpi|világháború)/iu;

/**
 * THE REGNAL PATTERN IS NOT COVERED, and the attempt is recorded because it looked safe and was not.
 * `II. Erzsébet` / `XVI. Lajos` are *második Erzsébet* / *tizenhatodik Lajos* (3 instances in the hu_hu
 * corpus, all read as cardinals today), and the obvious licenser is "the FOLLOWING word is capitalised".
 * Adding `^\p{Lu}` to `ordinalAfter` does fix those three — and breaks `A JAS 39C Gripen`, because an
 * ordinal context also LICENSES a single-letter numeral in core/roman.ts, so the `C` of `39C` became
 * *századik*. `RomanPolicy` cannot see that the letter is glued to digits, and cannot ask for a minimum
 * numeral length, so there is no way to express the regnal rule here without that cost. 3 gained against
 * 1 confidently-wrong loss is not a trade worth taking; reported rather than worked around.
 */

/** Integer → Hungarian ordinal (see numbers.ts). Named locally so the policy's shape stays readable. */
const ordinal = (n: number): string | undefined => (n >= 1 ? ordinalWords(n) : undefined);

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
