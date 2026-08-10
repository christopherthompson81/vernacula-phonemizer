import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeJin } from "../src/languages/jin/normalize.ts";

import { phonemizeWord } from "../src/languages/jin/jin.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Jin Chinese / 晋语 (cjy), Taiyuan 太原 dialect — a distinct Sinitic branch. The
// signature is the retained 入声/checked coda -ʔ (月→yəʔ, 十→səʔ) that separates Jin from Mandarin, plus the
// five-tone system rendered as Chao contour letters (平 ˩˩, 上 ˥˧, 去 ˦˥, 阴入 ˨, 阳入 ˥˦). Readings are from
// Wiktionary/kaikki Taiyuan Sinological-IPA.
describe("Jin Chinese (Taiyuan) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma˥˧"); // 上声 53
        expect(phonemizeWord("犬")).toBe("t͡ɕʰye˩˩"); // 平声 11
        expect(phonemizeWord("人")).toBe("ʐəŋ˩˩");
    });

    test("the 入声/checked coda -ʔ (the Jin signature)", () => {
        expect(phonemizeWord("月")).toBe("yəʔ˨"); // 阴入 2, glottal-stop coda
        expect(phonemizeWord("十")).toBe("səʔ˥˦"); // 阳入 54, glottal-stop coda
    });

    test("multi-char words carry baked tone sandhi (surface tone after ⁻)", () => {
        expect(phonemizeWord("九十")).toBe("t͡ɕiəu˩˩ səʔ˥˦"); // 九 53→11 (sandhi) before 十
        expect(phonemizeWord("太原")).toBe("tʰai˦˥ ye˩˩"); // Taiyuan, the dialect's home
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("中国")).toBe(phonemizeWord("中國"));
        expect(phonemizeWord("电话")).toBe("tie˦˥ xua˦˥");
    });

    test("numbers compose through the Han numeral system", () => {
        // 25 → 二十五 → əɻ˦˥ səʔ˥˦ vu˥˧
        expect(getPhonemizer("cjy").text("25").trim()).toBe("əɻ˦˥ səʔ˥˦ vu˥˧");
    });

    test("clause punctuation becomes a pause", () => {
        expect(getPhonemizer("cjy").text("馬。").trim()).toBe("ma˥˧ .");
    });
});

describe("cjy text normalization", () => {
    // ⚠ THIS LANGUAGE HAS NO CORPUS. There is no cjy.wikipedia and no FLEURS; the only Jin text that exists
    // is the Wikimedia Incubator's Wp/cjy (3,060 Han characters, artifact covers 7/35 cells). So the rules
    // rest on the SHIPPED DICT — which decides whether a word can be spoken at all — and on that thin text.
    // Evidence and every refusal: docs/investigations/cjy_normalization_investigation.md.

    test("⚠ THE DICT IS THE GATE: an uncovered character is SILENT, not mispronounced", () => {
        // This is why the degree, 两-classifier and relational-sign rules are all refused: the words vanish.
        for (const w of ["度", "摄氏", "攝氏", "两", "兩"]) expect(phonemize(w, "cjy"), w).toBe("");
        // ⟨等于⟩ is worse than silent — it emits ONE syllable and drops 于, so it would say half the word.
        expect(phonemize("等于", "cjy").split(" ")).toHaveLength(1);
        // …and everything this layer DOES emit speaks.
        for (const w of ["百分之", "分之", "點", "到", "和", "公里", "公斤", "平方", "立方", "零", "九"])
            expect(phonemize(w, "cjy"), w).not.toBe("");
    });

    test("the grouping comma destroys the value; the year is digit-by-digit", () => {
        // `1,000` read *iəʔ˨ , liŋ˩˩* — "one … zero", the value gone.
        expect(normalizeJin("1,000")).toBe("1000");
        expect(normalizeJin("1996年")).toBe("一九九六年");
        // ⚠ THE RANGE ARM MUST COME FIRST: only the RIGHT endpoint sees 年, so left alone `1996-2007年`
        // mixed the cardinal and the digit reading, and step 6 could never repair it.
        expect(normalizeJin("1996-2007年")).toBe("一九九六到二零零七年");
    });

    test("percent, fraction, decimal and the ampersand", () => {
        expect(phonemize("50%", "cjy")).toBe(phonemize("百分之五十", "cjy"));
        expect(normalizeJin("1/5")).toBe("5分之1");
        expect(normalizeJin("3.5")).toBe("3點五");
        // ⟨和⟩ ×16 in the incubator text and coordinating — `吳語、粵語和閩南語`. ⟨跟⟩ ×5 is the alternative.
        expect(phonemize("A&B", "cjy")).toContain(phonemize("和", "cjy"));
    });

    test("⚠ a designation is not a range, and a one-character lookbehind cannot tell", () => {
        // `ISO 8859-1` puts a SPACE between the identifier and the digits, so the guard saw the space and
        // read it as "8859 到 1". Checked over the preceding characters instead.
        expect(normalizeJin("ISO 8859-1")).toBe("ISO 8859-1");
        expect(normalizeJin("2-3")).toBe("2到3");
        expect(normalizeJin("第2-3章")).toBe("第2到3章");
    });

    test("⚠ the refused classes stay refused — because the words are SILENT, not because of taste", () => {
        // Emitting 度 would delete the word as well as the sign; the raw sign at least survives as a RAWMARK.
        expect(normalizeJin("20°C")).toBe("20°C");
        expect(normalizeJin("2个")).toBe("2个"); // no 两 rule — 两/兩 are silent
        expect(normalizeJin("x = y")).toBe("x = y");
        expect(normalizeJin("$500")).toBe("$500"); // 元 speaks but is never money in the available text
    });
});
