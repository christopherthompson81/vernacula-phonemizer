import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/tagalog/tagalog.ts";

// Canonical-IPA goldens for Tagalog / Filipino (tl) — shallow near-phonemic Latin orthography, rule-based g2p.
// Digraphs ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ; r→ɾ; word-initial + intervocalic glottal stops [ʔ] (tao→taʔo); hyphen → [ʔ]
// (pag-ibig→paɡʔibiɡ); whole-word irregulars (mga→maŋa, ng→naŋ); penultimate stress (phonemic stress is
// unmarked in spelling). See docs/tl_native_bringup_investigation.md.
describe("tagalog canonical IPA", () => {
    test("g2p: ng digraph, r→ɾ, glottal stops, special words", () => {
        const cases: [string, string][] = [
            ["mabuti", "mabˈuti"], // penult stress, r→ɾ absent here
            ["tao", "tˈaʔo"], // intervocalic glottal stop
            ["maganda", "maɡandˈa"], // ɡ; final stress (magandá) — from the stress lexicon, not naive penult
            ["kaibigan", "kaʔibˈiɡan"], // intervocalic ʔ + ɡ; penult (default)
            ["ngayon", "ŋajˈon"], // ng→ŋ, y→j; final stress (ngayón) — stress lexicon
            ["mga", "maŋˈa"], // special word: plural marker, pronounced mangá (final stress) — stress lexicon
            ["araw", "ʔˈaɾaw"], // word-initial ʔ, r→ɾ, w
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("word-final glottal stop set (shipped) vs rule-only (unwritten, lexical)", () => {
        // The word-final ʔ is phonemic but unwritten (a lexical residual). The shipped path appends it for words in
        // the wikipron-sourced set; the rule engine (used by the non-circular referee eval) does not.
        expect(phonemizeWord("acda")).toBe("ʔˈakdaʔ");
        expect(phonemizeWordRules("acda")).toBe("ʔˈakda");
        expect(phonemizeWord("aguho")).toBe("ʔaɡˈuhoʔ");
        // Words NOT in the set are unchanged (and an already-ʔ-final rule output is not doubled):
        expect(phonemizeWord("tao")).toBe("tˈaʔo");
        expect(phonemizeWord("araw")).toBe("ʔˈaɾaw");
    });

    test("stress lexicon (shipped) vs penult default (rule-only)", () => {
        // Phonemic stress is unwritten; the rule engine defaults to penultimate, but ~23% of words stress elsewhere.
        // The shipped path pins stress from a kaikki-sourced lexicon (single confident position); the rule engine
        // (used by the non-circular referee eval, which folds stress anyway) keeps the penultimate default.
        expect(phonemizeWord("salmon")).toBe("salmˈon"); // final stress (loanword)
        expect(phonemizeWordRules("salmon")).toBe("sˈalmon"); // penult default
        expect(phonemizeWord("doktor")).toBe("doktˈoɾ");
        expect(phonemizeWordRules("doktor")).toBe("dˈoktoɾ");
        // Stress homographs (kaikki lists >1 position) are abstained → penult default on both paths:
        expect(phonemizeWord("balik")).toBe("bˈalik");
    });

    test("hyphen → glottal stop; number", () => {
        expect(phonemize("pag-ibig", "tl")).toBe("paɡʔˈibiɡ");
        expect(phonemize("salamat", "tl")).toContain("salˈamat");
    });
});
