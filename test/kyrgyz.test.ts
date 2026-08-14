import { describe, expect, test } from "vitest";

import { phonemizeWord, createKyrgyz } from "../src/languages/kyrgyz/kyrgyz.ts";
import { kyrgyzOrdinal } from "../src/languages/kyrgyz/normalize.ts";

// Kyrgyz (ky) — Turkic (Kipchak), Cyrillic. Left-to-right g2p with SPELLED vowel harmony + three code rules: the
// velar/uvular harmony (к→q/г→ʁ back, k/ɡ front — a CODA is governed by the preceding vowel: ак→aq), dark-l harmony
// (л→ɫ back / l front), and long vowels (doubling → Vː). ж→d͡ʒ, ң→ŋ, intervocalic б→β.
// Referee: wikipron kir_cyrl broad (human).
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
        // ⚠ THIS ASSERTION USED TO READ `miŋ` AND WAS PINNING A DEFECT (playbook trap 5). Kyrgyz omits the
        // multiplier 1 before жүз but NOT before миң: ky.wikipedia's year articles gloss the digits as
        // «1914 (бир миң тогуз жүз он төртүнчү) жыл», and its orthography article writes «он беш, бир миң
        // тогуз жүз токсон беш» beside «жүз элүү эки» in one sentence. Corrected, not preserved.
        expect(ky.text("1000").trim()).toBe("bir miŋ"); // бир миң
        expect(ky.text("1991").trim()).toBe("bir miŋ toʁuz d͡ʒyz toqson bir");
        expect(ky.text("1000000000").trim()).toBe("bir milliɑrd"); // бир миллиард (billion tier)
    });

    test("text: words + clause punctuation", () => {
        expect(createKyrgyz().text("Мен барам.")).toBe("men bɑrɑm .");
    });
});

