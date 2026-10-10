/**
 * Portuguese defects the Rust port found by reading (#1463), fixed TS-first.
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
        // `0.1` is *zero ponto um* (a dot after a lone 0 is no group, #1490), and a spoken dot is not a
        // whole one, so the noun is plural — as it is after a spoken decimal comma.
        expect(normalizePortuguese("Mediu 0.1 °C")).toBe("Mediu 0.1 graus Celsius");
        expect(normalizePortuguese("Mediu 21.1 °C")).toBe("Mediu 21.1 graus Celsius");
    });
    test("the singular and the plain decimal comma are unchanged", () => {
        expect(normalizePortuguese("Mediu 1 °C")).toBe("Mediu 1 grau Celsius");
        expect(normalizePortuguese("Mediu 1,5 °C")).toBe("Mediu 1,5 graus Celsius");
        // A dot after a lone 0 is not a group in the tokenizer either (`zero ponto cinco`).
        expect(normalizePortuguese("Mediu 0.5 °C")).toBe("Mediu 0.5 graus Celsius");
    });
});

describe("a dot is a thousands separator only in the thousands shape (#1490)", () => {
    test("non-grouping dots are spoken, each group read as a number", () => {
        // Each of these was read as ONE integer: *oitenta mil duzentos e onze*, *vinte e quatro*,
        // *cinquenta*, *onze*.
        expect(phonemize("O padrão 802.11n", "pt-BR")).toBe("o padɾˈɐ̃w̃ ojtosˈẽtus e dˈojs pˈõtu ˈõzi n");
        expect(phonemize("a 2.4 GHz", "pt-BR")).toBe("a dˈojs pˈõtu kwˈatɾu ɡs");
        expect(phonemize("a 5.0 GHz", "pt")).toBe("a sˈĩku pˈõtu zˈɛɾu ɡʃ");
        expect(phonemize("ver Figura 1.1.", "pt-BR")).toBe("vˈeɾ fiɡˈuɾɐ ũ pˈõtu ũ .");
    });
    test("a group with a leading zero, or of three or more digits, is spelled out", () => {
        expect(phonemize("2.05", "pt")).toBe("dˈojʃ pˈõtu zˈɛɾu sˈĩku");
        expect(phonemize("1.0000", "pt")).toBe("ũ pˈõtu zˈɛɾu zˈɛɾu zˈɛɾu zˈɛɾu");
        // The zero-head guard (#1015): `0.500` is not five hundred.
        expect(phonemize("0.500", "pt")).toBe("zˈɛɾu pˈõtu sˈĩku zˈɛɾu zˈɛɾu");
    });
    test("true thousands groups are unchanged", () => {
        expect(phonemize("17.000 ilhas", "pt-BR")).toBe("dezesˈɛt͡ʃi mˈiw ˈiʎɐs");
        expect(phonemize("5.000.000 visitantes", "pt-BR")).toBe("sˈĩku miʎˈõj̃s vizitˈɐ̃t͡ʃis");
    });
    test("the ordinal indicator reads the tokenizer's whole token", () => {
        // The old rule matched the TAIL `5º` and left *um . quinto* / *um , quinto*.
        expect(normalizePortuguese("o 1.5º lugar")).toBe("o 1.5 lugar");
        expect(normalizePortuguese("o 1,5º lugar")).toBe("o 1,5 lugar");
        expect(normalizePortuguese("a 1.5ª vez")).toBe("a 1.5 vez");
        expect(phonemize("o 1.5º lugar", "pt")).toBe("o ũ pˈõtu sˈĩku luɡˈaɾ");
        // Grouped and plain ordinals are unchanged.
        expect(normalizePortuguese("o 1.000º selo")).toBe("o milésimo selo");
        expect(normalizePortuguese("o 2.500º selo")).toBe("o 2.500 selo");
    });
    test("a spoken dot takes the plural degree noun", () => {
        expect(normalizePortuguese("Mediu 1.5 °C")).toBe("Mediu 1.5 graus Celsius");
        expect(phonemize("Mediu 1.5 °C", "pt-BR")).toBe("med͡ʒˈiw ũ pˈõtu sˈĩku ɡɾˈaws sewsˈiws");
    });
});
