import { describe, expect, test } from "vitest";

import { phonemizeWord, createKikuyu } from "../src/languages/kikuyu/kikuyu.ts";

// Canonical-IPA goldens for Kikuyu / Gĩkũyũ (ki) — Niger-Congo BANTU (E51), Latin orthography, the largest language
// of Kenya (~8M). Hand-adjudicated against en.wiktionary Kikuyu (1062 IPA words). The pure greedy g2p scores 99.4%
// folded vs the referee (tools/referee-eval) — the folds strip tone (unwritten), downstep, length, and the glide/
// sibilant/tap notation. Signatures: a 7-vowel ATR system where the TILDE is vowel QUALITY not nasalization
// (⟨ĩ⟩=e, ⟨ũ⟩=o, ⟨e⟩=ɛ, ⟨o⟩=ɔ); Bantu FRICATIVIZATION (⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ); PRENASALIZED digraphs
// (⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨nj⟩=ᶮdʑ, ⟨ng⟩=ᵑɡ); ⟨ng'⟩=ŋ, ⟨ny⟩=ɲ, ⟨r⟩=ɾ. TONE (2-tone H/L + downstep) is not written →
// not emitted; numbers deferred. See docs/investigations/ki_native_bringup_investigation.md.
describe("Kikuyu canonical IPA — greedy g2p (Bantu fricativization + prenasalization)", () => {
    test("7-vowel ATR: the TILDE is vowel QUALITY not nasal — ⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ", () => {
        expect(phonemizeWord("Gĩkũyũ")).toBe("ɣekojo"); // ⟨ĩ⟩→e, ⟨ũ⟩→o (the endonym)
        expect(phonemizeWord("gatego")).toBe("ɣatɛɣɔ"); // ⟨e⟩→ɛ, ⟨o⟩→ɔ
        expect(phonemizeWord("mũndũ")).toBe("moⁿdo"); // "person" — ⟨ũ⟩→o, ⟨nd⟩→ⁿd
    });

    test("Bantu FRICATIVIZATION: ⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨c⟩=ɕ; ⟨r⟩=ɾ", () => {
        expect(phonemizeWord("thaatũ")).toBe("ðaːto"); // "three" — ⟨th⟩→ð, ⟨aa⟩→aː, ⟨ũ⟩→o
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

    test("text: words + clause punctuation (tone + numbers deferred)", () => {
        expect(createKikuyu().text("Gĩkũyũ nĩ rũthiomi.")).toBe("ɣekojo ne ɾoðiɔmi  . ");
    });
});
