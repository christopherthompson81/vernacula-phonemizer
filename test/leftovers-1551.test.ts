/**
 * #1551 leftovers: sv `12:00,` and pl `1/2.5`. Expectations are relational — each input must read like a spelling
 * the engine already reads right — never typed IPA. Inputs are synthetic.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const strip = (s: string): string => s.replace(/\s*[.,]\s*/gu, " ").trim();

describe("#1551", () => {
    test("sv: a colon clock before a comma reads as before a full stop, not as a score", () => {
        expect(strip(phonemize("Klockan 12:00, sedan", "sv"))).toBe(strip(phonemize("Klockan 12:00. Sedan", "sv").toLowerCase()));
        expect(phonemize("Klockan 12:00, sedan", "sv")).not.toBe(phonemize("Klockan 12 0, sedan", "sv"));
    });
    test("sv: a score before a comma is still a score", () => {
        expect(phonemize("Det blev 3:0, sedan", "sv")).toBe(phonemize("Det blev 3 0, sedan", "sv"));
    });

    // A period decimal is the same number as a comma decimal, so neither side of a slash may claim it as a
    // fraction: `1/2.5` must read as `1/2,5` already does.
    for (const [period, comma] of [["To 1/2.5 razy", "To 1/2,5 razy"], ["Wynik 0.1/2 oraz", "Wynik 0,1/2 oraz"]] as const)
        test(`pl: ${period} is not a fraction`, () => {
            const p = phonemize(period, "pl"), c = phonemize(comma, "pl");
            // the two spellings differ only in the decimal-point word (kropka vs przecinek)
            expect(p.split(" ").length).toBe(c.split(" ").length);
            const words = (s: string) => s.split(" ");
            const diff = words(p).filter((w, i) => w !== words(c)[i]);
            expect(diff.length).toBe(1); // only the point word
        });
    test("pl: a fraction ending a sentence still reads", () => {
        expect(phonemize("To 1/2. Potem", "pl")).toBe(phonemize("To jedna druga. Potem", "pl"));
    });
});
