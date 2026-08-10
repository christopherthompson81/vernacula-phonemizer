import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeWu } from "../src/languages/wu/normalize.ts";
import { phonemizeWord } from "../src/languages/wu/wu.ts";

// Wu Chinese / Shanghainese (wuu) text normalization. Two layers of assertion, deliberately:
//   · `normalizeWu` directly, because the rules are text→text and a Han string is far easier to read than
//     Chao-letter IPA when one of them is wrong;
//   · `phonemize(…, "wuu")` for the shapes whose whole point is that they reach the g2p — which is also what
//     proves the wiring, and is the only thing that would have caught the drop classes below.
// Every rule's evidence and every refusal's measurement is in
// docs/investigations/wuu_normalization_investigation.md.
const CL = "个個位本张張只隻条條件对對群种種次天年岁歲块塊层層排组組步口面首部台辆輛架座间間扇页頁杯碗瓶盒袋斤磅吨噸";
const norm = (s: string): string => normalizeWu(s, CL);

describe("wuu normalization — text→text", () => {
    test("⚠ a grouping comma DESTROYS THE VALUE, not just the pause", () => {
        // `1,000人` tokenized as `1` + [clause pause] + `000` → 一 … 零人. The number itself was gone, which
        // is why de-grouping runs first. `grouped: 2577` corpus-wide.
        expect(norm("1,000人")).toBe("1000人");
        expect(norm("俄罗斯联邦拥有绵延37,000公里")).toBe("俄罗斯联邦拥有绵延37000公里");
        // ⚠ AND THE CHINESE FOUR-DIGIT GROUPING IS LEFT ALONE — `1,8638.36亿元` is not thousands.
        expect(norm("1,8638.36亿元")).toBe("1,8638点三六亿元");
    });

    test("a year is read digit by digit; a quantity is not", () => {
        expect(norm("2009年")).toBe("二零零九年");
        expect(norm("1990年代")).toBe("一九九零年代");
        expect(norm("2009 年")).toBe("二零零九 年"); // ⚠ across whitespace — the detail that broke cmn
        expect(norm("1225平方公里")).toBe("1225平方公里"); // not a year: no 年 follows
    });

    test("year RANGES, in the three shapes the corpus writes", () => {
        expect(norm("（1763-1774）")).toBe("（一七六三到一七七四）");
        expect(norm("1966-1976年")).toBe("一九六六到一九七六年");
        expect(norm("1969年～1976年")).toBe("一九六九年到一九七六年"); // 年 on BOTH endpoints
        // ⚠ NOT A YEAR RANGE: a magnitude follows, so this is a quantity. Reading it 一四零零到一五零零万元
        // would be confidently wrong; step 6 claims it with the cardinal instead.
        expect(norm("资本额达1,400－1,500万元")).toBe("资本额达1400到1500万元");
    });

    test("⚠ the range rule's GUARD is the rule — a dash with no unit after it is not a range", () => {
        // Every genuine corpus range has a unit, scale or magnitude on the right…
        expect(norm("南北宽约10-15公里")).toBe("南北宽约10到15公里");
        expect(norm("平均气温2-8°C")).toBe("平均气温2到8摄氏度");
        expect(norm("盐度31-32‰")).toBe("盐度31到千分之32");
        expect(norm("0-14 岁")).toBe("0到14 岁");
        expect(norm("6-13世纪")).toBe("6到13世纪");
        expect(norm("3.5—4.5米")).toBe("3点五到4点五米");
        // ⚠ THE SIGN IS CONSUMED AND PUT BACK (trap 10), which is what lets step 9 read BOTH halves —
        // left alone, only the right endpoint would get its 百分之.
        expect(norm("7%-10%")).toBe("百分之 7到百分之 10");
        // …and none of the things a bare `N-M` rule would have wrecked does.
        expect(norm("公交车8 - 31 - 32 - 46")).toBe("公交车8 - 31 - 32 - 46"); // bus routes
        expect(norm("波音747-400型客机")).toBe("波音747-400型客机"); // a model number
        expect(norm("Qwen2.5-72B")).toBe("Qwen2点五-72B"); // a model number
        expect(norm("223-33")).toBe("223-33"); // a tone notation
    });

    test("coordinates — degrees, minutes, seconds, in every mark encoding the corpus uses", () => {
        expect(norm("东经121°09′30〃")).toBe("东经121度09分30秒");
        expect(norm("北纬8°30′")).toBe("北纬8度30分");
        expect(norm("北纬13°43′30″")).toBe("北纬13度43分30秒");
        // ⚠ THE RANGE DASH BETWEEN TWO COORDINATES cannot be seen by any digit-to-digit rule: by then the
        // left endpoint ends in 分. 4 of the corpus's dropped minus signs were this one shape.
        expect(norm("东经121°48´-121°57ˊ")).toBe("东经121度48分到121度57分");
    });

    test("⚠ the two temperature scales take OPPOSITE orders, and both are wiki-attested", () => {
        expect(norm("平均气温15.2°C")).toBe("平均气温15点二摄氏度"); // POSTposed
        expect(norm("32°F")).toBe("华氏32度"); // PREposed
        expect(norm("120°")).toBe("120度"); // bare
    });

    test("percent, per-mille and the fraction, each in the Chinese order", () => {
        expect(norm("50%")).toBe("百分之 50");
        expect(norm("14.5％")).toBe("百分之 14点五"); // full-width ％ — the shared tier reads all three signs
        expect(norm("1‰")).toBe("千分之1");
        expect(norm("1/5")).toBe("5分之1"); // a/b is 分之 in the OPPOSITE order
        expect(norm("至少2/3赞同票")).toBe("至少3分之2赞同票");
    });

    test("population density puts the per-phrase FIRST, as the corpus writes it in words", () => {
        expect(norm("人口密度488/km²")).toBe("人口密度每平方公里488");
        expect(norm("人口密度70人/km²")).toBe("人口密度每平方公里70人");
    });

    test("2 before a classifier is 两 — but never after 第", () => {
        expect(norm("上海、南京两个大都市")).toBe("上海、南京两个大都市");
        expect(norm("2个")).toBe("两个");
        expect(norm("2只岛")).toBe("两只岛");
        expect(norm("第2个")).toBe("第2个"); // ⚠ an ORDINAL — 第二个, never *第两个
        expect(norm("2月")).toBe("2月"); // February, which is 二月
        expect(norm("1200间")).toBe("1200间"); // the no-digit-to-the-left guard
    });

    test("the iteration mark repeats the character it follows", () => {
        expect(norm("佐々木")).toBe("佐佐木");
        expect(norm("多々良氏")).toBe("多多良氏");
    });

    test("declined classes stay declined — each refusal is measured, see the investigation doc", () => {
        expect(norm("== 参考文献 ==")).toBe("== 参考文献 =="); // `=` is wiki heading markup, not 等于
        expect(norm("5+3")).toBe("5+3"); // 加 has no attested operator sense
        expect(norm("13:15.10")).toBe("13:15.10"); // a sports time: neither the colon nor the dot is claimed
        expect(norm("17:47:23")).toBe("17:47:23");
    });
});

