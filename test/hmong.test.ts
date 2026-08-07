import { describe, expect, test } from "vitest";

import { createHmong, phonemizeWord } from "../src/languages/hmong/hmong.ts";

// Hmong (hmn) — White Hmong / Hmoob Dawb (Hmong Daw, mww), Hmong-Mien, tonal (~8M). An RPA (Romanized Popular
// Alphabet) → IPA converter. RPA has NO codas → a final ⟨b j v s g m d⟩ is always a TONE marker. Validated against
// wikipron mww_latn_broad (single-syllable, ~455): 100% on-referee (maps fit to it; RPA is deterministic) / 94.1%
// held-out 5-fold CV (the honest generalization). single-source (thin).
describe("Hmong (White Hmong) canonical IPA — RPA → IPA converter", () => {
    const hmn = createHmong();

    test("the final consonant LETTER marks tone (no codas): b/j/v/s/g/m/d + none", () => {
        expect(phonemizeWord("teb")).toBe("te˥"); // ⟨-b⟩ → high 55 ("country")
        expect(phonemizeWord("caij")).toBe("cai̯˥˧"); // ⟨-j⟩ → high-falling 52 ("time/season"); ⟨c⟩=[c], ⟨ai⟩
        expect(phonemizeWord("kuv")).toBe("ku˧˦"); // ⟨-v⟩ → mid-rising 24 ("I/me")
        expect(phonemizeWord("lus")).toBe("lu˩"); // ⟨-s⟩ → low 11 ("word/language")
        expect(phonemizeWord("cag")).toBe("ca˧˩̤"); // ⟨-g⟩ → breathy low-falling
        expect(phonemizeWord("cai")).toBe("cai̯˧"); // no tone letter → mid 33
    });

    test("the rich onset system: prenasalised, voiceless sonorants, retroflex, uvular", () => {
        expect(phonemizeWord("npua")).toBe("ᵐbuə̯˧"); // ⟨np⟩ prenasalised → ᵐb, ⟨ua⟩→uə̯ ("pig")
        expect(phonemizeWord("ntxhai")).toBe("ⁿt͡sʰai̯˧"); // ⟨ntxh⟩ → ⁿt͡sʰ ("girl/daughter")
        expect(phonemizeWord("hlub")).toBe("l̥u˥"); // ⟨hl⟩ voiceless lateral → l̥ ("love")
        expect(phonemizeWord("Hmoob")).toBe("m̥ɒ̃˥"); // ⟨hm⟩→m̥, ⟨oo⟩ nasal →ɒ̃ ("Hmong")
    });

    test("⟨tx x⟩ PALATALISE to [t͡ɕ ɕ] before /i/; a vowel-initial syllable takes glottal [ʔ]", () => {
        expect(phonemizeWord("txiv")).toBe("t͡ɕi˧˦"); // ⟨tx⟩ → t͡ɕ before i ("father/fruit")
        expect(phonemizeWord("txab")).toBe("t͡sa˥"); // ⟨tx⟩ → t͡s elsewhere
        expect(phonemizeWord("ib")).toBe("ʔi˥"); // vowel-initial → glottal onset ʔ ("one")
    });

    test("clause assembly (space-separated syllables)", () => {
        expect(createHmong().text("Kuv hais lus Hmoob.").replace(/\s+/g, " ").trim())
            .toBe("ku˧˦ hai̯˩ lu˩ m̥ɒ̃˥ ."); // "I speak Hmong"
    });
});

// Cardinal numbers — decimal and analytic. 11–19 are kaum + unit; 20 is the irregular two-word nees nkaum; 30–90 are
// unit + caug (30/40/50) or caum (60–90), a real tone alternation. A magnitude ALWAYS carries its multiplier, incl.
// "one" (ib puas, ib txhiab, ib roob), and thousands group Western-style, so 10⁵ is ib puas txhiab. Source: Wikivoyage
// "Hmong phrasebook" Numbers + Wiktionary "Category:White Hmong numerals" (see numbers.ts).
describe("Hmong (hmn) cardinal numbers", () => {
    const hmn = createHmong();
    for (const [n, ipa] of [
        [0, "sɒ̃˩̰"], // xoom
        [7, "ça˧"], // xya
        [10, "kau̯˩̰"], // kaum
        [11, "kau̯˩̰ ʔi˥"], // kaum ib
        [20, "nẽ˩ ᵑɡau̯˩̰"], // nees nkaum — the irregular two-word twenty
        [21, "nẽ˩ ᵑɡau̯˩̰ ʔi˥"], // nees nkaum ib
        [42, "pˡau̯˥ cau̯˧˩̤ ʔɒ˥"], // plaub caug ob — the caug decade
        [100, "ʔi˥ puə̯˩"], // ib puas — multiplier always spoken
        [1000, "ʔi˥ t͡sʰiə̯˥"], // ib txhiab
        [12345, "kau̯˩̰ ʔɒ˥ t͡sʰiə̯˥ pe˥ puə̯˩ pˡau̯˥ cau̯˧˩̤ t͡ʂi˥"], // kaum ob txhiab peb puas plaub caug tsib
        [1000000, "ʔi˥ ʈɒ̃˥"], // ib roob
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(hmn.text(String(n)).trim()).toBe(ipa);
        });
    }
});
