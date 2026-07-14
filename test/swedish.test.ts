import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/swedish/swedish.ts";

// Canonical-IPA goldens for Central Standard Swedish (rikssvenska), espeak-independent. Phase 2 adds the NST
// pitch-accent + stress lexicon (accent-stress.tsv, CC0): word → accent 1|2 + the primary-stress nucleus. The
// accent-2 grave (combining U+0300) marks the primary-stressed vowel; accent 1 is unmarked. Stress can be
// non-initial (loanwords). OOV words fall to the rules (first-syllable stress; accent by shape). Segmental
// conventions: sje ɧ, tje ɕ, g→j before front, retroflex rt/rd/rn/rs/rl → ʈ/ɖ/ɳ/ʂ/ɭ, geminate → Cː + short V,
// complementary length on the stressed syllable. Monosyllables carry no ˈ / accent. Output is NFD.
describe("swedish canonical IPA", () => {
    test("sje-sound ɧ (sj/skj/stj/sch, sk+front)", () => {
        expect(phonemizeWord("sjö")).toBe("ɧøː");
        expect(phonemizeWord("skjorta")).toBe("ɧˈùːʈa"); // skj → ɧ, rt → ʈ, accent 2 (grave on u)
        expect(phonemizeWord("stjärna")).toBe("ɧˈæ̀ːɳa"); // stj → ɧ, ä-before-r → æː, rn → ɳ, accent 2
        expect(phonemizeWord("själ")).toBe("ɧɛːl");
        expect(phonemizeWord("skön")).toBe("ɧøːn"); // sk + front ö → ɧ
    });

    test("tje-sound ɕ (tj/kj, k+front) + g→j before front", () => {
        expect(phonemizeWord("kött")).toBe("ɕœtː"); // k+ö → ɕ, tt → tː, short ö (monosyllable)
        expect(phonemizeWord("kyrka")).toBe("ɕˈʏ̀rka");
        expect(phonemizeWord("känna")).toBe("ɕˈɛ̀nːa");
        expect(phonemizeWord("göra")).toBe("jˈœ̀ːra"); // g+ö → j, ö-before-r → œː
        expect(phonemizeWord("get")).toBe("jeːt");
        expect(phonemizeWord("gärna")).toBe("jˈæ̀ːɳa");
    });

    test("root keeps hard k/g before a front-vowel inflection (softening is a stressed-onset rule)", () => {
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // bok+en → k stays hard; accent 1 (definite of an A1 noun)
        expect(phonemizeWord("dragen")).toBe("drˈɑ̀ːɡɛn"); // drag+en → g stays hard; accent 2 (participle)
    });

    test("silent word-initial digraphs hj/lj/dj/gj → j (medial = C + j)", () => {
        expect(phonemizeWord("hjul")).toBe("jʉːl");
        expect(phonemizeWord("ljus")).toBe("jʉːs");
        expect(phonemizeWord("djur")).toBe("jʉːr");
        expect(phonemizeWord("miljon")).toBe("mɪljˈuːn"); // medial lj → l + j; stress on 2nd (loanword)
        expect(phonemizeWord("familj")).toBe("famˈɪlj");
    });

    test("retroflex assimilation + final -rg soften", () => {
        expect(phonemizeWord("barn")).toBe("bɑːɳ"); // rn → ɳ
        expect(phonemizeWord("berg")).toBe("bɛrj"); // r + g → r j
    });

    test("complementary length: long-V+short-C vs short-V+geminate-C", () => {
        expect(phonemizeWord("bok")).toBe("buːk"); // open syllable → long o = uː
        expect(phonemizeWord("fisk")).toBe("fɪsk"); // coda cluster → short i
        expect(phonemizeWord("egg")).toBe("ɛɡː"); // geminate gg → ɡː
        expect(phonemizeWord("ligga")).toBe("lˈɪɡːa"); // accent 1 (per NST)
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀ka"); // ck → k; accent 2
    });

    test("Phase 2 — pitch accent (NST lexicon): accent-2 grave vs unmarked accent 1", () => {
        expect(phonemizeWord("tala")).toBe("tˈɑ̀ːla"); // accent 2 (grave on the stressed vowel)
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀ka"); // accent 2
        expect(phonemizeWord("bil")).toBe("biːl"); // monosyllable → accent 1, no mark
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // accent 1 polysyllable → no grave
    });

    test("Phase 2 — stress lexicon fixes non-initial (loanword) stress + its vowel quality", () => {
        expect(phonemizeWord("polis")).toBe("pɔlˈiːs"); // stress 2nd → o unstressed short ɔ, i long
        expect(phonemizeWord("station")).toBe("staɧˈuːn"); // -tion stressed
        expect(phonemizeWord("student")).toBe("stɵdˈɛnt");
        expect(phonemizeWord("universitet")).toBe("ɵnɪvɛʂɪtˈeːt"); // stress on the 5th nucleus
        expect(phonemizeWord("telefon")).toBe("tɛlɛfˈuːn");
    });

    test("irregular function words", () => {
        expect(phonemizeWord("jag")).toBe("jɑː"); // silent g
        expect(phonemizeWord("och")).toBe("ɔ");
    });

    test("numbers (tens-first compounds; split at thousand/million)", () => {
        expect(phonemize("2", "sv")).toBe("tvoː"); // två
        expect(phonemize("7", "sv")).toBe("ɧʉː"); // sju
        expect(phonemize("21", "sv")).toBe("ɕˈʉ̀ːɡɔɛtː"); // tjugoett
        expect(phonemize("100", "sv")).toBe("ɛtːhˈɵndra"); // etthundra
        expect(phonemize("1000", "sv")).toBe("ˈɛ̀tːɵsɛn"); // ettusen
        expect(phonemize("1000000", "sv")).toBe("eːn mɪljˈuːn"); // en miljon
    });

    test("text: clause assembly + punctuation", () => {
        expect(phonemize("Jag talar svenska.", "sv")).toBe("jɑː tˈɑ̀ːlar svˈɛ̀nska .");
    });
});
