import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";

// Standard Malay (zsm) is an ALIAS to the Indonesian engine — a labelled approximation, NOT a bespoke module. Malay
// and Indonesian are mutually intelligible standardisations of the same Malayic language, sharing the reformed Latin
// orthography and largely the same grapheme→IPA phonology; there is NO independent Malay referee wired, and the
// documented differences (Malaysian final open ⟨a⟩ leaning to [ə], some vowel realisations) are accent-level, not a
// categorical grapheme→IPA delta. So `id` is its nearest verified sibling. This test locks the alias: zsm === id.
// If Standard Malay ever gets a referee + a documented delta, replace the alias (+ this test) with a bespoke module.
describe("Standard Malay (zsm) — alias to the Indonesian engine", () => {
    const zsm = getPhonemizer("zsm");
    const id = getPhonemizer("id");
    test("routes to id: identical IPA for Malay/Indonesian input", () => {
        for (const w of ["Malaysia", "bahasa", "selamat", "makan", "terima", "kasih"]) {
            expect(zsm.text(w)).toBe(id.text(w));
        }
    });
    test("produces the shared Malayic output (schwa ⟨e⟩, final consonants)", () => {
        expect(zsm.text("selamat")).toBe("səlˈamat"); // ⟨e⟩ → ə, final -t kept
    });
});
