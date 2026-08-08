import { describe, expect, test } from "vitest";

import { MANIFEST } from "../src/languages/afrikaans/manifest.ts";

import { phonemizeWord, createAfrikaans } from "../src/languages/afrikaans/afrikaans.ts";
import { normalizeAfrikaans, ordinalWord } from "../src/languages/afrikaans/normalize.ts";
import { numberToWords } from "../src/languages/afrikaans/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Afrikaans (af) — Indo-European (West Germanic, daughter of Dutch), Latin script,
// Standard Afrikaans. A greedy digraph-first g2p + the Germanic OPEN/CLOSED-SYLLABLE vowel-length
// rule + word-final obstruent devoicing. Referee: en.wiktionary Afrikaans IPA. The residual is
// stress-conditioned vowel reduction on POLYSYLLABLES (no stress model yet) + proper-noun/loan
// pronunciations (Afrika, Botha, Coetzee — lexical). Folds:
// stress (unwritten) + syllable dots not emitted, r~ɾ one symbol, ʊ~u / ɪ~i / œy~œi centering-diphthong-onset
// notation. Signatures below. DEFERRED: a stress/syllable model, a proper-noun lexicon, nasalization.
describe("Afrikaans canonical IPA — greedy g2p + open/closed vowel length (Standard Afrikaans)", () => {
    test("⟨g⟩ = [χ] fricative + word-final obstruent DEVOICING", () => {
        expect(phonemizeWord("dag")).toBe("daχ"); // ⟨g⟩ = velar/uvular fricative [χ], not [ɡ]
        expect(phonemizeWord("agt")).toBe("aχt");
        expect(phonemizeWord("goed")).toBe("χut"); // g→χ; ⟨oe⟩→u; final ⟨d⟩ DEVOICES → t
        expect(phonemizeWord("hond")).toBe("ɦɔnt"); // ⟨h⟩→ɦ; final ⟨d⟩→t
        expect(phonemizeWord("aand")).toBe("ɑːnt"); // ⟨aa⟩→ɑː; final ⟨d⟩→t
    });

    test("open/closed vowel LENGTH + geminate collapse", () => {
        expect(phonemizeWord("kat")).toBe("kat"); // ⟨a⟩ in a CLOSED syllable → short [a]
        expect(phonemizeWord("water")).toBe("vɑːtər"); // ⟨a⟩ in an OPEN syllable → long [ɑː]; ⟨w⟩→v; final -er→ər
        expect(phonemizeWord("appel")).toBe("apəl"); // a DOUBLED consonant is a single phoneme (marks the vowel short)
    });

    test("long mids are CENTERING DIPHTHONGS (ee=iə, oo=uə); ie/oe/ui", () => {
        expect(phonemizeWord("een")).toBe("iən"); // ⟨ee⟩ → centering [iə]
        expect(phonemizeWord("twee")).toBe("tviə"); // ⟨tw⟩→tv; ⟨ee⟩→iə
        expect(phonemizeWord("groot")).toBe("χruət"); // ⟨oo⟩ → centering [uə]
        expect(phonemizeWord("sewe")).toBe("siəvə"); // open ⟨e⟩→iə (stressed); ⟨w⟩→v; final ⟨e⟩→ə
        expect(phonemizeWord("huis")).toBe("ɦœys"); // ⟨ui⟩ → [œy]
        expect(phonemizeWord("bietjie")).toBe("biki"); // ⟨ie⟩→i; the diminutive ⟨tjie⟩→[ki]
    });

    test("⟨y⟩ diphthong + circumflex-long diacritic", () => {
        expect(phonemizeWord("altyd")).toBe("altəit"); // ⟨y⟩ → diphthong [əi]; final ⟨d⟩→t
        expect(phonemizeWord("môre")).toBe("mɔːrə"); // ⟨ô⟩ → long [ɔː]
    });

    test("text: words + clause punctuation (stress deferred)", () => {
        expect(createAfrikaans().text("Die man loop huis toe.")).toBe("di man luəp ɦœys tu .");
    });
    // ⚠ WORD-FINAL ⟨c⟩ IS [k] — issue #757. The rule is "soft [s] BEFORE a front vowel", and word-finally
    // there is no following vowel, so the soft branch cannot apply. It used to, because the test was
    // `"eiyêéè".includes(w[i + 1] ?? "")` and `includes("")` is TRUE: franc→frans, arc→ars.
    // ⚠ THE REFEREE CANNOT ADJUDICATE THIS, though not for the reason first written here. af.wiktionary-af
    // .tsv DOES hold one word-final ⟨c⟩ — the letter name `C → sɪə` — and eval.ts feeds af through
    // phonemizeWord directly, so that entry does reach this branch. It simply misses BOTH ways (s, then k,
    // against sɪə), which is why the folded backbone is unmoved at 1658/2220. Single letters are not
    // spelled out by the g2p at all — `B → p` likewise — see issue #761.
    // ⚠ ⟨ch⟩ IS A DIGRAPH AND THE ⟨c⟩ CODE RULE MUST YIELD TO IT (#758). That rule runs before the fixed
    // table so it can beat the single-letter entries, and it was shadowing ⟨ch⟩ outright: chemie → kɦiəmi,
    // an onset Afrikaans does not have.
    // ⚠ THE [ʃ]/[x] SPLIT IS LEXICAL, NOT ORTHOGRAPHIC, and the manifest takes the MAJORITY: the referee has
    // China, chirurg, Charlize and Fouché with [ʃ] against chemie alone with [x]. So chemie is a KNOWN MISS
    // — pinned here as such rather than special-cased, since one instance is not enough to justify a
    // lexical exception list. ⟨chr⟩ is different: it IS orthographic, and is a manifest entry.
    // ⚠ ⟨sch⟩ IS [sk] AND MUST OUT-RANK ⟨ch⟩ — the review catch on #762. Yielding the ⟨c⟩ rule to ⟨ch⟩
    // made every ⟨sch⟩ surname come out [sʃ] (Schalk → *sʃalk), which is not a possible Afrikaans onset,
    // and the aggregate score still ROSE because the letter-spelling gain masked it. The referee's
    // majority is [sk] — Schalk, Schoeman, Schutte, Labuschagne — against Schuster/Laubscher [ʃ] and
    // Hauptfleisch [s], so [sk] is the entry and those three are known misses.
    test("⟨sch⟩ is [sk], out-ranking the ⟨ch⟩ digraph", () => {
        expect(phonemizeWord("Schalk")).toBe("skalk"); // referee skalk — exact
        expect(phonemizeWord("Schoeman")).toBe("skuman"); // referee ˈskuman
        expect(phonemizeWord("skryf")).toBe("skrəif"); // ⟨schr⟩ falls out of ⟨sch⟩+⟨r⟩ with no entry
    });

    test("⟨ch⟩ is the digraph [ʃ], and ⟨chr⟩ is [kr]", () => {
        expect(phonemizeWord("chirurg")).toBe("ʃirœrχ"); // referee ʃiˈrərχ
        expect(phonemizeWord("China")).toBe("ʃina"); // referee ˈʃi.na
        expect(phonemizeWord("Christus")).toBe("krəstœs"); // ⟨chr⟩ → kr, not *ʃrəstœs
        expect(phonemizeWord("chemie")).toBe("ʃiəmi"); // ⚠ referee ˈxɛmi — the lexical [x], a known miss
    });

    // ⚠ A BARE SINGLE LETTER IS SPELLED, NOT SOUNDED (#761) — the initialism normalizer only fires on runs
    // of two or more, so a lone letter used to fall through to the word path and come out as its phone
    // (C → k, B → p). The referee holds all 26 letters; this moved af 1658 → 1677/2220 on its own.
    test("a bare single letter is spelled as its name", () => {
        expect(phonemizeWord("C")).toBe("siə"); // referee sɪə
        expect(phonemizeWord("B")).toBe("biə"); // referee bɪə
        expect(phonemizeWord("X")).toBe("ɛks"); // referee ɛks — exact
        expect(createAfrikaans().text("Vitamien C").trim()).toBe("fitamin siə");
        expect(phonemizeWord("'n")).toBe("ə"); // …and the one-letter-looking WORD is untouched
        // In running text the two that move are both improvements: ⟨x⟩ as a symbol reads "eks", and
        // ⟨e-pos⟩ (email) is said "ee-pos" — the letter name — not with a schwa.
        expect(createAfrikaans().text("x = 5").trim()).toBe("ɛks χələik ɑːn fəif");
        expect(createAfrikaans().text("e-pos").trim()).toBe("iə pɔs");
        // ⚠ …and the one-letter UNITS are declared, because spelling made their absence audible: an
        // undeclared `3 g` read "drie GEE" — a confident wrong WORD, not just a wrong phone (#762 review).
        expect(createAfrikaans().text("3 g suiker").trim()).toBe("dri χram sœykər");
        expect(createAfrikaans().text("5 l water").trim()).toBe("fəif litər vɑːtər");
    });

    test("a word-final ⟨c⟩ is [k], not the soft [s]", () => {
        expect(phonemizeWord("franc")).toBe("frank");
        expect(phonemizeWord("arc")).toBe("ark");
        expect(phonemizeWord("bloc")).toBe("blɔk");
        expect(phonemizeWord("cent")).toBe("sɛnt"); // …and ⟨c⟩ BEFORE a front vowel is still soft
    });

    test("proper nouns come from the LEXICON, not the spelling rules", () => {
        // af-lexicon.tsv (~50 referee-sourced entries; circularity documented in
        // af-lexicon.PROVENANCE.md): name orthography no Afrikaans rule can derive.
        expect(phonemizeWord("Botha")).toBe("buəta"); // the rules said bɔtɦa
        expect(phonemizeWord("Blignault")).toBe("blɨxnœut"); // French-era spelling
        // ⚠ The nasal set rides in the lexicon too — the generative nasal rule stays deferred with
        // evidence (visible n-deletion class is ×2 in 2220), but the flagship word carries its ɑ̃.
        expect(phonemizeWord("Afrikaans")).toBe("afrikɑ̃ːs");
        // Lookup is case-insensitive (the engine lowercases), so a sentence-medial mention hits too.
        expect(phonemizeWord("botha")).toBe("buəta");
    });

});

