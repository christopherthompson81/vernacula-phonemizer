import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/indonesian/indonesian.ts";

// Canonical-IPA goldens for Indonesian (id) — shallow near-phonemic Latin orthography, rule-based G2P.
// Digraphs ng→ŋ, ny→ɲ, sy→ʃ, kh→x; c→t͡ʃ, j→d͡ʒ; ⟨e⟩→schwa [ə] by default (the pepet); tense vowels (the
// closed-syllable lax allophones are folded in the eval, not emitted); syllable-final ⟨k⟩ → glottal stop [ʔ];
// penultimate stress (shifts off a schwa nucleus).
describe("indonesian canonical IPA", () => {
    test("digraphs, c/j, ⟨e⟩→schwa, final-k glottal stop", () => {
        const cases: [string, string][] = [
            ["makan", "mˈakan"], // penult stress
            ["dengan", "dəŋˈan"], // ng→ŋ, ⟨e⟩→ə, schwa penult shifts stress to final
            ["kecil", "kət͡ʃˈil"], // c→t͡ʃ, tense i (lax folded in eval)
            ["banyak", "bˈaɲaʔ"], // ny→ɲ, final k→ʔ
            ["tidak", "tˈidaʔ"], // final k→ʔ
            ["belajar", "bəlˈad͡ʒar"], // j→d͡ʒ
            ["sekolah", "səkˈolah"], // ⟨e⟩→ə
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("acronyms spelled letter-by-letter", () => {
        expect(phonemizeWord("DPK")).toBe("depeka"); // de-pe-ka
        expect(phonemizeWord("AKP")).toBe("akape"); // a-ka-pe
    });

    test("⟨e⟩ taling lexicon (cross-source consensus) overrides the pepet default", () => {
        // Latin ⟨e⟩ conflates pepet /ə/ (rule default) and taling /e/~/ɛ/ (lexical). The shipped path pins the
        // taling quality where wikipron ∩ kaikki agree; phonemizeWordRules keeps the pepet default.
        expect(phonemizeWord("absen")).toBe("ˈabsen"); // taling /e/
        expect(phonemizeWordRules("absen")).toBe("ˈabsən"); // rule default (pepet)
        expect(phonemizeWord("ablepsia")).toBe("ablɛpsˈia"); // taling /ɛ/ preserved
        expect(phonemizeWord("abonemen")).toBe("abonəmˈɛn"); // mixed: pepet then taling
        // Genuine pepet words stay pepet (not over-pinned):
        expect(phonemizeWord("sekolah")).toBe("səkˈolah");
        // Number words bypass the lexicon (their ⟨e⟩ is pepet):
        expect(phonemize("6", "id")).toBe("ənˈam");
    });

    test("numbers (regular, compositional) + text", () => {
        expect(phonemize("21", "id")).toBe("dˈua pˈuluh sˈatu"); // dua puluh satu
        expect(phonemize("saya makan.", "id")).toContain("mˈakan");
    });
});

// #562 — the eleventh language. Three defects were outside the normalization layer (padded punctuation, a
// bare \d+ number token, no decimal word) and are fixed in the manifest and the engine.
describe("indonesian normalization", () => {
    test("both number separators, which were clause pauses", () => {
        // The number token was a bare \d+, so "9.000" tokenized as 9 | . | 000 and the separator became a
        // PAUSE ("sembilan . nol"). Indonesian groups thousands with a dot and takes a comma decimal.
        expect(phonemize("9.000 orang", "id")).toBe("səmbˈilan rˈibu ˈoraŋ");
        expect(phonemize("1.000", "id")).toBe("sərˈibu");
        expect(phonemize("1,5 meter", "id")).toBe("sˈatu kˈoma lˈima mɛtˈər"); // koma — absent before
    });

    test("punctuation is a canonical pause, not a padded copy", () => {
        expect(phonemize("Ini kalimat. Kedua, benar?", "id")).toBe("ˈini kalˈimat . kədˈua , bənˈar ?");
    });

    test("the clock shares its separator with thousands, and the digit count decides", () => {
        // Indonesian writes BOTH with a period: 9.000 (×67) and 11.00 (×29). Grouping always takes three
        // digits after the dot, a clock exactly two, so the two never collide.
        expect(phonemize("pukul 11.00", "id")).toBe("pˈukul səbəlˈas"); // :00 drops the minutes
        expect(phonemize("08.46", "id")).toBe("dəlˈapan lewˈat əmpˈat pˈuluh ənˈam"); // lewat = "past"
        // A RACE time is not a clock: "1:09.02 menit" is minutes:seconds.hundredths, and the corpus has
        // three. Both guards matter — the trailing one rejects the whole, the leading one stops the scan
        // restarting inside it and claiming "09.02" as a clock in its own right.
        expect(phonemize("1:09.02 menit", "id")).not.toContain("lewˈat");
    });

    test("abbreviations, rupiah and units", () => {
        expect(phonemize("kosmonot No. 11", "id")).toBe("kosmˈonot nˈomor səbəlˈas"); // No. before a DIGIT
        expect(phonemize("Dr. Budi", "id")).toBe("dˈoʔtər bˈudi"); // was the letters plus a pause
        expect(phonemize("dll.", "id")).toBe("dˈan lˈain lˈain .");
        // Rp is a two-LETTER prefix, which the shared tier (keyed on single-character signs) cannot
        // express; it was read as [rp]. Indonesian says the unit after the amount, so it is moved.
        expect(phonemize("Rp 50.000", "id")).toBe("lˈima pˈuluh rˈibu rupˈiah");
        expect(phonemize("3%", "id")).toBe("tˈiɡa pərsˈɛn"); // Indonesian had NO symbol tier at all
        expect(phonemize("30 km", "id")).toBe("tˈiɡa pˈuluh kilomətˈər"); // was [ʔm]
        expect(phonemize("120 km/jam", "id")).toBe("sərˈatus dˈua pˈuluh kilomətˈər pˈɛr d͡ʒˈam");
        expect(phonemize("20 °C", "id")).toBe("dˈua pˈuluh dərˈad͡ʒat t͡ʃəlsˈius");
    });

    test("what already worked is untouched", () => {
        // Indonesian ordinals need nothing: ke-16 is genuinely "ke" plus the cardinal. The manifest also
        // carries a letterNames map, so initialisms already spell out.
        expect(phonemize("abad ke-16", "id")).toBe("ˈabad kˈə ənˈam bəlˈas");
        expect(phonemize("PBB", "id")).toBe("pebebe"); // pe-be-be
        expect(phonemize("Perang Dunia II", "id")).toBe("pərˈaŋ dunˈia dˈua"); // Roman, from the registry seam
        expect(phonemize("1/5", "id")).toBe("sˈatu pˈɛr lˈima");
        expect(phonemize("-5 derajat", "id")).toBe("mˈinus lˈima dərˈad͡ʒat");
    });

    // #586 — `kilometer persegi` ×3. Bare `persegi` ×9 includes the SHAPE ("persegi yang tidak memiliki
    // sisi bawahnya"), so the collocation with the unit noun is what attests the unit sense.
    test("the squared/cubed measure word (#586)", () => {
        expect(phonemize("783.562 km²", "id")).toContain("kilomətˈər pərsəɡˈi");
    });

    test("#586 the US$ code, its magnitude slot, and the coordinate degree", () => {
        // Third language with this defect after pt and nl, by a third route: id has no initialism pass, so the
        // `$` simply arrived preceded by `S` and the tier's word-guard refused it.
        const g = phonemize("10 miliar euro (US$ 14,7 miliar) per tahun", "id");
        expect(g).toContain("dˈolar");
        // ⚠ AND IN THE RIGHT SLOT. Without `magnitudes` the fold turned a silent DROP into an audible
        // word-order error — *empat belas koma tujuh DOLAR MILIAR* instead of *…miliar dolar*.
        expect(g).toContain("milˈiar dˈolar");
        expect(g).not.toMatch(/dˈolar milˈiar/u);
        // The spaced form already worked and must not regress.
        expect(phonemize("biaya US $30", "id")).toContain("dˈolar");
        // The COORDINATE sense of `°` was unreachable until the mojibake repair mended this sentence's `Â°`;
        // reaching the bare arm then left the direction letter glued raw into the IPA.
        expect(phonemize("di timur 35°W", "id")).toContain("dərˈad͡ʒat bˈarat");
        expect(phonemize("di timur 35Â°W", "id")).toContain("dərˈad͡ʒat bˈarat");
        expect(phonemize("suhu di atas 30°C", "id")).toContain("dərˈad͡ʒat t͡ʃəlsˈius");
    });

    test("⚠ accented Latin stays ONE word and goes to the foreign reader (#654)", () => {
        // `[a-zA-Z]+` shredded every foreign name: a diacritic ended the token, the letter carrying it became an
        // unclaimed gap read as an English LETTER NAME, and the rest of the word started over.
        //   Cañitas → t͡ʃˈa ˈɛn ˈitas ("cha EN itas")   ·   São → s ˈə ˈo   ·   Klöcker → ʔl ˈoᶷ t͡ʃkˈər
        // ⚠ INVISIBLE TO EVERY GATE: no digit or raw mark survives and nothing VANISHES, so it is a WRONG-WORD
        // defect that neither the leak classes nor the differential DROP test can see. Found by reading a diff.
        expect(phonemize("Cañitas", "id")).toBe(phonemize("Cañitas", "en"));
        expect(phonemize("Klöcker", "id")).toBe(phonemize("Klöcker", "en"));
        expect(phonemize("São", "id")).toBe(phonemize("São", "en"));
        // A DIACRITIC MEANS A FOREIGN NAME — Indonesian orthography has none — so the token goes to the injected
        // reader rather than the native g2p, which drops the letter it cannot spell (`Cañitas` → t͡ʃaˈitas).
        expect(phonemize("Cañitas", "id")).not.toMatch(/t͡ʃaˈitas/u);
        // Ordinary Indonesian is untouched: plain ASCII still takes the native path.
        expect(phonemize("makan nasi goreng", "id")).toBe("mˈakan nˈasi ɡˈoreŋ");
        expect(phonemize("250 tahun kemudian", "id")).toContain("dˈua rˈatus lˈima pˈuluh");
        // Malay wraps the Indonesian engine, so it inherits both the phonology and this fix.
        expect(phonemize("Cañitas", "ms")).toBe(phonemize("Cañitas", "id"));
    });
});
