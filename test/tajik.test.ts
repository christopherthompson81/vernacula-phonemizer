import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tajik/tajik.ts";
import { getPhonemizer } from "../src/registry.ts";

// Tajik / тоҷикӣ (tg) — Iranian (SW), a Persian variety in the CYRILLIC alphabet. Verified ✅ against wikipron
// tgk_cyrl broad (human, PRIMARY, 98.1% folded) + narrow (human) + epitran. Cyrillic writes all vowels → no
// short-vowel restoration (unlike the fa abjad).
describe("Tajik canonical IPA (Cyrillic Persian, near-phonemic)", () => {
    test("six-vowel system: о→ɔ (Persian ā), ӯ→ɵ, а→a", () => {
        expect(phonemizeWord("забон")).toBe("zabˈɔn"); // 'language' — о→ɔ
        expect(phonemizeWord("модар")).toBe("mɔdˈar"); // 'mother'
        expect(phonemizeWord("рӯз")).toBe("rˈɵz"); // 'day' — ӯ→ɵ
        expect(phonemizeWord("нӯҳ")).toBe("nˈɵh"); // 'nine' — ӯ→ɵ, ҳ→h
    });

    test("special Cyrillic letters: ғ→ʁ, қ→q, ҳ→h, ҷ→d͡ʒ, х→χ", () => {
        expect(phonemizeWord("ғарб")).toBe("ʁˈarb"); // 'west'
        expect(phonemizeWord("қалам")).toBe("qalˈam"); // 'pen'
        expect(phonemizeWord("ҷавон")).toBe("d͡ʒavˈɔn"); // 'young'
        expect(phonemizeWord("шаҳр")).toBe("ʃˈahr"); // 'city' — ш→ʃ, ҳ→h
        expect(phonemizeWord("хона")).toBe("χɔnˈa"); // 'house' — х→χ
    });

    test("iotation + hiatus glide: initial/hiatus е→je, и→ji", () => {
        expect(phonemizeWord("эронӣ")).toBe("jerɔnˈi"); // 'Iranian' — word-initial э→je
        expect(phonemizeWord("Саид")).toBe("sajˈid"); // hiatus и→ji (matches the human referee; epitran misses it)
    });

    test("Persian final stress + a clause", () => {
        expect(getPhonemizer("tg").text("Забони тоҷикӣ эронӣ аст.")).toBe(
            "zabɔnˈi tɔd͡ʒikˈi jerɔnˈi ˈast .",
        );
    });

    test("cardinal numbers with the -у (va) connector", () => {
        const p = getPhonemizer("tg");
        expect(p.text("21")).toBe("bistˈu jˈak"); // бисту як
        expect(p.text("345")).toBe("sesadˈu t͡ʃilˈu pˈand͡ʒ"); // сесаду чилу панҷ
        expect(p.text("1100")).toBe("hazɔrˈu sˈad"); // ҳазору сад
    });
});
