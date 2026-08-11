import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sundanese/sundanese.ts";
import { getPhonemizer } from "../src/registry.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Sundanese / Basa Sunda (su) — Austronesian (West Java), modern Latin orthography.
// Shallow, near-phonemic (the id/jv pattern), so a flat scan. Signature: the SEVEN-vowel system with the central
// vowel ⟨eu⟩→[ɨ] alongside ⟨e⟩→[ə] (schwa) and ⟨é⟩→[e]; c→[t͡ʃ], j→[d͡ʒ], ng→[ŋ], ny→[ɲ]; glottal at a
// word-initial vowel and same-vowel hiatus. Referee: kaikki su (465) — the only one.
describe("Sundanese canonical IPA", () => {
    test("the seven-vowel system: ⟨eu⟩→ɨ, ⟨e⟩→ə, ⟨é⟩→e", () => {
        expect(phonemizeWord("ieu")).toBe("ʔˈiɨ"); // ⟨eu⟩ → ɨ (+ word-initial glottal)
        expect(phonemizeWord("seukeut")).toBe("sˈɨkɨt"); // ⟨eu⟩ → ɨ twice
        expect(phonemizeWord("kecap")).toBe("kət͡ʃˈap"); // ⟨e⟩ → ə (schwa), c → t͡ʃ; stress shifts off the schwa penult
        expect(phonemizeWord("ngéwé")).toBe("ŋˈewe"); // ng → ŋ, ⟨é⟩ → e (é is not a schwa, so penult stress)
    });

    test("consonants + glottal in same-vowel hiatus", () => {
        expect(phonemizeWord("kuring")).toBe("kˈuriŋ"); // 'I/me' — ng → ŋ
        expect(phonemizeWord("naam")).toBe("nˈaʔam"); // aa hiatus → aʔa
        expect(phonemizeWord("basa")).toBe("bˈasa"); // 'language'
    });

    test("numbers compose (Austronesian decimal)", () => {
        expect(getPhonemizer("su").text("11").trim()).toBe("sabəlˈas"); // sabelas (only 11 takes the sa- prefix)
        expect(getPhonemizer("su").text("12").trim()).toBe("dˈua bəlˈas"); // dua belas
        expect(getPhonemizer("su").text("25").trim()).toBe("dˈua pˈuluh lˈima"); // dua puluh lima
        expect(getPhonemizer("su").text("100").trim()).toBe("sarˈatus"); // saratus
    });

    test("Aksara Sunda (ᮃᮊ᮪ᮞᮛ) front-end — abugida transliterated to Latin, IDENTICAL IPA", () => {
        expect(phonemizeWord("ᮃᮊ᮪ᮞᮛ")).toBe("ʔaksˈara"); // "aksara" — indep A + KA + pamaéh (virama) + SA + RA
        expect(phonemizeWord("ᮃᮊ᮪ᮞᮛ")).toBe(phonemizeWord("aksara")); // Aksara ≡ Latin
        expect(phonemizeWord("ᮊᮨ")).toBe("kə"); // KA + pamepet → ⟨e⟩ [ə] (the pepet)
        expect(phonemizeWord("ᮊᮦ")).toBe("ke"); // KA + panaélaéng → ⟨é⟩ [e]
        expect(phonemizeWord("ᮊᮩ")).toBe("kɨ"); // KA + paneuleung → ⟨eu⟩ [ɨ]
        expect(phonemizeWord("ᮊᮀ")).toBe("kaŋ"); // KA + panyecek → final -ng
        expect(phonemizeWord("ᮝᮤᮜᮥᮏᮨᮀ")).toBe("wilˈud͡ʒəŋ"); // "wilujeng" (welcome)
        expect(getPhonemizer("su").text("᮱᮱").trim()).toBe("sabəlˈas"); // "11" in Aksara Sunda digits → sabelas
    });

    // ── NORMALIZATION ────────────────────────────────────────────────────────────────────────────────
    // ⚠ EVERY COUNT BELOW IS FROM THE LANGUAGE-FILTERED CORPUS. su.wikipedia is 12.9% English by paragraph
    // and `mine.ts` selects adversarially, so the raw artifact's hard-set had `ranges` 8/8 English and
    // `ordinal-latin` at 27.2% Sundanese — the cells a normalizer is written from. See
    // tools/normalization/filter-by-language.py and the header of src/languages/sundanese/normalize.ts.
    describe("text normalization", () => {
        // THE SEPARATOR PAIR, which is what this layer is built around: Sundanese writes BOTH conventions and
        // only the DIGIT COUNT separates them — three digits after a separator is a grouping, one or two is a
        // decimal. Before this layer both became a CLAUSE PAUSE and the value was destroyed.
        test("thousands vs decimal, in both conventions and mixed", () => {
            expect(phonemize("3.000 taun", "su")).toBe("tˈilu rəbˈu tˈaun"); // ×3,366 — was *tilu . enol*
            expect(phonemize("3,000 pulo", "su")).toBe("tˈilu rəbˈu pˈulo"); // ×487, English convention
            expect(phonemize("1,69%", "su")).toContain("hˈid͡ʒi kˈoma"); // ×3,410 decimal comma
            expect(phonemize("0.01%", "su")).toContain("ʔənˈol kˈoma"); // ×16,150 decimal period
            expect(phonemize("5 000", "su")).toBe("lˈima rəbˈu"); // ×24 space-grouped
            // ⚠ MIXED IN ONE NUMBER, and the guard that makes it work is `(?!\d)` rather than `(?![\d.,])`:
            // excluding a FOLLOWING separator rejects exactly the group that is followed by a decimal one.
            expect(phonemize("764.387,59 ha", "su")).toContain("rəbˈu"); // euro shape ×175
            expect(phonemize("764,387.59 ha", "su")).toContain("rəbˈu"); // english shape ×24
            // ⚠ AND THE PAIR THAT MUST NOT FUSE — a four-digit year can never head a group.
            expect(phonemize("taun 1990 2000", "su")).toContain("sarəbˈu salˈapan rˈatus salˈapan pˈuluh");
        });

        test("clock, era markers and ranges", () => {
            expect(phonemize("jam 05.00", "su")).toBe("d͡ʒam lˈima"); // ×108 of 186 are on the hour
            expect(phonemize("tabuh 11:10", "su")).toContain("lˈiwat"); // `liwat` — attested ×1 in this frame
            expect(phonemize("100 SM", "su")).toBe("sarˈatus samˈemeh masˈehi"); // ×868
            expect(phonemize("170-an SM", "su")).toContain("samˈemeh masˈehi"); // ×124 carry the -an suffix
            expect(phonemize("434 M", "su")).toContain("masˈehi"); // ×417 — SM must be tried first
            expect(phonemize("1350-1357", "su")).toContain("nəpˈi ka"); // ×4,055
            // ⚠ BOTH RANGE GUARDS, and the corpus diff is what found them (playbook trap 3).
            expect(phonemize("nepi ka 8–20 méter", "su")).not.toContain("nəpˈi ka dalˈapan nəpˈi ka");
            expect(phonemize("Nomer CAS 50-21-5", "su")).not.toContain("nəpˈi ka"); // ×68 identifier chains
        });

        test("units, currency, degrees and the signs", () => {
            expect(phonemize("300 km", "su")).toContain("kilomˈetər");
            expect(phonemize("100 km²", "su")).toContain("kilomˈetər pasˈaɡi");
            expect(phonemize("jiwa/km²", "su")).toContain("pər kilomˈetər pasˈaɡi"); // ×27, word numerator
            expect(phonemize("$120 juta", "su")).toBe("sarˈatus dˈua pˈuluh d͡ʒˈuta dˈolar"); // magnitude hops
            expect(phonemize("Rp 13,1", "su")).toBe("tˈilu bəlˈas kˈoma hˈid͡ʒi rupˈiah"); // tier BEFORE decimals
            expect(phonemize("£26 juta", "su")).toContain("poundstˈerliŋ"); // ×39, glossed by the corpus itself
            expect(phonemize("40,9 °C", "su")).toContain("darˈad͡ʒat"); // ° was dropped; C read as [t͡ʃ]
            expect(phonemize("A & B", "su")).toContain("d͡ʒɨŋ"); // ×463
            expect(phonemize("1/2", "su")).toBe("satəŋˈah");
            expect(phonemize("3/4", "su")).toBe("tˈilu pər ʔˈopat");
            // ⚠ PLUS BEFORE MINUS: run the other way, `5 + (−3)` loses the `+` and becomes a subtraction.
            expect(phonemize("5 + (−3) = 2", "su")).toContain("tˈambah kˈuraŋ");
        });

        // ⚠ THE `$` THAT IS NOT MONEY. A shared pre-pass (core/unicode.ts) folds caret exponents to real
        // superscripts BEFORE this layer runs, so `$10^{12}$` arrives as `$10¹²$` — a rule keyed on `^` or `{`
        // can never fire, and testing normalizeSundanese() directly would not show it because that call
        // bypasses the shared passes entirely.
        test("LaTeX math delimiters are not currency", () => {
            expect(phonemize("$10^{12}$", "su")).not.toContain("dˈolar");
            expect(phonemize("$120", "su")).toContain("dˈolar"); // real money still reads
        });
    });
});
