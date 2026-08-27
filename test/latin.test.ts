import { describe, expect, test } from "vitest";
import { normalizeLatin } from "../src/languages/latin/normalize.ts";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/latin/latin.ts";
import { numberToWords } from "../src/languages/latin/numbers.ts";

// Canonical-IPA goldens for CLASSICAL Latin (la) — the reconstructed pronunciation (Allen, Vox Latina), Italic, the
// Signature features: short-vowel LAXING (⟨e i o u⟩→ɛ ɪ ɔ ʊ) vs macron length (ā→aː);
// ⟨c⟩ ALWAYS [k], ⟨v⟩→[w], ⟨qu⟩→[kʷ], ⟨x⟩→[ks], ⟨gn⟩→[ŋn]; aspirates ⟨ph th ch⟩; word-initial/intervocalic ⟨i⟩→glide
// [j]; DARK ⟨l⟩→[ɫ]; ⟨n⟩→[ŋ] before a velar; the WORD-FINAL ⟨-Vm⟩→ nasalized long [Ṽː]; penult/antepenult weight
// stress. Referee: wikipron lat_latn_clas_narrow (44,907 human).
describe("Latin (Classical) canonical IPA", () => {
    test("short-vowel laxing vs macron length; ⟨c⟩→k, ⟨v⟩→w", () => {
        expect(phonemizeWord("rosa")).toBe("ˈrɔsa"); // short ⟨o⟩→ɔ
        expect(phonemizeWord("vīta")).toBe("ˈwiːta"); // ⟨v⟩→w, macron ī→iː
        expect(phonemizeWord("cīvis")).toBe("ˈkiːwɪs"); // ⟨c⟩→k always, short ⟨i⟩→ɪ
        expect(phonemizeWord("amīcus")).toBe("aˈmiːkʊs"); // penult heavy (ī) → penult stress
    });

    test("⟨qu⟩→kʷ, ⟨ngu⟩→ŋɡʷ, ⟨x⟩→ks, ⟨gn⟩→ŋn", () => {
        expect(phonemizeWord("aqua")).toBe("ˈakʷa"); // ⟨qu⟩→[kʷ]
        expect(phonemizeWord("lingua")).toBe("ˈlɪŋɡʷa"); // ⟨ngu⟩+V → [ŋ ɡʷ]
        expect(phonemizeWord("exemplum")).toBe("ɛkˈsɛmpɫũː"); // ⟨x⟩→[ks], final ⟨-um⟩→[ũː]; heavy (closed) penult → penult stress
        expect(phonemizeWord("magnus")).toBe("ˈmaŋnʊs"); // ⟨gn⟩→[ŋ n]
    });

    test("aspirates, diphthongs, dark-l, intervocalic geminate glide", () => {
        expect(phonemizeWord("Caesar")).toBe("ˈkae̯sar"); // ⟨ae⟩→[a e̯], ⟨c⟩→k
        expect(phonemizeWord("philosophia")).toBe("pʰɪɫɔˈsɔpʰia"); // ⟨ph⟩→pʰ, dark ⟨l⟩→ɫ, hiatus ⟨ia⟩
        expect(phonemizeWord("eius")).toBe("ˈɛjjʊs"); // intervocalic ⟨i⟩→geminate [j j]; preceding ⟨e⟩ stays LAX (glide, not hiatus)
        expect(phonemizeWord("fīlia")).toBe("ˈfiːlia"); // ⟨l⟩ before ⟨i⟩ → clear [l]; hiatus ⟨ia⟩
    });

    test("word-final ⟨-Vm⟩→ nasalized long, initial ⟨i⟩→glide, weight stress", () => {
        expect(phonemizeWord("bellum")).toBe("ˈbɛllũː"); // final ⟨-um⟩→[ũː], geminate ⟨ll⟩ clear
        expect(phonemizeWord("aquam")).toBe("ˈakʷãː"); // final ⟨-am⟩→[ãː]
        expect(phonemizeWord("Iūlius")).toBe("ˈjuːliʊs"); // word-initial ⟨I⟩+V→[j]
        expect(phonemizeWord("nātiō")).toBe("ˈnaːtioː"); // light penult (⟨ti⟩ hiatus) → antepenult stress
        expect(phonemizeWord("coëunda")).toBe("koeˈʊnda"); // diaeresis ⟨ë⟩ marks hiatus → TENSE [e] (not lax ɛ)
    });

    test("weight stress with nasalized nuclei, diphthongs, and muta-cum-liquida", () => {
        expect(phonemizeWord("mēnsam")).toBe("ˈmẽːsãː"); // nasalized nuclei still counted (disyllable → penult)
        expect(phonemizeWord("Rōmānum")).toBe("roːˈmaːnũː"); // final ⟨-um⟩→ũː still a nucleus → penult stress
        expect(phonemizeWord("tenebrae")).toBe("ˈtɛnɛbrae̯"); // diphthong = ONE nucleus; light penult → antepenult
        expect(phonemizeWord("volucris")).toBe("ˈwɔɫʊkrɪs"); // muta-cum-liquida ⟨kr⟩ onsets ultima → light penult → antepenult
    });
});

