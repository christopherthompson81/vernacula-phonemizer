# Arabic referee no-match investigation

## Run 1 — 2026-07-14

**Question:** the diacritization model is ~2% DER, yet "bad diacritization" is blamed for the bulk of the
55% no-match vs the wikipron ara referee. Can 2%-DER diacritization really cause ~55% mismatch? (No — that's the
contradiction.)

**Command:** `npx tsx tools/referee-eval/eval.ts ar --examples 25`

**Raw finding:** folded backbone 2160/4758 = 45.4% match (54.6% no-match). Eyeballing the top residual, almost every
mismatch is the REFEREE carrying an extra FINAL short vowel / tanwin / nisba that our output drops:
  - استحال ours `staħaːl` vs ref `istaħala` (final -a + initial i epenthesis)
  - شاد ours `ʃaːd` vs ref `ʃaːda` (final -a)
  - أبدا ours `ʔabdaː` vs ref `ʔabadan` (tanwin -an)
  - جاوي ours `dʒaːwiː` vs ref `dʒaːwijj` (nisba -ijj vs -iː)
  - آبد ours `ʔaːbd` vs ref `ʔaːbid` (an internal short vowel — a genuine diacritization diff, but the MINORITY)

**Hypothesis:** the bulk is PAUSAL-form (ours) vs FULL/citation-form (referee) — the iʕrab case/mood final vowels
(-a/-u/-i/-un/-an/-in) that Standard Arabic drops in pause. wikipron gives the fully-voweled citation form; we emit
pausal. This is a CONVENTION mismatch, not a diacritization error. Next: quantify how much of the no-match is
explained by a trailing-vowel-only difference.

## Run 2 — decisive: isolated vs in-context diacritization

**Categorization of the 54.6% no-match** (per-cause probe):
- A final-iʕrab only (pausal vs full-form CONVENTION): 354 (7.4%)
- B diacritizer sukun'd medial consonants (our cons ⊂ ref): 707 (14.9%)
- C same consonants, different vowels: 1030 (21.6%)
- D different consonants (loan/translit/nisba/tanwin): 507 (10.7%)

**Decisive experiment** — diacritize the SAME word isolated vs in a carrier sentence:
```
isolated أبر → أَبْر (ʔabr)   |  "قد أبر النخلة" → أَبَرّ (verb vowels restored)
isolated أثم → أَثْم           |  "قد أثم الرجل"  → أَثَم
isolated أجل → أَجْلْ          |  "قد أجل الموعد" → أَجَل
```

**CONCLUSION — the contradiction is resolved:** the "~2% DER" is measured on RUNNING TEXT (in-distribution); the
wikipron referee is a list of ISOLATED dictionary lemmas (mostly verb citation forms) — OUT of distribution. On a
bare isolated word the context-trained model has no signal and hedges to SUKUN (minimal prediction), producing
under-voweled forms (ʔabr for ʔabara). Add the pausal-vs-citation convention (A) and inherent isolated-word ambiguity
(C, the largest bucket — a context-free rasm has several valid vocalizations) and loan/proper-noun noise (D), and the
55% no-match is almost entirely NOT "the 2%-DER model is bad" — it's an OOD + convention + ambiguity artifact of
testing isolated lemmas. Same lesson as the German proper-noun deflation, but sharper: the referee is adversarial for
a context model. Next: quantify the upside of diacritizing each eval word inside a neutral carrier phrase.

## Run 3 — actionable levers + verdict

- **Carrier phrase** (diacritize "قد {word}", extract): only 52→53% on a sample. Biases toward VERB readings (hurts
  nouns) and the pausal-vs-citation final still differs. NOT a clean win.
- **Pausal fold** (drop a word-final short vowel / tanwin from both sides — our pausal output IS valid Standard
  Arabic): 45.4% → **51.5% (+6.1 pts)** on the full eval. Clean and legitimate (analogous to the German paren /
  syllabic-n̩ folds — a convention normalization, not a quality change).

### VERDICT (answers the contradiction)
The "~2% DER" (running text, in-distribution) and the "55% no-match" (wikipron ISOLATED dictionary lemmas, OOD) are
measured on DIFFERENT DISTRIBUTIONS and are not contradictory. Blaming "bad diacritization" for the bulk is WRONG:
- ~7% is pausal-vs-citation CONVENTION (foldable, our form is valid).
- ~22% is inherent isolated-word AMBIGUITY (a context-free rasm has several valid vocalizations; neither ours nor the
  referee is "wrong").
