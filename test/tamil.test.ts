import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/tamil/tamil.ts";

describe("Tamil abugida g2p", () => {
    it("core words, vowels, retroflex, dental", () => {
        const cases: [string, string][] = [
            ["தமிழ்", "t̪ˈɐmɪɻ"], // ழ → ɻ (census), த → t̪ dental
            ["வணக்கம்", "ʋˈɐɳɐkːɐm"], // க்க geminate → kː, ண → ɳ
            ["இரண்டு", "ˈɪɾɐɳɖʊ"], // ண்ட → ɳɖ (post-nasal voicing)
            ["நன்றி", "n̪ˈɐnrɪ"], // ந n̪ / ன n distinction, ன்ற → nr
            ["அது", "ˈad̪ʊ"], // independent அ → a; த voiced intervocalically
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("plosive allophony (voicing)", () => {
        expect(phonemizeWord("மகன்")).toBe("mˈɐɡɐn"); // க → ɡ intervocalic
        expect(phonemizeWord("தம்பி")).toBe("t̪ˈɐmbɪ"); // ப → b post-nasal
        expect(phonemizeWord("பசி")).toBe("pˈɐt͡ɕɪ"); // ச stays t͡ɕ intervocalic (the exception)
        expect(phonemizeWord("பஞ்சு")).toBe("pˈɐɲd͡ʒʊ"); // ச → d͡ʒ post-nasal
        expect(phonemizeWord("கற்று")).toBe("kˈɐʈrʊ"); // ற்ற → ʈr
        expect(phonemizeWord("அவர்")).toBe("ˈaʋɐr"); // coda ர → r (not the tap ɾ)
    });

    it("stress: primary on syllable 1, secondary on odd syllables (4+ syllable words)", () => {
        expect(phonemizeWord("அரசியல்")).toBe("ˈaɾɐt͡ɕˌɪjɐl"); // 4 syll → ˌ on syllable 3
        expect(phonemizeWord("இரண்டு")).toBe("ˈɪɾɐɳɖʊ"); // 3 syll → no secondary
    });

    it("numbers", () => {
        expect(phonemize("5", "ta")).toBe("ˈaᶦn̪d̪ʊ");
        expect(phonemize("10", "ta")).toBe("pˈɐt̪ːʊ");
    });
});
