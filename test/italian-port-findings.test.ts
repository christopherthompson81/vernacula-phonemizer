/**
 * Two Italian defects the Rust port found by reading (#1463), fixed TS-first. Expected readings were
 * produced by running the fixed engine, not typed.
 *
 * 1. `isVowelLetter(next ?? "")`: JS `"…".includes("")` is TRUE, so "no next letter" counted as a vowel at
 *    the end of a word — a final ⟨s⟩ after a vowel voiced, a final ⟨gn⟩ geminated, a final ⟨qu⟩ glided.
 * 2. The -esimo family (every composed ordinal, plus nouns like *cristianesimo*) and the irregular head's two
 *    proparoxytones (settimo, decimo) took the default penultimate stress: ventunezˈimo, settˈimo, det͡ʃˈima.
 *    They reached FLEURS through the Roman pass, `21°`/`10ª` and fractions. The stressed e is OPEN, the
 *    standard reading (wikipron is split on it and the eval folds ɛ→e, so this is a register choice).
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

describe("italian: the -esimo family and settimo/decimo are stressed on an open antepenult e", () => {
    test("typed words", () => {
        expect(phonemizeWord("ventunesimo")).toBe("ventunˈɛzimo");
        expect(phonemizeWord("cristianesimo")).toBe("kristjanˈɛzimo");
        expect(phonemizeWord("medesimo")).toBe("medˈɛzimo");
        expect(phonemizeWord("settimo")).toBe("sˈɛttimo");
        expect(phonemizeWord("decima")).toBe("dˈɛt͡ʃima");
        expect(phonemizeWord("decimi")).toBe("dˈɛt͡ʃimi");
        // not the family: the bare verb form, and words that only begin like settim-/decim-
        expect(phonemizeWord("esimi")).toBe("ezˈimi");
        expect(phonemizeWord("settimana")).toBe("settimˈana");
        expect(phonemizeWord("decimetro")).toBe("det͡ʃimˈetro");
        expect(phonemizeWord("primo")).toBe("prˈimo");
    });

    test("ordinals the normalizer and the Roman pass generate", () => {
        expect(phonemize("il XXI secolo", "it")).toBe("ˈil ventunˈɛzimo sekˈolo");
        expect(phonemize("papa Giovanni XXIII", "it")).toBe("pˈapa d͡ʒovˈanni ventitreˈɛzimo");
        expect(phonemize("il MMM anniversario", "it")).toBe("ˈil tremillˈɛzimo anniversˈarjo");
        expect(phonemize("il 21° gol", "it")).toBe("ˈil ventunˈɛzimo ɡˈol");
        expect(phonemize("la 21ª volta", "it")).toBe("lˈa ventunˈɛzima vˈolta");
        expect(phonemize("3/20", "it")).toBe("trˈe ventˈɛzimi");
        expect(phonemize("il VII secolo", "it")).toBe("ˈil sˈɛttimo sekˈolo");
        expect(phonemize("la 10ª Armata", "it")).toBe("lˈa dˈɛt͡ʃima armˈata");
        expect(phonemize("3/10", "it")).toBe("trˈe dˈɛt͡ʃimi");
    });
});
