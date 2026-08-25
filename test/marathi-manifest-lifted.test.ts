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
    test("the tier reads EVERY one of its word fields from the manifest", () => {
        // ⚠ THE HALF-LIFTED STATE WAS WORSE THAN EITHER END. After the first lift `MR_SYMBOLS` read
        // `percent` and `currency` from the manifest and spelled `ampersand`, `multiply` and `units`
        // inline — in the same object literal — so a reader could not tell which half was authoritative
        // and editing the unit words in marathi.jsonc did nothing.
        for (const k of ["ampersand", "multiply", "units", "percent", "currency"] as const)
            expect(DEF[k]).toBeTruthy();
        expect(Object.keys(DEF.units).length).toBeGreaterThan(0);
    });

    test("the ordinal agreement index is the contract between two keys", () => {
        // `suffixForm` maps a written suffix to a SLOT; `irregular` is indexed by that same slot.
        const slots = new Set(Object.values(DEF.ordinals.suffixForm));
        for (const row of Object.values(DEF.ordinals.irregular)) {
            expect(row).toHaveLength(4);
            for (const slot of slots) expect(row[slot]).toBeTruthy();
        }
    });

    test("the two unit tables are both present and NOT merged", () => {
        // normalize.ts owns the Devanagari forms and re-declares the Latin keys on purpose: step 14's
        // bare-hundred rewrite turns `100 km` into `शंभर km`, which the tier's digit-run NUM cannot match.
        for (const k of Object.keys(DEF.units)) expect(DEF.unitWords[k]).toBeDefined();
        expect(Object.keys(DEF.unitWords).length).toBeGreaterThan(Object.keys(DEF.units).length);
        // ⚠ Single-letter `m` and `g` are deliberately absent from BOTH.
        for (const k of ["m", "g"]) {
            expect(DEF.units[k]).toBeUndefined();
            expect(DEF.unitWords[k]).toBeUndefined();
        }
    });

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

    /**
     * ⚠ COUPLING, NOT CORRECTNESS. Each case derives its expectation FROM the manifest, so it fails when
     * the code stops READING the key — a re-hardcoded literal beside a changed file — and passes when the
     * data itself is changed. That is the failure this whole lift exists to prevent: £ read two ways
     * because two copies drifted, and nothing noticed.
     */
    const reads = (input: string, key: string): void => {
        expect(phonemize(input, "mr")).toContain(phonemize(key, "mr"));
    };

    test("the lifted words are the ones the engine speaks", () => {
        reads("100", DEF.bareHundred);
        reads("५ ते १०", DEF.rangeWord);
        reads("1/2", DEF.fractions.half);
        reads("1/4", DEF.fractions.quarter);
        reads("2/3", DEF.fractions.dividedBy);
        reads("२५°", DEF.degree.word);
        reads("२५°C", DEF.degree.celsius);
        reads("10:30", DEF.clock.past);
        reads("10:30", DEF.clock.minutes);
        reads("११:००", DEF.clock.oclock);
        reads("इ.स. १९४७", DEF.eraMarkers.ad);
        reads("डॉ. आंबेडकर", DEF.abbreviations["डॉ"]!);
        reads("5 किमी", DEF.unitWords["किमी"]!);
        reads("5 km", DEF.unitWords["km"]!);
        // ⚠ 1 is SUPPLETIVE (पहिला), 16 is regular (सोळावा) — the irregular table only covers 1-4.
        reads("1वा", DEF.ordinals.irregular["1"]![0]!);
        reads("2व्या", DEF.ordinals.irregular["2"]![3]!);
    });
});
