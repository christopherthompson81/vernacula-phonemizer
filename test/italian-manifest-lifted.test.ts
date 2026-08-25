/**
 * Italian's word tables come from italian.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 *
 * ⚠ ITALIAN WAS THE ONLY PORTED LANGUAGE WHOSE ACRONYM LIST WAS NOT IN ITS MANIFEST — a bare
 * `new Set(["ia","ip","hiv"])` sat in normalize.ts beside a `letterNames` table and a phonotactics block
 * that were also inline. All three feed the SAME call site (`makeInitialismNormalizer`), so they are lifted
 * together and tested together.
 *
 * ⚠ AND THE ORDINAL TABLE IS 1–10 ONLY, unlike es and pt: Italian COMPOSES everything above ten from the
 * cardinal (venti → ventesimo), so a tens or hundreds row would be a second way to say the same thing.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/italian/manifest.ts";

const say = (s: string): string => phonemize(s, "it").replace(/[ˈˌ]/gu, "");

describe("italian reads its lifted tables", () => {
    test("the three initialism tables are one source, and each decides a different reading", () => {
        // letterNames: an unreadable run is spelled with them.
        expect(say("la porta USB rotta")).toContain(say(MANIFEST.letterNames["u"]!));
        expect(say("la porta USB rotta")).toContain(say(MANIFEST.letterNames["b"]!));
        // acronymLetters: a READABLE run that Italian nevertheless spells out.
        for (const a of MANIFEST.acronymLetters) expect(a).toBe(a.toLowerCase());
        expect(MANIFEST.acronymLetters).toContain("hiv");
        expect(say("l' HIV oggi")).toContain(say(MANIFEST.letterNames["h"]!));
        // phonotactics: a readable run NOT on the list is read as a word, not spelled.
        expect(say("la NASA e l' OPEC")).not.toContain(say(MANIFEST.letterNames["n"]!));
    });

    test("the codas are what separate a spelled run from a read one", () => {
        // ⚠ THE COMMENT IN THE JSONC NAMES THESE WORDS. Italian native words end in a vowel, so a
        // two-consonant tail is the signal — but the codas Italian tolerates in established loanwords
        // (film, sport, test, rock) must NOT be spelled out.
        for (const w of ["SPORT", "TEST", "FILM", "ROCK"])
            expect(say(`il ${w} oggi`)).not.toContain(say(MANIFEST.letterNames["t"]!));
        expect(MANIFEST.phonotactics.codas).toContain("rt");
        expect(MANIFEST.phonotactics.onsets).toContain("sp");
    });

    test("the ordinal table is the 1–10 irregular head only, the rest composed", () => {
        expect(Object.keys(MANIFEST.ordinals)).toHaveLength(10);
        expect(say("il 3º posto")).toContain(say(MANIFEST.ordinals["3"]!));
        expect(say("XI secolo")).toContain(say("undicesimo")); // composed, not tabled
        expect(say("il 1000º giorno")).toContain(say("millesimo"));
    });

    test("the fraction numerator is the apocopated un, and 1/2 is suppletive", () => {
        expect(say("1/2 della torta")).toContain(say(MANIFEST.fractions.denominators["2"]!));
        expect(say("1/5 del totale")).toContain(say(MANIFEST.fractions.numeratorOne));
        // …and every other denominator takes the ordinal, pluralised -o → -i.
        expect(say("3/4 di ora")).toContain(say("quarti"));
    });

    test("the relational readings carry the copula, unlike es and pt", () => {
        expect(MANIFEST.signWords.equals.startsWith("è ")).toBe(true);
        expect(say("4 = 4")).toContain(say(MANIFEST.signWords.equals));
        expect(say("3 < 5")).toContain(say(MANIFEST.signWords.lessThan));
        expect(say("20 ÷ 5")).toContain(say(MANIFEST.signWords.dividedBy));
        expect(say("4 × 4 trazione")).toContain(say(MANIFEST.signWords.times));
        expect(say("B&B")).toContain(say(MANIFEST.signWords.ampersand));
    });

    test("the compass reading beats the temperature and the ordinal on the same sign", () => {
        // ⚠ THREE SENSES OF ⟨°⟩ AND THE ORDER MATTERS: coordinate, temperature, ordinal indicator.
        expect(say("45° N di latitudine")).toContain(say(MANIFEST.compass["n"]!));
        expect(say("20 °C")).toContain(say(MANIFEST.degree.celsius));
        expect(say("il 1º della lista")).toContain(say(MANIFEST.ordinals["1"]!));
    });

    test("⚠ the degree noun is ALWAYS PLURAL — pinned as a KNOWN DEFECT, not as correct", () => {
        // `1 °C` reads *uno gradi Celsius*. Pre-existing; this lift moved the word, not the agreement.
        // ⚠ Italian needs MORE than the pt fix did: the noun must agree AND the numeral must apocopate
        // (*un grado*, not *uno grado*). Left for its own change; asserted so the bug is visible here.
        expect(say("1 °C soltanto")).toContain(say(MANIFEST.degree.word));
        expect(say("20 °C")).toContain(say(MANIFEST.degree.word));
    });

    test("every other lifted table is reached by some reading", () => {
        expect(say("356 a. C.")).toContain(say(MANIFEST.eraMarkers.beforeChrist));
        expect(say("44 d. C.")).toContain(say(MANIFEST.eraMarkers.afterChrist));
        expect(say("n. 1 della lista")).toContain(say(MANIFEST.numberSign));
        expect(say("il Sig. Rossi")).toContain(say(MANIFEST.dottedAbbrev["sig"]!));
        expect(say("14,7 miliardi")).toContain(say(MANIFEST.decimalWord));
        expect(say("50 %")).toContain(say(MANIFEST.symbols.percent[0]!));
        expect(say("5 km")).toContain(say(MANIFEST.symbols.units["km"]![1]!));
        expect(say("banconote da 5 $")).toContain(say(MANIFEST.symbols.currency["$"]![1]!));
    });
});
