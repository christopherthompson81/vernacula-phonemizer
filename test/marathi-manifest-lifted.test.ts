/**
 * Marathi's percent and currency words must be authored once and read by every path.
 *
 * ⚠ THE TWO PATHS USED TO DISAGREE ABOUT £. normalize.ts claims a sign BEFORE the amount and the shared
 * symbol tier claims one AFTER it, and they held different spellings: `£5` read पौंड while `5 £` read
 * पाउंड — the same currency, two words, decided by which side of the number the sign sat on. The percent
 * word was authored three times over (jsonc `symbols`, the tier, and inline in normalize.ts).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { DEF } from "../src/languages/marathi/marathi.ts";

describe("marathi authors its symbol words once", () => {
    for (const sign of Object.keys(DEF.currency)) {
        test(`${sign} reads the same before and after the amount`, () => {
            const before = phonemize(`${sign}5`, "mr");
            const after = phonemize(`5 ${sign}`, "mr");
            const word = phonemize(DEF.currency[sign]!, "mr");
            expect(before).toContain(word);
            expect(after).toContain(word);
        });
    }

    test("percent agrees for count and comes from one key", () => {
        expect(phonemize("1%", "mr")).toContain(phonemize(DEF.percent.singular, "mr"));
        expect(phonemize("5%", "mr")).toContain(phonemize(DEF.percent.plural, "mr"));
        expect(DEF.percent.singular).not.toBe(DEF.percent.plural);
    });
});
