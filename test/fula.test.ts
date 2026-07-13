import { describe, expect, it } from "vitest";
import { phonemizeWord } from "../src/languages/fula/fula.ts";

describe("Fula g2p (authored)", () => {
    it("implosives, prenasalized digraphs, geminates, length", () => {
        expect(phonemizeWord("ɓiɗɗo")).toBe("ɓˈiɗːo"); // implosive ɓ, geminate ɗɗ→ɗː
        expect(phonemizeWord("ƴiiƴam")).toBe("ʄˈiːʄam"); // ƴ→ʄ (implosive), long ii→iː
        expect(phonemizeWord("ngol")).toBe("ᵑɡˈol"); // prenasalized ng→ᵑɡ
        expect(phonemizeWord("njamndi")).toBe("ⁿd͡ʒˈamⁿdi"); // nj→ⁿd͡ʒ, nd→ⁿd
        expect(phonemizeWord("koŋgol")).toBe("kˈoŋɡol"); // ŋ + g (not the ng digraph)
        expect(phonemizeWord("debbo")).toBe("dˈebːo"); // geminate bb→bː
        expect(phonemizeWord("moƴƴude")).toBe("moʄːˈude"); // geminate ƴƴ→ʄː
    });

    it("penultimate stress", () => {
        expect(phonemizeWord("Fulfulde")).toBe("fulfˈulde"); // 3 syllables → penult
        expect(phonemizeWord("tati")).toBe("tˈati"); // 2 syllables → first (penult)
        expect(phonemizeWord("gorko")).toBe("ɡˈoɾko"); // r→ɾ
    });
});
