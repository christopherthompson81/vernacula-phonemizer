import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nama/nama.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Nama / Khoekhoe (naq) — Khoekhoegowab, a Khoe-Kwadi language; the fleet's FIRST CLICK
// language. The hallmark is the four click TYPES ⟨ǀ⟩ (dental), ⟨ǁ⟩ (lateral), ⟨ǂ⟩ (palatal), ⟨ǃ⟩ (alveolar) × the
// ACCOMPANIMENTS: bare→[ᵑ̊_ˀ] (glottalised nasal), ⟨g⟩→[ᵏ_] (tenuis), ⟨kh⟩→[ᵏ_ʰ] (aspirated), ⟨h⟩→[ᵑ̊_ʰ], ⟨n⟩→[ᵑ_]
// (voiced nasal). Referee: English Wiktionary "Khoekhoe terms with IPA pronunciation".
describe("Nama (Khoekhoe) canonical IPA", () => {
    test("THE CLICK SYSTEM — the dental ⟨ǀ⟩ series × 5 accompaniments", () => {
        expect(phonemizeWord("ǀ")).toBe("ᵑ̊ǀˀ"); // BARE click → the glottalised nasal click
        expect(phonemizeWord("ǀg")).toBe("ᵏǀ"); // ⟨g⟩ → tenuis [ᵏǀ]
        expect(phonemizeWord("ǀkh")).toBe("ᵏǀʰ"); // ⟨kh⟩ → aspirated [ᵏǀʰ]
        expect(phonemizeWord("ǀh")).toBe("ᵑ̊ǀʰ"); // ⟨h⟩ → aspirated nasal [ᵑ̊ǀʰ]
        expect(phonemizeWord("ǀn")).toBe("ᵑǀ"); // ⟨n⟩ → voiced nasal [ᵑǀ]
    });

    test("the four click PLACES (bare = glottalised nasal at each place)", () => {
        expect(phonemizeWord("ǀ")).toBe("ᵑ̊ǀˀ"); // dental
        expect(phonemizeWord("ǁ")).toBe("ᵑ̊ǁˀ"); // lateral
        expect(phonemizeWord("ǂ")).toBe("ᵑ̊ǂˀ"); // palatal
        expect(phonemizeWord("ǃ")).toBe("ᵑ̊ǃˀ"); // alveolar
    });

    test("clicks in real words + ⟨kh⟩, ⟨g⟩→[x], final ⟨-b⟩→[p], long vowels", () => {
        expect(phonemizeWord("ǀgama")).toBe("ᵏǀama"); // ⟨ǀg⟩ tenuis click in a word
        expect(phonemizeWord("ǂkhoab")).toBe("ᵏǂʰoap"); // ⟨ǂkh⟩ aspirated; final ⟨-b⟩→[p]
        expect(phonemizeWord("ǃkhās")).toBe("ᵏǃʰaːs"); // ⟨ǃkh⟩; macron ⟨ā⟩ → long [aː]
        expect(phonemizeWord("kharob")).toBe("kʰarop"); // ⟨kh⟩→[kʰ]; final ⟨-b⟩→[p]
        expect(phonemizeWord("Khoekhoegowab")).toBe("kʰoekʰoexowap"); // ⟨g⟩ (not after a click) → [x]; ⟨w⟩→[w]
    });

    test("nasalized (circumflex) vowels + doubled-vowel length", () => {
        expect(phonemizeWord("ǂgâ")).toBe("ᵏǂã"); // 'enter' — ⟨â⟩ → nasalized [ã] (phonemic in Nama)
        expect(phonemizeWord("ǀî")).toBe("ᵑ̊ǀˀĩ"); // bare click + nasal [ĩ]
        expect(phonemizeWord("khoraab")).toBe("kʰoraːp"); // doubled ⟨aa⟩ → long [aː]; final ⟨-b⟩→[p]
    });

    // ═══ CARDINAL NUMBERS — NATIVE Khoe decimal to 999 999, with the two naturalised loan magnitudes miljun/
    // biljun that published Khoekhoegowab actually uses. Sources in src/languages/nama/numbers.ts.
    test("cardinals: solid disi compounds; the tens multiplier starts at TWO", () => {
        const naq = getPhonemizer("naq");
        expect(naq.text("1").trim()).toBe("ᵏǀui"); // ǀgui — ⟨ǀg⟩ is the TENUIS click [ᵏǀ]
        expect(naq.text("7").trim()).toBe("hũ"); // hû — the circumflex is NASALITY, not tone
        expect(naq.text("20").trim()).toBe("ᵏǀamdisi"); // ǀgamdisi — 'two-ten'; never *ǀguidisi
        expect(naq.text("26").trim()).toBe("ᵏǀamdisiᵑǃaniᵑ̊ǀˀa"); // ǀgamdisiǃnaniǀa — the ATTESTED worked example
        expect(naq.text("42").trim()).toBe("hakadisiᵏǀamᵑ̊ǀˀa"); // hakadisiǀgamǀa
        expect(naq.text("100").trim()).toBe("kaidisi"); // kaidisi
        expect(naq.text("1000").trim()).toBe("ᵑ̊ǀˀoadisi"); // ǀoadisi — bare ⟨ǀ⟩ = the glottalised nasal click
    });

    test("cardinals: naturalised loan magnitudes; ZERO is deliberately UNSPOKEN (not attested)", () => {
        const naq = getPhonemizer("naq");
        expect(naq.text("555").trim()).toBe("korokaidisi korodisikoroᵑ̊ǀˀa"); // korokaidisi korodisikoroǀa
        expect(naq.text("12345").trim()).toBe("disiᵏǀamᵑ̊ǀˀa ᵑ̊ǀˀoadisi ᵑǃonakaidisi hakadisikoroᵑ̊ǀˀa");
        // 10⁶/10⁹ are the loans New Era's Khoekhoegowab pages actually print ("N$47 miljunsa", "N$1 biljunmaris");
        // Omniglot's ǀoadisiǀoadisi for a million is NOT shipped (single unvetted contributor).
        expect(naq.text("1000000").trim()).toBe("miljun");
        expect(naq.text("1000000000").trim()).toBe("biljun");
        // ⚠ ZERO: no Khoekhoegowab zero could be sourced (Wiktionary Category:Khoekhoe numerals, Omniglot, the UD
        // treebank, a full-text grep of the Peace Corps manual, ~3 MB of New Era text — all clean negatives). We
        // emit the Afrikaans contact-loan STOPGAP `nul` rather than nothing, because silence would lose the
        // character with no downstream signal. It is flagged as a loan in numbers.ts, NOT as a Nama numeral.
        expect(naq.text("0").trim()).toBe("nul");
    });
});
