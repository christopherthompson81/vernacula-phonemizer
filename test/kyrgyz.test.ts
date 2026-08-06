import { describe, expect, test } from "vitest";

import { phonemizeWord, createKyrgyz } from "../src/languages/kyrgyz/kyrgyz.ts";

// Kyrgyz (ky) — Turkic (Kipchak), Cyrillic. Left-to-right g2p with SPELLED vowel harmony + three code rules: the
// velar/uvular harmony (к→q/г→ʁ back, k/ɡ front — a CODA is governed by the preceding vowel: ак→aq), dark-l harmony
// (л→ɫ back / l front), and long vowels (доubling → Vː). ж→d͡ʒ, ң→ŋ, intervocalic б→β. Scored 90.7% folded on
// wikipron kir_cyrl broad (HUMAN, 888).
describe("Kyrgyz canonical IPA — rule g2p (Standard Kyrgyz)", () => {
    test("velar/uvular harmony: к→q/k, coda governed by preceding vowel", () => {
        expect(phonemizeWord("кыз")).toBe("qɯz"); // onset к before back ы → q
        expect(phonemizeWord("ак")).toBe("ɑq"); // coda к after back а → q
        expect(phonemizeWord("китеп")).toBe("kitep"); // onset к before front и → k
        expect(phonemizeWord("Баткен")).toBe("bɑtken"); // onset к before front е → k (though the word has back а)
    });

    test("ж→d͡ʒ, ө/ү/ы vowels, dark-l harmony, intervocalic б→β", () => {
        expect(phonemizeWord("жол")).toBe("d͡ʒoɫ"); // ж→d͡ʒ, dark л (back)
        expect(phonemizeWord("көз")).toBe("køz"); // ө→ø, front
        expect(phonemizeWord("үй")).toBe("yj"); // ү→y
        expect(phonemizeWord("ыр")).toBe("ɯr"); // ы→ɯ
        expect(phonemizeWord("обон")).toBe("oβon"); // intervocalic б → β
    });

    test("long vowels (doubling → Vː)", () => {
        expect(phonemizeWord("тоо")).toBe("toː"); // оо → oː
        expect(phonemizeWord("Айсулуу")).toBe("ɑjsuɫuː"); // уу → uː
    });

    test("cardinal numbers (Turkic decimal, space-separated)", () => {
        const ky = createKyrgyz();
        expect(ky.text("0").trim()).toBe("nøl"); // нөл
        expect(ky.text("21").trim()).toBe("d͡ʒɯjɯrmɑ bir"); // жыйырма бир
        expect(ky.text("100").trim()).toBe("d͡ʒyz"); // жүз (omits leading 1)
        expect(ky.text("1000").trim()).toBe("miŋ"); // миң
        expect(ky.text("1000000000").trim()).toBe("bir milliɑrd"); // бир миллиард (billion tier)
    });

    test("text: words + clause punctuation", () => {
        expect(createKyrgyz().text("Мен барам.")).toBe("men bɑrɑm .");
    });
});
