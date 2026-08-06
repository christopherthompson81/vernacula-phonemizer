import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { yorubaCardinal } from "../src/languages/yoruba/numbers.ts";

/**
 * The gold set is the CORPUS'S OWN GLOSSES: yo.wikipedia writes a numeral out and repeats it in figures, so
 * every pair below was written by a Yoruba writer rather than derived by me. That is the only thing that can
 * adjudicate a vigesimal-subtractive composition — the referees this language has (wikipron yor, kaikki yor)
 * are word→IPA and can check how a numeral is PRONOUNCED, never whether it is the right numeral.
 */
describe("yoruba cardinals — the corpus's own numeral↔digit glosses", () => {
    test("units and the -lá teens", () => {
        // ⚠ `2` pinned here because it once read *méjìlá* (12): the teens arm was bounded above (n < 15) and not
        // below, so every unit fell into it.
        expect(yorubaCardinal(2)).toBe("méjì");
        expect(yorubaCardinal(12)).toBe("méjìlá");     // glossed (12) ×2
        expect(yorubaCardinal(13)).toBe("mẹ́tàlá");    // glossed (13) ×12
        expect(yorubaCardinal(14)).toBe("mẹ́rìnlá");
    });

    test("⚠ 1-4 past a ten ADD, 5-9 SUBTRACT from the ten above", () => {
        // The property that makes this system unlike a decimal one: 24 is four-exceeding-twenty and 26 is
        // four-less-than-thirty, so the spoken shape depends on the last digit.
        expect(yorubaCardinal(22)).toBe("méjìlélógún");        // glossed (22), corpus ×68
        expect(yorubaCardinal(24)).toBe("mẹ́rìnlélógún");      // corpus ×103
        expect(yorubaCardinal(26)).toBe("mẹ́rìndínlọ́gbọ̀n");  // corpus ×54
        expect(yorubaCardinal(35)).toBe("márùndínlógójì");     // glossed (35) ×3
        expect(yorubaCardinal(36)).toBe("mẹ́rìndínlógójì");    // glossed (36) ×3
        expect(yorubaCardinal(37)).toBe("mẹ́tàdínlógójì");     // glossed (37)
    });

    test("15 and 25 are irregular, and the irregular form is the commoner one", () => {
        // mẹ́ẹ̀ẹ́dógún 127 against the regular márùndínlógún 29; mẹ́ẹ̀ẹ́dọ́gbọ̀n 65 against 21. From 35 up only
        // the regular form is attested, so this is two entries and not a pattern.
        expect(yorubaCardinal(15)).toBe("mẹ́ẹ̀ẹ́dógún");
        expect(yorubaCardinal(25)).toBe("mẹ́ẹ̀ẹ́dọ́gbọ̀n");
    });

    test("⚠ 1 fuses as mọ́kàn-, not ọ̀kàn-, though it stands alone as ọ̀kan", () => {
        // mọ́kànlá 171 : ọ̀kànlá 3, and for 39 and 59 the ọ̀kàn- form has ZERO corpus hits. Two values looked
        // unattested until this was measured rather than assumed from the free form.
        expect(yorubaCardinal(1)).toBe("ọ̀kan");
        expect(yorubaCardinal(11)).toBe("mọ́kànlá");
        expect(yorubaCardinal(39)).toBe("mọ́kàndínlógójì");
        expect(yorubaCardinal(59)).toBe("mọ́kàndínlọ́gọ́ta");
    });

    test("⚠ the fused àádọ́- bases keep their à, and 90's drops its final -ún", () => {
        // `ládọ́ta` (one à) had a single corpus hit and made 45-48 and 52-54 look unattested; `láàdọ́ta` finds
        // them. 90's fused base is `láàdọ́rùn`, which is the last 9 of the 89 values 11-99.
        expect(yorubaCardinal(45)).toBe("márùndínláàdọ́ta");
        expect(yorubaCardinal(52)).toBe("méjìléláàdọ́ta");
        expect(yorubaCardinal(88)).toBe("méjìdínláàdọ́rùn");   // the corpus glosses `mejidinlaaadorun-un (88)`
        expect(yorubaCardinal(92)).toBe("méjìléláàdọ́rùn");
    });

    test("tens and hundreds are their own words, each corpus-glossed", () => {
        expect(yorubaCardinal(20)).toBe("ogún");
        expect(yorubaCardinal(50)).toBe("àádọ́ta");            // glossed (50) ×12
        expect(yorubaCardinal(70)).toBe("àádọ́rin");           // glossed (70) ×5
        expect(yorubaCardinal(90)).toBe("àádọ́rùn-ún");        // glossed (90) ×5
        expect(yorubaCardinal(100)).toBe("ọgọ́rùn-ún");        // glossed (100) ×8
        expect(yorubaCardinal(200)).toBe("igba");              // glossed (200) ×21
        expect(yorubaCardinal(400)).toBe("irinwó");
        expect(yorubaCardinal(500)).toBe("ẹ̀ẹ́dẹ́gbẹ̀ta");
        expect(yorubaCardinal(600)).toBe("ẹgbẹ̀ta");
        expect(yorubaCardinal(900)).toBe("ẹ̀ẹ́dẹ́gbẹ̀rún");   // glossed `ẹ̀ẹ́dẹ́gbẹ̀rún mítà (900m)`
    });

    test("a hundred joins its remainder with `ó lé` — glossed twice over", () => {
        expect(yorubaCardinal(280)).toBe("igba ó lé ọgọ́rin");        // glossed (280) ×4
        expect(yorubaCardinal(450)).toBe("irinwó ó lé àádọ́ta");      // glossed (450) ×4
        expect(yorubaCardinal(480)).toBe("irinwó ó lé ọgọ́rin");      // glossed (480) ×4
    });

    test("⚠ a thousand takes `kan` for ×1 but a hundred does not", () => {
        // ẹgbẹ̀rún kan 52 and mílíọ̀nù kan 60, against ọgọ́rùn-ún kan 2 and irinwó kan 0 — and the corpus
        // glosses bare `ọgọ́rùn-ún (100)` eight times.
        expect(yorubaCardinal(1000)).toBe("ẹgbẹ̀rún kan");            // glossed (1000) ×6
        expect(yorubaCardinal(1_000_000)).toBe("mílíọ̀nù kan");
        expect(yorubaCardinal(100)).not.toContain("kan");
    });

    test("⚠ `lọ́nà` multiplies above ten, a bare multiplier below it", () => {
        // ẹgbẹ̀rún + unit 249 : ẹgbẹ̀rún lọ́nà + unit 4, but ẹgbẹ̀rún lọ́nà + ten 46 : ẹgbẹ̀rún + ten 7.
        expect(yorubaCardinal(2000)).toBe("ẹgbẹ̀rún méjì");                       // glossed (2,000) ×8
        expect(yorubaCardinal(10_000)).toBe("ẹgbẹ̀rún mẹ́wàá");                   // glossed (10,000) ×7
        expect(yorubaCardinal(15_000)).toBe("ẹgbẹ̀rún lọ́nà mẹ́ẹ̀ẹ́dógún");      // glossed (15,000)
        expect(yorubaCardinal(20_000)).toBe("ẹgbẹ̀rún lọ́nà ogún");               // glossed (20,000) ×3
        expect(yorubaCardinal(100_000)).toBe("ẹgbẹ̀rún lọ́nà ọgọ́rùn-ún");        // glossed (100,000)
    });

    test("⚠ the multi-part gloss the whole shape rests on", () => {
        // `ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n lé ẹgbẹ̀rin lé méjìlá (32,812)` — 1000×32 + 800 + 12. One corpus
        // sentence that exercises the magnitude, the lọ́nà multiplier, an irregular hundred and a teen at once.
        expect(yorubaCardinal(32_812)).toBe("ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n ó lé ẹgbẹ̀rin ó lé méjìlá");
    });

    test("⚠ no digit reaches the English fallback, and huge numbers degrade in Yoruba", () => {
        // The defect this file exists for: `1945` read *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*, fluent
        // English inside Yoruba speech. Above 10¹² it reads digit-by-digit in Yoruba units — unidiomatic, but
        // in the right language, which is a strictly better failure.
        const y = String(phonemize("1945", "yo"));
        expect(y).not.toMatch(/θ|ʌ|ɹ/u);                      // no English phones
        expect(y.split(" ").length).toBeGreaterThan(3);        // and emitted as separate words, not one blob
        expect(yorubaCardinal(1e15)).not.toMatch(/[a-z]illion/u);
        expect(yorubaCardinal(1e15).split(" ").length).toBeGreaterThan(10);
    });

    test("zero is `òdo`, and the corpus glosses it", () => {
        // `góòlù mẹ́rin sí òdo (4–0)`. The untoned `odo` (430 hits) is odò "river" in every instance.
        expect(yorubaCardinal(0)).toBe("òdo");
    });
});
