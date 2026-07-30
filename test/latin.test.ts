import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/latin/latin.ts";
import { numberToWords } from "../src/languages/latin/numbers.ts";

// Canonical-IPA goldens for CLASSICAL Latin (la) — the reconstructed pronunciation (Allen, Vox Latina), Italic, the
// fleet's first Italic language. Signature features: short-vowel LAXING (⟨e i o u⟩→ɛ ɪ ɔ ʊ) vs macron length (ā→aː);
// ⟨c⟩ ALWAYS [k], ⟨v⟩→[w], ⟨qu⟩→[kʷ], ⟨x⟩→[ks], ⟨gn⟩→[ŋn]; aspirates ⟨ph th ch⟩; word-initial/intervocalic ⟨i⟩→glide
// [j]; DARK ⟨l⟩→[ɫ]; ⟨n⟩→[ŋ] before a velar; the WORD-FINAL ⟨-Vm⟩→ nasalized long [Ṽː]; penult/antepenult weight
// stress. Referee: wikipron lat_latn_clas_narrow (44,907 human). See docs/investigations/la_native_bringup_investigation.md.
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
// The two non-table features: the ★ SUBTRACTIVE forms for the last two of every decade (18 duodēvīgintī,
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
        [18, "duodēvīgintī"],                            // ★ SUBTRACTIVE "two from twenty"
        [19, "ūndēvīgintī"],                             // ★ SUBTRACTIVE "one from twenty"
        [20, "vīgintī"],
        [21, "vīgintī ūnus"],                            // tens-first additive compound (A&G §133)
        [28, "duodētrīgintā"],                           // ★ the subtractive pattern repeats each decade
        [29, "ūndētrīgintā"],
        [88, "duodēnōnāgintā"],
        [98, "duodēcentum"],                             // ★ the "next ten" after 90 is centum
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
