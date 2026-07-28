import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/scottishgaelic/scottishgaelic.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Scottish Gaelic / Gàidhlig (gd) — Goidelic Celtic (sibling of Irish). The core is the
// BROAD/SLENDER axis (velarized/dental next to a/o/u, palatalized next to e/i) + the Scottish hallmarks:
// PRE-ASPIRATION (medial ⟨p t c⟩→[hp ht̪ xk]) and lenis ⟨b d g⟩→[p t̪ k]. Validated 67.0% symbol vs the
// MULTI-DIALECT wikipron gla_latn_broad (human, 6000; the folded % is a multi-dialect artifact). See
// docs/investigations/gd_native_bringup_investigation.md.
describe("Scottish Gaelic (Gàidhlig) canonical IPA", () => {
    test("★ PRE-ASPIRATION: medial/final ⟨p t c⟩ → [hp ht̪ xk]", () => {
        expect(phonemizeWord("mac")).toBe("mˈaxk"); // medial ⟨c⟩ pre-aspirates to [xk] (the SG signature)
        expect(phonemizeWord("cat")).toBe("kʰˈaht̪"); // initial ⟨c⟩→[kʰ] aspirated; final ⟨t⟩→[ht̪] pre-aspirated
        expect(phonemizeWord("cù")).toBe("kʰˈuː"); // initial fortis ⟨c⟩→[kʰ]; ù→[uː]
        expect(phonemizeWord("bochd")).toBe("pˈɔxk"); // ⟨chd⟩ → [xk] (the -achd class)
        expect(phonemizeWord("annta")).toBe("ˈan̪ˠt̪ə"); // NO pre-aspiration after a nasal (the fortis stays plain)
    });

    test("broad/slender axis + lenis ⟨b d g⟩→[p t̪ k] + lenition", () => {
        expect(phonemizeWord("geal")).toBe("kʲˈɛl̪ˠ"); // slender ⟨g⟩→[kʲ] (lenis); broad ⟨l⟩→[l̪ˠ]
        expect(phonemizeWord("balach")).toBe("pˈal̪ˠəx"); // lenis ⟨b⟩→[p]; ⟨ch⟩→[x]; unstressed a→[ə]
        expect(phonemizeWord("sgoil")).toBe("s̪kˈɔlʲ"); // broad ⟨s⟩→[s̪], ⟨g⟩→[k]; slender ⟨l⟩→[lʲ]
        expect(phonemizeWord("uisge")).toBe("ˈuʃkʲə"); // slender ⟨s⟩→[ʃ], ⟨g⟩→[kʲ]
    });

    test("vowels + lenition ⟨ch th⟩", () => {
        expect(phonemizeWord("mòr")).toBe("mˈɔːrˠ"); // ò→[ɔː]; broad ⟨r⟩→[rˠ]
        expect(phonemizeWord("each")).toBe("ˈɛx"); // ⟨ea⟩→[ɛ]; ⟨ch⟩→[x]
        expect(phonemizeWord("math")).toBe("mˈah"); // ⟨th⟩→[h]
    });

    test("registry wiring", () => {
        expect(getPhonemizer("gd").text("mac").trim()).toBe("mˈaxk");
    });
});
