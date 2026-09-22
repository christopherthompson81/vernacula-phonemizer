/**
 * Two words reported through the Kokoro path (#1431, #1428), and the reason the first triage was wrong.
 *
 * ⚠ THE DEFECT WAS THE BEAT, NOT THE PHONES. `superalloy` was first called "does not reproduce" because
 * every path emitted the ⟨ɔᶦ⟩ the report said was missing — the identical mistake Run 17 made on
 * `horsepower`, which Run 20 corrected: *"the IPA is right about the phones and wrong about the beat."*
 * misaki's `us_gold`, the lexicon Kokoro was trained on, has `sˈupəɹˌælˌY` — THREE marks, with a
 * SECONDARY on the final /ɔɪ/. `phonemizeAsync`, which the app and the Kokoro path both use, left that
 * diphthong unmarked, and an unstressed final diphthong is what reduces to *-ley*.
 *
 * ⚠ SO THE ASSERTIONS ARE ABOUT STRESS MARKS, not about which phones are present. Checking the phones is
 * what let this through the first time.
 */
import { describe, expect, test } from "vitest";
import { phonemize, phonemizeAsync } from "../src/index.ts";

describe("a recorded word reads the same on both entry points", () => {
    // ⚠ BOTH PATHS, because the split WAS the defect: the rule path already matched gold and the neural
    // path did not, so a test on either one alone would have passed while the reported reading stayed
    // broken. A recorded word must never take the OOV path at all.
    test.each([
        ["superalloy", "sˈuːpɚˌælˌɔᶦ"],
        ["superalloys", "sˈuːpɚˌælˌɔᶦz"],
        ["profilometry", "pɹˌoᶷfəlˈɑːmətɹi"],
        ["profilometer", "pɹˌoᶷfəlˈɑːmət̬ɚ"],
    ])("%s", async (word, expected) => {
        expect(phonemize(word, "en")).toBe(expected);
        expect(await phonemizeAsync(word, "en")).toBe(expected);
    });

    // ⚠ THE FINAL DIPHTHONG CARRIES A MARK. This is the property the report was actually about, stated
    // so it cannot be satisfied by the phones alone — gold's `ˌY` is a secondary stress, not a bare
    // vowel, and dropping it is what Kokoro renders as *-ley*.
    test("the final /ɔɪ/ of superalloy keeps its secondary stress", async () => {
        for (const ipa of [phonemize("superalloy", "en"), await phonemizeAsync("superalloy", "en")]) {
            expect(ipa).toMatch(/ˌɔᶦ$/u);
            expect(ipa).not.toMatch(/[^ˈˌ]ɔᶦ$/u);
        }
    });

    // ⚠ AND THE STEM VOWEL IS THE `-ometry` FAMILY'S, not a guess: gold gives `goniometry` and
    // `interferometry` the tail `AA1 M AH0 T R IY0`, and the `-ometer` pair `AA1 M AH0 T ER0`.
    // ⚠ THE SIBLING ASSERTED HERE IS `optometry`, NOT `goniometry`, and the difference matters: gold has
    // goniometry but OUR dict does not, so it is OOV and renders ɡˌoᶷniʲˈɑːmɪtɹi — asserting against it
    // would have pinned an OOV guess as if it were a recorded fact. `optometry` IS recorded, with
    // exactly that tail.
    test("profilometry reduces its second syllable, like its recorded siblings", () => {
        expect(phonemize("profilometry", "en")).toContain("fəl");
        expect(phonemize("profilometry", "en")).not.toContain("faᶦl");
        expect(phonemize("optometry", "en")).toContain("ˈɑːmətɹi");
    });
});
