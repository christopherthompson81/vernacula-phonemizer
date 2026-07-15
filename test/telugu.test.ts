import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/telugu/telugu.ts";

// Canonical-IPA goldens for Telugu (te) — a Dravidian Brahmic abugida via the generic engine. Unlike Hindi
// there is NO inherent-vowel deletion (inherent /a/, every akshara pronounced); short/long e,o are distinguished
// (ఎ e / ఏ eː, ఒ o / ఓ oː); retroflex ళ→ɭ, ష→ʂ; geminate → length ː; word-final anusvara ం → [m].
// See docs/te_native_bringup_investigation.md.
describe("telugu canonical IPA", () => {
    test("abugida core: inherent /a/, retroflex, short/long e·o, gemination, final ం", () => {
        const cases: [string, string][] = [
            ["తెలుగు", "t̪ˈeluɡu"], // 'Telugu': short e, no deletion
            ["చెట్టు", "t͡ʃˈeʈːu"], // 'tree': retroflex geminate ʈː
            ["మనిషి", "mˈaniʂi"], // 'person': ష → retroflex ʂ
            ["నీళ్ళు", "nˈiːɭːu"], // 'water': ళ → retroflex lateral geminate ɭː
            ["పుస్తకం", "pˈust̪akam"], // 'book': final ం → [m]
            ["ఒకటి", "ˈokaʈi"], // 'one': short o
            ["ఊరు", "ˈuːɾu"], // 'town/village': long u
            ["చేయి", "t͡ʃˈeːji"], // 'hand': long eː
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("text: word run + danda", () => {
        expect(phonemize("తెలుగు భాష.", "te")).toContain("t̪ˈeluɡu");
    });
});
