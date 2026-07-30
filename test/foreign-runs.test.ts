import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// An engine's tokenizer only matches its own script, and assembleClauses skips whatever the tokenizer
// does not claim — so 47 engines DROPPED embedded Latin outright (a brand name, acronym, loanword or
// code-switched phrase). Measured in FLEURS that was 3-15% of utterances per language. The shared
// unclaimed-run pass (core/clauses.ts + core/foreign.ts) now reads those runs as English.
describe("embedded foreign (Latin) runs", () => {
    // One per script family that was affected, spanning both the assembleClauses path and the two
    // engines with custom scan loops (Burmese) or an over-broad token class (Georgian).
    const CASES: Array<[string, string, string]> = [
        ["ru", "hello век", "Cyrillic"],
        ["uk", "hello хвилина", "Cyrillic (uk)"],
        ["el", "hello κόσμος", "Greek"],
        ["he", "hello שלום", "Hebrew"],
        ["ar", "hello مرحبا", "Arabic"],
        ["ja", "hello 世界", "Japanese"],
        ["ko", "hello 세계", "Hangul"],
        ["th", "hello โลก", "Thai"],
        ["ta", "hello உலகம்", "Tamil"],
        ["am", "hello ሰላም", "Ethiopic"],
        ["ka", "hello გამარჯობა", "Georgian (token class was \\p{L})"],
        ["my", "hello မြန်မာ", "Burmese (custom scan loop)"],
        ["sat", "hello ᱡᱚᱦᱟᱨ", "Ol Chiki"],
        ["bo", "hello བོད", "Tibetan"],
        ["chr", "hello ᏣᎳᎩ", "Cherokee syllabary"],
    ];

    test.each(CASES)("%s reads the Latin run (%s)", (lang, text) => {
        const out = phonemize(text, lang);
        // "hello" must be audible — the English reading starts [h]
        expect(out).toContain("həl");
        // ...and the native text must still be there, so the run was ADDED, not substituted
        expect(out.split(" ").length).toBeGreaterThan(1);
    });

    test("the native-only rendering is unchanged", () => {
        // The pass must be a no-op when there is nothing foreign to claim.
        expect(phonemize("век", "ru")).toBe("vʲek");
        expect(phonemize("გამარჯობა", "ka")).toBe("ɡamaɾd͡ʒɔba");
    });

    test("engines that already handled Latin are unaffected", () => {
        // These claim Latin in their own tokenizer, so they leave no gap for the fallback.
        expect(phonemize("hello 世界", "cmn")).toContain("həlˈoᶷ");
        expect(phonemize("hello नमस्ते", "hi")).toContain("həlˈoᶷ");
    });

    test("word order is preserved across the boundary", () => {
        const before = phonemize("hello век", "ru");
        const after = phonemize("век hello", "ru");
        expect(before.indexOf("həl")).toBeLessThan(before.indexOf("vʲek"));
        expect(after.indexOf("vʲek")).toBeLessThan(after.indexOf("həl"));
    });

    test("only Latin is surfaced — other unclaimed text stays dropped", () => {
        // A third script in a gap is not the fallback's business (it would need its own engine);
        // this keeps the change scoped to the measured defect.
        expect(phonemize("век 世界", "ru")).toBe("vʲek");
    });

    test("the run is delegated verbatim, accents included", () => {
        // The run class covers combining marks, so an accented word reaches the foreign phonemizer whole
        // rather than being split at the accent. Asserted as faithful DELEGATION — the embedded reading
        // must equal what the foreign engine gives for the same word standalone.
        for (const w of ["café", "naïve", "résumé"])
            expect(phonemize(`${w} век`, "ru")).toBe(`${phonemize(w, "en")} ${phonemize("век", "ru")}`);
        // The English OOV defect this used to work around is fixed (foldLatinDiacritics): café now reads
        // [kəfˈeᶦ] rather than [kʰˈæf], so the delegated reading is correct as well as faithful.
        expect(phonemize("café век", "ru")).toBe("kəfˈeᶦ vʲek");
    });
});
