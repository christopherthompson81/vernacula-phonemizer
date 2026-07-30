import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/zulu/zulu.ts";

describe("Zulu (isiZulu) g2p — authored beyond-espeak", () => {
    it("clicks (census ǀ ǃ ǁ), aspirated and nasal variants", () => {
        expect(phonemizeWord("cela")).toBe("kǀˈɛːla"); // c → dental click kǀ
        expect(phonemizeWord("qala")).toBe("kǃˈaːla"); // q → alveolar click kǃ
        expect(phonemizeWord("xola")).toBe("kǁˈɔːla"); // x → lateral click kǁ
        expect(phonemizeWord("chaza")).toBe("kǀʰˈaːz̤a"); // ch → aspirated click
        expect(phonemizeWord("gcina")).toBe("ɡ̤ǀˈiːna"); // gc → voiced-depressor click
    });

    it("implosive, ejective stops, aspirates, depressor breathy voice", () => {
        expect(phonemizeWord("banga")).toBe("ɓˈaːŋɡ̤a"); // b → implosive ɓ; ng → ŋɡ̤ (depressor)
        expect(phonemizeWord("phuma")).toBe("pʰˈuːma"); // ph → aspirated pʰ (plain p is ejective pʼ)
        expect(phonemizeWord("thanda")).toBe("tʰˈaːnd̤a"); // th → tʰ; d → depressor d̤
        expect(phonemizeWord("zonke")).toBe("z̤ˈɔːŋkʼɛ"); // z → depressor z̤; nk → ŋkʼ
    });

    it("lateral fricatives, velar-lateral affricate, palatalization", () => {
        expect(phonemizeWord("hlala")).toBe("ɬˈaːla"); // hl → voiceless lateral fricative ɬ
        expect(phonemizeWord("dlala")).toBe("ɮ̤ˈaː˥˩la˩"); // dl → voiced lateral fricative ɮ̤ (+ lexical tone)
        expect(phonemizeWord("klabe")).toBe("k͡xʼˈaːɓɛ"); // kl → velar-lateral affricate k͡xʼ
        expect(phonemizeWord("njani")).toBe("ɲd͡ʒ̤ˈaːni"); // nj → homorganic ɲd͡ʒ̤
    });

    it("penultimate stress + length and lexical tone overlay", () => {
        expect(phonemizeWord("abantu")).toBe("a˩ɓˈaː˥ntʼu˩"); // penult aː + tone L-H-L
        expect(phonemizeWord("umuntu")).toBe("u˩mˈuː˥ntʼu˩");
        expect(phonemizeWord("labantu")).toBe("laɓˈaːntʼu"); // out-of-lexicon → untoned, penult stress/length only
    });

    it("cardinal numbers (agglutinative; toned like any word where the lexicon has data)", () => {
        expect(phonemize("1", "zu")).toBe("kʼˈuːɲɛ"); // ku- form not in lexicon → untoned
        expect(phonemize("10", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩"); // ishumi is a toned noun (kaikki: FFL)
        expect(phonemize("100", "zu")).toBe("i˥˩kʰˈuː˥˩lu˩"); // ikhulu (kaikki: FFL)
        expect(phonemize("21", "zu")).toBe("amaʃˈuːmi amaɓˈiːli nˈaːɲɛ"); // combining forms have no tone data
    });

    // The three unit series are distinct and must NOT be conflated: standalone ku- (kuthathu), connective na-
    // (nantathu), multiplier ama- (amathathu). Source: zulu.jsonc "numbers" (espeak-independent authored table).
    // Regression note: 13/15/23/25/… were once reported as failures by a number-audit probe whose sentinel regex
    // was case-insensitive and so matched the legitimate na- forms "NANtathu"/"NANhlanu" as "NaN". The output was
    // correct all along; these goldens pin it.
    it("cardinal numbers — the na- connective series (units 3 and 5) is intact", () => {
        expect(phonemize("3", "zu")).toBe("kʼutʰˈaːtʰu"); // kuthathu — standalone ku-
        expect(phonemize("5", "zu")).toBe("kʼuɬˈaːnu"); // kuhlanu
        expect(phonemize("13", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩ nantʼˈaːtʰu"); // ishumi nantathu — connective na-
        expect(phonemize("15", "zu")).toBe("i˥˩ʃˈuː˥˩mi˩ nanɬˈaːnu"); // ishumi nanhlanu
        expect(phonemize("555", "zu")).toBe("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu"); // ama- multipliers
        expect(phonemize("2000", "zu")).toBe("iz̤iŋkʼuluŋɡ̤wˈaːnɛ amaɓˈiːli"); // izinkulungwane amabili
        expect(phonemize("1000000", "zu")).toBe("i˩si˥ɡ̤ˈiː˩d̤i˩"); // isigidi
    });

    it("compound splits on internal capitals; tone threads across if the full word is listed", () => {
        expect(phonemize("isiNgisi", "zu")).toBe("ˈiː˥si˩ ŋɡ̤ˈiː˥si˩"); // full word toned → threaded
        expect(phonemize("isiTsonga", "zu")).toBe("ˈiːsi t͡sʼˈɔːŋɡ̤a"); // full word not listed → untoned
    });
});
