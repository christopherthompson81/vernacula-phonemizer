import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWordRules } from "../src/languages/danish/danish.ts";
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
