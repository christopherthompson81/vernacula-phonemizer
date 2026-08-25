/**
 * Portuguese's word tables come from portuguese.jsonc. Derived FROM the manifest, so what these catch is
 * DECOUPLING — a literal re-hardcoded in the code — rather than wrong data.
 *
 * ⚠ `months` IS DEAD IN `pt` AND LIVE IN `pt-BR`, the second language this sweep has found with that shape
 * (see the es lift). Brazil says *primeiro de julho*; Portugal normally *um de julho*, which is what the
 * number path says anyway. A sweep run against `pt` alone scores the table 0 and would be wrong.
 *
 * ⚠ TWO KEYS SPANISH HAS AND PORTUGUESE DOES NOT, both deliberate absences rather than oversights:
 * no `ordinals.teens` (Portuguese composes them regularly — décimo primeiro) and no
 * `fractions.numeratorOne` (Portuguese does not apocopate before the fraction noun: *um quinto*, where
 * Spanish needs *un quinto* against its own *uno*).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/portuguese/manifest.ts";

const say = (s: string): string => phonemize(s, "pt").replace(/[ˈˌ]/gu, "");
const sayBR = (s: string): string => phonemize(s, "pt-BR").replace(/[ˈˌ]/gu, "");

describe("portuguese reads its lifted tables", () => {
    test("months is dead in pt and live in pt-BR — the variant decides", () => {
        const first = MANIFEST.ordinals.units[1]!; // primeiro
        expect(sayBR("1 de julho")).toContain(sayBR(first));
        expect(say("1 de julho")).not.toContain(say(first));
        // An EXPLICIT 1º is honoured in BOTH, because there the writer marked it.
        expect(say("1º de julho")).toContain(say(first));
        for (const mon of ["janeiro", "março", "dezembro"]) {
            expect(MANIFEST.months).toContain(mon);
            expect(sayBR(`1 de ${mon}`)).toContain(sayBR(first));
        }
    });

    test("the ordinal table serves all three of its callers, with no teens row", () => {
        expect(MANIFEST.ordinals).not.toHaveProperty("teens");
        // Eleventh is COMPOSED: tens[1] + units[1].
        const eleventh = `${MANIFEST.ordinals.tens[1]!} ${MANIFEST.ordinals.units[1]!}`;
        expect(say("O 11º posto")).toContain(say(eleventh));
        expect(say("XII aniversário")).toContain(say(MANIFEST.ordinals.tens[1]!)); // the Roman policy
        expect(say("1/12 do total")).toContain(say(MANIFEST.ordinals.tens[1]!));   // the fraction rule
        expect(say("O 1000º dia")).toContain(say(MANIFEST.ordinals.thousandth));
    });

    test("the fraction numerator is NOT apocopated, unlike Spanish", () => {
        expect(MANIFEST.fractions).not.toHaveProperty("numeratorOne");
        // The plain cardinal serves: um quinto.
        expect(say("1/5 do total")).toContain(say(MANIFEST.numbers.small[1]!));
        expect(say("1/2 do bolo")).toContain(say(MANIFEST.fractions.denominators["2"]!));
        expect(say("1/3 do total")).toContain(say(MANIFEST.fractions.denominators["3"]!));
    });

    test("the clock SPEAKS its noun, and feminises the hour", () => {
        // Portuguese says the noun aloud where Spanish elides it — *sete horas e dezenove*.
        expect(say("07h19 começou")).toContain(say(MANIFEST.clock.hours));
        // ⚠ The connector assertion cannot catch its OWN decoupling — re-hardcoding "e" is observationally
        // identical while the data agrees, the same limit the es lift recorded for `a. m.`. The sweep is what
        // holds it (`clock` moves 8); this pins that the noun and the connector are spoken at all.
        expect(say("07h19 começou")).toContain(say(MANIFEST.clock.connector));
        expect(say("1h começou")).toContain(say(MANIFEST.clock.hour));
        expect(say("1h começou")).toContain(say(MANIFEST.feminineOne));
        expect(say("1h começou")).not.toContain(say(MANIFEST.clock.hours));
    });

    test("the real has its own word, and the dollar CODES fold to a bare sign", () => {
        expect(say("R$ 50")).toContain(say(MANIFEST.realWord));
        // ⚠ A COMPOUND `US$` KEY IN THE TIER WOULD BE UNREACHABLE — the initialism pass splits `US` into
        // letters first, leaving the `$` preceded by a letter where the tier's guard refuses it. Folding to
        // a bare `$` here is what makes the declared key reachable, so both must read the same.
        for (const code of MANIFEST.dollarCodes) expect(say(`${code}$ 100`)).toContain(say("$100"));
    });

    test("the degree noun AGREES with the count, and reads the whole number", () => {
        // ⚠ THIS TEST USED TO PIN THE OPPOSITE. Until the fix, the rule emitted the plural whatever the
        // count (`1 °C` → *um graus Celsius*) and this assertion recorded that as a known defect. It is the
        // test flipping that says the defect is gone.
        // ⚠ COMPARED AS WHOLE TOKENS, NOT SUBSTRINGS. The plural CONTAINS the singular — [ɡɾˈaw] is a prefix
        // of [ɡɾˈawʃ] — so `toContain` cannot tell them apart and a substring assertion passes either way.
        const words = (s: string): string[] => say(s).split(" ");
        const SG = say(MANIFEST.degree.singular), PL = say(MANIFEST.degree.plural);
        expect(SG).not.toBe(PL);
        expect(words("1 °C apenas")).toContain(SG);
        expect(words("1 °C apenas")).not.toContain(PL);
        expect(words("20 °C")).toContain(PL);
        expect(words("20 °C")).not.toContain(SG);
        // ⚠ AND THE COUNT IS THE WHOLE NUMBER, NOT ITS LAST DIGIT — the rule captured `(\d)` before the fix,
        // so `21` would have been read off the `1` and taken the singular.
        expect(words("21 °C")).toContain(PL);
        expect(words("21 °C")).not.toContain(SG);
        // 0 and a decimal both take the plural, the same selector the shared symbol tier defaults to.
        expect(words("0 °C")).toContain(PL);
        expect(words("1,5 °C")).toContain(PL);
        // The bare-degree rule agrees too, not just the scaled ones.
        expect(words("1° de ângulo")).toContain(SG);
        expect(words("35° de ângulo")).toContain(PL);
        expect(say("20 °C")).toContain(say(MANIFEST.degree.celsius));
        expect(say("70 °F")).toContain(say(MANIFEST.degree.fahrenheit));
    });

    test("the sign words are one source, shared with the symbol tier", () => {
        expect(say("4 = 4")).toContain(say(MANIFEST.signWords.equals));
        expect(say("±5")).toContain(say(MANIFEST.signWords.plusMinus));
        expect(say("20 ÷ 5")).toContain(say(MANIFEST.signWords.dividedBy));
        expect(say("4 × 4 tração")).toContain(say(MANIFEST.signWords.times));
        expect(say("B&B")).toContain(say(MANIFEST.signWords.ampersand));
    });

    test("every other lifted table is reached by some reading", () => {
        expect(say("356 a. C.")).toContain(say(MANIFEST.eraMarkers.beforeChrist));
        expect(say("44 d. C.")).toContain(say(MANIFEST.eraMarkers.afterChrist));
        expect(say("n.º 5")).toContain(say(MANIFEST.numberSign));
        expect(say("O Sr. Silva")).toContain(say(MANIFEST.dottedAbbrev["sr"]!));
        expect(say("50 %")).toContain(say(MANIFEST.symbolTier.percent[0]!));
        expect(say("5 km")).toContain(say(MANIFEST.symbolTier.units["km"]![1]!));
        // ⚠ LOWERCASE CONTEXT REQUIRED. "O CD" is entirely uppercase, which trips initialisms.ts's
        // all-caps-DOCUMENT guard and skips the pass altogether — the exact trap portuguese.ts's own note
        // records about an earlier "verification" of the US$ key. The probe needs a lowercase word beside it.
        expect(say("o CD tocou")).toContain(say(MANIFEST.letterNames["c"]!));
        expect(MANIFEST.phonotactics.onsets).toContain("pl");
        expect(MANIFEST.phonotactics.codas).toContain("st");
    });
});
