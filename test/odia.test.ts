import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/odia/odia.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Odia / ଓଡ଼ିଆ (or) — Eastern Indo-Aryan, Odia Brahmic abugida read by the generic
// engine like the Dravidian trio: NO inherent-vowel deletion, inherent vowel /ɔ/ (ଘର→ɡʱɔɾɔ), like Bengali. Odia
// has NO phonemic vowel length. Distinctive: SIBILANT MERGER ଶ/ଷ/ସ→[s] (ଭାଷା→bʱasa), the retroflex flap ଡ଼→ɽ,
// ଳ→ɭ, dental t̪ d̪ n̪. Validated at 98.3% vs kaikki ori (folded). See docs/or_native_bringup_investigation.md.
describe("Odia canonical IPA", () => {
    test("inherent vowel /ɔ/ retained (no schwa deletion) + retroflex flap ଡ଼→ɽ", () => {
        expect(phonemizeWord("ଓଡ଼ିଆ")).toBe("ˈoɽia"); // 'Odia' — ଡ଼ → ɽ (flap)
        expect(phonemizeWord("ଘର")).toBe("ɡʱˈɔɾɔ"); // 'house' — final inherent ɔ retained (cf. Hindi ɡʱəɾ)
        expect(phonemizeWord("ଭାରତ")).toBe("bʱˈaɾɔt̪ɔ"); // 'India' — every akshara pronounced
    });

    test("sibilant merger ଶ/ଷ/ସ → [s], ଳ→ɭ, dental n̪", () => {
        expect(phonemizeWord("ଭାଷା")).toBe("bʱˈasa"); // ଷ → s (no /ʃ/)
        expect(phonemizeWord("କଳିଙ୍ଗ")).toBe("kˈɔɭiŋɡɔ"); // 'Kalinga' — ଳ→ɭ, ଙ୍ଗ→ŋɡ
        expect(phonemizeWord("ନୂତନ")).toBe("n̪ˈut̪ɔn̪ɔ"); // 'new' — dental n̪, no vowel length (ୂ→u)
    });

    test("nasalisation (chandrabindu) + conjunct palatal nasal", () => {
        expect(phonemizeWord("ମୁଁ")).toBe("mˈũ"); // 'I' — chandrabindu nasalises
        expect(phonemizeWord("ପାଞ୍ଚ")).toBe("pˈaɲt͡ʃɔ"); // 'five' — ଞ୍ଚ → homorganic ɲt͡ʃ
    });

    test("word-final anusvara nasalizes (not [m])", () => {
        expect(phonemizeWord("ଏବଂ")).toBe("ˈebɔ̃"); // 'and' (common function word) — ebɔ̃, NOT ebɔm
    });

    test("numbers compose, incl. NATIVE Odia digits ୦-୯ (21-99 fused forms deferred)", () => {
        expect(getPhonemizer("or").text("3").trim()).toBe("t̪ˈin̪i"); // ASCII → ତିନି
        expect(getPhonemizer("or").text("୩").trim()).toBe("t̪ˈin̪i"); // NATIVE digit ୩ → ତିନି
        expect(getPhonemizer("or").text("100").trim()).toBe("ˈekɔ sˈɔɦɔ"); // ଏକ ଶହ
    });
});
