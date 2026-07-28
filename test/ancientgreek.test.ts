import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/ancientgreek/ancientgreek.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Ancient Greek / Ἑλληνική (grc) — the reconstructed 5th-c. BCE CLASSICAL ATTIC
// pronunciation (Allen, Vox Graeca), polytonic Greek script. The aspirates θ φ χ→[tʰ pʰ kʰ], ζ→[zd], η/ω long
// mid, υ→[y], diphthongs, γ-nasal, rough breathing→[h], pitch accent. Validated 99.4% folded / 99.7% symbol vs
// wikipron grc (human, {{grc-IPA}} Attic row, 33709). See docs/investigations/grc_native_bringup_investigation.md.
describe("Ancient Greek (Attic) canonical IPA", () => {
    test("aspirates θ/φ/χ + long η/ω + the γ-nasal", () => {
        expect(phonemizeWord("λόγος")).toBe("lóɡos"); // γ→[ɡ]
        expect(phonemizeWord("ἄνθρωπος")).toBe("ántʰrɔːpos"); // θ→[tʰ], ω→[ɔː]
        expect(phonemizeWord("θεός")).toBe("tʰeós"); // θ→[tʰ]; the acute stays on the ⟨ο⟩
        expect(phonemizeWord("ἄγγελος")).toBe("áŋɡelos"); // ⟨γγ⟩→[ŋɡ] (the γ-nasal)
    });

    test("rough breathing → [h], diphthongs, υ→[y], ζ/ξ/ψ", () => {
        expect(phonemizeWord("ἵππος")).toBe("híppos"); // ROUGH BREATHING → prefixed [h]
        expect(phonemizeWord("αὐτός")).toBe("au̯tós"); // ⟨αυ⟩→[au̯] diphthong
        expect(phonemizeWord("ψυχή")).toBe("psykʰɛː́"); // ⟨ψ⟩→[ps], ⟨υ⟩→[y], ⟨χ⟩→[kʰ], ⟨η⟩→[ɛː]
        expect(phonemizeWord("ζῷον")).toBe("zdɔːí̯on"); // ⟨ζ⟩→[zd]; iota subscript ⟨ῳ⟩→[ɔːi̯] (circumflex on it)
    });

    test("σ→[z] before a voiced consonant + aspirate assimilation", () => {
        expect(phonemizeWord("Λέσβια")).toBe("lézbia"); // ⟨σ⟩→[z] before ⟨β⟩
        expect(phonemizeWord("Βάκχε")).toBe("bákʰkʰe"); // ⟨κχ⟩→[kʰkʰ] (aspirate assimilation)
        expect(phonemizeWord("ῥήτωρ")).toBe("r̥ɛː́tɔːr"); // word-initial ⟨ῥ⟩ → the VOICELESS [r̥]
    });

    test("registry wiring", () => {
        expect(getPhonemizer("grc").text("λόγος").trim()).toBe("lóɡos");
    });
});