describe("wuu normalization — end to end through the wired pipeline", () => {
    test("each rule reaches the g2p as WU words, not as a spelling", () => {
        // 百分之 paq5 fen9 tsy3 — prefixed, as every Sinitic language puts it.
        expect(phonemize("50%", "wuu")).toBe(`${phonemizeWord("百分之")} ${phonemizeWord("五十")}`);
        // ⚠ THE CONJUNCTION IS 搭, NOT 和 — the Wu word, ×176 in the corpus against 和's mostly-bound 40.
        expect(phonemize("A&B", "wuu")).toContain(phonemizeWord("搭"));
        // The two currencies the corpus actually writes, both with a corpus-attested reading.
        expect(phonemize("$500", "wuu")).toContain(phonemizeWord("美元"));
        expect(phonemize("£10,500", "wuu")).toContain(phonemizeWord("英镑"));
    });

    test("the defects the layer exists to fix are gone", () => {
        // ⚠ THE ASSERTION IS ABOUT DIGITS AND MARKS, NOT LATIN LETTERS: IPA is written in ASCII letters, so
        // a `[A-Za-z]` test here fails on ⟨mi˦⟩ and would have to be weakened until it proved nothing.
        // A surviving digit is the DIGIT leak class and a surviving `.`/`,`/`°`/`%` is RAWMARK — the two the
        // corpus diff counts, and the two this layer exists to drive to zero.
        for (const src of ["1,000人", "3.5米", "20°C", "70人/km²", "2009年", "50%", "1/5", "121°09′30″"])
            expect(phonemize(src, "wuu"), src).not.toMatch(/[\d.°%‰′″/]/u);
    });
});

describe("wuu back end — the two gaps normalization measurement exposed", () => {
    // NOT normalization, and fixed where they live (playbook step 3). The dict carried 328 syllable tokens
    // that no rime matched, so the front end's "leave the romanization visible" fallback put ASCII into the
    // phoneme stream — which is what the corpus diff was reporting as 23 DIGIT leaks.
    test("⟨kn⟩ completes the glottalized sonorant series (ʔm ʔn ʔl ʔŋ … ʔɲ)", () => {
        expect(phonemizeWord("仰光")).toBe("ʔɲjɛ̃˥ kwɑ̃˧˩"); // was *knian5 kuaon3*
    });

    test("a BARE glottalized nasal is syllabic", () => {
        expect(phonemizeWord("姆妈")).toBe("ʔm̩˥˧ ʔma˥˧"); // [ʔm̩ma], and it was half ASCII
    });
});
