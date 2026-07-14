import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/swedish/swedish.ts";

// Canonical-IPA goldens for Central Standard Swedish (rikssvenska), espeak-independent. Phase 1 is SEGMENTAL:
// rule g2p (g2p.ts) + first-syllable stress (native default). Pitch accent (accent 1/2) is deferred to Phase 2
// (lexical). Conventions: sje-sound ɧ, tje-sound ɕ, g→j before front vowels, retroflex assimilation
// rt/rd/rn/rs/rl → ʈ/ɖ/ɳ/ʂ/ɭ, geminate consonant → Cː + short vowel, complementary length on the stressed
// syllable (o long defaults to uː). Stress mark precedes the stressed nucleus; monosyllables carry none.
describe("swedish canonical IPA", () => {
    test("sje-sound ɧ (sj/skj/stj/sch, sk+front)", () => {
        expect(phonemizeWord("sjö")).toBe("ɧøː");
        expect(phonemizeWord("skjorta")).toBe("ɧˈuːʈa"); // skj → ɧ, rt → ʈ
        expect(phonemizeWord("stjärna")).toBe("ɧˈæːɳa"); // stj → ɧ, ä-before-r → æː, rn → ɳ
        expect(phonemizeWord("själ")).toBe("ɧɛːl");
        expect(phonemizeWord("skön")).toBe("ɧøːn"); // sk + front ö → ɧ
    });

    test("tje-sound ɕ (tj/kj, k+front) + g→j before front", () => {
        expect(phonemizeWord("kött")).toBe("ɕœtː"); // k+ö → ɕ, tt → tː, short ö
        expect(phonemizeWord("kyrka")).toBe("ɕˈʏrka");
        expect(phonemizeWord("känna")).toBe("ɕˈɛnːa");
        expect(phonemizeWord("göra")).toBe("jˈœːra"); // g+ö → j, ö-before-r → œː
        expect(phonemizeWord("get")).toBe("jeːt");
        expect(phonemizeWord("gärna")).toBe("jˈæːɳa");
    });

    test("root keeps hard k/g before a front-vowel inflection (softening is a stressed-onset rule)", () => {
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // bok+en → k stays hard
        expect(phonemizeWord("dragen")).toBe("drˈɑːɡɛn"); // drag+en → g stays hard
    });

    test("silent word-initial digraphs hj/lj/dj/gj → j (medial = C + j)", () => {
        expect(phonemizeWord("hjul")).toBe("jʉːl");
        expect(phonemizeWord("ljus")).toBe("jʉːs");
        expect(phonemizeWord("djur")).toBe("jʉːr");
        expect(phonemizeWord("miljon")).toBe("mˈɪljɔn"); // medial lj → l + j (not silent)
        expect(phonemizeWord("familj")).toBe("fˈɑːmɪlj");
    });

    test("retroflex assimilation + final -rg soften", () => {
        expect(phonemizeWord("barn")).toBe("bɑːɳ"); // rn → ɳ
        expect(phonemizeWord("berg")).toBe("bɛrj"); // r + g → r j
    });

    test("complementary length: long-V+short-C vs short-V+geminate-C", () => {
        expect(phonemizeWord("bok")).toBe("buːk"); // open syllable → long o = uː
        expect(phonemizeWord("fisk")).toBe("fɪsk"); // coda cluster → short i
        expect(phonemizeWord("egg")).toBe("ɛɡː"); // geminate gg → ɡː
        expect(phonemizeWord("ligga")).toBe("lˈɪɡːa");
        expect(phonemizeWord("flicka")).toBe("flˈɪka"); // ck → k
    });

    test("irregular function words + stress mark on polysyllables only", () => {
        expect(phonemizeWord("jag")).toBe("jɑː"); // silent g
        expect(phonemizeWord("och")).toBe("ɔ");
        expect(phonemizeWord("svenska")).toBe("svˈɛnska");
        expect(phonemizeWord("tala")).toBe("tˈɑːla");
    });

    test("numbers (tens-first compounds; split at thousand/million)", () => {
        expect(phonemize("2", "sv")).toBe("tvoː"); // två
        expect(phonemize("7", "sv")).toBe("ɧʉː"); // sju
        expect(phonemize("21", "sv")).toBe("ɕˈʉːɡɔɛtː"); // tjugoett
        expect(phonemize("100", "sv")).toBe("ˈɛtːhɵndra"); // etthundra
        expect(phonemize("1000", "sv")).toBe("ˈɛtːɵsɛn"); // ettusen
        expect(phonemize("1000000", "sv")).toBe("eːn mˈɪljɔn"); // en miljon
    });

    test("text: clause assembly + punctuation", () => {
        expect(phonemize("Jag talar svenska.", "sv")).toBe("jɑː tˈɑːlar svˈɛnska .");
    });
});
