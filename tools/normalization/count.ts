/**
 * Counting things in a corpus — the one way to do it, because the hand-rolled ways keep being wrong.
 *
 * ⚠ WHY THIS EXISTS. Three separate measurements in one language's work were wrong, each from a freshly written
 * pattern, and each looked plausible enough to act on:
 *
 *   · `grep -cE "[០-៩][ ​]?\$sg[ ​]?[០-៩]"` in a shell loop. For `sg='<'` the shell expands `\$sg` to `\<`, which
 *     in ERE is a WORD BOUNDARY, not a literal. `<` and `>` came back as 1,023 and 44,388 digit-flanked hits; the
 *     real values are 0 and 2. A whole sign class was declared absent, then present, on that.
 *   · `(?<![០-៩])\s*±` to count "a ± with no number before it". The lookbehind is checked BEFORE `\s*` consumes
 *     anything, so the regex simply starts after the space and the lookbehind sees the space — every
 *     digit-preceded tolerance counted as leading. 23 became 4 once measured properly.
 *   · `\d` under the `u` flag, which is ASCII-only, in a language whose digits are ០-៩ — 74% of its numerals.
 *
 * The common thread is that each was written inline, in a hurry, in a different syntax (shell ERE, JS regex),
 * for a question that is always the same shape: how many times does X occur in this corpus, optionally flanked?
 * A function cannot be got wrong the same way twice.
 *
 * ⚠ AND A COUNT IS STILL A LEAD, NEVER A FINDING. (`A count is a lead, never a finding — read
 * the instances`) and this module cannot enforce it, so every function here returns the MATCHES, not a number, and
 * the count is `.length`. Getting a count out requires having the instances in hand.
 */

/**
 * A literal string, escaped so no character in it can act as a metacharacter.
 *
 * ⚠ THE HYPHEN IS NOT ESCAPED, AND MUST NOT BE. Under the `u` flag `\-` is an INVALID escape outside a character
 * class — `new RegExp("\\-", "u")` throws — and `-` is only special INSIDE a class, which is not where these
 * patterns put it. The first version escaped it and every helper here threw on a hyphen; caught by the test that
 * feeds each metacharacter through. If a caller ever interpolates this into a `[...]` class, escape it there.
 */
export function literal(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Any Unicode decimal digit — `\p{Nd}`, never `\d`.
 *
 * ⚠ `\d` IS ASCII-ONLY EVEN UNDER `/u`, which is the single most repeated defect in this toolchain: it silently
 * excludes ០-៩, ०-९, ๐-๙, ٠-٩ and every other native digit set, i.e. exactly the languages the corpus work exists
 * to serve. Use this.
 */
export const DIGIT = "\\p{Nd}";

/** Optional separator: ordinary space, ZWSP, ZWNJ. What sits between a number and its sign in most scripts. */
export const SEP = "[\\s\\u200b\\u200c]*";

/** Every match of `pattern` in `text`, with its index. The caller decides what the count means. */
export function matches(text: string, pattern: string, flags = "gu"): { text: string; index: number }[] {
    const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
    return [...text.matchAll(re)].map((m) => ({ text: m[0], index: m.index }));
}

/**
 * Occurrences of a LITERAL string flanked by digits on both sides — the "is this sign used as an operator" test.
 * The literal is escaped, so `+`, `.`, `<` and friends mean themselves.
 */
export function digitFlanked(text: string, sign: string): { text: string; index: number }[] {
    return matches(text, `(?<=${DIGIT})${SEP}${literal(sign)}${SEP}(?=${DIGIT})`);
}

/**
 * Occurrences of a literal with a digit AFTER it and no digit before — the "signed number / tolerance" test.
 *
 * ⚠ THE WHITESPACE IS STRIPPED EXPLICITLY, NOT CONSUMED BY THE PATTERN. Writing `(?<!digit)\s*±` lets the match
 * start after the space, where the lookbehind sees the space rather than the digit, and every `1830 ±40` counts as
 * leading. So the preceding text is trimmed and tested here instead, where the mistake is not available.
 */
export function leading(text: string, sign: string): { text: string; index: number }[] {
    const lit = literal(sign);
    const digit = new RegExp(DIGIT, "u");
    return matches(text, `${lit}${SEP}(?=${DIGIT})`).filter((m) => {
        const before = text.slice(0, m.index).replace(/[\s​‌]+$/u, "");
        return before === "" || !digit.test(before[before.length - 1]!);
    });
}

/**
 * Occurrences of a literal as a WHOLE WORD, and occurrences of it anywhere, reported separately.
 *
 * ⚠ THE TWO ARE NOT INTERCHANGEABLE AND THE DIFFERENCE IS WHERE READINGS GO WRONG. `យ័ន` occurs 543 times in a
 * Khmer corpus and is a whole word 7 times — every other hit is inside បាយ័ន (a temple) or អារ្យ័ន (Aryan) — and
 * it was declared a currency word on the strength of the larger number. In a script that writes no word space the
 * ratio between these two is the only warning available; `corpus-words.ts` prints it for that reason.
 */
export function wordAndSubstring(text: string, word: string): { whole: number; anywhere: number; ratio: number } {
    const anywhere = matches(text, literal(word)).length;
    // A "word" boundary here means: not preceded or followed by a letter or a combining mark. `\b` is ASCII-defined
    // and useless for every script this toolchain serves.
    const whole = matches(text, `(?<![\\p{L}\\p{M}])${literal(word)}(?![\\p{L}\\p{M}])`).length;
    return { whole, anywhere, ratio: anywhere === 0 ? 0 : whole / anywhere };
}
