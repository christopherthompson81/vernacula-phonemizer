import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Mandarin (cmn) — Phase 1, the pinyin input path. Segmental values come from the
// project's converged cmn engine (validated vs wikipron + epitran); tones are Chao contour letters at the
// syllable end, with third-tone sandhi. Anchor values (zhong1 guo2, ni3 hao3) carry tone placement
// regularized to syllable-final.
describe("mandarin canonical IPA — pinyin path", () => {
    test("monosyllables: initials + finals + tones", () => {
        expect(phonemize("zhong1", "cmn")).toBe("ʈ͡ʂoŋ˥˥"); // zh → ʈ͡ʂ, tone 1 = ˥˥
        expect(phonemize("guo2", "cmn")).toBe("kuo˧˥"); // tone 2 = ˧˥
        expect(phonemize("xing2", "cmn")).toBe("ɕiŋ˧˥"); // x → ɕ (not the leaked pinyin letter)
        expect(phonemize("chi1", "cmn")).toBe("ʈ͡ʂʰʐ̩˥˥"); // retroflex -i → syllabic ʐ̩
        expect(phonemize("si4", "cmn")).toBe("sɹ̩˥˩"); // apical -i → syllabic ɹ̩
        expect(phonemize("ju3", "cmn")).toBe("t͡ɕy˨˩˦"); // j → t͡ɕ, ü → y
    });

    test("multi-syllable + tone at syllable end", () => {
        expect(phonemize("zhong1 guo2", "cmn")).toBe("ʈ͡ʂoŋ˥˥ kuo˧˥");
    });

    test("third-tone sandhi: 3+3 → 2+3", () => {
        expect(phonemize("ni3 hao3", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦"); // ni 3→2, hao stays 3
        expect(phonemize("wo3 hen3 hao3", "cmn")).toBe("wo˧˥ xən˧˥ xɑᵘ˨˩˦"); // run: 2 2 3
    });

    test("ü spellings normalize (lv/nv → lü/nü)", () => {
        expect(phonemize("lv4", "cmn")).toBe(phonemize("lü4", "cmn"));
        expect(phonemize("nv3", "cmn")).toBe("ny˨˩˦");
    });

    test("Hanzi front-end: segmentation + polyphone disambiguation", () => {
        expect(phonemize("中国", "cmn")).toBe("ʈ͡ʂoŋ˥˥ kuo˧˥");
        expect(phonemize("你好", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦"); // 3-3 sandhi across segmentation
        expect(phonemize("银行", "cmn")).toBe("jin˧˥ xɑŋ˧˥"); // 行 → háng (phrase-disambiguated, not xíng)
        expect(phonemize("绿", "cmn")).toBe("ly˥˩"); // 绿 → lǜ (ü char)
        expect(phonemize("我是中国人", "cmn")).toBe(
            "wo˨˩˦ ʂʐ̩˥˩ ʈ͡ʂoŋ˥˥ kuo˧˥ ʐən˧˥",
        );
    });

    test("numbers: Arabic → Chinese quantity reading (via numeral chars)", () => {
        // 123 substitutes to 一百二十三 and phonemizes identically; 一→yì sandhi comes from the phrase dict.
        expect(phonemize("123", "cmn")).toBe(phonemize("一百二十三", "cmn"));
        expect(phonemize("123", "cmn")).toBe("ji˥˩ paⁱ˨˩˦ ər˥˩ ʂʐ̩˧˥ san˥˥");
        expect(phonemize("3.14", "cmn")).toBe("san˥˥ tiɛn˨˩˦ ji˥˥ sɹ̩˥˩"); // 三点一四
    });

    test("bare -e final is ɤ (referee-confirmed fix; was inconsistent o/ə)", () => {
        expect(phonemize("特", "cmn")).toBe("tʰɤ˥˩"); // tè — wikipron tʰɤ, epitran ɤ
        expect(phonemize("歌", "cmn")).toBe("kɤ˥˥"); // gē — was ko
        expect(phonemize("色", "cmn")).toBe("sɤ˥˩"); // sè — was so
        expect(phonemize("车", "cmn")).toBe("ʈ͡ʂʰɤ˥˥"); // chē — was ʈ͡ʂʰo
    });

    test("punctuation → inline pause, Latin → English", () => {
        expect(phonemize("你好，世界。", "cmn")).toBe(
            "ni˧˥ xɑᵘ˨˩˦ , ʂʐ̩˥˩ t͡ɕiɛ˥˩ .",
        );
        expect(phonemize("他说hello", "cmn")).toBe("tʰɑ˥˥ ʂwo˥˥ həlˈoᶷ"); // embedded Latin routes to en
    });

    test("year reading: 4-digit before 年 is digit-by-digit, else quantity", () => {
        expect(phonemize("2024年", "cmn")).toBe("ər˥˩ liŋ˧˥ ər˥˩ sɹ̩˥˩ niɛn˧˥"); // 二〇二四年
        expect(phonemize("2024", "cmn")).toBe(
            "liɑŋ˨˩˦ t͡ɕʰiɛn˥˥ liŋ˧˥ ər˥˩ ʂʐ̩˧˥ sɹ̩˥˩",
        ); // 两千零二十四 (quantity)
        expect(phonemize("100年", "cmn")).toBe("ji˥˩ paⁱ˨˩˦ niɛn˧˥"); // 一百年 (3-digit → quantity)
    });

    test("一/不 sandhi", () => {
        expect(phonemize("一个", "cmn")).toBe("ji˧˥ kɤ˥˩"); // yí gè — 一 before 4th → 2nd
        expect(phonemize("一天", "cmn")).toBe("ji˥˩ tʰiɛn˥˥"); // yì tiān — 一 before 1st → 4th
        expect(phonemize("第一", "cmn")).toBe("ti˥˩ ji˥˥"); // dì yī — ordinal keeps 1st
        expect(phonemize("不是", "cmn")).toBe("pu˧˥ ʂʐ̩˥˩"); // bú shì — 不 before 4th → 2nd
        expect(phonemize("不好", "cmn")).toBe("pu˥˩ xɑᵘ˨˩˦"); // bù hǎo — 不 before 3rd stays 4th
    });

    test("colloquial 两: standalone 2 before 百/千/万 or a measure word", () => {
        expect(phonemize("2000", "cmn")).toBe("liɑŋ˨˩˦ t͡ɕʰiɛn˥˥"); // 两千
        expect(phonemize("2个", "cmn")).toBe("liɑŋ˨˩˦ kɤ˥˩"); // 两个 (measure word)
        expect(phonemize("12个", "cmn")).toBe("ʂʐ̩˧˥ ər˥˩ kɤ˥˩"); // 十二个 — 二 kept inside 12
        expect(phonemize("2", "cmn")).toBe("ər˥˩"); // bare 2 → 二
    });

    // Regression tests for review-caught defects.
    test("quantity 一 sandhi is consistent across multipliers (not just phrase-dict 一百)", () => {
        expect(phonemize("1000", "cmn")).toBe("ji˥˩ t͡ɕʰiɛn˥˥"); // yì qiān (before 1st) — was wrongly yī
        expect(phonemize("10000", "cmn")).toBe("ji˧˥ wɑn˥˩"); // yí wàn (before 4th) — was wrongly yī
        expect(phonemize("1000", "cmn")).toBe(phonemize("一千", "cmn")); // typed vs synthesized agree
    });

    test("oversized numbers read digit-by-digit, not silently dropped", () => {
        expect(phonemize("9007199254740992", "cmn")).not.toBe(""); // just above MAX_SAFE_INTEGER
        expect(phonemize("共10000000000000000元", "cmn")).toContain("jyæn"); // 元 survives, 10¹⁶ voiced
    });

    test("Latin-only input routes to English, not raw passthrough", () => {
        expect(phonemize("hello", "cmn")).toBe("həlˈoᶷ");
        expect(phonemize("abc2024", "cmn")).toBe(
            "ˈeᶦbiːsˌiː liɑŋ˨˩˦ t͡ɕʰiɛn˥˥ liŋ˧˥ ər˥˩ ʂʐ̩˧˥ sɹ̩˥˩",
        );
    });

    test("第一个 keeps ordinal 第一 (dì yī), not the 一个 sandhi (yí)", () => {
        expect(phonemize("第一个", "cmn")).toBe("ti˥˩ ji˥˥ kɤ˥˩"); // dì yī gè
        expect(phonemize("一个", "cmn")).toBe("ji˧˥ kɤ˥˩"); // yí gè unchanged
    });
});

// #562 text normalization — the fifth language. Mandarin already had more of this tier than any other
// audited (digit-by-digit years, full dates, 世纪, 点/分, 第N, the 百分之 prefix, full-width punctuation,
// Latin-run delegation), so the defects were in the ENGINE's number handling rather than in a new pass.
describe("mandarin normalization", () => {
    test("the following-character test must skip whitespace", () => {
        // The corpus writes "2009 年" and "2 个人" WITH a space (272 years, and every 两 case), and the
        // literal next character was the space — so the year rule and the 两 rule both silently failed and
        // 2009 年 came out as the CARDINAL 两千零九年 instead of the digit-by-digit 二零零九年.
        expect(phonemize("2009 年", "cmn")).toBe("ər˥˩ liŋ˧˥ liŋ˧˥ t͡ɕioᵘ˨˩˦ niɛn˧˥"); // 二零零九年
        expect(phonemize("2009年", "cmn")).toBe("ər˥˩ liŋ˧˥ liŋ˧˥ t͡ɕioᵘ˨˩˦ niɛn˧˥"); // unspaced, unchanged
        expect(phonemize("10 年", "cmn")).toBe("ʂʐ̩˧˥ niɛn˧˥"); // a DURATION stays a cardinal, 十年
        expect(phonemize("2 个人", "cmn")).toBe("liɑŋ˨˩˦ kɤ˥˩ ʐən˧˥"); // 两个人, not 二个人
    });

    test("comma grouping is part of the number, not a clause boundary", () => {
        // "783,562" was read as two numbers with a PAUSE between them. 61 occurrences in the corpus.
        expect(phonemize("1,000", "cmn")).toBe("ji˥˩ t͡ɕʰiɛn˥˥"); // 一千
        expect(phonemize("783,562", "cmn"))
            .toBe("t͡ɕʰi˥˥ ʂʐ̩˧˥ pɑ˥˥ wɑn˥˩ san˥˥ t͡ɕʰiɛn˥˥ wu˧˥ paⁱ˨˩˦ lioᵘ˥˩ ʂʐ̩˧˥ ər˥˩"); // 七十八万三千五百六十二
    });

    test("currency and degrees were dropped or read as English letters", () => {
        expect(phonemize("$50", "cmn")).toBe("wu˨˩˦ ʂʐ̩˧˥ meⁱ˨˩˦ jyæn˧˥"); // 五十美元 — the sign was dropped
        expect(phonemize("20 °C", "cmn")).toBe("ər˥˩ ʂʐ̩˧˥ ʂɤ˥˩ ʂʐ̩˥˩ tu˥˩"); // 摄氏度, was the letter C
        expect(phonemize("35°", "cmn")).toBe("san˥˥ ʂʐ̩˧˥ wu˨˩˦ tu˥˩"); // 度
        expect(phonemize("120 km/h", "cmn")).toBe("ji˥˩ paⁱ˨˩˦ ər˥˩ ʂʐ̩˧˥ koŋ˥˥ li˧˥ meⁱ˧˥ ɕjɑᵘ˨˩˦ ʂʐ̩˧˥");
        // ℃ / ℉ are SINGLE code points (U+2103, U+2109), so the `°c`/`°f` keys could not reach them and
        // `20℃` read as bare 二十 — the whole unit gone. Found while reviewing #586; hi and en had it too.
        expect(phonemize("20℃", "cmn")).toBe("ər˥˩ ʂʐ̩˧˥ ʂɤ˥˩ ʂʐ̩˥˩ tu˥˩"); // 摄氏度
        expect(phonemize("20℉", "cmn")).toBe("ər˥˩ ʂʐ̩˧˥ xwɑ˧˥ ʂʐ̩˥˩ tu˥˩"); // 华氏度
    });

    // #586, from the zh.wikipedia fill: Chinese has no spaces, so a unit or sign is normally flanked by Han —
    // and the shared tier's letter-boundary guards were rejecting exactly that. Only punctuation-adjacent
    // instances worked, which is why the FLEURS corpus (units written as words) could never show it.
    test("a unit or sign survives a Han neighbour (#586)", () => {
        expect(phonemize("38℃很热", "cmn")).toBe("san˥˥ ʂʐ̩˧˥ pɑ˥˥ ʂɤ˥˩ ʂʐ̩˥˩ tu˥˩ xən˨˩˦ ʐɤ˥˩");
        expect(phonemize("20°C很热", "cmn")) // was: the C read as English *sˈiː*
            .toBe("ər˥˩ ʂʐ̩˧˥ ʂɤ˥˩ ʂʐ̩˥˩ tu˥˩ xən˨˩˦ ʐɤ˥˩");
        expect(phonemize("50 km²的面积", "cmn"))
            .toBe("wu˨˩˦ ʂʐ̩˧˥ pʰiŋ˧˥ fɑŋ˥˥ koŋ˥˥ li˨˩˦ tɤ miɛn˥˩ t͡ɕi˥˥");
        expect(phonemize("為$500，", "cmn")).toBe("weⁱ˥˩ wu˧˥ paⁱ˨˩˦ meⁱ˨˩˦ jyæn˧˥ ,"); // 美元
        // …and a dotted designation is still not a quantity: `g` must not become 克 here.
        expect(phonemize("802.11g的标准", "cmn")).not.toContain("kʰɤ˥˩");
    });

    test("fractions are stated in the opposite order from the notation", () => {
        expect(phonemize("1/5", "cmn")).toBe("wu˨˩˦ fən˥˥ ʈ͡ʂʐ̩˥˥ ji˥˥"); // 五分之一, "of five parts, one"
        expect(phonemize("3/4", "cmn")).toBe("sɹ̩˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ san˥˥"); // 四分之三
    });

    test("a dropped minus INVERTS a temperature (#586)", () => {
        // The defect this whole pass exists for: `-5 度` read as 五度 — POSITIVE five degrees.
        expect(phonemize("-5 度", "cmn")).toBe("liŋ˧˥ ɕiɑ˥˩ wu˨˩˦ tu˥˩"); // 零下五度, "five below zero"
        expect(phonemize("-5 °C", "cmn")).toBe("liŋ˧˥ ɕiɑ˥˩ wu˨˩˦ ʂɤ˥˩ ʂʐ̩˥˩ tu˥˩"); // 零下五摄氏度
        // Han-adjacent, because Chinese has no spaces — the fleet's `(?<!\p{L})` guard would refuse this one.
        expect(phonemize("气温-5度。", "cmn")).toBe("t͡ɕʰi˥˩ wuən˥˥ liŋ˧˥ ɕiɑ˥˩ wu˨˩˦ tu˥˩ .");
        expect(phonemize("-5", "cmn")).toBe("fu˥˩ wu˨˩˦"); // 负五 — 负 away from a degree word
    });

    test("a negative is not a range, a score, or a hyphenated code", () => {
        expect(phonemize("6-6", "cmn")).toBe("lioᵘ˥˩ lioᵘ˥˩"); // the artifact's tennis score
        expect(phonemize("5-3", "cmn")).toBe("wu˨˩˦ san˥˥"); // and its baseball one
        expect(phonemize("Il-76", "cmn")).toBe("ˈɪɫ t͡ɕʰi˥˥ ʂʐ̩˧˥ lioᵘ˥˩"); // Latin-initial compound
        expect(phonemize("1990-1995", "cmn"))
            .toBe("ji˥˩ t͡ɕʰiɛn˥˥ t͡ɕioᵘ˧˥ paⁱ˧˥ t͡ɕioᵘ˨˩˦ ʂʐ̩˧˥ ji˥˩ t͡ɕʰiɛn˥˥ t͡ɕioᵘ˧˥ paⁱ˧˥ t͡ɕioᵘ˨˩˦ ʂʐ̩˧˥ wu˨˩˦");
    });

    test("the math signs each have a word, and it is the operator's word", () => {
        expect(phonemize("x = y", "cmn")).toBe("ˈɛks təŋ˨˩˦ jy˧˥ wˈaᶦ"); // 等于
        expect(phonemize("5 < 6", "cmn")).toBe("wu˧˥ ɕjɑᵘ˨˩˦ jy˧˥ lioᵘ˥˩"); // 小于
        expect(phonemize("6 × 6", "cmn")).toBe("lioᵘ˥˩ ʈ͡ʂʰəŋ˧˥ ji˨˩˦ lioᵘ˥˩"); // 乘以
        expect(phonemize("6 ÷ 3", "cmn")).toBe("lioᵘ˥˩ ʈ͡ʂʰu˧˥ ji˨˩˦ san˥˥"); // 除以
        expect(phonemize("±5", "cmn")).toBe("ʈ͡ʂəŋ˥˩ fu˥˩ wu˨˩˦"); // 正负
        // 加, the arithmetic operator — NOT 加上, whose attestations are the conjunction sense.
        expect(phonemize("+5", "cmn")).toBe("t͡ɕiɑ˥˥ wu˨˩˦");
        // The artifact's one math-sign drop: a UTC offset, where the sign is attached to letters.
        expect(phonemize("11:00 (UTC+1)", "cmn")).toBe("ʂʐ̩˧˥ ji˥˥ , liŋ˧˥ jˈuː tʰˈiː sˈiː t͡ɕiɑ˥˥ ji˥˥");
    });

    test("the exponent's measure word PRECEDES the unit", () => {
        expect(phonemize("50 km²", "cmn")).toBe("wu˨˩˦ ʂʐ̩˧˥ pʰiŋ˧˥ fɑŋ˥˥ koŋ˥˥ li˨˩˦"); // 五十平方公里
        expect(phonemize("50 m³", "cmn")).toBe("wu˨˩˦ ʂʐ̩˧˥ li˥˩ fɑŋ˥˥ mi˨˩˦"); // 五十立方米
        // A myriad magnitude between the number and the unit — undeclared, `km` fell through to English.
        expect(phonemize("5 万 km²", "cmn")).toBe("wu˨˩˦ wɑn˥˩ pʰiŋ˧˥ fɑŋ˥˥ koŋ˥˥ li˨˩˦"); // 五万平方公里
        // A BARE exponent takes 的平方/的立方. Emitting a digit here read 5² as 五的**两**次方.
        expect(phonemize("5²", "cmn")).toBe("wu˨˩˦ tɤ pʰiŋ˧˥ fɑŋ˥˥"); // 五的平方
        expect(phonemize("5³", "cmn")).toBe("wu˨˩˦ tɤ li˥˩ fɑŋ˥˥"); // 五的立方
    });

    test("what already worked is unchanged", () => {
        expect(phonemize("2011年3月14日", "cmn"))
            .toBe("ər˥˩ liŋ˧˥ ji˥˥ ji˥˥ niɛn˧˥ san˥˥ jyɛ˥˩ ʂʐ̩˧˥ sɹ̩˥˩ ʐʐ̩˥˩"); // year digit-wise, month/day cardinal
        expect(phonemize("20世纪", "cmn")).toBe("ər˥˩ ʂʐ̩˧˥ ʂʐ̩˥˩ t͡ɕi˥˩"); // a century is a CARDINAL
    });

    test("#586 embedded foreign SCRIPT routes, and accented Latin stays one word", () => {
        // cmn drives clauseSink() directly instead of going through assembleClauses, and assembleClauses is
        // where emitUnclaimed calls the script router — so taking the fast path meant silently opting out of a
        // fleet-wide fix. Every non-Latin foreign script was DELETED: Greek, Cyrillic, Thai, all of it.
        expect(phonemize("這個詞 Ελλάδα 意即", "cmn")).toContain(phonemize("Ελλάδα", "el"));
        expect(phonemize("這個詞 Владимир 意即", "cmn")).toContain(phonemize("Владимир", "ru"));
        expect(phonemize("這個詞 เด็ก 意即", "cmn")).toContain(phonemize("เด็ก", "th"));
        // ⚠ THE COST WAS ITS OWN CORPUS: cmn's artifact is partly a Chinese article ABOUT THAI GRAMMAR. The
        // audit called this an `iteration DROP` (a missing ๆ); the truth was the whole Thai run was gone.
        expect(phonemize("其疊詞形 เด็กๆ 來表", "cmn")).toContain(phonemize("เด็กๆ", "th"));
        // A run spans ONE interior space, because Thai separates a reduplication mark: split at the space, `ๆ`
        // reaches Thai with no antecedent and the reading loses a word.
        expect(phonemize("คนอ้วน ๆ 意即", "cmn")).toContain(phonemize("คนอ้วน ๆ", "th"));
        // `\p{Script=Latin}`, not `[A-Za-z]` — the same fix yue already pins. The ASCII class split an accented
        // word at every diacritic and read each fragment as an English LETTER NAME (`Haldarsvík` → "…v" + "kay").
        expect(phonemize("Müslüm", "cmn")).toBe(phonemize("Müslüm", "en"));
        expect(phonemize("Haldarsvík", "cmn")).toBe(phonemize("Haldarsvík", "en"));
        // Han and Latin themselves must be untouched by the new branch.
        expect(phonemize("一個胖子", "cmn")).toBe("ji˧˥ kɤ˥˩ pʰɑŋ˥˩ t͡sɹ̩");
        expect(phonemize("這個詞 hello 意即", "cmn")).toContain(phonemize("hello", "en"));
    });
});
