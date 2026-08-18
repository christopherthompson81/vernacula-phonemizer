import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeCroatian } from "../src/languages/croatian/normalize.ts";
import { phonemizeWord } from "../src/languages/serbian/serbian.ts";

// Croatian (hr) — South Slavic, Gaj's Latin. A THIN module: the SEGMENTAL grapheme→IPA is the shared Serbo-Croatian
// g2p (Croatian reuses the Serbian engine's phonemizeWord verbatim — the two standards are one phonological system),
// so word-level output is byte-identical to Serbian. The ONLY Croatian-specific delta is the CARDINAL NUMBER WORDS
// (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta). Pitch accent unwritten → deferred (as sr).
describe("Croatian (hr) canonical IPA", () => {
    test("shared Serbo-Croatian g2p: words identical to the Serbian engine", () => {
        for (const w of ["hrvatski", "mlijeko", "čovjek", "đak", "ljubav", "zdravlje", "tisuća", "vrijeme"]) {
            expect(phonemize(w, "hr").trim()).toBe(phonemizeWord(w));
        }
    });

    test("Croatian-specific grapheme→IPA (Gaj's Latin, Ijekavian read as letters)", () => {
        expect(phonemize("mlijeko", "hr").trim()).toBe("mlijˈeː˩˥ko"); // Ijekavian "milk"
        expect(phonemize("đak", "hr").trim()).toBe("d͡ʑaː˥˩k"); // ⟨đ⟩ → d͡ʑ
        expect(phonemize("ljubav", "hr").trim()).toBe("ʎˈuː˩˥baʋ"); // ⟨lj⟩ → ʎ, ⟨v⟩ → ʋ
        expect(phonemize("čovjek", "hr").trim()).toBe("t͡ʃˈoʋjek"); // ⟨č⟩ → t͡ʃ
    });

    test("CROATIAN cardinal numbers (tisuća/milijun/dvjesto ≠ Serbian hiljada/milion/dvesta)", () => {
        expect(phonemize("1000", "hr").trim()).toBe("tˈisut͡ɕu"); // tisuću (NOT Serbian hiljadu)
        expect(phonemize("2000", "hr").trim()).toBe("dʋˈi˥˩je tˈi˥˩sut͡ɕe"); // dvije tisuće
        expect(phonemize("200", "hr").trim()).toBe("dʋjˈe˥˩sto"); // dvjesto (NOT Serbian dvesta)
        expect(phonemize("1000000", "hr").trim()).toBe("jˈe˩˥dan milˈi˩˥jun"); // milijun (NOT Serbian milion)
    });

    // GENDER on the magnitude noun: tisuća is FEMININE, so the multiplier is the IJEKAVIAN feminine dvije /
    // jedna (Serbian uses ekavian dve). milijun is masculine and keeps dva.
    test("numbers: gender agreement on the FEMININE tisuća (ijekavian dvije)", () => {
        expect(phonemize("1000", "hr").trim()).toBe("tˈisut͡ɕu"); // tisuću — the standalone form
        expect(phonemize("2000", "hr").trim()).toBe("dʋˈi˥˩je tˈi˥˩sut͡ɕe"); // dvije tisuće (not *dva tisuće)
        expect(phonemize("5000", "hr").trim()).toBe("peː˥˩t tˈisut͡ɕa"); // pet tisuća — gen.pl
        expect(phonemize("21000", "hr").trim()).toBe("dʋˈaː˩˥deset jˈedna tˈisut͡ɕa"); // dvadeset jedna tisuća
        expect(phonemize("1000000", "hr").trim()).toBe("jˈe˩˥dan milˈi˩˥jun"); // masculine
        expect(phonemize("2000000", "hr").trim()).toBe("dʋaː˥˩ mˈilijuna"); // dva milijuna — masculine keeps dva
    });
});

