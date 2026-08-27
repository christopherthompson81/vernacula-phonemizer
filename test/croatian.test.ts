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
    test("⟨th⟩ folds to [t] in foreign words but NOT across a native prefix boundary", () => {
        // Croatian adapts foreign /θ/ as /t/ (teorija, matematika); ⟨h⟩ alone is /x/, so an unfolded
        // ⟨th⟩ gave the impossible *txe*. 128 closer / 17 further across the sr/hr/bs FLEURS audio.
        expect(phonemize("the", "hr")).toBe("te");
        expect(phonemize("Matthew", "hr")).toBe("mˈateʋ");
        expect(phonemize("Thomson", "hr")).toBe("tˈomson");
        expect(phonemize("Lufthansa", "hr")).toBe("lˈuftansa");
        // ⚠ NATIVE ⟨th⟩ IS A PREFIX BOUNDARY and keeps [tx] — pred+hod, pod+hraniti, pod+hlađen.
        // Folding these was the net-negative version of this change: 104 native tokens in the corpora.
        expect(phonemize("prethodni", "hr")).toContain("txodni");
        expect(phonemize("pothranjenost", "hr")).toContain("txraɲenost");
        expect(phonemize("pothlađenost", "hr")).toContain("txlad͡ʑenost");
    });

    test("doubled consonants degeminate; doubled VOWELS do not", () => {
        expect(phonemize("Anna", "hr")).toBe("ˈana");
        expect(phonemize("Holland", "hr")).toBe("xˈoland");
        expect(phonemize("Ellsworth", "hr")).toBe("ˈelsʋort"); // ⟨ll⟩ degeminates; ⟨th⟩ folds to t (see below)
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

    /**
     * ⚠ THE ERA MARKER IS LOWERCASE-ONLY, AND SERBIAN'S FIX FOR THIS CITED *THIS* CORPUS WITHOUT EVER BEING
     * APPLIED HERE. `n.e.` is also two INITIALS with stops, and the era block runs BEFORE the
     * dotted-capital-run rule that would otherwise claim them, so a case-insensitive era rule replaced a
     * NAME with a date: `N. E. Kovač je došao` read *nove ere Kovač*. All six era instances in FLEURS hr_hr
     * are lowercase; initials are capitals.
     */
    test("the era marker declines a pair of CAPITAL initials", () => {
        expect(ph("N. E. Kovač je došao")).toBe("ne kˈo˩˥ʋat͡ʃ je dˈoʃao");
        expect(ph("P. N. E. Horvat")).toBe("pne xˈo˩˥rʋat");
        // …and every lowercase era form the corpus writes still reads.
        expect(ph("n.e. i dalje")).toBe("nˈoʋe ˈere i dˈa˥˩ʎe");
        expect(ph("p.n.e.")).toBe("prˈi˥˩je nˈoʋe ˈere .");
        expect(ph("od 1500. p. n. e.")).toBe("od tˈisut͡ɕu pˈetstote prˈi˥˩je nˈoʋe ˈere .");
        expect(ph("400. g. n. e.")).toBe("t͡ʃetˈiristote nˈoʋe ˈere .");
        expect(ph("1000. g. pr. Kr.")).toBe("tisˈut͡ɕite prˈi˥˩je krˈista ."); // the capital is IN the pattern
    });

    /**
     * ⚠ THE HYPHEN-SUFFIX ORDINAL ONLY EVER FIRED ON AN INPUT THAT WAS NOTHING BUT THE NUMERAL — which is
     * to say, on unit tests. Its trailing guard was `(?![^\p{L}\p{M}]|.)`, and the `|.` arm rejects EVERY
     * following character, so "end of word" was silently "end of input". In running text the rule was
     * dead: the 50 lines of this shape in FLEURS hr_hr (`1480-ih, kada je…`, `tijekom 1990-ih bilo je`)
     * read the CARDINAL and then a stray *ih* — the accusative clitic "them" — as a word of its own.
     * Serbian and Bosnian write the same rule with the shared NOT_LETTER_AFTER; Croatian is the copy that
     * lost it. ⚠ THE BARE-NUMERAL CASE IS THE ONE THAT KEPT PASSING, so it is not the regression pin: the
     * pins below are all mid-sentence.
     */
    test("the hyphen-suffix ordinal fires MID-SENTENCE, not only at end of input", () => {
        expect(ph("tijekom 1990-ih bilo je")).toBe("tijˈeː˥˩kom tˈisut͡ɕu dˈe˥˩ʋetsto deʋedˈe˩˥setix bˈilo je");
        expect(normalizeCroatian("u 1970-ih godinama")).toBe("u tisuću devetsto sedamdesetih godinama");
        expect(normalizeCroatian("15-og svibnja")).toBe("petnaestog svibnja");
        expect(normalizeCroatian("1480-ih, kada")).toBe("tisuću četiristo osamdesetih, kada");
        expect(normalizeCroatian("1970-ih")).toBe("tisuću devetsto sedamdesetih"); // the case that worked
        // …and the widened guard does not over-claim: a suffix no ordinal form ends in is left alone, and
        // a digit range still belongs to the range rule.
        expect(normalizeCroatian("3-d model")).toBe("3-d model");
        expect(normalizeCroatian("2-3 dana")).toBe("2 do 3 dana");
    });

    /**
     * ⚠ THE RATE PREPOSITION IS PER DENOMINATOR. A single `unitPer: "na"` is right for ⟨h⟩ only because
     * `sat` is syncretic in the accusative that `na` governs; the feminine `sekunda` is not, so `133 m/s`
     * and `1,5 km/s` — both written in FLEURS hr_hr — read *kilometara NA SEKUNDA*, a nominative under an
     * accusative preposition. BCS says *u sekundi*, which serbian/normalize.ts composes locally and
     * Croatian now declares through the keyed `unitPer` the shared tier added for exactly this.
     */
    test("the /s rate takes ⟨u sekundi⟩ while /h keeps ⟨na sat⟩", () => {
        expect(ph("133 m/s")).toBe("stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi");
        expect(ph("5 km/s")).toBe("peː˥˩t kˈilometara u sekˈuː˩˥ndi");
        expect(ph("70 km/h")).toBe("sedamdˈe˩˥set kˈilometara na saː˥˩t"); // the other denominator, unmoved
        expect(ph("40 mi/h")).toBe("t͡ʃetrdˈe˩˥set mˈiː˥˩ʎa na saː˥˩t");
    });

    /**
     * #1059, WHICH DID NOT PROPAGATE ALONG THE SHARED CORE. `serbian/numbers.ts` took the `raw` threading
     * with sr, but Croatian's own `numberToWords` wrapper dropped the parameter and croatian.ts never
     * passed a token string — so above 1e21 the fallback stringified the DOUBLE and
     * `1000000000000000000000` read *jˈe˩˥dan e dʋaː˥˩ jˈe˩˥dan*, "1 e + 2 1", with the ⟨e⟩ voiced as a
     * vowel and twenty-two digits gone.
     *
     * ⚠ AND THE STRING PASSED IS THE SEPARATOR-STRIPPED ONE, not the token match: Croatian groups thousands
     * with PERIODS and writes the decimal with a COMMA, both inside the number token, and croatian.ts
     * removes them before `Number()`. Passing the match would spell the separators out among the digits —
     * a reading that sounds plausible and is silently wrong.
     */
    describe("Croatian large numerals (#1059)", () => {
        test("a 22-digit run keeps its own digits", () => {
            const a = phonemize("1000000000000000000001", "hr");
            const b = phonemize("1000000000000000000009", "hr");
            expect(a).not.toBe(b);
            expect(a.split(" ").length).toBe(22);
            expect(a.endsWith("jˈe˩˥dan")).toBe(true);
            expect(b.endsWith("dˈe˥˩ʋet")).toBe(true);
            expect(a).not.toMatch(/[e+]\s/u); // no exponent form leaking into the stream
        });

        // Above 2^53 the double has already rounded, so the digits must come from the token, not from `n`.
        test("a 16-digit run past 2^53 reads its written digits", () => {
            expect(phonemize("9007199254740993", "hr").endsWith("triː˥˩")).toBe(true);
        });

        // ⚠ THE STRIPPING TRAP: a dot-grouped run that overflows must read DIGITS, never its periods. Nine
        // groups of three is 1e24, past the exponent cliff, and every one of those digits is a zero after
        // the leading 1 — a period read as a digit would show up as an extra token.
        test("a dot-grouped overflow reads exactly its digits, not its separators", () => {
            const read = phonemize("1.000.000.000.000.000.000.000.000", "hr").trim();
            expect(read.split(" ").length).toBe(25);
            expect(new Set(read.split(" ").slice(1)).size).toBe(1); // 24 zeroes, all the same word
        });

        // …and the composed path below the cap is untouched, decimal comma and all.
        test("the composed path is untouched", () => {
            expect(phonemize("1.000.000", "hr").trim()).toBe("jˈe˩˥dan milˈi˩˥jun");
            expect(phonemize("2,5", "hr").trim()).toBe("dʋaː˥˩ zˈarez peː˥˩t");
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The decimal comma's leading zeros — a 100× error shared by all three standards until the rule moved into
// the Serbian core. ⚠ ASSERTED THROUGH `phonemize()`, NOT the engine's `text()`. The bs port found a defect
// that had survived seven investigation runs because its suite called `createBosnian().text()` directly,
// which bypasses every pre-pass: green in its own tests, dead in the product.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("a decimal's leading zeros survive the comma (shared core)", () => {
    const say = (s: string): string => phonemize(s, "hr").trim();

    test("the zeros are read, not dropped", () => {
        // `Number("001")` is 1, so this was *nula zarez jedan* — "zero point one gram".
        expect(say("0,001 grama")).toBe("nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama");
        expect(say("0,001")).toBe("nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan");
    });

    test("a fractional part with no leading zero is untouched", () => {
        expect(say("0,5 grama")).toBe("nˈu˥˩la zˈarez peː˥˩t ɡrˈama");
        expect(say("1,5 km")).toBe("jˈe˩˥dan zˈarez peː˥˩t kˈilometara");
        // ⚠ The one shape the corpus actually writes (`5,0`, ×1 in hr) reads identically before and after.
        expect(say("5,0")).toBe("peː˥˩t zˈarez nˈu˥˩la");
    });
});
