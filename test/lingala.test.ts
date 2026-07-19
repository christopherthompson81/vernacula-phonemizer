import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/lingala/lingala.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Lingala / Lingála (ln) — Bantu (C30B), a major lingua franca of the Congo (~20M native
// + ~20-25M L2). Authored from Meeuwis (2020) "A Grammatical Overview of Lingála" (Revised & Extended Edition,
// describing the prestige Kinshasa variety). Signatures: PRENASALISED obstruents as single onset units
// (⟨mb nd ng nz⟩ → ᵐb ⁿd ᵑɡ ⁿz, homorganic), ⟨ny⟩ → ɲ, and — unlike the fleet's other Bantu languages — TONE is
// WRITTEN (acute=H, háček=rising, circumflex=falling, unmarked=L) so it is rendered per nucleus (Chao letters).
// No diphthongs (vowel sequences are hiatus, each a tone-bearing nucleus). Anchored on kaikki Lingala (97% folded,
// tone MEASURED not folded). See docs/investigations/ln_native_bringup_investigation.md.
describe("Lingala canonical IPA", () => {
    test("prenasalised obstruents as single onset units (homorganic)", () => {
        expect(phonemizeWord("mbɔ́tɛ")).toBe("ᵐbɔ˥tɛ˩"); // mb → ᵐb ("hello")
        expect(phonemizeWord("ndáko")).toBe("ⁿda˥ko˩"); // nd → ⁿd ("house")
        expect(phonemizeWord("nzóto")).toBe("ⁿzo˥to˩"); // nz → ⁿz ("body")
        expect(phonemizeWord("Lingála")).toBe("li˩ᵑɡa˥la˩"); // ng → ᵑɡ (the language's own name)
    });

    test("⟨ny⟩ → ɲ; 7-vowel graphemes rendered as written", () => {
        expect(phonemizeWord("nyama")).toBe("ɲa˩ma˩"); // ny → ɲ ("animal")
        expect(phonemizeWord("mabelé")).toBe("ma˩be˩le˥"); // L L H ("earth")
    });

    test("TONE is written and rendered per nucleus (H=˥, L=˩) — the tonal minimal pair", () => {
        expect(phonemizeWord("moto")).toBe("mo˩to˩"); // L L "person"
        expect(phonemizeWord("motó")).toBe("mo˩to˥"); // L H "head"
    });

    test("no diphthongs — final V+i is hiatus, each vowel its own tone-bearing nucleus", () => {
        expect(phonemizeWord("mái")).toBe("ma˥i˩"); // ma.i, not a diphthong ("water")
    });

    test("full text via the registry (numbers + tone + prenasalisation)", () => {
        const ln = getPhonemizer("ln");
        expect(ln.text("2").trim()).toBe("mi˥ba˩le˥"); // míbalé
        expect(ln.text("Mbɔ́tɛ!").trim()).toBe("ᵐbɔ˥tɛ˩  !");
    });
});
