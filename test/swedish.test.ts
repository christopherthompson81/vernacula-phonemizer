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
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀kːa"); // ck → kː (geminate, like tt/kk/gg); accent 2
    });

    test("Phase 2 — pitch accent (NST lexicon): accent-2 grave vs unmarked accent 1", () => {
        expect(phonemizeWord("tala")).toBe("tˈɑ̀ːla"); // accent 2 (grave on the stressed vowel)
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀kːa"); // accent 2
        expect(phonemizeWord("bil")).toBe("biːl"); // monosyllable → accent 1, no mark
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // accent 1 polysyllable → no grave
    });

    test("Phase 2 — stress lexicon fixes non-initial (loanword) stress + its vowel quality", () => {
        expect(phonemizeWord("polis")).toBe("pɔlˈiːs"); // stress 2nd → o unstressed short ɔ, i long
        expect(phonemizeWord("station")).toBe("staɧˈuːn"); // -tion stressed
        expect(phonemizeWord("student")).toBe("stɵdˈɛnt");
        expect(phonemizeWord("universitet")).toBe("ɵnɪvɛʂɪtˈeːt"); // stress on the 5th nucleus
        expect(phonemizeWord("europa")).toBe("ɛɵrˈuːpa"); // diphthong ⟨eu⟩ counts 2 nuclei → stress lands past it
    });

    test("Phase 3 — lexical o-quality (NST): stressed ⟨o⟩ is [oː] or [uː]", () => {
        expect(phonemizeWord("telefon")).toBe("tɛlɛfˈoːn"); // lexical [oː] override
        expect(phonemizeWord("kol")).toBe("koːl");
        expect(phonemizeWord("adobe")).toBe("adˈoːbɛ");
        expect(phonemizeWord("bok")).toBe("buːk"); // default [uː] kept
        expect(phonemizeWord("son")).toBe("suːn");
        expect(phonemizeWord("stor")).toBe("stuːr");
    });

    test("segmental edge cases (é, gn, x, ck geminate, ä-before-r)", () => {
        expect(phonemizeWord("idé")).toBe("ɪdˈeː"); // é → long eː (loanword vowel), stressed via lexicon
        expect(phonemizeWord("kafé")).toBe("kafˈeː");
        expect(phonemizeWord("gnista")).toBe("ɡnˈɪ̀sta"); // word-initial gn → ɡn (not ŋn)
        expect(phonemizeWord("regn")).toBe("rɛŋn"); // coda gn → ŋn
        expect(phonemizeWord("sex")).toBe("sɛks"); // ⟨x⟩ = /ks/ cluster → short vowel
        expect(phonemizeWord("dricka")).toBe("drˈɪ̀kːa"); // ck → kː geminate
        expect(phonemizeWord("tionde")).toBe("tˈìːɔndɛ"); // NOT the -tion suffix (word-initial stem tio-)
        expect(phonemizeWord("är")).toBe("æːr"); // ä-before-r lowering (not a hardcoded ɛːr)
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
        expect(phonemize("1000000", "sv")).toBe("ɛn mɪljˈuːn"); // en miljon (unstressed en → ɛn)
    });

    test("text: clause assembly + punctuation", () => {
        expect(phonemize("Jag talar svenska.", "sv")).toBe("jɑː tˈɑ̀ːlar svˈɛ̀nska .");
    });
});