// CARDINAL NUMBERS (src/languages/latin/numbers.ts). Source: Allen & Greenough, *New Latin Grammar* §§132–138.
// The two non-table features: the SUBTRACTIVE forms for the last two of every decade (18 duodēvīgintī,
// 19 ūndēvīgintī, 28 duodētrīgintā, 98 duodēcentum, 99 ūndēcentum) and the mīlle/mīlia split (bare indeclinable
// mīlle for exactly 1000; the neuter plural noun mīlia counted by a neuter numeral above it — tria mīlia).
// Citation form for the inflecting numerals is the MASCULINE NOMINATIVE (ūnus, trēs, ducentī).
describe("Latin numbers", () => {
    for (const [n, expected] of [
        [0, "nihil"],                                    // Classical Latin has no zero cardinal
        [1, "ūnus"],                                     // masculine nominative citation form
        [3, "trēs"],
        [10, "decem"],
        [17, "septendecim"],                             // additive, as expected below 18
        [18, "duodēvīgintī"],                            // SUBTRACTIVE "two from twenty"
        [19, "ūndēvīgintī"],                             // SUBTRACTIVE "one from twenty"
        [20, "vīgintī"],
        [21, "vīgintī ūnus"],                            // tens-first additive compound (A&G §133)
        [28, "duodētrīgintā"],                           // the subtractive pattern repeats each decade
        [29, "ūndētrīgintā"],
        [88, "duodēnōnāgintā"],
        [98, "duodēcentum"],                             // the "next ten" after 90 is centum
        [99, "ūndēcentum"],
        [100, "centum"],
        [101, "centum ūnus"],
        [111, "centum ūndecim"],
        [555, "quīngentī quīnquāgintā quīnque"],
        [900, "nōngentī"],
        [1000, "mīlle"],                                 // bare indeclinable adjective — no *ūnum mīlle
        [2000, "duo mīlia"],                             // neuter plural NOUN above one thousand
        [3000, "tria mīlia"],                            // neuter agreement: trēs → tria
        [12345, "duodecim mīlia trecentī quadrāgintā quīnque"],
        [1000000, "mīlliō"],                             // neo-Latin (Classical has no million cardinal)
        [2000000, "duo mīlliōnēs"],
        [1000000000, "mīlliardum"],
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no digit leak, sentinel or gap across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/u);
    });

    test("end-to-end: the numeral is phonemized, not spelled out digit-wise", () => {
        expect(phonemize("18", "la")).toBe("duɔdeːwiːˈɡɪntiː"); // duodēvīgintī — the subtractive 18
        expect(phonemize("19", "la")).toBe("uːndeːwiːˈɡɪntiː"); // ūndēvīgintī — the subtractive 19
        expect(phonemize("1000", "la")).toBe("ˈmiːllɛ"); // mīlle
    });
});

