import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/sinhala/sinhala.ts";

describe("Sinhala abugida g2p", () => {
    it("schwa alternation (inherent a ↔ ə)", () => {
        const cases: [string, string][] = [
            ["ගම", "ɡˈamə"], // first inherent a → a, final inherent → ə
            ["මම", "mˈamə"],
            ["ක", "kˈə"], // open monosyllable → ə
            ["නම්", "nˈam"], // closed monosyllable keeps a
            ["පාසල", "pˈaːsələ"], // non-first inherent → ə
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("geminates, dentals, and the ᶯ census primitive", () => {
        expect(phonemizeWord("අම්මා")).toBe("ˈamːaː"); // ම්ම geminate → mː
        expect(phonemizeWord("තාත්තා")).toBe("t̪ˈaːt̪ːaː"); // ත dental + ත්ත → t̪ː
        expect(phonemizeWord("අඬනවා")).toBe("ˈaᶯɖənˌəʋaː"); // ඬ → ᶯɖ (census primitive, preserved)
    });

    it("homorganic anusvara ං", () => {
        expect(phonemizeWord("සිංහල")).toBe("sˈiŋhələ"); // before h → ŋ
        expect(phonemizeWord("සංචාරක")).toBe("sˈaɲt͡ʃaːrˌəkə"); // before palatal → ɲ
        expect(phonemizeWord("සංවිධාන")).toBe("sˈamʋid̪ʰˌaːnə"); // before labial → m
    });

    it("coda / final ව → glide w", () => {
        expect(phonemizeWord("බව")).toBe("bˈaw"); // word-final ව → w
        expect(phonemizeWord("නිව්ටන්")).toBe("nˈiwʈən"); // coda ව් → w
        expect(phonemizeWord("කෘති")).toBe("krˈut̪i"); // vocalic-r ෘ → ru
    });

    it("stress: primary on syllable 1, secondary on even non-final nuclei", () => {
        expect(phonemizeWord("අතර")).toBe("ˈat̪ərə"); // 3 nuclei → no secondary
        expect(phonemizeWord("ඡායාරූප")).toBe("t͡ʃhˈaːjaːrˌuːpə"); // 4 nuclei → ˌ on nucleus 3
    });

    it("cardinal numbers (authored — espeak's si number path is broken)", () => {
        expect(phonemize("5", "si")).toBe("pˈahə");
        expect(phonemize("10", "si")).toBe("d̪ˈahəjə");
        expect(phonemize("21", "si")).toBe("ʋˈisiˌekə");
        expect(phonemize("100", "si")).toBe("sˈijəjə");
    });
});
