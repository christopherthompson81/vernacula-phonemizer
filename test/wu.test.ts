import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/wu/wu.ts";

// Canonical-IPA goldens for Wu Chinese / Shanghainese (wuu) — the third Sinitic language. Han → Wugniu (zaonhe
// romanization, rime-wugniu dict.tsv) with greedy longest-match segmentation → IPA (initial + final + Chao
// tone). No independent referee exists (no wikipron/epitran wuu); these values are the wuuwiki
// inline-IPA-validated adjudicated gold. Segmental + the left-prominent register sandhi.
describe("wu (Shanghainese) canonical IPA", () => {
    test("three-way obstruent contrast + register tone (the Wu signature)", () => {
        // voiceless-unaspirated (yin ˥˧) / aspirated (yin) / VOICED (yang ˩˧) — the retained MC voicing.
        expect(phonemizeWord("巴")).toBe("pa˥˧"); // p
        expect(phonemizeWord("怕")).toBe("pʰa˧˦"); // pʰ
        expect(phonemizeWord("爬")).toBe("ba˩˧"); // b — voiced → yang low tone
        expect(phonemizeWord("家")).toBe("ka˥˧"); // k
        expect(phonemizeWord("茄")).toBe("ɡa˩˧"); // ɡ — voiced
    });

    test("checked coda (入声 → glottal stop ʔ) + syllabic nasal", () => {
        expect(phonemizeWord("國")).toBe("koʔ˥"); // 陰入
        expect(phonemizeWord("學")).toBe("ɦoʔ˩˨"); // 陽入, voiced ɦ
        expect(phonemizeWord("一")).toBe("iʔ˥");
        expect(phonemizeWord("八")).toBe("paʔ˥");
        expect(phonemizeWord("五")).toBe("ŋ̍˩˧"); // syllabic velar nasal
    });

    test("distinct finals: nasalised, front-rounded, glides, apical", () => {
        expect(phonemizeWord("羊")).toBe("jɛ̃˩˧"); // ⟨yan⟩ glide + nasal ɛ̃
        expect(phonemizeWord("雲")).toBe("yəɲ˩˧"); // front-rounded y + nasal
        expect(phonemizeWord("話")).toBe("wa˩˧"); // ⟨w⟩ glide onset
        expect(phonemizeWord("謝")).toBe("zja˩˧"); // voiced z + i-glide
        expect(phonemizeWord("衣")).toBe("i˥˧"); // bare /i/ (Wugniu spells the on-glide only where phonemic)
    });

    test("陰平/陰去 split (recovered from the MC tone category)", () => {
        expect(phonemizeWord("詩")).toBe("sɿ˥˧"); // 陰平, apical ɿ
        expect(phonemizeWord("試")).toBe("sɿ˧˦"); // 陰去 — same segment, different citation tone
    });

    test("left-prominent register sandhi (multi-char words)", () => {
        expect(phonemizeWord("上海")).toBe("zɑ̃˨ hɛ˦"); // yang word: σ1 ˨, rest ˦
        expect(phonemizeWord("好人")).toBe("hɔ˥ ɲɪɲ˧˩"); // yin word: σ1 ˥, final ˧˩
        expect(phonemizeWord("你好")).toBe("ʔni˥ hɔ˧˩"); // ʔn glottalised sonorant → yin
        expect(phonemizeWord("中國人")).toBe("t͡soŋ˥ koʔ˧ ɲɪɲ˧˩"); // yin: ˥ ˧ ˧˩
    });

    test("running text: word-sandhi + citation mix", () => {
        // 我/是 citation (yang ˩˧), 上海人 as one word (register sandhi).
        expect(phonemize("我是上海人", "wuu")).toBe("ŋu˩˧ zɿ˩˧ zɑ̃˨ hɛ˦ ɲɪɲ˦");
    });

    test("numbers (Han-numeral composition)", () => {
        expect(phonemize("123", "wuu")).toBe("iʔ˥ paʔ˧˩ ɲi˨ zəʔ˦ sɛ˦"); // 一百二十三
    });

    // ⚠ A SYLLABLE BODY IS A LOWERCASE RUN THE CALLER SUPPLIES, and the finals/syllabic tables are plain
    // objects, so a bare index reads Object.prototype. `constructor` is a lowercase word: before the
    // `Object.hasOwn` guard, "constructor1" came back as "function Object() { [native code] }˥˧" — the
    // function's own source, in the phoneme stream. The Han path cannot reach it (dict readings are real
    // Wugniu), which is exactly why 200 golden rows and the parity gate never saw it.
    test("an inherited Object.prototype key is NOT a rime", () => {
        expect(phonemize("constructor1", "wuu")).toBe("constructor1");
        expect(phonemizeWord("constructor")).toBe("constructor");
        expect(phonemizeWord("cconstructor1")).toBe("cconstructor1"); // ⟨c⟩ onset + inherited rime
        expect(phonemizeWord("tostring1")).toBe("tostring1");
    });
});
