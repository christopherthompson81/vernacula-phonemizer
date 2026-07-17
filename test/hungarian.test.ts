import { describe, expect, test } from "vitest";

import { phonemizeWord, createHungarian } from "../src/languages/hungarian/hungarian.ts";

// Canonical-IPA goldens for Hungarian / magyar (hu) — Uralic, Latin. A regular longest-match g2p: digraphs +
// their geminate forms (ssz→sː, ggy→ɟː) before single letters, then doubled-consonant → Cː, then FIXED
// first-syllable stress. Signature: ⟨s⟩→ʃ / ⟨sz⟩→s (reversed), ⟨gy⟩→ɟ / ⟨ty⟩→c (palatal stops), ⟨a⟩→ɒ, the full
// long/short vowel system; plus REGRESSIVE voicing assimilation (biztat→ˈbistɒt), j-palatalization (feddj→ˈfɛɟː),
// and n→ŋ before k/ɡ. Validated at 91.3% vs wikipron hun narrow + 87.6% vs epitran. See
// docs/investigations/hu_native_bringup_investigation.md.
describe("Hungarian canonical IPA", () => {
    test("the reversed sibilants + palatal stops + ⟨a⟩→ɒ, first-syllable stress", () => {
        expect(phonemizeWord("magyar")).toBe("ˈmɒɟɒr"); // gy → ɟ, a → ɒ, stress on σ1
        expect(phonemizeWord("ország")).toBe("ˈorsaːɡ"); // sz → s, á → aː
        expect(phonemizeWord("szív")).toBe("ˈsiːv"); // sz → s (not ʃ), í → iː
        expect(phonemizeWord("gyerek")).toBe("ˈɟɛrɛk"); // gy → ɟ
        expect(phonemizeWord("kutya")).toBe("ˈkucɒ"); // ty → c
        expect(phonemizeWord("könyv")).toBe("ˈkøɲv"); // ö → ø, ny → ɲ
    });

    test("geminate digraphs + doubled consonants → length", () => {
        expect(phonemizeWord("asszony")).toBe("ˈɒsːoɲ"); // ssz → sː
        expect(phonemizeWord("meggy")).toBe("ˈmɛɟː"); // ggy → ɟː
        expect(phonemizeWord("dzsungel")).toBe("ˈd͡ʒuŋɡɛl"); // dzs → d͡ʒ, n → ŋ before ɡ
    });

    test("assimilations: regressive voicing, j-palatalization, nasal place", () => {
        expect(phonemizeWord("biztat")).toBe("ˈbistɒt"); // z → s before voiceless t
        expect(phonemizeWord("feddj")).toBe("ˈfɛɟː"); // dd + j → ɟː (imperative)
        expect(phonemizeWord("hang")).toBe("ˈhɒŋɡ"); // n → ŋ before ɡ
    });

    test("numbers (one word; 2 → két before a scale)", () => {
        const d = createHungarian();
        expect(d.text("21").trim()).toBe("ˈhusonɛɟ"); // huszonegy
        expect(d.text("200").trim()).toBe("ˈkeːtsaːz"); // kétszáz (két, not kettő)
        expect(d.text("234").trim()).toBe("ˈkeːtsaːzhɒrmint͡sneːɟ"); // kétszázharmincnégy (one word)
        expect(d.text("2000").trim()).toBe("ˈkeːtɛzɛr"); // kétezer
    });
});
