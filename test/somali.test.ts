import { describe, expect, test } from "vitest";

import { phonemizeWord, createSomali } from "../src/languages/somali/somali.ts";
import { phonemize } from "../src/index.ts";
import { normalizeSomali } from "../src/languages/somali/normalize.ts";

// Canonical-IPA goldens for Somali / Af-Soomaali (so) — Cushitic, 1972 Latin orthography. A shallow near-phonemic
// rule g2p; the signature Cushitic consonants ⟨c⟩→ʕ, ⟨x⟩→ħ (pharyngeals), ⟨dh⟩→ɖ (retroflex), ⟨q⟩→q (uvular),
// ⟨'⟩→ʔ; doubled letters geminate (→ Cː), doubled vowels are long (→ Vː). Tone (grammatical, unwritten) is
// deferred. Referees: epitran som-Latn + kaikki so.
describe("Somali canonical IPA", () => {
    test("the pharyngeals ⟨c⟩→ʕ, ⟨x⟩→ħ", () => {
        expect(phonemizeWord("magac")).toBe("maɡaʕ"); // c → ʕ (voiced pharyngeal)
        expect(phonemizeWord("caano")).toBe("ʕaːno"); // c → ʕ, aa → aː
        expect(phonemizeWord("xariir")).toBe("ħariːr"); // x → ħ (voiceless pharyngeal), ii → iː
    });

    test("⟨dh⟩→ɖ (retroflex), ⟨q⟩→q (uvular), ⟨sh⟩→ʃ, ⟨kh⟩→χ", () => {
        expect(phonemizeWord("dhagax")).toBe("ɖaɡaħ"); // dh → ɖ, x → ħ
        expect(phonemizeWord("gabadh")).toBe("ɡabaɖ"); // dh → ɖ
        expect(phonemizeWord("qof")).toBe("qof"); // q → q (uvular)
        expect(phonemizeWord("shan")).toBe("ʃan"); // sh → ʃ
    });

    test("long vowels (doubled) and geminate consonants", () => {
        expect(phonemizeWord("soomaali")).toBe("soːmaːli"); // oo → oː, aa → aː
        expect(phonemizeWord("abbaan")).toBe("abːaːn"); // bb → bː (geminate), aa → aː
        expect(phonemizeWord("biyo")).toBe("bijo"); // y → j
        expect(phonemizeWord("af")).toBe("af"); // (no word-initial glottal marked)
    });

    test("numbers (units-first with iyo)", () => {
        const d = createSomali();
        expect(d.text("21").trim()).toBe("kow ijo labaːtan"); // kow iyo labaatan
        expect(d.text("100").trim()).toBe("boqol"); // boqol
        expect(d.text("234").trim()).toBe("laba boqol ijo afar ijo sodːon"); // laba boqol iyo afar iyo soddon
    });

    // ── NORMALIZATION ────────────────────────────────────────────────────────────────────────────────
    // Counts from the language-filtered so.wikipedia dump (70,854 paragraphs; so.wikipedia is 88.5% Somali,
    // so the filter matters far less here than for su, but it is applied and recorded in the artifact).
    describe("text normalization", () => {
        // ⚠ SOMALI WRITES THE ENGLISH CONVENTION — comma groups, period marks the decimal — 19:1 and 37:1.
        // Both separators were clause punctuation, so a grouped number came apart into three spoken clauses.
        test("thousands and decimals, English convention", () => {
            expect(phonemize("2,381,741 km", "so")).toContain("maljuːn"); // ×3,598 — was three clauses
            expect(phonemize("0.53 hektar", "so")).toContain("ɖibiʕ"); // ×3,082
            expect(phonemize("84.3 boqolkiiba", "so")).toContain("ɖibiʕ");
            expect(phonemize("1,234.56", "so")).toContain("ɖibiʕ"); // ×49 carry BOTH separators
        });

        // ⚠ THE LANGUAGE'S BIGGEST CLASS IS LEFT ALONE (trap 16). Somali binds morphology to a numeral with a
        // hyphen ×7,498 (-kii ×3,023, -aad ×1,436, -meeyadii ×800) and it already reads correctly, because the
        // TOKEN splits on the hyphen and both halves are ordinary Somali. The range rule requires digits on
        // BOTH sides precisely so it cannot claim this pattern.
        test("the bound-suffix numeral is untouched, and the range rule stays off it", () => {
            expect(phonemize("2010-kii", "so")).toBe("laba kun ijo toban kiː");
            expect(phonemize("1980-meeyadii", "so")).toContain("meːjadiː");
            expect(phonemize("1aad", "so")).toBe("kow aːd");
            expect(phonemize("Febraayo 2019-February 2020", "so")).not.toContain("ilaː"); // number-hyphen-WORD
            expect(phonemize("1268-69", "so")).toContain("ilaː"); // ×2,690 — digits both sides IS a range
        });

        // ⚠ THE CLAUSE-FINAL BRANCH, PINNED SEPARATELY (trap 13). A sentence period is not part of a number,
        // and the trailing guard used to reject one, so every range that ENDED A CLAUSE was declined. One of
        // those was worse than silent: with the span rule out of the way, `1960 -1969.` reached the
        // signed-number rule and read *1960 LAGA JARAY 1969* — a SUBTRACTION the source never wrote.
        // ⚠ AND THE `,` IS DELIBERATELY STILL REJECTED — this rule has no ascending-only test, so the comma
        // is the only thing declining a TRUNCATED SECOND ENDPOINT (`1654-57,` → *1654 ilaa 57*).
        test("a range that ENDS A CLAUSE is still a range, and stops being a subtraction", () => {
            expect(phonemize("Sanadihii 2012-2013.", "so")).toContain("ilaː");
            expect(phonemize("boqolkiiba 19-30.", "so")).toContain("ilaː");
            expect(phonemize("Sanadihii 1960 -1969.", "so")).toContain("ilaː");
            expect(phonemize("Sanadihii 1960 -1969.", "so")).not.toContain("laɡa d͡ʒaraj"); // not a minus
            expect(phonemize("Sanadihii 1654-57,", "so")).not.toContain("ilaː"); // truncated endpoint
        });

        // ⚠ THE ERA MARKERS ARE THE LARGEST CLASS THIS LAYER REPAIRS, and Somali has its own pair alongside the
        // borrowed ones. `C.H.` ×121 and `C.D` ×213 are glossed by the corpus itself (Ciise Hortiis / Ciise
        // Dabadiis); the GLUED calendar letters are bigger than every spaced marker combined (H ×567, M ×25).
        test("era markers, including the glued calendar letters", () => {
            expect(phonemize("607 C.H.", "so")).toContain("ʕiːse hortiːs");
            expect(phonemize("70 C.D. Rooma", "so")).toContain("ʕiːse dabadiːs");
            expect(phonemize("728H", "so")).toContain("hid͡ʒri"); // ×567
            expect(phonemize("sanadkii 18H", "so")).toContain("hid͡ʒri"); // ×305 are two-digit years
            expect(phonemize("Sanadkii 1999M", "so")).toContain("miːlaːdi"); // 3-4 digits + a year word
            // ⚠ AND A BARE `1999M` DOES NOT FIRE, which is the guard working rather than a gap: without a year
            // context the same shape is a model number or an altitude. This line asserted the opposite before
            // the corpus showed both false positives.
            expect(phonemize("1999M", "so")).not.toContain("miːlaːdi");
            // ⚠ …but one or two digits is MILLION, not a year (`$2M`, `8M oo higtar`, ×21). Reading the short
            // form as an era would date a sum of money to the year 2.
            expect(phonemize("8M oo higtar", "so")).toContain("miljan");
            expect(phonemize("$2M", "so")).toBe("laba miljan doːlar"); // and the magnitude must hop the noun
            // ⚠ `CD-yada` is compact discs, in this same corpus — the leading digit is what excludes it.
            expect(phonemize("CD-yada iyo Internetka", "so")).not.toContain("dabadiːs");
            // ⚠ AND THE ERA `M` NEEDS A YEAR CONTEXT, which the corpus forced: two of its 25 instances are not
            // years at all — a Tupolev airliner and an altitude in METRES. Both must stay unread rather than
            // be dated. (The tier cannot rescue the metres case: its unit keys are case-SENSITIVE.)
            expect(phonemize("Diyaaradda Tu-154M oo", "so")).not.toContain("miːlaːdi");
            expect(phonemize("badda kasareysa 2,407M", "so")).not.toContain("miːlaːdi");
            expect(phonemize("150H/766M", "so")).toContain("miːlaːdi"); // the calendar-PAIR frame still fires
        });

        test("units, percent, signs and the c=/ʕ/ abbreviations", () => {
            expect(phonemize("30 km", "so")).toContain("kiːloːmitir");
            expect(phonemize("2 km²", "so")).toContain("laba d͡ʒibaːran"); // laba jibaaran ×123
            expect(phonemize("50 cm³", "so")).toContain("ʕubo"); // cubo ×4 — `saddex jibaaran` scores ZERO
            expect(phonemize("26%", "so")).toContain("boqolkiːba"); // ×499
            // ⟨c⟩ is /ʕ/, so these were not merely unread but audibly wrong: °C was *ʕ*, BC was *bʕ*.
            expect(phonemize("25 °C", "so")).toContain("darad͡ʒo");
            expect(phonemize("A & B", "so")).toContain("ijo"); // ×1,116
            expect(phonemize("1/2", "so")).toBe("nus");
            expect(phonemize("-5", "so")).toContain("laɡa d͡ʒaraj");
        });
    });
});

