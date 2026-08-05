import { describe, expect, test } from "vitest";

// The goldens exercise the RULE engine (phonemizeWordRules); the shipped phonemizeWord is dict-first (exceptions
// lexicon → rules), tested separately below.
import { phonemize as phonemizeText } from "../src/index.ts";
import { phonemizeWord, phonemizeWordRules as phonemize } from "../src/languages/khmer/khmer.ts";

// Canonical-IPA goldens for Khmer / ភាសាខ្មែរ (km) — Austroasiatic (Mon-Khmer), the Khmer abugida, non-tonal.
// PHASE 2 (in active development): a proper unit-based SESQUISYLLABIC syllabifier per Huffman (1970) —
// governance (series set by the last preceding dominant stop/spirant, tracked across the word), presyllable
// reduction, coda assignment, and the nasal-superscript medial-cluster split. These goldens pin the two-series
// core PLUS one word per structural rule that matches the wikipron referee. Deferred long tail: Pali
// doubled-consonant loanwords, special digraphs (ហ្វ→f), bantaq vowel-shortening, independent vowels.
// See docs/investigations/km_native_bringup_investigation.md.
describe("Khmer canonical IPA — two-series sesquisyllabic core (Phase 2)", () => {
    test("THE two-series contrast: the same vowel sign ⟨ា⟩ reads by the governing series", () => {
        expect(phonemize("កា")).toBe("kaː"); // ក a-series → aː (matches wikipron)
        expect(phonemize("គា")).toBe("kiə"); // គ o-series → iə (same sign ា, different reading)
        expect(phonemize("ចា")).toBe("caː"); // ច a-series
        expect(phonemize("ជា")).toBe("ciə"); // ជ o-series
    });

    test("whole words matching the wikipron referee (base governs the series in a coeng cluster)", () => {
        expect(phonemize("ខ្មែរ")).toBe("kʰmae"); // "Khmer" — ខ (a-series) governs ែ → ae; final ⟨រ⟩ silent
        expect(phonemize("ភាសា")).toBe("pʰiəsaː"); // "language" — ភ (o) → iə, ស (a) → aː
        expect(phonemize("ស្រុក")).toBe("srok"); // "country" — ស (a) governs ុ → o + coda k
    });

    test("governance: the vowel series is set by the last preceding dominant (stop/spirant), across the word", () => {
        expect(phonemize("ផ្ទះ")).toBe("pʰteəh"); // both dominant → the SUBSCRIPT ទ (o-series) governs ះ → eəh
        expect(phonemize("ចេតនា")).toBe("ceːtnaː"); // passive ន harmonises to a-series from the preceding ត → naː (not niə)
    });

    test("sesquisyllabic structure: presyllable reduction, coda assignment, nasal medial-cluster split", () => {
        expect(phonemize("កករ")).toBe("kɑkɑː"); // presyllable kɑ (short) + stressed kɑː (long, ⟨រ⟩ silent)
        expect(phonemize("កណ្ដាល")).toBe("kɑnɗaːl"); // presyllable kɑ + main nɗaːl (ɗ governs ា; ⟨ល⟩ coda)
        expect(phonemize("តម្រង")).toBe("tɑmrɑːŋ"); // nasal ⟨ម⟩ closes syllable 1, subscript ⟨រ⟩ opens syllable 2
    });

    test("inherent-vowel length: plain coda LONG, silent-subscript/bantaq coda SHORT (Huffman IX.A)", () => {
        expect(phonemize("កង")).toBe("kɑːŋ"); // plain coda → long ɑː
        expect(phonemize("គង")).toBe("kɔːŋ"); // 2nd-series plain coda → long ɔː
        expect(phonemize("ចន្ទ")).toBe("cɑn"); // silent final subscript ⟨្ទ⟩ → short
        expect(phonemize("រដ្ឋ")).toBe("ruət"); // 2nd-series silent-subscript → short uə
        expect(phonemize("កាត់")).toBe("kat"); // bantaq shortens ⟨ា⟩ aː → a
    });

    test("multi-char vowels: base sign + ⟨ះ⟩ (-h) / ⟨ំ⟩ (-m)", () => {
        expect(phonemize("កោះ")).toBe("kɑh"); // ⟨ោះ⟩ a-series → ɑh
        expect(phonemize("ចុះ")).toBe("coh"); // ⟨ុះ⟩ a-series → oh
        expect(phonemize("ជុំ")).toBe("cum"); // ⟨ុំ⟩ o-series → um
    });
});

// The SHIPPED phonemizeWord consults the exceptions lexicon (km-lexicon.tsv) dict-first for the Huffman-lexical
// words the rules cannot predict (internal doubling, Pali vowels), then falls back to the rule engine.
describe("Khmer — shipped phonemizeWord (exceptions lexicon dict-first)", () => {
    test("a lexicon word overrides the (wrong) rule output", () => {
        expect(phonemizeWord("កញ្ចក់")).toBe("kɑɲcɑʔ"); // lexicon: rule alone drops the doubled ច (→ kɑɲ)
        expect(phonemize("កញ្ចក់")).not.toBe("kɑɲcɑʔ"); // proof the rule path differs
    });

    test("an OOV word falls through to the rule engine (dict == rule)", () => {
        expect(phonemizeWord("ស្រុក")).toBe(phonemize("ស្រុក")); // not in the lexicon → rules
    });
});

