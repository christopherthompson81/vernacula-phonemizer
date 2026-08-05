/**
 * A SIGN WHOSE READING FOLLOWS BOTH ITS OPERANDS (#654) — the rule shape a verb-final or postpositional
 * language needs, and which an infix substitution gets WRONG rather than merely awkward.
 *
 * ## Why this exists as shared code
 *
 * Most of the fleet reads `A < B` by substituting words BETWEEN the operands, which is a one-line `replace`.
 * A postpositional language states the standard of comparison FIRST and the comparative after it, so the same
 * substitution produces the comparison BACKWARDS or as word salad:
 *
 *     hi   `A < B`  →  "A, B से कम"        NOT  "A से कम B"
 *     ja   `A < B`  →  「AはBより小さい」      an infix より小さい reads as "B, which is smaller than A"
 *     mr   `A < B`  →  "A B पेक्षा कमी"
 *
 * Hindi solved this first and the implementation had three non-obvious parts, all of which are load-bearing
 * and none of which should be re-derived per language — hence this module. Every warning below is a defect
 * that was found and fixed in `hindi/normalize.ts` before this was extracted.
 *
 * ## ⚠ TRAILING PUNCTUATION MUST NOT TRAVEL WITH THE OPERAND
 *
 * `(\S+)` is greedy about punctuation, so `यह 5 < 6, और वह …` produced "पाँच छह , से कम और" — the comma
 * stranded BETWEEN the operand and its postposition, i.e. a clause pause in the middle of a phrase. The second
 * operand is therefore split from its trailing marks and they are re-emitted AFTER the sign's words.
 *
 * ## ⚠ THE CATCH-ALL SECOND PASS IS NOT REDUNDANT
 *
 * `/g` replaces in ONE pass over the input, so in a chain (`a < b < c`) the first match consumes `b` and the
 * second `<` is left with no left operand: it matches nothing and then VANISHES, turning a reorder into a
 * silent DROP. A chained comparison is rare and reads awkwardly either way, but nothing may go silent.
 *
 * ## ⚠ AND THE SIGN IS A REGEX SOURCE STRING, SO IT MUST BE ESCAPED BY THE CALLER'S CHOICE OF SIGN
 *
 * `<` and `>` are literal in a regex; `+` and `*` are not. Callers pass a character class or an escaped
 * literal, and this module does not guess — a silently mis-escaped sign would match the wrong thing.
 */

/** Trailing marks that belong to the SENTENCE, not the operand — Latin, Devanagari and CJK forms. */
const TRAILING = /^(.*?)([,;।॥!?)\]"'’、。]*)$/su;

/**
 * Rewrite `A <sign> B` as `A B <words>`, with the sign's reading after both operands.
 *
 * @param s     the text being normalized
 * @param sign  regex source for the sign — escaped by the caller (`<`, `>`, `÷`, `\\+`)
 * @param words the reading, e.g. `से कम` / `पेक्षा कमी` / `ने भागणे`
 */
export function postposedSign(s: string, sign: string, words: string): string {
    const out = s.replace(new RegExp(`(\\S+)\\s*${sign}\\s*(\\S+)`, "gu"), (_m, a: string, b: string) => {
        const split = TRAILING.exec(b);
        const operand = split?.[1] ?? b, marks = split?.[2] ?? "";
        return `${a} ${operand} ${words}${marks}`;
    });
    // The chain case: any sign left over had no left operand to attach to, so it reads infix rather than vanishing.
    return out.replace(new RegExp(`\\s?${sign}\\s?`, "gu"), ` ${words} `);
}
