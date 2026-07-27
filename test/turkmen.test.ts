import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/turkmen/turkmen.ts";

// Canonical-IPA goldens for Standard Turkmen (tk) — Türkmençe, Oghuz Turkic, Latin, the fleet's first Turkmen.
// THE HALLMARK: the INTERDENTAL fricatives ⟨s⟩→[θ] and ⟨z⟩→[ð] (shared with Bashkir — söz→θøð). 9 vowels with
// ⟨a⟩→[ɑ] (back), ⟨ä⟩→[æ], ⟨ö⟩→[ø], ⟨ü⟩→[y] (front rounded), ⟨y⟩→[ɯ] (close back unrounded); ⟨ç⟩→t͡ʃ, ⟨j⟩→d͡ʒ,
// ⟨ž⟩→ʒ, ⟨ş⟩→ʃ, ⟨ň⟩→ŋ, ⟨ý⟩→j (glide, vs the vowel ⟨y⟩), ⟨h⟩→x. Word-final (oxytone) stress; unwritten phonemic
// length not emitted. Validated at 97.9% symbol (91.5% folded) vs wikipron / 94.9% (80.4%) vs kaikki. See
// docs/investigations/tk_native_bringup_investigation.md.
describe("Turkmen (Türkmençe) canonical IPA", () => {
    test("the INTERDENTAL hallmark ⟨s⟩→θ, ⟨z⟩→ð", () => {
        expect(phonemizeWord("söz")).toBe("ˈθøð"); // 'word' — ⟨s⟩→θ, ⟨ö⟩→ø, ⟨z⟩→ð
        expect(phonemizeWord("göz")).toBe("ˈɡøð"); // 'eye' — ⟨z⟩→ð
        expect(phonemizeWord("suw")).toBe("ˈθuw"); // 'water' — ⟨s⟩→θ, ⟨w⟩→w
        expect(phonemizeWord("ýazmak")).toBe("jɑðˈmɑk"); // 'to write' — ⟨z⟩→ð, ⟨a⟩→ɑ (back)
    });

    test("the 9-vowel system + ⟨y⟩[ɯ] vs ⟨ý⟩[j]", () => {
        expect(phonemizeWord("gyz")).toBe("ˈɡɯð"); // 'girl' — ⟨y⟩→ɯ (the vowel)
        expect(phonemizeWord("ýyl")).toBe("ˈjɯl"); // 'year' — ⟨ý⟩→j (the glide) then ⟨y⟩→ɯ
        expect(phonemizeWord("dünýä")).toBe("dynˈjæ"); // 'world' — ⟨ü⟩→y, ⟨ý⟩→j, ⟨ä⟩→æ
        expect(phonemizeWord("köşk")).toBe("ˈkøʃk"); // 'palace' — ⟨ö⟩→ø, ⟨ş⟩→ʃ
    });

    test("special consonants ⟨ç ž ň h⟩ + word-final stress", () => {
        expect(phonemizeWord("çaga")).toBe("t͡ʃɑˈɡɑ"); // 'child' — ⟨ç⟩→t͡ʃ, final stress
        expect(phonemizeWord("jaň")).toBe("ˈd͡ʒɑŋ"); // 'bell' — ⟨j⟩→d͡ʒ, ⟨ň⟩→ŋ
        expect(phonemizeWord("žurnal")).toBe("ʒuɾˈnɑl"); // 'journal' — ⟨ž⟩→ʒ
        expect(phonemizeWord("äheň")).toBe("æˈxeŋ"); // 'melody' — ⟨ä⟩→æ, ⟨h⟩→x, ⟨ň⟩→ŋ
    });

    test("final stress with maximal-onset syllabification (loanword clusters)", () => {
        expect(phonemizeWord("türkmen")).toBe("tyɾkˈmen"); // ˈ before ⟨m⟩ (⟨k⟩ is coda of tü'rk, not part of the onset)
        expect(phonemizeWord("plan")).toBe("ˈplɑn"); // loan — ˈ before the whole ⟨pl⟩ onset
        expect(phonemizeWord("sport")).toBe("ˈθpoɾt"); // loan — ⟨sp⟩→[θp] (s→θ), stress before the whole onset
    });
});
