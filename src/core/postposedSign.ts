/**
 * A sign whose reading FOLLOWS both its operands — the rule shape a verb-final or postpositional language needs.
 *
 * Most of the fleet reads `A < B` by substituting words BETWEEN the operands, a one-line `replace`. A
 * postpositional language states the standard of comparison first and the comparative after it, so the same
 * substitution comes out backwards or as word salad:
 *
 *     hi   `A < B`  →  "A, B से कम"        NOT  "A से कम B"
 *     ja   `A < B`  →  「AはBより小さい」      an infix より小さい reads as "B, which is smaller than A"
 *
 * Three details are load-bearing; each is a defect this module exists to prevent.
 *
 * ⚠ TRAILING PUNCTUATION MUST NOT TRAVEL WITH THE OPERAND. `(\S+)` is greedy about punctuation, so
 * `यह 5 < 6, और वह …` strands the comma BETWEEN the operand and its postposition — a clause pause mid-phrase.
 * The second operand is split from its trailing marks, which are re-emitted after the sign's words.
 *
 * ⚠ THE CATCH-ALL SECOND PASS IS NOT REDUNDANT. `/g` replaces in ONE pass, so in a chain (`a < b < c`) the first
 * match consumes `b` and the second `<` has no left operand: it matches nothing and VANISHES, turning a reorder
 * into a silent DROP. Chained comparisons read awkwardly either way, but nothing may go silent.
 *
 * ⚠ THE SIGN IS A REGEX SOURCE STRING. `<` and `>` are literal; `+` and `*` are not. Callers pass a character
 * class or an escaped literal — this module does not guess, since a mis-escaped sign matches the wrong thing.
 */
import { rewrite } from "./provenance.ts";
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
    const out = rewrite(s, new RegExp(`(\\S+)\\s*${sign}\\s*(\\S+)`, "gu"), (_m, a: string, b: string) => {
        const split = TRAILING.exec(b);
        const operand = split?.[1] ?? b,
            marks = split?.[2] ?? "";
        return `${a} ${operand} ${words}${marks}`;
    });
    // The chain case: any sign left over had no left operand to attach to, so it reads infix rather than vanishing.
    return rewrite(out, new RegExp(`\\s?${sign}\\s?`, "gu"), ` ${words} `);
}
