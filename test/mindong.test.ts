import { describe, expect, test } from "vitest";

import { createMinDong, phonemizeWord } from "../src/languages/mindong/mindong.ts";

// Min Dong / Eastern Min (cdo) — Fuzhou dialect, Sinitic, tonal (~9M). A Bàng-uâ-cê (BUC / Foochow Romanized) → IPA
// converter (the only major Sinitic branch otherwise absent). BUC missionary convention: plain ⟨p t k⟩ = [pʰ tʰ kʰ],
// ⟨b d g⟩ = [p t k], ⟨c⟩=[t͡s], ⟨ch⟩=[t͡sʰ], ⟨ng⟩=[ŋ]. Validated against BUC↔IPA pairs from the kaikki Chinese dump
// (Wiktionary Module:cdo-pron output) — ⚠ REFERENCE-IMPLEMENTATION PARITY, not independent agreement (the referee
// is rule-generated, not human). Segmental + citation tone, with the 韻變 (rime alternation) MODELLED (tight/loose
// by tone register); tone sandhi, initial assimilation, and the Han front-end deferred.
describe("Min Dong (Fuzhou) canonical IPA — Bàng-uâ-cê → IPA converter", () => {
    const cdo = createMinDong();

    test("the missionary convention: plain ⟨k g c ch⟩ → [kʰ k t͡s t͡sʰ]", () => {
        expect(phonemizeWord("kēng")).toBe("kʰɛiŋ˧˧"); // ⟨k⟩→kʰ, rime eng→ɛiŋ, macron→上聲 33 (犬 "dog")
        expect(phonemizeWord("cūi")).toBe("t͡sui˧˧"); // ⟨c⟩→t͡s (水 "water")
        expect(phonemizeWord("chiáh")).toBe("t͡sʰiɑʔ˨˦"); // ⟨ch⟩→t͡sʰ, checked acute → 陰入 24 (赤 "red")
        expect(phonemizeWord("mā")).toBe("ma˧˧"); // ⟨m⟩→m (馬 "horse")
    });

    test("tones: the five diacritics → the 7 Fuzhou categories (checked bump on ʔ-final)", () => {
        expect(phonemizeWord("nguŏk")).toBe("ŋuoʔ˥"); // breve + checked coda → 陽入 5 (月 "moon")
        expect(phonemizeWord("siŏh")).toBe("suoʔ˥"); // ⟨-h⟩ checked, breve → 陽入 5
    });

    test("韻變 rime alternation: the SAME rime is TIGHT under 陰平/陽平/上聲, LOOSE under 陰去/陽去/陰入", () => {
        expect(phonemizeWord("găng")).toBe("kaŋ˥˥"); // 間 ⟨ang⟩ TIGHT [aŋ] (breve = 陰平 55)
        expect(phonemizeWord("gáng")).toBe("kɑŋ˨˩˧"); // 間 ⟨ang⟩ LOOSE [ɑŋ] (acute = 陰去 213)
        expect(phonemizeWord("să̤")).toBe("sɛ˥˥"); // ⟨a̤⟩ TIGHT [ɛ] (breve)
        expect(phonemizeWord("dá̤")).toBe("tɑ˨˩˧"); // ⟨a̤⟩ LOOSE [ɑ] (acute)
        expect(phonemizeWord("iông")).toBe("yɔŋ˨˦˨"); // ⟨iong⟩ y-medial (zero onset) + LOOSE (circumflex = 陽去)
    });

    test("syllabic nasal + the vowel-quality rimes ⟨ṳ e̤ o̤⟩ → [y øy o]", () => {
        expect(phonemizeWord("ng")).toBe("ŋ̍˥˥"); // bare ⟨ng⟩ → syllabic velar nasal (唔)
        expect(phonemizeWord("nè̤ng")).toBe("nøyŋ˥˧"); // ⟨e̤ng⟩→øyŋ, grave → 陽平 53 (人 "person")
    });

    test("multi-syllable BUC text (hyphen-joined), citation tone per syllable", () => {
        expect(createMinDong().text("Hók-ciŭ nè̤ng").trim()).toBe("houʔ˨˦ t͡sieu˥˥ nøyŋ˥˧"); // 福州人 "Fuzhou person"
    });

    test("the text() path handles precomposed NFC ⟨ṳ⟩ (U+1E73) — the [y]/[øy] series", () => {
        // Regression: the tokenizer must NFD-normalize, else the single-codepoint NFC ṳ truncates the syllable.
        expect(createMinDong().text("gṳ̆").trim()).toBe("ky˥˥"); // 車 "cart" — ⟨g⟩→k, ⟨ṳ⟩→y
        expect(createMinDong().text("dṳ̆ng").trim()).toBe("tyŋ˥˥"); // ⟨ṳng⟩→yŋ, not truncated to "t ŋ̍"
    });
});

// Cardinal numbers — Min Dong is Sinitic (myriad grouping 萬 10⁴ / 億 10⁸, internal zero spoken 零 lìng), but unlike
// cantonese/minnan the numerals CANNOT route through a Han reading dict (cdo has none that is not this engine's own
// referee), so the compositor emits BÀNG-UÂ-CÊ and the converter above reads it. Fuzhou specifics: a magnitude
// multiplier of 1 is 蜀 siŏh (not 一 ék), of 2 is 兩 lâng before 百/千/萬/億 but 二 nê before 十; 八 báik (8) and
// 百 báik (100) really are homophones. Source: Wikivoyage "Fuzhou dialect phrasebook" Numbers (see mindong.ts).
describe("Min Dong (cdo) cardinal numbers — Bàng-uâ-cê composition", () => {
    const cdo = createMinDong();
    for (const [n, ipa] of [
        [0, "liŋ˥˧"], // 零 lìng
        [7, "t͡sʰɛiʔ˨˦"], // 七 chék
        [10, "sɛiʔ˨˦"], // 十 sék
        [11, "sɛiʔ˨˦ ɛiʔ˨˦"], // 十一 sék-ék — the bare unit digit is ék
        [20, "nɛi˨˦˨ sɛiʔ˨˦"], // 二十 nê-sék — 二 nê before 十
        [21, "nɛi˨˦˨ sɛiʔ˨˦ ɛiʔ˨˦"], // 廿一/二十一
        [100, "suoʔ˥ paiʔ˨˦"], // 蜀百 siŏh-báik — multiplier 1 is 蜀, not 一
        [1000, "suoʔ˥ t͡sʰieŋ˥˥"], // 蜀千 siŏh-chiĕng
        [12345, "suoʔ˥ uɑŋ˨˦˨ lɑŋ˨˦˨ t͡sʰieŋ˥˥ saŋ˥˥ paiʔ˨˦ sɛi˨˩˧ sɛiʔ˨˦ ŋou˨˦˨"], // 蜀萬兩千… — 兩 lâng before 千
        [1000000, "suoʔ˥ paiʔ˨˦ uɑŋ˨˦˨"], // 蜀百萬 — myriad grouping, no "million" word
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(cdo.text(String(n)).trim()).toBe(ipa);
        });
    }
});
