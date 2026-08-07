import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords, phonemizeWord } from "../src/languages/scottishgaelic/scottishgaelic.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Scottish Gaelic / Gàidhlig (gd) — Goidelic Celtic (sibling of Irish). The core is the
// BROAD/SLENDER axis (velarized/dental next to a/o/u, palatalized next to e/i) + the Scottish hallmarks:
// PRE-ASPIRATION (medial ⟨p t c⟩→[hp ht̪ xk]) and lenis ⟨b d g⟩→[p t̪ k]. Validated 67.0% symbol vs the
// MULTI-DIALECT wikipron gla_latn_broad (human, 6000; the folded % is a multi-dialect artifact).
describe("Scottish Gaelic (Gàidhlig) canonical IPA", () => {
    test("PRE-ASPIRATION: medial/final ⟨p t c⟩ → [hp ht̪ xk]", () => {
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

// CARDINAL NUMBERS (src/languages/scottishgaelic/numbers.ts). Source: Colin Mark, *The Gaelic-English
// Dictionary* (2003), the numeral headwords + the decimal-tens series. The Goidelic shape mirrors Irish (two
// numeral series, the ⟨a⟩ particle, h- before a vowel, ⟨deug⟩ lenited after dhà) but Gaelic mutation is
// LENITION ONLY — ⟨dà⟩ lenites the magnitude it counts (dà cheud) and 3–10 leave it BARE (naoi ceud), where
// Irish would eclipse (naoi gcéad). The MODERN DECIMAL tens are used, not the traditional vigesimal series.
describe("Scottish Gaelic numbers", () => {
    for (const [n, expected] of [
        [0, "neoni"],                            // bare zero takes no ⟨a⟩ particle
        [1, "a h-aon"],                          // h- before the vowel-initial counting form
        [2, "a dhà"],                            // the counting form is itself lenited (attributive: dà)
        [8, "a h-ochd"],
        [11, "a h-aon deug"],
        [12, "a dhà dheug"],                     // ⟨deug⟩ lenites after dhà ONLY
        [13, "a trì deug"],
        [20, "fichead"],
        [21, "fichead agus a h-aon"],            // the tens↔units connector (written ⟨'s⟩, emitted as ⟨agus⟩)
        [25, "fichead agus a còig"],
        [40, "ceathrad"],                        // DECIMAL 40, not the vigesimal ⟨dà fhichead⟩
        [42, "ceathrad agus a dhà"],
        [99, "naochad agus a naoi"],
        [100, "ceud"],                           // bare magnitude — no ⟨aon⟩
        [101, "ceud agus a h-aon"],
        [200, "dà cheud"],                       // ⟨dà⟩ LENITES: ceud → cheud
        [300, "trì ceud"],                       // 3–10 leave the magnitude BARE
        [900, "naoi ceud"],                      // NO ECLIPSIS (Irish: naoi gcéad) — the gd/ga divergence
        [1000, "mìle"],
        [2000, "dà mhìle"],                      // mìle → mhìle after dà
        [1009, "mìle agus a naoi"],              // connector before a bare counting remainder
        [1998, "mìle naoi ceud naochad agus a h-ochd"],
        [1000000, "muillean"],
        [1000000000, "billean"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("21", "gd")).toBe("fˈiçət̪ ˈakəs̪ ˈa hˈɯːn̪ˠ"); // fichead agus a h-aon
        expect(phonemize("40", "gd")).toBe("kʲʰˈɛhrˠət̪"); // ceathrad — the DECIMAL forty
        expect(phonemize("2000", "gd")).toBe("t̪ˈaː vˈiːlʲə"); // dà mhìle — the lenited magnitude
    });
});
