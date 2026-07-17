import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/gujarati/gujarati.ts";

// Canonical-IPA goldens for Gujarati (gu) — Indo-Aryan, the Gujarati abugida. Reuses the generic abugida engine +
// the Hindi orchestration (schwa deletion, weight stress, numbers) with a Gujarati-Unicode data file. Validated
// against wikipron guj (80.4%) + kaikki guj (82.2%), both human. Gujarati has NO phonemic length (ઇ/ઈ→i), ⟨આ⟩=a,
// the ⟨ે⟩/⟨ો⟩ mids are [e]~[ɛ]/[o]~[ɔ], dental t̪/d̪ vs retroflex ʈ/ɖ, ળ→ɭ, ષ→ʂ. See docs/investigations/gu_native_bringup_investigation.md.
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

    // Whole-word schwa lexicon (cross-source consensus of wikipron+kaikki) for the proven-lexical medial-schwa
    // tail. SHIPPED phonemizeWord applies it; phonemizeWordRules (and the referee eval) bypass it.
    test("schwa lexicon: shipped override for the lexical tail; rule engine untouched", () => {
        expect(phonemizeWord("અબલખ")).toBe("ˈəbələkʰ"); // schwa RETAINED (rule over-deletes → əbləkʰ)
        expect(phonemizeWord("અન્ય")).toBe("ˈənjə"); // final schwa retained after cluster
        expect(phonemizeWord("અષ્ટકોણ")).toBe("ˈəʂʈkoɳ"); // schwa DELETED (rule under-deletes → əʂʈəkoɳ)
        // the rule engine is the honest, lexicon-free signal:
        expect(phonemizeWordRules("અબલખ")).toBe("ˈəbləkʰ");
        expect(phonemizeWordRules("અષ્ટકોણ")).toBe("ˈəʂʈəkoɳ");
        // nukta loanword ફ → [f] (not native [pʰ]) — a consensus lexicon entry
        expect(phonemizeWord("કોફી")).toBe("kˈofi");
    });

    // 21-99 are IRREGULAR compound spellings (like Hindi), authored in numbers.compound.
    test("irregular 21-99 numbers + Indic grouping", () => {
        expect(phonemize("21", "gu")).toBe("ˈekʋis"); // ekvees
        expect(phonemize("45", "gu")).toBe("pˈist̪alis"); // pistaalees
        expect(phonemize("99", "gu")).toBe("nˈəʋʋaɳũ"); // navvaanoo
        expect(phonemize("4567", "gu")).toBe("t͡ʃˈaɾ ɦˈəd͡ʒaɾ pˈãɲt͡ʃ sˈo sˈəɽsəʈʰ");
    });
});
