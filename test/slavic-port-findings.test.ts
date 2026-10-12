/**
 * Czech, Slovak, Belarusian, Bulgarian and Macedonian defects the Rust port found (#1535), fixed TS-first.
 * Probe text is synthetic; the expectations are the fixed engine's output, checked against what each fix
 * intends (docs/investigations/rust-port/rust_{cs,sk,be,bg,mk}_port_investigation.md, Run 7).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeCzech } from "../src/languages/czech/normalize.ts";
import { normalizeSlovak } from "../src/languages/slovak/normalize.ts";
import { normalizeBelarusian } from "../src/languages/belarusian/normalize.ts";
import { normalizeBulgarian } from "../src/languages/bulgarian/normalize.ts";
import { normalizeMacedonian } from "../src/languages/macedonian/normalize.ts";

describe("Czech port findings (#1535)", () => {
    test("an inflected ordinal outside 1–999 is left as written, not thrown on", () => {
        expect(normalizeCzech("Ve 1000. století.")).toBe("Ve 1000. století.");
        expect(normalizeCzech("V 0. letech")).toBe("V 0. letech");
        expect(normalizeCzech("1000. září")).toBe("1000. září");
        expect(normalizeCzech("na 1000. místě")).toBe("na 1000. místě");
        expect(normalizeCzech("po 1000. hodině")).toBe("po 1000. hodině");
        expect(normalizeCzech("na 1000. a 5. místě")).toBe("na 1000. a pátém místě");
        // In a century list only the out-of-range item stays as written.
        expect(normalizeCzech("Ve 12. a 1000. století")).toBe("Ve dvanáctém a 1000. století");
    });

    test("the regnal rule does not read the number after a sentence's first word", () => {
        expect(normalizeCzech("Mám 3 psy")).toBe("Mám 3 psy");
        expect(normalizeCzech("Je to Karel 4 a jeho")).toBe("Je to Karel čtvrtý a jeho");
    });

    test("the `N. N.` date keeps a sentence-final period", () => {
        expect(normalizeCzech("Bylo to dne 5. 5.")).toBe("Bylo to dne pátého pátého.");
        expect(phonemize("Bylo to dne 5. 5.", "cs")).toMatch(/ \.$/u);
    });

    test("a closing abbreviation before a capital keeps its dot as the sentence end", () => {
        expect(normalizeCzech("slovo atd. Potom.")).toBe("slovo a tak dále. Potom.");
        expect(normalizeCzech("atd. potom")).toBe("a tak dále potom");
        // Any other abbreviation's capital is its object.
        expect(normalizeCzech("Dr. Novák")).toBe("doktor Novák");
        expect(normalizeCzech("stojí 50 mil. Kč")).toBe("stojí 50 milionů Kč");
    });

    test("the century's locative needs the preposition v/ve, not a word ending in it", () => {
        expect(normalizeCzech("Město Kyjev 12. století")).toBe("Město Kyjev dvanáctého století");
        expect(normalizeCzech("ve 12. století")).toBe("ve dvanáctém století");
    });

    test("a fraction with any numerator is read, agreeing with it", () => {
        expect(normalizeCzech("2/3 a 4/5 a 5/8 a 21/100")).toBe("dvě třetí a čtyři páté a pět osmých a dvacetjedna stých");
        expect(normalizeCzech("1/5")).toBe("jedna pátá");
        // A vulgar fraction beside an ASCII `x` keeps the multiplication word.
        expect(phonemize("29¾ x 24½", "cs")).toContain("krˈaːt");
    });

    test("decomposed input reads like composed", () => {
        expect(phonemize("děti", "cs")).toBe(phonemize("děti", "cs"));
        expect(phonemize("Něco", "cs")).toBe(phonemize("Něco", "cs"));
        expect(phonemize("děti", "cs")).toBe("ɟˈɛcɪ");
    });
});

describe("Slovak port findings (#1535)", () => {
    test("an out-of-range item in an ordinal list keeps one comma", () => {
        expect(normalizeSlovak("V 1000., 5. storočí.")).toBe("V 1000., piatom storočí.");
    });

    test("a closing abbreviation before a capital keeps its dot as the sentence end", () => {
        expect(normalizeSlovak("Atď. Potom.")).toBe("a tak ďalej. Potom.");
        expect(normalizeSlovak("atď. potom")).toBe("a tak ďalej potom");
        expect(normalizeSlovak("Dr. Novák")).toBe("doktor Novák");
    });

    test("decomposed input reads like composed", () => {
        expect(phonemize("ľad", "sk")).toBe(phonemize("ľad", "sk"));
        expect(phonemize("ľad", "sk")).toBe("ʎˈat");
    });
});

describe("Belarusian port findings (#1535)", () => {
    test("a folded near-miss of a dotted abbreviation is left alone in all three arms", () => {
        expect(normalizeBelarusian("гэта ᲃт. слова")).toBe("гэта ᲃт. слова");
        expect(normalizeBelarusian("гэта ᲃт., слова")).toBe("гэта ᲃт., слова");
        expect(normalizeBelarusian("гэта ᲃт.")).toBe("гэта ᲃт.");
        expect(phonemize("гэта ᲃт. слова", "be")).not.toContain("ˌʌndɪfˈaᶦnd");
    });

    test("a fraction before a full stop or a comma is read", () => {
        expect(normalizeBelarusian("1/2.")).toBe("адна другая.");
        expect(normalizeBelarusian("5/8, і")).toBe("пяць восьмых, і");
        // A digit beyond the dot is a dotted date, still refused.
        expect(normalizeBelarusian("29/30.10.1937")).toBe("29/30.10.1937");
    });

    test("a list-closing abbreviation before a capital keeps its dot", () => {
        expect(normalizeBelarusian("кнігі і інш. Потым")).toBe("кнігі і іншае. Потым");
        expect(normalizeBelarusian("кнігі і г.д. Потым")).toBe("кнігі і гэтак далей. Потым");
        // A preposed abbreviation's capital is its object; a year's is not taken as a sentence end (measured).
        expect(normalizeBelarusian("Гл. Потым")).toBe("глядзі Потым");
        expect(normalizeBelarusian("у 1990 г. Потым")).toBe("у 1990 года Потым");
    });
});

describe("Bulgarian port findings (#1535)", () => {
    test("ѝ and ѐ are read", () => {
        expect(phonemize("и ѝ каза", "bg")).toBe("i i kaza");
        expect(phonemize("ЍЀ", "bg")).toBe("iɛ");
    });

    test("млн. and млрд. after a figure are expanded", () => {
        expect(normalizeBulgarian("1,5 млн. души")).toBe("1 цяло и 5 милиона души");
        expect(normalizeBulgarian("340 млн. до 500")).toBe("340000000 до 500");
        expect(normalizeBulgarian("общо 2 млрд.")).toBe("общо 2000000000.");
    });

    test("the ordinal suffix picks the form that ends with it", () => {
        expect(normalizeBulgarian("1-ви, 2-ри, 3-ти, 4-о, 5-та, 7-ми, 15-то, 37-ата, 190-то, 21-ви, 11-и, 1-вия"))
            .toBe("първи, втори, трети, четвърто, пета, седми, петнайсето, трийсет и седмата, сто и деветдесето, двайсет и първи, единайсети, първия");
        expect(phonemize("1-ви клас", "bg")).toBe("pɤrvi kɫas");
        // The definite cardinal and a compound adjective are left as written.
        expect(normalizeBulgarian("50-те години")).toBe("50-те години");
        expect(normalizeBulgarian("28-годишен")).toBe("28-годишен");
    });

    test("ч. after a clock time is the word часа", () => {
        expect(normalizeBulgarian("в 12:05 ч.")).toBe("в 12 05 часа.");
        expect(normalizeBulgarian("в 12:00 ч. GMT")).toBe("в 12 00 часа GMT");
        expect(normalizeBulgarian("в 10:00 ч.сутринта")).toBe("в 10 00 часа сутринта");
    });
});

describe("Macedonian port findings (#1535)", () => {
    test("a Russian-spelled name is read whole, in its Macedonian spelling", () => {
        expect(phonemize("Юрий Гагарин", "mk")).toBe(phonemize("Јуриј Гагарин", "mk"));
        expect(phonemize("Юрий Гагарин", "mk")).toBe("jˈurij ɡˈaɡarin");
        expect(phonemize("Щукин, Наталья, Ёлкин", "mk")).toBe("ʃtˈukin , nˈatalja , jˈɔɫkin");
    });

    test("итн. before a capital keeps its dot as the sentence end", () => {
        expect(normalizeMacedonian("итн. Потоа")).toBe("и така натаму. Потоа");
        expect(normalizeMacedonian("итн. потоа")).toBe("и така натаму потоа");
    });

    test("a fraction with any numerator is read, agreeing with it", () => {
        expect(normalizeMacedonian("2/3 од нив")).toBe("две третини од нив");
        expect(normalizeMacedonian("1/5 и 21/2 и 11/3")).toBe("една петтина и дваесет и една половина и единаесет третини");
    });

    test("the regnal rule does not read the number after a sentence's first word", () => {
        expect(normalizeMacedonian("Македонија 2.")).toBe("Македонија 2.");
        expect(normalizeMacedonian("главатар Лиалофи 3.")).toBe("главатар Лиалофи трети.");
    });
});
