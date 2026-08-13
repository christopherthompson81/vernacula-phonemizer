import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/marathi/marathi.ts";

// Canonical-IPA goldens for Marathi (mr) — Devanagari; REUSES the Hindi abugida engine with a Marathi data file.
// Marathi-specific facts: ळ→retroflex lateral ɭ, ष→retroflex ʂ (Hindi merges to ʃ), च/ज→DENTAL affricate
// [t͡s d͡z] before a back/central vowel (चार→t͡saːɾ), ऐ→[əi] / औ→[əu] diphthongs (दैव→d̪əiʋ), ऋ/ृ→[ɾu].
describe("marathi canonical IPA", () => {
    test("Marathi-specific segments (ळ, ष, dental affricate, diphthongs)", () => {
        const cases: [string, string][] = [
            ["चार", "t͡sˈaːɾ"], // 'four': च → dental t͡s before ā
            ["जन", "d͡zˈən"], // 'people': ज → dental d͡z
            ["कमळ", "kˈəməɭ"], // 'lotus': ळ → retroflex lateral ɭ
            ["शाळा", "ʃˈaːɭaː"], // 'school': ळ
            ["षटकोन", "ʂəʈkˈoːn"], // 'hexagon': ष → retroflex ʂ
            ["दैव", "d̪ˈəiʋ"], // 'fate': ऐ → diphthong əi (not Hindi ɛː)
            ["मराठी", "məɾˈaːʈʰiː"], // 'Marathi': retroflex ʈʰ
            ["घर", "ɡʱˈəɾ"], // 'house': breathy ɡʱ + schwa deletion
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("word-final schwa: retained after a cluster/geminate, deleted after a single consonant", () => {
        // Marathi keeps the word-final inherent schwa to avoid a final consonant cluster (unlike Hindi, which
        // deletes both) — retainFinalAfterCluster. Affricates count as ONE consonant; a geminate is heavy.
        const cases: [string, string][] = [
            ["शब्द", "ʃˈəbd̪ə"], // ब्द conjunct → schwa retained (the canonical literature example, Wikipedia "Schwa deletion in Indo-Aryan languages")
            ["अंक", "ˈə̃ŋkə"], // ŋk cluster → schwa retained
            ["महत्त्व", "məɦˈət̪ːʋə"], // त्त्व cluster → retained
            ["अन्न", "ˈənːə"], // न्न geminate → retained
            ["बुद्ध", "bˈʊd̪ʱːə"], // द्ध geminate → retained
            ["घर", "ɡʱˈəɾ"], // single ɾ → deleted
            ["आज", "ˈaːd͡z"], // final affricate d͡z is ONE consonant → deleted
            ["नाच", "nˈaːt͡s"], // final affricate t͡s → deleted
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("text: word run + Devanagari danda", () => {
        expect(phonemize("मराठी भाषा.", "mr")).toContain("məɾˈaːʈʰiː");
    });
});

// TEXT NORMALIZATION. Assertions go through `phonemize`, not the normalizer, because the layer's
// contract is what the ENGINE finally says; the counts quoted are from the mr_in FLEURS corpus (1,992
// utterances) and are recorded in src/languages/marathi/normalize.ts.
describe("marathi text normalization", () => {
    const mr = (s: string) => phonemize(s, "mr");

    test("21-99 are the fused irregular spellings, not tens+unit", () => {
        // The `compound` map was missing from marathi.jsonc; the compositor's documented fallback read
        // every two-digit number as two words. 233 bare two-digit numbers in the corpus were affected.
        expect(mr("25")).toBe(phonemizeWord("पंचवीस")); // was पाच वीस
        expect(mr("47")).toBe(phonemizeWord("सत्तेचाळीस")); // was सात चाळीस
        expect(mr("99")).toBe(phonemizeWord("नव्व्याण्णव")); // was नऊ नव्वद
        expect(mr("36")).toBe(phonemizeWord("छत्तीस"));
    });

    test("Devanagari digits are read, and read identically to ASCII", () => {
        // 597 native digits in this corpus — the "native digits" lead HELD for Marathi, unlike hi/bn/ur.
        expect(mr("९३")).toBe(mr("93"));
        expect(mr("१,००० रुपये")).toBe(mr("1,000 रुपये"));
        // …and the same document no longer reads two languages depending on which digits it uses:
        expect(mr("९३%")).toBe(mr("93%"));
    });

    test("percent is टक्के, not Hindi's प्रतिशत", () => {
        expect(mr("90%")).toBe(`${phonemizeWord("नव्वद")} ${phonemizeWord("टक्के")}`);
        expect(mr("1%")).toContain(phonemizeWord("टक्का")); // singular
    });

    test("currency: the sign is read, on native digits too, and a magnitude hops over it", () => {
        // $२२,५०० lost its डॉलर entirely before this: the shared symbol tier's NUM is ASCII-only and $ is
        // in neither `symbols` nor `stripSymbols`, so the tokenizer never emitted it.
        expect(mr("$२२,५००")).toContain(phonemizeWord("डॉलर"));
        expect(mr("€10")).toContain(phonemizeWord("युरो")); // Marathi युरो, not Hindi यूरो
        expect(mr("$२.३ बिलियन")).toBe(mr("२.३ बिलियन डॉलर"));
    });

    test("clock: वाजून / वाजता, and a following वाजता is not doubled", () => {
        expect(mr("9:30")).toBe(mr("नऊ वाजून तीस मिनिटे"));
        expect(mr("8:30 वाजता")).toBe(mr("आठ वाजून तीस मिनिटे"));
        expect(mr("11:00")).toBe(mr("अकरा वाजता"));
        // ११ः०० — the corpus writes the visarga where a colon was meant.
        expect(mr("११ः०० वाजता")).toBe(mr("अकरा वाजता"));
        // …but a different वाज- word must not have वाजता prepended to it.
        expect(mr("11:00 वाजल्यानंतर")).toBe(mr("अकरा वाजल्यानंतर"));
    });

    test("a SPORTS time is not a clock", () => {
        // 4:41.30 is minutes:seconds.hundredths. The inherited Hindi clock rule claimed it and produced a
        // bogus "चार बजकर एकेचाळीस मिनट . तीस" — the same failure a clock rule makes when it permits a following dot
        expect(mr("4:41.30")).toBe(mr("4 41.30"));
        expect(mr("4:41.30")).not.toContain(phonemizeWord("मिनिटे"));
    });

    test("ordinals join the suffix to the cardinal, with the stem alternation", () => {
        expect(mr("१६व्या")).toBe(phonemizeWord("सोळाव्या")); // was सोळा + a stray [ʋjˈaː]
        expect(mr("15 व्या")).toBe(phonemizeWord("पंधराव्या"));
        expect(mr("20 वा")).toBe(phonemizeWord("विसावा")); // -ीस → -िसा
        expect(mr("37 वा")).toBe(phonemizeWord("सदतिसावा")); // -ीस → -िसा inside a compound
        expect(mr("60 वा")).toBe(phonemizeWord("साठावा")); // consonant-final tens take a linking -आ-
        expect(mr("9व्या")).toBe(phonemizeWord("नवव्या")); // नऊ → नव
        expect(mr("५ वे")).toBe(phonemizeWord("पाचवे")); // …but a unit does NOT take it (cf. साठ)
        expect(mr("1 वा")).toBe(phonemizeWord("पहिला")); // suppletive 1-4
        expect(mr("3 व्या")).toBe(phonemizeWord("तिसऱ्या"));
    });

    test("the ordinal rule stops at a letter boundary", () => {
        // The whole rule, really. The inherited Hindi one has no trailing lookahead and its `वा`
        // alternative eats the first two characters of वाजता / वेळा / वेगवेगळ्या — 13 live corruptions.
        expect(mr("7 वेळा")).toBe(mr("सात वेळा"));
        expect(mr("5 वाजता")).toBe(mr("पाच वाजता"));
        expect(mr("४ वेगवेगळ्या")).toBe(mr("चार वेगवेगळ्या"));
        expect(mr("10 वर्ष")).toBe(mr("दहा वर्ष")); // वर्ष is a noun, never an ordinal suffix
    });

    test("Devanagari and Latin unit abbreviations, including the squared form", () => {
        expect(mr("५ किमी")).toBe(mr("पाच किलोमीटर")); // was read as a word, [kˈɪmiː]
        expect(mr("७० किमी/तास")).toBe(mr("सत्तर किलोमीटर प्रति तास"));
        expect(mr("३ किमी²")).toBe(mr("तीन चौरस किलोमीटर")); // चौरस PRECEDES the unit
        expect(mr("19,500 km²")).toContain(phonemizeWord("चौरस"));
        expect(mr("35 mm")).toBe(mr("पस्तीस मिलीमीटर"));
    });

    // ⚠ MIS-READING, NOT LEAKING (tools/normalization/misread.ts). `10 ha` read *d̪ˈəɦaː hˈɑː* and `10 l`
    // *d̪ˈəɦaː ˈɛɫ* — the ENGLISH LETTER NAME out of a Devanagari engine — with no ASCII surviving and
    // nothing vanishing, so no leak class and no differential DROP test in the tree could reach it.
    test("units that MIS-READ rather than leak — ⟨ha⟩ ⟨l⟩ ⟨L⟩, and the ⟨g⟩ that is refused", () => {
        // ⚠ हेक्टर IS THE HECTARE IN MARATHI AND HECTOR IN HINDI — the same string, opposite verdicts.
        expect(mr("10 ha")).toBe(mr("दहा हेक्टर"));
        expect(mr("10 l")).toBe(mr("दहा लिटर"));
        expect(mr("10 L")).toBe(mr("दहा लिटर")); // ⚠ both cases are official for the litre
        // ⚠ DECLARED IN normalize.ts AS WELL AS THE TIER, and not for tidiness: left to the tier alone,
        // `100 ha` read *ˈeːk ʃˈeː …* — शे is the COMBINING hundred, and the bare-hundred rewrite that
        // gives शंभर for `100 km` never ran.
        expect(mr("100 ha")).toBe(mr("शंभर हेक्टर"));
        // ⚠ ⟨g⟩ REFUSED. ग्रॅम is the best-attested word of the set (88/20), but the artifact's only
        // `<digit> g` is `802.11 g` — a Wi-Fi standard written WITH A SPACE, which `NOT_VERSION` cannot
        // see: that guard requires the letter GLUED, because `12.5 g` is a real spaced measurement.
        expect(mr("802.11 g")).not.toContain(phonemizeWord("ग्रॅम"));
    });

    test("ranges take ते only when ASCENDING — a sports score is not a range", () => {
        // 4 of the corpus's 17 hyphenated pairs are results (5-3, 7-2, ६-६, २६-००) where ते is wrong, and
        // every one of them is descending or equal; all 11 genuine ranges ascend.
        expect(mr("2-3 किमी")).toBe(mr("दोन ते तीन किलोमीटर"));
        expect(mr("१६४४-१९१२")).toBe(mr("1644 ते 1912"));
        expect(mr("5-3")).toBe(mr("5 3")); // hockey score — no connective
        expect(mr("६-६")).toBe(mr("6 6")); // tennis tie-break
    });

    test("hundreds are शे; a BARE hundred is शंभर", () => {
        expect(mr("२००")).toBe(mr("दोन शे")); // never दोन शंभर
        expect(mr("100")).toBe(phonemizeWord("शंभर"));
        expect(mr("100-200 मैल")).toBe(mr("100 ते 200 मैल")); // the dash-guard keeps step 12's digits
    });

    test("ZWJ inside a word, and the अ‍ॅ digraph", () => {
        // core/unicode.ts DEVANAGARI_WORD excludes U+200D, so the tokenizer split the word in two.
        expect(mr("आपल्‍या")).toBe(mr("आपल्या")); // ⚠ ZWJ U+200D inside the conjunct
        expect(mr("अ‍ॅनिमेशन")).toBe(mr("ऍनिमेशन")); // ⚠ अ+ZWJ+ॅ vs the precomposed ऍ
    });

    test("ASCII ':' written for the visarga, and the visarga written for a colon", () => {
        expect(mr("विशेषत:")).toBe(mr("विशेषतः"));
        expect(mr("स्वत:चे")).toBe(mr("स्वतःचे"));
        // …but a genuine list colon stays the pause the manifest maps it to (आहेत: ×5 also ends in त,
        // which is why the -तः adverbs are a CLOSED LIST and not the pattern `त:`).
        expect(mr("हे आहेत: एक")).toContain(" , ");
    });

    test("era markers, abbreviation, fractions, degrees and signs", () => {
        expect(mr("इ.स.पू. 323")).toBe(mr("इसवी सन पूर्व 323")); // was three phrase breaks
        expect(mr("इ.स. १६१०")).toBe(mr("इसवी सन 1610"));
        expect(mr("डॉ. आंबेडकर")).toBe(mr("डॉक्टर आंबेडकर"));
        expect(mr("१/२")).toBe(phonemizeWord("अर्धा"));
        expect(mr("३/४")).toBe(phonemizeWord("पाऊण"));
        expect(mr("1/5")).toBe(mr("एक भागिले पाच")); // Marathi भागिले, not Hindi बटा
        expect(mr("30°")).toBe(mr("तीस अंश")); // अंश, not Hindi डिग्री
        expect(mr("+30°से.")).toBe(mr("अधिक तीस अंश सेल्सिअस"));
        expect(mr("~500")).toBe(mr("सुमारे 500"));
        // The MINUS rule is deliberately absent: the corpus's one hyphen-before-digit is a spacecraft name.
        expect(mr("चंद्रयान -1")).not.toContain(phonemizeWord("उणे"));
    });

    test("no danda in this corpus, but the mark still works", () => {
        // NEGATIVE RESULT worth recording: the mr_in corpus contains ZERO ।/॥ — it punctuates with the
        // ASCII period throughout. The manifest's clausePunctuation entry is kept and still functions.
        expect(mr("मराठी भाषा। नवीन")).toContain(" . ");
    });
});
