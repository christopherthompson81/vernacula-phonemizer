import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/cantonese/cantonese.ts";

// Canonical-IPA goldens for Cantonese / Yue (yue). Han → Jyutping (rime-cantonese dict) → IPA: initial + final
// (phonemic aː/ɐ length, checked -p̚/-t̚/-k̚ codas) + one of the six tones as Chao contour letters
// (1˥ 2˧˥ 3˧ 4˨˩ 5˩˧ 6˨). Polyphones resolve by word. See docs/investigations/yue_native_bringup_investigation.md.
describe("cantonese canonical IPA", () => {
    test("Han → IPA (tones, aː/ɐ length, checked codas, polyphones)", () => {
        expect(phonemizeWord("香港")).toBe("hœːŋ˥ kɔːŋ˧˥"); // hoeng1 gong2 'Hong Kong'
        expect(phonemizeWord("食飯")).toBe("sɪk̚˨ faːn˨"); // sik6 faan6 'eat': checked coda k̚
        expect(phonemizeWord("廣東話")).toBe("kʷɔːŋ˧˥ tʊŋ˥ waː˧˥"); // 'Cantonese': labio-velar kʷ
        expect(phonemizeWord("唔該")).toBe("m̩˨˩ kɔːi˥"); // m4 goi1: syllabic nasal m̩
        expect(phonemizeWord("銀行")).toBe("ŋɐn˨˩ hɔːŋ˨˩"); // 'bank': 行→hong4
        expect(phonemizeWord("行路")).toBe("haːŋ˨˩ lou˨"); // 'walk': 行→haang4 (polyphone by word)
    });

    test("direct Jyutping input", () => {
        expect(phonemizeWord("nei5 hou2")).toBe("nei˩˧ hou˧˥"); // 你好
    });

    test("numbers (Han-numeral composition)", () => {
        expect(phonemize("21", "yue")).toBe("jiː˨ sɐp̚˨ jɐt̚˥"); // 二十一
        // #562: a SYNTHESIZED numeral is read per character, not through word segmentation. The dict has a
        // colloquial lexical 十九 = sap1 gau1, and greedy longest-match applied it inside every composed
        // number containing 十九 — 29 came out ji6 sap1 gau1. 18 of the corpus's 208 distinct integers.
        expect(phonemize("29", "yue")).toBe("jiː˨ sɐp̚˨ kɐu˧˥"); // 二十九 ji6 sap6 gau2
        expect(phonemize("1969", "yue")).toBe(
            "jɐt̚˥ t͡sʰiːn˥ kɐu˧˥ paːk̚˧ lʊk̚˨ sɐp̚˨ kɐu˧˥",
        );
    });
});

