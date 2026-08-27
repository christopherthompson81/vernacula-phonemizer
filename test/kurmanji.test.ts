import { describe, expect, it, test } from "vitest";

import { phonemizeWord, createKurmanji } from "../src/languages/kurmanji/kurmanji.ts";
import { phonemize } from "../src/index.ts";
import { normalizeKurmanji } from "../src/languages/kurmanji/normalize.ts";

// Canonical-IPA goldens for Kurmanji / Kurdî (kmr) — Northern Kurdish, Iranian, the LATIN (Hawar) alphabet
// (vowels written, so no restoration — unlike Persian/Pashto abjads). Near-phonemic: ⟨c⟩→d͡ʒ / ⟨ç⟩→t͡ʃ (reverse of
// Romance), ⟨j⟩→ʒ, ⟨ş⟩→ʃ, ⟨q⟩→q, ⟨x⟩→x, ⟨xw⟩→xʷ; long a/ê/î/o/û → ɑː eː iː oː uː vs short e/i/u → ɛ ɪ ʊ;
// final-syllable stress; n→ŋ before k/ɡ. Aspiration/pharyngealisation are allophonic/unwritten → not emitted.
// Referees: wikipron kmr + epitran.
describe("Kurmanji canonical IPA", () => {
    test("the reversed affricates ⟨c⟩→d͡ʒ / ⟨ç⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨ş⟩→ʃ", () => {
        expect(phonemizeWord("çav")).toBe("t͡ʃˈɑːv"); // ç → t͡ʃ, a → ɑː
        expect(phonemizeWord("roj")).toBe("rˈoːʒ"); // j → ʒ, o → oː
        expect(phonemizeWord("şêr")).toBe("ʃˈeːr"); // ş → ʃ, ê → eː
        expect(phonemizeWord("pênc")).toBe("pˈeːnd͡ʒ"); // c → d͡ʒ
    });

    test("the long/short vowel system + xw labialization + final stress", () => {
        expect(phonemizeWord("av")).toBe("ˈɑːv"); // a → ɑː
        expect(phonemizeWord("jin")).toBe("ʒˈɪn"); // short i → ɪ
        expect(phonemizeWord("kurd")).toBe("kˈʊrd"); // short u → ʊ
        expect(phonemizeWord("xwarin")).toBe("xʷɑːrˈɪn"); // xw → xʷ, final stress
        expect(phonemizeWord("name")).toBe("nɑːmˈɛ"); // final-syllable stress on ɛ
    });

    test("n → ŋ before a velar (nasal place assimilation)", () => {
        expect(phonemizeWord("bang")).toBe("bˈɑːŋɡ"); // n → ŋ before ɡ
    });

    test("numbers (tens û units with the û connector)", () => {
        const d = createKurmanji();
        expect(d.text("21").trim()).toBe("bˈiːst ˈuː jˈɛk"); // bîst û yek
        expect(d.text("100").trim()).toBe("sˈɛd"); // sed
        expect(d.text("234").trim()).toBe("dˈʊ sˈɛd ˈuː sˈiː ˈuː t͡ʃˈɑːr"); // du sed û sî û çar
    });
});

