import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/latin/latin.ts";

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
    });

    test("weight stress with nasalized nuclei, diphthongs, and muta-cum-liquida", () => {
        expect(phonemizeWord("mēnsam")).toBe("ˈmẽːsãː"); // nasalized nuclei still counted (disyllable → penult)
        expect(phonemizeWord("Rōmānum")).toBe("roːˈmaːnũː"); // final ⟨-um⟩→ũː still a nucleus → penult stress
        expect(phonemizeWord("tenebrae")).toBe("ˈtɛnɛbrae̯"); // diphthong = ONE nucleus; light penult → antepenult
        expect(phonemizeWord("volucris")).toBe("ˈwɔɫʊkrɪs"); // muta-cum-liquida ⟨kr⟩ onsets ultima → light penult → antepenult
    });
});
