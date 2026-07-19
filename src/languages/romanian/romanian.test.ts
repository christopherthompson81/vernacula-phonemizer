import { describe, expect, test } from "vitest";
import { phonemizeWord } from "./romanian.ts";

// Diagnostic gold for the Romanian (ro) g2p — common words, one per signature feature. These are OUR canonical
// output; they match the wikipron ron_latn referee on the shared backbone (stress is deferred, unwritten). The
// suite locks the distinctive Romanian behaviors: ă→ə / â→î→ɨ, ș→ʃ / ț→t͡s, c/g softening + ch/gh, the e̯a/o̯a
// rising diphthongs, i/u glides, final-i palatalisation, and word-initial e→je. See docs/investigations/ro_native_bringup_investigation.md.
describe("Romanian (ro) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["și", "ʃi"], // ș → ʃ ("and")
        ["este", "jeste"], // word-initial e → je (copula)
        ["zece", "zet͡ʃe"], // c before e → t͡ʃ ("ten")
        ["cinci", "t͡ʃint͡ʃʲ"], // c soft + final -i palatalisation ("five")
        ["geografie", "d͡ʒeoɡrafie"], // g soft (ge → d͡ʒ) + final -ie HIATUS (not glide)
        ["gheață", "ɡe̯at͡sə"], // gh → ɡ + ea diphthong + ț → t͡s ("ice")
        ["ceai", "t͡ʃe̯aj"], // c soft + ea diphthong + final i → j ("tea")
        ["floare", "flo̯are"], // oa diphthong ("flower")
        ["seară", "se̯arə"], // ea diphthong + final ă → ə ("evening")
        ["câine", "kɨjne"], // â → ɨ + i off-glide ("dog")
        ["viață", "vjat͡sə"], // i on-glide + ț ("life")
        ["școală", "ʃko̯alə"], // ș + oa diphthong ("school")
        ["lupi", "lupʲ"], // final -i palatalisation ("wolves")
        ["examen", "eɡzamen"], // word-initial ex- → eɡz ("exam")
        ["pâine", "pɨjne"], // î-spelling → ɨ + i off-glide ("bread")
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});
