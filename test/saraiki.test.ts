import { describe, expect, test } from "vitest";
import { phonemizeWordRules } from "../src/languages/saraiki/saraiki.ts";

// Diagnostic gold for the Saraiki (skr) engine — one word per signature feature. These are OUR canonical output
// (rule-only, default-[ə] for the unwritten abjad short vowels + weight stress); they line up with the wikipron
// skr_arab referee on the recoverable consonant + long-vowel backbone. The point of this suite is to lock the
// engine's distinctive Saraiki behaviors: the FOUR implosives, retained voiced aspirates + aspirated sonorants
// (no Punjabi tonogenesis), and the retroflex nasal ݨ→ɳ.
describe("Saraiki (skr) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["اٻاسی", "əɓˈaːsiː"], // ٻ → ɓ  bilabial implosive
        ["اڄ", "ˈəʄ"], // ڄ → ʄ  palatal implosive ("today")
        ["ڳوݙا", "ɠˈoːɗaː"], // ڳ → ɠ velar + ݙ → ɗ retroflex implosive (both, one word)
        ["بھڄݨ", "bʱˈəʄəɳ"], // بھ → bʱ voiced aspirate KEPT (no tonogenesis) + ڄ ʄ + ݨ ɳ
        ["آلھݨا", "ˈaːlʱɳaː"], // لھ → lʱ  aspirated SONORANT kept (Punjabi strips it) + ݨ ɳ
        ["آوݨ", "ˈaːʋɳ"], // ݨ → ɳ retroflex nasal (verbal infinitive), و → ʋ
        ["تہاݙا", "t̪əɦˈaːɗaː"], // dental t̪, ہ → ɦ, ݙ → ɗ ("yours")
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWordRules(word)).toBe(ipa);
        });
    }
});
