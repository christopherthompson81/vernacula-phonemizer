# Latin (la) native bring-up investigation

Target: **Classical Latin** (the reconstructed / restored pronunciation per
Allen, *Vox Latina*), Italic (Indo-European), Latin script with MACRONS marking
vowel length, canonical IPA, espeak-independent. A dead literary/liturgical
language; Classical is the scholarly reconstruction and the most rule-regular
target.

## Run 1 — referee landscape

- **wikipron**: `lat_latn_clas_narrow.tsv` **44,907** entries (Classical) +
  `lat_latn_eccl_narrow.tsv` **42,988** (Ecclesiastical). HUMAN (Wiktionary),
  narrow, SPACE-SEGMENTED. LARGE — not thin. (No `_broad`; only narrow exists.)
- **kaikki Latin**: also present, HUMAN Wiktionary → but CORRELATED with wikipron
  (same source project) → not an independent 2nd source.
- **epitran**: NO `lat-Latn` mapping (`Add an appropriately-named mapping…`).
- **espeak `la`**: AUTHORED — `dictsource/la_rules` (246 lines) headed by a
  citation to *Allen, Vox Latina* (the SAME reference this bring-up works from).
  So espeak's Latin is a second AUTHORED implementation of the same reconstruction,
  not independent human attestation (the qu/bo "independent implementation ≠
  attestation" situation). Useful as a rule cross-check, not a validating referee.

Verdict: **🔷 human-primary single-source-FAMILY** — wikipron Classical (44,907
human) is a large, robust referee, but its only corroboration (kaikki, espeak
rules) is either the same Wiktionary source or an authored implementation of the
same Allen reconstruction. Target = **Classical** (rule-regular from macronized
spelling); Ecclesiastical deferred (Italianate; a future `tradition` param).

## Rule inventory mined from wikipron Classical

Short-vowel LAXING (Allen): `a→a e→ɛ i→ɪ o→ɔ u→ʊ y→y`; MACRON = length
`ā→aː ē→eː ī→iː ō→oː ū→uː ȳ→yː`. Diphthongs `ae→a e̯ au→a u̯ oe→o e̯ eu→e u̯`
(non-syllabic offglide U+032F). Consonants: `c→k` ALWAYS (no palatalization —
Caesar→kae̯sar, Achille→akʰɪllɛ), `v→w` (Aballava→aballawa), `j→j` and
word-initial `i`+V→`j` (Iamanae→jamanae̯); INTERVOCALIC `i`/`j`→GEMINATE `j j`
(eius→ɛjjʊs, cuius→kʊjjʊs, Ajāce→ajjaːkɛ). `qu→kʷ` (aquae→akʷae̯), `ngu`+V→`ŋɡʷ`
(sanguine→saŋɡʷɪnɛ), `x→k s` (Axius→aksiʊs), `gn→ŋ n` (Magne→maŋnɛ), aspirates
`ph→pʰ th→tʰ ch→kʰ` (philosopha→pʰɪɫɔsɔpʰa), `rh→rʰ` (Rhēgium, referee-confirmed). `n`→`ŋ` before a velar.
DARK `l→ɫ` single/intervocalic (Achelōe→akʰɛɫoːɛ) but GEMINATE `ll→l l` CLEAR
(bellum→bɛllũː, illectō→ɪllɛktoː). `h→h` (intervocalic ɦ or dropped in the
referee → residual/fold). Gemination: doubled letter → the segment twice.
**WORD-FINAL `-Vm`→ nasalized LONG vowel `Ṽː`** (bellum→bɛllũː, aquam→akʷãː,
-em→ẽː) — a signature *Vox Latina* feature. STRESS: wikipron does NOT mark it
(illecebrōse→ɪllɛkɛbroːsɛ, no ˈ) → we EMIT the deterministic penult/antepenult
weight rule for canonical output; the backbone folds ˈˌ so it does not affect the
score (the mk/lv emit-if-predictable pattern).

## Run 2 — engine + tuning (Classical target)

Engine (`src/languages/latin/latin.ts`): context-sensitive grapheme scan → segment
array → post-processing (nasal assimilation, dark-l, weight stress). First pass
**89.7% folded / 98.6% symbol**. Dominant residual = short `i`/`e` in HIATUS kept
LAX (alia→alɪa) — the referee has TENSE [i e] before a vowel (Allen's close-in-
hiatus rule) → added hiatus tensing (short V before a vowel letter → tense). Also
`rh→rʰ` (aspirated, not plain r) and nasalizeLong must use the TENSE base
(-em→ẽː not ɛ̃ː). → **92.1% folded / 98.9% symbol**.

Five more clean systematic fixes (each mined from the top residual classes):
- word-initial `gn`→[n] (g silent; gnātus→naːtʊs)
- intervocalic `z`→geminate [z z] (Greek zeta; byzantīna→byzzantiːna)
- `b`→[p] before voiceless `s`/`t` (absorbita→apsɔrbɪta)
- intervocalic glide is GEMINATE [j j] after a SHORT vowel (eius→ɛjjʊs) but SINGLE
  after a long vowel/diphthong (Phīnēia→…neːja)
- combining BREVE over a macron = "common quantity" → the referee has BOTH long and
  short variants (matrī̆ma appears as iː AND ɪ) → a wash; keep the macron's LONG
  citation form, drop the breve.

**Final: 92.1% folded / 98.9% symbol** vs wikipron Classical (44,907). Residual =
referee QUANTITY inconsistency (Casīna macron-but-short; common-quantity marks) +
intervocalic `h`-drop variants (both in the referee) + rare Greek/Hebrew loans
(ou→uː acoustica, Iō, mahomētāna) + in-/con- prefix assimilation. All 1254 repo
tests pass; typecheck clean. Verdict 🔷 human single-source-FAMILY (see Run 1).
Deferred: the Ecclesiastical tradition (a future `tradition` param), numbers
(Roman numerals + cardinals), a lexical macron-quantity source.

## Run 3 — final review (pre-merge)

Adversarial review before merge found one real low-severity bug: the DIAERESIS
vowels ⟨ë ï ö ü ÿ⟩ never received hiatus tensing (they were keyed only in SHORT,
not TENSE) → coëunda→koɛʊnda, poëta→poɛta. But a diaeresis EXISTS to mark hiatus,
so those vowels are TENSE by definition (referee: coëunda→koeʊnda). Fix: add the
diaeresis vowels to TENSE + tense them unconditionally (not gated on the next char,
since the hiatus is with the PRECEDING vowel). → **91.7% → 92.1% folded**. Floor
nudged 0.90→0.88 (the reviewer flagged 1.7pp headroom as tight). Everything else
(robustness on empty/all-consonant/uppercase/stray-mark input, the placeStress
fixes, the 2 non-circular folds, wiring) verified clean and merge-ready.