// #562 text normalization. Counts in the comments are instances in FLEURS yue_hant_hk (1,726 utterances);
// the rules and the ordering they depend on are documented in src/languages/cantonese/normalize.ts.
describe("cantonese text normalization (#562)", () => {
    const yue = (s: string): string => phonemize(s, "yue");

    test("4-digit year before 年 reads digit by digit, not as a cardinal (×119)", () => {
        // Was 二千零九年 (the cardinal). 年 must be found ACROSS the space this corpus writes.
        expect(yue("2009 年")).toBe(phonemizeWord("二零零九年"));
        expect(yue("1767年")).toBe(phonemizeWord("一七六七年"));
        expect(yue("1480 年代")).toBe(phonemizeWord("一四八零年代"));
        // A DURATION keeps the cardinal — nothing in the surface form distinguishes it, so only 4 digits.
        expect(yue("10 年後")).toBe(phonemizeWord("十年後"));
    });

    test("YYYY-YYYY range: one reading across both endpoints, joined by 至 (×4)", () => {
        // Only the right endpoint is followed by 年, so without this the left one stayed a cardinal.
        expect(yue("1644-1912 年")).toBe(phonemizeWord("一六四四至一九一二年"));
        expect(yue("1469–1539")).toBe(phonemizeWord("一四六九至一五三九"));
        expect(yue("1977 至 1981 年")).toBe(phonemizeWord("一九七七至一九八一年"));
        // A short numeric range is NOT claimed: 6-6 and 7–2 in this corpus are tennis scores (六比六),
        // and no surface feature separates them from 2-3 公里. Unchanged from the pre-#562 behaviour.
        expect(yue("6-6")).toBe(phonemizeWord("六六"));
    });

    test("comma grouping is part of the number, not a clause break (×27)", () => {
        // Was 一 [pause] 零 — the comma was punctuation and integerToHan("000") is 零, so 1,000 lost its value.
        expect(yue("1,000")).toBe(phonemizeWord("一千"));
        expect(yue("104,500")).toBe(phonemizeWord("十萬四千五百"));
    });

    test("clock H:MM → H點M分 (×12)", () => {
        // Was 十一 [pause] 二十九. Asserted literally, NOT against phonemizeWord("十一點二十九分"): text an
        // author wrote in Han numerals still goes through word segmentation and so still picks up the dict's
        // colloquial 十九 = sap1 gau1, while a number the engine composed correctly does not.
        expect(yue("11:29")).toBe("sɐp̚˨ jɐt̚˥ tiːm˧˥ jiː˨ sɐp̚˨ kɐu˧˥ fɐn˥");
        expect(yue("06:30")).toBe(phonemizeWord("六點三十分")); // written leading zero is not spoken
        expect(yue("10:00")).toBe(phonemizeWord("十點")); // a zero minute takes no 分
        expect(yue("10:08")).toBe(phonemizeWord("十點零八分")); // a minute under ten takes 零
        // ×2, incl. the stray a.m. letters, which used to reach the English phonemizer. Literal for the same
        // reason as 11:29 above — 十九 as authored Han keeps its lexical reading.
        expect(yue("07:19 a.m.")).toBe("sœːŋ˨ ŋ̩˩˧ t͡sʰɐt̚˥ tiːm˧˥ sɐp̚˨ kɐu˧˥ fɐn˥");
    });

    test("percent via the shared symbol tier, 百分之 as a PREFIX (×12)", () => {
        expect(yue("80%")).toBe(phonemizeWord("百分之八十")); // the sign was dropped outright
        expect(yue("20％")).toBe(phonemizeWord("百分之二十")); // full-width ％ folded locally (see below)
    });

    test("decimals: 點 + a digit-by-digit fraction (×15)", () => {
        expect(yue("6.34")).toBe(phonemizeWord("六點三四")); // never 六點三十四; was 六 [pause] 三十四
        expect(yue("1.5 億")).toBe(phonemizeWord("一點五億"));
    });

    test("fraction takes the Chinese order (×1)", () => {
        expect(yue("1/5")).toBe(phonemizeWord("五分之一"));
        // Han-unit slashes — 10 of the corpus's 11 — must be untouched: digits are required on both sides.
        expect(yue("國家/地區")).toBe(phonemizeWord("國家地區"));
    });

    test("2 before a classifier is 兩, not 二 (×4)", () => {
        expect(yue("2 座")).toBe(phonemizeWord("兩座"));
        expect(yue("2 個小時")).toBe(phonemizeWord("兩個小時"));
        expect(yue("2 月")).toBe(phonemizeWord("二月")); // February is a DATE, not a count
        expect(yue("12 個")).toBe(phonemizeWord("十二個")); // the guard: no digit to the left
    });

    test("clause marks added as data; ．is deliberately NOT one", () => {
        expect(yue("好…好")).toContain(","); // … ×7 and ﹑ ×5 and ─ ×13 lost their pause entirely
        expect(yue("好─好")).toContain(",");
        // ．U+FF0E ×16 is the interpunct INSIDE transliterated names (瑪麗．安東尼), not a period.
        expect(yue("瑪麗．安東尼")).toBe(phonemizeWord("瑪麗安東尼"));
    });

    test("accented Latin stays one run for the foreign phonemizer (×9)", () => {
        // [A-Za-z]+ split Müslüm into M / sl / m, three separate English words ("ˈɛm sɫ ˈɛm").
        expect(yue("Müslüm")).toBe(phonemize("Müslüm", "en"));
    });
});
