import { describe, expect, test } from "vitest";

import { createIcelandic, phonemizeWord } from "../src/languages/icelandic/icelandic.ts";
import { numberToWords } from "../src/languages/icelandic/numbers.ts";
import { normalizeIcelandic } from "../src/languages/icelandic/normalize.ts";

// Icelandic (is) — íslenska, North Germanic (Insular), Latin + ⟨þ ð æ ö⟩ (~330k). One of the deepest orthographies
// in the fleet: NO voicing contrast in stops (the contrast is ASPIRATION), so ⟨b d g⟩/⟨p t k⟩ neutralize to [p t k];
// famous epenthetic-stop clusters ⟨ll⟩→[tl] ⟨rn⟩→[rtn]; preaspiration; devoiced-sonorant onsets. A greedy scan +
// code rules. Referee: wikipron isl_latn_broad (human), with vowel LENGTH + ASPIRATION folded. ⚠ It is the
// only referee for is — single-source, though a large one.
describe("Icelandic canonical IPA — grapheme g2p + fortis/lenis neutralization + the epenthetic clusters", () => {
    const is = createIcelandic();

    test("the vowel values: á→au, é→jɛ, í→i, ó→ou, u→ʏ, ú→u, æ→ai; ⟨þ ð⟩", () => {
        expect(phonemizeWord("hús")).toBe("hˈus"); // ⟨ú⟩ → u ("house")
        expect(phonemizeWord("sól")).toBe("sˈoul"); // ⟨ó⟩ → ou ("sun")
        expect(phonemizeWord("læra")).toBe("lˈaira"); // ⟨æ⟩ → ai ("learn")
        expect(phonemizeWord("þú")).toBe("θˈu"); // ⟨þ⟩ → θ ("you")
        expect(phonemizeWord("ís")).toBe("ˈis"); // ⟨í⟩ → i ("ice")
    });

    test("NO voicing contrast: ⟨b d g⟩→[p t k], ⟨p t k⟩→[p t k]; intervocalic ⟨g⟩→[ɣ]", () => {
        expect(phonemizeWord("bók")).toBe("pˈouk"); // ⟨b⟩ → p ("book")
        expect(phonemizeWord("taka")).toBe("tˈaka"); // ⟨t⟩ → t (aspiration folded) ("take")
        expect(phonemizeWord("dagur")).toBe("tˈaɣʏr"); // ⟨d⟩→t, intervocalic ⟨g⟩→ɣ, ⟨u⟩→ʏ ("day")
        expect(phonemizeWord("góður")).toBe("kˈouðʏr"); // ⟨g⟩→k, ⟨ð⟩→ð ("good")
    });

    test("⟨k g⟩ → palatal [c] before a front vowel", () => {
        expect(phonemizeWord("gelda")).toBe("cˈɛlta"); // ⟨g⟩ before ⟨e⟩ → c ("castrate")
        expect(phonemizeWord("Bylgja")).toBe("pˈɪlca"); // ⟨gj⟩ after a consonant → c ("wave")
    });

    test("the epenthetic-stop + devoiced-sonorant clusters: ⟨ll⟩→tl, ⟨rl⟩→rtl, ⟨nn⟩→tn, ⟨hr hj⟩", () => {
        expect(phonemizeWord("fjall")).toBe("fjˈatl"); // ⟨ll⟩ → tl ("mountain")
        expect(phonemizeWord("karl")).toBe("kˈartl"); // ⟨rl⟩ → rtl ("man")
        expect(phonemizeWord("Steinn")).toBe("stˈeitn"); // ⟨nn⟩ → tn after a diphthong ("stone")
        expect(phonemizeWord("Hrafn")).toBe("rˈapn"); // ⟨hr⟩ → [r̥]→r (devoicing folds), ⟨fn⟩→pn ("raven")
        expect(phonemizeWord("hjörtur")).toBe("çˈœrtʏr"); // ⟨hj⟩ → ç ("hearts")
    });

    test("PREASPIRATION [h]: fortis geminates + a fortis stop before a sonorant", () => {
        expect(phonemizeWord("Frakki")).toBe("frˈahcɪ"); // ⟨kk⟩ before ⟨i⟩ → [h]+palatal ("Frenchman")
        expect(phonemizeWord("Hekla")).toBe("hˈɛhkla"); // ⟨k⟩ before ⟨l⟩ → [h]+k (a volcano)
    });

    test("the pre-velar-nasal change: ⟨ng nk⟩→[ŋk] with the vowel diphthongizing", () => {
        expect(phonemizeWord("bang")).toBe("pˈauŋk"); // ⟨a⟩ → au before ⟨ng⟩ ("bang")
        expect(phonemizeWord("gengur")).toBe("cˈeiŋkʏr"); // ⟨e⟩ → ei; ⟨g⟩→c palatal ("goes/walks")
        expect(phonemizeWord("Alþingi")).toBe("ˈalθiŋcɪ"); // ⟨n⟩→ŋ before palatal [c] (the parliament)
    });

    test("⟨g⟩→[ɣ] word-final / pre-voiced, ⟨k g⟩→[x] before a voiceless stop, no double preaspiration", () => {
        expect(phonemizeWord("lag")).toBe("lˈaɣ"); // word-final ⟨g⟩ after a vowel → ɣ ("law/layer")
        expect(phonemizeWord("Sigmar")).toBe("sˈɪɣmar"); // ⟨g⟩ before a voiced [m] → ɣ (a name)
        expect(phonemizeWord("lukt")).toBe("lˈʏxt"); // ⟨k⟩ → x before [t] ("smell")
        expect(phonemizeWord("drukkna")).toBe("trˈʏhkna"); // fortis geminate ⟨kk⟩ before [n]: ONE [h], not two ("drown")
    });

    test("clause assembly", () => {
        expect(is.text("Ég tala íslensku.").trim()).toBe("jˈɛɣ tˈala ˈislɛnskʏ ."); // ⟨g⟩ word-final after a vowel → [ɣ]
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
        expect(is.text("21").trim()).toBe("tˈʏhtʏɣʏ ˈɔɣ ˈeitn"); // tuttugu og einn
        expect(is.text("1000000").trim()).toBe("ˈein mˈɪtljoun"); // ein milljón
    });

    // ⚠ THE HIATUS GLIDE MUST NOT REACH A DIPHTHONG — pinned because #748 nearly widened it there.
    // TWO SEPARATE GUARDS hold this, and only one of them is about diphthongs:
    //   · the ⟨í⟩-only TRIGGER set (icelandic.jsonc hiatusGlideVowels) is what keeps erkiengill glideless,
    //     since its ⟨i⟩ is plain — referee is.wikipron-isl-broad.tsv:2311 = ɛ r̥ c ɪ e i ɲ c ɪ t l;
    //   · VOWEL_PH omitting plain ⟨e⟩ is what keeps þríeyki glideless, ⟨í⟩ being a real trigger. That one
    //     is worth 8091 → 8090/10093, so þríeyki below is the assertion actually guarding it.
    test("the hiatus glide fires before a plain vowel but NOT before a diphthong", () => {
        expect(phonemizeWord("Biblía")).toContain("ja"); // the rule's own example — plain-vowel hiatus
        expect(phonemizeWord("erkiengill")).toBe("ˈɛrcɪeiŋcɪtl"); // referee: …ɪ e i ɲ… — plain ⟨i⟩, no trigger
        expect(phonemizeWord("þríeyki")).toBe("θrˈieicɪ"); // ⟨í⟩ IS a trigger — blocked by VOWEL_PH instead
    });

    // ⚠ THE GLIDE IS ⟨í⟩'s ALONE — measured, not reasoned. The trigger was "the high front vowels"
    // ⟨i í y ý⟩, which over-applied: the referee gives the glide to the LONG ⟨í⟩ (90 glide / 13 none) and
    // withholds it from plain ⟨i⟩ (2/7) and ⟨ý⟩ (0/4). Narrowing to ⟨í⟩ moved the folded backbone
    // 8086 → 8091/10093. Counts + the eval numbers are in icelandic.jsonc.
    test("plain ⟨i⟩ and ⟨ý⟩ do NOT take the hiatus glide, ⟨í⟩ does", () => {
        expect(phonemizeWord("hýena")).toBe("hˈiɛna"); // referee h iː ɛ n a — was hijɛna
        expect(phonemizeWord("beitieski")).toBe("pˈeitɪɛscɪ"); // referee p e iː t ɪ ɛ s c ɪ — was peitɪjɛscɪ
        expect(phonemizeWord("blýantur")).toBe("plˈiantʏr"); // referee p l iː a n t ʏ r
        expect(phonemizeWord("Albanía")).toBe("ˈalpanija"); // ⟨í⟩ KEEPS it — referee a l p aː n iː j a
    });

    // PRIMARY STRESS — fixed on the first syllable, no exceptions to look up. The mark goes before the
    // NUCLEUS (repo convention: nˈaða, not ˈnaða), which is what the onset cases below are pinning.
    // ⚠ THE REFEREE CANNOT CHECK THIS. is.wikipron-isl-broad.tsv carries ZERO stress marks across all
    // 10093 rows, and referee-eval strips [ˈˌ] from both sides anyway — the folded backbone is 8091/10093
    // before and after, unchanged. So these assertions ARE the guard, not a convenience. What was measured
    // instead: over all 10093 referee headwords, stripping the mark reproduces the previous output
    // byte-for-byte, exactly one mark per word, and the 12 markless rows are the vowelless letter-names.
    test("primary stress is fixed on the first syllable, marked before the nucleus", () => {
        expect(phonemizeWord("dagur")).toBe("tˈaɣʏr"); // simple onset — the mark follows it
        expect(phonemizeWord("Alaska")).toBe("ˈalaska"); // vowel-initial → mark at position 0
        expect(phonemizeWord("strjáll")).toBe("strjˈautl"); // deep onset /strj/ + the ⟨á⟩ diphthong nucleus
        expect(phonemizeWord("ég")).toBe("jˈɛɣ"); // ⟨é⟩ scans to "jɛ" — its [j] is an ONSET, not the nucleus
        expect(phonemizeWord("Hekla")).toBe("hˈɛhkla"); // the preaspirating [h] belongs to the CODA of σ1
        expect(phonemizeWord("Steinn")).toBe("stˈeitn"); // ⟨ei⟩ is a nucleus — the one ⟨e⟩ VOWEL_PH omits
        // No nucleus, no mark: the referee's letter-name rows (⟨b d g h j m n p v x þ⟩) are bare consonants.
        expect(phonemizeWord("þ")).toBe("θ");
    });

});

