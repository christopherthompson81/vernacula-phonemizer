import { describe, expect, test } from "vitest";

import { phonemizeWord, createKikuyu } from "../src/languages/kikuyu/kikuyu.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/kikuyu/numbers.ts";

// Canonical-IPA goldens for Kikuyu / Gĩkũyũ (ki) — Niger-Congo BANTU (E51), Latin orthography, the largest language
// of Kenya (~8M). Hand-adjudicated against en.wiktionary Kikuyu (1062 IPA words). The pure greedy g2p scores 99.4%
// folded vs the referee (tools/referee-eval) — the folds strip tone (unwritten), downstep, length, and the glide/
// sibilant/tap notation. Signatures: a 7-vowel ATR system where the TILDE is vowel QUALITY not nasalization
// (⟨ĩ⟩=e, ⟨ũ⟩=o, ⟨e⟩=ɛ, ⟨o⟩=ɔ); Bantu FRICATIVIZATION (⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ); PRENASALIZED digraphs
// (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ, ⟨r⟩=ɾ. TONE (2-tone H/L + downstep) is not written →
// not emitted; cardinal numbers are covered in their own describe block below.
describe("Kikuyu canonical IPA — greedy g2p (Bantu fricativization + prenasalization)", () => {
    test("7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ", () => {
        expect(phonemizeWord("Gĩkũyũ")).toBe("ɣekojo"); // ⟨ĩ⟩→e, ⟨ũ⟩→o (the endonym)
        expect(phonemizeWord("gatego")).toBe("ɣatɛɣɔ"); // ⟨e⟩→ɛ, ⟨o⟩→ɔ
        expect(phonemizeWord("mũndũ")).toBe("moⁿdo"); //"person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
    });

    test("Bantu FRICATIVIZATION: ⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ; ⟨r⟩=ɾ", () => {
        expect(phonemizeWord("thaatũ")).toBe("ðaːto"); //"three" — ⟨th⟩→ð, ⟨aa⟩→aː, ⟨ũ⟩→o
        expect(phonemizeWord("biacara")).toBe("βiaɕaɾa"); // ⟨b⟩→β, ⟨c⟩→ɕ, ⟨r⟩→ɾ
        expect(phonemizeWord("gatarũ")).toBe("ɣataɾo"); // ⟨g⟩→ɣ (Dahl's Law is orthographic)
    });

    test("PRENASALIZED digraphs ⟨mb⟩=ᵐb, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ; ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ", () => {
        expect(phonemizeWord("mbaara")).toBe("ᵐbaːɾa"); // ⟨mb⟩→ᵐb
        expect(phonemizeWord("Njoroge")).toBe("ᶮdʑɔɾɔɣɛ"); // ⟨nj⟩→ᶮdʑ, ⟨g⟩→ɣ
        expect(phonemizeWord("bongwe")).toBe("βɔᵑɡwɛ"); // ⟨ng⟩→ᵑɡ + ⟨w⟩
        expect(phonemizeWord("nyama")).toBe("ɲama"); // ⟨ny⟩→ɲ
        expect(phonemizeWord("kĩng'angi")).toBe("keŋaᵑɡi"); // ⟨ng'⟩→ŋ (distinct from ⟨ng⟩→ᵑɡ)
    });

    test("text: words + clause punctuation (tone deferred)", () => {
        expect(createKikuyu().text("Gĩkũyũ nĩ rũthiomi.")).toBe("ɣekojo ne ɾoðiɔmi .");
    });
});

// CARDINAL NUMBERS (ki). The compositor emits the CITATION / COUNTING series (ĩmwe, igĩrĩ, ithatũ …) — the shape
// used counting aloud, since a bare integer gives the adjectival 1–5 no noun to agree with. The ALGORITHM is
// shared with Kamba (src/languages/kikuyu/e5xNumbers.ts, imported by kam) — same E5x formation, different words.
// Sources are cited in kikuyu.jsonc "numbers" (Omniglot Kikuyu numbers + lughayangu "Numbers in Gikuyu").
describe("Kikuyu cardinal numbers — the E5x citation series", () => {
    test("units + the additive teens", () => {
        expect(numberToWords(0)).toBe("kĩbũgũ");
        expect(numberToWords(7)).toBe("mũgwanja");
        expect(numberToWords(11)).toBe("ikũmi na ĩmwe");
        expect(numberToWords(19)).toBe("ikũmi na kenda");
    });
    test("tens are mĩrongo + its own multiplier series (only 2 takes concord)", () => {
        expect(numberToWords(20)).toBe("mĩrongo ĩrĩ"); // ĩrĩ, not igĩrĩ
        expect(numberToWords(21)).toBe("mĩrongo ĩrĩ na ĩmwe");
        expect(numberToWords(60)).toBe("mĩrongo ithathatũ"); // 6–9 never inflect
    });
    test("hundreds take the cl.6 magana series", () => {
        expect(numberToWords(100)).toBe("igana rĩmwe");
        expect(numberToWords(200)).toBe("magana meerĩ");
        expect(numberToWords(555)).toBe("magana matano mĩrongo ithano na ithano"); //"na" only before the last part
    });
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (no borrowed 'billion')", () => {
        expect(numberToWords(1000)).toBe("ngiri ĩmwe");
        expect(numberToWords(2000)).toBe("ngiri igĩrĩ");
        expect(numberToWords(1000000)).toBe("mĩrioni ĩmwe");
        expect(numberToWords(1000000000)).toBe("mĩrioni ngiri ĩmwe");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("20","ki").trim()).toBe("meɾɔᵑɡɔ eɾe"); // ⟨ĩ⟩→e (tilde = vowel QUALITY)
        expect(phonemize("100","ki").trim()).toBe("iɣana ɾemwɛ");
    });
});
