import { describe, expect, test } from "vitest";

import { createEstonian, phonemizeWord } from "../src/languages/estonian/estonian.ts";

// Estonian (et, eesti keel) — Uralic (Finnic, ~1.1M), sibling of Finnish. A greedy phonemic grapheme scan +
// gemination (double letter → [Cː]/[Vː]) + FIXED first-syllable stress. Estonian specifics: ⟨b d g⟩ are the
// voiceless-lenis stops → plain b/d/ɡ, the 9 vowels incl. ⟨õ⟩→ɤ ⟨ä ö ü⟩→æ ø y, NO n→ŋ. Palatalization + the
// three-way QUANTITY (half-long) are only partially orthographic → folded in the referee eval (94.0% folded /
// 98.5% symbol vs wikipron est_latn_broad, 2,773 headwords). See docs/investigations/et_native_bringup_investigation.md.
describe("Estonian canonical IPA — Finnic greedy g2p + gemination + first-syllable stress", () => {
    const et = createEstonian();

    test("the 9 vowels (õ→ɤ, ä→æ, ö→ø, ü→y, a→ɑ) + diphthongs", () => {
        expect(phonemizeWord("õun")).toBe("ˈɤun"); // ⟨õ⟩ → ɤ, ⟨õu⟩ diphthong
        expect(phonemizeWord("külm")).toBe("kˈylm"); // ⟨ü⟩ → y
        expect(phonemizeWord("töö")).toBe("tˈøː"); // ⟨ö⟩ → ø, doubled → long
        expect(phonemizeWord("kõik")).toBe("kˈɤik"); // ⟨õ⟩ + ⟨õi⟩ diphthong
        expect(phonemizeWord("pea")).toBe("pˈeɑ"); // ⟨ea⟩ two vowels, stress on the first
    });

    test("gemination (double letter → long) — but a double consonant after a consonant is a CLUSTER (compound)", () => {
        expect(phonemizeWord("kass")).toBe("kˈɑsː"); // ⟨ss⟩ after a vowel → geminate [sː]
        expect(phonemizeWord("tikk")).toBe("tˈikː"); // ⟨kk⟩ → [kː]
        expect(phonemizeWord("raamat")).toBe("rˈɑːmɑt"); // ⟨aa⟩ → long [ɑː]
        expect(phonemizeWord("keskkool")).toBe("kˈeskkoːl"); // kesk+kool: the ⟨kk⟩ after ⟨s⟩ stays a CLUSTER, not [kː]
    });

    test("⟨b d g⟩ voiceless-lenis → b/d/ɡ; NO n→ŋ; fixed first-syllable stress", () => {
        expect(phonemizeWord("Eesti")).toBe("ˈeːsti"); // first-syllable stress, ee→long
        expect(phonemizeWord("linn")).toBe("lˈinː"); // ⟨n⟩ stays n (no velarization)
        expect(phonemizeWord("õpetaja")).toBe("ˈɤpetɑjɑ"); // stress on the first syllable even when it's a bare vowel
    });

    test("cardinal numbers: tens (kakskümmend), hundreds (kakssada), teens (üksteist)", () => {
        expect(et.text("11").trim()).toBe("ˈyksteist"); // üksteist
        expect(et.text("21").trim()).toBe("kˈɑkskymːend ˈyks"); // kakskümmend üks
        expect(et.text("234").trim()).toBe("kˈɑkssɑdɑ kˈolmkymːend nˈeli"); // kakssada kolmkümmend neli
        expect(et.text("2000").trim()).toBe("kˈɑks tˈuhɑt"); // kaks tuhat
        expect(et.text("1000000").trim()).toBe("ˈyks mˈiljon"); // üks miljon (keeps the numeral, unlike tuhat)
    });

    test("loan letters nativized (c→k, x→ks, w→v, y→i) + accented vowels via text()", () => {
        expect(phonemizeWord("taxi")).toBe("tˈɑksi"); // ⟨x⟩ → ks
        expect(et.text("Aragón").trim()).toBe("ˈɑrɑɡon"); // ⟨ó⟩ read (not split/dropped) via text()
    });

    test("clause assembly", () => {
        expect(et.text("Tere, Eesti!").trim()).toBe("tˈere , ˈeːsti !");
    });
});
