import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeCroatian } from "../src/languages/croatian/normalize.ts";
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

// TEXT NORMALIZATION (src/languages/croatian/normalize.ts) — the pre-tokenizer pass behind #562, modeled on
// the Serbian normalize. The defining rules are the N. ordinal with its Croatian licensors (month genitives,
// stoljeća, najvećim), the period-thousands vs ordinal disambiguation, the comma-decimal "zarez", the h-clock
// suffix, the n.e./p.n.e. era markers, and the prenominal roman ordinals (I./II. svjetski rat).
describe("Croatian text normalization", () => {
    const ph = (s: string): string => phonemize(s, "hr").trim();

    test("text→text: the N. ordinal reads the Croatian inflected ordinal", () => {
        // A YEAR is an ordinal too, with `godine` elided — 102 of the corpus's 216 `N.` instances. The
        // period is kept only where it is ALSO a sentence end (an utterance end, or a capital after it).
        expect(normalizeCroatian("15. kolovoza 1940.")).toBe("petnaestog kolovoza tisuću devetsto četrdesete.");
        expect(normalizeCroatian("1683. dinastija Qing")).toBe("tisuću šeststo osamdeset treće dinastija Qing");
        expect(normalizeCroatian("(1644. - 1912.) prisilno")).toBe("(tisuću šeststo četrdeset četvrte - tisuću devetsto dvanaeste) prisilno");
        expect(normalizeCroatian("rezultata 6:6.")).toBe("rezultata 6:6."); // a sentence-final score is not an ordinal
        // followers added from the tabulation of what the closed list was leaving behind
        expect(normalizeCroatian("zauzeo 190. mjesto")).toBe("zauzeo sto devedeseto mjesto");
        expect(normalizeCroatian("oluja 4. kategorije")).toBe("oluja četvrte kategorije");
        expect(ph("7. najvećim")).toBe("sedmom najʋet͡ɕim");
        expect(ph("15. stoljeća")).toBe("petnaestoɡ stoʎet͡ɕa"); // neuter genitive
    });

    test("period-thousands de-group; comma-decimals read zarez", () => {
        expect(ph("2.500 ¥")).toBe("dʋije tisut͡ɕe petsto jen");
        expect(ph("40.000")).toBe("t͡ʃetrdeset tisut͡ɕa");
        expect(ph("2,4 Ghz")).toBe("dʋa zarez t͡ʃetiri ɡiɡaxert͡sa");
    });

    test("clocks read the h-suffix; rates use na sat", () => {
        expect(ph("22:00 i 23:00 h")).toBe("dʋadeset dʋa sata i dʋadeset tri sata");
        expect(ph("23:35 h")).toBe("dʋadeset tri sata i trideset pet minuta");
        expect(ph("70 km/h")).toBe("sedamdeset kilometara na sat");
        expect(ph("40 milja/h")).toBe("t͡ʃetrdeset miʎa na sat");
    });

    test("era markers expand; roman ordinals inflect; initialisms expand", () => {
        expect(ph("n. e.")).toBe("noʋe ere .");
        expect(ph("p.n.e.")).toBe("prije noʋe ere .");
        // trap pins: the g. n. e. / g. pr. Kr. forms (400. g. n. e., 1000. g. pr. Kr.)
        expect(ph("od 400. g. n. e.")).toBe("od t͡ʃetiristote noʋe ere .");
        expect(ph("1000. g. pr. Kr. Asirci")).toBe("tisut͡ɕite prije krista asirt͡si");
        expect(ph("I. svjetskog rata")).toBe("prʋoɡ sʋjetskoɡ rata");
        expect(ph("II. svjetskom ratu")).toBe("druɡom sʋjetskom ratu");
        expect(ph("itd.")).toBe("i tako daʎe .");
        expect(ph("Dr. Moll")).toBe("doktor moll");
        expect(ph("George W. Bush")).toBe("ɡeorɡe busx");
    });

    test("degrees, fractions, ranges and signs read their Croatian words", () => {
        expect(ph("90 °F")).toBe("deʋedeset stupɲeʋa farenxajta");
        expect(ph("35° W")).toBe("trideset pet stupɲeʋa zapadno");
        expect(ph("1/5 inča")).toBe("jedan peti int͡ʃa");
        expect(ph("1990-1995")).toContain("do");
        expect(ph("4×4")).toBe("t͡ʃetiri puta t͡ʃetiri");
        expect(ph("-5")).toBe("minus pet");
        expect(ph("UTC+1")).toBe("utt͡s plus jedan");
    });
});
