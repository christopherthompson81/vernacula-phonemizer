import { describe, expect, test } from "vitest";

import { phonemizeWord, createHungarian } from "../src/languages/hungarian/hungarian.ts";
import { ROMAN_POLICY } from "../src/languages/hungarian/romanOrdinals.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Hungarian / magyar (hu) — Uralic, Latin. A regular longest-match g2p: digraphs +
// their geminate forms (ssz→sː, ggy→ɟː) before single letters, then doubled-consonant → Cː, then FIXED
// first-syllable stress. Signature: ⟨s⟩→ʃ / ⟨sz⟩→s (reversed), ⟨gy⟩→ɟ / ⟨ty⟩→c (palatal stops), ⟨a⟩→ɒ, the full
// long/short vowel system; plus REGRESSIVE voicing assimilation (biztat→ˈbistɒt), j-palatalization (feddj→ˈfɛɟː),
// and n→ŋ before k/ɡ. Validated at 92.6% vs wikipron hun narrow + 87.6% vs epitran. See
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

// Roman-numeral ORDINAL policy (src/languages/hungarian/romanOrdinals.ts). Hungarian writes the ordinal as a
// Roman numeral FOLLOWED BY A PERIOD (XIX. század) — the period is the ordinal marker, as "-th" is in English.
// No gender and no adjectival agreement, so one form is right in every context. The period itself survives into
// the output as a clause pause; that artefact is pre-existing (see the file header).
describe("Hungarian roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("ordinal words: első is irregular, compounds are ONE word with the combining unit", () => {
        expect(ord(1)).toBe("első");
        expect(ord(2)).toBe("második");
        expect(ord(19)).toBe("tizenkilencedik");
        expect(ord(21)).toBe("huszonegyedik"); // huszon- + egyedik (not első)
        expect(ord(40)).toBe("negyvenedik");
        expect(ord(50)).toBe("ötvenedik");
        expect(ord(63)).toBe("hatvanharmadik"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("századik");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["század", "században", "századi", "századtól", "századok", "évszázad", "évezred", "kerület", "évforduló"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("szazad")).toBe(false); // needs the á
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("hu").text("tizenkilencedik század").trim()).toBe("ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒd");
        expect(getPhonemizer("hu").text("ötvenedik évforduló").trim()).toBe("ˈøtvɛnɛdik ˈeːfːorduloː");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("hu").text("xix").trim()).toBe("ˈtizɛŋkilɛnt͡s"); // tizenkilenc, not tizenkilencedik
    });
});