// TEXT NORMALIZATION (src/languages/croatian/normalize.ts) — the pre-tokenizer pass, modeled on
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
        // further licensors, taken from a tabulation of what the closed list was leaving behind
        expect(normalizeCroatian("zauzeo 190. mjesto")).toBe("zauzeo sto devedeseto mjesto");
        expect(normalizeCroatian("oluja 4. kategorije")).toBe("oluja četvrte kategorije");
        expect(ph("7. najvećim")).toBe("sˈedmom nˈajʋet͡ɕim");
        expect(ph("15. stoljeća")).toBe("pˈetnaestoɡ stˈoʎet͡ɕa"); // neuter genitive
    });

    test("period-thousands de-group; comma-decimals read zarez", () => {
        expect(ph("2.500 ¥")).toBe("dʋˈi˥˩je tˈi˥˩sut͡ɕe pˈeː˥˩tsto jen");
        expect(ph("40.000")).toBe("t͡ʃetrdˈe˩˥set tˈisut͡ɕa");
        expect(ph("2,4 Ghz")).toBe("dʋaː˥˩ zˈarez t͡ʃˈe˩˥tiri ɡˈiɡaxert͡sa");
    });

    test("clocks read the h-suffix; rates use na sat", () => {
        expect(ph("22:00 i 23:00 h")).toBe("dʋˈaː˩˥deset dʋaː˥˩ sˈaː˥˩ta i dʋˈaː˩˥deset triː˥˩ sˈaː˥˩ta");
        expect(ph("23:35 h")).toBe("dʋˈaː˩˥deset triː˥˩ sˈaː˥˩ta i trˈiː˩˥deset peː˥˩t minˈuː˩˥ta");
        expect(ph("70 km/h")).toBe("sedamdˈe˩˥set kˈilometara na saː˥˩t");
        expect(ph("40 milja/h")).toBe("t͡ʃetrdˈe˩˥set mˈiː˥˩ʎa na saː˥˩t");
    });

    test("era markers expand; roman ordinals inflect; initialisms expand", () => {
        expect(ph("n. e.")).toBe("nˈoʋe ˈere .");
        expect(ph("p.n.e.")).toBe("prˈi˥˩je nˈoʋe ˈere .");
        // trap pins: the g. n. e. / g. pr. Kr. forms (400. g. n. e., 1000. g. pr. Kr.)
        expect(ph("od 400. g. n. e.")).toBe("od t͡ʃˈetiristote nˈoʋe ˈere .");
        expect(ph("1000. g. pr. Kr. Asirci")).toBe("tˈisut͡ɕite prˈi˥˩je krˈista asˈiː˩˥rt͡si");
        expect(ph("I. svjetskog rata")).toBe("pˈrʋoɡ sʋjˈetskoɡ rˈata");
        expect(ph("II. svjetskom ratu")).toBe("drˈuː˥˩ɡom sʋjˈetskom rˈatu");
        expect(ph("itd.")).toBe("i tˈa˩˥ko dˈa˥˩ʎe .");
        expect(ph("Dr. Moll")).toBe("dˈo˥˩ktor moll");
        // ⚠ GOLDEN CHANGED, and it was pinning a DELETION. ⟨W⟩ is outside Gaj's Latin, the shared g2p had
        // no rule for it, and the middle initial simply vanished (`ɡeorɡe busx`). It now folds to ⟨v⟩ —
        // the reading Croatian gives the letter in *Velšani*, *velški* — so the initial is audible.
        // ⚠ AND IT IS NOT A NEW CONVENTION, IT IS THE EXISTING ONE. This engine already reads a lone
        // initial as its bare phone rather than its letter name: `V.` → *ʋ*, `B.` → *b*. ⟨W⟩ now joins
        // them instead of being the one initial that disappears. See FOREIGN_LETTER in croatian.ts.
        expect(ph("George W. Bush")).toBe("ɡˈeorɡe ʋ busx");
        expect(ph("George V. Bush")).toBe("ɡˈeorɡe ʋ busx"); // the native letter, for the comparison
    });

    test("degrees, fractions, ranges and signs read their Croatian words", () => {
        expect(ph("90 °F")).toBe("deʋedˈe˩˥set stˈupɲeʋa fˈarenxajta");
        expect(ph("35° W")).toBe("trˈiː˩˥deset peː˥˩t stˈupɲeʋa zˈaː˥˩padno");
        expect(ph("1/5 inča")).toBe("jˈe˩˥dan pˈeti ˈiː˥˩nt͡ʃa");
        expect(ph("1990-1995")).toContain("do");
        expect(ph("4×4")).toBe("t͡ʃˈe˩˥tiri pˈuta t͡ʃˈe˩˥tiri");
        expect(ph("-5")).toBe("mˈiː˩˥nus peː˥˩t");
        expect(ph("UTC+1")).toBe("utt͡s plus jˈe˩˥dan");
    });
});
