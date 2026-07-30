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

    // NUMBERS above kámá. Two defects: there was no ZERO word at all (0 leaked the digit), and everything ≥ 1 000
    // ran through `ordinals[Math.min(th, 10) - 1]`, clamping the thousand-multiplier at ten — so 100 000, 10⁶ and
    // 10⁹ all produced the identical "kóto zómi". Lingala's higher scales are native class-alternating nouns on a
    // myriad ladder (10⁴ mokoko/mikoko · 10⁵ elúndu/bilúndu · 10⁶ efúku/bifúku · 10⁹ epúná/bipúná), the singular
    // standing alone for a multiplier of one. Source: lingalavision.com "How to count in Lingala from 0 to
    // millions" + Omniglot "Numbers in Lingala" (libungutulu = 0). See lingala.jsonc.
    test("zero + the native scale ladder (10⁴ mokoko … 10⁹ epúná)", () => {
        const ln = getPhonemizer("ln");
        expect(ln.text("0").trim()).toBe("li˩bu˩ᵑɡu˩tu˥lu˩"); // libungutúlu — was a DIGIT-LEAK
        expect(ln.text("21").trim()).toBe("tu˥ku˥ mi˥ba˩le˥ na˩ mo˩˥ko˥"); // túkú míbalé na mǒkó
        expect(ln.text("101").trim()).toBe("ka˥ma˥ mo˩˥ko˥ na˩ mo˩˥ko˥"); // kámá mǒkó na mǒkó
        expect(ln.text("1000").trim()).toBe("ko˥to˩ mo˩˥ko˥"); // kóto is INVARIANT — always + multiplier
        expect(ln.text("10000").trim()).toBe("mo˩ko˩ko˩"); // mokoko (singular, multiplier 1)
        expect(ln.text("20000").trim()).toBe("mi˩ko˩ko˩ mi˥ba˩le˥"); // mikoko míbalé (plural + multiplier)
        expect(ln.text("100000").trim()).toBe("e˩lu˥ⁿdu˩"); // elúndu — was shared with 10⁶ and 10⁹
        expect(ln.text("1000000").trim()).toBe("e˩fu˥ku˩"); // efúku
        expect(ln.text("2000000").trim()).toBe("bi˩fu˥ku˩ mi˥ba˩le˥"); // bifúku míbalé
        expect(ln.text("1000000000").trim()).toBe("e˩pu˥na˥"); // epúná
    });
});
