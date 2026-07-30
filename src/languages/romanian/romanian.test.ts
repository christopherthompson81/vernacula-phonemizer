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

// ── Cardinal numbers: GENDER + `de` agreement with the magnitude nouns ─────────────────────────────────────
// sută and mie are FEMININE nouns, milion and miliard are NEUTER (masculine in the singular, feminine in the
// plural), and the multiplier's 1/2 has to agree: o sută / două sute, o mie / două mii, un milion / două
// milioane. A count of 20 or more also takes the linker `de` before the noun (o sută de mii, douăzeci și una de
// mii). Source: en.wikipedia.org/wiki/Romanian_numbers (quoted in romanian.jsonc).
describe("Romanian cardinal numbers — gender agreement on the magnitude nouns", () => {
    const ro = (s: string): string => phonemize(s, "ro").trim();
    test("the feminine mie: o mie / două mii / cinci mii, with `de` from 20 up", () => {
        expect(ro("1000")).toBe("ˈo ˈmie"); // o mie — the feminine article, not a bare "mie"
        expect(ro("2000")).toBe("ˈdowə ˈmij"); // două mii — FEM two (not *doi mii)
        expect(ro("5000")).toBe("ˈt͡ʃint͡ʃʲ ˈmij"); // cinci mii — no gender marking below/above 1–2
        expect(ro("21000")).toBe("dowəˈzet͡ʃʲ ˈʃi ˈuna ˈde ˈmij"); // douăzeci și una de mii — fem "una" + de
        expect(ro("100000")).toBe("ˈo ˈsutə ˈde ˈmij"); // o sută de mii — a round hundred takes `de` too
    });
    test("the neuter milion: un milion / două milioane (neuter plural takes the FEMININE numeral)", () => {
        expect(ro("1000000")).toBe("ˈun miˈljon"); // un milion (not *unu milion)
        expect(ro("2000000")).toBe("ˈdowə miˈljo̯ane"); // două milioane (not *doi milioane)
        expect(ro("21000000")).toBe("dowəˈzet͡ʃʲ ˈʃi ˈunu ˈde miˈljo̯ane"); // …unu de milioane — …1 stays MASC
    });
    test("the feminine sută, and the miliard tier", () => {
        expect(ro("100")).toBe("ˈo ˈsutə"); // o sută
        expect(ro("200")).toBe("ˈdowə ˈsute"); // două sute — FEM two (not *doi sute)
        // un miliard — the 10⁹ tier (the billions multiplier used to index past the tables and leak "undefined").
        // ⟨lia⟩ glides exactly as in milion → miˈljon, so the reading is consistent with the neighbouring tier.
        expect(ro("1000000000")).toBe("ˈun miˈljard");
    });
    test("a bare digit keeps the MASCULINE counting form (unu, doi)", () => {
        expect(ro("1")).toBe("ˈunu"); // unu — "reserved for counting only" (en.wiktionary.org/wiki/unu)
        expect(ro("2")).toBe("ˈdoj"); // doi
    });
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
