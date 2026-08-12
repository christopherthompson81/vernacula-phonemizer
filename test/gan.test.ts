import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/gan/gan.ts";
import { normalizeGan } from "../src/languages/gan/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Gan Chinese / 贛語 (gan), Nanchang 南昌 dialect — a distinct Sinitic branch
// (Jiangxi). Its signature within the Sinitic set: it retains the Middle Chinese 入声 (entering)
// tones with TWO CHECKED STOP CODAS — -t̚ (from MC -p/-t) and -ʔ (from MC -k) — where Hakka keeps all three
// -p̚/-t̚/-k̚, Jin keeps only -ʔ, and Xiang lost the coda entirely. Nasal codas are -n/-ŋ (MC -m merged to -n), and
// Nanchang shows the n→l initial merger (南→lan). Readings from Wiktionary/kaikki Nanchang Sinological-IPA (narrow
// diacritics kept verbatim).
describe("Gan Chinese (Nanchang) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˨˩˧"); // 上 213
        expect(phonemizeWord("人")).toBe("n̠ʲin˧˥"); // 陽平 35
    });

    test("入声 survives with TWO checked codas -t̚ and -ʔ (the Gan signature)", () => {
        expect(phonemizeWord("十")).toBe("sɨt̚˨"); // MC -p → -t̚ (cf. Hakka səp̚˥, Xiang coda-less sz̩˨˦)
        expect(phonemizeWord("學")).toBe("hɔʔ˨"); // MC -k → -ʔ (cf. Hakka hɔk̚)
        expect(phonemizeWord("月")).toBe("n̠ʲyɵt̚˨"); // -t̚
    });

    test("multi-char words + the dialect's home 南昌 (Nanchang)", () => {
        expect(phonemizeWord("南昌")).toBe("lan˧˥ t͡sʰɔŋ˦˨"); // 南→lan (n→l initial merger)
        expect(phonemizeWord("中國")).toBe("t͡suŋ˦˨ kuɛt̚˥");
    });

    test("simplified aliases resolve to the same reading (OpenCC TSCharacters)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
    });

    test("full text via the registry (Han numerals + punctuation)", () => {
        expect(getPhonemizer("gan").text("我食飯。")).toBeTruthy();
    });
});

/**
 * TEXT NORMALIZATION — `src/languages/gan/normalize.ts`.
 *
 * ⚠ ASSERTED ON THE TEXT→TEXT LAYER, NOT ON IPA, except where the point IS the IPA. The layer is pure
 * text→text by design, and a golden phoneme string would re-pin the dict on every rule.
 *
 * ⚠ AND THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES (playbook trap 13). Each rule with a lookup and
 * a fallback gets one case from each side, and several cases below are shapes this corpus does NOT contain
 * — the capitalised/adversarial neighbour, per trap 8.
 */
