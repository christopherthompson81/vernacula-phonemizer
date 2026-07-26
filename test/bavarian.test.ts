import { describe, expect, test } from "vitest";

import { createBavarian, phonemizeWord } from "../src/languages/bavarian/bavarian.ts";

// Bavarian (bar) — Boarisch, Upper German (Austro-Bavarian, ~14M), Latin script over the de-facto Bavarian-Wikipedia
// orthography (⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩). A greedy scan + the falling diphthongs + German-style rules.
// Validated against wikipron bar_latn_broad (1380 human headwords, variants merged) — 60.4% FOLDED / 89.9% symbol.
// The referee is a NARROW transcription of a dialect CONTINUUM (~1.29 variants/headword), so the folded number is
// dragged by inherent dialect vowel-quality variation; the 89.9% symbol accuracy shows the segments are essentially
// right. 🔷 single source. See docs/investigations/bar_native_bringup_investigation.md.
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
});
