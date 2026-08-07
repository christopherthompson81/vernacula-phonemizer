import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sundanese/sundanese.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Sundanese / Basa Sunda (su) — Austronesian (West Java), modern Latin orthography.
// Shallow, near-phonemic (the id/jv pattern), so a flat scan. Signature: the SEVEN-vowel system with the central
// vowel ⟨eu⟩→[ɨ] alongside ⟨e⟩→[ə] (schwa) and ⟨é⟩→[e]; c→[t͡ʃ], j→[d͡ʒ], ng→[ŋ], ny→[ɲ]; glottal at a
// word-initial vowel and same-vowel hiatus. Referee: kaikki su (465) — the only one.
describe("Sundanese canonical IPA", () => {
    test("the seven-vowel system: ⟨eu⟩→ɨ, ⟨e⟩→ə, ⟨é⟩→e", () => {
        expect(phonemizeWord("ieu")).toBe("ʔˈiɨ"); // ⟨eu⟩ → ɨ (+ word-initial glottal)
        expect(phonemizeWord("seukeut")).toBe("sˈɨkɨt"); // ⟨eu⟩ → ɨ twice
        expect(phonemizeWord("kecap")).toBe("kət͡ʃˈap"); // ⟨e⟩ → ə (schwa), c → t͡ʃ; stress shifts off the schwa penult
        expect(phonemizeWord("ngéwé")).toBe("ŋˈewe"); // ng → ŋ, ⟨é⟩ → e (é is not a schwa, so penult stress)
    });

    test("consonants + glottal in same-vowel hiatus", () => {
        expect(phonemizeWord("kuring")).toBe("kˈuriŋ"); // 'I/me' — ng → ŋ
        expect(phonemizeWord("naam")).toBe("nˈaʔam"); // aa hiatus → aʔa
        expect(phonemizeWord("basa")).toBe("bˈasa"); // 'language'
    });

    test("numbers compose (Austronesian decimal)", () => {
        expect(getPhonemizer("su").text("11").trim()).toBe("sabəlˈas"); // sabelas (only 11 takes the sa- prefix)
        expect(getPhonemizer("su").text("12").trim()).toBe("dˈua bəlˈas"); // dua belas
        expect(getPhonemizer("su").text("25").trim()).toBe("dˈua pˈuluh lˈima"); // dua puluh lima
        expect(getPhonemizer("su").text("100").trim()).toBe("sarˈatus"); // saratus
    });

    test("Aksara Sunda (ᮃᮊ᮪ᮞᮛ) front-end — abugida transliterated to Latin, IDENTICAL IPA", () => {
        expect(phonemizeWord("ᮃᮊ᮪ᮞᮛ")).toBe("ʔaksˈara"); // "aksara" — indep A + KA + pamaéh (virama) + SA + RA
        expect(phonemizeWord("ᮃᮊ᮪ᮞᮛ")).toBe(phonemizeWord("aksara")); // Aksara ≡ Latin
        expect(phonemizeWord("ᮊᮨ")).toBe("kə"); // KA + pamepet → ⟨e⟩ [ə] (the pepet)
        expect(phonemizeWord("ᮊᮦ")).toBe("ke"); // KA + panaélaéng → ⟨é⟩ [e]
        expect(phonemizeWord("ᮊᮩ")).toBe("kɨ"); // KA + paneuleung → ⟨eu⟩ [ɨ]
        expect(phonemizeWord("ᮊᮀ")).toBe("kaŋ"); // KA + panyecek → final -ng
        expect(phonemizeWord("ᮝᮤᮜᮥᮏᮨᮀ")).toBe("wilˈud͡ʒəŋ"); // "wilujeng" (welcome)
        expect(getPhonemizer("su").text("᮱᮱").trim()).toBe("sabəlˈas"); // "11" in Aksara Sunda digits → sabelas
    });
});
