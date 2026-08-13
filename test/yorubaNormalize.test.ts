import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeYoruba } from "../src/languages/yoruba/normalize.ts";

describe("yoruba text normalization", () => {
    test("⚠ the percent is a CIRCUMFIX — a word before the number and a phrase after", () => {
        // `ìdá 84 nínú ọgọ́rùn-ún`, "portion 84 in a hundred". Two constructions are attested and their totals
        // nearly tie (`ọgọ́rùn-ún lọ́nà X` 115 : `ìdá X nínú ọgọ́rùn-ún` 94); what settles it is the form used
        // when the number is a DIGIT, which is what this layer produces — 21 instances against 0.
        expect(normalizeYoruba("60%")).toBe("ìdá 60 nínú ọgọ́rùn-ún");
        expect(String(phonemize("60%", "yo"))).toBe("i˩da˥ ɔ˧ɡɔ˥ta˧ ni˥nu˥ ɔ˧ɡɔ˥ɾũ˩ ũ˥");
    });

    test("⚠ a sign the sentence already spells out is DROPPED, not read twice", () => {
        // The corpus glosses itself — `ìpín ọgọ́ta nínú ọgọ́rùn-ún (60%)` — so a layer without this guard says
        // the circumfix twice. ⚠ The guard is matched on a TONE-FOLDED copy: its first version used a character
        // class `[ọ́o]` to make the accent optional, and no class can hold `ọ́`, which is two codepoints with no
        // precomposed form. It silently never matched.
        expect(normalizeYoruba("ìpín ọgọ́ta nínú ọgọ́rùn-ún (60%)").trim()).toBe("ìpín ọgọ́ta nínú ọgọ́rùn-ún");
        // Untoned spelling too — half this corpus omits tone, so the guard must not depend on it.
        expect(normalizeYoruba("ipin ogota ninu ogorun-un (60%)").trim()).toBe("ipin ogota ninu ogorun-un");
    });

    test("⚠ a digit-flanked dash is a RANGE (`sí`), never a minus", () => {
        // 1,427 digit-flanked `sí`, and the corpus glosses the reading twice: `ọgọ́rùn-ún méjì sí mẹ́fà
        // (200-600 kg)` and `góòlù mẹ́rin sí òdo (4–0)`. A minus rule would read every date range as arithmetic.
        expect(normalizeYoruba("1967-1970")).toBe("1967 sí 1970");
        expect(normalizeYoruba("200-600")).toBe("200 sí 600");
        expect(normalizeYoruba("1990–2000")).toBe("1990 sí 2000");   // en dash too (4,159 digit-flanked)
    });

    test("grouping commas are removed before they become a clause pause", () => {
        // 1,829 lines carry a comma-grouped number against 86 period-grouped. Left in place, `2,500` read
        // *méjì , ẹgbẹ̀rún márùn-ún* — one number spoken as two with a pause between them.
        expect(normalizeYoruba("2,500")).toBe("2500");
        expect(normalizeYoruba("1,234,567")).toBe("1234567");
        expect(String(phonemize("2,500", "yo"))).not.toContain(",");
    });

    test("⚠ the decimal separator is `àti dásímà`, and the fraction is read digit by digit", () => {
        // All 18 corpus instances share one frame: `bílíọ̀nù mẹ́rin àti dásímà ọ̀kan mẹ́rin` (4.14 billion),
        // `mílíọ̀nù mẹ́sàn-án àti dásímà ẹjọ ẹjọ` (9.88). `dásímà` is a borrowing of "decimal" and I found it by
        // accident — every native candidate probed (ààmì, àmì, ẹ̀là, pọ́ìntì, ojú) is 0 between digits, and on
        // that evidence this layer was about to declare the separator unreadable.
        expect(normalizeYoruba("3.5")).toBe("3 àti dásímà 5");
        expect(normalizeYoruba("4.14")).toBe("4 àti dásímà 1 4");
        // ⚠ And leaving the period alone is NOT neutral: yoruba.ts treats `.` as clause punctuation, so `3.5`
        // read *mɛ˥ta˧ . ma˥ɾũ˩ũ˥* — a sentence break inside a number.
        // márùn-ún carries its internal boundary here, the same as when a writer types the word — see the
        // digit-vs-text agreement test in yorubaNumbers.test.ts.
        expect(String(phonemize("3.5", "yo"))).toBe("mɛ˥ta˧ a˩ti˧ da˥si˥ma˩ ma˥ɾũ˩ ũ˥");
    });

    test("⚠ rule ORDER: the percent circumfix must see a decimal number whole", () => {
        // Run the decimal rule first and `8.3%` splits into two numbers, with the circumfix wrapping one half.
        expect(normalizeYoruba("8.3%")).toBe("ìdá 8 àti dásímà 3 nínú ọgọ́rùn-ún");
    });

    test("currency: the word FOLLOWS the number", () => {
        // ₦ leads a number 85 times, $ 710; `náírà` 71 whole-word hits and `dọ́là` 78, both postposed 4:1 and
        // 3:1 (`ẹgbàáta náírà (N30,000.00)`). £ (141) and € (95) occur but their words do not — 0 and 2 hits.
        expect(normalizeYoruba("₦500")).toBe("500 náírà");
        expect(normalizeYoruba("$20")).toBe("20 dọ́là");
    });

    test("⚠ temperature is a CIRCUMFIX, and this class was wrongly refused first", () => {
        // Refused on `dígírí` 0 and `sẹ́lísíọ̀sì` 0 — two Yorubized spellings that do not exist — while the corpus
        // borrows the scale names unchanged (Celsius 9, Fahrenheit 5) and says `ìwọ̀n` (1,198) for the degree:
        // `ìwọ̀n 3.4 Celsius`, `ìwọ̀n 36 sí 50 Fahrenheit`. °C is 211 occurrences, °F 144, all read as bare
        // numbers until now. Third time in this language that a guessed candidate list's zeros measured the list.
        expect(normalizeYoruba("38°C")).toBe("ìwọ̀n 38 Celsius");
        expect(normalizeYoruba("2 °C")).toBe("ìwọ̀n 2 Celsius");
        // ⚠ BEFORE the decimal rule, or the scale attaches to the fraction digit.
        expect(normalizeYoruba("79.63 °F")).toBe("ìwọ̀n 79 àti dásímà 6 3 Fahrenheit");
        expect(normalizeYoruba("38°C (100.4°F)")).toBe("ìwọ̀n 38 Celsius (ìwọ̀n 100 àti dásímà 4 Fahrenheit)");
        // A BARE ° stays unread: 128 occurrences, 55 of them geographic coordinates.
        expect(normalizeYoruba("7°30′S 3°21′E")).toBe("7°30′S 3°21′E");
    });

    test("⚠ × is `lọ́nà`, the same particle the compositor multiplies with", () => {
        // Refusing × as wordless while numbers.ts read `ẹgbẹ̀rún lọ́nà ogún` as 1000×20 was not defensible.
        expect(normalizeYoruba("4 × 100 mítà")).toBe("4 lọ́nà 100 mítà");
        expect(normalizeYoruba("1920 × 1080")).toBe("1920 lọ́nà 1080");
        expect(normalizeYoruba("8×8")).toBe("8 lọ́nà 8");
    });

    test("a squared unit reads even when a magnitude word separates it from the number", () => {
        // The tier needs the number against the unit, so `9.83 million km²` kept its sign silent while
        // `250 km²` did not — and the magnitude form is how the corpus writes large areas.
        expect(normalizeYoruba("250 km²")).toBe("250 kìlómítà onígun mẹ́rin");
        expect(normalizeYoruba("9.83 million km²")).toBe("9 àti dásímà 8 3 million kìlómítà onígun mẹ́rin");
        expect(normalizeYoruba("12.76 km")).toBe("12 àti dásímà 7 6 kìlómítà");     // bare unit still expands
    });

    test("⚠ a speed reads, and its frame is glossed 36 times", () => {
        // `iyara ti kilomita ọgọrin ni wakati okan (80km/w)` — the corpus writes the reading beside the figure,
        // repeatedly. `w` is the Yoruba abbreviation (wákàtí, hour); the borrowed `km/h` occurs too.
        expect(normalizeYoruba("80km/w")).toBe("80 kìlómítà ni wákàtí kan");
        expect(normalizeYoruba("126km/h")).toBe("126 kìlómítà ni wákàtí kan");
        // ⚠ A one-letter denominator must not match standalone — the tier's `Il-76s` → "seconds" lesson.
        expect(normalizeYoruba("Il-76s")).toBe("Il-76s");
    });

    test("the ampersand is `àti`, the ordinary connective", () => {
        expect(normalizeYoruba("A & B")).toBe("A àti B");
    });

    test("dropping a redundant gloss leaves no doubled space", () => {
        // The `(60%)` sits between two spaces, so removing it used to leave `ọgọ́rùn-ún  jẹ́` in the token stream.
        expect(normalizeYoruba("ìdá 60 nínú ọgọ́rùn-ún (60%) jẹ́ púpọ̀")).toBe("ìdá 60 nínú ọgọ́rùn-ún jẹ́ púpọ̀");
    });

    test("a sentence-final period survives", () => {
        // The decimal rule requires a digit on BOTH sides, so ordinary prose keeps its clause boundaries.
        expect(normalizeYoruba("Ọdún 2020. Ó dára.")).toBe("Ọdún 2020. Ó dára.");
    });

    test("⚠ no digit escapes to English through this layer", () => {
        // The whole point: every reading above is worthless if the number beside it is still English.
        for (const s of ["1945", "60%", "₦500", "3.5", "1967-1970", "2,500"])
            expect(String(phonemize(s, "yo")), s).not.toMatch(/θ|ʌ|ɹ|æ/u);
    });

    test("units — ⟨mm⟩ and ⟨l⟩ join km/ha/mi, and the one-letter ⟨l⟩ is safe under the tier's own guard", () => {
        expect(normalizeYoruba("10 mm")).toBe("10 mílímítà");
        expect(normalizeYoruba("10 l")).toBe("10 lítà");
        expect(normalizeYoruba("10 L")).toBe("10 lítà");
        // ⚠ TRAP 46, MEASURED AND DECLINED BY THE EXISTING GUARD. Every one of the artifact's 13 `digit + l`
        // shapes is Yoruba's proclitic `l-` glued to the next word, and a following letter rejects them all.
        expect(normalizeYoruba("ọdún 1975 lẹ́yìn")).toBe("ọdún 1975 lẹ́yìn");
        expect(normalizeYoruba("30,000 lábẹ́")).toBe("30000 lábẹ́");
    });

    // ⚠ THE ONE PLACE THIS LANGUAGE PARTS COMPANY WITH THE FLEET-WIDE IMPERIAL REFUSAL. ak/sn/mos/jv all
    // leave `ft` reported inside a metric gloss because they have no foot word; Yoruba has one, and this
    // corpus's own sentence is the gloss — `tí ọkọọkan tó 150 ẹsẹ̀ (ft) ní gíga`. `ẹsẹ̀ bàtà` is 19 tokens
    // / 15 articles on yo.wikipedia and every read example is the imperial foot in a metric parenthetical.
    test("⚠ the imperial FOOT is read here, because the corpus glosses the abbreviation with the word", () => {
        expect(normalizeYoruba("2419 m (7936 ft)")).toBe("2419 mítà (7936 ẹsẹ̀ bàtà)");
        expect(normalizeYoruba("(75 ft)")).toBe("(75 ẹsẹ̀ bàtà)");
        // ⚠ THE COMPOUND, NEVER BARE `ẹsẹ̀` — that word is a foot/leg and a verse-line, the same wrong-sense
        // argument that keeps it out of the decimal-point slot in this file's header.
        expect(normalizeYoruba("(75 ft)")).toContain("bàtà");
    });

    // `sq` stands BETWEEN the number and the unit, so it costs TWO readings and not one: the tier's
    // digit-adjacent unit path declines as well, and `705.78sq km` leaked its `km` raw AND lost the area.
    test("⚠ the English measure word `sq` is spent before a DECLARED unit only", () => {
        expect(normalizeYoruba("705.78sq km")).toBe("705 àti dásímà 7 8 kìlómítà onígun mẹ́rin"); // glued, as written
        expect(normalizeYoruba("500 sq mi")).toBe("500 máìlì onígun mẹ́rin");
        // An undeclared unit keeps its `sq` rather than half the phrase being spoken.
        expect(normalizeYoruba("430 sq yd")).toBe("430 sq yd");
    });

    test("⚠ the bare METRE is read here, not in the tier — and `9h 50m` is declined", () => {
        // `mítà` is definitional on yo.wikipedia ("Mítà je eyo tìpìlẹ̀ ìwọ̀n ìgùn ninu Sistemu Kakiriaye").
        expect(normalizeYoruba("2419 m")).toBe("2419 mítà");
        expect(normalizeYoruba("10 m")).toBe("10 mítà");
        // The decimal rule still runs last, so the operand reaches it intact and the metre survives it.
        expect(normalizeYoruba("8.62 m")).toBe("8 àti dásímà 6 2 mítà");
        // ⚠ THE TWO COUNTER-EXAMPLES THE LOCAL RULE EXISTS TO DECLINE: `Nh Nm Ns` is a DURATION, and its
        // `m` is minutes. Reading it as fifty metres would be worse than the raw letter.
        expect(normalizeYoruba("9h 50m 30.0s")).toContain("50m");
        // And the tier still gets first refusal on every shape it can read.
        expect(normalizeYoruba("126km/h")).toBe("126 kìlómítà ni wákàtí kan");
    });
});
