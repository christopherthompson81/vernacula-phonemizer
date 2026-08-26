import { describe, expect, test } from "vitest";

import { phonemizeWord, createAzerbaijani } from "../src/languages/azerbaijani/azerbaijani.ts";
import { normalizeAzerbaijani, ordinalWords } from "../src/languages/azerbaijani/normalize.ts";
import { ROMAN_POLICY } from "../src/languages/azerbaijani/romanOrdinals.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Azerbaijani / Azərbaycan dili (az) — North Azerbaijani, Turkic (Oghuz), Latin. A
// cleanroom rule g2p sharing the Turkish engine shape (vowel harmony already spelled; k/g palatalize before front
// vowels; dark/clear l; geminate stops; final-syllable stress). Azerbaijani-specific: the extra vowel ə→[æ],
// a→[ɑ], ö→[œ]; q→[ɡ] (final→x); x→[x], ğ→[ɣ]. Referees: wikipron aze narrow + epitran.
describe("Azerbaijani canonical IPA", () => {
    test("vowels a→ɑ, ə→æ, ö→œ, ü→y", () => {
        expect(phonemizeWord("salam")).toBe("sɑɫˈɑm"); // a → ɑ, dark-l
        expect(phonemizeWord("əl")).toBe("ˈæl"); // ə → æ
        expect(phonemizeWord("dörd")).toBe("dˈœɾd"); // ö → œ
        expect(phonemizeWord("gözəl")).toBe("ɟœzˈæl"); // ö→œ, ə→æ, g→ɟ
    });

    test("k/g palatalize before a front vowel; q → ɡ (final → x)", () => {
        expect(phonemizeWord("kitab")).toBe("citˈɑb"); // k → c before front i
        expect(phonemizeWord("kənd")).toBe("cˈænd"); // k → c before front ə
        expect(phonemizeWord("gəlmək")).toBe("ɟælmˈæc"); // g → ɟ, final k → c (front)
        expect(phonemizeWord("qapı")).toBe("ɡɑpˈɯ"); // q → ɡ
        expect(phonemizeWord("oxumaq")).toBe("oxumˈɑx"); // final q → x (devoicing)
        expect(phonemizeWord("balıq")).toBe("bɑɫˈɯx"); // final q → x
    });

    test("x → x (velar fricative); ğ → ɣ; geminate stops", () => {
        expect(phonemizeWord("yaxşı")).toBe("jɑxʃˈɯ"); // x → x
        expect(phonemizeWord("dağ")).toBe("dˈɑɣ"); // ğ → ɣ
        expect(phonemizeWord("oğul")).toBe("oɣˈuɫ"); // ğ → ɣ, dark-l coda
        expect(phonemizeWord("səkkiz")).toBe("sæcːˈiz"); // kk → cː (geminate + palatalization)
    });

    test("c → d͡ʒ, ç → t͡ʃ", () => {
        expect(phonemizeWord("çörək")).toBe("t͡ʃœɾˈæc"); // ç → t͡ʃ, final k → c
    });

    test("numbers (final stress; bir dropped before yüz/min)", () => {
        const d = createAzerbaijani();
        expect(d.text("21").trim()).toBe("ijiɾmˈi bˈiɾ"); // iyirmi bir
        expect(d.text("100").trim()).toBe("jˈyz"); // yüz (not bir yüz)
        expect(d.text("1985").trim()).toBe("mˈin doɡːˈuz jˈyz sæcsˈæn bˈeʃ"); // min doqquz yüz səksən beş
    });

    test("dotted-I tokenization: capital İ→i, capital I→ı (not dropped)", () => {
        const d = createAzerbaijani();
        expect(d.text("İki").trim()).toBe("icˈi"); // İ must NOT be dropped by the tokenizer
        expect(d.text("salam İki").trim()).toBe("sɑɫˈɑm icˈi");
        expect(d.text("Irəli").trim()).toBe("ɯɾælˈi"); // capital dotless I → ı
    });
});

