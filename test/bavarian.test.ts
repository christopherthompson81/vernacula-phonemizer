import { describe, expect, test } from "vitest";

import { createBavarian, phonemizeWord } from "../src/languages/bavarian/bavarian.ts";
import { numberToWords } from "../src/languages/bavarian/numbers.ts";

// Bavarian (bar) — Boarisch, Upper German (Austro-Bavarian, ~14M), Latin script over the de-facto Bavarian-Wikipedia
// orthography (⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩). A greedy scan + the falling diphthongs + German-style rules.
// Referee: wikipron bar_latn_broad (human, variants merged). ⚠ It is a NARROW transcription of a dialect
// CONTINUUM (~1.29 variants/headword), so its folded score is dragged down by inherent dialect vowel-quality
// variation rather than by the engine — symbol accuracy is the meaningful reading here. It is also the ONLY
// referee for bar, so there is no independent second opinion.
describe("Bavarian canonical IPA — greedy g2p + falling diphthongs + fortis/lenis neutralization", () => {
    const bar = createBavarian();

    test("the FALLING diphthongs ⟨ia ua oa⟩→[iɐ̯ uɐ̯ oɐ̯] + closing ⟨au⟩→[ɑɔ̯], ⟨oi⟩→[oe]", () => {
        expect(phonemizeWord("Boarisch")).toBe("b̥oɐ̯riʃ"); // ⟨oa⟩→oɐ̯, ⟨sch⟩→ʃ ("Bavarian")
        expect(phonemizeWord("Biaschtl")).toBe("b̥iɐ̯ʃd̥l"); // ⟨ia⟩→iɐ̯, lenis ⟨t⟩→d̥
        expect(phonemizeWord("Aug")).toBe("ɑɔ̯ɡ̥"); // ⟨au⟩→ɑɔ̯, lenis ⟨g⟩→ɡ̥ ("eye")
        expect(phonemizeWord("Foi")).toBe("foe"); // ⟨oi⟩→oe (l-vocalization, "fall/case")
    });

    test("fortis/lenis neutralization: ⟨t p⟩→[d̥ b̥] unconditionally, ⟨k⟩→[ɡ̥] non-initially", () => {
        expect(phonemizeWord("Taag")).toBe("d̥aːɡ̥"); // ⟨t⟩→d̥ word-initial, ⟨aa⟩→aː ("day")
        expect(phonemizeWord("Klass")).toBe("ɡ̥lɑs"); // initial ⟨k⟩ before a liquid lenites → ɡ̥, ⟨ss⟩→s
        expect(phonemizeWord("Bånk")).toBe("b̥ɔŋɡ̥"); // ⟨å⟩→ɔ, coda ⟨k⟩→ɡ̥, ⟨n⟩→ŋ before the velar ("bench/bank")
    });

    test("r-vocalization + final-⟨a⟩ reduction + the ⟨gn⟩ coda coalescence", () => {
        expect(phonemizeWord("Bana")).toBe("b̥ɑnɐ"); // final unstressed ⟨-a⟩→ɐ ("banana"-type)
        expect(phonemizeWord("Wåssa")).toBe("ʋɔsɐ"); // ⟨w⟩→ʋ, ⟨å⟩→ɔ, ⟨ss⟩→s, final ⟨a⟩→ɐ ("water")
        expect(phonemizeWord("Regn")).toBe("reŋ"); // word-final ⟨gn⟩ → ŋ ("rain")
    });

    test("post-vocalic ⟨h⟩ is silent (a length marker); ⟨ch⟩ front/back split", () => {
        expect(phonemizeWord("Fruah")).toBe("fruɐ̯"); // ⟨ua⟩→uɐ̯, post-vocalic ⟨h⟩ silent ("early")
        expect(phonemizeWord("Fühn")).toBe("fyn"); // ⟨ü⟩→y, medial post-vocalic ⟨h⟩ silent
        expect(phonemizeWord("Dånkschee")).toBe("d̥ɔŋɡ̥ʃeː"); // ⟨å⟩→ɔ, ⟨nk⟩→ŋɡ̥, ⟨sch⟩→ʃ, ⟨ee⟩→eː ("thank you")
    });

    test("clause assembly", () => {
        expect(bar.text("I bin a Boar.").trim()).toBe("i b̥in ɑ b̥oɐ̯ɐ̯ .");
    });

    // CARDINAL NUMBERS — units-FIRST like German but with the connector reduced from ⟨und⟩ to a bare linking ⟨-a-⟩
    // (oanazwånzg = 21, zwoarazwånzg = 22 with the hiatus-breaking ⟨r⟩). Source: omniglot Bairisch cardinals; since
    // Bavarian has no codified orthography, the ⟨å⟩ Bavarian-Wikipedia variants and the ⟨-e⟩-less stems were chosen,
    // and magnitudes are written OPEN (a closed *dreihundad would lose its ⟨h⟩ to the silent post-vocalic-h rule).
    // See src/languages/bavarian/numbers.ts.
    test("numbers: units-first with the reduced ⟨-a-⟩ linker", () => {
        expect(numberToWords(0)).toBe("null");
        expect(numberToWords(21)).toBe("oanazwånzg"); // compound stem oan- (not oans-)
        expect(numberToWords(22)).toBe("zwoarazwånzg"); // compound stem zwoar- (hiatus ⟨r⟩)
        expect(numberToWords(45)).toBe("fimfafiazg");
        expect(numberToWords(99)).toBe("neinaneinzg");
        expect(numberToWords(100)).toBe("hundad");
        expect(numberToWords(555)).toBe("fimf hundad fimfafuchzg");
        expect(numberToWords(1000)).toBe("dausnd");
        expect(numberToWords(12345)).toBe("zwöif dausnd drei hundad fimfafiazg");
        expect(numberToWords(1000000)).toBe("oa Million");
        expect(numberToWords(1000000000)).toBe("oa Milliarde");
    });

    test("numbers: wired into the phonemizer", () => {
        expect(bar.text("21").trim()).toBe("oɐ̯nɑt͡sʋɔnt͡sɡ̥"); // oanazwånzg
        expect(bar.text("555").trim()).toBe("fimf hund̥ɑd̥ fimfɑfuxt͡sɡ̥");
    });

});
