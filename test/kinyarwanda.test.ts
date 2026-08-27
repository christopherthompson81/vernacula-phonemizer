import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kinyarwanda/numbers.ts";
import { normalizeKinyarwanda as N } from "../src/languages/kinyarwanda/normalize.ts";

// Kinyarwanda (rw) cardinal numbers — Bantu (JD61), Latin orthography, composed as TEXT and then run through the
// g2p (hence ⟨r⟩→ɾ, ⟨j⟩→ʒ, ⟨cy⟩→kʲ, ⟨cu⟩→t͡ʃu, ⟨ng⟩→ŋ in the expected IPA).
//
// Sources: languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) for the per-magnitude rule; Omniglot
// "Numbers in Kinyarwanda" + kinyarwanda.mofeko.com/numbers.html agree independently on 20–90 and miriyoni = 10⁶;
// Harvard ELIAS "Grammar: Cardinal and ordinal numbers" for the concord statement (1–7 take class agreement,
// 8/9/10 invariable).
//
// ⚠ EACH MAGNITUDE SELECTS ITS OWN MULTIPLIER SERIES — mirongo takes i- (mirongo itatu), magana takes a-
// (magana abiri), ibihumbi takes bi- (ibihumbi bibiri) — and 20 is the fused makumyabiri. A single bare
// "makumi" plus the citation units composes *makumi kabiri for 20, which is not a Kinyarwanda word.
describe("Kinyarwanda numbers", () => {
    test("units + ten (bare-numeral citation form)", () => {
        expect(numberToWords(0)).toBe("zeru");
        expect(numberToWords(1)).toBe("rimwe");
        expect(numberToWords(8)).toBe("umunani"); // invariable
        expect(numberToWords(10)).toBe("icumi");
        expect(phonemize("8", "rw")).toBe("umunani");
    });

    test("tens — mirongo + the i- series; 20 is the fused makumyabiri", () => {
        expect(numberToWords(18)).toBe("icumi na umunani");
        expect(numberToWords(20)).toBe("makumyabiri");
        expect(numberToWords(21)).toBe("makumyabiri na rimwe");
        expect(numberToWords(30)).toBe("mirongo itatu");
        expect(numberToWords(80)).toBe("mirongo inani");
        expect(numberToWords(88)).toBe("mirongo inani na umunani");
        expect(numberToWords(99)).toBe("mirongo icyenda na icyenda");
        expect(phonemize("20", "rw")).toBe("makumʲabiɾi");
        expect(phonemize("80", "rw")).toBe("miɾoŋo inani");
    });

    test("hundreds — ijana / magana + the class-6 a- series", () => {
        expect(numberToWords(100)).toBe("ijana");
        expect(numberToWords(200)).toBe("magana abiri");
        expect(numberToWords(555)).toBe("magana atanu na mirongo itanu na gatanu");
        expect(phonemize("200", "rw")).toBe("maɡana abiɾi");
    });

    test("thousands — igihumbi / ibihumbi + the class-8 bi- series", () => {
        expect(numberToWords(1000)).toBe("igihumbi");
        expect(numberToWords(2000)).toBe("ibihumbi bibiri");
        expect(numberToWords(8000)).toBe("ibihumbi munani");
        // ≥10 thousand: the multiplier reverts to the citation series (deliberate simplification)
        expect(numberToWords(12345)).toBe("ibihumbi icumi na kabiri na magana atatu na mirongo ine na gatanu");
    });

    test("millions — miriyoni", () => {
        expect(numberToWords(1000000)).toBe("miriyoni");
        expect(numberToWords(3000000)).toBe("miriyoni gatatu");
        expect(numberToWords(1000001)).toBe("miriyoni na rimwe");
        expect(phonemize("1000000", "rw")).toBe("miɾijoni");
    });

    // ⚠ 10⁹ USED TO SPELL ITSELF OUT — `1000000000` composed nothing and fell to "rimwe zeru zeru …", ten
    // digit words for a round number Kinyarwanda has a word for. `miriyari` is attested in rw.wikipedia's own
    // prose ×8, and the deciding hit is "akayabo ka miriyari 53 na miriyoni 910" — the compositor's exact
    // output shape, with this table's `miriyoni` and `na`. en.wiktionary's `miliyari` entry glosses it
    // "(Kinyarwanda) billion". The l-dominant spelling `miliyari` (×257) is the same word in the French-
    // influenced orthography (rw l~r is allophonic); see numbers.ts for why the r-form is authored.
    test("⚠ billions — miriyari, and the shape the corpus itself writes", () => {
        expect(numberToWords(1000000000)).toBe("miriyari");
        expect(numberToWords(2000000000)).toBe("miriyari kabiri");
        expect(numberToWords(1000000001)).toBe("miriyari na rimwe");
        // The corpus's own compound: 53 miriyari and 910 miriyoni.
        expect(numberToWords(53_910_000_000)).toBe(
            "miriyari mirongo itanu na gatatu na miriyoni magana cyenda na icumi",
        );
        expect(phonemize("1000000000", "rw")).toBe("miɾijaɾi");
    });

    // ⚠ THE CEILING IS A REFUSAL TO COMPOSE, NEVER A LICENCE TO GO SILENT (test/bignum-fallback.test.ts).
    // No 10¹² word is authored — rw.wikipedia writes `tiriyoni` only ×2, both inside converted foreign units
    // — so 10¹² and above must still be SPOKEN, digit-at-a-time, out of rw's own `units`.
    test("⚠ above the authored ceiling the digits are still read — never empty, never ASCII", () => {
        const over = numberToWords(1234567890123); // 13 digits, over 10¹², far under 2^53
        expect(over).not.toBe("");
        expect(over).not.toMatch(/\d/u);
        expect(over).toBe(numberToWords(1234567890123)); // deterministic
        // …and it reads the DIGITS, not a placeholder: change one digit, change the reading.
        expect(numberToWords(1234567890124)).not.toBe(over);
        // The unsafe-integer branch is the same fallback.
        expect(numberToWords(9007199254740993)).not.toMatch(/\d/u);
        expect(phonemize("1234567890123", "rw")).not.toMatch(/\d/u);
        // …but 10¹¹ still COMPOSES — the new ceiling must not have swallowed the normal path.
        expect(numberToWords(100000000000)).toBe("miriyari ijana");
    });

    /**
     * ⚠ THE FALLBACK READS THE TOKEN TEXT, NOT THE FLOAT'S RENDERING OF IT. Above 2^53 the `number` has
     * already lost its low digits, so `String(n)` is a DIFFERENT quantity from what the writer typed —
     * `9007199254740993` re-stringified as `…992` and `12345678901234567890` as `…4567000`, both read out
     * digit-by-digit with total confidence. The digit-at-a-time path exists because the float cannot be
     * trusted; re-consulting the float inside it defeats the whole guard. `phonemize` is what pins it,
     * because the call site is where the token text lives.
     */
    test("⚠ an unsafe integer reads the DIGITS THE WRITER TYPED, not the float's rounding of them", () => {
        // 2^53+1 and 2^53+2 differ in their LAST digit; the float collapses the first onto …992.
        expect(numberToWords(9007199254740993, "9007199254740993").split(" ").at(-1)).toBe("gatatu");
        expect(numberToWords(9007199254740994, "9007199254740994").split(" ").at(-1)).toBe("kane");
        // …and the reading is different for the two, which the re-stringified form could not manage.
        expect(phonemize("9007199254740993", "rw")).not.toBe(phonemize("9007199254740994", "rw"));
        // A 20-digit run keeps all twenty digits rather than the float's 17 significant ones plus zeros.
        expect(phonemize("12345678901234567890", "rw").split(" ")).toHaveLength(20);
        expect(phonemize("12345678901234567890", "rw").split(" ").at(-2)).toBe("ikʲenda"); // …9|0, not 0|0
    });
});

