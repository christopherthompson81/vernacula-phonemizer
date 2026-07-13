/**
 * Per-language referee-eval configuration. Each language lists its INDEPENDENT referees (epitran / wikipron /
 * Wiktionary — none derived from espeak) and the fold classes that neutralise NOTATION or documented ALLOPHONIC
 * differences so the SEGMENTAL BACKBONE can be compared. Every fold must be justified: it either (a) folds a
 * layer we render richer than the referee (tone, length, depressor, ejective) or (b) folds a genuinely
 * allophonic / conventional difference. Whatever remains after folding is the real linguistic signal — a
 * candidate to adjudicate against published phonology, NOT an automatic bug. Referees are FALLIBLE; corroborate
 * across ≥2 before trusting a divergence (see the multi-referee method).
 */

export interface RefLang {
  /** Referee TSV files (word<TAB>ipa), independent of espeak. */
  referees: { file: string; source: string }[];
  /** Referee IPA is space-separated phoneme segments (wikipron style) → join before comparing. */
  segmentJoin?: boolean;
  /** [pattern, replacement, justification] applied AFTER the shared backbone strip, to both sides. */
  folds: [RegExp, string, string][];
}

// Shared backbone: strip supra-segmental notation no broad referee reliably carries.
export const BACKBONE: [RegExp, string][] = [
  [/[ˈˌ]/gu, ""],          // stress
  [/[ː]/gu, ""],           // length
  [/[˥˦˧˨˩]/gu, ""],       // Chao tone letters (ours) — segmental comparison only
  [/[̀-̵̳-ͯ]/gu, ""], // combining diacritics: tone accents, depressor ̤, voiceless ring (keep tie U+0361 handled below)
  [/[͜͡]/gu, ""],           // tie bars
  [/[\s​]+/gu, ""],   // whitespace / ZWSP
];

export const CONFIG: Record<string, RefLang> = {
  zu: {
    referees: [{ file: "zu.epitran-zul-Latn.tsv", source: "epitran zul-Latn (programmatic)" }],
    folds: [
      [/ʼ/gu, "", "ejective — we keep it, epitran drops it"],
      [/k(?=[ǀǃǁǂʘ])/gu, "", "our click k-release (kǀ) vs epitran bare click (ǀ)"],
      [/ŋɡ/gu, "ŋ", "our prenasalised ŋɡ (⟨ng⟩) vs epitran bare ŋ"],
      [/ⁿ/gu, "n", "prenasal superscript → full nasal"],
      [/ᵐ/gu, "m", "prenasal superscript → full nasal"],
      [/ᵑ/gu, "ŋ", "prenasal superscript → full nasal"],
      [/ɛ/gu, "e", "mid-vowel raising is allophonic (ɛ↔e); neither transcription is wrong"],
      [/ɔ/gu, "o", "mid-vowel raising is allophonic (ɔ↔o)"],
    ],
  },
  si: {
    referees: [{ file: "si.wikipron-sin.tsv", source: "wikipron sin_sinh_narrow (human)" }],
    segmentJoin: true,
    folds: [
      [/ʋ/gu, "w", "ʋ/w — the referee is itself split; convention"],
      [/ɾ/gu, "r", "r/ɾ — referee split; convention"],
      [/ɳ/gu, "n", "retroflex ɳ→n merger (Standard Spoken Sinhala)"],
      [/ɭ/gu, "l", "retroflex ɭ→l merger"],
      [/t̪/gu, "t", "narrow dental detail → phonemic"],
      [/d̪/gu, "d", "narrow dental detail → phonemic"],
      [/n̪/gu, "n", "narrow dental detail → phonemic"],
      [/[ʰʱ]/gu, "", "aspiration — ours keeps it (loan register), referee deaspirates"],
      [/[əɐä]/gu, "a", "a/ə are allophones in Sinhala"],
      [/(.)\1+/gu, "$1", "geminate length vs doubling — both referee and ours inconsistent"],
      [/wa$/gu, "w", "final-ව offglide: the schwa after ව→w is dialectally optional"],
    ],
  },
  cs: {
    referees: [{ file: "cs.epitran-ces-Latn.tsv", source: "epitran ces-Latn (programmatic)" }],
    folds: [
      [/ɛ/gu, "e", "Czech short e is phonetically [ɛ] (our convention); epitran writes the phonemic e"],
      [/[ᶷ]/gu, "u", "diphthong offglide notation (oᶷ) vs epitran ou"],
      [/r̩/gu, "r", "syllabic r notation"],
      [/l̩/gu, "l", "syllabic l notation"],
    ],
  },
  kk: {
    referees: [{ file: "kk.epitran-kaz-Cyrl.tsv", source: "epitran kaz-Cyrl (programmatic)" }],
    folds: [
      [/ɫ/gu, "l", "dark-l is allophonic (harmony); epitran writes plain l"],
      [/χ/gu, "x", "χ/x — uvular vs velar fricative convention"],
      [/ʁ/gu, "ʀ", "ʁ/ʀ — uvular convention"],
      [/je/gu, "e", "epitran over-marks the е palatal onglide everywhere; [je] is word-initial-only in Kazakh"],
      [/ij/gu, "əj", "epitran writes и as ij, ours as əj (reduced-vowel convention)"],
    ],
  },
};
