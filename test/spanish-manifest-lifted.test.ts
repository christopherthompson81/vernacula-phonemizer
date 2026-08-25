/**
 * Spanish's word tables come from spanish.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 *
 * ⚠ THE ORDINAL TABLE HAS THREE CALLERS, not one: the Roman-numeral policy, the ordinal INDICATORS
 * (1º / 1ª / 1er) and the fraction rule. It lives in the manifest rather than beside any of them.
 *
 * ⚠ AND `months` IS DEAD IN `es` AND LIVE IN `es-419`. In Spain the date rule rewrites `1 de enero` to
 * *uno de enero*, which is what the number path says anyway, and `1º de enero` has already been claimed by
 * the ordinal-indicator rule upstream — so the table changes nothing. Only the Americas branch (*primero
 * de enero*) depends on it. A sweep run against `es` alone scores it 0 and would be wrong to conclude it
 * is dead.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/spanish/manifest.ts";

/**
 * ⚠ SPIRANTIZATION IS FOLDED OUT HERE, AND ONLY HERE. Spanish b/d/ɡ → β/ð/ɣ is POST-LEXICAL — it crosses
 * the word boundary — so a word phonemized standing alone begins with the STOP (`diβiðiðo`) while the same
 * word inside a phrase begins with the FRICATIVE (`ðiβiðiðo`). Comparing the two without folding fails on
 * every word starting with b, d or ɡ, and it fails for a reason that has nothing to do with which WORD the
 * rule chose — which is the only axis these tests are about. The spirantization axis itself is covered by
 * the engine's own tests; folding it here does not leave it unwitnessed.
 */
const fold = (ipa: string): string => ipa.replace(/β/gu, "b").replace(/ð/gu, "d").replace(/ɣ/gu, "ɡ");
const say = (s: string): string => fold(phonemize(s, "es").replace(/[ˈˌ]/gu, ""));
const say419 = (s: string): string => fold(phonemize(s, "es-419").replace(/[ˈˌ]/gu, ""));

describe("spanish reads its lifted tables", () => {
    test("a. m. and p. m. are COMPOSED from the letter names, not held as two more literals", () => {
        // The reading is ⟨a⟩/⟨p⟩ followed by ⟨m⟩ said as letter names — [a ˈeme], [pe ˈeme].
        // ⚠ THIS ONE CANNOT CATCH ITS OWN DECOUPLING, and saying so is the point. Re-hardcoding "a eme"
        // produces output identical to the composition while the data agrees, so no assertion here can
        // separate them; the guard that actually holds the composition together is the manifest-sabotage
        // sweep (wrecking `letterNames` moves 3 readings, these two among them). What this test pins is the
        // RELATION — that the half-day reading IS the two letter names — which is the fact a future editor
        // would otherwise have to rediscover.
        const a = MANIFEST.letterNames["a"]!, p = MANIFEST.letterNames["p"]!, m = MANIFEST.letterNames["m"]!;
        expect(say("a las 7:30 a. m.")).toContain(say(`${a} ${m}`));
        expect(say("a las 10:08 p. m.")).toContain(say(`${p} ${m}`));
    });

    test("the ordinal table serves all three of its callers", () => {
        const twelfth = MANIFEST.ordinals.teens[2]!; // duodécimo
        expect(say("El 12º puesto")).toContain(say(twelfth));   // the ordinal INDICATOR
        // ⚠ `siglo XII` would NOT do: Spanish reads a century as a CARDINAL (siglo doce), so the Roman
        // policy only reaches the ordinal after one of the nouns it names — aniversario is one.
        expect(say("XII aniversario")).toContain(say(twelfth)); // the Roman policy
        expect(say("1/12 del total")).toContain(say(twelfth));  // the fraction rule
        expect(say("El 1000º día")).toContain(say(MANIFEST.ordinals.thousandth));
    });

    test("the fraction numerator is the APOCOPATED un, not numbers.ones[1]", () => {
        expect(MANIFEST.fractions.numeratorOne).not.toBe(MANIFEST.numbers.ones[1]);
        expect(say("1/5 del total")).toContain(say(MANIFEST.fractions.numeratorOne));
        expect(say("1/5 del total")).not.toContain(say(`${MANIFEST.numbers.ones[1]!} `));
    });

    test("the suppletive fraction denominators beat the ordinal", () => {
        expect(say("1/2 de la torta")).toContain(say(MANIFEST.fractions.denominators["2"]!));
        expect(say("1/3 del total")).toContain(say(MANIFEST.fractions.denominators["3"]!));
        // 1/4 has no suppletive name, so it takes the ordinal.
        expect(say("3/4 de hora")).toContain(say(MANIFEST.ordinals.units[4]!));
    });

    test("the clock feminises through feminineOne", () => {
        expect(say("a la 1:15 de la tarde")).toContain(say(MANIFEST.feminineOne));
        expect(say("a la 1:15 de la tarde")).not.toContain(say(` ${MANIFEST.numbers.ones[1]!} `));
    });

    test("months is dead in es and live in es-419 — the variant decides", () => {
        const first = MANIFEST.ordinals.units[1]!; // primero
        expect(say419("El 1 de enero")).toContain(say419(first));
        expect(say("El 1 de enero")).toContain(say(MANIFEST.numbers.ones[1]!));
        expect(say("El 1 de enero")).not.toContain(say(first));
        // Every declared month reaches the Americas rule, including both spellings of September.
        for (const mon of ["enero", "septiembre", "setiembre", "diciembre"]) {
            expect(MANIFEST.months).toContain(mon);
            expect(say419(`El 1 de ${mon}`)).toContain(say419(first));
        }
    });

    test("the sign words are one source, shared with the symbol tier", () => {
        expect(say("4 = 4")).toContain(say(MANIFEST.signWords.equals));
        expect(say("±5")).toContain(say(MANIFEST.signWords.plusMinus));
        expect(say("20 ÷ 5")).toContain(say(MANIFEST.signWords.dividedBy));
        // ⟨×⟩ goes through the tier and the comparatives through normalize — one table for both.
        expect(say("4 × 4 tracción")).toContain(say(MANIFEST.signWords.times));
        expect(say("B&B")).toContain(say(MANIFEST.signWords.ampersand));
    });

    test("the bare exponent is the PREDICATE, not the unit modifier", () => {
        // "veinte al cuadrado" vs "kilómetros cuadrados" — different words, two keys.
        expect(MANIFEST.symbols.bareExponent.squared).not.toBe(MANIFEST.symbols.exponentWords.squared[0]);
        expect(say("20² es el resultado")).toContain(say("al cuadrado"));
        expect(say("25 km² de área")).toContain(say(MANIFEST.symbols.exponentWords.squared[1]!));
    });

    test("every other lifted table is reached by some reading", () => {
        expect(say("356 a. C.")).toContain(say(MANIFEST.eraMarkers.beforeChrist));
        expect(say("44 d. C.")).toContain(say(MANIFEST.eraMarkers.afterChrist));
        expect(say("EE. UU.")).toContain(say(MANIFEST.unitedStates));
        expect(say("n.º 5")).toContain(say(MANIFEST.numberSign));
        expect(say("El Sr. García")).toContain(say(MANIFEST.dottedAbbrev["sr"]!));
        expect(say("50 %")).toContain(say(MANIFEST.symbols.percent[0]!));
        expect(say("5 km")).toContain(say(MANIFEST.symbols.units["km"]![1]!));
        expect(MANIFEST.phonotactics.onsets).toContain("pl");
        expect(MANIFEST.phonotactics.codas).toContain("st");
    });
});