// ── TEXT NORMALIZATION (src/languages/latin/normalize.ts) ───────────────────────────────────────────
//
// Evidence: `tools/corpus/mined/la.jsonc` (la.wikipedia dump, 557,823 paragraph segments). The argument
// for every case, and for the two large refusals, is in the normalizer's own header.
describe("Latin text normalization", () => {
    const la = { text: (s: string) => phonemize(s, "la") };

    test("DE-GROUPING, and ⚠ the four-group case the sweep's usual idiom gets silently wrong", () => {
        // `&nbsp;` is this corpus's thousands separator; core/markup.ts folds it to a space first.
        expect(normalizeLatin("25 000 000")).toBe("25000000");
        // ⚠ The repeat-a-two-digit-join idiom (two or three passes) is correct to THREE groups and wrong
        // at four: it leaves `1320 000000`, which reads as a well-formed Latin numeral for a completely
        // different quantity. Matching the whole number at once is what fixes it.
        expect(normalizeLatin("1 320 000 000")).toBe("1320000000");
        expect(la.text("1 320 000 000")).toBe("miːlliˈardũː trɛˈkɛntiː wiːˈɡɪntiː miːlliˈoːneːs");
        // ⚠ AND THE TRAILING GUARD REJECTS A DIGIT, NOT A DOT (trap 58) — `(?![\d.,])` lost the whole
        // grouping on a clause-final figure, and review.ts's own probe is what caught it.
        expect(normalizeLatin("25 000 000,")).toBe("25000000,");
        expect(normalizeLatin("25 000 000.")).toBe("25000000.");
    });

    test("the ERA, which is its own expansion", () => {
        expect(normalizeLatin("anno 31 a.C.n.")).toBe("anno 31 ante Christum natum.");
        expect(normalizeLatin("saeculi II p.C.n. auctor")).toBe("saeculi II post Christum natum auctor");
        // ⚠ THE LONGER FORM FIRST, or the two-letter rule eats its prefix and strands the `n.`
        expect(normalizeLatin("a.C. 500")).toBe("ante Christum 500");
    });

    test("the corpus glosses its own notation, and those are the only words emitted", () => {
        // "Mediocris temperatura est 10.6° C … quo 18.0 gradus Celsius" — one paragraph, both forms.
        expect(la.text("10.6° C")).toBe(la.text("10.6 gradus Celsius"));
        expect(la.text("43,5°")).toBe(la.text("43,5 gradus"));
        // "electus est cum 53,79% suffragiorum contra 46,21 centesimae suffragiorum" — one clause.
        expect(la.text("97%")).toBe(la.text("97 centesimae"));
        // `&c.` is the ligature of et + c(etera), ×2 in the corpus and spelled out in the same artifact.
        expect(normalizeLatin("Thesei, &c.")).toBe("Thesei, et cetera");
    });

    test("RANGES take a pause — and ⚠ an ISBN is not a range", () => {
        expect(normalizeLatin("1732-1735")).toBe("1732, 1735");
        expect(normalizeLatin("pp. 1-43")).toBe("pp. 1, 43");
        // Four and five hyphen-joined groups: a span has exactly two operands, so the rule refuses these
        // rather than filling an identifier with false pauses.
        expect(normalizeLatin("ISBN 978-3-8273-7360-1")).toBe("ISBN 978-3-8273-7360-1");
        expect(normalizeLatin("0-333-75088-8")).toBe("0-333-75088-8");
    });

    test("⚠ WHAT IS REFUSED — and here the signs are REAL, which is why", () => {
        // la.wikipedia has arithmetic articles written in Latin. The blocker is AGREEMENT, not sense:
        // `aequat`, `multiplicatum per`, `divisum per` all govern cases this layer cannot supply.
        expect(normalizeLatin("6/3 = 2")).toBe("6/3 = 2");
        expect(normalizeLatin("73 = 5 × 14 + 3")).toBe("73 = 5 × 14 + 3");
        // …and the Roman numerals stay CARDINAL, because Latin ordinals decline for five cases × three
        // genders and this corpus's own instances span the paradigm (`liber II`, `saeculi II`,
        // `XIV Februario`) — while `libri III` is a cardinal outright.
        expect(la.text("liber II")).toBe("ˈlɪbɛr ˈduɔ");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// #1097 — word-final ⟨-Vm⟩ must nasalize a NUCLEUS, never a diphthong offglide.
//
// `isVowelSeg` is true of an offglide (`u̯` decomposes to `u` + U+032F), so a word whose last two letters
// spell a diphthong had that diphthong's SECOND element nasalized and lengthened in place: `Nicolaum` read
// *ˈnɪkɔɫaũ̯ː*, a long nasalized NON-SYLLABIC vowel. Two defects in one — no language has that segment, and
// `placeStress` skips anything carrying U+032F, so the word lost a syllable and was stressed as if it had
// three. It was live in `csharp/goldens/la.tsv`.
//
// ⚠ THE REFEREE DECIDES THIS, not a choice between two plausible repairs. Of the 45
// `la.wikipron-lat-clas-narrow` rows spelled ⟨a|o|e⟩⟨u|e⟩m, NOT ONE nasalizes an offglide — every one ends
// in a syllabic ũː/ẽː. So `-aum` is a hiatus, and the fix is to make the offglide syllabic.
describe("final -Vm nasalizes a nucleus, not an offglide (#1097)", () => {
    test.each([
        // Segment-for-segment against the referee row quoted beside each.
        ["Boleslaum", "bɔˈɫɛsɫaũː"],   // b ɔ ɫ ɛ s ɫ a ũː
        ["Coeum", "ˈkoe̯ũː"],           // k o e̯ ũː  — the ⟨oe̯⟩ diphthong SURVIVES; only the final u nasalizes
        ["Idaeum", "ɪˈdae̯ũː"],         // ɪ d a e̯ ũː
        ["Caesareum", "kae̯ˈsareũː"],   // k a e̯ s a r e ũː
        ["Nicolaum", "nɪˈkɔɫaũː"],     // the golden row that carried the defect
    ])("%s → %s", (word, want) => expect(phonemizeWord(word)).toBe(want));

    test("⚠ AND THE ORDINARY CASES ARE UNTOUCHED — the change is to the offglide branch alone", () => {
        expect(phonemizeWord("bellum")).toBe("ˈbɛllũː");
        expect(phonemizeWord("aquam")).toBe("ˈakʷãː");
        expect(phonemizeWord("laudem")).toBe("ˈɫau̯dẽː"); // a diphthong NOT at the -Vm site keeps its offglide
        expect(phonemizeWord("mensa")).toBe("ˈmẽːsa");    // the pre-fricative nasal shares nasalizeLong
    });
});
