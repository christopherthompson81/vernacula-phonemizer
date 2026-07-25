import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWordRules } from "../src/languages/danish/danish.ts";

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
});
