import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// #1495: the fraction rule's two guards are MIRRORS in the `\b…\b` family (en fr de es pt ru id) and in ht ln za
// uk it, as in ur/cmn/hi (#1477). Each side refuses a digit or `/`, and the language's own decimal and grouping
// separators with a digit beyond them; a `,` BETWEEN TWO FRACTIONS is a list separator. `1.5/2` used to read a
// fraction off the decimal's tail (en: "one point five halves"), `3/1/2` read `1/2` out of the chain, and in
// ht/ln/za `1/2abc` read the fraction (fused into the word, in ht) while `abc1/2` did not.
// Expectations are RELATIONAL — a declined fraction reads as its numbers spaced, a read one as its spaced
// form — never typed IPA.

/** [input, the spaced form it must read as]. */
type Case = readonly [string, string];

const CHAIN: Case[] = [["3/1/2", "3 1 2"], ["1/2/3", "1 2 3"]];
const READS: Case[] = [["1/2,3/4", "1/2, 3/4"], ["1/2.", "1/2 ."]];

/** `.` is the decimal, `,` + three digits the thousands group. */
const DOT_DECIMAL: Case[] = [
    ["1/2.5", "1 2.5"], ["1.5/2", "1.5 2"], ["1/1,000", "1 1,000"], ["1,000/2", "1,000 2"],
];
/** `,` is the decimal; `.` the thousands mark (or an anglicism decimal) — both decline. */
const COMMA_DECIMAL: Case[] = [
    ["1/2,5", "1 2,5"], ["1,5/2", "1,5 2"], ["1/2.5", "1 2.5"], ["1.5/2", "1.5 2"],
];
const LETTER: Case[] = [["1/2abc", "1 2abc"]];

const LANGS: Record<string, Case[]> = {
    en: [...DOT_DECIMAL, ...CHAIN, ...READS],
    fr: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    de: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    es: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    pt: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    ru: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    id: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    uk: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    it: [...COMMA_DECIMAL, ...CHAIN, ...READS],
    ht: [...COMMA_DECIMAL, ...LETTER, ...READS],
    // ln: `1/2,3/4` reads both fractions but loses the pause between them — the fraction's output digits
    // (`1 ya 2,3 ya 4`) re-enter the decimal step. Unchanged by #1495, so only the full-stop case is pinned.
    ln: [...COMMA_DECIMAL, ...LETTER, ["1/2.", "1/2 ."]],
    za: [["1/2.5", "1 2.5"], ["1.5/2", "1.5 2"], ...LETTER, ...READS],
};

describe.each(Object.keys(LANGS))("%s: the fraction guards are mirrors (#1495)", (lang) => {
    const say = (s: string): string => phonemize(s, lang);
    test.each(LANGS[lang]!)("%s reads as %s", (input, spaced) => {
        expect(say(input)).toBe(say(spaced));
    });
    test("a plain fraction still reads", () => {
        expect(say("1/3")).not.toBe(say("1 3"));
    });
});