// Roman-numeral ORDINAL policy (src/languages/azerbaijani/romanOrdinals.ts). az.wikipedia "Sıra sayı" gives a
// Roman numeral as one of the three ways to WRITE an ordinal ("Roma rəqəmlərindən sonra heç bir şəkilçi
// işlədilmir", with XX əsr / IX sinif as its examples), so XIX əsr is *on doqquzuncu əsr*. Suffixing rule over
// the language's own cardinals with four-way harmony; no gender, so no agreement limitation.
describe("Azerbaijani roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("four-way harmony of the ordinal suffix; only the last element takes it", () => {
        expect(ord(1)).toBe("birinci");
        expect(ord(2)).toBe("ikinci"); // vowel-final stem → no linking vowel
        expect(ord(4)).toBe("dördüncü"); // ö → ü class
        expect(ord(9)).toBe("doqquzuncu"); // u class
        expect(ord(19)).toBe("on doqquzuncu");
        expect(ord(40)).toBe("qırxıncı"); // ı class
        expect(ord(50)).toBe("əllinci");
        expect(ord(63)).toBe("altmış üçüncü"); // past 50 — anniversary / congress range
        expect(ord(80)).toBe("səksəninci"); // ə → i class
        expect(ord(90)).toBe("doxsanıncı"); // a → ı class
        expect(ord(100)).toBe("yüzüncü");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["əsr", "əsrdə", "əsrin", "əsri", "əsrlər", "yüzillik", "minillik", "ildönümü", "sinif"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("əsas")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("az").text("on doqquzuncu əsr").trim()).toBe("ˈon doɡːuzund͡ʒˈu ˈæsɾ");
        expect(getPhonemizer("az").text("əllinci ildönüm").trim()).toBe("ællind͡ʒˈi ildœnˈym");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("az").text("xix").trim()).toBe("ˈon doɡːˈuz"); // on doqquz, not on doqquzuncu
    });
});

