/**
 * Three Spanish defects the Rust port found by reading (#1463), fixed TS-first. Expected readings are the
 * fixed engine's own output, not hand-typed IPA.
 */
import { afterEach, describe, expect, test } from "vitest";

import { phonemize, phonemizeTrace } from "../src/index.ts";
import { onPoison } from "../src/core/provenance.ts";
import { normalizeSpanish } from "../src/languages/spanish/normalize.ts";
import { numberToWords } from "../src/languages/spanish/numbers.ts";

describe("Spanish: a multiplier apocopates before mil and a scale noun", () => {
    test("uno → un, veintiuno → veintiún, in the multiplier only", () => {
        expect(numberToWords(21000)).toBe("veintiún mil");
        expect(numberToWords(31000)).toBe("treinta y un mil");
        expect(numberToWords(101000)).toBe("ciento un mil");
        expect(numberToWords(201000)).toBe("doscientos un mil");
        expect(numberToWords(21000000)).toBe("veintiún millones");
        expect(numberToWords(1001000000)).toBe("mil un millones");
        expect(numberToWords(1021000000)).toBe("mil veintiún millones");
        // The final group is a pronoun-like cardinal, not a multiplier: it keeps the full form.
        expect(numberToWords(21021)).toBe("veintiún mil veintiuno");
        expect(numberToWords(21000021)).toBe("veintiún millones veintiuno");
        // Unchanged: 1 alone, 1000 and 10⁶ (their own words), and no multiplier ending in uno.
        expect(numberToWords(21)).toBe("veintiuno");
        expect(numberToWords(1000)).toBe("mil");
        expect(numberToWords(1000000)).toBe("un millón");
        expect(numberToWords(2000000)).toBe("dos millones");
    });

    test("end to end, both varieties", () => {
        expect(phonemize("21.000 habitantes", "es")).toBe("beᶦntjˈun mˈil aβitˈantes");
        expect(phonemize("21000 personas", "es-419")).toBe("beᶦntjˈun mˈil peɾsˈonas");
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

    test("any other number is not an indicator and stays as written", () => {
        expect(normalizeSpanish("el 2er")).toBe("el 2er");
        expect(normalizeSpanish("5er")).toBe("5er");
        expect(normalizeSpanish("11er")).toBe("11er");
        expect(phonemize("2er", "es")).toBe("dˈos ˈeɾ");
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
