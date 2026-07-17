import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/malayalam/malayalam.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Malayalam (ml) — Dravidian Brahmic abugida, mirrors Telugu/Kannada (generic engine +
// a Malayalam data file, NO inherent-vowel deletion). The two Malayalam-specific features: SAMVRITOKARAM (a
// word-final chandrakkala → half-close [ɨ], നാല്→naːlɨ) and CHILLU pure-consonants (ൻ ർ ൺ ൽ ൾ ൿ → bare codas),
// plus the Dravidian INTERVOCALIC VOICING (single plosives voice between vowels: അടി→aɖi; geminates and
// word-final stops stay voiceless). Validated at 87.0% vs wikipron mal + 80.0% vs kaikki mal (folded).
describe("Malayalam canonical IPA", () => {
    test("retroflex/dental series, ള→ɭ, gemination→length", () => {
        expect(phonemizeWord("മലയാളം")).toBe("mˈalajaːɭam"); // ള→ɭ, final ം→m
        expect(phonemizeWord("അമ്മ")).toBe("ˈamːa"); // geminate മ്മ → mː
        expect(phonemizeWord("വെള്ളം")).toBe("ʋˈeɭːam"); // ള്ള → ɭː
        expect(phonemizeWord("കുട്ടി")).toBe("kˈuʈːi"); // retroflex geminate ʈː
    });

    test("intervocalic voicing (Dravidian sonorization) — geminates stay voiceless", () => {
        expect(phonemizeWord("അടി")).toBe("ˈaɖi"); // single ട ʈ→ɖ between vowels
        expect(phonemizeWord("കറുക")).toBe("kˈaruɡa"); // single ക k→ɡ intervocalic
        expect(phonemizeWord("പണ്ട്")).toBe("pˈaɳɖɨ"); // retroflex ണ്ട ɳʈ→ɳɖ (scoped post-nasal, even before samvrit)
    });

    test("samvritokaram — word-final chandrakkala → [ɨ]", () => {
        expect(phonemizeWord("നാല്")).toBe("nˈaːlɨ"); // 'four' — the half-close [ɨ]
        expect(phonemizeWord("വീട്")).toBe("ʋˈiːʈɨ"); // 'house' — stop stays voiceless before samvrit
    });

    test("chillu pure-consonant (no inherent vowel, no samvrit [ɨ])", () => {
        expect(phonemizeWord("അച്ഛൻ")).toBe("ˈat͡ʃʰːan"); // ends in chillu ൻ → bare n (not ...nɨ)
    });

    test("anusvara → [m] before a sibilant, homorganic before a stop", () => {
        expect(phonemizeWord("അംശം")).toBe("ˈamʃam"); // ംശ → m before ʃ
        expect(phonemizeWord("അംഗം")).toBe("ˈãŋɡam"); // ംഗ → homorganic ŋ before ɡ
    });

    test("numbers compose (units/teens/tens/magnitudes; 21-99 compounds deferred)", () => {
        expect(getPhonemizer("ml").text("100").trim()).toBe("ˈonːɨ nˈuːrɨ"); // ഒന്ന് നൂറ്
        expect(getPhonemizer("ml").text("5").trim()).toBe("ˈaɲt͡ʃɨ"); // അഞ്ച്
    });
});
