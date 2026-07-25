import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWordRules } from "../src/languages/danish/danish.ts";

// Danish (da) — North Germanic, Latin, the DEEPEST European orthography. Vowel quality / soft-d,g / reduction /
// stress are largely LEXICAL, so the SHIPPED path is a PRONUNCIATION LEXICON (da-lexicon.tsv, from the Wiktionary
// data, canonical IPA + stress) → a perceptron TAGGER (OOV, held-out 45.5%) → the RULE engine (phonemizeWordRules) as
// the last-tier fallback. The referee-eval measures the rule engine non-circularly (27.4% folded, the honest novel-word
// floor; the vowel-quality ceiling is lexical). See docs/investigations/da_native_bringup_investigation.md.
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
        expect(phonemizeWordRules("rolig")).toBe("ʁˈoli"); // MINED: final ⟨g⟩ after vowel → silent (ˈ on the nucleus)
    });

    test("tagger tier (OOV, not in lexicon): the perceptron recovers context vowel quality the rules miss", () => {
        // These words are NOT in da-lexicon.tsv, so phonemize() routes lexicon → TAGGER (tier 2). The perceptron
        // recovers the ⟨e⟩→ɛ / soft-d ð / reduction the rule engine can't (held-out OOV 45.5% vs 30.5%, same split).
        // Goldens pin the ACTUAL shipped da-g2p.tsv output (they were re-synced after the PR-#444 reseed regenerated it).
        expect(phonemize("snurretop", "da").trim()).toBe("snˈurɛtop"); // ⟨e⟩→ɛ (perceptron) + applyStress ˈ
        expect(phonemize("fladbrød", "da").trim()).toBe("flˈaðbrøð"); // soft-d ð + first-syllable stress
        expect(phonemize("forsinkelse", "da").trim()).toBe("fɔsˈenɡəlsə"); // unstressed ⟨for-⟩ → stress the 2nd vowel
    });
});
