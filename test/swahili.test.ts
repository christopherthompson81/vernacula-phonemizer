import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/swahili/swahili.ts";

// Canonical-IPA goldens for Swahili / Kiswahili (sw) — Bantu, highly phonemic Latin orthography, no tone, regular
// penultimate stress. Validated against wikipron swa (93.5%) + kaikki swa (97.8%), both human. The distinctive
// segments: IMPLOSIVE voiced stops (ɓ ɗ ʄ ɠ), PRENASALIZED stops (ᵐb ⁿd ⁿd͡ʒ ᵑɡ), ⟨ng'⟩→ŋ vs ⟨ng⟩→ᵑɡ, syllabic
// nasals (m̩ n̩), long vowels from ⟨aa⟩ etc., Cʷ labialization.
describe("swahili canonical IPA", () => {
    test("implosives, prenasalized stops, syllabic nasals", () => {
        const cases: [string, string][] = [
            ["baba", "ɓˈɑɓɑ"], // implosive b→ɓ
            ["dada", "ɗˈɑɗɑ"], // implosive d→ɗ
            ["jambo", "ʄˈɑᵐbɔ"], // implosive ʄ + prenasal ᵐb
            ["ngoma", "ᵑɡˈɔmɑ"], // prenasal ᵑɡ
            ["simba", "sˈiᵐbɑ"],
            ["ndege", "ⁿdˈɛɠɛ"], // prenasal ⁿd + implosive ɠ
            ["njia", "ⁿd͡ʒˈiɑ"], // prenasal ⁿd͡ʒ
            ["mtu", "ˈm̩tu"], // syllabic m̩ (nasal before a non-homorganic consonant)
            ["nchi", "ˈn̩t͡ʃi"], // syllabic n̩
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("ng' (velar nasal) vs ng (prenasalized), long vowels, labialization", () => {
        expect(phonemizeWord("ng'ombe")).toBe("ŋˈɔᵐbɛ"); // ⟨ng'⟩ → ŋ
        expect(phonemizeWord("ngoma")).toBe("ᵑɡˈɔmɑ"); // ⟨ng⟩ → ᵑɡ
        expect(phonemizeWord("kuu")).toBe("kˈuː"); // ⟨uu⟩ → long uː
        expect(phonemizeWord("mwezi")).toBe("mʷˈɛzi"); // ⟨mw⟩ → labialized mʷ
        expect(phonemizeWord("kweli")).toBe("kʷˈɛli"); // ⟨kw⟩ → kʷ
        expect(phonemizeWord("chakula")).toBe("t͡ʃɑkˈulɑ"); // ⟨ch⟩ → t͡ʃ
        expect(phonemizeWord("habari")).toBe("hɑɓˈɑɾi"); // ⟨r⟩ → tap ɾ
    });

    test("numbers (standard, joined by na)", () => {
        expect(phonemize("11", "sw")).toBe("kˈumi nˈɑ mˈɔʄɑ"); // kumi na moja
        expect(phonemize("21", "sw")).toBe("iʃiɾˈini nˈɑ mˈɔʄɑ"); // ishirini na moja
        expect(phonemize("100", "sw")).toBe("mˈiɑ mˈɔʄɑ"); // mia moja
        expect(phonemize("1000", "sw")).toBe("ˈɛlfu mˈɔʄɑ"); // elfu moja
    });

    test("running text: penultimate stress", () => {
        expect(phonemize("Watoto wanacheza.", "sw")).toContain(
            "wɑtˈɔtɔ wɑnɑt͡ʃˈɛzɑ",
        );
    });
});

// #562 TEXT NORMALIZATION (src/languages/swahili/normalize.ts). Every case below is a form attested in the
// sw_ke FLEURS corpus; the "before" in each comment is what the engine actually produced prior to the pass.
describe("swahili text normalization", () => {
    test("grouped thousands: the comma was a clause pause and the tail a second number", () => {
        // "1,000" → *moja , sifuri* (the tail "000" read as zero). ×44 in the corpus.
        expect(phonemize("1,000", "sw")).toBe("ˈɛlfu mˈɔʄɑ");
        expect(phonemize("104,500", "sw")).toBe(
            "ˈɛlfu mˈiɑ mˈɔʄɑ nˈɑ ˈn̩nɛ nˈɑ mˈiɑ tˈɑnɔ",
        );
        // Only exact 3-digit blocks group, so an enumeration comma is never swallowed.
        expect(phonemize("mnamo 2010, 500 watu", "sw")).toContain(",");
    });

    test("decimals take nukta and read the fraction digit by digit", () => {
        // "1.5" → *moja . tano*, a SENTENCE BREAK mid-number; "6.34" also mis-read the fraction as 34.
        expect(phonemize("1.5", "sw")).toBe("mˈɔʄɑ nˈuktɑ tˈɑnɔ");
        expect(phonemize("6.34", "sw")).toBe("sˈitɑ nˈuktɑ tˈɑtu ˈn̩nɛ");
        // A trailing letter means an alphanumeric designation, not a decimal — the corpus's 802.11a/b/g/n.
        expect(phonemize("802.11n", "sw")).not.toContain("nˈuktɑ");
    });

    test("percent uses the shared prefix tier (asilimia 80, the corpus's own order)", () => {
        // "80%" DROPPED the sign entirely.
        expect(phonemize("80%", "sw")).toBe("ɑsilimˈiɑ θɛmɑnˈini");
    });

    test("ascending ranges take hadi; scores keep the bare juxtaposition", () => {
        // "kilomita 2-3" ran the two numbers together with no connective at all.
        expect(phonemize("kilomita 2-3", "sw")).toBe("kilɔmˈitɑ ᵐbˈili hˈɑɗi tˈɑtu");
        expect(phonemize("1469-1539", "sw")).toContain("hˈɑɗi");
        // A descending pair is an ice-hockey/tennis score ("ushindi wa 5-3"), which reads "kwa", not "hadi".
        expect(phonemize("ushindi wa 5-3", "sw")).not.toContain("hˈɑɗi");
    });

    test("degrees: ºC leaked the raw character and read C as the letter", () => {
        // "+30ºC" → *thelathini º k*, with U+00BA emitted RAW into the phoneme stream.
        // #586. The plus is now read (plas). The degree rule below used to capture `([+-]?)` and DISCARD it,
        // so the sign vanished — the same shape zu's `[+]?` had. ⚠ sw's two temperature speakers say the DEGREE
        // word in that slot (`z aɪ i d i a  ɲ u z i  t a l a t i n i`), not a plus; the offset speaker says
        // `p l a s w a n`. Voiced here per the standing choice on explicitly typed characters.
        expect(phonemize("+30ºC", "sw")).toBe("plˈɑs ɲˈuzi ʄˈɔtɔ θɛlɑθˈini sɛlsiˈɑsi");
        expect(phonemize("30°C", "sw")).toBe("ɲˈuzi ʄˈɔtɔ θɛlɑθˈini sɛlsiˈɑsi");
    });

    test("era markers and dotted abbreviations keep the sentence period", () => {
        // The regression this test exists for: a first version's trailing `\.?` ATE the sentence period of
        // "…1100 A.D." and "…10,000 BCE.", deleting three sentence-final pauses.
        expect(phonemize("ilidumu hadi karibu 1100 A.D.", "sw")).toMatch(/ɓˈɑːɗɑ jˈɑ kɾˈistɔ \.$/u);
        expect(phonemize("mwaka wa 10,000 BCE.", "sw")).toMatch(/kˈɑɓlɑ jˈɑ kɾˈistɔ \.$/u);
        // Mid-sentence the abbreviation dot is CONSUMED so it cannot become a phrase break.
        expect(phonemize("takribani 400 A.D. na ilidumu", "sw")).not.toContain(" . ");
        expect(phonemize("picha n.k., kwa sehemu", "sw")).toContain("nˈɑ kɑðɑlˈikɑ");
        // Bare "BC" is claimed only after a number — two capitals are otherwise an ordinary initialism.
        expect(phonemize("Nilikwenda BC. Kisha", "sw")).not.toContain("kˈɑɓlɑ");
    });

    test("Latin diacritics fold to the base letter instead of being read as English", () => {
        // Swahili's tokenizer is ASCII, so `á` fell through to the foreign-run handler and came out as the
        // ENGLISH letter name: "Sámi" → [s ˈə mˈi], "Gürses" → [ɠ jˈuː ɾsˈɛs].
        expect(phonemize("Sámi", "sw")).toBe(phonemize("Sami", "sw"));
        expect(phonemize("Gürses", "sw")).toBe(phonemize("Gurses", "sw"));
    });

    test("a spaced dash is a parenthetical break, not silence", () => {
        // 22 clause boundaries carried no pause at all, because the dash was simply dropped.
        expect(phonemize("nchi thabiti - si hata Armenia", "sw")).toContain(",");
        // …but a dash BETWEEN digits belongs to the range rule, and a score must not gain a pause.
        expect(phonemize("kwa 26 - 00 kwa urahisi", "sw")).not.toContain(",");
    });

    test("noun-class agreement is deliberately NOT attempted", () => {
        // The measured result: every counted noun that meets an agreeing numeral (1,2,3,4,5,8) in the
        // corpus is a class 9/10 N-class loanword, whose agreeing form IS the citation form. The single
        // exception in 1,938 utterances is "masaa 2" (class 6, wants *mawili*), recorded rather than
        // guessed at — a general rule would need a noun→class lexicon for the whole language.
        expect(phonemize("asilimia 2", "sw")).toBe("ɑsilimˈiɑ ᵐbˈili"); // N-class: correct
        expect(phonemize("masaa 2", "sw")).toBe("mˈɑsɑː ᵐbˈili"); // class 6: known miss (*mawili*)
    });
});
