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

    // As Zulu: three distinct unit series — standalone ku-, connective na-, multiplier ama-. Source: xhosa.jsonc
    // "numbers". Regression note: 13/15/23/25/… were once reported as failures by a number-audit probe whose
    // sentinel regex was case-insensitive and matched the legitimate na- forms "NANtathu"/"NANhlanu" as "NaN".
    test("numbers — the na- connective series (units 3 and 5) is intact, plus magnitudes", () => {
        const d = createXhosa();
        expect(d.text("3").trim()).toBe("kʼutʰˈaːtʰu"); // kuthathu — standalone ku-
        expect(d.text("5").trim()).toBe("kʼuɬˈaːnu"); // kuhlanu
        expect(d.text("13").trim()).toBe("iʃˈuːmi nantʼˈaːtʰu"); // ishumi nantathu — connective na-
        expect(d.text("15").trim()).toBe("iʃˈuːmi nanɬˈaːnu"); // ishumi nanhlanu
        expect(d.text("21").trim()).toBe("amaʃˈuːmi amaɓˈiːni nˈaːɲɛ"); // amashumi amabini nanye
        expect(d.text("555").trim()).toBe("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu");
        expect(d.text("2000").trim()).toBe("amawˈaːkʼa amaɓˈiːni"); // amawaka amabini
        expect(d.text("1000000").trim()).toBe("isiɡ̤ˈiːd̤i"); // isigidi
    });
});
