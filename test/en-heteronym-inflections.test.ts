/**
 * THE `-s` FORM OF A HETERONYM IS A HETERONYM TOO, and the dictionary carried only one reading for each.
 *
 * ⚠ 79 entries derived from the stems already in english.jsonc `heteronyms`: each reading is its stem's
 * reading plus the English -s allomorph chosen by THAT READING's own last segment, so `use` jˈuːs/jˈuːz
 * gives `uses` jˈuːsᵻz/jˈuːzᵻz — the two forms take DIFFERENT allomorphs and a single suffix would have
 * been wrong for one of them.
 *
 * ⚠ CONFIRMED AGAINST misaki gold BY READING-SET RATHER THAN BY POS KEY. gold makes the VERB the default
 * for `constructs`, `contents` and `extracts`; this engine makes the NOUN one, which is the right default
 * for `records` and `contracts`. Comparing keys would have called 38 of 79 wrong; comparing the readings
 * says 68 match segment for segment and the other 11 differ only on declared convention axes.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { phonemize } from "../src/index.ts";

const HET: Record<string, Record<string, string>> = JSON.parse(
    readFileSync("data/languages/english/english.jsonc", "utf8")
        .replace(/^\s*\/\/.*$/gmu, "").replace(/,(\s*[}\]])/gu, "$1"),
).heteronyms;

describe("heteronym -s inflections", () => {
    test("the allomorph follows each reading's own final segment", () => {
        // ⚠ THE WHOLE POINT: one stem, two readings, two DIFFERENT plural allomorphs.
        expect(HET["uses"]).toEqual({ default: "jˈuːsᵻz", verb: "jˈuːzᵻz" });
        expect(HET["records"]).toEqual({ default: "ɹˈɛkɚdz", verb: "ɹᵻkʰˈɔːɹdz" });
        expect(HET["projects"]).toEqual({ default: "pɹˈɑːd͡ʒɛkts", verb: "pɹəd͡ʒˈɛkts" });
    });

    test("every -s entry is its stem's reading plus an allomorph", () => {
        const SIB = ["s", "z", "ʃ", "ʒ", "t͡ʃ", "d͡ʒ"], VOICELESS = ["p", "t", "k", "f", "θ"];
        const plural = (i: string): string =>
            SIB.some((x) => i.endsWith(x)) ? `${i}ᵻz` : VOICELESS.some((x) => i.endsWith(x)) ? `${i}s` : `${i}z`;
        // ⚠ ONE DOCUMENTED IRREGULAR, and it is the same fricative-voicing that makes `truths` ðz and
        // `wreaths` ðz in the dictionary: `house` hˈaᶷs pluralises to hˈaᶷzᵻz, voicing the stem's final /s/.
        // The rule cannot predict it and is not meant to — this is the exception list, and it has one row.
        const VOICING_PLURAL = new Set(["houses.default"]);
        let checked = 0;
        for (const [w, v] of Object.entries(HET)) {
            // ⚠ `!== w` IS LOAD-BEARING: `.replace(/s$/)` returns the word UNCHANGED when it has no final
            // ⟨s⟩, so `absent` matched itself as its own stem and the test demanded `absents`.
            const stem = [w.replace(/s$/u, ""), w.replace(/es$/u, "")].find((x) => x !== w && HET[x]);
            if (!stem) continue;
            checked++;
            for (const [pos, ipa] of Object.entries(v)) {
                const from = HET[stem]![pos];
                if (from === undefined || VOICING_PLURAL.has(`${w}.${pos}`)) continue;
                expect(`${w}.${pos}: ${ipa}`).toBe(`${w}.${pos}: ${plural(from)}`);
            }
        }
        expect(checked).toBeGreaterThanOrEqual(79);
    });

    test("the POS tagger selects between them in a sentence", () => {
        expect(phonemize("She opened the presents.", "en")).toContain("pɹˈɛzənts");
        expect(phonemize("The bill presents a problem.", "en")).toContain("pɹᵻzˈɛnts");
        expect(phonemize("The uses are many.", "en")).toContain("jˈuːsᵻz");
        expect(phonemize("He uses it daily.", "en")).toContain("jˈuːzᵻz");
    });
});
