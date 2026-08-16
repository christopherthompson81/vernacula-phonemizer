import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/aragonese/aragonese.ts";
import { numberToWords } from "../src/languages/aragonese/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";
import { normalizeAragonese } from "../src/languages/aragonese/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Aragonese / aragonés (an) — Ibero-Romance (Pyrenean), a Spanish-shaped shallow g2p.
// The hallmarks: ⟨ch⟩→[t͡ʃ] (where Spanish has [x]), ⟨ny⟩→[ɲ] (Catalan-style digraph), ⟨x⟩→[ʃ], ⟨v⟩→[b], distinción
// (z/c+e,i→[θ], NOT the seseo merger to [s]), and word-final ⟨-r⟩ apocope. Referee: wikipron arg_latn_broad
// (human). ⚠ Its folded score is dragged down by the referee's DUAL final-r forms, not by the engine.
describe("Aragonese (aragonés) canonical IPA", () => {
    test("the hallmark ⟨ch⟩→[t͡ʃ], ⟨ny⟩→[ɲ], ⟨x⟩→[ʃ]", () => {
        expect(phonemizeWord("Chesús")).toBe("t͡ʃesus"); // ⟨ch⟩→[t͡ʃ] (where Spanish has [x])
        expect(phonemizeWord("Espanya")).toBe("espaɲa"); // ⟨ny⟩→[ɲ] (the Catalan-style digraph)
        expect(phonemizeWord("baxo")).toBe("baʃo"); // ⟨x⟩→[ʃ]
        expect(phonemizeWord("chuego")).toBe("t͡ʃweɡo"); // ⟨ch⟩→[t͡ʃ]; ⟨u⟩→[w] rising glide (game)
    });

    test("distinción + ⟨ll⟩→[ʎ] + rising glides", () => {
        expect(phonemizeWord("abanza")).toBe("abanθa"); // ⟨z⟩→[θ] distinción (standard Aragonese)
        expect(phonemizeWord("cielo")).toBe("θjelo"); // ⟨c⟩ before e/i → [θ]; ⟨ie⟩→[je]
        expect(phonemizeWord("tierra")).toBe("tjera"); // ⟨ie⟩→[je]; ⟨rr⟩→[r] trill
        expect(phonemizeWord("fillo")).toBe("fiʎo"); // ⟨ll⟩→[ʎ] (son)
        expect(phonemizeWord("Aragón")).toBe("aɾaɡon"); // ⟨g⟩→[ɡ] (back vowel); single ⟨r⟩→[ɾ] tap
    });

    test("word-final ⟨-r⟩ apocope (the Aragonese trait)", () => {
        expect(phonemizeWord("cantar")).toBe("kanta"); // final ⟨-r⟩ dropped after a vowel (infinitive)
        expect(phonemizeWord("muller")).toBe("muʎe"); // ⟨ll⟩→[ʎ]; final ⟨-r⟩ dropped (woman)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("an").text("Chesús").trim()).toBe("t͡ʃesus");
    });

    // NUMBERS — decimal; the twenties FUSE (vintiun) while 30–90 take the ⟨y⟩ connector; 16–19 are the analytic
    // deci- series. Source: Mal de Lenguas "Los números en aragonés" + omniglot (aragonese.jsonc).
    test("numbers: units, the fused twenties, the ⟨y⟩ connector, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("siete");
        expect(numberToWords(16)).toBe("decisiéis"); // the deci- series, not Spanish dieciséis
        expect(numberToWords(21)).toBe("vintiun"); // fused, one word
        expect(numberToWords(31)).toBe("trenta y un"); // the ⟨y⟩ connector from 30 up
        expect(numberToWords(555)).toBe("cincocientos cinquanta y cinco");
        expect(numberToWords(12345)).toBe("dotze mil trecientos quaranta y cinco");
        expect(numberToWords(1000000)).toBe("un millón");
        expect(numberToWords(1000000000)).toBe("mil millons"); // Ibero long scale
    });

    test("numbers read through the g2p", () => {
        expect(getPhonemizer("an").text("21").trim()).toBe("bintjun"); // ⟨v⟩→b (betacism)
        expect(getPhonemizer("an").text("100").trim()).toBe("θjent"); // cient — distinción ⟨c⟩+i → θ
    });
});