// TEXT NORMALIZATION (src/languages/afrikaans/normalize.ts) — the pre-tokenizer pass. The
// defining rules are the ORDINAL (numeral + letter suffix: 11de, 15de, 9e, 60ste — Dutch-style) and the
// ENGLISH separators this corpus actually uses (dot decimal, comma thousands). Also era markers, clocks
// with vm/n.m., rates, currency, percent, degrees, signs and initialisms.
describe("Afrikaans text normalization", () => {
    const ph = (s: string): string => getPhonemizer("af").text(s).trim();

    test("ordinal words: below 20 a table, from 20 up -ste with a sub-20 tail", () => {
        expect(ordinalWord(1)).toBe("eerste");
        expect(ordinalWord(9)).toBe("neënde");
        expect(ordinalWord(11)).toBe("elfde");
        expect(ordinalWord(15)).toBe("vyftiende");
        expect(ordinalWord(19)).toBe("negentiende");
        expect(ordinalWord(20)).toBe("twintigste");
        expect(ordinalWord(60)).toBe("sestigste");
        expect(ordinalWord(190)).toBe("honderd en negentigste");
    });

    // ⚠ THE SUB-20 TAIL OF A COMPOUND — the case the test above never reached, and it was broken both ways.
    // The tails were two inline arrays duplicating numbers.units/teens, and the teens copy had drifted two
    // places: r=10 asked for an EMPTY tail, `card.endsWith("")` is true for everything, and
    // `card.slice(0, -0)` is "" because -0 === 0 — so 110 lost its whole "honderd en " and read *tiende*.
    // r=12…19 asked for the wrong word, missed the match, and fell through to plain -ste, giving
    // *honderd en twaalfste* where ordinalWord's own docblock says honderdtwaalfde. Reads the manifest now.
    test("a compound ordinal keeps its prefix AND takes the sub-20 form", () => {
        expect(ordinalWord(110)).toBe("honderd en tiende"); // was *tiende* — prefix destroyed
        expect(ordinalWord(111)).toBe("honderd en elfde"); // was *elfde*
        expect(ordinalWord(112)).toBe("honderd en twaalfde"); // was *honderd en twaalfste*
        expect(ordinalWord(119)).toBe("honderd en negentiende"); // was *honderd en negentienste*
        expect(ordinalWord(101)).toBe("honderd en eerste"); // …and r<10 was already right
    });

    test("text→text: the N-suffix ordinal becomes the ordinal words", () => {
        expect(normalizeAfrikaans("11de Hussars")).toBe("elfde Hussars");
        expect(normalizeAfrikaans("15de eeu")).toBe("vyftiende eeu");
        expect(normalizeAfrikaans("9e Augustus")).toBe("neënde Augustus");
        expect(normalizeAfrikaans("60ste van die seisoen")).toBe("sestigste van die seisoen");
    });

    test("comma groups thousands and the DOT is a decimal (English convention in this corpus)", () => {
        expect(ph("17,500 myl")).toBe("siəvəntin dœysənt fəif ɦɔndərt məil");
        expect(ph("100,000 mense")).toBe("ɦɔndərt dœysənt mɛnsə");
        expect(ph("12.8 km")).toBe("tvɑːlf kɔma aχt kilɔmiətər");
        expect(ph("2.3 miljoen")).toBe("tviə kɔma dri məljun");
    });

    test("clocks read hour [minute] with voormiddag/namiddag; the AM/PM suffix expands", () => {
        expect(ph("10:00vm")).toBe("tin fuərmədaχ");
        expect(ph("8:30 n.m.")).toBe("aχt dɛrtəχ nɑːmədaχ .");
        expect(ph("11:20")).toBe("ɛlf tvəntəχ");
    });

    test("era markers and dotted abbreviations expand", () => {
        // ⟨Christus⟩ is [kr-], not the old *kɦr- — the ⟨c⟩ rule used to shadow the ⟨chr⟩ digraph (#758).
        expect(ph("323 v.C.")).toBe("dri ɦɔndərt ɛn dri ɛn tvəntəχ fuər krəstœs .");
        expect(ph("d.i. 0 of 1")).toBe("dət əs nœl ɔf iən");
        expect(ph("Dr. Lee")).toBe("dɔktər liə");
        expect(ph("40 m.p.u")).toBe("fiərtəχ məil pɛr yːr");
    });

    test("rates, percent, currency and units use Afrikaans words", () => {
        expect(ph("480 km/h")).toBe("fir ɦɔndərt ɛn taχtəχ kilɔmiətər pɛr yːr");
        expect(ph("35 mm")).toBe("fəif ɛn dɛrtəχ məlimətər");
        expect(ph("3 850 km²")).toBe("dri aχt ɦɔndərt ɛn fəiftəχ firkantə kilɔmiətər");
        expect(ph("93%")).toBe("dri ɛn niəχəntəχ pɛrsɛnt");
        expect(ph("£27 miljoen")).toBe("siəvə ɛn tvəntəχ məljun pɔnt");
        expect(ph("$2.3 biljoen")).toBe("tviə kɔma dri bəljun dɔlar");
    });

    test("signs read out; the HTML ampersand becomes en; B&B is letter-named", () => {
        expect(ph("+30°C")).toBe("plœs dɛrtəχ χrɑːdə sɛlsiœs");
        expect(ph("Qatar Airways &amp; Turkish Airlines")).toBe("kɑːtar ɑːərvaəis ɛn tœrkəsɦ ɑːərlinəs");
        expect(ph("B&amp;B")).toBe("biə ɛn biə");
        expect(ph("1/5 duim")).toBe("iən fəifdə dœym");
    });

    test("regnal ordinals take both spellings of the noun and the un-converted Roman I", () => {
        expect(ph("Wêreld Oorlog II")).toBe("tviədə vɛːrəltuərlɔχ");
        expect(ph("Wêreldoorlog II")).toBe("tviədə vɛːrəltuərlɔχ"); // the one-word spelling, 2× in corpus
        expect(ph("Wêreld Oorlog I")).toBe("iərstə vɛːrəltuərlɔχ"); // a lone I is never romanised upstream
    });

    // The article is [ə], and the corpus writes it four ways — 588× with the LEFT quote U+2018, which the
    // g2p's two-spelling check did not recognise, so the commonest word in the language read as a bare `n`.
    test("every spelling of the indefinite article reads [ə]", () => {
        for (const art of ["'n", "’n", "‘n", "ʼn", "ń"])
            expect(ph(`${art} Avenger myn skip`)).toBe("ə ɑːfəŋər məin skəp");
        expect(normalizeAfrikaans("‘nuwe’ idee")).toBe("‘nuwe’ idee"); // an opening quote on an n-word is not the article
    });

    // ⚠ It is the `n.C.` (na Christus) marker that MUST require its dots — unanchored, `n` + `C` matches the
    // ⟨'n C…⟩ of the indefinite article before any c-word, destroying the commonest word in the language.
    // And na Christus has ZERO corpus instances of its own. See normalize.ts.
    test("the era marker is dot-bound, so it cannot eat the indefinite article", () => {
        expect(normalizeAfrikaans("'n Chinese skip")).toBe("'n Chinese skip"); // was *'na Christushinese*
        expect(normalizeAfrikaans("323 v.C.")).toBe("323 voor Christus.");
        expect(normalizeAfrikaans("356 VC")).toBe("356 voor Christus");
        expect(normalizeAfrikaans("5 000 v. C.")).toBe("5 000 voor Christus.");
    });

    test("a DOT between digits is the decimal; only a timezone/AM-PM context makes it a clock", () => {
        expect(ph("6.34 duim")).toBe("sɛs kɔma dri fir dœym");       // was the clock *ses vier en dertig*
        expect(ph("3.50-meter")).toBe("dri kɔma fəif nœl miətər");
        expect(ph("15.00 GUT")).toBe("fəiftin χœt");                  // the corpus's one dot-clock
        expect(ph("4:41.30")).toBe("fir , iən ɛn fiərtəχ kɔma dri nœl"); // a sports time is not a clock
    });

    test("the AM/PM marker follows the minutes, and nm alone is not a time", () => {
        expect(ph("9:30 vm")).toBe("niəχə dɛrtəχ fuərmədaχ"); // was *nege voormiddag dertig*
        expect(ph("10:00vm")).toBe("tin fuərmədaχ");
        expect(ph("10nm")).toBe("tin nm");                    // nanometres, not *tien namiddag*
    });

    test("the ordinal suffix is orthography, not a lowercase convention", () => {
        expect(normalizeAfrikaans("11De Hussars")).toBe("elfde Hussars");
    });

    // STANDARD Afrikaans marks the decimal with a COMMA; this corpus is the exception (translated from the
    // English FLEURS set), so BOTH conventions have to read. Three digits after the comma is the grouping,
    // one or two is a decimal — a comma decimal used to read as a clause PAUSE inside the number.
    test("a comma is the grouping at three digits and the decimal at one or two", () => {
        expect(ph("12,5 kilometer")).toBe("tvɑːlf kɔma fəif kilɔmiətər"); // was *twaalf , vyf*
        expect(ph("3,5 miljoen")).toBe("dri kɔma fəif məljun");
        expect(ph("17,500 myl")).toBe("siəvəntin dœysənt fəif ɦɔndərt məil"); // still the grouping
        expect(ph("In 1990, 5 mense")).toBe("ən dœysənt niəχə ɦɔndərt ɛn niəχəntəχ , fəif mɛnsə"); // a clause comma
    });

    test("a version dot is 802.11n and Figuur N.N — a decimal glued to its unit is not", () => {
        expect(ph("12.5km")).toBe("tvɑːlf kɔma fəif kilɔmiətər"); // was *twaalf punt vyf kilometer*
        // ⚠ The trailing standard-suffix letter is SPELLED (n → "en" [ɛn]), which is what a reader says —
        // and what #761 fixed. It used to emit a bare [n], not a sayable syllable on its own.
        expect(ph("802.11n")).toBe("aχt ɦɔndərt ɛn tviə pœnt ɛlf ɛn");
        expect(ph("Figuur 1.1")).toBe("fiχyːr iən pœnt iən");
    });

    // A lone thousand is bare (duisend) but million and up keep the numeral — the split core/numbers.ts
    // documents on `bareMagnitude`. No corpus number is written in digits at this scale.
    test("a lone million keeps its numeral", () => {
        expect(numberToWords(1_000_000)).toBe("een miljoen"); // was the bare "miljoen"
        expect(numberToWords(1_500_000)).toBe("een miljoen vyf honderd duisend");
        expect(numberToWords(1000)).toBe("duisend");
        expect(numberToWords(2_000_000)).toBe("twee miljoen");
    });

    // bare `m` was the RAW LETTER: meter ×9, and every digit-adjacent instance in the corpus is a
    // metre. `133 m/s` now composes the whole rate, and `kubieke` finally has a head noun to attach to.
    // The corpus's `40 m.p.u` (myl per uur) is safe because normalize.ts expands the dotted abbreviation
    // BEFORE the tier, so no bare `m` survives to be misread.
    test("the bare metre, and the cube word it feeds", () => {
        expect(getPhonemizer("af").text("133 m/s").trim()).toContain("miətər pɛr siəkɔndə");
        expect(getPhonemizer("af").text("5 m³").trim()).toContain("kyːbikə miətər");
        expect(getPhonemizer("af").text("40 m.p.u").trim()).toContain("məil pɛr yːr");
    });
    // ⚠ THE SAME SIX UNSTRESSED PREFIXES ARE READ BY TWO CONSUMERS — afrikaans.ts (stress placement + the
    // reduced prefix IPA) and the shared Germanic compound engine via morphology.prefixUnstressed. They
    // were three hand-written copies before #756, and a copy drifts. Asserted here rather than thrown at
    // module init: registry.ts imports afrikaans.ts statically, so an init-time throw would take every
    // other language's import down with it over one Afrikaans data typo.
    test("prefixIpa keys are exactly morphology.prefixUnstressed", () => {
        expect(Object.keys(MANIFEST.prefixIpa).sort()).toEqual([...MANIFEST.morphology.prefixUnstressed].sort());
        expect(MANIFEST.morphology.prefixUnstressed.length).toBeGreaterThan(0); // and the scan found something
    });


    // ⚠ THE SIGN AND MATH WORDS ARE MANIFEST DATA (afrikaans.jsonc `signWords`), not literals in the
    // replace calls. Afrikaans is the first engine to declare them — every other language still inlines
    // its own, so this is the start of that migration rather than a fleet convention yet.
    // ± is pinned because it is a SINGLE code point (U+00B1): no ⟨+⟩ rule can reach inside it, so without
    // its own entry the sign disappears in silence rather than reading wrong.
    // ⚠ THE HALF-DAY WORDS EXIST TWICE and JSON cannot reference itself: `clockPeriods` feeds the clock
    // rule (9:30 vm) while `dottedAbbreviations` feeds the abbreviation pass (n.m. → namiddag), which runs
    // earlier and by a different mechanism. They must agree, so this asserts it rather than trusting it.
    test("clockPeriods and the dotted abbreviations tell the same story", () => {
        expect(MANIFEST.dottedAbbreviations["n.m"]).toBe(MANIFEST.clockPeriods["nm"]);
        expect(MANIFEST.dottedAbbreviations["n.m."]).toBe(MANIFEST.clockPeriods["nm"]);
    });

    test("the sign and math words come from the manifest", () => {
        expect(ph("±5")).toContain("plœs ɔf minœs"); // ⚠ U+00B1, not "+"
        expect(ph("3 = 3")).toContain("χələik ɑːn");
        expect(ph("3 × 4")).toContain("kiər");
        expect(ph("8 ÷ 2")).toContain("χədiəl døːr");
        expect(ph("4 < 5")).toContain("kləinɛr as");
        expect(ph("Jan & Piet")).toContain("ɛn");
        // …and the two suppletive halves, the only fractions with words of their own.
        expect(ph("1/2 duim")).toContain("iən ɦalf");
        expect(ph("3/2 koppies")).toContain("ɦalvə");
    });

});
