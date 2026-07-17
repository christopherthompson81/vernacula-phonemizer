import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/punjabi/punjabi.ts";

// Canonical-IPA goldens for Punjabi (pa), Gurmukhi script — a Brahmic abugida via the generic engine, plus
// Punjabi's signature TONOGENESIS: the historical voiced-aspirate letters ਘ ਝ ਢ ਧ ਭ de-aspirate and shift tone
// (voiceless + low tone ˨˩ word-initially, voiced + high-falling ˥˩ post-vocalically); addak ੱ geminates the
// following consonant (→ length ː); retroflex ʈ ɖ ɳ ɽ vs dental t̪ d̪. See docs/investigations/pa_native_bringup_investigation.md.
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

// Shahmukhi (Perso-Arabic) is the SECOND script Punjabi is written in (Pakistan). The abjad front-end
// (shahmukhi.ts) feeds the SAME shared Punjabi phonology, so a Shahmukhi spelling with its vowels written yields
// the SAME canonical IPA as the Gurmukhi one — one phonology, two scripts. The abjad omits most short vowels, so
// undiacritized text falls back to the default schwa (the shared restoration gap, as for Urdu).
describe("punjabi Shahmukhi front-end", () => {
    test("script parity: same IPA as Gurmukhi (tonogenesis + retroflex + gemination carry through)", () => {
        expect(phonemizeWord("گھوڑا")).toBe("kˈoː˨˩ɽaː"); // ghoṛā: bh-init de-aspirate → k + low tone
        expect(phonemizeWord("بھارت")).toBe("pˈaː˨˩ɾət̪"); // bhārat: bh→p + low tone
        expect(phonemizeWord("پاݨی")).toBe("pˈaːɳiː"); // pāṇī: Punjabi-specific ݨ → retroflex ɳ
        expect(phonemizeWord("وڈّا")).toBe("ʋˈəɖːaː"); // vaḍḍā: word-initial و glide + shadda → geminate ɖː
        expect(phonemizeWord("یار")).toBe("jˈaːɾ"); // yār: word-initial ی → glide j
    });

    test("homorganic nasal: generic ن assimilates before velar/palatal (abjad has no tippi)", () => {
        // Assert the ASSIMILATION property (ن→ŋ before velar گ), not the exact short vowel — that only surfaces
        // when the schwa between ن and گ is deleted, which the coverage lexicon / an explicit sukun supplies.
        // vowel-agnostic on purpose: the mined vowel for this word (سُنگھی, ʊ) is a noisy referee artifact.
        expect(phonemizeWord("سنگھی")).toContain("ŋɡ"); // saṅghī: نگ → ŋɡ + medial gh high tone
        expect(phonemizeWord("پنجابی")).toBe("pəɲd͡ʒˈaːbiː"); // panjābī: نج → ɲd͡ʒ
    });

    test("text: Shahmukhi word run + Urdu punctuation", () => {
        expect(phonemize("پنجابی بولی۔", "pa")).toBe("pəɲd͡ʒˈaːbiː bˈoːliː");
    });
});
