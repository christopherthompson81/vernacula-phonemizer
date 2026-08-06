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
        // ⚠ THE READING IS "plus OR minus" — ɓouk rɨː ɗɑːk — and the ឬ is load-bearing. An earlier version emitted
        // បូកដក on a misread attestation: corpus-words.ts reported it "attested ×4", but all four were the SPACED
        // form inside an enumeration of operations (`ប្រមាណវិធីបូក ដក គុណ ចែក` = add, subtract, multiply, divide),
        // which is a list, not a compound meaning ±. The unspaced បូកដក has zero corpus occurrences and no
        // dictionary entry. What IS attested in the ± sense is បូកឬដក, in `ខិតទៅរកបូកឬដកអនន្ត` ("approaching plus
        // or minus infinity").
        //
        // Emitted as three SPACED words because joined it loses a syllable: `បូកឬដក` reads *ɓouk ɗɑːk*, the ឬ
        // silently dropped by the syllabifier before a consonant — a pre-existing g2p defect, routed around here.
        expect(phonemizeText("±២០", "km")).toContain("ɓouk rɨː ɗɑːk");
        expect(phonemizeText("១៨៣០±៤០", "km")).toContain("ɓouk rɨː ɗɑːk");
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
        // Word-spaced for the same reason: ដុល្លារអាមេរិក is "dollar" + "America" and the boundary restorer
        // separates them. Identical phonemes, one added word space.
        // ⚠ `-rik`, NOT `-rək`, AND THE CHANGE IS THE SECOND-TIER LEXICON EARNING ITS KEEP. អាមេរិក ("America")
        // is a-me-rik; the rule engine gave ʔaːmeːrək with a schwa. Neither wikipron nor our exceptions lexicon
        // covers the word — it is exactly the "no human transcription" population km-lexicon-dict.tsv exists for —
        // and the CC BY 4.0 dictionary supplies ʔaːmeːrik. A concrete instance of the 8.7% of tokens that file
        // reaches.
        expect(phonemizeText("US$3,236", "km")).toContain("ɗollaː ʔaːmeːrik");
        expect(phonemizeText("ប្រហែល US$ ១,០២៥", "km")).toContain("ɗollaː ʔaːmeːrik");
    });

    test("⚠ CN¥ reads as yuan, and bare ¥ is deliberately left alone", () => {
        // The SIGN is ambiguous between yen and yuan; the CODE is not. Reading `CN¥` with the yen word would be
        // wrong, so the code gets its own key. យូអាន (the loan of "yuan") has ZERO corpus occurrences and came from
        // google/language-resources' pronunciation dictionary — currency names are loanwords, so corpus frequency
        // was never going to find it, and the 521 apparent hits for យ័ន were substrings of បាយ័ន/អារ្យ័ន.
        expect(phonemizeText("CN¥117,500", "km")).toContain("juːʔaːn");
        expect(phonemizeText("CN¥117,500", "km")).not.toContain("jeːn");   // not the yen
    });

    test("⚠ STACKED magnitudes compose — Khmer builds large scales from two words", () => {
        // ពាន់លាន ("thousand million") occurs 324 times directly after a digit and រយកោដិ 17. The tier matches ONE
        // magnitude between the number and the sign, so a stacked phrase left the number non-adjacent and the sign
        // was dropped entirely: `១,៦ រយកោដិ$` read with no currency. This was the artifact scan's last defect.
        expect(phonemizeText("១,៦ រយកោដិ$", "km")).toContain("ɗollaː");
        expect(phonemizeText("២,៣ ពាន់លាន$", "km")).toContain("ɗollaː");
        expect(phonemizeText("១ កោដិ$", "km")).toContain("ɗollaː");        // the simple form still works
    });

    test("⚠ a magnitude word between the number and a postposed sign still composes", () => {
        // `១ កោដិ$` — one koti dollars. The postposed pattern needs a NUMBER before the sign, so without the
        // magnitude declared the sign was dropped. This was 9 of the artifact's drops.
        expect(phonemizeText("១ កោដិ$", "km")).toContain("ɗollaː");
        expect(phonemizeText("១០លាន$", "km")).toContain("ɗollaː");
    });
});