// ── TEXT NORMALIZATION (src/languages/kinyarwanda/normalize.ts) ────────────────────────────────────────────
//
// Asserted through `phonemize` wherever the reading is the point, and through `normalizeKinyarwanda` where
// the ORDER of the rewritten words is (the g2p obscures word boundaries less than it obscures spellings, but
// the text form is what the file's ordering comments are about).
//
// ⚠ PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). Every table-plus-composition rule here has
// at least three: the shared tier's number-then-unit path, the LOCAL unit-then-number path the tier cannot
// see, and the boundary between them. Several cases below are deliberately shapes the rw corpus does NOT
// contain — the adversarial neighbour of a rule is where trap 8 says the defect lives.
//
// Sourcing for every word asserted here is in normalize.ts's header and in tools/corpus/attest/rw.jsonc.
describe("Kinyarwanda text normalization", () => {
    test("percent — POSTPOSED `ku ijana`, on an integer and on a decimal", () => {
        expect(N("60%")).toBe("60 ku ijana");
        // The decimal is spelled digit-by-digit (no separator word is sourced), and the percent word must
        // still have attached BEFORE that happened — this is the coupling that forces the tier to run in the
        // middle of the pass rather than at either end.
        expect(N("49.5%")).toBe("49 5 ku ijana");
        expect(N("98,6%")).toBe("98 6 ku ijana");
        expect(phonemize("60%", "rw")).toBe("miɾoŋo itandatu ku iʒana");
    });

    test("percent SPAN keeps exactly one sign", () => {
        // Without this the tier reads each side separately and the hyphen is dropped, leaving the joiner
        // silent inside a doubled noun (`25 ku ijana-30 ku ijana`).
        expect(N("25%-30%")).toBe("25 kugeza kuri 30 ku ijana");
    });

    test("currency — PREFIXED, and the ISO codes are keys too", () => {
        expect(N("$1,000")).toBe("amadolari 1000");
        expect(N("US $ 115,600,000")).toBe("US amadolari 115600000");
        expect(N("Rwf120,250")).toBe("amafaranga y'u Rwanda 120250");
        expect(N("miliyari 290 Frw")).toBe("miliyari amafaranga y'u Rwanda 290");
        // ⚠ THE EURO IS DELIBERATELY UNREAD — one hit in one article, and that article is the one the corpus
        // already carries. A dropped sign is missing; a wrong currency word is confidently wrong.
        expect(N("ni iyero (€)")).toBe("ni iyero (€)");
    });

    test("units — BOTH written orders converge on the same reading", () => {
        // The tier sees this one…
        expect(N("26,338 km²")).toBe("kilometero kare 26338");
        // …and cannot see this one, which is 30 of the artifact's 72 unit instances (trap 47 reason 2).
        expect(N("km² 26,338")).toBe("kilometero kare 26338");
        expect(N("m 900")).toBe("metero 900");
        expect(N("cm 25")).toBe("santimetero 25");
        expect(N("kg 250")).toBe("kirogarama 250");
        // ⚠ THE UNSPACED FORM IS NOT THE PREFIX SHAPE: `km2` is `km²` with an ASCII exponent, and an optional
        // space in the prefix rule read its `2` as the unit's number and emitted `kilometero2`.
        expect(N("450,1hab/km2")).toBe("450 1hab kuri kilometero kare");
    });

    test("⚠ a GROUPED thousand glued to a one-letter unit — the reason de-grouping runs before the tier", () => {
        // The tier's `NOT_VERSION` guard (`802.11g` is not eleven grams) rejects `\d+[.,]\d+[a-zA-Z]`, so
        // `1.300m` reaches it as a version designation and the metre is refused. De-grouped first it reads.
        expect(N("hagati ya 1.300m na 1.800m")).toBe("hagati ya metero 1300 na metero 1800");
        // …and the guard still does its job on a real dotted designation: no unit word appears.
        expect(N("802.11g")).toBe("802 1 1g");
    });

    test("the exponent words, on both powers and on a bare denominator", () => {
        expect(N("8090 km²")).toBe("kilometero kare 8090");
        expect(N("metero kibe 256")).toBe("metero kibe 256"); // already spelled out — untouched
        expect(N("kilometero kibe 65")).toBe("kilometero kibe 65");
        expect(N("16.598/km²")).toBe("16598 kuri kilometero kare");
        // A unit standing behind a quantifier with no numeral of its own — the tier's rate path cannot see it.
        expect(N("abantu 438 kuri buri km²")).toBe("abantu 438 kuri buri kilometero kare");
    });

    test("rates compose with the attested `kuri`", () => {
        // The corpus glosses its own symbol: "kirogarama ijana z'imbuto KURI hegitari imwe (100kg/ha)".
        expect(N("100kg/ha")).toBe("kirogarama 100 kuri hegitari");
        expect(N("200g/l")).toBe("garama 200 kuri litiro");
    });

    test("degrees — Celsius is named, Fahrenheit is claimed but UNnamed", () => {
        expect(N("20 °C")).toBe("dogere selisiyusi 20");
        // ⚠ `farenheti` is 0 tokens / 0 articles on rw.wikipedia. The letter is claimed so it cannot reach the
        // g2p as a phoneme; the scale is left unsaid rather than invented, and the °C beside it already said
        // the number's meaning.
        expect(N("24 ° C (75 ° F)")).toBe("dogere selisiyusi 24 (dogere 75)");
        // The redundancy guard: the writer already typed the noun, so it is not repeated (BOTH directions).
        expect(N("hagati ya dogere 22° na 35°")).toBe("hagati ya dogere 22 na 35");
    });

    test("a NEGATIVE temperature — the one slot with an attested sign reading", () => {
        expect(N("–7 °C")).toBe("dogere selisiyusi 7 munsi ya zeru");
        expect(N("−27.2 °C")).toBe("dogere selisiyusi 27 2 munsi ya zeru");
        // ⚠ AND NOT A BARE NEGATIVE. `munsi ya zeru` is "below zero" — it presupposes a scale with a zero
        // point and says nothing about a plain `-5`, for which nothing is attested. Deliberately unread, and
        // `review.ts --lang rw` stays RED on the minus class because of it.
        expect(N("ubushyuhe bwa -5")).toBe("ubushyuhe bwa -5");
    });

    test("coordinates — the compass letter is a DIRECTION, and its decimal is spelled here", () => {
        expect(N("2° 36′ 58″ S")).toBe("dogere 2 36′ 58″ amajyepfo");
        // ⚠ THE ONLY THREE-PLACE DECIMALS IN THE CORPUS ARE COORDINATES, which is why de-grouping rejects a
        // following `°` and why the degree arms spell their own operand: step 10 takes a 1–2 digit tail only.
        expect(N("1.867 ° S 30.367 ° E")).toBe("dogere 1 8 6 7 amajyepfo dogere 30 3 6 7 iburasirazuba");
    });

    test("ranges — `kugeza kuri`, ascending only, and the unit is HOISTED", () => {
        expect(N("15-24")).toBe("15 kugeza kuri 24");
        expect(N("1250-1750mm")).toBe("milimetero 1250 kugeza kuri 1750");
        expect(N("80-94 cm")).toBe("santimetero 80 kugeza kuri 94");
        expect(N("dogere selisiyusi 26-28")).toBe("dogere selisiyusi 26 kugeza kuri 28");
        expect(N("40-42 °")).toBe("dogere 40 kugeza kuri 42");
        // ⚠ NON-ASCENDING SPANS ARE DECLINED — seasons, scores and formulations, all measured in the corpus.
        expect(N("1990–91")).toBe("1990–91");
        expect(N("igitego 1-0")).toBe("igitego 1-0");
        expect(N("NPK(17-17-17)")).toBe("NPK(17-17-17)");
        // …and a hyphen that is not a span at all.
        expect(N("COVID-19")).toBe("COVID-19");
        expect(N("Kuva 2006-Ukwakira")).toBe("Kuva 2006-Ukwakira");
    });

    // ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (playbook trap 58). The right guard rejected a bare
    // `.` or `,`, which is a sentence end far more often than a number's interior, so `imyaka 15-24.` and
    // `Muri 2009-2010,` were declined whole and read as two juxtaposed cardinals with no joiner. The branch
    // is pinned rather than the corpus instance (trap 13), and the DECIMAL COMMA — which Kinyarwanda writes
    // — is still what declines a continuing right operand, because the guard now requires a digit after it.
    test("a clause-final span keeps its joiner AND its pause", () => {
        expect(N("hagati yimyaka 15-24.")).toBe("hagati yimyaka 15 kugeza kuri 24.");
        expect(N("Muri 2009-2010,")).toBe("Muri 2009 kugeza kuri 2010,");
        expect(N("Crises 1900 – 1994,")).toBe("Crises 1900 kugeza kuri 1994,");
        expect(N("1250-1750mm.")).toBe("milimetero 1250 kugeza kuri 1750."); // the unit arm too
        // the decimal comma still declines the pair, exactly as before
        expect(N("2,2-2,8")).toBe("2 2-2 8");
        // and a hyphen chain that ends a sentence is still not a span
        expect(N("NPK(17-17-17).")).toBe("NPK(17-17-17).");
    });

    test("times — the marker identifies a clock; three fields are a duration unless a zone says otherwise", () => {
        expect(N("saa 10:00 za mbere")).toBe("saa 10 za mbere");
        expect(N("saa 3:15")).toBe("saa 3 na iminota 15");
        // A race duration, composed from the wiki's own spell-out of the same quantity.
        expect(N("igihe cya 2:51:07")).toBe("igihe cya amasaha 2 iminota 51 amasegonda 7");
        // An ISO timestamp is NOT a duration — the timezone is the discriminator, and nothing is invented.
        expect(N("11:59:59 UTC")).toBe("11 59 59 UTC");
        // ⚠ AN UNMARKED TWO-FIELD TIME KEEPS ITS DIGITS AND LOSES ONLY THE SPURIOUS PAUSE. `:` is
        // clausePunctuation, so a bible verse was reading as two clauses; there is no attested Kinyarwanda
        // reading for a verse reference or a pace, so the colon is spent on a space and nothing else.
        expect(N("Marko 14:25")).toBe("Marko 14 25");
    });

    test("de-grouping and decimals — both separators do both jobs, and the 3-digit block decides", () => {
        expect(N("2,944,459")).toBe("2944459");
        expect(N("19.000.700")).toBe("19000700");
        expect(N("8 000 000")).toBe("8000000");
        expect(N("7.87")).toBe("7 8 7");
        expect(N("1157,3 km²")).toBe("kilometero kare 1157 3");
        // ⚠ A DOTTED CHAIN IS NOT A DECIMAL. `NPK17.17.17` is a fertiliser grade, and a `(?!\d)` guard let its
        // first pair through because the character after it is a dot rather than a digit.
        expect(N("NPK17.17.17")).toBe("NPK17.17.17");
        // …while a decimal at a SENTENCE END still reads, which the obvious wider guard would have broken.
        expect(N("ni 49.5.")).toBe("ni 49 5.");
        // A date comma has a four-digit tail and is excluded by de-grouping and by the decimal rule alike.
        expect(N("Ukuboza 26,2008")).toBe("Ukuboza 26,2008");
    });

    test("dotted capital runs — the interior dots were sentence breaks, and a dot is never ADDED", () => {
        expect(N("muri U.R.S.S. no muri Pologne")).toBe("muri URSS no muri Pologne");
        expect(N("muri U.R.S.S.")).toBe("muri URSS."); // the sentence really does end
        // ⚠ THE DOTLESS SHAPE IS rw's COMMONEST, and the Chichewa rule this is copied from would have
        // manufactured a sentence break in the middle of an agency's own name.
        expect(N("R.R.A Rwanda Revenue Authority")).toBe("RRA Rwanda Revenue Authority");
    });

    test("the ampersand takes the manifest's own conjunction, spaced on both sides", () => {
        expect(N("Arts & Sciences")).toBe("Arts na Sciences");
        // Spaced, or two initialisms fuse into one token (the merge defect of trap 18).
        expect(N("E&D Limited")).toBe("E na D Limited");
    });

    test("⚠ ORDINARY TEXT SURVIVES — no rule may fire on a plain Kinyarwanda sentence", () => {
        const plain = "U Rwanda ni igihugu giherereye muri Afurika y'uburengerazuba, mu karere k’ibiyaga bigari.";
        expect(N(plain)).toBe(plain);
        // `kare`/`kibe`/`na`/`kuri` are all ordinary words as well as rule output; none of them is a trigger.
        const words = "Mu karere ka Huye, abantu bahageze kare kandi bagumye kuri gahunda.";
        expect(N(words)).toBe(words);
    });

    // TWO NON-SI SPELLINGS OF THE GRAM SYMBOL, written in ONE corpus sentence — the fertiliser-dosing
    // instructions: "Gushyiramo ifumbire ya NPK GR 12.5 kuri buri m2 1 … agafuniko 1 kagira GM 6".
    // `garama` is already the declared reading of ⟨g⟩; what is claimed is only that this text spells that
    // symbol `gr` and `gm`. The unit PRECEDES its figure in both, so the tier's digit-adjacent arm cannot
    // reach them and the bare-unit arm is what reads them.
    // ⚠ `gr` is the half the raw-Latin gate CANNOT SEE — this engine reads ASCII ⟨r⟩ as ɾ, so `gr` echoed
    // as *ɡɾ*, not byte-identical to its source and never reported, while `gm` one clause away was.
    test("the gram symbol in both of the spellings this corpus uses", () => {
        expect(phonemize("agafuniko 1 kagira gm 6", "rw")).toContain("ɡaɾama");
        expect(phonemize("ifumbire ya NPK gr 12.5", "rw")).toContain("ɡaɾama");
        // exact case on the bare-unit path — an upper-case pair is not a unit
        expect(phonemize("imodoka ya GM", "rw")).not.toContain("ɡaɾama");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The `dogere` redundancy guard must not read the engine's OWN insertions.
//
// `saidNear` asks one question — did the WRITER already write the noun? — and it reads the pre-replacement
// string, which within a single pass is exactly right. Across passes it was not: by arm 4c the string
// carried 4a's inserted `dogere`, so ONE CONSTRUCTION GOT TWO ANSWERS depending on which arm claimed each
// half. ⚠ Every emitted `dogere` now carries a U+0000 mark, the guard strips a marked occurrence before
// testing, and the marks come off after 4e — the LAST arm, because a strip one step earlier would blind it.
// ⚠ 0 golden rows move; the evidence is the corpus's own °C/(°F) glosses.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("the degree noun's redundancy guard sees only what the writer wrote", () => {
    test("a mixed-arm pair now reads like a same-arm one", () => {
        // Both figures negative → both claimed by 4a, one pass, neither sees the other. Already right.
        expect(N("−27.2 °C (−17.0 °F)"))
            .toBe("dogere selisiyusi 27 2 munsi ya zeru (dogere 17 0 munsi ya zeru)");
        // First 4a, second 4c — 4c used to see 4a's insertion and suppress, so the parenthetical lost its
        // noun AND its scale word and read a bare *(6 1)*.
        expect(N("−14.4 °C (6.1 °F)"))
            .toBe("dogere selisiyusi 14 4 munsi ya zeru (dogere 6 1)");
    });

    test("…and the word the WRITER wrote still suppresses it, for every figure in reach", () => {
        // The corpus's own spell-out: one noun heads two signs, and the guard looks BOTH ways.
        expect(N("dogere 22° na 35°")).toBe("dogere 22 na 35");
        // With no noun in the source, each figure gets its own — including across arms (4a then 4e).
        expect(N("hagati ya 22° na 35°")).toBe("hagati ya dogere 22 na dogere 35");
        expect(N("−5 °C na 30°")).toBe("dogere selisiyusi 5 munsi ya zeru na dogere 30");
    });

    test("the coordinate arm still repeats the noun per AXIS, which rw does on purpose", () => {
        expect(N("2° 36′ 58″ S, 29° 44′ 34″ E"))
            .toBe("dogere 2 36′ 58″ amajyepfo, dogere 29 44′ 34″ iburasirazuba");
    });

    test("⚠ the mark can never reach the output", () => {
        const NUL = String.fromCharCode(0);
        for (const c of ["−27.2 °C (−17.0 °F)", "40-42 °", "2° 36′ 58″ S", "dogere 22°", "42", "x"]) {
            expect(N(c).includes(NUL)).toBe(false);
            expect(phonemize(c, "rw").includes(NUL)).toBe(false);
        }
    });
});
