import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeAsturian } from "../src/languages/asturian/normalize.ts";

import { createAsturian, phonemizeWord } from "../src/languages/asturian/asturian.ts";
import { numberToWords } from "../src/languages/asturian/numbers.ts";

// Asturian (ast) — asturianu, Astur-Leonese (Ibero-Romance), Asturias/NW Spain (~110k speakers). Close to
// Spanish/Galician (distinción c/z→[θ]); the Asturian hallmark is ⟨x⟩→[ʃ]. A greedy Ibero-Romance scan.
// Referee: wikipron ast_latn_broad (human), with stress and spirantization folded. ⚠ It is the ONLY referee
// available for ast, so the engine has no independent second opinion behind it.
describe("Asturian canonical IPA — Ibero-Romance g2p (x→ʃ, distinción)", () => {
    const ast = createAsturian();

    test("the Asturian hallmark ⟨x⟩→[ʃ]; ⟨g⟩ stays [ɡ], ⟨j⟩→[h]", () => {
        expect(phonemizeWord("xente")).toBe("ʃente"); // ⟨x⟩ → ʃ ("people")
        expect(phonemizeWord("Asturies")).toBe("astuɾjes"); // ⟨i⟩→j glide, no final-consonant deletion
    });

    test("distinción: ⟨c⟩ before e/i → [θ], ⟨z⟩ → [θ]", () => {
        expect(phonemizeWord("cielu")).toBe("θjelu"); // ⟨c⟩ before i → θ ("sky")
        expect(phonemizeWord("zapatu")).toBe("θapatu"); // ⟨z⟩ → θ ("shoe")
    });

    test("the palatal digraphs: ⟨ll⟩→ʎ, ⟨ñ⟩→ɲ, ⟨ch⟩→t͡ʃ, ⟨y⟩→ʝ (onset) / [i] (coda)", () => {
        expect(phonemizeWord("lleche")).toBe("ʎet͡ʃe"); // ⟨ll⟩→ʎ, ⟨ch⟩→t͡ʃ ("milk")
        expect(phonemizeWord("ñeru")).toBe("ɲeɾu"); // ⟨ñ⟩ → ɲ ("nest")
        expect(phonemizeWord("güeyu")).toBe("ɡweʝu"); // ⟨gü⟩→ɡw, ⟨y⟩ onset → ʝ ("eye")
        expect(phonemizeWord("Olay")).toBe("olai"); // ⟨y⟩ coda → [i] (a surname)
    });

    test("⟨qu gu⟩ clusters; ⟨v⟩→b; ⟨h⟩ silent; ⟨n⟩→[m] before a labial; ⟨pt ct⟩ kept", () => {
        expect(phonemizeWord("nueche")).toBe("nwet͡ʃe"); // ⟨u⟩→w glide, ⟨ch⟩→t͡ʃ ("night")
        expect(phonemizeWord("home")).toBe("ome"); // ⟨h⟩ silent ("man")
        expect(phonemizeWord("bienvenida")).toBe("bjembenida"); // ⟨n⟩ → m before [b] ("welcome")
        expect(phonemizeWord("doctor")).toBe("doktoɾ"); // learned ⟨ct⟩ KEEPS the cluster (vocalization is spelled ⟨u⟩)
    });

    test("the ⟨rr⟩ trill vs single ⟨r⟩ tap; the che vaqueira ⟨ḷḷ⟩→[t͡ʂ]", () => {
        expect(phonemizeWord("carru")).toBe("karu"); // ⟨rr⟩ → r trill ("cart")
        expect(phonemizeWord("falar")).toBe("falaɾ"); // single ⟨r⟩ → ɾ tap ("to speak")
        expect(phonemizeWord("abeḷḷugu")).toBe("abet͡ʂuɡu"); // Western ⟨ḷḷ⟩ → t͡ʂ ("shelter")
    });

    test("clause assembly", () => {
        expect(ast.text("Falo asturianu.").trim()).toBe("falo astuɾjanu .");
    });

    // NUMBERS — ALLA Gramática cap. XII "Los numberales" §2.2: the twenties FUSE (ventiún), the other tens take
    // ⟨y⟩ (trenta y un), and 100 alternates cien (bare) / cientu (before a remainder). See asturian.jsonc.
    test("numbers: units, the fused twenties, the ⟨y⟩ connector, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("siete");
        expect(numberToWords(16)).toBe("dieciséis");
        expect(numberToWords(21)).toBe("ventiún"); // fused, one word (ALLA: "escrito nuna sola pallabra")
        expect(numberToWords(31)).toBe("trenta y un"); // "escrito en pallabres separaes"
        expect(numberToWords(555)).toBe("quinientos cincuenta y cinco");
        expect(numberToWords(12345)).toBe("doce mil trescientos cuarenta y cinco");
        expect(numberToWords(1000000)).toBe("un millón");
        expect(numberToWords(1000000000)).toBe("mil millones"); // Ibero long scale
    });

    test("numbers: the cien / cientu alternation (ALLA XII.2.2 'Centena y otru númberu')", () => {
        expect(numberToWords(100)).toBe("cien"); // bare 100
        expect(numberToWords(101)).toBe("cientu un"); // 101–199 take cientu
        expect(numberToWords(131)).toBe("cientu trenta y un");
        expect(numberToWords(100000)).toBe("cien mil"); // cien as the multiplier of mil
    });

    test("numbers read through the g2p", () => {
        expect(ast.text("21").trim()).toBe("bentjun"); // ⟨v⟩→b (betacism)
        expect(ast.text("101").trim()).toBe("θjentu un"); // distinción ⟨c⟩+i → θ
    });
});