// The normalization layer. Pinned by RULE BRANCH rather than by corpus instance (playbook trap 13): the
// ordinal has a vowel-final branch, a consonant-final branch and four harmony classes, and the corpus's own
// examples exercise only some of them.
describe("Kyrgyz normalization — normalize.ts", () => {
    const say = (s: string): string => createKyrgyz().text(s).trim();

    test("the ordinal composition, one case per BRANCH of the harmony rule", () => {
        // consonant-final stems, all four vowel classes: и→инчи, ү→үнчү, ы→ынчы, о→унчу
        expect(kyrgyzOrdinal(1)).toBe("биринчи");
        expect(kyrgyzOrdinal(3)).toBe("үчүнчү");
        expect(kyrgyzOrdinal(40)).toBe("кыркынчы");
        expect(kyrgyzOrdinal(10)).toBe("онунчу");
        // vowel-final stems drop the linking vowel: эки→экинчи, жыйырма→жыйырманчы, элүү→элүүнчү
        expect(kyrgyzOrdinal(2)).toBe("экинчи");
        expect(kyrgyzOrdinal(20)).toBe("жыйырманчы");
        expect(kyrgyzOrdinal(50)).toBe("элүүнчү");
        // ONLY THE LAST WORD takes the suffix — the branch no single-word example can reach
        expect(kyrgyzOrdinal(1991)).toBe("бир миң тогуз жүз токсон биринчи");
        expect(kyrgyzOrdinal(100)).toBe("жүзүнчү");
        expect(kyrgyzOrdinal(1000)).toBe("бир миңинчи");
    });

    test("the hyphenated ordinal, and the head noun is put back with its own case suffix", () => {
        expect(say("1991-жылы")).toBe("bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ");
        expect(say("19-кылымда")).toBe("on toʁuzunt͡ʃu qɯɫɯmdɑ");
        expect(say("9-Май")).toBe("toʁuzunt͡ʃu mɑj"); // CAPITALISED head (trap 7)
        expect(say("10-12-кылымдагы")).toBe("onunt͡ʃu on ekint͡ʃi qɯɫɯmdɑʁɯ"); // both ends of a span
        expect(say("1991-ж.")).toBe("bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ"); // abbreviated head
    });

    test("a bare CASE suffix after digits is a cardinal, not an ordinal — and is re-harmonised", () => {
        expect(say("150дөн")).toBe("d͡ʒyz elyːdøn"); // элүү + ablative -дөн
        expect(say("1000ге")).toBe("bir miŋɡe"); // миң + dative -ге
        // ⚠ THE WRITTEN SUFFIX IS NOT COPIED. The corpus writes `25ге`, but the spoken last word is `беш`,
        // whose voiceless coda takes -ке. Same for `1923гө` → үчкө. This is trap 14's whole point.
        expect(say("25ге")).toBe("d͡ʒɯjɯrmɑ beʃke");
        // and the discriminator holds in the other direction: a NOUN head is still an ordinal
        expect(say("2-декабрда")).toBe("ekint͡ʃi deqɑbrdɑ");
    });

    test("percent, its bound suffix, and the degree sign in both encodings", () => {
        expect(say("50%")).toBe("elyː pɑjɯz");
        expect(say("80%ке")).toBe("seksen pɑjɯzʁɑ"); // пайыз takes -га, never the written -ке
        expect(say("20 °C")).toBe("d͡ʒɯjɯrmɑ ʁrɑdus"); // Latin C — was the ENGLISH letter name *sˈiː*
        expect(say("-18°Сден")).toBe("minus on seɡiz ʁrɑdustɑn"); // CYRILLIC С — was a bare [s]; -тан, not -тон (back /у/ takes the LOW а)
    });

    test("the minus is read ONLY where the corpus can tell it from a range (trap 24)", () => {
        // genuine negatives — the sign was INVERTING the reading before this
        expect(say("температура -38°С")).toBe("temperɑturɑ minus otuz seɡiz ʁrɑdus");
        expect(say("—40°С")).toBe("minus qɯrq ʁrɑdus"); // this corpus writes the minus as an EM DASH twice
        expect(say("-23...-29 °C")).toContain("minus d͡ʒɯjɯrmɑ yt͡ʃ"); // both ends of an ellipsis span
        // …and the three shapes that must NOT be claimed, one per rejected guard
        expect(say("6-16 °C")).not.toContain("minus"); // a digit precedes — a RANGE, not a negative
        expect(say("39°11′–43°16′")).not.toContain("minus"); // a prime precedes — a COORDINATE
        expect(say("2750-3800 метр")).not.toContain("minus"); // no degree follows — a range
    });

    test("decimals and fractions share one attested construction", () => {
        expect(say("2,5")).toBe("eki bytyn ondon beʃ"); // «1 бүтүн ондон үч … деп окулат»
        expect(say("0,54")).toBe("nøl bytyn d͡ʒyzdøn elyː tørt"); // two places → жүздөн
        expect(say("3/4")).toBe("tørttøn yt͡ʃ"); // denominator ablative + numerator
        expect(say("1/10")).toBe("ondon bir"); // and this IS the corpus's «ондон бир үлүш»
    });

    test("grouping, units, currency and the initialism seam", () => {
        expect(say("1 000 000")).toBe("bir million"); // was *bir nøl nøl*
        expect(say("5 км")).toBe("beʃ kiɫometr"); // was a raw Latin-ish [km] leak
        expect(say("1090 км²")).toBe("bir miŋ toqson t͡ʃɑrt͡ʃɯ kiɫometr");
        expect(say("$100 миллион")).toBe("d͡ʒyz million doɫɫɑr");
        expect(say("СССР")).toBe("es es es er"); // was the vowel-less cluster [ssːr]
        expect(say("СССРдин")).toBe("es es es erdin"); // …with its case suffix kept on one word
        expect(say("ГЭС")).toBe("ɡes"); // readable — correctly LEFT a word
    });

    test("what the layer must NOT do", () => {
        // a sentence-final period still ends the clause
        expect(say("Мен барам. Сен барасың.")).toBe("men bɑrɑm . sen bɑrɑsɯŋ .");
        // the bibliographic `=` is a title separator, not an equals: Latin on the right, no барабар
        expect(say("ПК = Upgrading")).not.toContain("bɑrɑβɑr");
        // a version string's trailing letter is not a unit (traps 28/46/52 — the guard must reject the
        // WHOLE string, not merely position 0)
        expect(say("802.11г")).not.toContain("ɡrɑmm");
        // the range is deliberately unclaimed, and must stay a pair of cardinals with nothing invented
        expect(say("3-4")).toBe("yt͡ʃ tørt");
    });
});
