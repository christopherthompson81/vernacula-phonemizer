import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sesotho/sesotho.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/sesotho/numbers.ts";
import { normalizeSesotho } from "../src/languages/sesotho/normalize.ts";

// Canonical-IPA goldens for Sesotho / Southern Sotho (st) — Bantu (Sotho-Tswana), Latin. Authored beyond any usable
// machine referee (kaikki "Sotho" = 3 IPA entries; no wikipron/epitran) from standard Sesotho phonology (Doke &
// Mofokeng); single-source. The consonant analysis is ANCHORED by the one clean kaikki attestation
// phuputso→pʰupʼut͡sʼɔ (an EXACT match): EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ], ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨h⟩→[ɦ].
// Vowel height is unwritten → mid defaults [ɛ ɔ] (the [ʊ]/[i] raisings are a residual). Tone deferred.
describe("Sesotho canonical IPA — Sotho-Tswana rule g2p", () => {
    test("the kaikki anchor: phuputso → pʰupʼut͡sʼɔ (EXACT) — ejective + aspirate + affricate", () => {
        expect(phonemizeWord("phuputso")).toBe("pʰupʼut͡sʼɔ"); // ph→pʰ, p→pʼ (ejective), ts→t͡sʼ (ejective)
    });
    test("signatures: ⟨hl⟩→ɬ, ⟨h⟩→ɦ, ⟨kg⟩→kχ, ejective ⟨t⟩→tʼ", () => {
        expect(phonemizeWord("lehlohonolo")).toBe("lɛɬɔɦɔnɔlɔ"); // hl→ɬ (voiceless lateral fricative), h→ɦ
        expect(phonemizeWord("kgotso")).toBe("kχɔt͡sʼɔ"); // kg→kχ
        expect(phonemizeWord("ntate")).toBe("ntʼɑtʼɛ"); // ⟨t⟩→tʼ (ejective), ⟨a⟩→ɑ
    });
});

// CARDINAL NUMBERS (st). The compositor emits the CITATION / COUNTING stems for a bare 1–9 (what a Mosotho says
// counting aloud) and Sesotho's own noun-free motso/metso "unit, digit" construction inside compounds — a TTS
// reading a bare integer has no noun for the adjectival 1–5 to agree with. Sources are cited in sesotho.jsonc
// "numbers": Omniglot "Numbers in Southern Sotho" + the Wits Sesotho counting tutorial material.
describe("Sesotho cardinal numbers — citation stems + the motso/metso compound", () => {
    test("units are the bare counting stems", () => {
        expect(numberToWords(0)).toBe("lefeela");
        expect(numberToWords(7)).toBe("supa");
        expect(numberToWords(9)).toBe("robong"); // a RELATIVE verb form — takes no class prefix
    });
    test("teens + 21–99 use the motso/metso dummy noun (attested forms)", () => {
        expect(numberToWords(11)).toBe("leshome le motso o le mong");
        expect(numberToWords(12)).toBe("leshome le metso e mmedi");
        expect(numberToWords(21)).toBe("mashome a mabedi le motso o le mong");
        expect(numberToWords(42)).toBe("mashome a mane le metso e mmedi"); // cl.6 after mashome, cl.4 after metso
    });
    test("hundreds are multiplicative with cl.6 concord", () => {
        expect(numberToWords(100)).toBe("lekgolo");
        expect(numberToWords(300)).toBe("makgolo a mararo");
        expect(numberToWords(555)).toBe("makgolo a mahlano le mashome a mahlano le metso e mehlano");
    });
    test("thousands (cl.7/8) and millions", () => {
        expect(numberToWords(1000)).toBe("sekete");
        expect(numberToWords(2000)).toBe("dikete tse pedi"); // cl.8 "tse" concord
        expect(numberToWords(1000000)).toBe("milione");
        expect(numberToWords(1000000000)).toBe("bilione");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "st").trim()).toBe("mɑʃɔmɛ ɑ mɑbɛdi lɛ mɔt͡sʼɔ ɔ lɛ mɔŋ");
        expect(phonemize("1000", "st").trim()).toBe("sɛkʼɛtʼɛ");
    });
});