// TEXT NORMALIZATION. Counts measured over the FLEURS is_is corpus (column 3).
describe("icelandic normalization", () => {
    // Icelandic ordinals AGREE IN GENDER AND CASE, which is what separates this from the Norwegian and
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

    // `rúmmetra` is the corpus's own word ("Luno var með 120–160 rúmmetra af eldsneyti um borð").
    // Icelandic fuses the measure word on as a prefix, like `fer-` in the squared rule above it.
    // ⚠ Bare `m` is deliberately NOT in the unit table: adding it made `802.11m` read as "…ellefu METRAR",
    // because this file spends the version dot before the shared tier's NOT_VERSION guard can use it
    // (a local rule depending on a character an earlier rule rewrote will not fire). Nothing is lost — these rules are local and do not consult that table.
    test("the cubed unit, and why bare m stays out", () => {
        expect(createIcelandic().text("5 m³").trim()).toContain("rˈumɛtrar");
        expect(createIcelandic().text("5 km³").trim()).toContain("rˈumciloumɛtrar");
        expect(createIcelandic().text("802.11m").trim()).toMatch(/ m$/u); // still a letter, not a metre
    });

    // RATES. The plain unit loop's guard is `(?!\p{L})`, which a slash satisfies, so it ate the
    // numerator and left the denominator as raw letters: the corpus's own `83 km/klst.` ×4 read as
    // *…kílómetrar HKLST*. `á klukkustund` ×3 ("17.500 mílna hraða á klukkustund"), and the abbreviation this
    // language writes is `km/klst.`, not `km/h` — both are claimed.
    // NO SECOND: `á sekúndu` and `sekúndu` are both ×0 here, so `m/s` is left alone rather than invented.
    test("the rate, in Icelandic's own abbreviation", () => {
        expect(createIcelandic().text("83 km/klst.").trim()).toContain("cˈiloumɛtrar ˈau");
        expect(createIcelandic().text("120 km/h").trim()).toContain("cˈiloumɛtrar ˈau");
        expect(createIcelandic().text("133 m/s").trim()).toContain(" s");  // untouched: no word for it
    });

    // DOTTED ABBREVIATIONS — the whole of this corpus's raw-Latin residual apart from `mph`. `o.s.frv.` ×3
    // and `o.fl.` ×1 were reaching the g2p as the vowelless runs `frv` and `fl`, one clause break per dot.
    // The expansions are is.wikipedia's own, from its abbreviations article: `og fleira → o.fl.`,
    // and `og svo framvegis` (attest.ts: framvegis 24/17, fleira 27/20, both in the slot).
    // ⚠ Only the two the corpus writes; `t.d.`/`m.a.`/`a.m.k.` are the same shape and deliberately absent.
    test("the dotted abbreviations o.s.frv. and o.fl.", () => {
        expect(normalizeIcelandic("handlegginn o.s.frv.")).toBe("handlegginn og svo framvegis");
        expect(normalizeIcelandic("(James o.fl., 1995)")).toBe("(James og fleira, 1995)");
        expect(normalizeIcelandic("o.s.frv. og fleira")).toBe("og svo framvegis og fleira");
        // a word that merely BEGINS with the letters is not the abbreviation — no dot, no match
        expect(normalizeIcelandic("ofl og osfrv")).toBe("ofl og osfrv");
    });

    // ⟨mph⟩ — a rate written as ONE token, so the `km/klst` rule has no slash to key on and it belongs in
    // the unit table instead. ×2 here (`300 mph`, `40 mph (64 km/klst)`). is.wikipedia glosses the
    // abbreviation itself: "kílómetrar á klukkustund, (tákn km/h) mílur á klukkustund, (tákn mph)".
    test("mph is a rate in one token", () => {
        expect(normalizeIcelandic("300 mph")).toBe("300 mílur á klukkustund");
        expect(normalizeIcelandic("40 mph (64 km/klst)")).toBe("40 mílur á klukkustund (64 kílómetrar á klukkustund)");
        expect(createIcelandic().text("300 mph").trim()).toContain("mˈilʏr ˈau");
    });
});
