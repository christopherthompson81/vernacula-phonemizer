import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules, createNorwegian } from "../src/languages/norwegian/norwegian.ts";
import { normalizeNorwegian } from "../src/languages/norwegian/normalize.ts";

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
        expect(phonemizeWordRules("år")).toBe("ˈoːɾ"); // å LONG (open syllable) → oː — the other branch of the å split
        expect(phonemizeWordRules("fôr")).toBe("ˈfuːɾ"); // ô circumflex vowel → uː (loanword vowel letter)
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
        expect(nb.text("7").trim()).toBe("ˈʃʉː"); // sju (sj → ʃ) — routes through the lexicon as a number word
        expect(nb.text("100").trim()).toBe("ˈhʊndɾə"); // hundre
        expect(nb.text("1000").trim()).toBe("ˈtʉːsn"); // tusen (syllabic n)
    });

    // million/milliard are counted NOUNS and pluralise above one; hundre/tusen do not. The shared Western
    // composer stored one invariant string per magnitude and so read 2 000 000 as *to million.
    test("magnitude nouns agree with their count", () => {
        const nb = createNorwegian();
        expect(nb.text("1000000").trim()).toBe("ˈeːn mɪlɪˈuːn"); // en million — singular at exactly one
        expect(nb.text("2000000").trim()).toBe("ˈtuː mɪlɪˈuːnəɾ"); // to millioner
        expect(nb.text("1000000000").trim()).toBe("ˈeːn mɪlɪˈɑːɖ"); // en milliard
        expect(nb.text("3000000000").trim()).toBe("ˈtɾeː mɪlɪˈɑɖəɾ"); // tre milliarder
        // NOT the Slavic rule: a count ending in 1 is still plural in Norwegian (21 millioner).
        expect(nb.text("21000000").trim()).toBe("ˈtjʉːə ˈeːn mɪlɪˈuːnəɾ");
        // hundre and tusen take no paradigm, so a multiplier leaves them unchanged.
        expect(nb.text("2000").trim()).toBe("ˈtuː ˈtʉːsn");
    });

    test("text: words + clause punctuation", () => {
        expect(createNorwegian().text("Norsk er et språk.")).toBe("ˈnɔʂk ˈæːɾ ˈɛt ˈspɾoːk .");
    });
});

// #562 — the normalization layer. Every count below is measured over the FLEURS nb_no corpus (column 3),
// and every emitted word is in the NST lexicon at reference quality.
describe("norwegian normalization", () => {
    test("space-grouped thousands stay ONE numeral", () => {
        // Read as "fem null null" — a space is a token boundary, so one numeral arrived as three.
        expect(normalizeNorwegian("5 000 000")).toBe("5000000");
        expect(normalizeNorwegian("1 250")).toBe("1250");
    });

    test("the decimal comma becomes komma, fraction digit-by-digit", () => {
        expect(normalizeNorwegian("12,5")).toBe("12 komma 5");
        expect(normalizeNorwegian("1,25")).toBe("1 komma 2 5");
    });

    // 5 corpus instances are English-style THOUSANDS grouping that survived translation, all with exactly
    // three digits after the comma; reading them as decimals would say "tjuetre komma sju seks fire".
    test("English-style comma grouping is de-grouped, not read as a decimal", () => {
        expect(normalizeNorwegian("23,764")).toBe("23764");
        expect(normalizeNorwegian("291,773")).toBe("291773");
    });

    test("clock, percent, degrees and squared units", () => {
        expect(normalizeNorwegian("kl. 14:30")).toBe("klokka 14 30");
        expect(normalizeNorwegian("25 %")).toBe("25 prosent");
        expect(normalizeNorwegian("20 °C")).toBe("20 grader celsius");
        expect(normalizeNorwegian("23 km²")).toBe("23 kvadratkilometer");
    });

    test("ordinal dot — the largest defect, 134 instances", () => {
        expect(normalizeNorwegian("3. mai")).toBe("tredje mai");
        expect(normalizeNorwegian("15. århundre")).toBe("femtende århundre");
    });

    // The guard that separates an ordinal from a sentence ending in a year: Norwegian month names are
    // lowercase, so every date is caught while a sentence end (followed by a capital) is not.
    test("a sentence ending in a year keeps its full stop", () => {
        expect(normalizeNorwegian("I 1990. Han kom")).toBe("I 1990. Han kom");
    });

    // The period form is NOT a clock: of 24 corpus instances, the great majority are dates or technical
    // strings (802.11n) and exactly one is a time.
    test("a period between digits is left alone unless it is a full date", () => {
        expect(normalizeNorwegian("802.11n")).toBe("802.11n");
        expect(normalizeNorwegian("24.08.2021")).toBe("tjuefjerde august 2021");
    });

    test("ranges, minus and currency", () => {
        expect(normalizeNorwegian("1990-1995")).toBe("1990 til 1995");
        expect(normalizeNorwegian("-5 grader")).toBe("minus 5 grader");
        expect(normalizeNorwegian("¥2500")).toBe("2500 yen");
    });

    test("ordinary Norwegian text is untouched", () => {
        expect(normalizeNorwegian("Norsk er et språk.")).toBe("Norsk er et språk.");
    });
});
