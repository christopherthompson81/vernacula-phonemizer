/**
 * Three Spanish defects the Rust port found by reading (#1463), fixed TS-first, plus the review's follow-ups.
 * Expected readings are the fixed engine's own output, not hand-typed IPA.
 */
import { afterEach, describe, expect, test } from "vitest";

import { phonemize, phonemizeTrace } from "../src/index.ts";
import { onPoison } from "../src/core/provenance.ts";
import { normalizeSpanish } from "../src/languages/spanish/normalize.ts";
import { multiplier, numberToWords } from "../src/languages/spanish/numbers.ts";

describe("Spanish: a multiplier apocopates before mil, a scale noun and a fraction noun", () => {
    test("uno → un, veintiuno → veintiún, in the multiplier only", () => {
        expect(numberToWords(21000)).toBe("veintiún mil");
        expect(numberToWords(31000)).toBe("treinta y un mil");
        expect(numberToWords(101000)).toBe("ciento un mil");
        expect(numberToWords(201000)).toBe("doscientos un mil");
        expect(numberToWords(21000000)).toBe("veintiún millones");
        expect(numberToWords(1001000000)).toBe("mil un millones");
        expect(numberToWords(1021000000)).toBe("mil veintiún millones");
        // The final group is not a multiplier: it keeps the full form.
        expect(numberToWords(21021)).toBe("veintiún mil veintiuno");
        expect(numberToWords(21000021)).toBe("veintiún millones veintiuno");
        expect(numberToWords(21)).toBe("veintiuno");
        expect(numberToWords(1000)).toBe("mil");
        expect(numberToWords(1000000)).toBe("un millón");
        expect(numberToWords(2000000)).toBe("dos millones");
        expect(multiplier("ciento uno")).toBe("ciento un");
        expect(multiplier("dos")).toBe("dos");
    });

    test("end to end, both varieties", () => {
        expect(phonemize("21.000 habitantes", "es")).toBe("beᶦntjˈun mˈil aβitˈantes");
        expect(phonemize("21000 personas", "es-419")).toBe("beᶦntjˈun mˈil peɾsˈonas");
    });

    test("a digit token before a WRITTEN mil or scale noun", () => {
        expect(phonemize("21 millones de personas", "es")).toBe("beᶦntjˈun miʎˈones ðe peɾsˈonas");
        expect(phonemize("21 mil", "es")).toBe("beᶦntjˈun mˈil");
        expect(phonemize("101 mil", "es-419")).toBe("sjˈento un mˈil");
        expect(phonemize("21 billones", "es")).toBe("beᶦntjˈun biʎˈones");
        expect(phonemize("1 millón", "es")).toBe("un miʎˈon");
        expect(phonemize("21 Millones", "es")).toBe("beᶦntjˈun miʎˈones");
        // Declines: a longer word starting with mil, any other noun, and a decimal.
        expect(phonemize("21 milímetros", "es")).toBe("beᶦntjˈuno milˈimetɾos");
        expect(phonemize("21 años", "es")).toBe("beᶦntjˈuno ˈaɲos");
        expect(phonemize("2,1 millones", "es")).toBe("dˈos kˈoma ˈuno miʎˈones");
    });

    test("every fraction numerator", () => {
        expect(normalizeSpanish("1/5")).toBe("un quinto");
        expect(normalizeSpanish("21/5")).toBe("veintiún quintos");
        expect(normalizeSpanish("21/100")).toBe("veintiún centésimos");
    });
});

describe("Spanish: the `er` indicator is the apocope of primero and tercero only", () => {
    test("1er, 3er and the compounds ending in them", () => {
        expect(normalizeSpanish("el 1er lugar")).toBe("el primer lugar");
        expect(normalizeSpanish("el 3er día")).toBe("el tercer día");
        expect(normalizeSpanish("1.er")).toBe("primer");
        expect(normalizeSpanish("21er")).toBe("vigésimo primer");
        expect(normalizeSpanish("13er")).toBe("decimotercer");
    });

    test("any other number drops the marker and reads the cardinal", () => {
        expect(normalizeSpanish("el 2er")).toBe("el 2");
        expect(normalizeSpanish("5er")).toBe("5");
        expect(normalizeSpanish("11er")).toBe("11");
        expect(normalizeSpanish("1001er")).toBe("1001");
        // ⚠ The `.` of a declined `2.er` is a phrase break if it survives.
        expect(phonemize("el 2.er piso", "es")).toBe("el dˈos pˈiso");
        expect(phonemize("2er", "es")).toBe("dˈos");
    });
});

describe("Spanish: the `er` trim is not on the provenance seam", () => {
    afterEach(() => onPoison(null));

    test("tracing 1er and 3er reports no poison", () => {
        const poison: string[] = [];
        onPoison((expected, got) => poison.push(`${expected} vs ${got}`));
        phonemizeTrace("el 1er lugar", "es");
        phonemizeTrace("el 3er día", "es-419");
        phonemizeTrace("la 1ª vez", "es"); // the feminine trim; already a plain replace here, not in C#
        expect(poison).toEqual([]);
    });
});