// Cardinal numbers — Khmer is the fleet's BI-QUINARY case: 6–9 are overtly 5+n (ប្រាំមួយ = ប្រាំ 5 + មួយ 1), and
// the bi-quinary unit is reused whole inside the teens (16 = ដប់ + ប្រាំមួយ). Above that the system is decimal, with
// native ដប់ 10 / ម្ភៃ 20 and a Thai-derived 30–90 overlay. Numerals from Wikipedia "Khmer numerals" (see numbers.ts).
describe("Khmer (km) cardinal numbers — bi-quinary 6–9", () => {
    for (const [n, ipa] of [
        [5, "pram"], // ប្រាំ — the quinary base
        [6, "prammuəj"], // ប្រាំមួយ = 5 + 1
        [7, "prampiː"], // ប្រាំពីរ = 5 + 2
        [9, "pramɓuən"], // ប្រាំបួន = 5 + 4
        [16, "ɗɑp prammuəj"], // ដប់ប្រាំមួយ = 10 + (5+1) — the bi-quinary unit reused whole
        [20, "mpʰɨj"], // ម្ភៃ — not unit+សិប
        [21, "mpʰɨj muəj"], // ម្ភៃមួយ
        [42, "saesəp piː"], // សែសិបពីរ — the Thai-derived decade សែសិប
        [100, "muəj rɔːj"], // មួយរយ — a magnitude always carries its multiplier, incl. "one"
        [1000, "muəj poən"], // មួយពាន់
        [12345, "muəj məɨn piː poən ɓəj rɔːj saesəp pram"], // ម៉ឺន 10⁴ magnitude
        [1000000, "muəj liən"], // មួយលាន
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(phonemizeText(String(n), "km")).toBe(ipa);
        });
    }
});

describe("Khmer signs, units and currencies (#585 review pass)", () => {
    // Every reading below is corpus-sourced; the counts are digit-flanked occurrences in the mined kmwiki dump.
    test("arithmetic signs read as words", () => {
        expect(phonemizeText("៥+៣", "km")).toContain("ɓouk");        // + 74 instances, បូក
        // ⚠ NOT `៨-២` — a digit-hyphen-digit is a RANGE in Khmer and the range rule runs first, so that reads
        // "eight TO two" (ɗɑl). The minus rule is for the LEADING dash, which is the negative/subtract reading.
        expect(phonemizeText("-៥", "km")).toContain("ɗɑːk");          // − ដក, attested ×3,808
        expect(phonemizeText("៨-២", "km")).toContain("ɗɑl");          // and the range still wins here
        expect(phonemizeText("៣×៥", "km")).toContain("kun");          // × 46 instances, គុណ
        expect(phonemizeText("៨÷២", "km")).toContain("caek");         // ÷ ROBUSTNESS: 0 instances, ចែក sourced ×3,285
        expect(phonemizeText("៤=៤", "km")).toContain("smaə");         // = digit-flanked only; see normalize.ts
    });

    test("⚠ the LEADING ± is read, and the leading + deliberately is not", () => {
        // Measured asymmetry, not an oversight. Of the sites with no number before the sign, all 4 ± are genuine
        // (`±20°` latitude bands, `± 0.1 ឆ្នាំ`) while 142 of 254 + are LaTeX or C from this wiki's maths
        // articles and programming tutorial. Reading the leading + would be a misfire generator.
        expect(phonemizeText("±២០", "km")).toContain("ɓoukɗɑːk");
        expect(phonemizeText("១៨៣០±៤០", "km")).toContain("ɓoukɗɑːk");
    });

    test("both spellings of the kilometre abbreviation are read", () => {
        // គម 212 instances after a digit, Latin km 95. Declaring one left the other a foreign-fallback mangle.
        expect(phonemizeText("៥ គម", "km")).toContain("kiːloumaet");
        expect(phonemizeText("៥ km", "km")).toContain("kiːloumaet");
    });

    test("all four currencies are read, on whichever side the sign sits", () => {
        // Khmer POSTPOSES the sign (`២៤៧០$`) as well as preposing it, and the riel, euro and pound were simply
        // never declared — which was most of the artifact's remaining currency drops.
        expect(phonemizeText("២៤៧០$", "km")).toContain("ɗollaː");
        expect(phonemizeText("១០០៛", "km")).toContain("riəl");
        expect(phonemizeText("២,៣ €", "km")).toContain("ʔəɨrou");
        expect(phonemizeText("£៥", "km")).toContain("pʰaon");
    });

    test("⚠ US$ is read, which needs its own key because the Latin guard blocks the bare $", () => {
        // The tier refuses a sign preceded by a Latin letter — the guard that stops a sign being read out of the
        // middle of a Latin word. `US$` appears in ordinary Khmer prose (`ប្រហែល US$3,236`), so it is declared
        // as a multi-character key and matched as a unit.
        expect(phonemizeText("US$3,236", "km")).toContain("ɗollaːʔaːmeːrək");
        expect(phonemizeText("ប្រហែល US$ ១,០២៥", "km")).toContain("ɗollaːʔaːmeːrək");
    });

    test("⚠ a magnitude word between the number and a postposed sign still composes", () => {
        // `១ កោដិ$` — one koti dollars. The postposed pattern needs a NUMBER before the sign, so without the
        // magnitude declared the sign was dropped. This was 9 of the artifact's drops.
        expect(phonemizeText("១ កោដិ$", "km")).toContain("ɗollaː");
        expect(phonemizeText("១០លាន$", "km")).toContain("ɗollaː");
    });
});
