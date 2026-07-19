import { describe, expect, test } from "vitest";

import { phonemizeWord as rn } from "../src/languages/kirundi/kirundi.ts";
import { phonemizeWord as rw } from "../src/languages/kinyarwanda/kinyarwanda.ts";

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
