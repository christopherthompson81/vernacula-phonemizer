import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Mandarin (cmn) — Phase 1, the pinyin input path. Segmental values come from the
// project's converged cmn engine (validated vs wikipron + epitran); tones are Chao contour letters at the
// syllable end, with third-tone sandhi. Anchor values match the espeak-ng-portable canonical integration
// test (zhong1 guo2, ni3 hao3), with tone placement regularized to syllable-final.
describe("mandarin canonical IPA — pinyin path", () => {
  test("monosyllables: initials + finals + tones", () => {
    expect(phonemize("zhong1", "cmn")).toBe("ʈ͡ʂoŋ˥˥");   // zh → ʈ͡ʂ, tone 1 = ˥˥
    expect(phonemize("guo2", "cmn")).toBe("kuo˧˥");        // tone 2 = ˧˥
    expect(phonemize("xing2", "cmn")).toBe("ɕiŋ˧˥");       // x → ɕ (not the leaked pinyin letter)
    expect(phonemize("chi1", "cmn")).toBe("ʈ͡ʂʰʐ̩˥˥");      // retroflex -i → syllabic ʐ̩
    expect(phonemize("si4", "cmn")).toBe("sɹ̩˥˩");          // apical -i → syllabic ɹ̩
    expect(phonemize("ju3", "cmn")).toBe("t͡ɕy˨˩˦");        // j → t͡ɕ, ü → y
  });

  test("multi-syllable + tone at syllable end", () => {
    expect(phonemize("zhong1 guo2", "cmn")).toBe("ʈ͡ʂoŋ˥˥ kuo˧˥");
  });

  test("third-tone sandhi: 3+3 → 2+3", () => {
    expect(phonemize("ni3 hao3", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦");   // ni 3→2, hao stays 3
    expect(phonemize("wo3 hen3 hao3", "cmn")).toBe("wo˧˥ xən˧˥ xɑᵘ˨˩˦"); // run: 2 2 3
  });

  test("ü spellings normalize (lv/nv → lü/nü)", () => {
    expect(phonemize("lv4", "cmn")).toBe(phonemize("lü4", "cmn"));
    expect(phonemize("nv3", "cmn")).toBe("ny˨˩˦");
  });

  test("Hanzi front-end: segmentation + polyphone disambiguation", () => {
    expect(phonemize("中国", "cmn")).toBe("ʈ͡ʂoŋ˥˥ kuo˧˥");
    expect(phonemize("你好", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦");         // 3-3 sandhi across segmentation
    expect(phonemize("银行", "cmn")).toBe("jin˧˥ xɑŋ˧˥");          // 行 → háng (phrase-disambiguated, not xíng)
    expect(phonemize("绿", "cmn")).toBe("ly˥˩");                   // 绿 → lǜ (ü char)
    expect(phonemize("我是中国人", "cmn")).toBe("wo˨˩˦ ʂʐ̩˥˩ ʈ͡ʂoŋ˥˥ kuo˧˥ ʐən˧˥");
  });

  test("numbers: Arabic → Chinese quantity reading (via numeral chars)", () => {
    // 123 substitutes to 一百二十三 and phonemizes identically; 一→yì sandhi comes from the phrase dict.
    expect(phonemize("123", "cmn")).toBe(phonemize("一百二十三", "cmn"));
    expect(phonemize("123", "cmn")).toBe("ji˥˩ paⁱ˨˩˦ ər˥˩ ʂʐ̩˧˥ san˥˥");
    expect(phonemize("3.14", "cmn")).toBe("san˥˥ tiɛn˨˩˦ ji˥˥ sɹ̩˥˩");  // 三点一四
  });

  test("bare -e final is ɤ (referee-confirmed fix; was inconsistent o/ə)", () => {
    expect(phonemize("特", "cmn")).toBe("tʰɤ˥˩");   // tè — wikipron tʰɤ, epitran ɤ
    expect(phonemize("歌", "cmn")).toBe("kɤ˥˥");     // gē — was ko
    expect(phonemize("色", "cmn")).toBe("sɤ˥˩");     // sè — was so
    expect(phonemize("车", "cmn")).toBe("ʈ͡ʂʰɤ˥˥");  // chē — was ʈ͡ʂʰo
  });

  test("punctuation → inline pause, Latin → English", () => {
    expect(phonemize("你好，世界。", "cmn")).toBe("ni˧˥ xɑᵘ˨˩˦ , ʂʐ̩˥˩ t͡ɕiɛ˥˩ .");
    expect(phonemize("他说hello", "cmn")).toBe("tʰɑ˥˥ ʂwo˥˥ həlˈoᶷ");   // embedded Latin routes to en
  });

  test("year reading: 4-digit before 年 is digit-by-digit, else quantity", () => {
    expect(phonemize("2024年", "cmn")).toBe("ər˥˩ liŋ˧˥ ər˥˩ sɹ̩˥˩ niɛn˧˥");  // 二〇二四年
    expect(phonemize("2024", "cmn")).toBe("liɑŋ˨˩˦ t͡ɕʰiɛn˥˥ liŋ˧˥ ər˥˩ ʂʐ̩˧˥ sɹ̩˥˩"); // 两千零二十四 (quantity)
    expect(phonemize("100年", "cmn")).toBe("ji˥˩ paⁱ˨˩˦ niɛn˧˥");            // 一百年 (3-digit → quantity)
  });

  test("一/不 sandhi", () => {
    expect(phonemize("一个", "cmn")).toBe("ji˧˥ kɤ˥˩");    // yí gè — 一 before 4th → 2nd
    expect(phonemize("一天", "cmn")).toBe("ji˥˩ tʰiɛn˥˥"); // yì tiān — 一 before 1st → 4th
    expect(phonemize("第一", "cmn")).toBe("ti˥˩ ji˥˥");    // dì yī — ordinal keeps 1st
    expect(phonemize("不是", "cmn")).toBe("pu˧˥ ʂʐ̩˥˩");   // bú shì — 不 before 4th → 2nd
    expect(phonemize("不好", "cmn")).toBe("pu˥˩ xɑᵘ˨˩˦");  // bù hǎo — 不 before 3rd stays 4th
  });

  test("colloquial 两: standalone 2 before 百/千/万 or a measure word", () => {
    expect(phonemize("2000", "cmn")).toBe("liɑŋ˨˩˦ t͡ɕʰiɛn˥˥");  // 两千
    expect(phonemize("2个", "cmn")).toBe("liɑŋ˨˩˦ kɤ˥˩");        // 两个 (measure word)
    expect(phonemize("12个", "cmn")).toBe("ʂʐ̩˧˥ ər˥˩ kɤ˥˩");    // 十二个 — 二 kept inside 12
    expect(phonemize("2", "cmn")).toBe("ər˥˩");                  // bare 2 → 二
  });
});
