import { describe, expect, test } from "vitest";
import { phonemizeWord } from "./romanian.ts";
import { ROMAN_EXCLUSIONS } from "../../core/roman.ts";
import { phonemize } from "../../index.ts";
import { ROMAN_POLICY } from "./romanOrdinals.ts";

// Diagnostic gold for the Romanian (ro) g2p — common words, one per signature feature. These are OUR canonical
// output; they match the wikipron ron_latn referee on the shared backbone (stress is deferred, unwritten). The
// suite locks the distinctive Romanian behaviors: ă→ə / â→î→ɨ, ș→ʃ / ț→t͡s, c/g softening + ch/gh, the e̯a/o̯a
// rising diphthongs, i/u glides, final-i palatalisation, and word-initial e→je. See docs/investigations/ro_native_bringup_investigation.md.
describe("Romanian (ro) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["și", "ˈʃi"], // ș → ʃ ("and")
        ["este", "ˈjeste"], // word-initial e → je (copula), stress on the je onset
        ["zece", "ˈzet͡ʃe"], // c before e → t͡ʃ ("ten")
        ["cinci", "ˈt͡ʃint͡ʃʲ"], // c soft + final -i palatalisation ("five")
        ["geografie", "d͡ʒeoɡraˈfie"], // g soft (ge → d͡ʒ) + final -ie HIATUS + penult stress
        ["gheață", "ˈɡe̯at͡sə"], // gh → ɡ + ea diphthong + ț → t͡s ("ice")
        ["ceai", "ˈt͡ʃe̯aj"], // c soft + ea diphthong + final i → j ("tea")
        ["floare", "ˈflo̯are"], // oa diphthong; stress before the fl onset ("flower")
        ["seară", "ˈse̯arə"], // ea diphthong + final ă → ə ("evening")
        ["câine", "ˈkɨjne"], // â → ɨ + i off-glide ("dog")
        ["viață", "ˈvjat͡sə"], // i on-glide + ț ("life")
        ["școală", "ˈʃko̯alə"], // ș + oa diphthong ("school")
        ["lupi", "ˈlupʲ"], // final -i palatalisation ("wolves")
        ["examen", "eˈɡzamen"], // word-initial ex- → eɡz + penult stress (lexicon) ("exam")
        ["pâine", "ˈpɨjne"], // î-spelling → ɨ + i off-glide ("bread")
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});

// ── Roman-numeral ORDINAL policy (src/languages/romanian/romanOrdinals.ts) ────────────────────────────────
// Romanian reads a century as an ordinal in the `al …-lea` construction — the orthography spells it out
// ("secolul al XIX-lea", ro.wikipedia Date și numere). The article is INSIDE the emitted word because the
// input we can rewrite is the article-less "secolul XVIII", where nothing else supplies the `al`.
describe("Romanian Roman-numeral ordinal policy", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("century context fires the al …-lea ordinal", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("secolul")).toBe(true);
        expect(ROMAN_POLICY.ordinalBefore?.test("secolele")).toBe(true); // inflected forms
        expect(ROMAN_POLICY.ordinalBefore?.test("secolelor")).toBe(true);
        expect(ord(19)).toBe("al nouăsprezecelea");
        expect(ord(18)).toBe("al optsprezecelea");
        expect(phonemize("secolul al nouăsprezecelea", "ro")).toBe("sekoˈlul ˈal ˈnowəsprezet͡ʃele̯a");
    });

    test("the article is NOT re-added after an explicit `al` (no *al al …*)", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("al")).toBe(false);
        expect(ROMAN_POLICY.ordinalBefore?.test("a")).toBe(false);
    });

    test("regnal name before the numeral fires the ordinal (Carol II → al doilea)", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("carol")).toBe(true);
        expect(ord(2)).toBe("al doilea");
        expect(ord(8)).toBe("al optulea"); // -ulea after a consonant
        expect(ord(28)).toBe("al douăzeci și optulea");
        expect(ord(1)).toBe("întâi"); // irregular: never *al unulea*
    });

    test("ordinal is unbounded — XL / L / above L", () => {
        expect(ord(40)).toBe("al patruzecilea");
        expect(ord(50)).toBe("al cincizecilea");
        expect(ord(60)).toBe("al șaizecilea");
        expect(ord(100)).toBe("al sutălea");
        expect(phonemize("al cincizecilea aniversar", "ro")).toBe("ˈal t͡ʃint͡ʃizet͡ʃiˈle̯a aniveˈrsar");
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(ROMAN_POLICY.ordinalBefore?.test("în")).toBe(false);
        expect(phonemize("secolul 19", "ro")).toBe("sekoˈlul ˈnowəsprezet͡ʃe"); // the pre-existing reading
    });

    test("the per-language `vii` exclusion (= alive/vines) is carried through, not restated", () => {
        expect(ROMAN_POLICY.exclude).toBe(ROMAN_EXCLUSIONS.ro);
        expect(ROMAN_POLICY.exclude?.has("vii")).toBe(true); // so `secolul VII` is left alone entirely
    });
});
