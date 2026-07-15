import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/bengali/bengali.ts";

// Canonical-IPA goldens for Bengali (bn) — native abugida G2P (bengali.jsonc + core/abugida) + Bengali-specific
// vowel harmony, inherent-vowel deletion, and phôla gemination. Standard (Kolkata/standard-colloquial) variety:
// inherent vowel /ɔ/ (raises to [o] by harmony), three sibilants শ ষ স → ʃ, dental t̪/d̪ vs retroflex ʈ/ɖ,
// ং → ŋ, র → tap ɾ. See docs/bn_native_bringup_investigation.md.
describe("bengali canonical IPA", () => {
    test("core akshara → IPA (dental/retroflex, sibilant merger, ং→ŋ)", () => {
        const cases: [string, string][] = [
            ["বাংলাদেশ", "baŋlad̪eʃ"], // Bangladesh: ং→ŋ, দ dental, শ→ʃ
            ["মানুষ", "manuʃ"], // manush: ষ→ʃ
            ["দেশ", "d̪eʃ"], // desh
            ["নাম", "nam"], // nam
            ["ভালো", "bʱalo"], // bhalo: breathy bʱ, ো→o
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("vowel harmony ɔ→o (open syllable) + inherent-vowel deletion/retention", () => {
        expect(phonemizeWord("করি")).toBe("koɾi"); // kori: ɔ raises before high [i]
        expect(phonemizeWord("কর")).toBe("kɔɾ"); // kôr: no following vowel → ɔ stays, final inherent deleted
        expect(phonemizeWord("জল")).toBe("d͡ʒɔl"); // jôl: final inherent deleted after single C
        expect(phonemizeWord("অংশ")).toBe("ɔŋʃo"); // ôngsho: cluster coda → final inherent retained as [o]
    });

    test("phôla gemination (jô/bô/mô) + geminate-coda vowel retention", () => {
        expect(phonemizeWord("বিদ্যা")).toBe("bid̪ːa"); // biddya: jôphôla ্য → geminate d̪ː
        expect(phonemizeWord("যুদ্ধ")).toBe("d͡ʒud̪ʱːo"); // juddho: geminate d̪ʱː + retained [o]
        expect(phonemizeWord("পদ্ম")).toBe("pɔd̪ːo"); // pôdmo: môphôla → geminate
    });

    test("medial inherent-vowel deletion (Ohala VCɔCV) + ক্ষ / জ্ঞ conjuncts", () => {
        expect(phonemizeWord("আপনার")).toBe("apnaɾ"); // apnar: medial ɔ deleted (apɔnaɾ→apnaɾ)
        expect(phonemizeWord("অক্ষর")).toBe("ɔkʰːɔɾ"); // ôkkhôr: ক্ষ → [kʰː]
        expect(phonemizeWord("বিজ্ঞান")).toBe("biɡːan"); // biggan: জ্ঞ → [ɡː]
    });

    test("text: words + Bengali danda pause", () => {
        expect(phonemize("আমি বাংলা বলি।", "bn")).toContain("baŋla");
    });
});
