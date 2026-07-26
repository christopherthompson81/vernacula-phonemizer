import { describe, expect, test } from "vitest";

import { createMacedonian, phonemizeWord } from "../src/languages/macedonian/macedonian.ts";

// Macedonian (mk, македонски) — South Slavic (~2M), Cyrillic, fully phonemic with NO vowel reduction. A left-to-right
// grapheme scan + the shared South-Slavic phonotactics (dark-l, final devoicing, regressive voicing, n→ŋ). Two
// Macedonian specifics: the palatals are DISTINCT LETTERS (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю), and STRESS is
// FIXED on the ANTEPENULT syllable (predictable → emitted). 99.0% folded / 99.8% symbol accuracy vs the wikipron
// mkd_cyrl_narrow referee (63,024 headwords — the residual is letter-name rows). See docs/investigations/mk_native_bringup_investigation.md.
describe("Macedonian canonical IPA — phonemic Cyrillic g2p + antepenultimate stress", () => {
    const mk = createMacedonian();

    test("the distinct palatal LETTERS: ѓ→ɟ, ќ→c, љ→ʎ, њ→ɲ, ѕ→d͡z, џ→d͡ʒ", () => {
        expect(phonemizeWord("ѓавол")).toBe("ɟˈavɔɫ"); // ⟨ѓ⟩ → ɟ
        expect(phonemizeWord("куќа")).toBe("kˈuca"); // ⟨ќ⟩ → c
        expect(phonemizeWord("љубов")).toBe("ʎˈubɔf"); // ⟨љ⟩ → ʎ, final ⟨в⟩→f
        expect(phonemizeWord("коњ")).toBe("kˈɔɲ"); // ⟨њ⟩ → ɲ
        expect(phonemizeWord("ѕид")).toBe("d͡zˈit"); // ⟨ѕ⟩ → d͡z, final ⟨д⟩→t
        expect(phonemizeWord("џамија")).toBe("d͡ʒˈamija"); // ⟨џ⟩ → d͡ʒ
    });

    test("dark-l ([l] before е/и, [ɫ] elsewhere), syllabic ⟨р⟩→[r̩], final devoicing", () => {
        expect(phonemizeWord("волк")).toBe("vˈɔɫk"); // dark ⟨л⟩ before a consonant
        expect(phonemizeWord("леб")).toBe("lˈɛp"); // light ⟨л⟩ before ɛ, final ⟨б⟩→p
        expect(phonemizeWord("прст")).toBe("pˈr̩st"); // syllabic ⟨р⟩
        expect(phonemizeWord("срце")).toBe("sˈr̩t͡sɛ"); // syllabic ⟨р⟩ bears the stress
        expect(phonemizeWord("град")).toBe("ɡrˈat"); // final ⟨д⟩→t
    });

    test("fixed ANTEPENULT stress: 3rd-from-last syllable (planina→ˈplanina), penult in disyllables", () => {
        expect(phonemizeWord("Македонија")).toBe("makɛdˈɔnija"); // 5 syllables → antepenult (до)
        expect(phonemizeWord("планина")).toBe("pɫˈanina"); // 3 syllables → antepenult (пла)
        expect(phonemizeWord("ноќ")).toBe("nˈɔc"); // monosyllable
    });

    test("cardinal numbers: 'и' connector, feminine две илјади, millions", () => {
        expect(mk.text("15").trim()).toBe("pɛtnˈaɛsɛt"); // петнаесет
        expect(mk.text("21").trim()).toBe("dvˈaɛsɛt ˈi ˈɛdɛn"); // дваесет и еден
        expect(mk.text("234").trim()).toBe("dvˈɛstɛ trˈiɛsɛt ˈi t͡ʃˈɛtiri"); // двесте триесет и четири
        expect(mk.text("2000").trim()).toBe("dvˈɛ ˈiljadi"); // ДВЕ илјади (feminine илјада, not два)
        expect(mk.text("1000000").trim()).toBe("mˈiliɔn"); // милион (was empty before the fix)
        expect(mk.text("2000000").trim()).toBe("dvˈa milˈiɔni"); // два милиони (милион is masculine)
    });

    test("clause assembly", () => {
        expect(mk.text("Добар ден, Македонија!").trim()).toBe("dˈɔbar dˈɛn , makɛdˈɔnija !");
    });
});
