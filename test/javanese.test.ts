import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/javanese/javanese.ts";

// Canonical-IPA goldens for Javanese / Basa Jawa (jv) — Austronesian, Latin script, rule-based g2p refereed
// by kaikki jav (human). The signature processes: the ⟨a⟩→[ɔ] rule (open final + penult harmony),
// the DENTAL vs RETROFLEX contrast (t̪ d̪ vs ʈ ɖ),
// closed-syllable laxing (i→ɪ u→ʊ) + final ⟨k⟩→ʔ, pepet/taling ⟨e⟩.
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

        // Homorganic nasal assimilation: /n/ → [ɲ] before a palatal affricate (rule, both scripts).
        expect(phonemizeWord("kanca")).toBe("kˈaɲt͡ʃɔ");
        expect(phonemizeWord("banci")).toBe("bˈaɲt͡ʃi");

        // CROSS-SCRIPT ⟨e⟩ lexicon: for undiacritized Latin the ⟨e⟩ pepet/taling is unrecoverable, so the SHIPPED
        // path pins the Aksara-resolved taling vowel (pangeran→paŋeran); phonemizeWordRules keeps the pepet default.
        expect(phonemizeWord("pangeran")).toBe("paŋˈeran"); // taling — from the Aksara cross-script
        expect(phonemizeWordRules("pangeran")).toBe("paŋˈəran"); // Latin rule default (pepet)
        expect(phonemizeWord("bebek")).toBe("bˈebeʔ");
        // Number words bypass the content lexicon (the taling homograph seket ≠ the number 50 [səkət̪]):
        expect(phonemize("50", "jv")).toBe("sˈəkət̪");
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

    // Aksara Jawa (Hanacaraka) front-end — the native abugida, scanned into the SAME phonology as Latin. It is
    // MORE phonemic than the Latin: pepet vs taling and dental vs retroflex are written distinctly.
    test("Aksara Jawa script: abugida → same phonology", () => {
        const cases: [string, string][] = [
            ["ꦗꦮ", "d͡ʒˈɔwɔ"], // jawa — a→ɔ from the inherent vowels
            ["ꦱꦺꦭ", "sˈelɔ"], // sela — taling ꦺ = /e/ (not the pepet default)
            ["ꦥꦸꦭꦺꦴ", "pˈulo"], // pulo — taling + tarung = /o/
            ["ꦮꦺꦴꦁ", "wˈɔŋ"], // wong — o→ɔ closed laxing, cecak coda ŋ
            ["ꦱꦽꦔꦺꦔꦺ", "srəŋˈeŋe"], // srengenge — keret = medial -rə-
            ["ꦏꦸꦛ", "kˈuʈɔ"], // kutha — retroflex ꦛ = ʈ
            ["ꦒꦗꦃ", "ɡˈad͡ʒah"], // gajah — wignyan ꦃ = final /h/
            ["ꦲꦧꦁ", "ˈabaŋ"], // abang — ꦲ "ha" is the silent vowel carrier
            ["ꦥꦶꦠꦶꦏ꧀", "pˈit̪ɪʔ"], // pitik — same output as the Latin "pitik" (shared phonology)
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("Aksara Jawa digits route through the ngoko compositor", () => {
        expect(phonemize("꧑꧒꧓", "jv")).toBe("sˈat̪ʊs t̪əlulˈikʊr"); // 123 = satus telulikur
    });
});