- ~15% is the diacritizer hedging to SUKUN on bare isolated words — an OUT-OF-DISTRIBUTION artifact (the model
  restores the correct vowels the moment context is added), NOT the 2%-DER running-text quality.
- ~11% is loan/translit/proper-noun noise (Azerbaijan, أتوبوس otobus…).
The wikipron isolated-lemma list is an ADVERSARIAL referee for a context-trained diacritizer. The phonemizer is fine
on realistic (running-text) input; the 55% is a referee-distribution artifact, not a phonemizer-quality signal.

### Recommendations
1. Apply the pausal fold (+6.1 pts, honest). 2. Re-label ar in language-maturity.md as referee-OOD/convention-limited
(like en/ga — the % is not a quality signal). 3. For a FAIR number, wire an in-context / running-text referee (or
kaikki ara) rather than isolated lemmas; no cheap model-side win exists for the isolated-lemma task.

## Run 4 — does the SILVER incompletely restore vowels? (up the chain)

Pipeline: CATT (teacher, Apache-2.0) silver-labels Wikipedia/aug sentences → BiLSTM (student) trained silver-only,
19-label PAUSAL alphabet (labels include BOTH '0' no-diacritic AND 'o' sukun as distinct).

**Bare-consonant rate in the silver** (consonants excl. long-vowel carriers اويى):
| source | word-INTERNAL bare | word-FINAL bare |
|---|---|---|
| aug_train3.txt (silver, 345k) | **4.45%** | 1.6% |
| catt_wikinews.tsv (CATT eval) | 3.75% | 0.0% |

**Finding:** YES, modestly. CATT leaves ~4.5% of WORD-INTERNAL consonants BARE (no diacritic) in the silver — e.g.
فيلم → CATT فِيلم (final م bare) vs gold فِيلْمُ. A bare internal consonant → the g2p produces a vowelless cluster
(ʔabr). The BiLSTM distills this bare/sukun prior, and it blows up on isolated OOD words. So the silver IS a
contributing factor (~4.5% internal under-restoration), but NOT the bulk — the decisive Run-2 experiment (same word
voweled correctly WITH context) shows the dominant effect is OOD isolated-word inference, not silver incompleteness.

**Two compounding causes, ranked:** (1) OOD — model trained on sentences, evaluated on isolated lemmas [dominant];
(2) silver under-restoration — CATT leaves ~4.5% internal consonants bare, teaching a bare/sukun prior [secondary].
Next: espeak-ng-portable's AUTHORED Arabic restoration (lexicon + clitic-strip + epenthesis) — a dictionary lookup
nails isolated headwords exactly, so it may be the right primary path (or a lexicon-first hybrid) for this task.

## Run 5 — the fix: Tashkeela (classical) lexicon, per the espeak-ng-portable method

**espeak-ng-portable's authored method** (restoreShortVowels.ts): supplement-only (fires only when the L2S output is
a SKELETON — 0 vowels or a ≥3-consonant run, since Arabic forbids CCC), cascade = direct lexicon → clitic-strip→stem
→ suffix-strip→stem → clitic+suffix → syllable-aware epenthesis FLOOR (always sayable). Lexicon = data/ar/
diacritization.tsv, 258 k entries, PAUSAL, Tashkeela-derived.

**Silver-lexicon (Wikipedia running-text) test — NEGATIVE:** a word→most-frequent-vocalization lexicon from OUR CATT
silver is WORSE than the neural model on wikipron (25.6% vs 49.3% on covered). Because it stores the running-text-
frequent reading, not the dictionary CITATION form. → No Wikipedia-derived artifact (neural OR lexicon) will match
this referee; the referee targets classical citation conventions.

**Tashkeela-lexicon test — DECISIVE:**
| | exact | +pausal-fold |
|---|---|---|
| neural (current) | 45.4% | 51.5% |
| Tashkeela lexicon (covers 64.9%), on covered | **58.3%** | **68.3%** |

