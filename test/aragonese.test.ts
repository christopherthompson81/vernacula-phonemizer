import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/aragonese/aragonese.ts";
import { numberToWords } from "../src/languages/aragonese/numbers.ts";
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

    // NUMBERS — decimal; the twenties FUSE (vintiun) while 30–90 take the ⟨y⟩ connector; 16–19 are the analytic
    // deci- series. Source: Mal de Lenguas "Los números en aragonés" + omniglot (aragonese.jsonc).
    test("numbers: units, the fused twenties, the ⟨y⟩ connector, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("siete");
        expect(numberToWords(16)).toBe("decisiéis"); // the deci- series, not Spanish dieciséis
        expect(numberToWords(21)).toBe("vintiun"); // fused, one word
        expect(numberToWords(31)).toBe("trenta y un"); // the ⟨y⟩ connector from 30 up
        expect(numberToWords(555)).toBe("cincocientos cinquanta y cinco");
        expect(numberToWords(12345)).toBe("dotze mil trecientos quaranta y cinco");
        expect(numberToWords(1000000)).toBe("un millón");
        expect(numberToWords(1000000000)).toBe("mil millons"); // Ibero long scale
    });

    test("numbers read through the g2p", () => {
        expect(getPhonemizer("an").text("21").trim()).toBe("bintjun"); // ⟨v⟩→b (betacism)
        expect(getPhonemizer("an").text("100").trim()).toBe("θjent"); // cient — distinción ⟨c⟩+i → θ
    });
});
