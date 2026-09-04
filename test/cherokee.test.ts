import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/cherokee/cherokee.ts";
import { normalizeCherokee } from "../src/languages/cherokee/normalize.ts";
import { numberToWords } from "../src/languages/cherokee/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Cherokee / ᏣᎳᎩ (chr) — Iroquoian, the Cherokee syllabary. AUTHORED from
// Montgomery-Anderson, *A Reference Grammar of Oklahoma Cherokee*. ⚠ The syllabary is a SHALLOW PHONEMIC
// SKELETON — it marks no tone, length, aspiration, glottal stop or intrusive-h — so these goldens are the
// SEGMENTAL melody only (obstruents phonemically VOICELESS: aspiration-not-voicing).
// Referees: wikipron chr_cher_broad + kaikki.
describe("Cherokee (ᏣᎳᎩ) canonical IPA", () => {
    test("core words", () => {
        expect(phonemizeWord("ᏣᎳᎩ")).toBe("t͡salaki"); // 'Cherokee' — Ꮳtsa Ꮃla Ꭹgi; ⟨ts⟩=[t͡s], g-series=[k]
        expect(phonemizeWord("ᎠᎹ")).toBe("ama"); // 'water'
        expect(phonemizeWord("ᎠᏍᎦᏯ")).toBe("askaja"); // 'man' — bare Ꮝ=/s/, Ꭶga=[k], Ꮿya=[j]
        expect(phonemizeWord("ᎦᏬᏂᎯᏍᏗ")).toBe("kawonihisti"); // 'speech' — Ꮧdi=[t] (unaspirated)
        expect(phonemizeWord("ᎤᏔᎾ")).toBe("utʰana"); // 'big' — Ꮤta = the ASPIRATED split-cell [tʰ]
    });

    test("the 6th vowel ⟨v⟩ → [ə̃] (nasal mid-central) + MV", () => {
        expect(phonemizeWord("ᎬᎾ")).toBe("kə̃na"); // 'turkey' — Ꭼgv = k + ⟨v⟩[ə̃]
        expect(phonemizeWord("Ᏽ")).toBe("mə̃"); // CHEROKEE LETTER MV (U+13F5, added post-grammar)
    });

    test("aspiration split-cells + labialised velar + lateral affricate", () => {
        expect(phonemizeWord("Ꭷ")).toBe("kʰa"); // Ꭷ = /kha/ [kʰa] (vs Ꭶ ga = [ka])
        expect(phonemizeWord("Ꮖ")).toBe("kʷa"); // ⟨qua⟩ = labialised velar [kʷ]
        expect(phonemizeWord("Ꮬ")).toBe("t͡ɬa"); // ⟨dla⟩ = lateral affricate [t͡ɬ]
        expect(phonemizeWord("Ꮝ")).toBe("s"); // the bare Ꮝ = /s/ (the only non-CV character)
    });

    test("Cherokee Supplement lowercase folds onto the main block", () => {
        expect(phonemizeWord("ꭰꮉ")).toBe("ama"); // U+AB70.. → U+13A0.. via toUpperCase
    });

    test("registry wiring", () => {
        expect(getPhonemizer("chr").text("ᏣᎳᎩ").trim()).toBe("t͡salaki");
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers, in the SYLLABARY (the engine reads no other script). DECIMAL; the tens CLIP before a
// unit (ᏔᎵᏍᎪᎯ 20 → ᏔᎵᏍᎪ ᏌᏊ 21) and the hundreds suffix ᏥᏆ to the TENS word. Every form 1–100 below is
// copied from the Cherokee Nation Language Department poster "Numbers 1 – 100 written in the Cherokee
// syllabary" (language.cherokee.org/posters/syllabary-and-numbers/) and cross-checked against
// Montgomery-Anderson pp. 517–519 (ex. 52–55, after Pulte & Feeling 1975:228–229). 200–1000 come from
// Wiktionary/Omniglot; ≥ 10⁶ is a deliberate digit-by-digit fallback. See numbers.ts for the disclosures.
describe("Cherokee numbers", () => {
    for (const [n, expected] of [
        [0, "ᏃᏘ"],                      // ⟨noti⟩, a borrowing from English "nought" (Wiktionary)
        [1, "ᏌᏊ"],
        [7, "ᎦᎵᏉᎩ"],
        [8, "ᏣᏁᎳ"],                     // ⟨chaneela⟩ per the poster + the grammar (not ᏧᏁᎳ)
        [10, "ᏍᎪᎯ"],
        [11, "ᏌᏚ"],                     // the suppletive teens, not derivable from the units
        [15, "ᏍᎩᎦᏚ"],
        [19, "ᏐᏁᎳᏚ"],
        [20, "ᏔᎵᏍᎪᎯ"],
        [21, "ᏔᎵᏍᎪ ᏌᏊ"],                // the CLIPPED tens word: ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ
        [42, "ᏅᎩᏍᎪ ᏔᎵ"],
        [99, "ᏐᏁᎳᏍᎪ ᏐᏁᎳ"],
        [100, "ᏍᎪᎯᏥᏆ"],                 // ⟨skohitskwa⟩ = ᏍᎪᎯ + ᏥᏆ
        [101, "ᏍᎪᎯᏥᏆ ᏌᏊ"],
        [200, "ᏔᎵᏍᎪᎯᏥᏆ"],               // the hundred word is the TENS word for N×10 + ᏥᏆ
        [555, "ᎯᏍᎩᏍᎪᎯᏥᏆ ᎯᏍᎩᏍᎪ ᎯᏍᎩ"],
        [999, "ᏐᏁᎳᏍᎪᎯᏥᏆ ᏐᏁᎳᏍᎪ ᏐᏁᎳ"],
        [1000, "ᎢᏯᎦᏴᎵ"],                // bare ⟨iyagayvli⟩
        [1001, "ᎢᏯᎦᏴᎵ ᏌᏊ"],
        [12345, "ᏔᎵᏚ ᎢᏯᎦᏴᎵ ᏦᏍᎪᎯᏥᏆ ᏅᎩᏍᎪ ᎯᏍᎩ"], // the thousands count is the teen ᏔᎵᏚ '12'
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no gaps or sentinels across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // No modern million word is trusted (the 1828 Cherokee Phoenix has ᎠᎦᏴᎵᏯ but calls it "not universally
    // known"), so 10⁶ and above read digit-by-digit — deliberately, not as a bug.
    test("above the attested range → digit-by-digit", () => {
        expect(numberToWords(1000000)).toBe("ᏌᏊ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ");
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "chr")).toBe("tʰalisko sakʷu");
        expect(phonemize("100", "chr")).toBe("skohit͡sikʷa");
    });
});

// ---------------------------------------------------------------------------------------------------------
// TEXT NORMALIZATION. Every assertion below encodes a finding measured over the retained text of
// `tools/corpus/mined/chr.jsonc` (315 segments of a 734-paragraph chr.wikipedia dump — the smallest corpus
// in the fleet). ⚠ ROUGHLY HALF OF THESE PIN A REFUSAL, which for this language is the substance of the
// round: chr.wikipedia attests no percent word, no currency name, no unit word and no exponent word, so the
// layer declares NO shared symbol tier and every rule it does ship spends a SEPARATOR rather than emitting a
// word. See src/languages/cherokee/normalize.ts for the counts and tools/normalization/defects.ts
// (ACCEPTED_SIGN_SILENCE.chr) for the twelve class refusals.
describe("Cherokee text normalization", () => {
    // THE GROUPING COMMA — the round's largest defect and the only one that produced a WRONG NUMBER rather
    // than a missing word. Every `\d,\d{3}` in the corpus (50 match positions) is a thousands group; the
    // tokenizer read the comma as CLAUSE PUNCTUATION and each group as its own numeral, so `17,000` was
    // *kalikʷatu , notʰi* — "seventeen, ZERO", a silent 1000× error (trap 56's extreme case).
    test("the grouping comma is spent, not read as a clause break", () => {
        expect(normalizeCherokee("ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ")).toBe("ᎬᏩᏚᏫᏛ 17000 ᏣᎳᎩ");
        // …and the whole reading: ᎢᏯᎦᏴᎵ (thousand) is now present and the false pause is gone.
        expect(phonemize("ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ", "chr")).toBe("kə̃watuwitə̃ kalikʷatu ijakajə̃li t͡salaki");
        expect(phonemize("ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ", "chr")).not.toContain(" , ");
    });

    // ⚠ TRAP 63 IS LIVE IN THIS CORPUS, not prophylactic: `1,028,737,436` (India's population) is a FOUR-group
    // figure, and the fleet's old one-join-per-pass idiom resumes its scan inside the remainder and produces
    // a DIFFERENT NUMBER. Matching the whole number in one go is what makes this right.
    // ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58) — both of the corpus's largest
    // figures are clause-final, so a `(?![\d.,])` guard would decline exactly the cases the rule exists for.
    test("four groups at once, and a clause-final figure is still claimed", () => {
        expect(normalizeCherokee("ᎾᏂᎥ ᏴᏫ 1,028,737,436.")).toBe("ᎾᏂᎥ ᏴᏫ 1028737436.");
        expect(normalizeCherokee("ᎾᏂᎥ ᏴᏫ 33,625,989.")).toBe("ᎾᏂᎥ ᏴᏫ 33625989.");
        // ≥ 10⁶ is numbers.ts's deliberate digit-by-digit fallback (no trusted million word), and the
        // trailing sentence period survives as a pause.
        expect(phonemize("ᎾᏂᎥ ᏴᏫ 1,028,737,436.", "chr"))
            .toBe("naniə̃ jə̃wi sakʷu notʰi tʰali t͡sanela kalikʷoki t͡soi kalikʷoki nə̃ki t͡soi sutali .");
    });

    // REFUSAL. The DATE comma is declined by the same three-digit test and needs no separate rule: the
    // corpus writes `ᏀᎾ ᎦᎶᏂ 28, 1838,` ×8, which is `\d{1,2}, \d{4}` — a space after the comma and four
    // digits after that, so neither `,\d{3}` nor the no-digit-follows guard can be satisfied.
    test("REFUSED: the date comma stays a clause break", () => {
        expect(normalizeCherokee("ᏀᎾ ᎦᎶᏂ 28, 1838, ᎠᎴ")).toBe("ᏀᎾ ᎦᎶᏂ 28, 1838, ᎠᎴ");
        expect(phonemize("ᏀᎾ ᎦᎶᏂ 28, 1838, ᎠᎴ", "chr"))
            .toBe("nana kaloni tʰalisko t͡sanela , ijakajə̃li nelaskohit͡sikʷa t͡sosko t͡sanela , ale");
    });

    // THE DECIMAL DOT. `\d.\d` is ×6 in the corpus and all six are decimals — there is no date, IP address
    // or version string with an interior dot anywhere. The dot was reaching `[.?!,;:…]` as a FULL STOP, so
    // the synodic month `29.53` read *tʰalisko sonela . hiskisko t͡soi*: a sentence boundary inside a
    // quantity. ⚠ NO DECIMAL WORD IS SOURCEABLE, so the mark is neutralised rather than spoken.
    test("the decimal dot is neutralised, not read as a full stop", () => {
        expect(normalizeCherokee("ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29.53 ᎯᎸᏍᎩ")).toBe("ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29 53 ᎯᎸᏍᎩ");
        expect(phonemize("ᎢᎦᏘᎭ ᎢᎬᏁᎸ 29.53 ᎯᎸᏍᎩ", "chr"))
            .toBe("ikatʰiha ikə̃nelə̃ tʰalisko sonela hiskisko t͡soi hilə̃ski");
    });

    // REFUSAL. The rule requires a DIGIT on the left, so the abbreviating dot and the sentence period are
    // both untouched — `pt.1` in the Smithsonian citation, and a clause-final year.
    test("REFUSED: the abbreviating dot and the sentence period", () => {
        expect(normalizeCherokee("(1897/98: pt.1)")).toBe("(1897/98: pt.1)");
        expect(normalizeCherokee("ᎢᎬᏁᎸ 1907. ᎯᎠ")).toBe("ᎢᎬᏁᎸ 1907. ᎯᎠ");
        expect(phonemize("ᎢᎬᏁᎸ 1907. ᎯᎠ", "chr")).toContain(" . ");
    });

    // THE SPAN DASH. Digit-flanked `–` (×16) and `—` (×4) are the birth–death parenthetical of a biography
    // or a percent span, without exception. The mark was DROPPED outright, so two years ran together with no
    // pause. ⚠ SPENT ON A PAUSE, NOT A CONNECTIVE: this corpus writes its spans out in full where it means
    // them (`ᎠᏰᎵ 1760 ᎠᎴ 1776`), so imposing a joiner would double a word the writer already chose or not.
    test("the en- and em-dash span become a pause", () => {
        expect(normalizeCherokee("ᏆᏟᎩ ᎯᎳᏫ (1923–2008)")).toBe("ᏆᏟᎩ ᎯᎳᏫ (1923, 2008)");
        expect(normalizeCherokee("Ned Christie (1852—1892)")).toBe("Ned Christie (1852, 1892)");
        expect(normalizeCherokee("ᏃᏱ ᎠᎾᏅᏯ 20–25%,")).toBe("ᏃᏱ ᎠᎾᏅᏯ 20, 25%,");
        expect(phonemize("ᏆᏟᎩ ᎯᎳᏫ (1923–2008)", "chr"))
            .toBe("kʷat͡ɬiki hilawi ijakajə̃li sonelaskohit͡sikʷa tʰalisko t͡soi , tʰali ijakajə̃li t͡sanela");
    });

    // …and the SPACED dash between words, the same mark doing the same job outside a number. It vanished
    // too: the species glosses (`ᏒᎩ — Allium canadense`) and the parenthetical `"ᏣᎳᎩ" (ᏣᎳᎩ) – ᎪᎯ ᎾᎯᏳᎢ`.
    // A dash with a space on BOTH sides is never a word-internal joiner in any of the three scripts this
    // text mixes, which is exactly what the bare hyphen below cannot promise.
    test("a spaced dash between words is a pause too", () => {
        expect(normalizeCherokee("ᎢᎾᎨ ᎡᎯ ᏒᎩ — ᎠᎹ")).toBe("ᎢᎾᎨ ᎡᎯ ᏒᎩ, ᎠᎹ");
        expect(phonemize("ᎢᎾᎨ ᎡᎯ ᏒᎩ — ᎠᎹ", "chr")).toBe("inake ehi sə̃ki , ama");
    });

    // THE UNEXPANDED HTML ENTITY, ×2. `&ndash;` survives in this wiki's text and is SILENT today: `ndash`
    // is a Latin run, the English fallback returns nothing for it, and the two years fuse. Folded first so
    // the span rule above can claim it. Markup residue, not a Cherokee orthographic fact.
    test("&ndash; is folded so the span rule can read it", () => {
        expect(normalizeCherokee("ᎦᎴᏦᏫᎠᎩ (1914&ndash;1972)")).toBe("ᎦᎴᏦᏫᎠᎩ (1914, 1972)");
        expect(phonemize("ᎦᎴᏦᏫᎠᎩ (1914&ndash;1972)", "chr")).toContain(" , ");
    });

    // ⚠ THE BIG REFUSAL: THE ASCII HYPHEN IS A CHEROKEE WORD-JOINER AND MUST STAY UNTOUCHED, ×101 against
    // three genuine spans. Reading it as a range or a minus would be wrong in the overwhelming majority, and
    // `ᏦᏍᎪᎯ-ᏐᏁᎳ (39)` is the round's best single piece of evidence — the writer spells thirty-nine as a
    // hyphen-joined compound and then repeats it in digits in the same clause, i.e. a Cherokee reader
    // telling us the hyphen is INSIDE a word. This is why the span rule's class is `[–—]` and not `[-–—]`.
    test("REFUSED: every sense of the ASCII hyphen stays exactly as written", () => {
        for (const s of [
            "ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ", // the -Ꭿ locative enclitic, the commonest sense
            "ᎡᎶᎯ-Ꮒ", // the -Ꮒ enclitic
            "ᏦᏍᎪᎯ-ᏐᏁᎳ (39)", // a COMPOUND NUMERAL, glossed by its own digits in the same clause
            "ᎦᎸᎳᏗᏢ-ᎦᏙᎯ", // an ordinary Cherokee compound
            "ISBN 0-7167-2438-3.", // ×9 hyphens over 3 citations — a range rule would add 3 false pauses
            "ᎹᏱᎩᎵ I ᎳᏂᎦᏇ (????-844)", // the scan's `DROP minus ×1`: an unknown birth year, not a negative
            "ᎫᎴ ᏧᏓᎴᎾᎯ ᏂᏛᎴᏅᏓ 1-6 cm", // a REAL span, and it stays silent — the ratio is the argument
        ]) expect(normalizeCherokee(s), s).toBe(s);
        // the enclitic still reads as two tokens, unchanged from before this layer existed
        expect(phonemize("ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ", "chr")).toBe("t͡sujə̃t͡ɬə̃ amajeli hi");
    });

    // ⚠ REFUSALS THAT WOULD HAVE NEEDED A WORD, AND THE WORD IS NOT THERE. Each is registered with its count
    // and its argument in ACCEPTED_SIGN_SILENCE.chr. `%` ×6 (no candidate: ᏍᎪᎯᏥᏆ "100" is ×1/1 article and
    // its example is a count of people); `¥` ×1 (trap 12 — `ᎠᏕᎳ` "money" is already written TWICE beside
    // the sign); `&` ×3 (never a Cherokee conjunction — two are the entity above and the third is an
    // English brand name); `½` ×2 and the foot/inch marks (no word, and `"` is also the quotation mark
    // ×103, so a rule keyed on it would claim a hundred quotes to read seven measurements).
    test("REFUSED: the sign classes with no sourceable word are left as written", () => {
        for (const s of [
            "ᏂᎪᎯᎸ ᎤᏁᏍᏓᎳ 98% ᎦᏙᎯ", // percent
            "ᎠᏕᎳ ᏣᏆᏂ ᎠᏕᎳ (¥)", // currency, redundant with the writer's own word
            "Ben & Jerry's ᎤᏛᏁᎢ ᎤᎦᎾᏍᏗ", // ampersand, inside an English trade name
            "3-3 ½ ᎢᏯᎳᏏᏗ ᎢᎦᏘ", // no half word is attested
            "ᎢᏳᏓᎵᎭ 135' ᎢᏂ ᎢᏗᎦᏘ.", // feet
        ]) expect(normalizeCherokee(s), s).toBe(s);
        // the yen's reading is ALREADY correct — "their money, Japan money" — which is what makes the drop
        // permissible rather than merely harmless (trap 12).
        expect(phonemize("ᎠᏕᎳ ᏣᏆᏂ ᎠᏕᎳ (¥)", "chr")).toBe("atela t͡sakʷani atela");
    });

    // …and the exponent, ×5, all `km²`. The square word `ᏅᎩ ᏧᏅᏏᏯ` is the SHAPE word (trap 37): 3 of its 5
    // wiki hits are the rectangle, the triangle and a woven pattern, and the two measure-slot hits are the
    // same clause of the same article. ⚠ THE REFUSAL IS WHOLE, NOT HALF (trap 53) — no unit key is declared
    // either, so `km²` reads exactly as it did before rather than becoming "kilometres two", while the
    // FIGURE beside it is still de-grouped because that rule needs no vocabulary.
    test("REFUSED: km² passes through while its figure is still de-grouped", () => {
        expect(normalizeCherokee("ᏂᎬᎢ 243,610 km².")).toBe("ᏂᎬᎢ 243610 km².");
        expect(phonemize("ᏂᎬᎢ 243,610 km².", "chr"))
            .toBe("nikə̃i tʰaliskohit͡sikʷa nə̃kisko t͡soi ijakajə̃li sutaliskohit͡sikʷa skohi kʰˈʌm skwˈɛɹd ."); // `km` through the English n-gram: *kʰˈʌm* since #1260 (was *ˈʊkm*) — a leak either way, which is the point
    });

    // REFUSAL. THE COLON IS NEVER A CLOCK HERE, ×31 and zero `\d:\d` — it introduces a list or a quotation
    // in Cherokee prose, separates city from publisher in an English citation, or marks a parallel title
    // (`(ᏣᎳᎩ: Tatiyana Bulanowa; ᏲᏂᎢ: Татьяна…)`). cherokee.ts already maps it to a `,` pause, which is
    // right for all thirty-one, so no clock rule is written and this pins that.
    test("REFUSED: no clock rule — the colon stays a clause pause", () => {
        expect(normalizeCherokee("ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ")).toBe("ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ");
        expect(phonemize("ᏄᏍᏛ ᏗᎧᏃᏗ: ᎢᏅ ᎢᎦᏘ", "chr")).toBe("nustə̃ tikʰanoti , inə̃ ikatʰi");
    });

    // A rule that fires must not disturb ordinary prose. `= < > × ÷ ± +` are ×0 across the whole corpus, so
    // there is no arithmetic rule that could misfire; what remains is that plain syllabary text and the
    // unattested signs alike come back byte-identical.
    test("ordinary Cherokee prose is untouched", () => {
        const plain = "ᎯᎠ ᏣᎳᎩ ᎠᏰᎵ ᎤᏙᏢᏒ ᎣᎦᎳᎰᎻ ᏙᎢ ᎠᏰᎵ ᎤᏒᎧᎵ ᎬᏔᏂᏓᏍᏗ.";
        expect(normalizeCherokee(plain)).toBe(plain);
        expect(normalizeCherokee("x = y · 5 < 6 · 6 × 6 · ±5 · +5")).toBe("x = y · 5 < 6 · 6 × 6 · ±5 · +5");
    });
});