// ── TEXT NORMALIZATION (src/languages/asturian/normalize.ts) ────────────────────────────────────────
//
// Evidence: `tools/corpus/mined/ast.jsonc` — the fleet's largest artifact, 1,343,097 paragraph segments.
// The argument for every case is in the normalizer's own header.
describe("Asturian text normalization", () => {
    const ast = { text: (s: string) => phonemize(s, "ast") };

    test("⚠ THE DEGREE SIGN AND THE ORDINAL INDICATOR ARE SWAPPED, IN BOTH DIRECTIONS", () => {
        // `º` U+00BA doing the degree's job — the corpus's own `23ºC`, `30º de media`, `43º … de llatitú`.
        expect(ast.text("23ºC")).toBe(ast.text("23°C"));
        expect(ast.text("30º de media")).toBe(ast.text("30 graos de media"));
        expect(ast.text("60º col planu")).toBe(ast.text("60 graos col planu"));
        // …and `°` U+00B0 doing the ORDINAL's job, which is why neither codepoint can key the rule.
        // Sixteen instances qualify as degrees under the following-context allow-list; this one does not,
        // and is left unread rather than told to say *cinco graos presidente* (trap 56).
        expect(normalizeAsturian("5° presidente")).toBe("5° presidente");
    });

    test("three separator conventions in one corpus", () => {
        // The DOT groups at exactly three digits…
        expect(normalizeAsturian("171.057")).toBe("171057");
        expect(normalizeAsturian("1.012.292")).toBe("1012292");
        // …and DECIMATES otherwise, folding onto the comma the number branch reads.
        expect(normalizeAsturian("132.46")).toBe("132,46");
        expect(ast.text("0,54%")).toBe("θeɾo koma θinko kwatɾo poɾ θjentu");
        // …and the SPACE groups too.
        expect(normalizeAsturian("25 000")).toBe("25000");
        // ⚠ Order matters: doing the decimal fold first would turn every grouped figure into a decimal.
        expect(ast.text("504.645 km²")).toBe("kinjentos kwatɾo mil seisθjentos kwaɾenta i θinko kilometɾos kwadɾaos");
    });

    test("⚠ THE ROMAN NUMERAL IS A MONTH — and the shared roman pass eats half of them first", () => {
        // `core/roman.ts` runs BEFORE this layer and converts a multi-letter numeral while declining a
        // lone one, so `1-III-1700` arrives as `1-3-1700` and `24-X-1793` arrives intact. Both are claimed.
        expect(normalizeAsturian("24-X-1793")).toBe("24 de ochobre de 1793");
        expect(normalizeAsturian("1-3-1700")).toBe("1 de marzu de 1700");
        expect(normalizeAsturian("31-XII-1805")).toBe("31 de avientu de 1805");
        // The month bound of 12 is what keeps this off an ordinary hyphen-joined trio.
        expect(normalizeAsturian("3-14-1700")).toBe("3-14-1700"); // …and the range rule declines a 3-chain too
    });

    test("the ERA, the clock, and the range's pause", () => {
        expect(normalizeAsturian("1200 e.C.")).toBe("1200 enantes de Cristu.");
        expect(normalizeAsturian("996 d. C.")).toBe("996 dempués de Cristu.");
        expect(normalizeAsturian("23:40 h.")).toBe("23 40 h."); // the colon spent, the writer's `h` kept
        expect(normalizeAsturian("6000 - 3000")).toBe("6000, 3000");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        expect(normalizeAsturian("1900-1910.")).toBe("1900, 1910.");
        // ⚠ AND A DENTAL FORMULA IS NOT A RANGE — a chain of three or more groups is an identifier.
        expect(normalizeAsturian("C 0-1/0-1")).toBe("C 0-1/0-1");
    });

    test("the symbol tier — and the currency is POSTPOSED, which this corpus proves", () => {
        expect(ast.text("70%")).toBe("setenta poɾ θjentu");
        expect(ast.text("21.035 €")).toBe("bentjun mil tɾenta i θinko euɾos");
        expect(ast.text("90 kg")).toBe("nobenta kiloɡɾamos");
        expect(ast.text("44,9 °C")).toBe("kwaɾenta i kwatɾo koma nwebe ɡɾaos θelsjus");
        expect(ast.text("88°23' S")).toBe("ot͡ʃenta i ot͡ʃo ɡɾaos bentitɾes minutos s");
    });
});
