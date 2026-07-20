import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules } from "../src/languages/ilocano/ilocano.ts";

// Canonical-IPA goldens for Ilocano / Iloko (ilo) — Austronesian (Northern Luzon, NOT Bisayan), Latin. TWO paths:
// phonemizeWordRules = the non-circular RULE g2p (what the referee eval measures, ~83%); phonemizeWord = the shipped
// path (a stress-marked-referee lexicon first, then the rule). The rule's Ilocano-distinctive HIATUS: a HIGH vowel
// ⟨i u⟩ before a vowel GLIDES (dua→dwa, radio→ɾadjo). Whether a high vowel glides vs stays syllabic is LEXICAL
// (garcia stays but radio glides — identical C-i-V, differ only in lexical stress); the lexicon carries that.
// See docs/investigations/ilo_native_bringup_investigation.md.
describe("Ilocano — the RULE g2p (phonemizeWordRules; the non-circular eval path)", () => {
    test("high-vowel GLIDING hiatus: i→j, u→w before a vowel (the split from Bisayan)", () => {
        expect(phonemizeWordRules("dua")).toBe("dwˈa"); // ⟨u⟩ before a → w
        expect(phonemizeWordRules("radio")).toBe("ɾˈadjo"); // ⟨i⟩ before o → j
        expect(phonemizeWordRules("dies")).toBe("djˈɛs"); // ⟨i⟩ before e → j; ⟨e⟩→ɛ
    });
    test("non-high hiatus keeps the glottal; word-initial glottal", () => {
        expect(phonemizeWordRules("tao")).toBe("tˈaʔo"); // a+o hiatus → glottal
        expect(phonemizeWordRules("naimbag")).toBe("naʔˈimbaɡ"); // a+i hiatus glottal
        expect(phonemizeWordRules("agtutubo")).toBe("ʔaɡtutˈubo"); // word-initial glottal
    });
});

describe("Ilocano — the shipped LEXICON path (phonemizeWord) fixes the lexical residual", () => {
    test("lexical gliding: the stressed high vowel STAYS syllabic (what the rule can't derive)", () => {
        expect(phonemizeWord("garcia")).toBe("ɡaɾsˈia"); // i STAYS (rule wrongly glides → ɡaɾkja)
        expect(phonemizeWord("kua")).toBe("kuˈa"); // u STAYS (rule → kwa)
        expect(phonemizeWord("biblioteka")).toBe("bibliotˈɛka"); // io STAYS (rule → bibljo…)
    });
    test("OOV falls back to the rule g2p", () => {
        expect(phonemizeWord("zzqx")).toBe(phonemizeWordRules("zzqx"));
    });
});
