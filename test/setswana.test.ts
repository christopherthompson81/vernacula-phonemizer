import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/setswana/setswana.ts";

// Canonical-IPA goldens for Setswana / Tswana (tn) — Bantu (Sotho-Tswana, S31), Latin orthography, non-click.
// Hand-adjudicated from Mistry (Cole 1955) + epitran tsn-Latn. The greedy longest-match g2p scores 100% folded
// vs epitran (tools/referee-eval, 1592 words) — the folds neutralise our tie-bar notation, the two beyond-epitran
// corrections (⟨g⟩→x, ⟨ny⟩→ɲ), and the mid-vowel height that the standard orthography leaves underdetermined.
// These goldens pin the signatures + a handful of common words. Tone (H/L) and vowel height are deferred.
// See docs/investigations/tn_native_bringup_investigation.md.
describe("Setswana canonical IPA — greedy g2p", () => {
    test("digraph signatures: dorsal aspirates, lateral affricates, sibilants, palatals", () => {
        expect(phonemizeWord("kgomo")).toBe("k͡xʰomo"); // "cow" — ⟨kg⟩ → k͡xʰ
        expect(phonemizeWord("kgosi")).toBe("k͡xʰosi"); // "chief" — ⟨kg⟩
        expect(phonemizeWord("tlhogo")).toBe("t͡ɬʰoxo"); // "head" — ⟨tlh⟩ → t͡ɬʰ (+ ⟨g⟩→x)
        expect(phonemizeWord("tshaba")).toBe("t͡sʰaba"); // "tribe" — ⟨tsh⟩ → t͡sʰ
        expect(phonemizeWord("batswana")).toBe("bat͡swana"); // ⟨ts⟩ → t͡s
        expect(phonemizeWord("motho")).toBe("motʰo"); // "person" — ⟨th⟩ → tʰ
        expect(phonemizeWord("dijo")).toBe("did͡ʒo"); // "food" — ⟨j⟩ → d͡ʒ
    });

    test("the ⟨g⟩ → [x] divergence (Setswana has no /g/ phoneme; epitran's plain [g] is wrong)", () => {
        expect(phonemizeWord("legodimo")).toBe("lexodimo"); // "sky/heaven" — ⟨g⟩ → x
        expect(phonemizeWord("segolo")).toBe("sexolo"); // ⟨g⟩ → x
        expect(phonemizeWord("nyaga")).toBe("ɲaxa"); // ⟨ny⟩ → ɲ AND ⟨g⟩ → x
    });

    test("palatal nasal ⟨ny⟩ → ɲ (vs epitran's naive n+glide)", () => {
        expect(phonemizeWord("ngwana")).toBe("ŋwana"); // "child" — ⟨ng⟩ → ŋ (velar nasal)
        expect(phonemizeWord("senya")).toBe("seɲa"); // ⟨ny⟩ → ɲ
    });

    test("common words + syllabic nasal onset", () => {
        expect(phonemizeWord("dumela")).toBe("dumela"); // "hello"
        expect(phonemizeWord("mmele")).toBe("mmele"); // "body" — syllabic ⟨m⟩ onset
        expect(phonemizeWord("ntlha")).toBe("nt͡ɬʰa"); // "point" — nasal + ⟨tlh⟩
        expect(phonemizeWord("tsela")).toBe("t͡sela"); // "road"
    });

    test("the ê/ô circumflex → open-mid ɛ/ɔ (plain e/o = close-mid default)", () => {
        expect(phonemizeWord("bôla")).toBe("bɔla"); // ⟨ô⟩ → ɔ (open-mid)
        expect(phonemizeWord("bola")).toBe("bola"); // plain ⟨o⟩ → o (close-mid) — minimal pair vs bôla
    });
});
