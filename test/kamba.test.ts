import { describe, expect, test } from "vitest";

import { phonemizeWord, createKamba } from "../src/languages/kamba/kamba.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kamba/numbers.ts";

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

// CARDINAL NUMBERS (kam). The compositor emits the CITATION / COUNTING series — literally the Peace Corps Kikamba
// Self-Instruction Manual's kũtala ("to count") list (ĩmwe, ĩlĩ, itatũ …) — because the manual states 1–5 take the
// prefix agreeing with the noun modified, and a bare integer has no such noun. The ALGORITHM is shared with
// Kikuyu (../kikuyu/e5xNumbers.ts); the words + citations are in kamba.jsonc "numbers".
describe("Kamba cardinal numbers — the manual's counting series", () => {
    test("units + the additive teens", () => {
        expect(numberToWords(0)).toBe("noti");
        expect(numberToWords(7)).toBe("mũonza");
        expect(numberToWords(11)).toBe("ĩkũmi na ĩmwe");
    });
    test("tens are miongo + their own multiplier series", () => {
        expect(numberToWords(20)).toBe("miongo ĩlĩ");
        expect(numberToWords(40)).toBe("miongo ina"); // ina here, but inya as the bare numeral 4
        expect(numberToWords(4)).toBe("inya");
        expect(numberToWords(90)).toBe("miongo keenda");
    });
    // These four strings are quoted VERBATIM from the manual's running text — they pin both the hundreds concord
    // series (maana + cl.6 a-) and the composition rule ("na" before the LAST component only).
    test("attested compounds reproduce the manual exactly", () => {
        expect(numberToWords(100)).toBe("ĩana yĩmwe");
        expect(numberToWords(150)).toBe("ĩana na miongo ĩtano"); // bare Ĩana before a remainder
        expect(numberToWords(250)).toBe("maana elĩ na miongo ĩtano");
        expect(numberToWords(1957)).toBe("ngili ĩmwe maana keenda miongo ĩtano na mũonza");
    });
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (extends the manual's ngili ĩkũmi = 10 000)", () => {
        expect(numberToWords(1000)).toBe("ngili ĩmwe");
        expect(numberToWords(10000)).toBe("ngili ĩkũmi");
        expect(numberToWords(1000000)).toBe("milioni ĩmwe");
        expect(numberToWords(1000000000)).toBe("milioni ngili ĩmwe");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("20", "kam").trim()).toBe("miɔᵑɡɔ ele");
        expect(phonemize("250", "kam").trim()).toBe("maːna ɛle na miɔᵑɡɔ etanɔ"); // ⟨aa⟩→aː
    });
});
