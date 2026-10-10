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
        // Both halves: the HOUR (*dezesseis horas*) and the minutes (*dezessete*).
        expect(phonemize("16h17", "pt-BR")).toContain(phonemize("16 horas", "pt-BR"));
        expect(phonemize("16h17", "pt-BR")).toContain(phonemize("17", "pt-BR"));
        expect(phonemize("16h17", "pt")).toContain(phonemize("16 horas", "pt"));
        expect(phonemize("16h17", "pt")).toContain(phonemize("17", "pt"));
        expect(normalizePortuguese("Às 16h", true)).toBe("Às dezesseis horas");
        expect(phonemize("Às 16h", "pt-BR")).toBe("ˈas dezesˈejs ˈɔɾɐs");
    });
    test("pt keeps the European teens", () => {
        expect(normalizePortuguese("Às 16h17 em ponto")).toBe("Às dezasseis horas e dezassete em ponto");
        expect(normalizePortuguese("Às 16h")).toBe("Às dezasseis horas");
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
    test("a multi-group number is counted whole, not by its tail", () => {
        // The tail of each is 1; the one-separator capture counted only it and said *grau*.
        expect(normalizePortuguese("Mediu 2.000.001°")).toBe("Mediu 2.000.001 graus");
        expect(normalizePortuguese("Mediu 1.000.001 °C")).toBe("Mediu 1.000.001 graus Celsius");
        expect(normalizePortuguese("Mediu 1.001 °F")).toBe("Mediu 1.001 graus Fahrenheit");
        expect(phonemize("Mediu 1.000.001 °C", "pt")).toBe("mɨdˈiw ũ miʎˈɐ̃w̃ e ũ ɡɾˈawʃ sɛɫsˈiwʃ");
    });
    test("a spoken decimal part takes the plural", () => {
        // The tokenizer reads the comma as a decimal point (*um vírgula zero*), so the count is not one.
        expect(normalizePortuguese("Mediu 1,0 °C")).toBe("Mediu 1,0 graus Celsius");
        expect(normalizePortuguese("Mediu 1,000 °C")).toBe("Mediu 1,000 graus Celsius");
        expect(phonemize("Mediu 1,0 °C", "pt-BR")).toBe("med͡ʒˈiw ũ vˈiɾɡulɐ zˈɛɾu ɡɾˈaws sewsˈiws");
    });
    test("the count is the tokenizer's token", () => {
        // `0.1` is *zero . um* (a dot after a lone 0 is no group), so the noun agrees with *um*.
        expect(normalizePortuguese("Mediu 0.1 °C")).toBe("Mediu 0.1 grau Celsius");
        expect(normalizePortuguese("Mediu 21.1 °C")).toBe("Mediu 21.1 graus Celsius");
    });
    test("the singular and the plain decimal comma are unchanged", () => {
        expect(normalizePortuguese("Mediu 1 °C")).toBe("Mediu 1 grau Celsius");
        expect(normalizePortuguese("Mediu 1,5 °C")).toBe("Mediu 1,5 graus Celsius");
        // A dot after a lone 0 is not a group in the tokenizer either (`zero . cinco`).
        expect(normalizePortuguese("Mediu 0.5 °C")).toBe("Mediu 0.5 graus Celsius");
    });
});