// TEXT NORMALIZATION (src/languages/azerbaijani/normalize.ts) — the pre-tokenizer pass. The
// defining rule is the `N-ci` ordinal (written suffix cı/ci/cu/cü, spoken -ıncı/-inci/-uncu/-üncü on the
// last cardinal word). Also space-grouped thousands, comma decimals, clocks, era markers, percent with a
// possessive suffix, degrees, rates, version dots, units, currency, signs and initialisms.
describe("Azerbaijani text normalization", () => {
    const ph = (s: string): string => getPhonemizer("az").text(s).trim();

    test("ordinal words: -ıncı/-inci/-uncu/-üncü on the last word under four-way harmony", () => {
        expect(ordinalWords(7)).toBe("yeddinci");
        expect(ordinalWords(24)).toBe("iyirmi dördüncü");
        expect(ordinalWords(190)).toBe("yüz doxsanıncı");
        expect(ordinalWords(1000)).toBe("mininci");
        expect(ordinalWords(1767)).toBe("min yeddi yüz altmış yeddinci");
    });

    test("text→text: the `N-ci` ordinal becomes the ordinal words", () => {
        expect(normalizeAzerbaijani("1767-ci ildə")).toBe("min yeddi yüz altmış yeddinci ildə");
        expect(normalizeAzerbaijani("190-cı yerdə")).toBe("yüz doxsanıncı yerdə");
        expect(normalizeAzerbaijani("24-cü pillədə")).toBe("iyirmi dördüncü pillədə");
        expect(normalizeAzerbaijani("7-ci ən böyük")).toBe("yeddinci ən böyük");
    });

    test("space-grouped thousands de-group; the comma is a DECIMAL (tam)", () => {
        expect(ph("400 000 bilinən hal")).toBe("dˈœɾd jˈyz mˈin bilinˈæn hˈɑɫ");
        expect(ph("6,5 bal")).toBe("ɑɫtˈɯ tˈɑm bˈeʃ bˈɑɫ");
    });

    test("clocks read hour [minute]; GMT/UTC letter-spell", () => {
        expect(ph("12:00 GMT")).toBe("ˈon icˈi ɟˈe ˈem tˈe");
        expect(ph("21:20 hesabı")).toBe("ijiɾmˈi bˈiɾ ijiɾmˈi hesɑbˈɯ");
    });

    test("era markers and dotted abbreviations expand; the V. initial dot goes", () => {
        expect(ph("e.ə. 323-cü ildə")).toBe("eɾɑmɯzdˈɑn ævvˈæl ˈyt͡ʃ jˈyz ijiɾmˈi yt͡ʃynd͡ʒˈy ildˈæ");
        expect(ph("Dr. Moll")).toBe("doktˈoɾ mˈoɫɫ");
        expect(ph("Corc V. Buş")).toBe("d͡ʒˈoɾd͡ʒ v bˈuʃ");
    });

    // ⚠ AN ERA MARKER MAY END THE SENTENCE, and then its final dot IS the sentence period. The end-of-string
    // branch used to ask for a doubled dot (the bodies already carry one), so it never fired and the pause
    // was consumed with the marker.
    test("a sentence-final era marker keeps its clause break", () => {
        expect(normalizeAzerbaijani("Məbəd e.ə.")).toBe("Məbəd eramızdan əvvəl.");
        expect(normalizeAzerbaijani("Məbəd b.e.ə.")).toBe("Məbəd eramızdan əvvəl.");
        // ...and mid-sentence it must still NOT gain one.
        expect(normalizeAzerbaijani("e.ə. 323-cü ildə")).toBe("eramızdan əvvəl üç yüz iyirmi üçüncü ildə");
    });

    // ⚠ `b.e.` IS THE COMMON ERA, NOT BEFORE IT — *bizim eramız*. Reading it as BCE inverted every date it
    // touched, and the corpus's own instance is the Early Middle Ages, "(BE 1000-1300)", which are CE.
    // `b.e.ə.` is the full spelling of BCE, and it must beat the `e.ə.` entry to its own tail.
    test("the two eras are different abbreviations: b.e. is CE, e.ə. and b.e.ə. are BCE", () => {
        expect(normalizeAzerbaijani("b.e. 1200-cü ildə")).toBe("bizim eramız min iki yüzüncü ildə");
        expect(normalizeAzerbaijani("BE 1000")).toBe("bizim eramız 1000");
        expect(normalizeAzerbaijani("b.e.ə. 500-cü ildə")).toBe("eramızdan əvvəl beş yüzüncü ildə"); // was *b. eramızdan…*
        expect(normalizeAzerbaijani("e.ə. 500-cü ildə")).toBe("eramızdan əvvəl beş yüzüncü ildə");
    });

    // ⚠ A MISSING LETTER NAME IS NOT A PARTIAL SPELLING: `spellOut` declines the WHOLE run, so the token
    // reaches the phoneme sink as raw ASCII. ⟨q⟩ and ⟨ğ⟩ are the language's own letters and were absent.
    test("q and ğ have letter names, so an acronym carrying them spells out", () => {
        expect(ph("QHT nümayəndəsi")).toBe("ɡˈe hˈe tˈe nymɑjændæsˈi"); // was *ɡht*
        expect(ph("QVC kanalı")).toBe("ɡˈe vˈe d͡ʒˈe kɑnɑɫˈɯ"); // was *ɡvd͡ʒ*
        expect(ph("Q&A bölməsi")).toBe("ɡˈe vˈæ ˈɑ bœlmæsˈi"); // was *x və a*, the q devoiced word-finally
    });

    test("percent takes ANY case suffix, with the linking vowel an n-initial one needs", () => {
        expect(ph("30%-i")).toBe("otˈuz fɑizˈi");
        expect(ph("88%-ni")).toBe("sæcsˈæn sæcːˈiz fɑizinˈi"); // faizini — *faizni is not a possible cluster
        expect(ph("46%-dən")).toBe("ɡˈɯɾx ɑɫtˈɯ fɑizdˈæn"); // was read as a bare word: *faiz dən*
        expect(ph("1%-nin")).toBe("bˈiɾ fɑizinˈin");
        expect(ph("100%")).toBe("jˈyz fɑˈiz");
    });

    // NINE of the corpus's twenty-one clocks carry a case suffix, and it belongs ON the last spoken word.
    test("a clock's case suffix is glued to the last word and harmonised to it", () => {
        expect(ph("10:00-da başladı")).toBe("ondˈɑ bɑʃɫɑdˈɯ"); // onda, not *on dɑ*
        expect(ph("01:15-də")).toBe("bˈiɾ ˈon beʃdˈæ");
        expect(ph("23:35-ə")).toBe("ijiɾmˈi ˈyt͡ʃ otˈuz beʃˈæ");
        expect(ph("8:46-da")).toBe("sæcːˈiz ɡˈɯɾx ɑɫtɯdˈɑ");
        // the written suffix agrees with the DIGITS, the spoken one with the WORDS: -dan after `bir` is -dən
        expect(normalizeAzerbaijani("11:00-dan")).toBe("on birdən");
    });

    test("a fraction is denominator-locative + numerator, and the locative harmonises", () => {
        expect(ph("29¾ düym")).toBe("ijiɾmˈi doɡːˈuz dœɾdːˈæ ˈyt͡ʃ dˈyjm"); // ¾ is 3/4, not *üçdə dörd*
        expect(normalizeAzerbaijani("1/10")).toBe("onda bir"); // not *ondə*
        expect(normalizeAzerbaijani("1/6")).toBe("altıda bir");
        expect(normalizeAzerbaijani("1/5")).toBe("beşdə bir");
    });

    test("a period-thousands survives a following word, and a sports time is not a clock", () => {
        expect(ph("1.234 nəfər")).toBe("mˈin icˈi jˈyz otˈuz dˈœɾd næfˈæɾ"); // was *1 nöqtə 234nəfər*
        expect(normalizeAzerbaijani("4:41.30")).toBe("4:41.30"); // untouched: not a clock, not a version
        expect(normalizeAzerbaijani("saat 11:20.")).toBe("saat on bir iyirmi."); // a clause may end on a clock
    });

    test("rates read prefixed (saatda/saniyədə); version dots read nöqtə; units compose", () => {
        expect(ph("165 km/s")).toBe("sɑɑtdˈɑ jˈyz ɑɫtmˈɯʃ bˈeʃ ciɫomˈetɾ");
        expect(ph("133 m/s")).toBe("sɑnijædˈæ jˈyz otˈuz ˈyt͡ʃ mˈetɾ");
        expect(ph("2.4Ghz")).toBe("icˈi nœɡtˈæ dˈœɾd ɟiɡɑhˈeɾs");
        expect(ph("802.11n standartı")).toBe("sæcːˈiz jˈyz icˈi nœɡtˈæ ˈon bˈiɾ n stɑndɑɾtˈɯ");
        expect(ph("19500 km²-dir")).toBe("ˈon doɡːˈuz mˈin bˈeʃ jˈyz kvɑdɾˈɑt ciɫomˈetɾ dˈiɾ");
        expect(ph("80 km (50 mil)")).toBe("sæcsˈæn ciɫomˈetɾ ællˈi mˈil");
    });

    test("signs and fractions read; currency and regnal ordinals expand", () => {
        expect(ph("+30°C")).toBe("ystæɟˈæl otˈuz dæɾæd͡ʒˈæ selsˈi");
        expect(ph("1000$ məbləğində")).toBe("mˈin doɫɫˈɑɾ mæblæɣindˈæ");
        expect(ph("24½ düym")).toBe("ijiɾmˈi dˈœɾd jɑɾˈɯm dˈyjm");
        expect(ph("1/5 düym")).toBe("beʃdˈæ bˈiɾ dˈyjm");
        expect(ph("II Dünya Müharibəsində")).toBe("icind͡ʒˈi dynjˈɑ myhɑɾibæsindˈæ");
    });

    test("initialisms spell out by Azerbaijani letter name; ABŞ stays the word [ɑbʃ]", () => {
        expect(ph("BMT həm də")).toBe("bˈe ˈem tˈe hˈæm dˈæ");
        expect(ph("ABŞ imperializminin")).toBe("ˈɑbʃ impeɾiɑlizminˈin");
    });

    // ⚠ THE DOTLESS I IS THE WHOLE TEST. `I` names the letter *ı*, and JS `toLowerCase` folds it to dotted
    // `i` — which the letter-name table happily answers with *i*, the WRONG letter. The initialism pass
    // was fixed with `azLower`; the `X&Y` arm still had the plain fold, so it read *i və o*.
    test("the ampersand letter-pair uses AZERBAIJANI lowercase, so I names ı and not i", () => {
        expect(normalizeAzerbaijani("I&O şirkəti")).toBe("ı və o şirkəti");
        expect(normalizeAzerbaijani("A&B şirkəti")).toBe("a və be şirkəti");
        expect(ph("I&O şirkəti")).toBe("ˈɯ vˈæ ˈo ʃiɾcætˈi");
    });
});
