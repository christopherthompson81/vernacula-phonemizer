import { describe, expect, test } from "vitest";

import { createIcelandic, phonemizeWord } from "../src/languages/icelandic/icelandic.ts";
import { numberToWords } from "../src/languages/icelandic/numbers.ts";
import { normalizeIcelandic } from "../src/languages/icelandic/normalize.ts";

// Icelandic (is) — íslenska, North Germanic (Insular), Latin + ⟨þ ð æ ö⟩ (~330k). One of the deepest orthographies
// in the fleet: NO voicing contrast in stops (the contrast is ASPIRATION), so ⟨b d g⟩/⟨p t k⟩ neutralize to [p t k];
// famous epenthetic-stop clusters ⟨ll⟩→[tl] ⟨rn⟩→[rtn]; preaspiration; devoiced-sonorant onsets. A greedy scan +
// code rules, validated against wikipron isl_latn_broad (10,093 human headwords) — 79.8% FOLDED / 96.7% symbol, with
// vowel LENGTH + ASPIRATION folded. 🔷 single-source but LARGE. See docs/investigations/is_native_bringup_investigation.md.
describe("Icelandic canonical IPA — grapheme g2p + fortis/lenis neutralization + the epenthetic clusters", () => {
    const is = createIcelandic();

    test("the vowel values: á→au, é→jɛ, í→i, ó→ou, u→ʏ, ú→u, æ→ai; ⟨þ ð⟩", () => {
        expect(phonemizeWord("hús")).toBe("hus"); // ⟨ú⟩ → u ("house")
        expect(phonemizeWord("sól")).toBe("soul"); // ⟨ó⟩ → ou ("sun")
        expect(phonemizeWord("læra")).toBe("laira"); // ⟨æ⟩ → ai ("learn")
        expect(phonemizeWord("þú")).toBe("θu"); // ⟨þ⟩ → θ ("you")
        expect(phonemizeWord("ís")).toBe("is"); // ⟨í⟩ → i ("ice")
    });

    test("NO voicing contrast: ⟨b d g⟩→[p t k], ⟨p t k⟩→[p t k]; intervocalic ⟨g⟩→[ɣ]", () => {
        expect(phonemizeWord("bók")).toBe("pouk"); // ⟨b⟩ → p ("book")
        expect(phonemizeWord("taka")).toBe("taka"); // ⟨t⟩ → t (aspiration folded) ("take")
        expect(phonemizeWord("dagur")).toBe("taɣʏr"); // ⟨d⟩→t, intervocalic ⟨g⟩→ɣ, ⟨u⟩→ʏ ("day")
        expect(phonemizeWord("góður")).toBe("kouðʏr"); // ⟨g⟩→k, ⟨ð⟩→ð ("good")
    });

    test("⟨k g⟩ → palatal [c] before a front vowel", () => {
        expect(phonemizeWord("gelda")).toBe("cɛlta"); // ⟨g⟩ before ⟨e⟩ → c ("castrate")
        expect(phonemizeWord("Bylgja")).toBe("pɪlca"); // ⟨gj⟩ after a consonant → c ("wave")
    });

    test("the epenthetic-stop + devoiced-sonorant clusters: ⟨ll⟩→tl, ⟨rl⟩→rtl, ⟨nn⟩→tn, ⟨hr hj⟩", () => {
        expect(phonemizeWord("fjall")).toBe("fjatl"); // ⟨ll⟩ → tl ("mountain")
        expect(phonemizeWord("karl")).toBe("kartl"); // ⟨rl⟩ → rtl ("man")
        expect(phonemizeWord("Steinn")).toBe("steitn"); // ⟨nn⟩ → tn after a diphthong ("stone")
        expect(phonemizeWord("Hrafn")).toBe("rapn"); // ⟨hr⟩ → [r̥]→r (devoicing folds), ⟨fn⟩→pn ("raven")
        expect(phonemizeWord("hjörtur")).toBe("çœrtʏr"); // ⟨hj⟩ → ç ("hearts")
    });

    test("PREASPIRATION [h]: fortis geminates + a fortis stop before a sonorant", () => {
        expect(phonemizeWord("Frakki")).toBe("frahcɪ"); // ⟨kk⟩ before ⟨i⟩ → [h]+palatal ("Frenchman")
        expect(phonemizeWord("Hekla")).toBe("hɛhkla"); // ⟨k⟩ before ⟨l⟩ → [h]+k (a volcano)
    });

    test("the pre-velar-nasal change: ⟨ng nk⟩→[ŋk] with the vowel diphthongizing", () => {
        expect(phonemizeWord("bang")).toBe("pauŋk"); // ⟨a⟩ → au before ⟨ng⟩ ("bang")
        expect(phonemizeWord("gengur")).toBe("ceiŋkʏr"); // ⟨e⟩ → ei; ⟨g⟩→c palatal ("goes/walks")
        expect(phonemizeWord("Alþingi")).toBe("alθiŋcɪ"); // ⟨n⟩→ŋ before palatal [c] (the parliament)
    });

    test("⟨g⟩→[ɣ] word-final / pre-voiced, ⟨k g⟩→[x] before a voiceless stop, no double preaspiration", () => {
        expect(phonemizeWord("lag")).toBe("laɣ"); // word-final ⟨g⟩ after a vowel → ɣ ("law/layer")
        expect(phonemizeWord("Sigmar")).toBe("sɪɣmar"); // ⟨g⟩ before a voiced [m] → ɣ (a name)
        expect(phonemizeWord("lukt")).toBe("lʏxt"); // ⟨k⟩ → x before [t] ("smell")
        expect(phonemizeWord("drukkna")).toBe("trʏhkna"); // fortis geminate ⟨kk⟩ before [n]: ONE [h], not two ("drown")
    });

    test("clause assembly", () => {
        expect(is.text("Ég tala íslensku.").trim()).toBe("jɛɣ tala islɛnskʏ ."); // ⟨g⟩ word-final after a vowel → [ɣ]
    });

    // CARDINAL NUMBERS — tens-FIRST with "og" before the final unit, plus GENDER CONCORD on 1–4: a multiplier
    // agrees with its magnitude noun (hundrað/þúsund neuter, milljón feminine, milljarður masculine), while a bare
    // numeral takes the MASCULINE citation series used for counting aloud. Source: Wiktionary Appendix:Icelandic
    // numerals. See src/languages/icelandic/numbers.ts.
    test("numbers: tens-first with og, and the 1–4 gender concord", () => {
        expect(numberToWords(0)).toBe("núll");
        expect(numberToWords(7)).toBe("sjö");
        expect(numberToWords(2)).toBe("tveir"); // bare numeral → MASCULINE citation form
        expect(numberToWords(21)).toBe("tuttugu og einn"); // tens first, "og" before the unit
        expect(numberToWords(45)).toBe("fjörutíu og fimm");
        expect(numberToWords(99)).toBe("níutíu og níu");
        expect(numberToWords(100)).toBe("eitt hundrað");
        expect(numberToWords(101)).toBe("eitt hundrað og einn"); // single-word remainder takes "og"
        expect(numberToWords(121)).toBe("eitt hundrað tuttugu og einn"); // …but a tens+unit pair does NOT get a 2nd
        expect(numberToWords(200)).toBe("tvö hundruð"); // hundrað is NEUTER → tvö, not tveir
        expect(numberToWords(555)).toBe("fimm hundruð fimmtíu og fimm");
    });

    test("numbers: magnitudes impose their own gender on the multiplier", () => {
        expect(numberToWords(1000)).toBe("eitt þúsund");
        expect(numberToWords(1001)).toBe("eitt þúsund og einn");
        expect(numberToWords(12345)).toBe("tólf þúsund þrjú hundruð fjörutíu og fimm");
        expect(numberToWords(1000000)).toBe("ein milljón"); // milljón is FEMININE → ein
        expect(numberToWords(2000000)).toBe("tvær milljónir"); // …→ tvær
        expect(numberToWords(1000000000)).toBe("einn milljarður"); // milljarður is MASCULINE → einn
        expect(numberToWords(2000000000)).toBe("tveir milljarðar"); // …→ tveir
    });

    test("numbers: wired into the phonemizer", () => {
        expect(is.text("21").trim()).toBe("tʏhtʏɣʏ ɔɣ eitn"); // tuttugu og einn
        expect(is.text("1000000").trim()).toBe("ein mɪtljoun"); // ein milljón
    });

});

