/**
 * #1543: a dotted abbreviation before `,` `;` `:` `!` `?` keeps no dot of its own (that mark carries the pause), and
 * one before a closing German quote is still expanded. Expectations are relational: each input must normalize or
 * read like the spelled-out form. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeGerman } from "../src/languages/german/normalize.ts";

describe("de #1543", () => {
    const absorbed: [string, string][] = [
        ["Es kostet 21 Mio., also viel.", "Es kostet 21 Millionen, also viel."],
        ["Es kostet 1 Mio., also viel.", "Es kostet eine Million, also viel."],
        ["Es sind 21 Mio.; danach mehr.", "Es sind 21 Millionen; danach mehr."],
        ["Es sind 21 Mio.: genug.", "Es sind 21 Millionen: genug."],
        ["Sind es 21 Mio.?", "Sind es 21 Millionen?"],
        ["Es sind 21 Mio.!", "Es sind 21 Millionen!"],
        ["Siehe S., dann weiter.", "Siehe Seite, dann weiter."],
    ];
    for (const [abbr, plain] of absorbed)
        test(`the dot before the mark goes: ${abbr}`, () => expect(normalizeGerman(abbr)).toBe(normalizeGerman(plain)));

    const kept: [string, string][] = [
        ["Es kostet 21 Mio.", "Es kostet 21 Millionen."],
        ["Es kostet 1 Mio.  ", "Es kostet eine Million.  "],
        ["(Es sind 21 Mio.)", "(Es sind 21 Millionen.)"],
        ["Es sind 21 Mio... mehr", "Es sind 21 Millionen... mehr"],
    ];
    for (const [abbr, plain] of kept)
        test(`a sentence-end dot stays: ${abbr}`, () => expect(normalizeGerman(abbr)).toBe(normalizeGerman(plain)));

    const quoted: [string, string][] = [
        ["Er sagte »21 Mio.«", "Er sagte »21 Millionen.«"],
        ["Er sagte „21 Mio.“", "Er sagte „21 Millionen.“"],
    ];
    for (const [abbr, plain] of quoted)
        test(`a closing German quote is a phrase end: ${abbr}`, () => expect(phonemize(abbr, "de")).toBe(phonemize(plain, "de")));
});
