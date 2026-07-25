import { describe, expect, test } from "vitest";

import { phonemizeWord, createKamba } from "../src/languages/kamba/kamba.ts";

// Canonical-IPA goldens for Kamba / Kikamba (kam) — Niger-Congo BANTU (E55), Latin orthography, Kenya (~4M). A pure
// greedy g2p (kamba.ts). The referee is THIN (en.wiktionary Kamba, HUMAN, only 5 words), so these golds are
// hand-adjudicated against the phonology (Omniglot Kikamba chart + Wikipedia / Roberts-Kohno 2000) — the 5
// independently-verified anchors are called out. Kamba shares Kikuyu's 7-vowel ATR where the TILDE is vowel QUALITY
// (⟨ĩ⟩=e, ⟨ũ⟩=o), but the consonants DIFFER: ⟨v⟩=β (Kamba spells [β] as ⟨v⟩), ⟨sy⟩=ʃ / ⟨ky⟩=tʃ (a palatal series
// Kikuyu lacks), NO ⟨c⟩/⟨g⟩=ɣ, ⟨nth⟩=ⁿð. TONE (H/L) is not written → not emitted. See
// docs/investigations/kam_bringup_investigation.md.
describe("Kamba canonical IPA — greedy g2p (Bantu, Kikamba orthography)", () => {
    test("the 5 en.wiktionary anchors (HUMAN IPA, tone + prenasal-notation folded)", () => {
        expect(phonemizeWord("mbiti")).toBe("ᵐbiti"); // hyena — ref mbítí
        expect(phonemizeWord("mũkonyo")).toBe("mokɔɲɔ"); // ref mòkɔ́ɲɔ̀ — ⟨ũ⟩=o, ⟨ny⟩=ɲ, ⟨o⟩=ɔ
        expect(phonemizeWord("mũtĩ")).toBe("mote"); // tree — ref mòté — ⟨ũ⟩=o, ⟨ĩ⟩=e
        expect(phonemizeWord("ngingo")).toBe("ᵑɡiᵑɡɔ"); // neck — ref ŋɡíŋɡɔ́ — ⟨ng⟩=ᵑɡ
        expect(phonemizeWord("ũtukũ")).toBe("otuko"); // night — ref òtúkò
    });

    test("7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ; doubling = length", () => {
        expect(phonemizeWord("mũndũ")).toBe("moⁿdo"); // "person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
        expect(phonemizeWord("kĩlũngũ")).toBe("keloᵑɡo"); // ⟨ĩ⟩→e, ⟨ũ⟩→o, ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("kaa")).toBe("kaː"); // ⟨aa⟩→aː (length by doubling)
        expect(phonemizeWord("muundu")).toBe("muːⁿdu"); // ⟨uu⟩→uː
    });

    test("KAMBA-SPECIFIC consonants: ⟨v⟩=β, ⟨sy⟩=ʃ, ⟨ky⟩=tʃ, ⟨th⟩=ð, ⟨nth⟩=ⁿð (differ from Kikuyu)", () => {
        expect(phonemizeWord("ngavu")).toBe("ᵑɡaβu"); // ⟨v⟩→β (Kamba's [β]); ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("mavindu")).toBe("maβiⁿdu"); // ⟨v⟩→β intervocalic
        expect(phonemizeWord("syana")).toBe("ʃana"); // "children" — ⟨sy⟩→ʃ (Kikuyu has no ⟨sy⟩)
        expect(phonemizeWord("kyama")).toBe("tʃama"); // ⟨ky⟩→tʃ affricate
        expect(phonemizeWord("thandatu")).toBe("ðaⁿdatu"); // "six" — ⟨th⟩→ð, ⟨nd⟩→ⁿd
        expect(phonemizeWord("nthakame")).toBe("ⁿðakamɛ"); // "blood" — ⟨nth⟩→ⁿð (prenasal dental)
    });

    test("prenasalized units + velar nasal: ⟨mb⟩=ᵐb, ⟨nz⟩=ⁿz, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ (distinct from ⟨ng⟩)", () => {
        expect(phonemizeWord("ng'ombe")).toBe("ŋɔᵐbɛ"); // "cow" — ⟨ng'⟩→ŋ, ⟨mb⟩→ᵐb
        expect(phonemizeWord("nyama")).toBe("ɲama"); // "meat" — ⟨ny⟩→ɲ
        expect(phonemizeWord("nzoka")).toBe("ⁿzɔka"); // ⟨nz⟩→ⁿz (post-nasal voicing of s)
        expect(phonemizeWord("itong'o")).toBe("itɔŋɔ"); // ⟨ng'⟩→ŋ (distinct from ⟨ng⟩→ᵑɡ)
        expect(phonemizeWord("king'abwe")).toBe("kiŋaβwɛ"); // ⟨ng'⟩→ŋ, standalone ⟨b⟩→β (mission spelling)
    });

    test("clause assembly: words + punctuation", () => {
        expect(createKamba().text("Mũndũ nĩ mũseo.").trim()).toBe("moⁿdo ne mosɛɔ  ."); // "a person is good"
    });

    test("loan/name consonants are kept, not silently dropped (⟨d⟩=d, ⟨c⟩=tʃ)", () => {
        expect(phonemizeWord("Daudi")).toBe("daudi"); // "David" — a common Kenyan name; ⟨d⟩ must not vanish
        expect(phonemizeWord("daktari")).toBe("daktaɾi"); // "doctor" (loan) — onset ⟨d⟩ kept
    });

    test("the ⟨ng'⟩ apostrophe: all three variants normalise; a bare quote injects no glottal", () => {
        // straight ', curly ’ (U+2019), and modifier-letter ʼ (U+02BC) all spell the velar nasal in the wild
        for (const w of ["ng'ombe", "ng’ombe", "ngʼombe"]) expect(createKamba().text(w).trim()).toBe("ŋɔᵐbɛ");
        expect(createKamba().text("'mũtĩ'").trim()).toBe("mote"); // a quoted word → no phantom ʔ (Kamba has no glottal)
    });
});
