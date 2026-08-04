import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWordRules } from "../src/languages/danish/danish.ts";
import { normalizeDanish } from "../src/languages/danish/normalize.ts";
import { numberToWords } from "../src/languages/danish/numbers.ts";

// Danish (da) — North Germanic, Latin, the DEEPEST European orthography. Vowel quality / soft-d,g / reduction / stress
// / length / stød are largely LEXICAL, so the SHIPPED path is a PRONUNCIATION LEXICON (da-lexicon.tsv, ~37k = the NST
// lexicon ∩ the top-50k OpenSubtitles-da frequency head, ~98% of real tokens) → the neural BiLSTM tagger (OOV, async
// phonemizeDaNeural, trained on the full 199k NST) → the RULE engine (phonemizeWordRules) as the last-tier fallback.
// NST (Nasjonalbiblioteket / Språkbanken, CC0) is the NARROW convention: r-vocalisation (ɐ),
// stop lenition (kat→kad), soft-d (ð), length (ː), and STØD (ˀ). The referee-eval measures the rule engine
// non-circularly (the honest novel-word floor). See docs/investigations/da_nst_ingest_investigation.md.
describe("Danish canonical IPA", () => {
    test("lexicon path (NST, narrow): known words at reference quality", () => {
        expect(phonemize("gade", "da").trim()).toBe("ˈɡaːðə"); // soft d → ð, length ː, initial stress
        expect(phonemize("mad", "da").trim()).toBe("ˈmað"); // soft d word-final
        expect(phonemize("absolut", "da").trim()).toBe("ɑbsoˈlud"); // loanword final stress + final t → d (lenition)
        expect(phonemize("København", "da").trim()).toBe("købənˈhɑwˀn"); // the real Danish pronunciation + STØD ˀ
        expect(phonemize("forstå", "da").trim()).toBe("fɒˈsdɔːˀ"); // unstressed ⟨for-⟩ → stress on stå; length + stød
    });

    test("NST-narrow signatures: r-vocalisation ɐ, stop lenition, soft-d ð, length ː, stød ˀ", () => {
        expect(phonemize("hus", "da").trim()).toBe("ˈhuːˀs"); // length + stød
        expect(phonemize("kat", "da").trim()).toBe("ˈkad"); // final /t/ → lenited [d]
        expect(phonemize("dansk", "da").trim()).toBe("ˈdanˀsɡ"); // /sk/ → [sɡ] lenition + stød
        expect(phonemize("hjerte", "da").trim()).toBe("ˈjɛɐdə"); // silent-h hj→j + r-vocalisation ɐ + lenition t→d
    });

    test("rule fallback (OOV, tagger absent): context rules — soft-d, af-→aw, ng, silent-h, final-g", () => {
        expect(phonemizeWordRules("afbryde")).toBe("ˈawbʁyðə"); // af- glide, soft d, first-syllable stress
        expect(phonemizeWordRules("adresse")).toBe("ˈadʁesə"); // ⟨d⟩ before consonant stays [d]; first-syllable stress
        expect(phonemizeWordRules("hjul")).toBe("jul"); // silent h before j
        expect(phonemizeWordRules("lang")).toBe("laŋ"); // ng → ŋ
        expect(phonemizeWordRules("rolig")).toBe("ʁˈoli"); // final ⟨g⟩ after vowel → silent
    });

    // CARDINAL NUMBERS — Danish is the fleet's VIGESIMAL (base-20) outlier above 40 AND units-first with "og".
    // The 50–90 tens are the lexicalised contractions of the base-20 multiplicatives: halvtreds = halvtredje-sinds-
    // tyve "half-third × 20", tres = "three × 20", halvfjerds "half-fourth × 20", firs "four × 20", halvfems
    // "half-fifth × 20". Source: Wiktionary Appendix:Danish numerals + Dansk Sprognævn for the "og" between
    // magnitude groups. See src/languages/danish/numbers.ts.
    test("numbers: the vigesimal tens + units-first og-compounds", () => {
        expect(numberToWords(0)).toBe("nul");
        expect(numberToWords(7)).toBe("syv");
        expect(numberToWords(21)).toBe("enogtyve"); // units FIRST, fused with "og"
        expect(numberToWords(50)).toBe("halvtreds"); // ← vigesimal: "half-third × 20"
        expect(numberToWords(60)).toBe("tres"); // "three × 20"
        expect(numberToWords(70)).toBe("halvfjerds"); // "half-fourth × 20"
        expect(numberToWords(75)).toBe("femoghalvfjerds"); // five-and-half-fourth(-times-twenty)
        expect(numberToWords(80)).toBe("firs"); // "four × 20"
        expect(numberToWords(90)).toBe("halvfems"); // "half-fifth × 20"
        expect(numberToWords(99)).toBe("nioghalvfems");
        expect(numberToWords(40)).toBe("fyrre"); // 40 is NOT vigesimal
    });

    test("numbers: hundreds / thousands / millions chain with og", () => {
        expect(numberToWords(100)).toBe("et hundrede"); // the neuter "et" before the magnitude noun
        expect(numberToWords(101)).toBe("et hundrede og en");
        expect(numberToWords(555)).toBe("fem hundrede og femoghalvtreds");
        expect(numberToWords(1000)).toBe("et tusind");
        expect(numberToWords(12345)).toBe("tolv tusind og tre hundrede og femogfyrre");
        expect(numberToWords(2538)).toBe("to tusind og fem hundrede og otteogtredive"); // the DSN worked example
        expect(numberToWords(1000000)).toBe("en million");
        expect(numberToWords(1000000000)).toBe("en milliard");
    });

    test("numbers: wired into the phonemizer (each word through the lexicon → tagger → rule tiers)", () => {
        expect(phonemize("21", "da").trim()).toBe("ˈeˀnɐwˌtyːvə"); // enogtyve, from the NST lexicon
        expect(phonemize("90", "da").trim()).toBe("halˈfɛmˀs"); // halvfems
        expect(phonemize("1000", "da").trim()).toBe("ˈɛd ˈtuːˀsen"); // et tusind
    });

});

