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
  ca: {
    // General Eastern/Central Catalan. The wikipron cat_narrow referee AGGREGATES dialects (multi-pron): it
    // carries both reduced Central [ə]/[u] and unreduced Valencian/Balearic [a]/[e]/[o], and marks NO stress.
    // We fold the lexical open/close mids (the ceiling), spirantization (ours honest), and dark-l.
    referees: [{ file: "ca.wikipron-cat-narrow.tsv", source: "wikipron cat_latn narrow (human, multi-dialect)", role: "primary" }],
    secondaryGap: "no independent second source wired; the referee mixes dialects and drops stress. A Central-only " +
      "pron-lexicon (or epitran cat) would corroborate the reduction + open/close mids.",
    segmentJoin: true,
    folds: [
      [/β/gu, "b", "spirantization β̞~b — ours marks it honestly; the referee varies"],
      [/ð/gu, "d", "spirantization ð̞~d"],
      [/ɣ/gu, "ɡ", "spirantization ɣ̞~ɡ"],
      [/ɫ/gu, "l", "dark-l ɫ~l — ours velarized (Central), the referee writes plain l"],
      // Neutralise the DIALECT reduction axis: the wikipron cat referee is an inconsistent MIX of reduced Central
      // (ə/u) and unreduced Valencian/Balearic (a/e/o), with NO stress mark, so it cannot adjudicate vowel
      // quality. Collapse {a,e,ɛ}→ə and {o,ɔ}→u so the eval measures the consonant/glide/palatal/rhotic system
      // + i, not vowel quality (Central reduction + the lexical open/close mids, both the documented ceiling).
      [/[ɛe]/gu, "ə", "unstressed a/e → ə (Central) vs referee a/e; folds the reduction axis + lexical ɛ/e"],
      [/a/gu, "ə", "unstressed a → ə (Central) vs referee unreduced a"],
      [/[ɔo]/gu, "u", "unstressed o → u (Central) vs referee o; + lexical ɔ/o"],
      [/v/gu, "b", "betacism: Central merges v→b; the referee (multi-dialect) keeps v"],
      [/dʒ/gu, "ʒ", "Catalan /dʒ~ʒ/ affrication is allophonic (metge dʒ ~ jo ʒ); tie already stripped, referee varies"],
      [/[ɾr]$/gu, "", "final-r is a DIALECT axis: Central drops it (cantar→kənta), the referee (Valencian) keeps it"],
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
    segmentJoin: true, // kaikki primary has no spaces (harmless); the wikipron secondary is space-separated
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
  en: {
    // en is CMUdict-derived, so wikipron eng_us (independent human Wiktionary transcriptions) is a genuine
    // referee. It is noisy (proper nouns, British variants, letter-name entries) → a modest floor. We fold our
    // narrow allophonic detail (aspiration, dark-l, r-coloured schwa) and our superscript diphthong offglides.
    referees: [{ file: "en.wikipron-eng-latn-us-broad.tsv", source: "wikipron eng_latn_us broad (human, GenAm)", role: "primary" }],
    secondaryGap: "epitran eng-Latn is itself CMU-derived — circular with our CMUdict-based g2p, so not independent.",
    segmentJoin: true,
    folds: [
      [/eᶦ/gu, "eɪ", "our superscript FACE offglide eᶦ vs referee eɪ"],
      [/oᶷ/gu, "oʊ", "our GOAT offglide oᶷ vs referee oʊ"],
      [/aᶦ/gu, "aɪ", "our PRICE offglide aᶦ vs referee aɪ"],
      [/aᶷ/gu, "aʊ", "our MOUTH offglide aᶷ vs referee aʊ"],
      [/ɔᶦ/gu, "ɔɪ", "our CHOICE offglide ɔᶦ vs referee ɔɪ"],
      [/ɚ/gu, "əɹ", "r-coloured schwa ɚ vs referee ə + ɹ (the letter r written out)"],
      [/ʰ/gu, "", "allophonic aspiration on voiceless stops — referee omits it"],
      [/ɫ/gu, "l", "dark-l is allophonic — referee writes plain l"],
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
  ff: {
    // No wikipron Fula exists (ful/fuf scrapes are empty), so the independent referee is epitran ful-Latn —
    // committed by espeak-ng-portable's Fula bring-up as ff_gold.tsv. Folds = the documented ff↔epitran
    // notation divergences (affricate/implosive spelling, prenasal superscripts, gemination doubling).
    referees: [{ file: "ff.epitran-ful-Latn.tsv", source: "epitran ful-Latn (programmatic; via espeak-ng-portable ff_gold)", role: "primary" }],
    secondaryGap: "no independent second Fula source: wikipron ful/fuf are empty, so the only G2P is the primary.",
    preFolds: [
      [/ñ/gu, "ɲ", "epitran ⟨ñ⟩ → our ɲ; matches the NFD-decomposed n+◌̃ and runs before the backbone strips the tilde"],
    ],
    folds: [
      [/c/gu, "tʃ", "epitran writes ⟨c⟩ where we render the affricate t͡ʃ"],
      [/ɟ/gu, "dʒ", "epitran ⟨ɟ⟩ vs our d͡ʒ"],
      [/ʔʲ/gu, "ʄ", "epitran ʔʲ vs our implosive ʄ"],
      [/nj/gu, "ɲ", "epitran keeps orthographic nj; we render the prenasal palatal"],
      [/ᵐ/gu, "m", "prenasal superscript → plain nasal"],
      [/ⁿ/gu, "n", "prenasal superscript → plain nasal"],
      [/ᵑ/gu, "ŋ", "prenasal superscript → plain nasal"],
      [/(.)\1+/gu, "$1", "collapse geminate doubling — length already stripped by the backbone"],
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
  ha: {
    referees: [
      { file: "ha.wikipron-hau-latn-broad.tsv", source: "wikipron hau_latn broad (human, tone-marked)", role: "primary" },
      { file: "ha.epitran-hau-Latn.tsv", source: "epitran hau-Latn (programmatic)", role: "secondary" },
    ],
    segmentJoin: true,
    folds: [
      [/ʔʲ/gu, "j", "glottalised ⟨ƴ⟩: our ʔʲ vs referee creaky j̰ (̰ stripped by the backbone)"],
      [/ɸ/gu, "f", "⟨f⟩ realised [ɸ]~[f] — dialectal/allophonic"],
      [/ⁱ/gu, "i", "our superscript diphthong offglide (aⁱ) vs referee a i"],
      [/ɽ/gu, "r", "⟨r⟩ tap/retroflex ɽ~r — referee writes ɽ"],
      [/ᵐ/gu, "m", "prenasal superscript → plain nasal"],
      [/ⁿ/gu, "n", "prenasal superscript → plain nasal"],
      [/ᵑ/gu, "ŋ", "prenasal superscript → plain nasal"],
      [/^ʔ/gu, "", "epenthetic glottal onset on vowel-INITIAL words — allophonic; anchored so medial phonemic /ʔ/ (the ⟨'⟩ letter) still counts"],
    ],
  },
  hi: {
    referees: [{ file: "hi.wikipron-hin-deva-broad.tsv", source: "wikipron hin_deva broad (human)", role: "primary" }],
    secondaryGap: "epitran hin-Deva doesn't perform Hindi schwa-deletion (writes every inherent अ), so it disagrees " +
      "systematically with both us and wikipron — not a usable corroborator. A kaikki/Wiktionary hin lexicon would be.",
    segmentJoin: true,
    folds: [
      [/ɑ/gu, "a", "referee writes आ as ɑ(ː); we use a(ː) — same phoneme, notation"],
      [/ᵊ/gu, "", "referee's epenthetic final schwa (pətɾᵊ) — we don't emit it"],
      // NOTE: no x→kʰ fold — ख़/ख is a real phonemic (nuqta) contrast our engine keeps and the referee marks
      // inconsistently; folding it would mask the contrast (~1pp of residual is genuine referee noise here).
    ],
  },
  ja: {
    referees: [{ file: "ja.wikipron-jpn-hira-narrow.tsv", source: "wikipron jpn_hira narrow (human)", role: "primary" }],
    secondaryGap: "no independent second source wired; the narrow wikipron is the human transcription and epitran jpn is unreliable.",
    segmentJoin: true,
    folds: [
      [/ꜜ/gu, "", "pitch-accent downstep marker — the referee is toneless"],
      // (ä vs a̠ needs no fold: NFD + the backbone strip both to plain a before folds run.)
      [/ᵝ/gu, "", "our compressed-u superscript (ɯᵝ) vs referee ɯ"],
      [/ɨ/gu, "ɯ", "referee ɨ for a high/devoiced う vs our ɯ"],
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
  ko: {
    referees: [{ file: "ko.wikipron-kor-hang-narrow.tsv", source: "wikipron kor_hang narrow (human)", role: "primary" }],
    secondaryGap: "no independent second source wired; epitran kor-Hang would corroborate the ㅓ/ㅏ vowel qualities.",
    segmentJoin: true,
    folds: [
      [/ɐ/gu, "a", "our ㅏ as ɐ vs referee a̠ — same /a/"],
      [/ɘ/gu, "ʌ", "our ㅓ as ɘ vs referee ʌ(̹) — same vowel, notation"],
      [/sʰ/gu, "s", "referee marks ㅅ aspiration (sʰ); we write plain s"],
      [/ɦ/gu, "h", "intervocalic ㅎ voicing ɦ~h"],
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
  sv: {
    // Central Standard Swedish. Phase 2 adds the NST pitch-accent + stress lexicon; the accent-2 grave (combining
    // U+0300) is backbone-stripped, so this stays a SEGMENTAL check, but the stress lexicon moves the long-vowel
    // QUALITY onto the right syllable (48.3→52.0%). The broad wikipron referee marks the ² prosodeme (folded) and
    // is INCONSISTENT on retroflex (mars→ʂ but barn→rn) → we fold our systematic retroflexes back to r+dental.
    referees: [{ file: "sv.wikipron-swe.tsv", source: "wikipron swe broad (human)", role: "primary" }],
    secondaryGap: "no independent second source wired; epitran ships no Swedish. The NST lexicon is the pitch/" +
      "stress oracle (data/accent-stress.tsv) but is not a segmental referee; a kaikki swe pron-lexicon would be.",
    segmentJoin: true,
    folds: [
      [/²/gu, "", "accent-2 prosodeme marker — a pitch feature, deferred to Phase 2"],
      [/¹/gu, "", "accent-1 prosodeme marker — deferred"],
      [/ʈ/gu, "rt", "retroflex ⟨rt⟩: ours assimilates (Central Standard), the broad referee often leaves r+t"],
      [/ɖ/gu, "rd", "retroflex ⟨rd⟩ vs referee r+d"],
      [/ɳ/gu, "rn", "retroflex ⟨rn⟩ vs referee r+n"],
      [/ʂ/gu, "rs", "retroflex ⟨rs⟩ vs referee r+s"],
      [/ɭ/gu, "rl", "retroflex ⟨rl⟩ vs referee r+l"],
      [/tɕ/gu, "ɕ", "tje-sound: referee wobbles t͡ɕ ~ ɕ (tie already stripped) → our ɕ"],
      [/æ/gu, "ɛ", "ä before r lowers to æ (ours, Central Standard); referee writes ɛ"],
      [/œ/gu, "ø", "ö quality œ~ø (short/long, length already stripped) — notation"],
    ],
  },
  ta: {
    referees: [{ file: "ta.wikipron-tam-taml-broad.tsv", source: "wikipron tam_taml broad (human)", role: "primary" }],
    secondaryGap: "epitran tam-Taml echoes untransliterated Tamil graphemes (e.g. visarga ஃ) into its output, so " +
      "it is not a usable corroborator. A kaikki/Wiktionary tam lexicon would be the independent second source.",
    segmentJoin: true,
    folds: [
      [/ɑ/gu, "a", "referee ஆ as ɑ(ː) vs our a(ː)"],
      [/ᶦ/gu, "i", "our superscript diphthong offglide (maᶦ) vs referee ɐ ɪ̯"],
      [/r$/gu, "ɾ", "word-final ⟨ர⟩ tap: our r vs referee ɾ — anchored so the medial ற/ர contrast still counts"],
    ],
  },
  th: {
    // Tones are Chao on both sides (stripped by the backbone), so this is a pure segmental check. The residual
    // is LEXICAL (Sanskrit/Pali readings), not a segment-inventory gap — see the th convergence note.
    referees: [{ file: "th.wikipron-tha-thai-broad.tsv", source: "wikipron tha_thai broad (human, tone-marked)", role: "primary" }],
    secondaryGap: "no independent second source wired; a pronunciation lexicon (kaikki tha) would corroborate the Sanskrit readings.",
    segmentJoin: true,
    folds: [
      [/ʔ/gu, "", "glottal coda on open short syllables — allophonic; referee writes an unreleased stop or nothing"],
    ],
  },
  tr: {
    referees: [
      { file: "tr.wikipron-tur-latn-broad.tsv", source: "wikipron tur_latn broad (human)", role: "primary" },
      { file: "tr.epitran-tur-Latn.tsv", source: "epitran tur-Latn (programmatic)", role: "secondary" },
    ],
    segmentJoin: true,
    folds: [
      [/ɫ/gu, "l", "dark-l (back-harmony allophone) — referee writes plain l"],
      [/ʰ/gu, "", "final-stop aspiration — allophonic"],
      [/ɑ/gu, "a", "back /a/ [ɑ] vs referee a — allophonic"],
      [/ɔ/gu, "o", "/o/ [ɔ]~[o] — no contrast in Turkish"],
      [/æ/gu, "e", "/e/ [æ]~[e] — allophonic"],
    ],
  },
  vi: {
    referees: [
      { file: "vi.wikipron-vie-latn-hanoi-narrow.tsv", source: "wikipron vie_hanoi narrow (human, Northern)", role: "primary" },
      { file: "vi.epitran-vie-Latn.tsv", source: "epitran vie-Latn (programmatic)", role: "secondary" },
    ],
    segmentJoin: true,
    folds: [
      [/ˀ/gu, "", "our glottalised-tone marker (creaky ˀ) — realises the referee's ʔ coda / glottal-tone feature"],
      [/ʔ/gu, "", "referee's glottal-stop coda on broken/creaky tones — the same feature we mark on the tone"],
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
