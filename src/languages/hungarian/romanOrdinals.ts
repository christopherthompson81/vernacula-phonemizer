/**
 * Hungarian Roman-numeral reading. A century is an ORDINAL: `XIX. század` is *tizenkilencedik század*, where
 * the cardinal *tizenkilenc század* would mean "nineteen centuries". In Hungarian orthography the PERIOD after
 * a Roman numeral is itself the ordinal marker — it does the work "th" does in English.
 *
 * Hungarian has no gender or adjectival case agreement, so the single form *-dik* is unconditionally correct
 * in every context; this is the only language in the group with no agreement limitation to declare. Ordinal
 * formation lives in numbers.ts (`ordinalWords`), shared with the Arabic-ordinal path (`19. század`), and has
 * no range cap — the ordinal is the cardinal with its final morph replaced.
 *
 * The period between numeral and context word does not affect matching (the shared pass skips non-letters to
 * find the next word). It is consumed by normalize.ts step 9d, which drops a period between an ordinal word
 * and a following LOWERCASE word — safe because Hungarian starts sentences with a capital.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { ordinalWords } from "./numbers.ts";

/**
 * Context nouns, UNANCHORED at the end because Hungarian is agglutinative: `század` must also match
 * században, századi, századtól, századok, századokban.
 *
 * ⚠ SPELLED IN BOTH CASES RATHER THAN MATCHED CASE-INSENSITIVELY. `ordinalAfter` below also tests for a
 * capitalised word, and `\p{Lu}` under the `i` flag matches lowercase too — case-insensitive matching
 * case-folds property escapes. JavaScript has no inline modifier to scope the flag, so the two cannot share
 * one pattern.
 */
const NOUNS = [
    "század",
    "évszázad",
    "évezred",
    "évfordul",
    "kerület",
    "kongresszus",
    "fejezet",
    "olimpi",
    "világháború",
];
const bothCases = (w: string): string => `[${w[0]!.toUpperCase()}${w[0]!}]${w.slice(1)}`;
const NOUN_ALT = NOUNS.map(bothCases).join("|");
const CONTEXT = new RegExp(`^(?:${NOUN_ALT})`, "u");

/** Integer → Hungarian ordinal (see numbers.ts). Named locally so the policy's shape stays readable. */
const ordinal = (n: number): string | undefined => (n >= 1 ? ordinalWords(n) : undefined);

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    /**
     * A capitalised following word is the REGNAL pattern (`II. Erzsébet` → *második Erzsébet*).
     *
     * ⚠ This is only safe because core/roman.ts refuses two look-alikes: a candidate glued to a digit (the
     * `C` of `39C` in "JAS 39C Gripen") and a single capital inside a contiguous run of them (personal
     * initials — `D K Arya`, where `D` is Roman 500 followed by a capitalised word). Do not relax either.
     *
     * A minimum-numeral-length constraint would NOT work as an alternative: Hungarian regnal names are
     * routinely single letters (I. István, V. László, X. Leó).
     *
     * RESIDUAL: the ordinal period survives here as a phrase break (*második. Erzsébet*) — normalize.ts
     * step 9d only swallows it before a lowercase word.
     */
    ordinalAfter: new RegExp(`^(?:${NOUN_ALT}|\\p{Lu})`, "u"),
};
