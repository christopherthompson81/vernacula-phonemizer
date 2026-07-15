import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/javanese/javanese.ts";

// Canonical-IPA goldens for Javanese / Basa Jawa (jv) — Austronesian, Latin script, rule-based g2p ported from
// the espeak-ng-portable authored bring-up and validated against kaikki jav (human, 85.9% folded). The signature
// processes: the ⟨a⟩→[ɔ] rule (open final + penult harmony), the DENTAL vs RETROFLEX contrast (t̪ d̪ vs ʈ ɖ),
// closed-syllable laxing (i→ɪ u→ʊ) + final ⟨k⟩→ʔ, pepet/taling ⟨e⟩. See docs/jv_native_bringup_investigation.md.
describe("javanese canonical IPA", () => {
    test("the a→ɔ rule (open final + penult harmony; closed final blocks it)", () => {
        const cases: [string, string][] = [
            ["apa", "ˈɔpɔ"], // both open a → ɔ
            ["mata", "mˈɔt̪ɔ"],
            ["Jawa", "d͡ʒˈɔwɔ"],
            ["basa", "bˈɔsɔ"],
            ["lima", "lˈimɔ"], // penult i not a → only final harmonises
            ["sanga", "sˈɔŋɔ"], // harmony across the ⟨ng⟩ digraph
            ["mangan", "mˈaŋan"], // closed final syllable blocks the rule
            ["dalan", "d̪ˈalan"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("dental vs retroflex, laxing, final ⟨k⟩→ʔ", () => {
        const cases: [string, string][] = [
            ["kutha", "kˈuʈɔ"], // ⟨th⟩→ʈ retroflex (not aspirate); final a→ɔ
            ["dhawuh", "ɖˈawʊh"], // ⟨dh⟩→ɖ retroflex; u→ʊ laxing
            ["pitik", "pˈit̪ɪʔ"], // dental t̪; i→ɪ; final k→ʔ
            ["cilik", "t͡ʃˈilɪʔ"], // ⟨c⟩→t͡ʃ
            ["wong", "wˈɔŋ"], // o→ɔ closed laxing, ⟨ng⟩→ŋ
            ["dhuwur", "ɖˈuwʊr"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("pepet vs taling ⟨e⟩ (diacritics disambiguate)", () => {
        expect(phonemizeWord("sega")).toBe("sˈəɡɔ"); // bare ⟨e⟩ → pepet ə
        expect(phonemizeWord("élok")).toBe("ˈelɔʔ"); // é → /e/
        expect(phonemizeWord("kringèt")).toBe("krˈiŋɛt̪"); // è → /ɛ/
    });

    test("numbers (ngoko; irregular -likur / suppletive seket·sewidak)", () => {
        expect(phonemize("20", "jv")).toBe("rˈɔŋ pˈulʊh");
        expect(phonemize("25", "jv")).toBe("səlˈawe"); // selawé (suppletive)
        expect(phonemize("50", "jv")).toBe("sˈəkət̪"); // seket
        expect(phonemize("60", "jv")).toBe("səwˈid̪aʔ"); // sewidak
        expect(phonemize("100", "jv")).toBe("sˈat̪ʊs"); // satus
        expect(phonemize("1234", "jv")).toBe(
            "sˈəwu rˈɔŋ ˈat̪ʊs t̪ˈəlʊŋ pˈulʊh pˈapat̪",
        );
    });

    test("running text: a→ɔ + pepet on connected words", () => {
        expect(phonemize("Aku mangan sega.", "jv")).toContain(
            "ˈaku mˈaŋan sˈəɡɔ",
        );
    });
});
