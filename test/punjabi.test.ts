import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/punjabi/punjabi.ts";

// Canonical-IPA goldens for Punjabi (pa), Gurmukhi script — a Brahmic abugida via the generic engine, plus
// Punjabi's signature TONOGENESIS: the historical voiced-aspirate letters ਘ ਝ ਢ ਧ ਭ de-aspirate and shift tone
// (voiceless + low tone ˨˩ word-initially, voiced + high-falling ˥˩ post-vocalically); addak ੱ geminates the
// following consonant (→ length ː); retroflex ʈ ɖ ɳ ɽ vs dental t̪ d̪. See docs/pa_native_bringup_investigation.md.
describe("punjabi canonical IPA", () => {
    test("tonogenesis (voiced-aspirate de-aspiration + tone)", () => {
        expect(phonemizeWord("ਘੋੜਾ")).toBe("kˈoː˨˩ɽaː"); // ghoṛā 'horse': word-initial gh→k + low tone
        expect(phonemizeWord("ਭਾਰਤ")).toBe("pˈaː˨˩ɾət̪"); // bhārat: bh→p + low tone
        expect(phonemizeWord("ਕੰਘਾ")).toBe("kˈə̃˥˩ŋɡaː"); // kaṅghā 'comb': medial gh→ɡ + high-falling tone
        expect(phonemizeWord("ਸਿੰਘ")).toBe("sˈɪ̃˥˩ŋɡ"); // siṅgh 'Singh': medial gh→ɡ + high tone
        expect(phonemizeWord("ਦੁੱਧ")).toBe("d̪ˈʊ˥˩d̪ː"); // duddh 'milk': addak + dh→d̪ + high tone
    });

    test("abugida core: retroflex/dental, addak gemination, nasal", () => {
        expect(phonemizeWord("ਵੱਡਾ")).toBe("ʋˈəɖːaː"); // vaḍḍā 'big': addak → retroflex geminate ɖː
        expect(phonemizeWord("ਪਾਣੀ")).toBe("pˈaːɳiː"); // pāṇī 'water': retroflex ɳ
        expect(phonemizeWord("ਪੰਜਾਬੀ")).toBe("pˈə̃ɲd͡ʒaːbiː"); // panjābī: tippi → homorganic ɲ before d͡ʒ
    });

    test("text: word run + Gurmukhi danda", () => {
        expect(phonemize("ਪੰਜਾਬੀ ਬੋਲੀ।", "pa")).toContain("d͡ʒaːbiː");
    });
});
