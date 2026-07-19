import { describe, expect, test } from "vitest";
import { phonemizeWord } from "./romanian.ts";

// Diagnostic gold for the Romanian (ro) g2p — common words, one per signature feature. These are OUR canonical
// output; they match the wikipron ron_latn referee on the shared backbone (stress is deferred, unwritten). The
// suite locks the distinctive Romanian behaviors: ă→ə / â→î→ɨ, ș→ʃ / ț→t͡s, c/g softening + ch/gh, the e̯a/o̯a
// rising diphthongs, i/u glides, final-i palatalisation, and word-initial e→je. See docs/investigations/ro_native_bringup_investigation.md.
describe("Romanian (ro) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["și", "ˈʃi"], // ș → ʃ ("and")
        ["este", "ˈjeste"], // word-initial e → je (copula), stress on the je onset
        ["zece", "ˈzet͡ʃe"], // c before e → t͡ʃ ("ten")
        ["cinci", "ˈt͡ʃint͡ʃʲ"], // c soft + final -i palatalisation ("five")
        ["geografie", "d͡ʒeoɡraˈfie"], // g soft (ge → d͡ʒ) + final -ie HIATUS + penult stress
        ["gheață", "ˈɡe̯at͡sə"], // gh → ɡ + ea diphthong + ț → t͡s ("ice")
        ["ceai", "ˈt͡ʃe̯aj"], // c soft + ea diphthong + final i → j ("tea")
        ["floare", "ˈflo̯are"], // oa diphthong; stress before the fl onset ("flower")
        ["seară", "ˈse̯arə"], // ea diphthong + final ă → ə ("evening")
        ["câine", "ˈkɨjne"], // â → ɨ + i off-glide ("dog")
        ["viață", "ˈvjat͡sə"], // i on-glide + ț ("life")
        ["școală", "ˈʃko̯alə"], // ș + oa diphthong ("school")
        ["lupi", "ˈlupʲ"], // final -i palatalisation ("wolves")
        ["examen", "eˈɡzamen"], // word-initial ex- → eɡz + penult stress (lexicon) ("exam")
        ["pâine", "ˈpɨjne"], // î-spelling → ɨ + i off-glide ("bread")
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWord(word)).toBe(ipa);
        });
    }
});
