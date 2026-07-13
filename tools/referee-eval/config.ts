/**
 * Per-language referee-eval configuration. Each language lists its INDEPENDENT referees (epitran / wikipron /
 * Wiktionary — none derived from espeak) and the fold classes that neutralise NOTATION or documented ALLOPHONIC
 * differences so the SEGMENTAL BACKBONE can be compared. Every fold must be justified: it either (a) folds a
 * layer we render richer than the referee (tone, length, depressor, ejective) or (b) folds a genuinely
 * allophonic / conventional difference. Whatever remains after folding is the real linguistic signal — a
 * candidate to adjudicate against published phonology, NOT an automatic bug. Referees are FALLIBLE; corroborate
 * across ≥2 before trusting a divergence (see the multi-referee method).
 */

/** One independent referee (word<TAB>ipa TSV), tagged by corroboration role. A language should have a PRIMARY
 *  and, ideally, an independent SECONDARY (≥2 sources before trusting a divergence). No secondary → `secondaryGap`. */
export interface Referee {
  file: string;
  source: string;
  role: "primary" | "secondary";
}

export interface RefLang {
  /** Independent (non-espeak) referees, primary first. */
  referees: Referee[];
  /** When no independent SECONDARY source is wired — an explicit, recorded gap, not a silent omission. */
  secondaryGap?: string;
  /** Referee IPA is space-separated phoneme segments (wikipron style) → join before comparing. */
  segmentJoin?: boolean;
  /** [pattern, replacement, justification] applied BEFORE the backbone strip, to both sides — for folds that
   *  need combining diacritics the backbone would remove (e.g. German syllabic n̩→ən before ̩ is stripped). */
  preFolds?: [RegExp, string, string][];
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
  ar: {
    // Evaluated through the ASYNC diacritized pipeline (phonemizeArabic): the ONNX pre-pass restores the short
    // vowels the script omits, so our output is comparable to the referee's fully-voweled IPA. (The sync
    // phonemizeWord expects already-diacritized input and would compare skeletons — the wrong test.)
    referees: [{ file: "ar.wikipron-ara.tsv", source: "wikipron ara_arab broad (human)", role: "primary" }],
    secondaryGap: "no independent second source wired; kaikki ara would corroborate the diacritizer + g2p.",
    segmentJoin: true,
    folds: [
      [/(.)\1+/gu, "$1", "gemination (shadda): collapse doubling — length already stripped by the backbone"],
    ],
  },
  cmn: {
    // Syllable-level: the referee is epitran's toneless pinyin-syllable → IPA inventory (no word-level wikipron
    // cmn exists), and PHON[cmn] is the bare pinyin→IPA converter. Compares segment quality, not polyphone choice.
    referees: [{ file: "cmn.epitran-cmn-Latn.tsv", source: "epitran cmn-Latn pinyin-syllable inventory", role: "primary" }],
    secondaryGap: "no word-level independent source: wikipron cmn is Hanzi-keyed (polyphone-ambiguous) and this " +
      "eval is deliberately syllable-level. A char→IPA set crediting any-attested-reading would be a second source.",
    segmentJoin: true,
    preFolds: [
      [/[ʐzɻɹʑ]̩/gu, "ɹ̩", "apical/retroflex syllabic vowel (chi ʈʂʰʐ̩, si sɹ̩) unified before ̩ is stripped"],
    ],
    folds: [
      [/[ᶦⁱᵢ]/gu, "i", "our superscript i-offglide → base i"],
      [/[ᵘᶷᵁ]/gu, "u", "our superscript u-offglide → base u"],
      [/w/gu, "u", "onset glide w~u — no phonemic contrast in Mandarin"],
      [/j/gu, "i", "onset glide j~i — no phonemic contrast"],
      [/ɪ/gu, "i", "ɪ~i — notation"],
      [/[ɑä]/gu, "a", "/a/ allophones [a]~[ɑ]~[ä] by final (an/ang/ian) — we transcribe narrow, epitran broad"],
      [/ɔ/gu, "o", "/o/ allophone [ɔ]~[o] — we narrow, epitran broad"],
      [/ʊ/gu, "u", "/u/ allophone [ʊ]~[u] — we narrow, epitran broad"],
      [/(.)\1+/gu, "$1", "collapse any doubling (no meaningful gemination in Mandarin)"],
    ],
  },
  cs: {
    referees: [{ file: "cs.epitran-ces-Latn.tsv", source: "epitran ces-Latn (programmatic)", role: "primary" }],
    secondaryGap: "no independent second source wired; wikipron ces would be a good human corroborator.",
    folds: [
      [/ɛ/gu, "e", "Czech short e is phonetically [ɛ] (our convention); epitran writes the phonemic e"],
      [/[ᶷ]/gu, "u", "diphthong offglide notation (oᶷ) vs epitran ou"],
      [/r̩/gu, "r", "syllabic r notation"],
      [/l̩/gu, "l", "syllabic l notation"],
    ],
  },
  de: {
    referees: [
      { file: "de.kaikki-deu.tsv", source: "kaikki deu (Wiktionary, CC-BY-SA)", role: "primary" },
      { file: "de.wikipron-deu.tsv", source: "wikipron deu_latn broad (human)", role: "secondary" },
    ],
    preFolds: [
      [/n̩/gu, "ən", "syllabic n̩ (referee) → our ən; expand before ̩ is stripped"],
      [/l̩/gu, "əl", "syllabic l̩ → əl"],
      [/m̩/gu, "əm", "syllabic m̩ → əm"],
      [/ɐ̯/gu, "r", "vocalized-r ɐ̯ → r; normalize before ̯ is stripped (ours writes ʁ→r, referee ɐ̯)"],
    ],
    folds: [
      [/ʔ/gu, "", "glottal-stop onset before a vowel-initial syllable — allophonic; referee marks it"],
      [/ər/gu, "ɐ", "r-vocalization: unstressed -er → ɐ (both write the vocalized form)"],
      [/ɔʏ/gu, "ɔɪ", "eu/äu diphthong offglide ɔʏ ~ ɔɪ — notation convention"],
      [/ʁ/gu, "r", "uvular ʁ ~ r — rhotic convention"],
    ],
  },
  es: {
    referees: [{ file: "es.wikipron-spa.tsv", source: "wikipron spa_latn_ca broad (human, Castilian)", role: "primary" }],
    secondaryGap: "no independent second source wired; kaikki spa or a Latin-American wikipron would corroborate.",
    segmentJoin: true,
    folds: [
      [/β/gu, "b", "spirantization β̞~b — allophonic; referee may write either"],
      [/ð/gu, "d", "spirantization ð̞~d — allophonic"],
      [/ɣ/gu, "ɡ", "spirantization ɣ̞~ɡ — allophonic"],
      [/ʝ/gu, "j", "⟨y/hi⟩ ʝ~j — convention"],
      [/r/gu, "ɾ", "trill/tap r~ɾ — referee inconsistent on rr vs intervocalic"],
      [/ᶦ/gu, "i", "our non-syllabic offglide ᶦ (aire→aᶦɾe) vs referee plain i"],
      [/ᶷ/gu, "u", "our non-syllabic offglide ᶷ (auto→aᶷto) vs referee plain u"],
    ],
  },
  fr: {
    referees: [
      { file: "fr.wikipron-fra.tsv", source: "wikipron fra_latn broad (human)", role: "primary" },
      { file: "fr.gold-freq.tsv", source: "frequency-ranked adjudicated gold (3k, our convention)", role: "secondary" },
    ],
    segmentJoin: true,
    folds: [
      [/ə/gu, "", "optional/final schwa — the referee is inconsistent on mute-e"],
    ],
  },
  kk: {
    referees: [{ file: "kk.epitran-kaz-Cyrl.tsv", source: "epitran kaz-Cyrl (programmatic)", role: "primary" }],
    secondaryGap: "no human second source wired; wikipron kaz would be a better corroborator than epitran " +
      "(which merges ө/ү→ʏ and over-marks the е palatal onglide — the espeak-ng-portable kk work used wikipron).",
    folds: [
      [/ɫ/gu, "l", "dark-l is allophonic (harmony); epitran writes plain l"],
      [/χ/gu, "x", "χ/x — uvular vs velar fricative convention"],
      [/ʁ/gu, "ʀ", "ʁ/ʀ — uvular convention"],
      [/je/gu, "e", "epitran over-marks the е palatal onglide everywhere; [je] is word-initial-only in Kazakh"],
      [/ij/gu, "əj", "epitran writes и as ij, ours as əj (reduced-vowel convention)"],
    ],
  },
  pt: {
    referees: [
      { file: "pt.wikipron-por.tsv", source: "wikipron por_latn_po broad (human)", role: "primary" },
      { file: "pt.gold-adjudicated.tsv", source: "adjudicated gold (open/close-vowel + x cases, our convention)", role: "secondary" },
    ],
    segmentJoin: true,
    folds: [
      [/ɫ/gu, "l", "coda-l velarization — wikipron omits it"],
      [/tʃ/gu, "ʃ", "⟨ch⟩: Lisbon standard ʃ vs the referee's conservative t͡ʃ"],
      [/v/gu, "b", "betacism: the referee's intervocalic v→b vs our v"],
    ],
  },
  ru: {
    referees: [
      { file: "ru.kaikki-rus.tsv", source: "kaikki rus (Wiktionary, CC-BY-SA)", role: "primary" },
      { file: "ru.gold-adjudicated.tsv", source: "adjudicated micro-gold (hand-transcribed, our convention)", role: "secondary" },
    ],
    folds: [
      [/[⁽⁾()]/gu, "", "kaikki optional-palatalization ⁽ʲ⁾ / optional-segment () markers"],
      [/ˠ/gu, "", "velarization mark on dark l"],
      [/ʲ/gu, "", "palatalization: fold to compare the segmental skeleton (both mark it, differently placed)"],
      [/ɐ/gu, "a", "unstressed a/o reduction ɐ~a — notation"],
      [/ə/gu, "a", "further-reduced schwa ə~a — notation"],
      [/ɪ/gu, "i", "unstressed i-reduction ɪ~i"],
      [/ɨ/gu, "i", "ɨ~i after hard C — allophonic"],
    ],
  },
  si: {
    referees: [{ file: "si.wikipron-sin.tsv", source: "wikipron sin_sinh_narrow (human)", role: "primary" }],
    secondaryGap: "no independent second source wired; epitran sin would corroborate the retroflex mergers.",
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
  zu: {
    referees: [{ file: "zu.epitran-zul-Latn.tsv", source: "epitran zul-Latn (programmatic)", role: "primary" }],
    secondaryGap: "no independent second source wired; a curated Nguni-tone gold would corroborate the clicks.",
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
};
