/**
 * urdu.jsonc's `longVowels` and `glides` must be the values the g2p emits.
 *
 * Both keys were declared on `UrduDef`, loaded by `loadManifest`, and never read: the scan spelled ɑː/oː/iː/eː
 * and ʋ/j as literals. Sabotaging either key moved 0 of 10,713 readings, which is the definition of dead data.
 * These assertions derive the expectation FROM the manifest, so a re-hardcoded literal that drifts from the
 * file fails here rather than being invisible.
 */
import { describe, expect, test } from "vitest";
import { loadManifest } from "../src/core/loadManifest.ts";
import { phonemize } from "../src/index.ts";

const DEF = loadManifest<{
    longVowels: Record<string, string>;
    glides: Record<string, string>;
}>(new URL("../src/languages/urdu/g2p.ts", import.meta.url).href, "urdu.jsonc");

const KAF = "ک"; // a plain consonant to sit the carrier after

describe("the Urdu g2p reads its vowel tables from the manifest", () => {
    // The five VOWEL CARRIERS. ⚠ Not every longVowels key — ﯼ ﯽ ئ ؤ are in the table but are not carriers,
    // and treating them as such moves 402 readings (the guard in `longVowelAfterConsonant` is the claim).
    for (const ch of ["ا", "آ", "و", "ی", "ے"]) {
        test(`carrier ${ch} → ${DEF.longVowels[ch]}`, () => {
            expect(phonemize(KAF + ch, "ur")).toContain(DEF.longVowels[ch]!);
        });
    }

    // و and ی after a vowel are the GLIDES, not the long vowels.
    for (const ch of Object.keys(DEF.glides)) {
        test(`glide ${ch} → ${DEF.glides[ch]}`, () => {
            const reading = phonemize(KAF + "ا" + ch + "ا", "ur");
            expect(reading).toContain(DEF.glides[ch]!);
        });
    }

    // The hamza seats are the two the code used to assert while their partners sat in the file.
    for (const ch of ["ئ", "ؤ"]) {
        test(`hamza seat ${ch} → ${DEF.longVowels[ch]}`, () => {
            expect(DEF.longVowels[ch]).toBeDefined();
            expect(phonemize("ب" + ch, "ur")).toContain(DEF.longVowels[ch]!);
        });
    }
});
