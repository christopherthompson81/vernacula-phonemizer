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
/** The nouns that license an ordinal reading. Written CASE-SENSITIVELY, with both initial cases spelled
 *  out, because `ordinalAfter` below must also test for a capitalised word and `\p{Lu}` under the `i`
 *  flag matches lowercase too — case-insensitive matching case-folds property escapes, so the two cannot
 *  share one pattern and JavaScript has no inline modifier to scope the flag. */
const NOUNS = ["század", "évszázad", "évezred", "évfordul", "kerület", "kongresszus", "fejezet",
    "olimpi", "világháború"];
const bothCases = (w: string): string => `[${w[0]!.toUpperCase()}${w[0]!}]${w.slice(1)}`;
const NOUN_ALT = NOUNS.map(bothCases).join("|");
const CONTEXT = new RegExp(`^(?:${NOUN_ALT})`, "u");

/**
 * THE REGNAL PATTERN IS STILL NOT COVERED, and the attempt has now been made TWICE, for two different
 * reasons. Recorded properly so it is not tried a third time.
 *
 * `II. Erzsébet` / `XVI. Lajos` are *második Erzsébet* / *tizenhatodik Lajos* — 3 instances in hu_hu,
 * read as cardinals today — and the obvious licenser is "the FOLLOWING word is capitalised".
 *
 * FIRST ATTEMPT broke `A JAS 39C Gripen`: an ordinal context licenses a single-letter numeral, so the `C`
 * of `39C` became *századik*. That cause is now fixed in core/roman.ts, which refuses any candidate glued
 * to a digit — generally true of Roman numerals, not a Hungarian concern.
 *
 * SECOND ATTEMPT, with that fixed, broke something else: `D K Arya főfelügyelő-helyettes` read as
 * *ötszázadik K Arya*. `D` is Roman 500, all-caps, and followed by a capitalised word — which is
 * indistinguishable from a regnal numeral by the licenser alone, because those are PERSONAL INITIALS.
 *
 * The real discriminator is the PERIOD: a regnal ordinal is written `I. István`, initials are `D K Arya`.
 * `RomanPolicy` gets the next WORD, with punctuation already stripped, so it cannot see the period and
 * cannot express the rule. A minimum-numeral-length constraint would not help either — Hungarian regnal
 * names are routinely single letters (I. István, V. László, X. Leó).
 *
 * 3 gained against 1 confidently-wrong loss, twice over. Not a trade worth taking.
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
