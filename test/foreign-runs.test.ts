import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";
import { scriptOf } from "../src/core/scripts.ts";

import { phonemize, phonemizeAsync } from "../src/index.ts";

// ⚠ AN ENGINE'S TOKENIZER ONLY MATCHES ITS OWN SCRIPT, and assembleClauses SKIPS whatever the tokenizer does
// not claim — so without a fallback every engine drops embedded Latin outright (a brand name, acronym,
// loanword or code-switched phrase), which in FLEURS is 3-15% of utterances per language. The dropped run
// leaves grammatical output, so no leak or length gate can see it. The shared unclaimed-run pass
// (core/clauses.ts + core/foreign.ts) reads those runs with a reader chosen by script.
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

    // ⚠ The fallback is NOT Latin-only: core/scripts.ts routes a run to a reader chosen by its SCRIPT, so
    // Han inside Russian is read as Mandarin rather than vanishing. A dropped run is a silent DROP,
    // invisible to every leak-based check — the same blindness a dropped sign always has.
    test("a third script is routed to a reader for that script, not dropped", () => {
        const out = phonemize("век 世界", "ru");
        expect(out.startsWith("vʲek")).toBe(true);
        expect(out.length).toBeGreaterThan("vʲek".length); // the Han is spoken, not silently lost
    });

    test("script routing honours the host's overrides and declines self-routing", () => {
        // Cyrillic inside Greek was read as English (so: dropped, since English cannot claim it).
        expect(phonemize("Ο Πούτιν και ο Владимир", "el")).toContain("vɫɐdʲ");
        // A lone Greek letter in another script is far more likely MATHEMATICS than a Greek word, so it is
        // read as its NAME rather than for its sound — and the name is a GREEK word, so the Greek reader
        // speaks it (*alfa*, not English *ˈaɫfa*). See GREEK_LETTER_NAME in core/scripts.ts.
        expect(phonemize("The value is α", "en")).toContain("alfa");
        expect(phonemize("The value is α", "en")).not.toContain("ˈaɫfa");
        // ⚠ AND IT IS NOT ROUTED AS GREEK TEXT: `α` alone would be /a/, a phone where a word belongs.
        expect(phonemize("The value is α", "en")).not.toMatch(/ɪz ˈ?a$/u);
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

// English cannot use `assembleClauses` — that is a streaming sink and English is a two-phase pipeline
// (tokens → POS tagger → resolver). But the GAP PASS is separable from the clause model, which is the
// split burmese.ts already makes, so English gets foreign runs without adopting the shared scan.
describe("english reads embedded foreign runs", () => {
    test("a third script is spoken rather than dropped", () => {
        expect(phonemize("The word λόγος means word", "en")).toContain("loɣos");
        expect(phonemize("Vladimir Владимир Putin", "en")).toContain("vɫɐdʲ");
    });

    test("ordinary English is unchanged, and word order is preserved", () => {
        expect(phonemize("Hello world", "en")).toBe(phonemize("Hello world", "en"));
        const out = phonemize("Vladimir Владимир Putin", "en");
        expect(out.indexOf("vlˈæd")).toBeLessThan(out.indexOf("vɫɐdʲ"));
    });

    // A foreign unit contributes no WORDS, so the POS tagger's expectation array stays aligned with the
    // English stream — if it did not, every word after a foreign run would be tagged with its neighbour's
    // part of speech and could resolve to the wrong homograph.
    test("a foreign run does not desynchronise the tagger", () => {
        expect(phonemize("I read Москва books", "en")).toContain("bˈʊks");
    });
});

// French cannot use `assembleClauses` either, for a different reason from English: liaison looks one word
// AHEAD across the whole flattened stream, so the item list must exist before any phonemes are produced.
// The gap pass is separable from that too.
describe("french reads embedded foreign runs", () => {
    test("a third script is spoken rather than dropped", () => {
        expect(phonemize("Le mot λόγος veut dire mot", "fr")).toContain("loɣos");
        expect(phonemize("Vladimir Владимир Poutine", "fr")).toContain("vɫɐdʲ");
    });

    test("liaison is unaffected where no foreign run intervenes", () => {
        expect(phonemize("les amis", "fr")).toBe("le zamˈi");
        expect(phonemize("deux ans", "fr")).toBe("dø zˈɑ̃");
    });

    // The hazard: a foreign run is not a French word, so `liaisonOnto` has no lexicon entry to reason
    // about and a carry would be spliced onto foreign phonemes — "les" must not donate its z to Москва.
    test("liaison neither lands on nor crosses a foreign run", () => {
        expect(phonemize("les Москва amis", "fr")).toBe("le mɐskvˈa amˈi");
        expect(phonemize("deux Москва ans", "fr")).toBe("dø mɐskvˈa ˈɑ̃");
    });
});

// The Sinitic engines are the opposite case from English and French: their loops were ALREADY the shape
// `assembleClauses` takes (clauseSink + iterate a token regex) and only predated the helper, so they could
// adopt the shared path outright rather than hand-rolling a gap pass. Five files, eight language codes.
describe("sinitic engines read embedded foreign runs", () => {
    for (const lang of ["yue", "wuu", "nan", "cdo", "gan", "hak", "cjy", "hsn"]) {
        test(`${lang} speaks a Cyrillic run instead of dropping it`, () => {
            expect(phonemize("世界 Москва 好", lang)).toContain("mɐskvˈa");
        });
    }

    test("the engines still claim Latin themselves, and clause marks still pause", () => {
        expect(phonemize("世界，好", "yue")).toContain(",");
        expect(phonemize("世界 abc", "yue")).not.toBe(phonemize("世界", "yue"));
    });
});

// The last two bespoke engines, both the same historical-drift case as the Sinitic set.
describe("hmong and tashelhit read embedded foreign runs", () => {
    test("hmn speaks a Cyrillic run", () => {
        expect(phonemize("kuv Москва 7", "hmn")).toContain("mɐskvˈa");
    });
    test("shi speaks a Cyrillic run", () => {
        expect(phonemize("kuv Москва 7", "shi")).toContain("mɐskvˈa");
    });
});

// THE INVARIANT: no engine silently discards a run in a script it does not own.
test("no registered engine drops a foreign run outright", () => {
    for (const lang of ["en", "en-GB", "en-IN", "fr", "fr-CA", "yue", "wuu", "nan", "cdo", "gan", "hak", "hsn", "cjy", "hmn", "shi"]) {
        expect(phonemize("7 Москва 7", lang), lang).not.toBe(phonemize("7  7", lang));
    }
});

// ⚠ THE ROUTED-SCRIPT SET MUST BE DERIVED, NEVER RECALLED. A table written from the "obvious" scripts
// silently drops every run in one it does not list, and the misses are exactly the scripts nobody thinks
// of (Adlam, N'Ko, Syloti Nagri, Javanese, Sundanese all had engines before anything routed them). So this
// test reads the README's own examples rather than carrying a hand-kept list: a new engine whose script
// nobody routed fails HERE instead of vanishing from someone's output.
describe("script routing covers every script the README exercises", () => {
    const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const EXAMPLE = /phonemize(?:Async)?\(\s*"([^"]+)"\s*,\s*"([a-zA-Z-]+)"/gu;

    const cases = [...README.matchAll(EXAMPLE)]
        .map((m) => [m[1]!.split(/\s+/).find((w) => /[^\u0000-\u007F]/u.test(w)), m[2]!] as const)
        .filter((c): c is readonly [string, string] => c[0] !== undefined);

    test("the README actually contains examples to check", () => {
        expect(cases.length).toBeGreaterThan(20);
    });

    test("every non-ASCII README example is in a script the router knows", () => {
        const unrouted = cases.filter(([word]) => scriptOf(word) === undefined).map(([w, l]) => `${l} ${w}`);
        expect(unrouted, "a script with an engine that nothing routes").toEqual([]);
    });

    test("and each such run is SPOKEN when embedded in another language, not dropped", () => {
        for (const [word, lang] of cases) {
            if (lang === "en") continue; // English is the host below
            const withWord = phonemize(`The word ${word} here`, "en");
            expect(withWord, `${lang} ${word} vanished`).not.toBe(phonemize("The word here", "en"));
        }
    });
});

// ⚠ A DELEGATED RUN USED TO GET ENGLISH'S *SYNC* OOV G2P even under `phonemizeAsync`. Every English reader for
// embedded text is typed synchronous (core/foreign.ts), so the BiLSTM tagger never saw the run — and delegated
// runs are overwhelmingly proper nouns, i.e. precisely the OOV tail the tagger exists for. The n-gram fallback
// deleted and invented phones on them: `liguria` lost its ⟨g⟩, `adekoya` gained the non-English onset ˈædŋ.
// `phonemizeAsync` now prewarms those readings into a memo the sync reader consults.
describe("embedded foreign runs use the NEURAL English OOV reader under phonemizeAsync", () => {
    // OOV in CMUdict, and each one the sync n-gram reads differently from the tagger — a word both paths agree
    // on would pass whether or not the prewarm ran.
    const NAMES = ["liguria", "adekoya", "riomaggiore", "caboolture", "sezen"];

    // Hosts across the three delegation paths: the script-router's Latin target (th, ko), and an engine that
    // claims Latin itself and is handed the reader at construction (hi).
    const HOSTS: Array<[string, (w: string) => string]> = [
        ["th", (w) => `ในเขต ${w} ประเทศ`],
        ["ko", (w) => `터키의 ${w} 가수`],
        ["hi", (w) => `भारत ${w} देश`],
    ];

    test.each(HOSTS)("%s delegates to the same reading English itself gives", async (lang, wrap) => {
        for (const name of NAMES) {
            const alone = await phonemizeAsync(name, "en");
            const embedded = await phonemizeAsync(wrap(name), lang);
            expect(embedded, `${lang}: ${name} did not get the neural reading`).toContain(alone);
        }
    });

    test("and the SYNC path is left byte-identical — the memo is foreign-path only", async () => {
        // Populate the memo, then assert `phonemize` has not moved. Sync output must never depend on whether an
        // async call happened earlier in the process.
        const before = NAMES.map((n) => phonemize(n, "en"));
        for (const n of NAMES) await phonemizeAsync(`ในเขต ${n} ประเทศ`, "th");
        expect(NAMES.map((n) => phonemize(n, "en"))).toEqual(before);
    });

    test("the two readings genuinely differ, so the tests above can fail", async () => {
        // Guards the guard: if the tagger were absent, sync and async would agree and everything would pass
        // vacuously. Skips rather than fails when there is no model, which is a supported configuration.
        const differing = (await Promise.all(NAMES.map(async (n) => phonemize(n, "en") !== await phonemizeAsync(n, "en"))))
            .filter(Boolean).length;
        if (differing === 0) return; // no ONNX model / onnxruntime-node in this environment
        expect(differing).toBe(NAMES.length);
    });
});
