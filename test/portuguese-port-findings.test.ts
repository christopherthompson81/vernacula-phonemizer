/**
 * Three Portuguese defects the Rust port found by reading (#1463), fixed TS-first.
 *
 * Expectations are the fixed engine's own output (words from `normalizePortuguese`, IPA from `phonemize`),
 * never hand-typed.
 */
import { describe, expect, test } from "vitest";
import { normalizePortuguese } from "../src/languages/portuguese/normalize.ts";
import { phonemize } from "../src/index.ts";

describe("the clock and fractions read the dialect's teens", () => {
    test("pt-BR clock says dezesseis/dezessete/dezenove", () => {
        expect(normalizePortuguese("Às 16h17 em ponto", true)).toBe("Às dezesseis horas e dezessete em ponto");
        expect(normalizePortuguese("Às 19:16", true)).toBe("Às dezenove horas e dezesseis");
        expect(phonemize("Às 16h17 em ponto", "pt-BR")).toBe("ˈas dezesˈejs ˈɔɾɐs e dezesˈɛt͡ʃi ẽj̃ pˈõtu");
    });
    test("the clock agrees with the number tokenizer in the same language", () => {
        expect(phonemize("16h17", "pt-BR")).toContain(phonemize("17", "pt-BR"));
        expect(phonemize("16h17", "pt")).toContain(phonemize("17", "pt"));
    });
    test("pt keeps the European teens", () => {
        expect(normalizePortuguese("Às 16h17 em ponto")).toBe("Às dezasseis horas e dezassete em ponto");
        expect(normalizePortuguese("Às 19:16")).toBe("Às dezanove horas e dezasseis");
    });
    test("pt-BR fraction numerator says dezessete", () => {
        expect(normalizePortuguese("Comeu 17/19 do bolo", true)).toBe("Comeu dezessete décimos nonos do bolo");
        expect(normalizePortuguese("Comeu 16/17 do bolo", true)).toBe("Comeu dezesseis décimos sétimos do bolo");
    });
});

describe("a plural compound-ordinal denominator inflects every word", () => {
    test("décimos nonos, not décimo nonos", () => {
        expect(normalizePortuguese("Comeu 17/19 do bolo")).toBe("Comeu dezassete décimos nonos do bolo");
        expect(normalizePortuguese("Comeu 2/21 do bolo")).toBe("Comeu dois vigésimos primeiros do bolo");
        expect(phonemize("Comeu 17/19 do bolo", "pt")).toBe("kumˈew dɨzɐsˈetɨ dˈɛsimuʃ nˈonuʃ do bˈolu");
    });
    test("single-word and singular denominators are unchanged", () => {
        expect(normalizePortuguese("Comeu 3/100 do bolo")).toBe("Comeu três centésimos do bolo");
        expect(normalizePortuguese("Comeu 1/19 do bolo")).toBe("Comeu um décimo nono do bolo");
    });
});

describe("the degree noun counts dot-grouped thousands", () => {
    test("1.000 °C is plural", () => {
        expect(normalizePortuguese("Mediu 1.000 °C")).toBe("Mediu 1.000 graus Celsius");
        expect(normalizePortuguese("Mediu 1.000 °F")).toBe("Mediu 1.000 graus Fahrenheit");
        expect(normalizePortuguese("Mediu 1.000°")).toBe("Mediu 1.000 graus");
        expect(phonemize("Mediu 1.000 °C", "pt-BR")).toBe("med͡ʒˈiw mˈiw ɡɾˈaws sewsˈiws");
    });
    test("the singular and the decimal comma are unchanged", () => {
        expect(normalizePortuguese("Mediu 1 °C")).toBe("Mediu 1 grau Celsius");
        expect(normalizePortuguese("Mediu 1,5 °C")).toBe("Mediu 1,5 graus Celsius");
        // A dot after a lone 0 is not a group in the tokenizer either (`zero . cinco`).
        expect(normalizePortuguese("Mediu 0.5 °C")).toBe("Mediu 0.5 graus Celsius");
    });
});
