import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/serbian/serbian.ts";

// Croatian (hr) — South Slavic, Gaj's Latin. A THIN module: the SEGMENTAL grapheme→IPA is the shared Serbo-Croatian
// g2p (Croatian reuses the Serbian engine's phonemizeWord verbatim — the two standards are one phonological system),
// so word-level output is byte-identical to Serbian. The ONLY Croatian-specific delta is the CARDINAL NUMBER WORDS
// (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta). Pitch accent unwritten → deferred (as sr).
// See docs/investigations/hr_native_bringup_investigation.md.
describe("Croatian (hr) canonical IPA", () => {
    test("shared Serbo-Croatian g2p: words identical to the Serbian engine", () => {
        for (const w of ["hrvatski", "mlijeko", "čovjek", "đak", "ljubav", "zdravlje", "tisuća", "vrijeme"]) {
            expect(phonemize(w, "hr").trim()).toBe(phonemizeWord(w));
        }
    });

    test("Croatian-specific grapheme→IPA (Gaj's Latin, Ijekavian read as letters)", () => {
        expect(phonemize("mlijeko", "hr").trim()).toBe("mlijeko"); // Ijekavian "milk"
        expect(phonemize("đak", "hr").trim()).toBe("d͡ʑak"); // ⟨đ⟩ → d͡ʑ
        expect(phonemize("ljubav", "hr").trim()).toBe("ʎubaʋ"); // ⟨lj⟩ → ʎ, ⟨v⟩ → ʋ
        expect(phonemize("čovjek", "hr").trim()).toBe("t͡ʃoʋjek"); // ⟨č⟩ → t͡ʃ
    });

    test("CROATIAN cardinal numbers (tisuća/milijun/dvjesto ≠ Serbian hiljada/milion/dvesta)", () => {
        expect(phonemize("1000", "hr").trim()).toBe("tisut͡ɕu"); // tisuću (NOT Serbian hiljadu)
        expect(phonemize("2000", "hr").trim()).toBe("dʋije tisut͡ɕe"); // dvije tisuće
        expect(phonemize("200", "hr").trim()).toBe("dʋjesto"); // dvjesto (NOT Serbian dvesta)
        expect(phonemize("1000000", "hr").trim()).toBe("jedan milijun"); // milijun (NOT Serbian milion)
    });

    // GENDER on the magnitude noun: tisuća is FEMININE, so the multiplier is the IJEKAVIAN feminine dvije /
    // jedna (Serbian uses ekavian dve). milijun is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE tisuća (ijekavian dvije)", () => {
        expect(phonemize("1000", "hr").trim()).toBe("tisut͡ɕu"); // tisuću — the standalone form
        expect(phonemize("2000", "hr").trim()).toBe("dʋije tisut͡ɕe"); // dvije tisuće (not *dva tisuće)
        expect(phonemize("5000", "hr").trim()).toBe("pet tisut͡ɕa"); // pet tisuća — gen.pl
        expect(phonemize("21000", "hr").trim()).toBe("dʋadeset jedna tisut͡ɕa"); // dvadeset jedna tisuća
        expect(phonemize("1000000", "hr").trim()).toBe("jedan milijun"); // masculine
        expect(phonemize("2000000", "hr").trim()).toBe("dʋa milijuna"); // dva milijuna — masculine keeps dva
    });
});
