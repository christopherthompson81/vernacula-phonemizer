/**
 * THE `-s` FORM OF A HETERONYM, AND THE TWO CASES english.ts DOES NOT COVER.
 *
 * ⚠ IT ALREADY COVERS ALMOST ALL OF THEM, AND THIS TEST EXISTS BECAUSE THAT WAS NEARLY MISSED. `english.ts`
 * resolves the -s form of a stress-shift heteronym AT RUNTIME — stem reading, POS-gated, plus the sibilant
 * allomorph — so `records`, `projects`, `contracts` and 70-odd others are already correct with no table row,
 * and must not be given one: a static copy of a runtime rule is a second source of truth that goes stale
 * silently. 79 such rows were written and then reverted after diffing the ENGINE rather than the flat
 * lexicon; 75 of them changed nothing at all.
 *
 * ⚠ WHAT IT DOES NOT COVER IS THE VOICING PAIRS. `isVoicingHeteronym` excludes them, because their plural
 * voicing is irregular (`house` hˈaᶷs → hˈaᶷzᵻz, not hˈaᶷsᵻz), and defers them to the flat lexicon — which
 * carries ONE reading. So "he uses it" read the noun's /s/.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { phonemize } from "../src/index.ts";

const HET: Record<string, Record<string, string>> = JSON.parse(
    readFileSync("data/languages/english/english.jsonc", "utf8")
        .replace(/^\s*\/\/.*$/gmu, "").replace(/,(\s*[}\]])/gu, "$1"),
).heteronyms;

describe("the -s form of a heteronym", () => {
    test("a voicing pair's plural is POS-gated, not a single lexicon reading", () => {
        expect(phonemize("He uses it daily.", "en")).toContain("jˈuːzᵻz");
        expect(phonemize("The uses are many.", "en")).toContain("jˈuːsᵻz");
        expect(phonemize("He abuses it.", "en")).toContain("əbjˈuːzᵻz");
        expect(phonemize("The abuses continue.", "en")).toContain("əbjˈuːsᵻz");
    });

    // ⚠ `excise` was CLASSIFIED as a voicing pair only because its verb was written with /s/. gold
    // (ˈɛksˌIz / ɪksˈIz) and Moby (/I/k's/aI/z) both voice BOTH readings. With the row corrected the two
    // readings differ by STRESS, english.ts derives the plural itself, and no table row is needed.
    test("excise is a stress pair, so its plural derives at runtime", () => {
        expect(HET["excises"]).toBeUndefined();
        expect(phonemize("He excises it.", "en")).toContain("ɛksˈaᶦzᵻz");
        expect(phonemize("The excises are levied.", "en")).toContain("ˈɛksaᶦzᵻz");
    });

    // ⚠ THE REGRESSION GUARD FOR THE REVERTED 79. If a future change starts writing these rows out again,
    // this fails — and the point is that the runtime already gets them right without any.
    test("stress-shift plurals are POS-gated WITHOUT a table row of their own", () => {
        for (const w of ["records", "projects", "contracts", "presents", "subjects", "objects"])
            expect(`${w} in table: ${HET[w] !== undefined}`).toBe(`${w} in table: false`);
        expect(phonemize("She opened the presents.", "en")).toContain("pɹˈɛzənts");
        expect(phonemize("The bill presents a problem.", "en")).toContain("pɹᵻzˈɛnts");
        expect(phonemize("He records it.", "en")).toContain("ɹᵻkʰˈɔːɹdz");
        expect(phonemize("The records are sealed.", "en")).toContain("ɹˈɛkɚdz");
    });
});
