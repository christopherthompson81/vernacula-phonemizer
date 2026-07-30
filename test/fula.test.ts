import { describe, expect, it } from "vitest";
import { createFula, phonemizeWord } from "../src/languages/fula/fula.ts";
import { numberToWords } from "../src/languages/fula/numbers.ts";

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

    it("Adlam (𞤀𞤁𞤂𞤃) front-end — transliterates to Boko, IDENTICAL IPA to the Latin path", () => {
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe("fˈulɓe"); // Fulɓe (the people); bhe→ɓ
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe(phonemizeWord("Fulɓe")); // Adlam ≡ Latin
        expect(phonemizeWord("𞤆𞤵𞤤𞤢𞥄𞤪")).toBe("pˈulaːɾ"); // Pulaar — the ALIF LENGTHENER (𞥄) → long aː
        expect(phonemizeWord("𞤂𞤢𞥄𞤥𞤯𞤮")).toBe("lˈaːmɗo"); // laamɗo "chief" — lengthener + implosive ɗ (dha)
        expect(phonemizeWord("𞤁𞤫𞤦𞥆𞤮")).toBe("dˈebːo"); // debbo — the GEMINATION MARK (𞥆) → long bː
    });

    // NUMBERS — QUINARY (base-5) below ten, DECIMAL above it, with a vigesimal relic at 20: 6–9 are 5+n
    // compounds on jee- < jowi 'five', noogaas 20 is its own lexeme (< 'it is finished' — fingers AND toes),
    // and 30–90 are cappanɗe (the ƊE plural of sappo, with s→c mutation) + a multiplier that may itself be
    // quinary (cappanɗe jeetati = 10×(5+3) = 80). Slots join with the comitative e. Magnitude nouns go to their
    // plural when multiplied (teemedere → teemedde, ujundere → ujunaaje). Lect: Pulaar Futa-Tooro.
    // Sources: Kosogorova 2023 (SALC 57) §2.1–2.2, Peace Corps/Mauritania "Introduction to Pulaar", Omniglot.
    // See src/languages/fula/numbers.ts.
    it("numbers: the QUINARY 6–9 (jee- + n)", () => {
        expect(numberToWords(5)).toBe("joyi");
        expect(numberToWords(6)).toBe("jeegom"); // 5+1
        expect(numberToWords(7)).toBe("jeeɗiɗi"); // 5+2
        expect(numberToWords(8)).toBe("jeetati"); // 5+3
        expect(numberToWords(9)).toBe("jeenayi"); // 5+4
    });

    it("numbers: sappo / noogaas / cappanɗe tens + the comitative e", () => {
        expect(numberToWords(10)).toBe("sappo");
        expect(numberToWords(11)).toBe("sappo e goo");
        expect(numberToWords(20)).toBe("noogaas"); // a lexeme, not 2×10
        expect(numberToWords(21)).toBe("noogaas e goo");
        expect(numberToWords(42)).toBe("cappanɗe nayi e ɗiɗi"); // 10×4 + 2
        expect(numberToWords(80)).toBe("cappanɗe jeetati"); // 10×(5+3) — quinary multiplier
        expect(numberToWords(99)).toBe("cappanɗe jeenayi e jeenayi");
    });

    it("numbers: teemedere/ujundere and their ƊE plurals; the borrowed million/milyar", () => {
        expect(numberToWords(100)).toBe("teemedere"); // singular, bare
        expect(numberToWords(101)).toBe("teemedere e goo");
        expect(numberToWords(555)).toBe("teemedde joyi e cappanɗe joyi e joyi"); // plural when multiplied
        expect(numberToWords(1000)).toBe("ujundere");
        expect(numberToWords(12345)).toBe("ujunaaje sappo e ɗiɗi e teemedde tati e cappanɗe nayi e joyi");
        expect(numberToWords(1_000_000)).toBe("million");
        expect(numberToWords(2_000_000)).toBe("milionji ɗiɗi");
        expect(numberToWords(1_000_000_000)).toBe("milyar");
    });

    it("numbers: both registered scripts — Adlam digits (𞥐–𞥙) ≡ ASCII", () => {
        const ff = createFula();
        expect(ff.text("7")).toBe("d͡ʒeːɗˈiɗi"); // jeeɗiɗi — long ee→eː, implosive ɗ, penultimate stress
        expect(ff.text("𞥗")).toBe(ff.text("7")); // Adlam digits fold to ASCII → identical IPA
    });
});
