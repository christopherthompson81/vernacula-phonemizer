import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/aragonese/aragonese.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Aragonese / aragonés (an) — Ibero-Romance (Pyrenean), a Spanish-shaped shallow g2p.
// The hallmarks: ⟨ch⟩→[t͡ʃ] (where Spanish has [x]), ⟨ny⟩→[ɲ] (Catalan-style digraph), ⟨x⟩→[ʃ], ⟨v⟩→[b], distinción
// (z/c+e,i→[s]), and word-final ⟨-r⟩ apocope. Validated 76.2% folded / 96.2% symbol vs wikipron arg_latn_broad
// (human, 1320; the folded % is dragged by the referee's dual final-r forms). See docs/investigations/an_native_bringup_investigation.md.
describe("Aragonese (aragonés) canonical IPA", () => {
    test("the hallmark ⟨ch⟩→[t͡ʃ], ⟨ny⟩→[ɲ], ⟨x⟩→[ʃ]", () => {
        expect(phonemizeWord("Chesús")).toBe("t͡ʃesus"); // ⟨ch⟩→[t͡ʃ] (where Spanish has [x])
        expect(phonemizeWord("Espanya")).toBe("espaɲa"); // ⟨ny⟩→[ɲ] (the Catalan-style digraph)
        expect(phonemizeWord("baxo")).toBe("baʃo"); // ⟨x⟩→[ʃ]
        expect(phonemizeWord("chuego")).toBe("t͡ʃweɡo"); // ⟨ch⟩→[t͡ʃ]; ⟨u⟩→[w] rising glide (game)
    });

    test("distinción + ⟨ll⟩→[ʎ] + rising glides", () => {
        expect(phonemizeWord("abanza")).toBe("abanθa"); // ⟨z⟩→[θ] distinción (standard Aragonese)
        expect(phonemizeWord("cielo")).toBe("θjelo"); // ⟨c⟩ before e/i → [θ]; ⟨ie⟩→[je]
        expect(phonemizeWord("tierra")).toBe("tjera"); // ⟨ie⟩→[je]; ⟨rr⟩→[r] trill
        expect(phonemizeWord("fillo")).toBe("fiʎo"); // ⟨ll⟩→[ʎ] (son)
        expect(phonemizeWord("Aragón")).toBe("aɾaɡon"); // ⟨g⟩→[ɡ] (back vowel); single ⟨r⟩→[ɾ] tap
    });

    test("word-final ⟨-r⟩ apocope (the Aragonese trait)", () => {
        expect(phonemizeWord("cantar")).toBe("kanta"); // final ⟨-r⟩ dropped after a vowel (infinitive)
        expect(phonemizeWord("muller")).toBe("muʎe"); // ⟨ll⟩→[ʎ]; final ⟨-r⟩ dropped (woman)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("an").text("Chesús").trim()).toBe("t͡ʃesus");
    });
});
