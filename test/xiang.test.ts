import { describe, expect, test } from "vitest";

import { normalizeXiang } from "../src/languages/xiang/normalize.ts";
import { phonemizeWord } from "../src/languages/xiang/xiang.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Xiang Chinese / 湘语 (hsn), Changsha 长沙 (New Xiang) dialect — a distinct Sinitic
// branch. Its signature within the Sinitic set: it retains the Middle Chinese 入声 (entering) TONE (Chao 24) but
// LOST the checked stop coda entirely — no -p̚/-t̚/-k̚ (Hakka keeps) and no -ʔ (Jin keeps): 十→sz̩˨˦, 月→y̯e̞˨˦ end
// in a bare vowel/nasal. Six tones as Chao letters (陰平 ˧˧, 陽平 ˩˧, 上 ˦˩, 陰去 ˦˥, 陽去 ˨˩, 入 ˨˦). Readings from
// Wiktionary/kaikki Changsha Sinological-IPA (narrow vowel diacritics kept verbatim).
describe("Xiang Chinese (Changsha) canonical IPA", () => {
    test("single characters — tones as Chao letters", () => {
        expect(phonemizeWord("馬")).toBe("ma̠˦˩"); // 上 41
        expect(phonemizeWord("人")).toBe("ʐən˩˧"); // 陽平 13
    });

    test("入声 survives as a TONE (24) but the checked coda is GONE (the Xiang signature)", () => {
        expect(phonemizeWord("十")).toBe("sz̩˨˦"); // no -p̚ (cf. Hakka səp̚˥) — bare syllabic z̩
        expect(phonemizeWord("月")).toBe("y̯e̞˨˦"); // no -t̚ (cf. Hakka ŋiat̚˥) — bare vowel
    });

    test("multi-char words + the dialect's home 長沙 (Changsha)", () => {
        expect(phonemizeWord("長沙")).toBe("t͡san˩˧ sa̠˧˧");
        expect(phonemizeWord("中國")).toBe("t͡sən˧˧ ku̯ɤ̞˨˦");
    });

    test("simplified input resolves (via OpenCC aliases)", () => {
        expect(phonemizeWord("长沙")).toBe(phonemizeWord("長沙"));
    });

    test("numbers compose through the Han numeral system", () => {
        expect(getPhonemizer("hsn").text("100").trim()).toBe("i˨˦ pɤ̞˨˦"); // 一百
    });
});

// ── TEXT NORMALIZATION (src/languages/xiang/normalize.ts) ───────────────────────────────────────────────
// Counts are over the Wikimedia Incubator `Wp/hsn` — 153 pages, 30,640 characters, the ONLY Xiang text that
// exists (there is no hsn.wikipedia and no FLEURS). Derivation: the file header and
// tools/corpus/mined/hsn.jsonc, which covers 16/35 cells because the other 19 have nothing to mine.
describe("xiang text normalization", () => {
    test("the classes the corpus actually has", () => {
        expect(normalizeXiang("12.8%")).toBe("百分之 12點八"); // % ×12, all previously silent
        expect(normalizeXiang("1998年")).toBe("一九九八年"); // \d{4}年 ×116 — the biggest class here
        expect(normalizeXiang("2005年到2010年")).toBe("二零零五年到二零一零年");
        expect(normalizeXiang("12,434元")).toBe("12434元"); // a grouping comma was a clause PAUSE
        expect(normalizeXiang("23-45")).toBe("23到45"); // 到 ×65, the corpus's own connective
        expect(normalizeXiang("365.25天")).toBe("365點二五天"); // fractional part digit-by-digit
    });

    test("⚠ the superscript is a TONE NUMBER, not a power — hsn is the fifth Sinitic corpus to prove it", () => {
        // 23 of this corpus's 24 superscript runs are 湘語羅馬字 romanization tones; exactly ONE is an
        // exponent. Reading them as powers would turn a pronunciation table into arithmetic.
        expect(normalizeXiang("/ʃɘ̃⁴⁵/")).toBe("/ʃɘ̃⁴⁵/");
        expect(normalizeXiang("/mɔ⁴²/")).toBe("/mɔ⁴²/");
        expect(normalizeXiang("5.9742×10²⁴公斤")).toBe("5.9742×10²⁴公斤"); // scientific notation, untouched
        // …but a squared UNIT still reads, because it composes onto the unit noun and cannot match a tone.
        // the shared tier spaces its insertions (`百分之 12`, `50 平方公里`) — identical in cjy, and
        // harmless because a Han engine tokenizes by script run, so the space is not a boundary it can see.
        expect(normalizeXiang("50km²")).toBe("50 平方公里");
    });

    test("⚠ REGRESSION GUARD: N年前 is 'N years AGO', a quantity — not the year N", () => {
        // the corpus diff caught this: `2400年前亇春秋戰國` came out as 二四零零年前, the year 2400 read
        // digit by digit. The 多 forms were already safe; the bare one was not.
        expect(normalizeXiang("2400年前亇春秋戰國")).toBe("2400年前亇春秋戰國");
        expect(normalizeXiang("7000多年前")).toBe("7000多年前");
        expect(normalizeXiang("1998年")).toBe("一九九八年"); // …and an ordinary year still spells
    });

    test("end to end — what the layer emits really is spoken by the dict", () => {
        const hsn = getPhonemizer("hsn");
        // ⚠ THE DICT IS A HARD GATE: the Han engine skips an uncovered character SILENTLY, so a word this
        // layer emits must be checked to SPEAK or it vanishes. 百分之 and 點 both do.
        expect(hsn.text("12.8%").trim()).toContain("pɤ̞˨˦ ɸən˧˧ t͡sz̩˧˧"); // 百分之
        expect(hsn.text("365.25天").trim()).toContain("ti̯e̞˦˩"); // 點
    });
});