// ── TEXT NORMALIZATION (src/languages/aragonese/normalize.ts) ───────────────────────────────────────
// The argument for every case is in the normalizer's own header. This round was picked as a test of
// trap 55 — Asturian is the closest sibling and was treated two rounds earlier — so the cases below are
// organised around which of its findings survived re-measurement here and which did not.
describe("Aragonese text normalization", () => {
    test("the separators: DOT groups, COMMA decimates, SPACE groups, short DOT decimates", () => {
        expect(normalizeAragonese("30.689")).toBe("30689");
        expect(normalizeAragonese("8.443.713")).toBe("8443713");
        expect(normalizeAragonese("450 295")).toBe("450295");
        expect(normalizeAragonese("1 000 000")).toBe("1000000"); // trap 63 — the whole number at once
        expect(normalizeAragonese("10.92")).toBe("10,92"); // fewer than three digits → a decimal
        expect(normalizeAragonese("21,9")).toBe("21,9"); // the comma is already the decimal
        // ⚠ a clause-final figure must survive (trap 58): the trailing guard rejects a DIGIT and nothing else.
        expect(normalizeAragonese("bellas 25.000 personas.")).toBe("bellas 25000 personas.");
    });

    test("⚠ `°` and `º` are SWAPPED, and the ALLOW-LIST is what tells the senses apart", () => {
        // both codepoints as a degree, in the corpus's own single sentence
        expect(normalizeAragonese("baixan d'os -10º.")).toBe("baixan d'os menos 10 graus .");
        expect(normalizeAragonese("de 3º y la de agosto de 21,9°")).toBe("de 3 graus y la de agosto de 21,9 graus ");
        expect(normalizeAragonese("28°C")).toBe("28 graus Celsius");
        // ⚠ the compass set is NSEU — Aragonese west is *ueste*, not *west*
        expect(normalizeAragonese("11°U y 12°E")).toBe("11 graus ueste y 12 graus este");
        // …and the ORDINAL written with a degree sign is left UNREAD rather than told to say a reading (trap 56)
        expect(normalizeAragonese("o 57° país mas gran")).toBe("o 57° país mas gran");
    });

    test("⚠ the colon is an athletics stopwatch — the clock rule must DECLINE six national records", () => {
        expect(normalizeAragonese("A las 17:07 se produce")).toBe("A las 17 07 se produce");
        expect(normalizeAragonese("a las 04:35 UTC")).toBe("a las 04 35 UTC");
        // a trailing `.dd` is what a stopwatch has and a clock has not
        expect(normalizeAragonese("3.000 metros obstaclos - 8:09.09 min")).toBe("3000 metros obstaclos - 8:09,09 min");
        expect(normalizeAragonese("un tiempo de 3:34.91")).toBe("un tiempo de 3:34,91");
        // …and the DMS coordinate the corpus glosses for itself carries a second colon
        expect(normalizeAragonese("eixemplo 41:20:00")).toBe("eixemplo 41:20:00");
    });

    test("⚠ the minus sign must not claim the athletics list separator", () => {
        expect(normalizeAragonese("de -37,8 °C")).toBe("de menos 37,8 graus Celsius");
        expect(normalizeAragonese("1.500 metros lisos - 3:40.96 min")).toBe("1500 metros lisos - 3:40,96 min");
    });

    test("the era marker, the abbreviations, and `m.a.` — which the tier would otherwise read as metres", () => {
        expect(normalizeAragonese("dende arredol d'o 12.500 a. C.")).toBe("dende arredol d'o 12500 antes de Cristo.");
        expect(normalizeAragonese("(490 a. C.?)")).toBe("(490 antes de Cristo?)");
        expect(normalizeAragonese("nº 132")).toBe("numero 132"); // each abbreviation expands to ITS OWN word
        expect(normalizeAragonese("lum. 160")).toBe("lumero 160");
        expect(normalizeAragonese("413 hab./km²")).toBe("413 hab/km²"); // the dot goes so the tier sees a rate
        expect(normalizeAragonese("fa ±415 - ±360 m.a.")).toBe("fa ±415 - ±360 millons d'anyadas");
    });

    test("ranges, and the guards that keep the rule off a citation", () => {
        expect(normalizeAragonese("1961-1990")).toBe("1961, 1990");
        expect(normalizeAragonese("pp. 28–37")).toBe("pp. 28, 37");
        expect(normalizeAragonese("Lei 10/2009")).toBe("Lei 10/2009"); // an adjacent slash means a citation
        expect(normalizeAragonese("30/10/1977")).toBe("30/10/1977");
    });

    test("the whole pipeline: separators + tier + the decimal-comma number branch", () => {
        expect(phonemize("45.000 km²", "an").trim()).toBe("kwaɾanta i θinko mil kilometɾos kwadɾaus");
        expect(phonemize("43,5 hab/km²", "an").trim()).toBe("kwaɾanta i tɾes koma θinko abitants po kilometɾo kwadɾau");
        expect(phonemize("un 60% d'os ingresos", "an").trim()).toBe("un siʃanta po θjent dos inɡɾesos");
        expect(phonemize("$359,9 billons", "an").trim()).toBe("tɾeθjentos θinkwanta i nweu koma nweu biʎons de dolaɾs");
        expect(phonemize("92.000€", "an").trim()).toBe("nobanta i dos mil euɾos");
    });
});
