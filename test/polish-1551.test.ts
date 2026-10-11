// #1551 — Polish ą/ę before a dental or retroflex fricative is the nasal glide [w̃], as #1522 made it before f/v.
// The referees cannot decide this (wikipron lists [n] and [w̃] side by side; epitran writes a nasal vowel), so it
// follows standard orthoepy. Expectations were derived by running the fixed engine.
// Mirrored in csharp/…/Polish1551Tests.cs and rust/…/polish/polish.rs.
import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/polish/polish.ts";

describe("#1551 Polish", () => {
    test("ą/ę before s z ʂ ʐ is the [w̃] glide", () => {
        expect(phonemizeWord("wąs")).toBe("vˈɔw̃s");
        expect(phonemizeWord("język")).toBe("jˈɛw̃zɨk");
        expect(phonemizeWord("mąż")).toBe("mˈɔw̃ʂ"); // ż devoiced word-finally
        expect(phonemizeWord("węże")).toBe("vˈɛw̃ʐɛ");
        expect(phonemizeWord("mięso")).toBe("mjˈɛw̃sɔ");
    });

    test("the stops, affricates and the velar fricative keep their nasal consonant", () => {
        expect(phonemizeWord("wąchać")).toBe("vˈɔŋxat͡ɕ");
        expect(phonemizeWord("ręce")).toBe("rˈɛnt͡sɛ");
        expect(phonemizeWord("kąt")).toBe("kˈɔnt");
        expect(phonemizeWord("gęś")).toBe("ɡˈɛw̃ɕ"); // the soft fricative was already [w̃]
    });
});
