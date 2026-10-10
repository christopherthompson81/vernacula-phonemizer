/**
 * Two Italian defects the Rust port found by reading (#1463), fixed TS-first. Expected readings were
 * produced by running the fixed engine, not typed.
 *
 * 1. `isVowelLetter(next ?? "")`: JS `"…".includes("")` is TRUE, so "no next letter" counted as a vowel at
 *    the end of a word — a final ⟨s⟩ after a vowel voiced, a final ⟨gn⟩ geminated, a final ⟨qu⟩ glided.
 * 2. The -esimo family (every composed ordinal, plus nouns like *cristianesimo*) took the default penultimate
 *    stress: ventunezˈimo for ventunˈezimo. It reached FLEURS through the Roman pass, `21°` and fractions.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/italian/italian.ts";

describe("italian: a missing next letter is not a vowel", () => {
    test("a word-final ⟨s⟩ after a vowel stays voiceless", () => {
        expect(phonemizeWord("gas")).toBe("ɡˈas");
        expect(phonemizeWord("autobus")).toBe("awtˈobus");
        expect(phonemizeWord("virus")).toBe("vˈirus");
        expect(phonemizeWord("lapis")).toBe("lˈapis");
        expect(phonemize("il gas", "it")).toBe("ˈil ɡˈas");
        // intervocalic voicing is untouched
        expect(phonemizeWord("casa")).toBe("kˈaza");
        expect(phonemizeWord("rosa")).toBe("rˈoza");
    });

    test("a word-final ⟨gn⟩ does not geminate, and a final ⟨qu⟩ takes no glide", () => {
        expect(phonemizeWord("magn")).toBe("mˈaɲ");
        expect(phonemizeWord("magno")).toBe("mˈaɲɲo");
        expect(phonemizeWord("qu")).toBe("kˈu");
        expect(phonemizeWord("quando")).toBe("kwˈando");
    });
});

describe("italian: the -esimo family is stressed on the suffix's e", () => {
    test("typed words", () => {
        expect(phonemizeWord("ventunesimo")).toBe("ventunˈezimo");
        expect(phonemizeWord("cristianesimo")).toBe("kristjanˈezimo");
        expect(phonemizeWord("medesimo")).toBe("medˈezimo");
    });

    test("ordinals the normalizer and the Roman pass generate", () => {
        expect(phonemize("il XXI secolo", "it")).toBe("ˈil ventunˈezimo sekˈolo");
        expect(phonemize("papa Giovanni XXIII", "it")).toBe("pˈapa d͡ʒovˈanni ventitreˈezimo");
        expect(phonemize("il MMM anniversario", "it")).toBe("ˈil tremillˈezimo anniversˈarjo");
        expect(phonemize("il 21° gol", "it")).toBe("ˈil ventunˈezimo ɡˈol");
        expect(phonemize("la 21ª volta", "it")).toBe("lˈa ventunˈezima vˈolta");
        expect(phonemize("3/20", "it")).toBe("trˈe ventˈezimi");
    });
});