// The layer's evidence and its counter-examples both live in src/languages/kurmanji/normalize.ts; these
// pin the rule BRANCHES rather than the corpus's instances (trap 13).
describe("Kurmanji text normalization", () => {
    // The densest thing in the corpus: 287 bound suffixes in 451 mined segments. Each was its own word
    // with its own primary stress — `sala 2015an` → *…pɑːnzdˈɛh ˈɑːn*.
    it("a numeral's bound suffix becomes part of the word", () => {
        expect(normalizeKurmanji("sala 2015an")).toBe("sala du hezar û panzdehan");
        expect(normalizeKurmanji("di 1949an de")).toBe("di hezar û neh sed û çil û nehan de");
        expect(normalizeKurmanji("salên 1990î")).toBe("salên hezar û neh sed û nodî");
    });

    // The glide is re-derived from the SPOKEN form, never copied from the text — the writer chose it by
    // looking at the digits, which do not show the vowel the cardinal ends in.
    it("the y-glide is re-derived, both directions", () => {
        expect(normalizeKurmanji("2ê sibata")).toBe("duyê sibata"); // written without y, needs one
        expect(normalizeKurmanji("salên 1980yî")).toBe("salên hezar û neh sed û heştêyî"); // written with y, keeps it
        expect(normalizeKurmanji("roja 25ê")).toBe("roja bîst û pêncê"); // consonant-final, takes none
        expect(normalizeKurmanji("sala 2003yan")).toBe("sala du hezar û sêyan");
    });

    it("the ordinal is the same rule", () => {
        expect(normalizeKurmanji("sedsala 5em")).toBe("sedsala pêncem");
        expect(normalizeKurmanji("Çapa 1emîn")).toBe("Çapa yekemîn");
        expect(normalizeKurmanji("Çapa 2yemîn")).toBe("Çapa duyemîn");
    });

    // The suffix list is CLOSED because an open shape matched this corpus's URL-encoded catalogue string,
    // its version numbers and its complement proteins.
    it("…and it never fires on a designation", () => {
        expect(normalizeKurmanji("C3a û C3b")).toBe("C3a û C3b");
        expect(normalizeKurmanji("Ubuntu 6.10")).toBe("Ubuntu 6.10");
    });

    it("both separator conventions, told apart by group size", () => {
        expect(normalizeKurmanji("15.354 km²")).toBe("15354 kîlometre çargoşe"); // period-3 = thousands
        expect(normalizeKurmanji("10,000")).toBe("10000"); // comma-3 = thousands too
        expect(normalizeKurmanji("37,0%")).toBe("ji sedî 37 0"); // comma-1 = decimal
        expect(normalizeKurmanji("%65.5")).toBe("ji sedî 65 5"); // period-1 = decimal
        // period-2 is NEITHER — 1 decimal in 6, against a date, two versions and a clock.
        expect(normalizeKurmanji("saet 11.00an")).toBe("saet 11.00an");
        expect(phonemize("1.234", "kmr")).toBe(phonemize("1234", "kmr"));
    });

    // The tail guard refuses a DIGIT, not a mark. Written `(?![\p{Nd}.,])` it declined every number a
    // sentence punctuates after — which is where a full stop is guaranteed — and the false clause break
    // this layer removes came back at exactly that position.
    it("a group or a decimal still de-groups when a sentence ends on it", () => {
        expect(normalizeKurmanji("gihiştiye 140.000. Hikûmetên")).toBe("gihiştiye 140000. Hikûmetên");
        expect(normalizeKurmanji("çiya ji sedî 37,0, deşt")).toBe("çiya ji sedî 37 0, deşt");
        expect(normalizeKurmanji("Magnitude 7.6.")).toBe("Magnitude 7 6.");
        // …and the longer run it is actually for is still refused, because a DIGIT follows the mark.
        expect(normalizeKurmanji("27.10-6.11.2003")).toBe("27.10-6.11.2003");
        expect(normalizeKurmanji("1.000,50")).toBe("1.000,50");
        expect(normalizeKurmanji("Ubuntu 6.10.")).toBe("Ubuntu 6.10.");
    });

    // Every mark in the run is stripped, not just the last one the group matched: the corpus's one
    // mixed-mark figure kept the other separator and read a clause break inside itself.
    it("a run that mixes the two marks loses both", () => {
        expect(normalizeKurmanji("cîhanê 274.703,340 $")).toBe("cîhanê 274703340 dolar");
        expect(normalizeKurmanji("669,947,865")).toBe("669947865");
        expect(normalizeKurmanji("1.000.000.000")).toBe("1000000000");
    });

    it("percent leads its number, and the corpus's own `ji` is not said twice", () => {
        expect(normalizeKurmanji("ji %71 çiya")).toBe("ji sedî 71 çiya");
        expect(normalizeKurmanji("% 38,2")).toBe("ji sedî 38 2");
        // …and the sign survives the suffix rule, which is why that rule runs last (trap 39).
        expect(normalizeKurmanji("%72yê navçeya")).toBe("ji sedî heftê û duyê navçeya");
    });

    it("degrees carry the negative, because that is where the sign is unambiguous", () => {
        expect(normalizeKurmanji("-24,0 °C")).toBe("negatîf 24 0 pile Selsiyus");
        expect(normalizeKurmanji("37° 30´")).toContain("37 pile");
        // Both operands of a coordinated pair, where the degree word is written once at the end.
        expect(normalizeKurmanji("heta -24 û -30 pileyan")).toBe("heta negatîf 24 û negatîf 30 pileyan");
        // A dash that is NOT a negative stays silent: a title, a range, chart markup.
        expect(normalizeKurmanji("Komkujiya Ermenîyan -1915")).toBe("Komkujiya Ermenîyan -1915");
        expect(normalizeKurmanji("start:-1500")).toBe("start:-1500");
    });

    it("era markers, units and the two powers", () => {
        expect(normalizeKurmanji("sedsala 4an b.z.")).toBe("sedsala çaran berî zayînê");
        expect(normalizeKurmanji("sala 4000 BZ")).toBe("sala 4000 berî zayînê");
        expect(normalizeKurmanji("1000&nbsp;mm")).toBe("1000 mîlîmetre");
        expect(normalizeKurmanji("253 milyar m³")).toBe("253 milyar metre kûp");
        expect(normalizeKurmanji("A & B")).toBe("A û B");
    });
});

