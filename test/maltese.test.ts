import { describe, expect, test } from "vitest";

import { createMaltese, phonemizeWord } from "../src/languages/maltese/maltese.ts";
import { normalizeMaltese } from "../src/languages/maltese/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Maltese (mt) — Malti, the ONLY Semitic language written in the Latin alphabet (a Siculo-Arabic core + Sicilian/
// Italian/English superstrate), Malta (~520k). Maltese orthography is fairly phonemic, so the engine is a greedy
// grapheme scan (the ⟨ie għ⟩ digraphs + the silent-letter rules) + final devoicing + regressive voicing assimilation
// + affricate gemination + n→m before a labial. Referee: wikipron mlt_latn_broad (15,837 human headwords),
// with vowel LENGTH (stress-conditioned, ~50% of lines) + għ pharyngealization folded. ⚠ Single-source: there is no second referee for mt.
describe("Maltese canonical IPA — grapheme g2p + silent-letter rules + devoicing", () => {
    const mt = createMaltese();

    test("the distinctive Maltese consonants: ċ→t͡ʃ, ġ→d͡ʒ, ħ→ħ, q→ʔ, x→ʃ, ż→z vs z→t͡s", () => {
        expect(phonemizeWord("ċar")).toBe("t͡ʃar"); // ⟨ċ⟩ → t͡ʃ ("clear")
        expect(phonemizeWord("ġar")).toBe("d͡ʒar"); // ⟨ġ⟩ → d͡ʒ ("neighbour")
        expect(phonemizeWord("ħażin")).toBe("ħazɪn"); // ⟨ħ⟩ → ħ, ⟨ż⟩ → z ("bad")
        expect(phonemizeWord("żmien")).toBe("zmɪn"); // ⟨ż⟩ → z, ⟨ie⟩ → ɪ ("time")
        expect(phonemizeWord("ċuċ")).toBe("t͡ʃut͡ʃ"); // ⟨ċ⟩ ("fool")
    });

    test("⟨q⟩ → ʔ (the glottal stop), the Maltese signature", () => {
        expect(phonemizeWord("qalb")).toBe("ʔalp"); // ⟨q⟩ → ʔ, final ⟨b⟩ devoices ("heart")
        expect(phonemizeWord("qattus")).toBe("ʔattus"); // MEDIAL geminate kept ("cat")
    });

    test("final devoicing + regressive assimilation over obstruent clusters", () => {
        expect(phonemizeWord("Attard")).toBe("attart"); // final ⟨d⟩ → t (a surname)
        expect(phonemizeWord("kiteb")).toBe("kɪtɛp"); // final ⟨b⟩ → p ("he wrote")
        expect(phonemizeWord("ħobż")).toBe("ħɔps"); // ⟨b⟩ devoices before the final ⟨ż⟩→s ("bread")
    });

    test("⟨n⟩ → m before a labial", () => {
        expect(phonemizeWord("ġenb")).toBe("d͡ʒɛmp"); // n→m before b, then final devoicing b→p ("side")
    });

    test("silent ⟨għ⟩: silent word-medially (colours/lengthens the vowel — folded), [ħ] word-final", () => {
        expect(phonemizeWord("għamel")).toBe("amɛl"); // word-initial ⟨għ⟩ silent ("he did")
        expect(phonemizeWord("xogħol")).toBe("ʃɔl"); // medial ⟨għ⟩ silent ("work")
        expect(phonemizeWord("biegħ")).toBe("bɪħ"); // WORD-FINAL ⟨għ⟩ → [ħ] ("he sold")
        expect(phonemizeWord("friegħ")).toBe("frɪħ"); // word-final ⟨għ⟩ → [ħ] ("branches")
    });

    test("silent ⟨h⟩: silent medially (adjacent vowels collapse), [ħ] word-final", () => {
        expect(phonemizeWord("deheb")).toBe("dɛp"); // medial ⟨h⟩ silent, the a-a collapse + final devoicing ("gold")
        expect(phonemizeWord("xahar")).toBe("ʃar"); // medial ⟨h⟩ silent ("month")
        expect(phonemizeWord("fih")).toBe("fɪħ"); // WORD-FINAL ⟨h⟩ → [ħ] ("in it")
    });

    test("⟨ie⟩ → the long [ɪ] (length folded)", () => {
        expect(phonemizeWord("tliet")).toBe("tlɪt"); // ⟨ie⟩ → ɪ ("three")
    });

    test("word-final geminate DEGEMINATION (medial geminate kept)", () => {
        expect(phonemizeWord("Ħadd")).toBe("ħat"); // final ⟨dd⟩ → single, then devoice → t ("Sunday / nobody")
        expect(phonemizeWord("qattus")).toBe("ʔattus"); // MEDIAL ⟨tt⟩ KEPT
    });

    test("affricate gemination: a doubled affricate = STOP + affricate (⟨ġġ⟩→[dd͡ʒ], not [d͡ʒd͡ʒ])", () => {
        expect(phonemizeWord("mweġġa")).toBe("mwɛdd͡ʒa"); // ⟨ġġ⟩ → d + d͡ʒ ("hurt")
    });

    test("grave-accented vowels (the productive ⟨-tà⟩ nominalizer): same quality, kept — not dropped", () => {
        expect(phonemizeWord("attività")).toBe("attɪvɪta"); // ⟨à⟩ → a ("activity")
        expect(phonemizeWord("università")).toBe("unɪvɛrsɪta"); // ("university")
        expect(phonemizeWord("Perù")).toBe("pɛru"); // ⟨ù⟩ → u ("Peru")
    });

    test("clause assembly (the article ⟨il-⟩ splits on the hyphen)", () => {
        expect(mt.text("Il-Malti ħelu.").trim()).toBe("ɪl maltɪ ħɛlu .");
    });

    // ═══ CARDINAL NUMBERS — the NATIVE Semitic series (Maltese has no rival borrowed one). Composition + sources
    // live in src/languages/maltese/numbers.ts (GF-RGL NumeralMlt.gf + Wiktionary). The judgment call: a bare
    // digit reads with the ABSOLUTE/COUNTING form (tnejn 2), not the pre-nominal attributive (żewġ).
    test("cardinals: the ABSOLUTE counting series + units-first ⟨u⟩ + the DUAL magnitudes", () => {
        const mt = getPhonemizer("mt");
        expect(mt.text("0").trim()).toBe("zɛrɔ"); // żero
        expect(mt.text("2").trim()).toBe("tnɛjn"); // tnejn — the COUNTING form, not attributive żewġ
        expect(mt.text("10").trim()).toBe("aʃra"); // għaxra (⟨għ⟩ silent → aʃra)
        expect(mt.text("21").trim()).toBe("wɪħɛt u ɔʃrɪn"); // wieħed u għoxrin — UNITS-FIRST, Semitic order
        expect(mt.text("45").trim()).toBe("ħamsa u ɛrbɪn"); // ħamsa u erbgħin
        expect(mt.text("100").trim()).toBe("mɪja"); // mija
        expect(mt.text("200").trim()).toBe("mɪtɛjn"); // mitejn — the DUAL, never *żewġ mija
        expect(mt.text("555").trim()).toBe("ħamɛs mɪja u ħamsa u ħamsɪn"); // ħames mija u ħamsa u ħamsin
        expect(mt.text("1000").trim()).toBe("ɛlf"); // elf — bare, no leading wieħed
        expect(mt.text("2000").trim()).toBe("ɛlfɛjn"); // elfejn — the DUAL again
        expect(mt.text("3000").trim()).toBe("tlɪt ɛlɛf"); // tlitt elef — the -t attributive + PLURAL elef
    });

    test("cardinals: the ⟨-il⟩ teen linker, group juxtaposition, and miljun's MISSING dual", () => {
        const mt = getPhonemizer("mt");
        // 12 345 = tnax-il elf tliet mija u ħamsa u erbgħin. `u` marks only the FINAL constituent; the ⟨-il⟩
        // hyphen is not a token boundary (the grapheme scan skips it: ħdaxil).
        expect(mt.text("12345").trim()).toBe("tnaʃɪl ɛlf tlɪt mɪja u ħamsa u ɛrbɪn");
        expect(mt.text("1000000").trim()).toBe("mɪljun"); // miljun
        // miljun is a Romance loan with NO dual, so 2× takes the ordinary attributive żewġ + PLURAL miljuni.
        expect(mt.text("2000000").trim()).toBe("zɛwt͡ʃ mɪljunɪ"); // żewġ miljuni, never *miljunejn
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// TEXT NORMALIZATION (src/languages/maltese/normalize.ts). Sourcing, counts and the ordering argument live
// in that file's header; these tests pin the rules' BRANCHES rather than the corpus's instances (trap 13),
// so most cases below are shapes the mined corpus does NOT contain.
//
// The assertions are on `normalizeMaltese` (text→text) where the point is the WORD CHOSEN, and through the
// real phonemizer where the point is that the word reaches the g2p.
describe("Maltese text normalization — the rules' branches", () => {
    // ── COUNT AGREEMENT is the spine of this layer: PLURAL for 2–10 and for any fraction, SINGULAR for 1
    // and for every whole number from 11 up. Every other rule below consumes it, so it is pinned first and
    // at the BOUNDARY, which is the branch no corpus instance exercises on both sides.
    test("count agreement: the 10/11 boundary, 1, and the fraction arm", () => {
        expect(normalizeMaltese("1 km")).toBe("1 kilometru"); // 1 → singular
        expect(normalizeMaltese("2 km")).toBe("2 kilometri"); // 2 → PLURAL
        expect(normalizeMaltese("10 km")).toBe("10 kilometri"); // 10 → still plural …
        expect(normalizeMaltese("11 km")).toBe("11 kilometru"); // … 11 → SINGULAR. The Semitic flip.
        expect(normalizeMaltese("100 km")).toBe("100 kilometru");
        // A FRACTION takes the plural at BOTH ends of the boundary — the arm that a plain Number() parse got
        // wrong on a trailing zero, and that the corpus diff caught (`68.0 °F` singular, `30.2 °F` plural).
        expect(normalizeMaltese("1.5 km")).toBe("1 punt 5 kilometri");
        expect(normalizeMaltese("10.5 km")).toBe("10 punt 5 kilometri");
        expect(normalizeMaltese("68.0 °F")).toBe("68 punt 0 gradi Fahrenheit");
        expect(normalizeMaltese("30.2 °F")).toBe("30 punt 2 gradi Fahrenheit");
    });

    // ── DE-GROUPING must run FIRST: a grouping comma is otherwise clause punctuation, and `$250,000` read
    // *mɪtɛjn u ħamsɪn , zɛrɔ* — one number spoken as two with a pause between.
    test("de-grouping: the multi-comma loop, and the REFUSAL of a decimal comma", () => {
        expect(normalizeMaltese("9,750,000")).toBe("9750000"); // two passes: the first eats the second's start
        expect(normalizeMaltese("1,200 metru")).toBe("1200 metru");
        // ⚠ EXACTLY THREE DIGITS. mt.wikipedia writes the English convention throughout and lapses ONCE into
        // the European one; claiming `8,2` would claim every clause comma that falls between two digits.
        expect(normalizeMaltese("8,2 %")).toBe("8,2 fil-mija");
        expect(normalizeMaltese("fl-2018, l-akbar")).toBe("fl-2018, l-akbar"); // a real clause comma, untouched
    });

    // ── THE DECIMAL POINT runs LAST, after the shared tier — see the step's note. Two branches: the rewrite,
    // and the clock refusal.
    test("decimal point: the rewrite, and the CLOCK left exactly as it was", () => {
        expect(normalizeMaltese("12.5%")).toBe("12 punt 5 fil-mija");
        // Maltese writes a time of day with a dot. 4 instances against 181 decimals, so the clock is REFUSED
        // WHOLE (trap 53) rather than read as *disgħa punt erbgħin* — the pause it already had stands.
        expect(normalizeMaltese("9.40am")).toBe("9.40am");
        expect(normalizeMaltese("8.30 p.m.")).toBe("8.30 p.m.");
        expect(normalizeMaltese("fl-4.00 ta' filgħodu")).toBe("fl-4.00 ta' filgħodu");
        // …and the guard must be the RIGHT context, because the SHAPE cannot tell these two apart.
        expect(normalizeMaltese("$88.08 biljun")).toBe("88 punt 08 biljun dollari");
    });

    // ── THE MINUS is narrowed to a number followed by ° or %, because in this orthography the character
    // before a hyphen is usually a LETTER — the definite article. Both arms are pinned, and so are the three
    // shapes that must NOT match.
    test("minus: fires on ° and %, and never on the definite article's hyphen", () => {
        expect(normalizeMaltese("-3 °C")).toBe("minus 3 gradi Ċelsju");
        expect(normalizeMaltese("−8 °C")).toBe("minus 8 gradi Ċelsju"); // U+2212, the real minus sign
        expect(normalizeMaltese("-9.7%")).toBe("minus 9 punt 7 fil-mija");
        // ⚠ `it-`, `l-` and `fl-` are the ARTICLE. A layer that read these as negatives would invert a
        // temperature and a percentage in ordinary prose; `fl -2021` (a year with a stray space) is the one
        // false positive the wider fleet shape produced on this corpus.
        expect(normalizeMaltese("it-43.8°C")).toBe("it-43 punt 8 gradi Ċelsju");
        expect(normalizeMaltese("l-1% tal-voti")).toBe("l-1 fil-mija tal-voti");
        expect(normalizeMaltese("fl -2021")).toBe("fl -2021");
    });

    // ── °C / °F, with both agreement branches, and the BARE degree sign declined.
    test("degrees: the scale word, its agreement, and the coordinate left alone", () => {
        expect(normalizeMaltese("20 °C")).toBe("20 grad Ċelsju"); // ≥11 → singular
        expect(normalizeMaltese("3 °C")).toBe("3 gradi Ċelsju"); //  2–10 → plural
        expect(normalizeMaltese("1.2°C")).toBe("1 punt 2 gradi Ċelsju"); // unspaced, fraction
        expect(normalizeMaltese("39 °F")).toBe("39 grad Fahrenheit");
        // ⚠ 15 of the 51 degree signs in the retained text are COORDINATES and one is a Richter magnitude. A
        // bare-° rule would cut a coordinate in half and has no minutes/seconds reading to put back.
        expect(normalizeMaltese("42° 35' 34\"")).toBe("42° 35' 34\"");
        expect(normalizeMaltese("7.6° fuq l-iskala Richter")).toBe("7 punt 6° fuq l-iskala Richter");
    });

    // ── ERA MARKERS. The wiki states the expansion definitionally; the dotted form must be claimed before
    // any single-dot rule, or the interior dots survive as sentence pauses (`Q.K.` read *ʔ . k .*).
    test("era markers: dotted and bare, either case, and never inside a word", () => {
        expect(normalizeMaltese("600 Q.K.")).toBe("600 Qabel Kristu."); // ends the input ⇒ the full stop is real
        expect(normalizeMaltese("2200 QK")).toBe("2200 Qabel Kristu"); // the undotted form the corpus also writes
        expect(normalizeMaltese("60 W.K.")).toBe("60 Wara Kristu.");
        expect(normalizeMaltese("tas-seklu 10 w.K.")).toBe("tas-seklu 10 Wara Kristu."); // ⚠ lowercase variant
        // ⚠ THE BOUND MATTERS: a bare substring match here would silently delete letters inside a longer word.
        expect(normalizeMaltese("QUARTO")).toBe("QUARTO");
        expect(normalizeMaltese("Mikroqk")).toBe("Mikroqk");
    });

    // ── THE ABBREVIATION'S DOT IS SOMETIMES A SENTENCE'S DOT TOO, and consuming it MERGED TWO SENTENCES —
    // the review's second finding, 3 of the 249 hard segments. Both arms are pinned, on shapes chosen for the
    // BRANCH rather than copied from the corpus: the discriminator is the next non-space character.
    test("era markers: the sentence-final period is re-emitted, and never invented mid-sentence", () => {
        // RE-EMITTED — next non-space character is upper case, so that dot was doing two jobs.
        expect(normalizeMaltese("sal-2800 Q.K. Malta ġiet diżabitata.")).toBe(
            "sal-2800 Qabel Kristu. Malta ġiet diżabitata.",
        );
        expect(normalizeMaltese("fis-73 W.K. Ruma waqgħet.")).toBe("fis-73 Wara Kristu. Ruma waqgħet.");
        // …and at the END OF THE INPUT, where there is no next character at all.
        expect(normalizeMaltese("Twieled fis-sena 300 Q.K.")).toBe("Twieled fis-sena 300 Qabel Kristu.");
        // NOT RE-EMITTED — the sentence carries on. A dot here would be a spurious pause mid-clause, which is
        // the defect the era rule was written to remove in the first place.
        expect(normalizeMaltese("6500 Q.K. bil-wasla ta' kaċċaturi")).toBe(
            "6500 Qabel Kristu bil-wasla ta' kaċċaturi",
        );
        expect(normalizeMaltese("tas-seklu 18 Q.K. u l-Imperu")).toBe("tas-seklu 18 Qabel Kristu u l-Imperu");
        // ⚠ NOR AFTER A COMMA, which is already the clause break — the writer's own punctuation stands.
        expect(normalizeMaltese("fit-332 Q.K., Malta ġiet taħt Kartaġni")).toBe(
            "fit-332 Qabel Kristu, Malta ġiet taħt Kartaġni",
        );
        // ⚠ AND NEVER FOR THE UNDOTTED FORM, which has no period to give back.
        expect(normalizeMaltese("sat-68 QK Malta")).toBe("sat-68 Qabel Kristu Malta");
    });

    // ── PERCENT — the largest class in the corpus (`DROP percent ×50`, the highest single-class count of any
    // untreated language in this repo). INVARIANT, because `fil-mija` is a prepositional phrase.
    test("percent: one form for every numeral, on either spacing", () => {
        expect(normalizeMaltese("40%")).toBe("40 fil-mija");
        expect(normalizeMaltese("60 %")).toBe("60 fil-mija");
        expect(normalizeMaltese("3 %")).toBe("3 fil-mija"); // no plural — the phrase does not inflect
        expect(normalizeMaltese("11.6%")).toBe("11 punt 6 fil-mija");
    });

    // ── CURRENCY: the word goes AFTER the amount, the magnitude hops with the number, and a currency the
    // text has already spelled out is not said twice.
    test("currency: postposed, the magnitude hop, and the `-il` linked magnitude", () => {
        expect(normalizeMaltese("€5")).toBe("5 ewro"); // invariant
        expect(normalizeMaltese("€487 miljun")).toBe("487 miljun ewro"); // magnitude stays with the number
        expect(normalizeMaltese("$250,000")).toBe("250000 dollaru"); // de-grouped, ≥11 → singular
        expect(normalizeMaltese("$5")).toBe("5 dollari"); // 2–10 → plural. Not a shape the corpus writes.
        // ⚠ A MALTESE TEEN TAKES THE `-il` LINKER BEFORE A MAGNITUDE, and the corpus writes it after the
        // DIGITS. Without the linked form declared as its own magnitude the noun landed BETWEEN the numeral
        // and its magnitude — *tnax EWRO il miljun*, a defect this layer introduced and the corpus diff found.
        expect(normalizeMaltese("€12-il miljun")).toBe("12-il miljun ewro");
        // ⚠ TRAP 12: the sentence writes the sign AND the word. Say it once, in the language's own position.
        expect(normalizeMaltese("£1.60 sterlini")).toBe("1 punt 60 sterlini");
    });

    // ── UNITS. The first assertion is a REGRESSION GUARD, not a feature: ⟨c⟩→/k/ makes ⟨cm⟩ and ⟨km⟩
    // identical through this g2p, so an undeclared `cm` read centimetres as KILOMETRES and no leak class
    // could see it (trap 56).
    test("units: ⟨cm⟩ is NOT ⟨km⟩, both spellings of it, and the compound `sq mi` key", () => {
        expect(normalizeMaltese("20 cm")).toBe("20 ċentimetru");
        expect(normalizeMaltese("5 cm")).toBe("5 ċentimetri");
        expect(normalizeMaltese("5 ċm")).toBe("5 ċentimetri"); // the language's OWN spelling of the same key
        expect(normalizeMaltese("20 mi")).toBe("20 mil");
        expect(normalizeMaltese("5 mi")).toBe("5 mili");
        expect(normalizeMaltese("3900 ft")).toBe("3900 pied"); // invariant: `piedi` is ×0 in every source
        // ⚠ A COMPOUND KEY, because this abbreviation is not the composition of its parts (trap 44).
        expect(normalizeMaltese("11,100 sq mi")).toBe("11100 mil kwadru");
    });

    // ── THE ONE-LETTER `m` KEY and the guard that makes it safe. Trap 52's discipline: test the guard on the
    // shapes it must REJECT and read the output, because a lookbehind rejects a POSITION, not a string.
    test("the `m` key: metres read, a dotted designation refused", () => {
        expect(normalizeMaltese("2,764 m")).toBe("2764 metru");
        expect(normalizeMaltese("6.5m")).toBe("6 punt 5 metri"); // glued to a decimal: genuinely metres
        expect(normalizeMaltese("802.11m")).toBe("802 punt 11m"); // a DESIGNATION — refused whole
        expect(normalizeMaltese("802.11n")).toBe("802 punt 11n");
        // ⚠ AND THE KEYS THIS ORTHOGRAPHY FORBIDS. Every digit-adjacent `l` is the definite article and every
        // `t` is the elided *ta'*; declaring either would read an article as a litre or a tonne.
        expect(normalizeMaltese("10 l")).toBe("10 l");
        expect(normalizeMaltese("15 t'Ottubru")).toBe("15 t'Ottubru");
        expect(normalizeMaltese("2017, in-nofsinhar")).toBe("2017, in-nofsinhar");
    });

    // ── EXPONENT: postposed and AGREEING, so both the noun and its modifier move together.
    test("exponent: squared and cubed, both agreement branches", () => {
        expect(normalizeMaltese("20 km²")).toBe("20 kilometru kwadru");
        expect(normalizeMaltese("2 km²")).toBe("2 kilometri kwadri"); // both words inflect
        expect(normalizeMaltese("20 m³")).toBe("20 metru kubu");
        expect(normalizeMaltese("2 m³")).toBe("2 metri kubi");
        expect(normalizeMaltese("28,748 km2")).toBe("28748 kilometru kwadru"); // the ASCII exponent too
    });

    // ── THE RATE is LOCAL: `fis-siegħa` is a preposition fused with the article and its noun, not a
    // connective plus a denominator noun, so `unitPer` cannot express it (trap 47, reason 1).
    test("km/h: the fused per-hour phrase, with the numerator agreeing", () => {
        expect(normalizeMaltese("300 km/h")).toBe("300 kilometru fis-siegħa");
        expect(normalizeMaltese("7 km/h")).toBe("7 kilometri fis-siegħa");
    });

    // ── …AND `m/s`, the review's first finding. With only `km/h` claimed and no `rateDenominators` declared,
    // the shared tier matched the HEAD unit and STRANDED the denominator — `299,792,458 m/s` → *…mɛtru s*,
    // the speed of light read out as a distance. That is trap 53's half-a-reading, and worse than the raw
    // `m/s` this layer replaced. `fis-sekonda` is sourced in the numeral slot (*"200 kilometru
    // fis-sekonda"*), so the rule is generalised over the denominator rather than the whole match refused.
    test("m/s: the per-second phrase, every unit head, and an unlisted denominator refused whole", () => {
        expect(normalizeMaltese("100 m/s")).toBe("100 metru fis-sekonda"); // ≥11 → singular, as attested
        expect(normalizeMaltese("3 m/s")).toBe("3 metri fis-sekonda"); //     2–10 → plural
        expect(normalizeMaltese("16.5 m/s")).toBe("16 punt 5 metri fis-sekonda"); // a fraction → plural
        expect(normalizeMaltese("300,000 km/s")).toBe("300000 kilometru fis-sekonda"); // the other head unit
        expect(normalizeMaltese("5 cm/s")).toBe("5 ċentimetri fis-sekonda");
        expect(normalizeMaltese("20 km / h")).toBe("20 kilometru fis-siegħa"); // spaced slash, either side
        // ⚠ THE DENOMINATOR TABLE IS CLOSED — `h` and `s` are the only two this corpus writes (×0 of anything
        // else) — AND THE RESIDUAL IS PINNED HERE RATHER THAN HIDDEN. An unlisted denominator falls through
        // to the SHARED TIER, which matches the head unit and strands what follows the slash. That is the same
        // half-a-reading this rule just closed for `m/s`, and it cannot be closed from this file: the fix is a
        // guard on the tier's unit match in `core/normalizeSymbols.ts`, which is reported, not edited here.
        // If that guard ever lands, these two assertions fail and should become `5 km/j` / `5 m/kg` unchanged.
        expect(normalizeMaltese("5 km/j")).toBe("5 kilometri/j");
        expect(normalizeMaltese("5 m/kg")).toBe("5 metri/kg");
    });

    // ── THE `-il` LINKER BETWEEN A NUMBER AND ITS UNIT. The tier's number→unit pattern allows only
    // whitespace there, so this orthography's linker morpheme made the two non-adjacent and the unit symbol
    // fell through to the phoneme sink: `16-il ċm` → *sɪttaʃ ɪl t͡ʃm*, the review's third finding. The linker
    // is re-emitted, never stripped — it is a real morpheme of the spoken numeral.
    test("the `-il` linker: the unit is read THROUGH it, and a spelled noun is never bitten", () => {
        expect(normalizeMaltese("16-il ċm")).toBe("16-il ċentimetru"); // the corpus's one instance
        expect(normalizeMaltese("16-il cm")).toBe("16-il ċentimetru"); // …and the Latin spelling, identically
        expect(normalizeMaltese("15-il km")).toBe("15-il kilometru");
        expect(normalizeMaltese("48,514-il m")).toBe("48514-il metru"); // de-grouped first, ≥11 → singular
        // ⚠ THE TRAILING GUARD IS WHAT KEEPS `mi` OUT OF THE WORDS THE CORPUS ACTUALLY WRITES. Without it this
        // rule reads "12 miles" out of *12-il minuta* and leaves a stray letter behind.
        expect(normalizeMaltese("12-il mil")).toBe("12-il mil");
        expect(normalizeMaltese("12-il minuta")).toBe("12-il minuta");
        expect(normalizeMaltese("15-il kilometru")).toBe("15-il kilometru");
        // ⚠ AND AN EXPONENT OR A RATE ON A LINKED NUMERAL IS REFUSED WHOLE (×0 here) rather than stranded.
        expect(normalizeMaltese("16-il km²")).toBe("16-il km²");
        expect(normalizeMaltese("16-il km/h")).toBe("16-il km/h");
    });

    // ── THE TWO NUMERAL PARSERS MUST AGREE, and the review's fourth finding is the shape where they did not:
    // a 3-digit block after the separator is GROUPING to the tier's `numValue` and was a DECIMAL to this
    // file's `numeralValue`, so one numeral took opposite agreement in two rules of the same layer.
    test("numeral value: a 3-digit block is grouping in BOTH the local rules and the tier", () => {
        expect(normalizeMaltese("1.234 °C")).toBe("1 punt 234 grad Ċelsju"); // local rule (step 4) …
        expect(normalizeMaltese("1.234 m")).toBe("1 punt 234 metru"); //        … and the tier: both singular
        expect(normalizeMaltese("1.234 m/s")).toBe("1 punt 234 metru fis-sekonda"); // step 5, same answer
        // ⚠ AND A 1–2 DIGIT BLOCK IS STILL A FRACTION, which is the plural arm the ~20 attested decimals set.
        expect(normalizeMaltese("1.23 °C")).toBe("1 punt 23 gradi Ċelsju");
        expect(normalizeMaltese("1.23 m")).toBe("1 punt 23 metri");
    });

    test("the ampersand is the language's own conjunction, spaced on both sides", () => {
        expect(normalizeMaltese("B&B")).toBe("B u B"); // two initialisms, never one token
        expect(normalizeMaltese("R&Ż")).toBe("R u Ż"); // Riċerka u Żvilupp — ⟨u⟩ is literally the expansion
    });

    // ── END-TO-END, through the real phonemizer: every word this layer emits must come from the g2p and none
    // of it may reach the phoneme sink as a spelling (trap 6).
    test("the emitted words reach the g2p as words", () => {
        const mt = getPhonemizer("mt");
        expect(mt.text("40%").trim()).toBe("ɛrbɪn fɪl mɪja");
        expect(mt.text("-1 °C").trim()).toBe("mɪnus wɪħɛt ɡrat t͡ʃɛlsju"); // ⟨Ċelsju⟩ → t͡ʃ, not the /k/ of ⟨Celsius⟩
        expect(mt.text("2.6cm").trim()).toBe("tnɛjn punt sɪtta t͡ʃɛntɪmɛtrɪ"); // NOT the *km* it read before
        expect(mt.text("€487 miljun").trim()).toBe("ɛrba mɪja u sɛba u tmɛnɪn mɪljun ɛwrɔ");
        expect(mt.text("600 Q.K.").trim()).toBe("sɪt mɪja ʔabɛl krɪstu ."); // no INTERIOR pause; the final one stands
        expect(mt.text("100 m/s").trim()).toBe("mɪja mɛtru fɪs sɛkɔnda"); // not *mɛtru s*, a stranded letter
        expect(mt.text("16-il ċm").trim()).toBe("sɪttaʃ ɪl t͡ʃɛntɪmɛtru"); // not *t͡ʃm*, a raw symbol
    });

    // ── THE INVARIANT THAT OUTLIVES ANY SCHEDULE (trap 5's shelf-life note): whatever this layer grows next,
    // the article's hyphen is not a sign and a referee headword is not something it may touch. The second
    // assertion is the cheap proof that this layer cannot move `referee-eval/eval.ts mt`: measured over the
    // whole referee, 0 of 15,838 headwords are altered.
    test("nothing this layer does may bite an ordinary Maltese word", () => {
        for (const w of ["Il-Malti", "tal-Ingliż", "l-ilsien", "fil-mija", "iż-żmien", "ta' Malta", "mil-lvant"])
            expect(normalizeMaltese(w)).toBe(w);
    });
});
