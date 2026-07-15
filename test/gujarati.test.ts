import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/gujarati/gujarati.ts";

// Canonical-IPA goldens for Gujarati (gu) — Indo-Aryan, the Gujarati abugida. Reuses the generic abugida engine +
// the Hindi orchestration (schwa deletion, weight stress, numbers) with a Gujarati-Unicode data file. Validated
// against wikipron guj (80.4%) + kaikki guj (82.2%), both human. Gujarati has NO phonemic length (ઇ/ઈ→i), ⟨આ⟩=a,
// the ⟨ે⟩/⟨ો⟩ mids are [e]~[ɛ]/[o]~[ɔ], dental t̪/d̪ vs retroflex ʈ/ɖ, ળ→ɭ, ષ→ʂ. See docs/gu_native_bringup_investigation.md.
describe("gujarati canonical IPA", () => {
    test("consonants, vowels, schwa deletion, anusvara", () => {
        const cases: [string, string][] = [
            ["ગુજરાત", "ɡˈud͡ʒɾat̪"], // Gujarat — medial + final schwa deleted, dental t̪
            ["નમસ્તે", "nəmˈəst̪e"], // namaste
            ["પાણી", "pˈaɳi"], // pani — retroflex ɳ
            ["ઘર", "ɡʱˈəɾ"], // ghar — breathy ɡʱ
            ["માણસ", "mˈaɳəs"], // manas — medial schwa retained
            ["બાળક", "bˈaɭək"], // balak — ળ → ɭ retroflex lateral
            ["શહેર", "ʃˈəɦeɾ"], // sheher
            ["કેમ", "kˈem"], // kem
            ["ભાષા", "bʱˈaʂa"], // bhasha — ષ → ʂ, breathy bʱ
            ["ધન્યવાદ", "d̪ʱˈənjəʋad̪"], // dhanyavad — dental d̪ʱ
            ["અંક", "ˈə̃ŋk"], // ank — anusvara → homorganic nasal ŋ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (units, teens, round tens, magnitudes)", () => {
        expect(phonemize("5", "gu")).toBe("pˈãɲt͡ʃ"); // paanch
        expect(phonemize("10", "gu")).toBe("d̪ˈəs"); // das
        expect(phonemize("100", "gu")).toBe("ˈek sˈo"); // ek so
        expect(phonemize("1000", "gu")).toBe("ˈek ɦˈəd͡ʒaɾ"); // ek hazaar
    });

    test("Gujarati digits", () => {
        expect(phonemize("૫૦૦", "gu")).toBe("pˈãɲt͡ʃ sˈo"); // 500 = paanch so
    });
});
