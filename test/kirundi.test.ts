import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord as rn } from "../src/languages/kirundi/kirundi.ts";
import { numberToWords as rnNum } from "../src/languages/kirundi/numbers.ts";
import { phonemizeWord as rw } from "../src/languages/kinyarwanda/kinyarwanda.ts";
import { numberToWords as rwNum } from "../src/languages/kinyarwanda/numbers.ts";

// Canonical-IPA goldens for Kirundi / Ikirundi (rn) — Bantu (JD62, Rwanda-Rundi), Latin orthography.
// Kirundi is a NEAR-CLONE of Kinyarwanda (rw): it reuses the rw greedy g2p + the Cox comparative-grammar palatal
// series, with ONE confident delta — ⟨j⟩→d͡ʒ (the Kirundi voiced palatal affricate, vs Kinyarwanda's fricative
// ⟨j⟩→ʒ). Scores 91.7% folded vs epitran run-Latn (a crude, partly-circular referee we don't blindly follow —
// its unverified NC-spirantisation mp→mh/nt→nh/nk→ŋx is left as a residual). Tone (H/L, unwritten) deferred.
// See docs/investigations/rn_native_bringup_investigation.md.
describe("Kirundi canonical IPA — near-clone of Kinyarwanda with ⟨j⟩→d͡ʒ", () => {
    test("the ⟨j⟩ delta: Kirundi affricate d͡ʒ (vs Kinyarwanda fricative ʒ)", () => {
        expect(rn("ijana")).toBe("id͡ʒana"); // "hundred" — ⟨j⟩ → d͡ʒ
        expect(rn("jenoside")).toBe("d͡ʒenoside"); // ⟨j⟩ → d͡ʒ
        expect(rw("ijana")).toBe("iʒana"); // proof the parent differs (Kinyarwanda ʒ)
    });

    test("everything else is identical to Kinyarwanda (near-clone)", () => {
        for (const w of ["umuntu", "icyenda", "ubwenge", "kirundi", "abantu", "umunani"]) {
            expect(rn(w)).toBe(rw(w));
        }
    });

    test("shared signatures: ⟨cy⟩→kʲ palatalisation, ⟨ng⟩→ŋ, double vowel → long", () => {
        expect(rn("icyenda")).toBe("ikʲenda"); // "nine" — ⟨cy⟩ → kʲ
        expect(rn("ubwenge")).toBe("ubweŋe"); // "intelligence" — ⟨ng⟩ → ŋ (velar nasal)
        expect(rn("gatatu")).toBe("ɡatatu"); // "three"
    });
});

// Kirundi cardinal numbers. The COMPOSITOR is shared with Kinyarwanda (kinyarwanda/numbers.ts exports
// `composeRwandaRundi`, which kirundi/numbers.ts calls with the Kirundi table) — the near-clone relationship holds
// for the numeral morphology too. Sources: Omniglot "Numbers in Kirundi" (omniglot.com/language/numbers/kirundi.htm)
// and languagesandnumbers.com/how-to-count-in-rundi (run). Kirundi deltas vs rw: 7 indwi, 9 icenda (no ⟨cy⟩),
// 20 the regular mirongo ibiri, plural of ijana = amajana, 10⁶ = umuriyoni.
describe("Kirundi numbers", () => {
    test("units — the Kirundi 7 / 9 deltas", () => {
        expect(rnNum(7)).toBe("indwi"); // not the Kinyarwanda karindwi
        expect(rnNum(8)).toBe("umunani"); // invariable, same as rw
        expect(rnNum(9)).toBe("icenda"); // Kirundi has no ⟨cy⟩
        expect(rwNum(9)).toBe("icyenda"); // proof the parent differs
        expect(phonemize("9", "rn")).toBe("it͡ʃenda");
    });

    test("tens — mirongo + the i- series; 20 is REGULAR (unlike rw makumyabiri)", () => {
        expect(rnNum(18)).toBe("icumi na umunani");
        expect(rnNum(20)).toBe("mirongo ibiri");
        expect(rwNum(20)).toBe("makumyabiri"); // the rw irregular, for contrast
        expect(rnNum(42)).toBe("mirongo ine na kabiri");
        expect(rnNum(80)).toBe("mirongo inani");
        expect(phonemize("20", "rn")).toBe("miɾoŋo ibiɾi");
    });

    test("hundreds — ijana / amajana + the class-6 a- series", () => {
        expect(rnNum(100)).toBe("ijana");
        expect(rnNum(200)).toBe("amajana abiri"); // rw has magana
        expect(rnNum(555)).toBe("amajana atanu na mirongo itanu na gatanu");
        expect(phonemize("200", "rn")).toBe("amad͡ʒana abiɾi"); // the ⟨j⟩→d͡ʒ delta again
    });

    test("thousands and millions", () => {
        expect(rnNum(1000)).toBe("igihumbi");
        expect(rnNum(2000)).toBe("ibihumbi bibiri");
        expect(rnNum(12345)).toBe("ibihumbi icumi na kabiri na amajana atatu na mirongo ine na gatanu");
        expect(rnNum(1000000)).toBe("umuriyoni"); // rw: miriyoni
        expect(phonemize("1000000", "rn")).toBe("umuɾijoni");
    });
});