// #562 — the normalization layer. Every count is measured over the FLEURS da_dk corpus (column 3), and
// every emitted word is in da-lexicon.tsv at reference quality.
describe("danish normalization", () => {
    // ⚠ The period is a THOUSANDS SEPARATOR in Danish (99 instances) — the German convention. In Norwegian
    // the same shape was a DATE and got a date rule; here that rule would corrupt every large number.
    test("period-grouped thousands stay ONE numeral", () => {
        expect(normalizeDanish("330.000")).toBe("330000");
        expect(normalizeDanish("24.000 meteoritter")).toBe("24000 meteoritter");
    });

    // …and the technical shape must survive it: 802.11 has only two digits after the period.
    test("a technical identifier is not de-grouped", () => {
        expect(normalizeDanish("802.11n")).toBe("802.11n");
    });

    test("decimal comma, clock, percent, degrees, squared units", () => {
        expect(normalizeDanish("12,5")).toBe("12 komma 5");
        expect(normalizeDanish("kl. 14:30")).toBe("klokken 14 30");
        expect(normalizeDanish("25 %")).toBe("25 procent");
        expect(normalizeDanish("20 °C")).toBe("20 grader celsius");
        expect(normalizeDanish("23 km²")).toBe("23 kvadratkilometer");
    });

    test("ordinal dot — the largest defect, 112 instances", () => {
        expect(normalizeDanish("3. maj")).toBe("tredje maj");
        expect(normalizeDanish("18. århundrede")).toBe("attende århundrede");
        expect(normalizeDanish("I 1990. Han kom")).toBe("I 1990. Han kom"); // a sentence end survives
    });

    // The lowercase guard claims `1.` (followed by "og") and declines `3.` (followed by a proper noun),
    // giving the inconsistent "første og 3.". A coordinator makes BOTH ordinals whatever follows.
    test("coordinated ordinals are claimed as a pair", () => {
        expect(normalizeDanish("1. og 3. New Hampshire")).toBe("første og tredje New Hampshire");
    });

    test("a range of ordinals", () => {
        expect(normalizeDanish("10.-11. århundrede")).toBe("tiende til ellevte århundrede");
    });

    // ⚠ Danish POSTPOSES the currency sign — 8 postposed against 2 preposed, the opposite of English —
    // and a code can carry it instead of a digit (US$, AUD$), where neither digit-anchored pattern fires.
    test("currency in both positions, and after a currency code", () => {
        expect(normalizeDanish("1000$")).toBe("1000 dollar");
        expect(normalizeDanish("$22.500")).toBe("22500 dollar");
        expect(normalizeDanish("11.000 US$")).toBe("11000 US dollar");
        // The digit class must not eat the trailing space, or the next word fuses on: "2500 yenog".
        expect(normalizeDanish("¥2.500 og")).toBe("2500 yen og");
    });

    test("signs, ranges and ampersand", () => {
        expect(normalizeDanish("1990-1995")).toBe("1990 til 1995");
        expect(normalizeDanish("+30 °C")).toBe("plus 30 grader celsius");
        expect(normalizeDanish("EX = uddød")).toBe("EX lig med uddød");
        expect(normalizeDanish("A&B")).toBe("A og B");
    });

    test("ordinary Danish text is untouched", () => {
        expect(normalizeDanish("Dansk er et sprog.")).toBe("Dansk er et sprog.");
    });

    // #586 — ADOPTED THE SHARED TIER for units and rates. Danish predates it and reads unit abbreviations
    // from the LEXICON (`km` → kiloˈmeːˀdɐ), which handles a TOKEN and can never compose across a slash: the
    // denominator reached the IPA as a LETTER NAME. Note `km/t` — Danish `t` is *time* (hour), ×8 in the
    // corpus against `km/h` ×0 — and that `km`/`kilometer` phonemize identically, so the plain reading is
    // untouched. Words from the corpus: kilometer ×8, meter ×4, `i timen` ×7, `i sekundet` ×3.
    test("units and rates through the shared tier (#586)", () => {
        expect(phonemize("160 km/t", "da")).toContain("kiloˈmeːˀdɐ ˈiːˀ ˈtiːmən"); // was the letter T
        expect(phonemize("120 km/h", "da")).toContain("kiloˈmeːˀdɐ ˈiːˀ ˈtiːmən"); // was the letter H
        expect(phonemize("133 m/s", "da")).toContain("ˈmeːˀdɐ ˈiːˀ seˈkɔnˀdəð");   // was ˈɛm ˈɛs
        expect(phonemize("5 m", "da")).toContain("ˈmeːˀdɐ");                        // was ˈɛm
        expect(phonemize("5 km", "da")).toContain("kiloˈmeːˀdɐ");                   // unchanged
        expect(phonemize("5 cm", "da")).toContain("ˈsɛntiˌmeːˀdɐ"); // left to the lexicon, stress intact
        expect(phonemize("5 km²", "da")).toContain("kvaˈdʁɑːˀdkiloˌmeːˀdɐ"); // local compound still wins
    });
});
