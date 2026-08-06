/**
 * Igbo text normalization — the symbols a reader voices.
 *
 * ⚠ IGBO HAS NO INDEPENDENT REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so
 * every expectation here rests on corpus counts from a 558,991-line ig.wikipedia dump, recorded beside each rule in
 * normalize.ts. The language's documented non-corpus tier is the hand-adjudicated gold in igbo.test.ts
 * (Emenanjo 1978; Green & Igwe 1963).
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeIgbo } from "../src/languages/igbo/normalize.ts";

describe("igbo normalization", () => {
    test("⚠ the grouping comma is de-grouped — it used to split the number in two", () => {
        // `1,500` read *otu , naɾɪ ise* — "one, five hundred", with a clause pause inside the number. Igbo groups
        // with a COMMA (16,847 lines) and points decimals with a PERIOD (16,658), the Nigerian convention.
        expect(normalizeIgbo("1,500")).toBe("1500");
        expect(normalizeIgbo("1,234,567")).toBe("1234567");
        expect(String(phonemize("1,500", "ig"))).toBe("otu puku na naɾɪ ise");
    });

    test("⚠ the percent WORD precedes the number even though the SIGN follows it", () => {
        // The one thing assuming English order would get wrong. Written: `60%`, sign after (1,018 occurrences).
        // Spoken: `pasent 60`, word first — 1,161 occurrences against 87 the other way, and those 87 are comma
        // boundaries (`2004, pasent`). Same shape as Turkish `yüzde 40`.
        expect(String(phonemize("60%", "ig"))).toBe("pasent iɾi isii");
        expect(String(phonemize("8.3%", "ig"))).toBe("pasent asatɔ atɔ");
    });

    test("currency: ₦ and $, word after the number", () => {
        // ₦ 30 sign hits / naira 280 · $ 898 / dollar 641. The corpus writes `nde naira`, `narị ise puku dollar`,
        // so the word follows — the tier's default. £/€ are deliberately absent: the signs occur (147, 49) but
        // `pound` (45) is ambiguous with the weight unit and `euro` (19) is too thin.
        expect(String(phonemize("₦500", "ig"))).toContain("naiɾa");
        expect(String(phonemize("$20", "ig"))).toContain("dollaɾ");
    });

    test("⚠ a digit-flanked dash is a RANGE, never a minus", () => {
        // 4,993 digit-flanked dashes in a 26 MB sample: 1,734 year-year, 1,741 small-small. A minus rule would read
        // every date range as arithmetic — the defect nl, mr, ta and yue all record. `ruo` ("to") is the range word,
        // 1,687 digit-flanked instances (`peeji 20 ruo 80`, `Site na 1958 ruo 1966`).
        expect(normalizeIgbo("1967-1970")).toBe("1967 ruo 1970");
        expect(normalizeIgbo("1,200-2,000")).toBe("1200 ruo 2000");
    });

    test("the ampersand is `na`, the ordinary connective", () => {
        expect(String(phonemize("A & B", "ig"))).toBe("a na b");
    });

    test("⚠ the decimal fraction is read DIGIT BY DIGIT, and the period must not survive", () => {
        // No word exists to voice it. Igbo borrows its symbol vocabulary freely (pasent, dollar, naira) but does NOT
        // borrow "point": zero digit-point-digit instances, and the 89 whole-word `point` hits are all English text
        // inside the Igbo wiki. `ntụpọ` (552) is a SPOT/blemish; `akara` (16,476) is a mark or score — the corpus
        // writes `akara 2.3 na 2.7` with a bare period and no separator word. `ǹtụkpọ` and every variant: 0.
        //
        // Leaving the period alone is NOT neutral — TOKEN treats `.` as clause punctuation, so `2.5` read
        // *abʊɔ . ise*, a sentence break inside a number. Digit-by-digit is what sources.ts prescribes for a
        // "[NONE] decimal-point" language.
        expect(normalizeIgbo("2.5")).toBe("2 5");
        expect(normalizeIgbo("3.14159")).toBe("3 1 4 1 5 9");
        expect(String(phonemize("3.14159", "ig"))).toBe("atɔ otu anɔ otu ise itoolu");
    });

    test("a sentence-final period is untouched", () => {
        // The decimal rule requires a digit on BOTH sides, so ordinary prose keeps its clause boundaries.
        expect(normalizeIgbo("Afọ 2020. Ọ dị mma.")).toBe("Afọ 2020. Ọ dị mma.");
    });
});