// The review pass — trap 8, "probe the adversarial neighbour of every rule". Each of these was a defect
// until the probe found it, and each fix is measured in normalize.ts.
describe("Kurmanji normalization: the review pass", () => {
    it("the rate is a circumfix, and the tier composes it", () => {
        // `120 kîlometre di saetê de (190 km/h)` — the wiki glosses the phrase against the symbol.
        expect(normalizeKurmanji("120 km/h")).toBe("120 kîlometre di saetê de");
    });

    it("a scale letter is never fused onto the degree word", () => {
        // `°c` is ×0 in this corpus, but a case-SENSITIVE arm let the bare rule emit `20 pilec`.
        expect(normalizeKurmanji("20 °c")).toBe("20 pile Selsiyus");
        expect(normalizeKurmanji("98 °f")).toBe("98 pile");
        // …and the refusal is ONE letter only: a degree followed by a WORD must still read.
        expect(normalizeKurmanji("carna 40° germ dibe")).toBe("carna 40 pile germ dibe");
        expect(normalizeKurmanji("20 °K")).toBe("20 °K"); // an unhandled scale stays visible
    });

    it("a URL escape is not a price", () => {
        // The corpus's catalogue string, ×17. The tier read `$002f` as *002 dolar f*.
        expect(normalizeKurmanji("$002f$002fSD")).not.toContain("dolar");
        expect(normalizeKurmanji("$16")).toContain("dolar"); // and a real price still reads
    });

    it("the dotted ordinal fires below 31 and never on a sentence end", () => {
        expect(normalizeKurmanji("hene: 1. rêbaza kevin")).toBe("hene: yekem rêbaza kevin");
        expect(normalizeKurmanji("Ji Sedsala 19. Heya Îro")).toBe("Ji Sedsala nozdehem Heya Îro");
        // N > 31 is 12/12 a sentence-final year or page number in this corpus.
        expect(normalizeKurmanji("Duhok, 2006. Pîvana")).toBe("Duhok, 2006. Pîvana");
        // the one ≤31 counter-example is the END OF A RANGE, excluded by its own shape
        expect(normalizeKurmanji("r. 24-31. Statuya")).toBe("r. 24-31. Statuya");
        // …and it must run ABOVE the suffix rule, which creates letters where digits were: below it,
        // `16. 11. 2006'an` read the date's MONTH as an ordinal.
        expect(normalizeKurmanji("Di 16. 11. 2006an de")).toBe("Di 16. 11. du hezar û şeşan de");
    });
});
