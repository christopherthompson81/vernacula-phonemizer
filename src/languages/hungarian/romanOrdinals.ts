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
 * THE REGNAL PATTERN, covered on the third attempt. `II. Erzsébet` / `XVI. Lajos` are *második Erzsébet* /
 * *tizenhatodik Lajos* — 3 instances in hu_hu, previously read as cardinals — and the licenser is "the
 * FOLLOWING word is capitalised". Two earlier attempts are recorded because each failed differently and
 * each fix is now load-bearing:
 *
 *   1. `A JAS 39C Gripen` → *századik*: an ordinal context licenses a single-letter numeral, and the `C`
 *      of `39C` is one. core/roman.ts now refuses any candidate glued to a digit.
 *   2. `D K Arya főfelügyelő-helyettes` → *ötszázadik K Arya*: `D` is Roman 500, all-caps, followed by a
 *      capitalised word — which is what PERSONAL INITIALS look like. core/roman.ts now refuses a single
 *      capital sitting in a contiguous run of them, the same contiguity principle core/initialisms.ts
 *      uses for `J. S. Bach`, generalised to the form without periods.
 *
 * A minimum-numeral-length constraint, the other option considered, would NOT have worked: Hungarian
 * regnal names are routinely single letters (I. István, V. László, X. Leó).
 *
 * RESIDUAL: the ordinal period survives as a phrase break (*második. Erzsébet*). Extending normalize.ts
 * step 9d to swallow it before a capitalised word was tried and reverted — see the note there.
 */

/** Integer → Hungarian ordinal (see numbers.ts). Named locally so the policy's shape stays readable. */
const ordinal = (n: number): string | undefined => (n >= 1 ? ordinalWords(n) : undefined);

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    // …plus a capitalised word, which is the REGNAL pattern (II. Erzsébet, XVI. Lajos). Safe only
    // because core/roman.ts now refuses both a digit-glued candidate and a single capital sitting in a
    // run of them; the two attempts that failed without those are recorded above.
    ordinalAfter: new RegExp(`^(?:${NOUN_ALT}|\\p{Lu})`, "u"),
};