// #562 — the normalization layer. Counts measured over the FLEURS is_is corpus (column 3).
describe("icelandic normalization", () => {
    // ★ Icelandic ordinals AGREE IN GENDER AND CASE, which is what separates this from the Norwegian and
    // Danish single-form tables. Weak declension: -i is masculine NOMINATIVE only; -a covers masculine
    // oblique, feminine nominative and all neuter; -u is feminine oblique. So -a is the DEFAULT, and
    // porting a single-form table would give the masculine nominative everywhere.
    test("the ordinal form is selected by what follows it", () => {
        expect(normalizeIcelandic("3. maí")).toBe("þriðji maí"); // month → masc NOM
        expect(normalizeIcelandic("18. öld")).toBe("átjánda öld"); // öld is feminine NOM
        expect(normalizeIcelandic("18. aldar")).toBe("átjándu aldar"); // feminine OBLIQUE
        expect(normalizeIcelandic("9. sæti")).toBe("níunda sæti"); // neuter
        expect(normalizeIcelandic("1. dag")).toBe("fyrsta dag"); // masculine ACCUSATIVE
    });

    test("a sentence ending in a year keeps its full stop", () => {
        expect(normalizeIcelandic("Árið 1990. Hann kom")).toBe("Árið 1990. Hann kom");
    });

    // The period groups thousands here. `HH.MM` looks like it occurs 24 times, but that count is an
    // artefact of the pattern matching INSIDE `1.234`; exactly one standalone instance exists and it is a
    // decimal (6.34 tommum). The 10 real clocks are colon-form.
    test("period-grouped thousands, decimal comma, colon clock", () => {
        expect(normalizeIcelandic("1.234")).toBe("1234");
        expect(normalizeIcelandic("12,5")).toBe("12 komma 5");
        expect(normalizeIcelandic("11:00")).toBe("11 00");
    });

    test("percent, units, squared units, ranges", () => {
        expect(normalizeIcelandic("25 %")).toBe("25 prósent");
        expect(normalizeIcelandic("5 km")).toBe("5 kílómetrar");
        expect(normalizeIcelandic("km²")).toBe("ferkílómetrar");
        expect(normalizeIcelandic("1990-1995")).toBe("1990 til 1995");
    });

    test("ordinary Icelandic text is untouched", () => {
        expect(normalizeIcelandic("Íslenska er tungumál.")).toBe("Íslenska er tungumál.");
    });

    // #586 — `rúmmetra` is the corpus's own word ("Luno var með 120–160 rúmmetra af eldsneyti um borð").
    // Icelandic fuses the measure word on as a prefix, like `fer-` in the squared rule above it.
    // ⚠ Bare `m` is deliberately NOT in the unit table: adding it made `802.11m` read as "…ellefu METRAR",
    // because this file spends the version dot before the shared tier's NOT_VERSION guard can use it
    // (trap 39 (a local rule that depends on a character…)). Nothing is lost — these rules are local and do not consult that table.
    test("the cubed unit, and why bare m stays out (#586)", () => {
        expect(createIcelandic().text("5 m³").trim()).toContain("rumɛtrar");
        expect(createIcelandic().text("5 km³").trim()).toContain("rumciloumɛtrar");
        expect(createIcelandic().text("802.11m").trim()).toMatch(/ m$/u); // still a letter, not a metre
    });

    // #586 — RATES. The plain unit loop's guard is `(?!\p{L})`, which a slash satisfies, so it ate the
    // numerator and left the denominator as raw letters: the corpus's own `83 km/klst.` ×4 read as
    // *…kílómetrar HKLST*. `á klukkustund` ×3 ("17.500 mílna hraða á klukkustund"), and the abbreviation this
    // language writes is `km/klst.`, not `km/h` — both are claimed.
    // NO SECOND: `á sekúndu` and `sekúndu` are both ×0 here, so `m/s` is left alone rather than invented.
    test("the rate, in Icelandic's own abbreviation (#586)", () => {
        expect(createIcelandic().text("83 km/klst.").trim()).toContain("ciloumɛtrar au");
        expect(createIcelandic().text("120 km/h").trim()).toContain("ciloumɛtrar au");
        expect(createIcelandic().text("133 m/s").trim()).toContain(" s");  // untouched: no word for it
    });
});
