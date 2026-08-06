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
});
