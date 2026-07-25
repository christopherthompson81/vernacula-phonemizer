import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules, createNorwegian } from "../src/languages/norwegian/norwegian.ts";

// Norwegian Bokmål (nb) — North Germanic, Latin, Urban East Norwegian. TWO tiers: an NST pronunciation lexicon
// (nb-lexicon.tsv, National-Library CC0, ~38k common forms → 98% of real-text tokens, with correct LEXICAL stress)
// → a rule g2p fallback (phonemizeWordRules: complementary vowel length picks quality, front-vowel softening,
// retroflexes, silent-d, unstressed ⟨e⟩→ə). Shipped path (lexicon→rules) = 90.4% frequency-weighted vs kaikki
// (non-circular, NST≠Wiktionary); rules-only floor 63.4%. See docs/investigations/nb_native_bringup_investigation.md.
describe("Norwegian Bokmål canonical IPA", () => {
    test("rule engine — vowel quality via complementary length: ⟨o⟩→uː, ⟨u⟩→ʉː, ⟨å⟩→oː", () => {
        expect(phonemizeWordRules("bok")).toBe("ˈbuːk"); // o → uː (long, open)
        expect(phonemizeWordRules("hus")).toBe("ˈhʉːs"); // u → ʉː
        expect(phonemizeWordRules("norsk")).toBe("ˈnɔʂk"); // short o → ɔ, rs → retroflex ʂ
        expect(phonemizeWordRules("hånd")).toBe("ˈhɔn"); // å short (nd closes), final d silent
    });

    test("rule engine — digraphs/softening: sj/skj→ʃ, kj/tj→ç, gj/hj→j, hv→ʋ, sk before front", () => {
        expect(phonemizeWordRules("sjø")).toBe("ˈʃøː"); // sj → ʃ
        expect(phonemizeWordRules("kjøre")).toBe("ˈçøːɾə"); // kj → ç, unstressed e → ə
        expect(phonemizeWordRules("gjøre")).toBe("ˈjøːɾə"); // gj → j (word-initial)
        expect(phonemizeWordRules("hva")).toBe("ˈʋɑː"); // hv → ʋ
        expect(phonemizeWordRules("ski")).toBe("ˈʃiː"); // sk before front i → ʃ
    });

    test("rule engine — retroflex, silent-d, unstressed schwa, é always-long", () => {
        expect(phonemizeWordRules("barn")).toBe("ˈbɑːɳ"); // rn → retroflex ɳ
        expect(phonemizeWordRules("god")).toBe("ˈɡuː"); // final d silent
        expect(phonemizeWordRules("jord")).toBe("ˈjuːɾ"); // rd → r (d silent), o long
        expect(phonemizeWordRules("Bergen")).toBe("ˈbæɾɡən"); // e→æ before r; unstressed e → ə
        expect(phonemizeWordRules("idé")).toBe("ˈiːdeː"); // é always-long (rule form; the lexicon has the true stress)
    });

    test("lexicon tier — NST pronunciations with correct lexical stress (phonemizeWord)", () => {
        expect(phonemizeWord("absorbere")).toBe("ɑbsɔɾˈbeːɾə"); // stress on -béː- (the rule engine guesses 1st syllable)
        expect(phonemizeWord("stasjon")).toBe("stɑˈʃuːn"); // stress on -sjón
        expect(phonemizeWord("er")).toBe("ˈæːɾ"); // the common verb reading (not the letter-name variant)
    });

    test("cardinal numbers (via the lexicon)", () => {
        const nb = createNorwegian();
        expect(nb.text("0").trim()).toBe("ˈnʊl"); // null
        expect(nb.text("100").trim()).toBe("ˈhʊndɾə"); // hundre
        expect(nb.text("1000").trim()).toBe("ˈtʉːsn"); // tusen (syllabic n)
    });

    test("text: words + clause punctuation", () => {
        expect(createNorwegian().text("Norsk er et språk.")).toBe("ˈnɔʂk ˈæːɾ ˈɛt ˈspɾoːk  . ");
    });
});
