import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/turkish/turkish.ts";

describe("Turkish g2p (segmental)", () => {
    it("vowels, palatalization, dark-l, ğ", () => {
        const cases: [string, string][] = [
            ["merhaba", "mˈeɾhaba"],
            ["türkiye", "tˈyɾcije"], // ü→y, k→c before front i
            ["güzel", "ɟyzˈel"], // g→ɟ before front ü
            ["okul", "okˈuɫ"], // dark l after back u
            ["dil", "dˈil"], // clear l after front i
            ["çocuk", "t͡ʃod͡ʒˈuk"],
            ["dağ", "dˈaː"], // ğ lengthens
            ["değil", "dejˈil"], // ğ→j between front vowels
            ["düğün", "dˈyːn"], // ğ merges identical ü
            ["asker", "ascˈeɾ"], // k→c after consonant before front e
            ["teşekkür", "teʃecːˈyɾ"], // doubled stop → geminate ː; palatal cː between front e…ü
            ["anne", "annˈe"], // doubled sonorant stays double
            ["İzmir", "ˈizmiɾ"], // İ→i locale fold (+ lexicon stress)
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("pre-accenting suffixes → stress before the suffix", () => {
        expect(phonemizeWord("geliyor")).toBe("ɟelˈijoɾ"); // -Iyor progressive
        expect(phonemizeWord("istiyorum")).toBe("istˈijoɾum");
        expect(phonemizeWord("giderken")).toBe("ɟidˈeɾcen"); // -ken
        expect(phonemizeWord("benimle")).toBe("benˈimle"); // -lA instrumental
        expect(phonemizeWord("kaybetme")).toBe("kajbˈetme"); // -mA negation/verbal-noun
        expect(phonemizeWord("güzeldir")).toBe("ɟyzˈeldiɾ"); // -DIr copula
        expect(phonemizeWord("evdeyim")).toBe("evdˈejim"); // predicative person ending
    });

    it("conditional -sA is pre-accenting", () => {
        expect(phonemizeWord("olsa")).toBe("ˈoɫsa");
        expect(phonemizeWord("varsa")).toBe("vˈaɾsa");
    });

    it("no false positives: plain final-stress words stay final", () => {
        expect(phonemizeWord("kitap")).toBe("citˈap");
        expect(phonemizeWord("araba")).toBe("aɾabˈa");
        expect(phonemizeWord("olsun")).toBe("oɫsˈun"); // imperative -sIn, NOT pre-accenting (bare -sIn excluded)
        expect(phonemizeWord("arasında")).toBe("aɾasɯndˈa"); // possessive+locative -sInDA, not person -sIn
    });

    it("numbers", () => {
        expect(phonemize("0", "tr")).toBe("sɯfˈɯɾ");
        expect(phonemize("42", "tr")).toBe("kˈɯɾk icˈi");
        expect(phonemize("1985", "tr")).toBe("bˈin dokˈuz jˈyz secsˈen bˈeʃ"); // seksen: coda k→c after front e (referee: secsen)
    });
});
