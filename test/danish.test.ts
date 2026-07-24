import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWordRules } from "../src/languages/danish/danish.ts";

// Danish (da) — North Germanic, Latin, the DEEPEST European orthography. Vowel quality / soft-d,g / reduction /
// stress are largely LEXICAL, so the SHIPPED path is a PRONUNCIATION LEXICON (da-lexicon.tsv, from the Wiktionary
// data, canonical IPA + stress) → the RULE engine (phonemizeWordRules) as the OOV fallback. The referee-eval measures
// the rule engine non-circularly (24.7%, the honest novel-word floor). See docs/investigations/da_native_bringup_investigation.md.
describe("Danish canonical IPA", () => {
    test("lexicon path: known words at reference quality (soft-d, stress, loan/prefix stress)", () => {
        expect(phonemize("gade", "da").trim()).toBe("ˈɡæðə"); // soft d → ð, initial stress
        expect(phonemize("mad", "da").trim()).toBe("mað"); // soft d word-final
        expect(phonemize("absolut", "da").trim()).toBe("ɑbsoˈlud"); // loanword final stress + final t → d
        expect(phonemize("København", "da").trim()).toBe("købənˈhɑwn"); // the real Danish pronunciation + stress
        expect(phonemize("forstå", "da").trim()).toBe("fʌˈsdɔ"); // unstressed ⟨for-⟩ prefix → stress on stå
    });

    test("rule fallback (OOV): context rules — soft-d, af-→aw, ng, silent-h, final-t", () => {
        expect(phonemizeWordRules("afbryde")).toBe("ˈawbʁyðə"); // af- glide, soft d, first-syllable stress
        expect(phonemizeWordRules("adresse")).toBe("ˈadʁesə"); // ⟨d⟩ before consonant stays [d] (not soft); rule = first-syllable stress (a loanword's non-initial stress is an OOV limitation → lexicon covers it: aˈdʁɛsə)
        expect(phonemizeWordRules("hjul")).toBe("jul"); // silent h before j
        expect(phonemizeWordRules("lang")).toBe("laŋ"); // ng → ŋ
    });
});