// ── TEXT NORMALIZATION (src/languages/sesotho/normalize.ts) ────────────────────────────────────────────
//
// Asserted on the NORMALIZER's text output wherever the point is the word chosen, and through `phonemize`
// wherever the point is that the reading actually reaches the g2p. Every word below is attested on
// st.wikipedia in SOUTH AFRICAN orthography — see the file header and
// docs/investigations/st_normalization_investigation.md for the counts and the sense-checked examples.
//
// ⚠ THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES (trap 13): the unit path has a plain arm, a rate
// arm and an exponent arm, and the corpus only exercises the first and the third.
describe("Sesotho text normalization", () => {
    test("percent and currency: the measure noun heads its phrase, with the cl.8/10 concord tse", () => {
        expect(normalizeSesotho("50%")).toBe("diperesente tse 50");
        expect(normalizeSesotho("$675")).toBe("didolara tse 675");
        expect(normalizeSesotho("R470 bilione")).toBe("diranta tse bilione tse 470");
        expect(normalizeSesotho("£15,500")).toBe("diponto tse 15500"); // and the grouping comma is spent
        expect(normalizeSesotho("US$100 milione")).toBe("didolara tsa Amerika tse milione tse 100");
    });

    test("the percent word is not said twice — either spelling, either orthography (trap 12)", () => {
        // The tier's own guard, on the declared SA spelling.
        expect(normalizeSesotho("diperesente tse 1.5%")).toBe("diperesente tse 1 5");
        // Step 6, on the spellings the tier cannot know about: the Lesotho `liporesente` is the artifact's
        // own sentence, and without this it read *liporesente tse diperesente tse 25*.
        expect(normalizeSesotho("liporesente tse 25%")).toBe("liporesente tse 25");
        expect(normalizeSesotho("diphesente tse 35")).toBe("diphesente tse 35");
    });

    test("units: km, m and kg — and ⟨kg⟩ was reading as ONE SESOTHO GRAPHEME (trap 56)", () => {
        expect(normalizeSesotho("12 km")).toBe("dikhilomithara tse 12");
        expect(normalizeSesotho("1,395 m")).toBe("dimithara tse 1395");
        expect(normalizeSesotho("50 kg")).toBe("dikhilograma tse 50");
        // Before this layer `50 kg` read as *mɑʃɔmɛ ɑ mɑɬɑnɔ kχ* — ⟨kg⟩ is the velar affricate, so the
        // kilogram was one phoneme. No leak class can see that; only the reading can.
        expect(phonemize("50 kg", "st").trim()).toBe("dikʰilɔxrɑmɑ t͡sʼɛ mɑʃɔmɛ ɑ mɑɬɑnɔ");
    });

    test("the exponent branch — and the ASCII form, which was read as the NUMBER two (trap 53)", () => {
        expect(normalizeSesotho("603 628 km²")).toBe("disekwere dikhilomithara tse 603628");
        expect(normalizeSesotho("632,702 km2")).toBe("disekwere dikhilomithara tse 632702");
        expect(normalizeSesotho("37,99 km²")).toBe("disekwere dikhilomithara tse 37 9 9");
    });

    test("the rate branch, which the corpus writes only as km/h", () => {
        // `ka` is "per" (attested digit-adjacent and glossed: *li-kilos tse fetang 2 000 ka hektare*);
        // the phrase `ka hora` is NOT used — its 11 wiki hits are all clock times.
        expect(normalizeSesotho("0-100 km/h")).toBe("0 ho isa ho dikhilomithara tse 100 ka hora");
    });

    test("ranges take `ho isa ho`, ascending only — a season declines itself", () => {
        expect(normalizeSesotho("10-20")).toBe("10 ho isa ho 20");
        expect(normalizeSesotho("2016-17")).toBe("2016-17"); // non-ascending: a season, not a span
        expect(normalizeSesotho("COVID-19")).toBe("COVID-19"); // letter-flanked: a designation
    });

    test("a currency-glued magnitude letter is spent BEFORE the metre key can claim it", () => {
        // The artifact glosses the abbreviation itself: `R2.3m(di-milione tse pedi feelwane tharo)`.
        // Without step 5 this reads *diranta tse 2.3 dimithara tse* — a wrong unit, not a silence.
        expect(normalizeSesotho("R2.3m")).toBe("diranta tse dimilione tse 2 3");
        expect(normalizeSesotho("$2.5bn")).toBe("didolara tse dibilione tse 2 5");
    });

    test("grouping separators, the dotted date, and the decimal — all three were CLAUSE BREAKS", () => {
        expect(normalizeSesotho("1,500")).toBe("1500");
        expect(normalizeSesotho("603 628")).toBe("603628");
        expect(normalizeSesotho("30.01.1912")).toBe("30 01 1912"); // was three sentence breaks
        expect(normalizeSesotho("32.9")).toBe("32 9"); // the fraction digit-by-digit; no separator word
        // ⚠ THE DATE AND THE DECIMAL MUST STAY INDEPENDENT — the corpus diff caught this one: with a
        // plainer trailing guard the decimal arm claimed `28.11` out of `28.11.1820`.
        expect(normalizeSesotho("*28.11.1820")).toBe("*28 11 1820");
    });

    test("the ampersand is `le`, and the entity table is consulted first", () => {
        expect(normalizeSesotho("Arts & Sciences")).toBe("Arts le Sciences");
        expect(normalizeSesotho("African Union&nbsp;(AU)")).toBe("African Union (AU)");
        // ⚠ `&#39;` IS ORTHOGRAPHIC in Sesotho — the syllabic nasal — so it is restored, not dropped.
        expect(normalizeSesotho("Ntat&#39;a Rōna")).toBe("Ntat’a Rōna");
    });

    test("dotted capital runs lose their interior sentence breaks", () => {
        // ⚠ THE FINAL DOT GOES, and it costs one pause: `B.C. Li` is a real sentence end. The other two
        // capital-dot runs followed by a capital in the artifact are `J.G. Fraser` and `U.D. Oliveirense`,
        // where a pause would be spurious — 1 against 2. See the step-3 comment.
        expect(normalizeSesotho("ka 4000 B.C. Li ne li entsoe")).toBe("ka 4000 BC Li ne li entsoe");
        expect(normalizeSesotho("thomo ea May 2011 U.S. ea ho bolaea")).toBe("thomo ea May 2011 US ea ho bolaea");
    });

    test("the English ordinal suffix is stripped; Sesotho writes its own ordinals as words", () => {
        expect(normalizeSesotho("60th")).toBe("60");
        expect(normalizeSesotho("1st")).toBe("1");
    });

    // ── THE MEASURED REFUSALS. Each of these is a rule this layer deliberately does NOT have, pinned so
    // that a later change has to argue with the measurement rather than with a silence.
    test("no hectare: all six digit-adjacent `ha` in the artifact are the Sesotho WORD (trap 9)", () => {
        expect(normalizeSesotho("64 ha ba na mosebetsi")).toBe("64 ha ba na mosebetsi");
    });
    test("no clock: every N:NN in the artifact is a verse, a race time or a date", () => {
        expect(normalizeSesotho("1:10 Le Molimo")).toBe("1:10 Le Molimo"); // Genesis 1:10
        expect(normalizeSesotho("ka nako ya 1:56.72")).toBe("ka nako ya 1:56.72"); // a race time
    });
    test("no `=` rule: all eight arithmetic instances are EasyTimeline chart directives", () => {
        expect(normalizeSesotho("ScaleMajor = unit:year increment:11000")).toBe(
            "ScaleMajor = unit:year increment:11000",
        );
    });
    test("no degree or scale word — nothing is sourceable, so the sign stays VISIBLE to the gate", () => {
        expect(normalizeSesotho("32.9°C")).toBe("32 9°C");
    });
    test("no cm/mm/l and no €: every candidate spelling is 0 tokens / 0 articles on st.wikipedia", () => {
        expect(normalizeSesotho("12 cm")).toBe("12 cm");
        expect(normalizeSesotho("€ 959")).toBe("€ 959");
    });
});
