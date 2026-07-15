import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/tagalog/tagalog.ts";

// Canonical-IPA goldens for Tagalog / Filipino (tl) — shallow near-phonemic Latin orthography, rule-based g2p.
// Digraphs ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ; r→ɾ; word-initial + intervocalic glottal stops [ʔ] (tao→taʔo); hyphen → [ʔ]
// (pag-ibig→paɡʔibiɡ); whole-word irregulars (mga→maŋa, ng→naŋ); penultimate stress (phonemic stress is
// unmarked in spelling). See docs/tl_native_bringup_investigation.md.
describe("tagalog canonical IPA", () => {
    test("g2p: ng digraph, r→ɾ, glottal stops, special words", () => {
        const cases: [string, string][] = [
            ["mabuti", "mabˈuti"], // penult stress, r→ɾ absent here
            ["tao", "tˈaʔo"], // intervocalic glottal stop
            ["maganda", "maɡˈanda"], // ɡ
            ["kaibigan", "kaʔibˈiɡan"], // intervocalic ʔ + ɡ
            ["ngayon", "ŋˈajon"], // ng→ŋ, y→j
            ["mga", "mˈaŋa"], // special word: plural marker
            ["araw", "ʔˈaɾaw"], // word-initial ʔ, r→ɾ, w
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("hyphen → glottal stop; number", () => {
        expect(phonemize("pag-ibig", "tl")).toBe("paɡʔˈibiɡ");
        expect(phonemize("salamat", "tl")).toContain("salˈamat");
    });
});
