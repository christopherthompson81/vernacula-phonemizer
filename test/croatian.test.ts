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

    /**
     * BCS HAS NO PHONEMIC GEMINATES, and a doubled consonant letter reaches this engine only in a loan or
     * a foreign name — 175 distinct such word types across the hr/bs/sr corpus, every one of them a loan.
     * Re-scored against the recognized phones over the 609 geminate-bearing utterances: 544 closer to what
     * the reader said, 39 further, mean distance 0.1858 → 0.1822.
     *
     * ⚠ THE SUPERLATIVE SEAM IS NOT AN EXCEPTION, and it was written as one before the audio was checked.
     * `naj-` before a ⟨j⟩-initial stem is the one doubled consonant BCS writes natively, so exempting it
     * looked obviously right — but the readers say a single /j/ (`n aː j e d n o s t a v n i`), with the
     * length on the prefix vowel instead. The prefix seams a grammar would predict (podd-, izz-, nuzz-)
     * appear in neither the corpus nor the referee, so there is nothing to carve out either.
     *
     * ⚠ THE REFEREE CANNOT ADJUDICATE THIS — it holds four such words and contradicts itself on them: the
     * same human set keeps `Matteo`'s Italian geminate and drops `inšallah`'s (`ǐ n ʃ a l aː x`, which is
     * what we now emit). Net −2 of 26,486 on the primary. The audio is the instrument that can decide it.
     */
    test("doubled consonants degeminate; doubled VOWELS do not", () => {
        expect(phonemize("Anna", "hr")).toBe("ˈana");
        expect(phonemize("Holland", "hr")).toBe("xˈoland");
        expect(phonemize("Ellsworth", "hr")).toBe("ˈelsʋortx");
        expect(phonemize("najjednostavniji", "hr")).toBe("nˈajednostaʋniji");
        // ⚠ A DOUBLED VOWEL IS TWO SYLLABLES in a loan, not a long vowel — only consonants collapse.
        expect(phonemize("zoo", "hr")).toBe("zˈoo");
        // ⚠ AND AN INITIALISM IS A LETTER RUN, NOT A WORD. Collapsing there DELETES a letter — `BBC` read
        //   as *bt͡s*, `www` as a single *ʋ*, and in the sibling engines `СССР` as *sr* and `MMF` as *mf*.
        //   Guarded on the no-vowel signature, which a real BCS word carrying a geminate cannot trip:
        //   they are all loans, and loans have vowels.
        // ⚠ MOVED when the initialism pass landed: the run is now SPELLED OUT (see serbian/normalize.ts).
        expect(phonemize("BBC", "hr")).toBe("be be t͡se");
        expect(phonemize("www", "hr")).toBe("ʋʋʋ");
        // ⚠ AND THE GUARD IS CASE-INDEPENDENT. An "all caps" signature was tried and is wrong — it makes
        //   degemination depend on capitalisation for ordinary words, so a headline or an all-caps proper
        //   noun keeps a geminate the language does not have.
        expect(phonemize("HOLLAND", "hr")).toBe(phonemize("Holland", "hr"));
        expect(phonemize("ANNA", "hr")).toBe(phonemize("Anna", "hr"));
    });

    // ⚠ THE BEARING AMBIGUITY GUARD IS CASE-SENSITIVE. `s` is the preposition "with" and `S` is *južno*;
    //   only the lowercase letter needs to be attached to the degree, or a spaced uppercase latitude stops
    //   reading. Croatian gained a bare-degree arm at the same time: while the compass arm swallowed a
    //   spaced ⟨s⟩ there was no unclaimed bare degree in this corpus, and requiring attachment creates one.
    test("a degree bearing: lowercase is a word, uppercase is a bearing", () => {
        expect(phonemize("35° s padavinama", "hr")).toContain("stˈupɲeʋa s ");
        expect(phonemize("35° S od ekvatora", "hr")).toContain("jˈu˥˩ʒno");
        expect(phonemize("35° w", "hr")).toContain("zˈaː˥˩padno");
        expect(phonemize("35°", "hr")).toBe("trˈiː˩˥deset peː˥˩t stˈupɲeʋa");
        // ⚠ COUNT AGREEMENT, like every other counted noun in this file. The genitive plural is only right
        //   from five up, and the arm was hardcoding it.
        expect(phonemize("1°", "hr")).toContain("stˈuː˥˩paɲ");
        expect(phonemize("2°", "hr")).toContain("stˈupɲa");
        // ⚠ AND THE REPLACEMENT ENDS IN A SPACE. Consuming a letter class cannot stop the gluing — the
        //   class is finite and the alphabet is not — so `300°K` landed inside the noun as *stupnjevak*,
        //   sending the stress lookup to a word that does not exist.
        expect(phonemize("Temperatura 300°K je", "hr")).toContain("stˈupɲeʋa k");
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
        expect(phonemize("21000", "hr").trim()).toBe("dʋˈaː˩˥deset jednˈa tˈisut͡ɕa"); // dvadeset jedna tisuća
        expect(phonemize("1000000", "hr").trim()).toBe("jˈe˩˥dan milˈi˩˥jun"); // masculine
        expect(phonemize("2000000", "hr").trim()).toBe("dʋaː˥˩ milijˈuna"); // dva milijuna — masculine keeps dva
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
        expect(ph("15. stoljeća")).toBe("petnˈaestoɡ stˈoʎet͡ɕa"); // neuter genitive
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
        expect(ph("od 400. g. n. e.")).toBe("od t͡ʃetˈiristote nˈoʋe ˈere .");
        expect(ph("1000. g. pr. Kr. Asirci")).toBe("tisˈut͡ɕite prˈi˥˩je krˈista asˈiː˩˥rt͡si");
        expect(ph("I. svjetskog rata")).toBe("pˈr˩˥ʋoɡ sʋjˈetskoɡ rˈata");
        expect(ph("II. svjetskom ratu")).toBe("drˈuː˥˩ɡom sʋjˈetskom rˈatu");
        expect(ph("itd.")).toBe("i tˈa˩˥ko dˈa˥˩ʎe .");
        // ⚠ `mol`, not `moll` — this golden pinned a geminate the language does not have. The reader of
        //   this very utterance says a single /l/ (`m o l o t k r e`); see the degemination test above.
        expect(ph("Dr. Moll")).toBe("dˈo˥˩ktor mol");
        // ⚠ GOLDEN CHANGED, and it was pinning a DELETION. ⟨W⟩ is outside Gaj's Latin, the shared g2p had
        // no rule for it, and the middle initial simply vanished (`ɡeorɡe busx`). It now folds to ⟨v⟩ —
        // the reading Croatian gives the letter in *Velšani*, *velški* — so the initial is audible.
        // ⚠ AND IT IS NOT A NEW CONVENTION, IT IS THE EXISTING ONE. This engine already reads a lone
        // initial as its bare phone rather than its letter name: `V.` → *ʋ*, `B.` → *b*. ⟨W⟩ now joins
        // them instead of being the one initial that disappears. See `foreignLetters` in serbian.ts.
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
        // ⚠ MOVED when the initialism pass landed: the run is now SPELLED OUT (see serbian/normalize.ts).
        expect(ph("UTC+1")).toBe("u te t͡se plus jˈe˩˥dan");
    });
});