Tashkeela is CLASSICAL/ancient text → fully diacritized, citation-form vocalizations = exactly what wikipron's
dictionary lemmas are. A lexicon-first hybrid (Tashkeela → clitic/suffix strip → neural fallback → epenthesis floor)
lands roughly ~52% exact / ~60% pausal, up from 45.4% — AND, more importantly, it fixes the real isolated-word
under-voweling (buckets B + much of C) that the running-text neural model structurally cannot.

**Licensing correction (mine was wrong):** I treated Tashkeela as GPL-blocked. It is ANCIENT TEXT (classical works —
public-domain content); the word→vocalization facts are orthographic regularities, not the corpus's creative
expression (same Feist/ADR-0014 reasoning the neural model already relies on). espeak-ng-portable already ships the
Tashkeela-derived lexicon with a PROVENANCE. So it can go into the permissive vernacula project too.

**RECOMMENDATION:** port the espeak-ng-portable lexicon-first cascade to vernacula with a Tashkeela-derived pausal
lexicon (unencumbered), keeping the neural BiLSTM as the CONTEXT/OOV fallback + the epenthesis floor + skeleton gate.
Lexicon nails isolated headwords; neural handles running-text context; floor guarantees sayable. Also apply the
pausal fold to the ar referee (convention, +6 pts). This inverts the architecture: authored-lexicon-primary,
neural-secondary — the right shape for a task whose hard cases are isolated/citation, not contextual.

## Run 6 — implemented: skeleton-gated lexicon supplement (inference-time)

Ported espeak-ng-portable's restoreShortVowels cascade into vernacula as `restore.ts`, wired into phonemizeArabic
AFTER the neural diacritizer:
  diacritize(sentence) → for each word whose g2p output is a SKELETON (0 vowels or a ≥3-consonant run, via the
  engine's own Seg.vowel) → override from the Tashkeela PAUSAL lexicon (direct → clitic/suffix strip → stem) →
  epenthesis floor for true OOV. Supplement-ONLY: an already-voweled word is never touched; a candidate is kept
  only if it is itself no longer a skeleton.

Lexicon: src/languages/arabic/diacritization.tsv (258k, Tashkeela-derived pausal, +PROVENANCE — maintainer-directed
posture: facts-not-expression, classical/ancient underlying text). Loaded lazily; optional (absent → epenthesis
only). Test added (isSkeleton + supplement behavior, sync).

**Result:** يقول → jaquːl (was the jqwl skeleton), برنامج → barnaːmadʒ, دنمارك → dinmaːrk — the genuinely
unpronounceable words are now sayable, with ZERO degradation (referee 45.4→45.6%, only ever up). On the isolated-
lemma referee only 2.4% of words produce a skeleton (short lemmas yield valid-but-different vocalizations, not
skeletons), so the referee barely moves BY DESIGN — the pass targets broken/OOV running-text words (where skeletons
are common and matter for TTS), not the referee's convention/ambiguity mismatches. The referee lever remains the
pausal fold (+6.1). Deeper fix (silver cleaning + retrain) is the separate in-model path.

## Run 7 — pausal fold applied + re-label

Q: are the iʕrab (final case/mood) vowels sounds the TTS should synthesize? A: NO in the position the referee tests.
Utterance-final is ALWAYS pausal (al-waqf) — nobody says كِتَابٌ /kitaːbun/ as an isolated utterance, only /kitaːb/;
the wikipron isolated-lemma list is entirely utterance-final, so our pausal output is the CORRECT thing to say and
the referee's citation ending is a dictionary convention. (Mid-sentence formal-register iʕrab would need syntactic
case assignment, deliberately deferred — pausal is a valid informal register and avoids wrong-case errors.)

So the pausal fold is a legitimate convention normalization (like the German paren / syllabic-n̩ folds), NOT masking
sounds we should produce. Implemented as an ar preFold: drop a word-final SHORT vowel [aiu]$ (long aː/iː/uː end in
ː so are preserved; runs before the backbone strips length). Measured: strip-final-short-vowel +4.4 (45.6→50.0%);
NOT stripping tanwin -Vn (over-matches real min/ʔan → net-negative, so excluded). Floor 0.40→0.48. ar re-labelled: the
50% is explicitly NOT a quality signal (referee OOD + convention + ambiguity), pausal-register scope documented.