// THE RAW-LATIN PASS — an ASCII run with no vowel that the source typed and the IPA still says verbatim.
// ⚠ In Somali these are audible rather than silent, because ⟨c⟩ is /ʕ/ and the engine reads an unknown run:
// `sq mi` reached the IPA as *sq mi*. Step 3b spends four populations, each a different mechanism.
describe("Somali normalization: the raw-Latin runs", () => {
    test("⚠ the ordinal tail, settled INSIDE one of its own two sentences", () => {
        // *"longitudes 33aad meridian bari iyo 48th meridian bari"* — the Somali ordinal and the English
        // one in the same clause about the same kind of thing. `-aad` is the corpus's suffix ×1,436, and
        // the engine already reads `1aad` as *kow aad* with no rule, so the rewrite hands the result to a
        // path known to work rather than inventing a reading.
        expect(normalizeSomali("48th meridian bari")).toBe("48aad meridian bari");
        expect(normalizeSomali("33aad meridian bari")).toBe("33aad meridian bari");
    });

    test("⚠ `sq` cost TWO readings, not one — it also broke the unit's digit adjacency", () => {
        // `mi` is declared as `mayl` and read correctly everywhere else; with `sq` standing between the
        // number and the symbol it went unread in all six of these, and `sq` itself reached the IPA.
        expect(normalizeSomali("(426,372.61 sq mi)")).toBe("(426372 dhibic 6 1 mayl laba jibaaran)");
        // ⚠ THE WORDS, NOT A SUPERSCRIPT. Rewriting `sq mi` to `mi²` is neat where a digit precedes and
        // WRONG where one does not — `610 deggane/sq mi` has a word in front, the tier's digit-adjacent
        // path declines, and a `²` this layer INVENTED reaches the phoneme sink as a RAWMARK. Trading a
        // reported leak for an unreported one is the one move this class must not make.
        expect(normalizeSomali("610 deggane/sq mi")).toBe("610 deggane halkii mayl laba jibaaran");
        // ⚠ ONLY BEFORE A DECLARED UNIT. Somali has no foot, so `sq ft` keeps BOTH letters and both stay
        // reported — half a reading is worse than a visible leak, the same rule the tier applies to rates.
        expect(normalizeSomali("(430 sq ft) qofkiiba")).toBe("(430 sq ft) qofkiiba");
    });

    test("⚠ an UPPERCASE `sq`/`cu` folded to a declared unit, not to the literal word \"undefined\"", () => {
        // This is the only arm in step 3b with the `i` flag, and only the MODIFIER capture was folded
        // before use — the unit capture indexed the table with `"MI"`, which is not a key, so the template
        // stringified `undefined` and the WORD reached the phoneme sink. A leak strictly worse than the one
        // the rule removes, and invisible to every fixture because all six corpus hits are lowercase.
        expect(normalizeSomali("(430 SQ MI)")).toBe("(430 mayl laba jibaaran)");
        expect(normalizeSomali("(12 Cu M)")).toBe("(12 mitir cubo)");
        expect(phonemize("430 SQ MI", "so")).not.toContain("undefined");
    });

    test("⚠ three `km` lines, four different shapes, and one of them was a MIS-READING", () => {
        // `91 km 2` read as *kiiloomitir 2* — the kilometre correctly and then a stray "two", a number the
        // source never said. That is not a leak and no leak counter would ever have found it.
        expect(normalizeSomali("91 km 2 (35 sq mi)")).toBe("91 kiiloomitir laba jibaaran (35 mayl laba jibaaran)");
        // A bare rate: a slash with a unit after it and none before, so the tier's rate branch has nothing
        // to key on. `halkii` is the connective already declared as `unitPer`, and the corpus spells it out
        // in this exact frame one clause later.
        expect(normalizeSomali("26,800/km 2")).toBe("26800 halkii kiiloomitir laba jibaaran");
        expect(normalizeSomali("1,200 qof halkii km2")).toBe("1200 qof halkii kiiloomitir laba jibaaran");
        // A hyphen-attached unit. ⚠ The hyphen proves nothing on its own — Somali's commonest pattern is a
        // numeral bound to morphology with one (`2010-kii` ×3,023) — so what separates the two is that a
        // DECLARED UNIT KEY is not a Somali suffix.
        expect(normalizeSomali("750-km (470 mi)")).toBe("750 kiiloomitir (470 mayl)");
        expect(normalizeSomali("sanadkii 2010-kii")).toBe("sanadkii 2010-kii");
    });

    test("`mph` is spelled as the rate it abbreviates, out of words already sourced", () => {
        // `mi` → mayl, `h` → saacad, `unitPer` → halkii. Nothing new is claimed about Somali; what is
        // claimed is what `mph` stands for.
        expect(normalizeSomali("300 km/h (190 mph)")).toBe(
            "300 kiiloomitir halkii saacad (190 mayl halkii saacad)",
        );
    });
});