// NOTE: in this file `phonemize` is the RULE-ONLY path (imported as `phonemizeWordRules as phonemize`) and
// `phonemizeWord` is the lexicon-first one. That distinction is load-bearing for the standalone test below.
describe("independent vowels (#670)", () => {
    // ⚠ THE SYLLABIFIER USED TO SKIP THESE ENTIRELY, marked "Phase 1" — so all 17 letters U+17A3–U+17B3 were
    // silently DELETED from every reading in which they were not the whole word. 176,282 occurrences in the mined
    // corpus, 6.0% of all Khmer-letter tokens, and agreement with wikipron on the 254 referee words containing one
    // was 0/254. Not 0% accuracy on a hard class — literally every one wrong, because a character vanished.
    test("an independent vowel before a consonant is READ, not dropped", () => {
        expect(phonemize("ឬដក")).toContain("rɨː");     // was ɗɑːk — the ឬ gone
        expect(phonemize("ឯណា")).toContain("ʔae");     // was naː
        expect(phonemize("ឮ")).toBe("lɨː");
    });

    test("⚠ the vowel takes a coda from the following consonant, as the dictionary transcribes it", () => {
        // ឥណ្ឌា is ʔən.ɗiə, not ʔə.ɗiə — the ណ closes the vowel's syllable. This is why an independent-vowel unit
        // carries a sentinel `vs`: coda assignment asks "does the previous syllable have a WRITTEN vowel", and an
        // independent vowel's vowel IS written — as the letter.
        expect(phonemize("ឥណ្ឌា")).toBe("ʔənɗiə");
        // Exact matches for the two words that attest ឭ in both the dictionary and wikipron (rɔ.lɨk, rum.lɨk).
        expect(phonemize("រឭក")).toBe("rɔlɨk");
        expect(phonemize("រំឭក")).toBe("rumlɨk");
    });

    test("⚠ the STANDALONE reading differs from the in-word one, and the lexicon owns it", () => {
        // ឧ is ʔoʔ as a word (km-lexicon.tsv and wikipron agree) and ʔu inside one — ឧត្តម ʔuttɑːm. The rule table
        // carries the in-word value because that is the context it is consulted in; production is lexicon-first, so
        // both come out right. A future editor "fixing" the rule table to ʔoʔ would break every word in ឧ.
        expect(phonemizeWord("ឧ")).toBe("ʔoʔ");            // lexicon-first — matches wikipron
        expect(phonemize("ឧ")).toBe("ʔu");        // rule-only — the in-word value
        expect(phonemize("ឧត្តម")).toContain("ʔut");
    });

    test("⚠ ឲ្យ — 54,491 occurrences — reads ʔaoj, via the coeng being skipped", () => {
        // 98% of all IV+coeng sequences in the corpus are ឲ្យ/ឱ្យ ("to give/let"). An independent vowel cannot
        // carry a subscript, so the coeng falls through and the ⟨យ⟩ becomes the vowel-syllable's coda. That is the
        // right answer, but it arrives by omission rather than an explicit branch — hence this pin.
        expect(phonemize("ឲ្យ")).toBe("ʔaoj");
        expect(phonemize("ឱ្យ")).toBe("ʔaoj");
        expect(phonemize("ឲយ")).toBe("ʔaoj");   // same reading without the coeng — the mechanism, made visible
        expect(phonemize("ឯង")).toBe("ʔaeŋ");   // and an ordinary coda still works
    });

    test("every one of the 17 letters has a reading", () => {
        // The class was skipped wholesale, so a partial table would leave a silent deletion behind. All 17 are
        // sourced — 13 from dictionary word-initial counts, the rest from the standalone sources; see the manifest.
        for (let cp = 0x17A3; cp <= 0x17B3; cp++) {
            const v = String.fromCodePoint(cp);
            expect(phonemize(v + "ក"), v).not.toBe(phonemize("ក"));
        }
    });
});

