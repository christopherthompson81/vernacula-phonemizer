import { describe, expect, test } from "vitest";

import { createFoochow, phonemizeWord } from "../src/languages/foochow/foochow.ts";

// Min Dong / Eastern Min (cdo) — Fuzhou dialect, Sinitic, tonal (~9M). A Bàng-uâ-cê (BUC / Foochow Romanized) → IPA
// converter (the only major Sinitic branch otherwise absent). BUC missionary convention: plain ⟨p t k⟩ = [pʰ tʰ kʰ],
// ⟨b d g⟩ = [p t k], ⟨c⟩=[t͡s], ⟨ch⟩=[t͡sʰ], ⟨ng⟩=[ŋ]. Validated against BUC↔IPA pairs from the kaikki Chinese dump
// (Wiktionary Module:cdo-pron output) — 99.9% FOLDED / 100.0% symbol, 🔷 reference-implementation parity (the referee
// is rule-generated, not human). Segmental + citation tone, with the 韻變 (rime alternation) MODELLED (tight/loose
// by tone register); tone sandhi, initial assimilation, and the Han front-end deferred. See docs/investigations/cdo_native_bringup_investigation.md.
describe("Min Dong (Fuzhou) canonical IPA — Bàng-uâ-cê → IPA converter", () => {
    const cdo = createFoochow();

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
        expect(createFoochow().text("Hók-ciŭ nè̤ng").trim()).toBe("houʔ˨˦ t͡sieu˥˥ nøyŋ˥˧"); // 福州人 "Fuzhou person"
    });

    test("the text() path handles precomposed NFC ⟨ṳ⟩ (U+1E73) — the [y]/[øy] series", () => {
        // Regression: the tokenizer must NFD-normalize, else the single-codepoint NFC ṳ truncates the syllable.
        expect(createFoochow().text("gṳ̆").trim()).toBe("ky˥˥"); // 車 "cart" — ⟨g⟩→k, ⟨ṳ⟩→y
        expect(createFoochow().text("dṳ̆ng").trim()).toBe("tyŋ˥˥"); // ⟨ṳng⟩→yŋ, not truncated to "t ŋ̍"
    });
});
