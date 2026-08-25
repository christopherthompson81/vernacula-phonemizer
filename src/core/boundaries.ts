/**
 * The letter-boundary assertions, defined ONCE.
 *
 * Every engine that rewrites text needs "not adjacent to a letter" on one side or the other, and the fleet
 * had written it out 64 times as a named constant under FIFTEEN different names (NOT_BEFORE, NOT_AFTER,
 * NOT_LETTER, NW_A, NW_B, NA, NB, L, R, WNB, NL, NLB, …) plus 213 times inline in a template string and 658
 * times inside a regex literal. One value, defined 64 times, un-greppable under any single name.
 *
 * ⚠ THIS IS NOT `\b`, AND THE DIFFERENCE IS A DEFECT THE FLEET SHIPPED. JS defines `\b` on ASCII `\w`, so a
 * following NON-ASCII letter counts as a word boundary: five engines guarded the °C rule with `\b` and read
 * German `25°Cölner` as "Grad Celsius" + "ölner", eating the ⟨C⟩ out of the next word (#949). `\p{M}` is in
 * the class alongside `\p{L}` because a combining mark after a letter is still inside the word — a Hebrew
 * point, an Arabic harakat or a Devanagari matra must not end a token either.
 *
 * These are STRING FRAGMENTS, for splicing into a pattern built with a template literal. A rule written as a
 * regex LITERAL keeps `(?![\p{L}\p{M}])` inline: converting those to `new RegExp` concatenation would cost
 * readability and the C# port's verbatim-pattern rule for no safety gain. `test/letter-boundary.test.ts`
 * pins the spelling everywhere instead.
 */

/** Nothing letter-like immediately to the LEFT. */
export const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";

/** Nothing letter-like immediately to the RIGHT. */
export const NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}])";