describe("khmer signs the layer used to leave silent", () => {
    test("⚠ a SPACED plus reads បូក even when the left operand is not a digit", () => {
        // 274 sites this layer left silent, refused as "undecidable" on a measurement that pooled the unspaced
        // `x+3\!` LaTeX shape with the spaced one. Measured apart, the spaced shape has 312 sites and ZERO carry
        // a LaTeX or C marker — they are Khmer GRAMMAR FORMULAS and algebra, both voiced បូក.
        expect(String(phonemizeText("(នាម + កំនត់)", "km"))).toContain("ɓouk");     // noun + determiner
        expect(String(phonemizeText("16x² + 24x + 9 = 0", "km"))).toContain("ɓouk");
        // ⚠ and the UNSPACED shape stays silent — that is where the LaTeX lives.
        expect(String(phonemizeText("x+3", "km"))).not.toContain("ɓouk");
    });

    test("⚠ a leading `+` on a bare number reads វិជ្ជមាន, not silence", () => {
        // review.ts's `+5` probe read *pram* — "five", the sign gone. The word is attested 419 times; the sign
        // in a sign-value role is not, so this is the weaker tier and is recorded as such.
        expect(String(phonemizeText("+5", "km"))).toBe("ʋɨcceəmiən pram");
        expect(String(phonemizeText("+៥", "km"))).toBe("ʋɨcceəmiən pram");
    });

    test("⚠ but a `+` after a percent is an INFIX, not a sign value", () => {
        // `៥០%+១` (a voting threshold, "50% + 1") read *fifty percent POSITIVE one* until `%` was added to the
        // operand guard: a percent sign is neither a letter nor a digit, so the plus looked like a fresh number.
        expect(String(phonemizeText("៥០%+១", "km"))).not.toContain("ʋɨcceəmiən");
    });

    test("a timezone offset reads its plus — the one unspaced shape worth reading", () => {
        // `UTC+7`, `GMT+9`, `JST (UTC+09:00)` — 11 sites, every one a real offset after an uppercase initialism.
        expect(String(phonemizeText("UTC+7", "km"))).toContain("ɓouk");
        expect(String(phonemizeText("(UTC+09:00)", "km"))).toContain("ɓouk");
    });

    test("⚠ a SPACED equals reads ស្មើ — the refusal split on spacing, like the plus", () => {
        // Refused for two rounds as "glosses and code, wrong nearly as often as right" — true of the shape as a
        // whole, false once spacing splits it: 1,649 spaced operand-flanked sites with the code operators
        // excluded, 1,546 of them on Khmer prose lines, against 239 unspaced and 694 code operators.
        expect(String(phonemizeText("x = y", "km"))).toBe("ˈɛks smaə wˈaᶦ");
        expect(String(phonemizeText("៤ = ២៤", "km"))).toContain("smaə");
        // A definitional gloss — a term and its explanation — reads the sign literally, which keeps the boundary.
        expect(String(phonemizeText("ឧបាយកោសល្ល = បណ្ឌិត", "km"))).toContain("smaə");
        // Algebra whose left operand the digit rule cannot see.
        expect(String(phonemizeText("16x² + 24x + 9 = 0", "km"))).toContain("smaə");
    });

    test("⚠ but a code operator and an UNSPACED equals stay silent", () => {
        // 694 `==`/`!=`/`>=`/`<=` and 239 unspaced sites — `ចក្រវាឡរណប=satellite` is a translation gloss and
        // `x=-1/2` is a solution set. Unspaced is the code-and-markup shape in this corpus, as it is for the plus.
        expect(String(phonemizeText("a == b", "km"))).not.toContain("smaə");
        expect(String(phonemizeText("x=-1/2", "km"))).not.toContain("smaə");
        expect(String(phonemizeText("ចក្រវាឡរណប=satellite", "km"))).not.toContain("smaə");
    });
});
