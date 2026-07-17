import { describe, expect, test } from "vitest";

import { phonemizeWord, createXhosa } from "../src/languages/xhosa/xhosa.ts";

// Canonical-IPA goldens for Xhosa / isiXhosa (xh) — Nguni Bantu, AUTHORED beyond-espeak. The sibling of Zulu:
// it REUSES the shared Zulu g2p scan (the 15-way click series, depressor consonants, implosive b→ɓ, ejective
// stops) with the Xhosa rule table — the one addition being ⟨rh⟩→[x] (voiceless velar fricative, Zulu lacks it).
// Nguni penultimate stress with vowel lengthening (ˈ + ː); tone is lexical/unwritten → deferred. Validated at
// 90.0% vs wikipron xho narrow + 80.2% vs epitran. See docs/investigations/xh_native_bringup_investigation.md.
describe("Xhosa canonical IPA", () => {
    test("clicks (c/q/x → kǀ/kǃ/kǁ, xh→kǁʰ) + penult stress/length", () => {
        expect(phonemizeWord("xhosa")).toBe("kǁʰˈɔːsa"); // xh → kǁʰ (aspirated lateral click)
        expect(phonemizeWord("iqanda")).toBe("ikǃˈaːnd̤a"); // q → kǃ (postalveolar click)
        expect(phonemizeWord("ukutya")).toBe("ukʼˈuːcʼa"); // ty → cʼ; k → kʼ (ejective); penult stress
    });

    test("the Xhosa ⟨rh⟩ → [x] (Zulu lacks it)", () => {
        expect(phonemizeWord("rhoxa")).toBe("xˈɔːkǁa"); // rh → x, x → kǁ (lateral click)
        expect(phonemizeWord("irhafu")).toBe("ixˈaːfu"); // rh → x
    });

    test("depressor/implosive/nasal + penult length", () => {
        expect(phonemizeWord("molo")).toBe("mˈɔːlɔ"); // penult ˈ + ː
        expect(phonemizeWord("amanzi")).toBe("amˈaːnz̤i"); // z → z̤ (depressor)
        expect(phonemizeWord("ndiyabulela")).toBe("nd̤ijaɓulˈɛːla"); // b → ɓ (implosive), d → d̤
    });

    test("numbers (Nguni agglutinative; Xhosa 2=-bini, 6=isithandathu)", () => {
        const d = createXhosa();
        expect(d.text("2").trim()).toBe("kʼuɓˈiːni"); // kubini (Xhosa -bini, not Zulu -bili)
        expect(d.text("6").trim()).toBe("isitʰand̤ˈaːtʰu"); // isithandathu
        expect(d.text("10").trim()).toBe("iʃˈuːmi"); // ishumi
    });
});