describe("Gan text normalization", () => {
    test("1. thousands are de-grouped — the grouping comma is otherwise a CLAUSE PAUSE", () => {
        expect(normalizeGan("攏共2,986人死亡")).toBe("攏共2986人死亡");
        // ⚠ EXACTLY-3-DIGIT GROUPS: a decimal, a version and a 万-grouping must all survive untouched.
        expect(normalizeGan("Build係5.1.2600")).toBe("Build係5.1.2600");
        expect(normalizeGan("面積154,0km2")).toBe("面積154,0 平方公里"); // the corpus's own typo, left alone
        // The IPA is the point here: before the rule this read `it̚˥ , lin˧˥ …` — one, pause, zero.
        expect(getPhonemizer("gan").text("1,000人")).not.toContain(",");
    });

    test("2. years read DIGIT BY DIGIT, and the range arms run in the shared order", () => {
        expect(normalizeGan("到2021年")).toBe("到二零二一年");
        expect(normalizeGan("《規劃(2009-2016年)》")).toBe("《規劃(二零零九到二零一六年)》");
        // ⚠ BOTH ENDPOINTS CARRYING 年 is the arm that must precede the single-year rule, or the endpoints
        // are already Han by the time any digit pattern could reach the dash.
        expect(normalizeGan("1996年-2007年")).toBe("一九九六年到二零零七年");
        // ⚠ A 3-DIGIT `N年` IS NOT CLAIMED — the fleet's standing refusal, because it is as often a duration.
        expect(normalizeGan("（589年）")).toBe("（589年）");
        // ⚠ AND A MAGNITUDE BREAKS THE ADJACENCY, which is what keeps `1700喇年` a quantity.
        expect(normalizeGan("有1700喇年歷史")).toBe("有1700喇年歷史");
    });

    test("2b. `\\d{4}年到\\d{4}年前` is a DURATION SPAN, not two years", () => {
        // "5,000 to 3,000 years ago" — the cardinal is wanted, so neither endpoint may be spelled out.
        expect(normalizeGan("約西元前5000年到3000年前")).toBe("約西元前5000年到3000年前");
        expect(normalizeGan("（4000年到5000年前）")).toBe("（4000年到5000年前）");
        // ⚠ THE LONE `NNNN年前` IS STILL A YEAR HERE — "approved BEFORE 2014" — which is why gan cannot take
        // hsn's blunter protect-everything rule. This is the boundary case; keep it pinned.
        expect(normalizeGan("在2014年前得批准")).toBe("在二零一四年前得批准");
    });

    test("3. the fraction is reordered into the Chinese order, `a/b` → `b分之a`", () => {
        expect(normalizeGan("有理數 22/7")).toBe("有理數 7分之22");
        // ⚠ FOUR DIGITS BOTH SIDES IS A YEAR PAIR, and a Latin letter before it makes it a CODE.
        expect(normalizeGan("2020/2021")).toBe("2020/2021");
        expect(normalizeGan("A/C/B351/352")).toBe("A/C/B351/352");
        // ⚠ A CHAINED SLASH IS A FARE TABLE, not a fraction — the corpus's `每加一元就加6/8/10公里`.
        expect(normalizeGan("就加6/8/10公里")).toBe("就加6/8/10公里");
    });

    test("4. percent, units, exponents, currency and the ampersand, through the shared tier", () => {
        expect(normalizeGan("占總人口嗰88%")).toBe("占總人口嗰百分之 88");
        // The corpus writes a SPACED percent and a FULLWIDTH one; both must land.
        expect(normalizeGan("佔世界人口嗰 14 %")).toBe("佔世界人口嗰 百分之 14");
        expect(normalizeGan("學英語（32.6％）")).toBe("學英語（百分之 32點六）");
        expect(normalizeGan("面積2,095km2")).toBe("面積2095 平方公里"); // ASCII-2 exponent, not only `km²`
        expect(normalizeGan("50 km²")).toBe("50 平方公里");
        // ⚠ THE CUBE IS DECLARED ON THE WIKI TIER (立方 ×0 in the corpus, ×3 on gan.wikipedia) — a branch
        // the corpus cannot exercise, pinned for exactly that reason.
        expect(normalizeGan("體積 8200 km³")).toBe("體積 8200 立方公里");
        // ⚠ THE MAGNITUDE HOP: Chinese puts 萬/億 between the number and the unit, which used to drop the
        // whole km² — the exponent AND the unit noun.
        expect(normalizeGan("面積係750萬 km²")).toBe("面積係750萬 平方公里");
        expect(normalizeGan("第750萬名")).toBe("第750萬名"); // …and it fires only when a unit follows
        expect(normalizeGan("票房收入達$116,089,678")).toBe("票房收入達116089678 美元");
        expect(normalizeGan("咸摩斯密史&實第線")).toBe("咸摩斯密史 同到 實第線");
    });

    test("4b. per mille takes 千分之, the word the corpus writes in that exact slot", () => {
        expect(normalizeGan("增長率 9.8‰")).toBe("增長率 千分之9點八");
    });

    test("5. decimals — the fractional part is read DIGIT BY DIGIT, never as a cardinal", () => {
        expect(normalizeGan("約率 3.14")).toBe("約率 3點一四");
        expect(normalizeGan("人口有78.59萬")).toBe("人口有78點五九萬");
        // ⚠ A DOTTED DESIGNATION AND A LONG TAIL ARE BOTH REFUSED (the jv guard, and the 3-digit cap).
        expect(normalizeGan("內部版本係5.1")).toBe("內部版本係5點一");
        expect(normalizeGan("0.77777...")).toBe("0.77777...");
        expect(getPhonemizer("gan").text("3.14")).not.toContain(".");
    });

    test("6. the minus — gan is the one lect in this family with an attested sign word", () => {
        expect(normalizeGan("嗰負值(-1、-2、-3...)")).toBe("嗰負值(負1、負2、負3...)");
        expect(normalizeGan("光等有成 -4.6。")).toBe("光等有成 負4點六。");
        // ⚠ THE GUARD IS A POSITIVE LIST — every counter-example in the corpus has the dash BETWEEN two
        // characters, and the coordinate one would defeat a "not after a digit" guard because ′ is neither.
        expect(normalizeGan("东经113°54′-114°37′")).toBe("东经113°54′-114°37′");
        expect(normalizeGan("ISBN 1-55849-175-9")).toBe("ISBN 1-55849-175-9");
    });

    test("7. ranges take 到, and a Latin designation is not a range", () => {
        expect(normalizeGan("蛇果。5-12米高")).toBe("蛇果。5到12米高");
        expect(normalizeGan("之後6-10號綫")).toBe("之後6到10號綫");
        // ⚠ NOT AFTER A LATIN RUN AT ALL — the space in `ISO 8859-1` defeats a one-character lookbehind,
        // which is the case cjy paid for and this layer inherits.
        expect(normalizeGan("ISO 8859-1")).toBe("ISO 8859-1");
        expect(normalizeGan("（GB/T 7408-2005）")).toBe("（GB/T 7408-2005）");
    });

    test("0. the superscript ordinal indicator folds to its base letter", () => {
        // The artifact's only RAWMARK leak: `ª` (U+00AA) reaching the IPA inside a transliterated name.
        expect(normalizeGan("（Yəšaʻªyāhû）")).toBe("（Yəšaʻayāhû）");
    });

    test("⚠ THE DECLINED CLASSES STAY DECLINED — each would emit a SILENT or HALF word", () => {
        // ⟨度⟩ is silent and ⟨攝氏⟩ is half in this dict, so a degree rule would delete the word as well as
        // the sign. ⟨加⟩ ⟨減⟩ ⟨乘⟩ are silent; ⟨等於⟩ emits one syllable of two.
        for (const s of ["20°C", "熔點380℃", "x = y", "6 × 6", "動詞+得+補語"])
            expect(normalizeGan(s)).toBe(s);
        // ⚠ THE ° SURVIVES BUT ITS NUMBER IS STILL NORMALISED — the decimal rule is upstream of nothing here
        // and correctly still fires. Pinned so a future degree rule shows up as a change to this line.
        expect(normalizeGan("分開角度就係 47.8°")).toBe("分開角度就係 47點八°");
        // ⚠ AND THE BARE EXPONENT IS THE FAMILY'S SIXTH ROMANIZATION HAZARD: a superscript in a gan article
        // is usually a NANCHANG TONE NUMBER, in the very notation this engine's dict comes from.
        expect(normalizeGan("地球（南昌話：/tʰi¹¹ tɕʰiu²⁴/）")).toBe("地球（南昌話：/tʰi¹¹ tɕʰiu²⁴/）");
    });
});
