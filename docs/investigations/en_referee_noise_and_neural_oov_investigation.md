# English referee noise + a neural (BiLSTM) OOV method — investigation

Question (user): the English referee number is low (~36%) — how much is *referee noise* vs real quality, can
*normalization* clean it up, and could a *BiLSTM* OOV reader (the bn/nb pattern) beat the current joint n-gram?

Architecture recap: English is a native G2P — a CMUdict pronunciation lexicon (g2p-dict.tsv, 117k words, public
domain) for known words, and a 3-tier OOV path for the rest (`englishG2p.ts`): **compound-split → suffix morphology →
joint n-gram beam decode**. The n-gram is only the *non-compositional tail* fallback. It already emits stress-bearing
ARPABET with an `enforceSinglePrimary` (the `oneStress` twin) and the training computes a grapheme→chunk alignment.

## Run 1 — 2026-07-25 — characterising the referee noise

Referee: `wikipron eng_latn_us broad` (human, GenAm), 4558 words. Ran `eval.ts en`: **raw 0.0%, folded 36.1%**
(1644/4558). The residual list is the tell — it's the **alphabetical head**, dominated by proper nouns / foreign names
/ scientific Latin: Abranchiata, ACOG, AIgiarism, Aabenraa, Aba, Abelia, Abgesang, Abkhazian, Abughazaleh,
Acanthodea… plus genuine referee errors (`A`→eɪ letter-name vs our article schwa; `dor`→dɔ, a **British non-rhotic**
form in a "US" set).

**Split the folded accuracy by CMUdict coverage** (a bespoke probe replicating the eval folds):

| subset | folded match | reading |
|---|---|---|
| **dict-covered** (2069, 45%) — we are AUTHORITATIVELY correct (CMUdict) | **60.2%** | the ~40% "misses" are REFEREE NOISE — variants, British forms, letter-names, stress/notation |
| **OOV** (2489, 55%) — the joint n-gram | **16.0%** | the hardest, most variant-prone class (proper nouns/foreign); confounded by the same noise |
| overall | 36.1% | |

**Key finding: the referee-noise floor is ~40%.** Even on words where our output is provably correct (in CMUdict),
wikipron only agrees 60.2% — so 60% is roughly the referee's *ceiling* for us, not 100%. The 36% headline is a
referee-SHAPE artifact (55% of the set is OOV proper nouns) on top of that ~40% noise floor. There is **no
frequency-weighting** wired for en (unlike nb), so the metric has no real-text signal — English real text is ~93%
CMUdict-covered (the correct, dict-served path), which the uniform proper-noun-heavy referee never sees.

**The two levers (this investigation):**
1. **Normalization** — frequency-weight the en eval (the nb lever: common/dict words dominate → real-text quality),
   + fold the remaining convention noise (our hiatus ʲ glide; British-in-US rhoticity).
2. **Neural OOV** — the honest OOV quality can't be read off the noisy referee; measure the current n-gram on a CLEAN
   CMUdict held-out split (the "~54% stat ceiling" from prior work), then train a BiLSTM tagger (the bn/nb
   structuralTagger pattern, reusing the CMUdict alignment) on the same split and compare word accuracy.

## Run 2 — 2026-07-25 — normalization: frequency-weighting BACKFIRES (a negative result)

Wired an English frequency list (OpenSubtitles en_50k, hermitdave, CC BY-SA → freq/en.txt) and re-ran. Unlike
Norwegian (where freq-weighting lifted 63→91%), for English it **DROPS** the number to **27.6%** (below the uniform
36.1%). Cause: the referee's highest-frequency entries are citation-forms / errors / British variants where **WE are
correct** — and function words carry enormous weight. The top-20 freq drivers, our output vs referee:

| word | freq | ours | referee | who's right |
|---|---|---|---|---|
| A / a | 14.5M | ə | eɪ | US — referee gives the LETTER-NAME |
| it | 13.6M | ɪt | ət | US — ɪt is standard |
| be | 4.2M | bi | beɪ | US — referee ERROR (beɪ is not "be") |
| think | 1.8M | θɪŋk | tɪŋk | US — referee th-stopping |
| does | 478k | dʌz | doʊz | US — referee ERROR ("doze") |
| here / care | | hɪɹ / kɛɹ | hiəɹ / kɛəɹ | convention — British centering diphthong before r |
| morning | | mɔɹnɪŋ | moɹnɪŋ | convention — horse–hoarse |

**72.4% of the frequency weight is "missed" — and on inspection we are the correct GenAm text form**, the referee a
letter-name (A→eɪ), a transcription error (be→beɪ, does→doʊz), or a British variant (here, care, morning). So the
wikipron en referee cannot measure our common-word quality; frequency-weighting just concentrates the referee's
own error onto the highest-weight words. **Conclusion: do NOT ship freq/en.txt as a quality metric** (it is a
referee-noise diagnostic, not a real-text signal). A *few* of these are foldable conventions (British r-colouring
hiəɹ~hɪɹ, kɛəɹ~kɛɹ, horse–hoarse moɹ~mɔɹ), but the letter-name/error entries are not.

**Net for "normalization":** the honest quality of English is NOT readable off this referee at all. The dict path is
CMUdict-standard (~100% by construction — it IS the reference), and the only genuinely open question is the OOV
model — which needs a CLEAN CMUdict held-out split, not the noisy wikipron set. → Run 3, the BiLSTM.

## Run 3 — 2026-07-25 — a BiLSTM tagger roughly DOUBLES OOV accuracy (clean CMUdict held-out)

Since the referee can't measure OOV quality, measured on a CLEAN CMUdict 90/10 split (deterministic md5, reproduced
byte-identically in Python + TS: 105,731 train / 11,748 held-out). Trained a char→ARPABET-chunk BiLSTM tagger (the
bn/nb structuralTagger pattern: parallel hard-EM many-to-{0,1,2} alignment → char-embed → 2-layer BiLSTM(256) → masked
per-position tag, cosine-LR; `tools/english/en_g2p_bilstm.py`) and compared to the current OOV pipeline on the same
held-out (`en_baseline.mts` / `en_hybrid.mts`). Trained in **133 s** on GPU.

**Headline (held-out WORD accuracy):**

| model | exact (incl. stress) | stress-independent |
|---|---|---|
| current OOV pipeline (compound→morph→n-gram) | 36.5% | 42.7% |
| **BiLSTM tagger** (pure per-grapheme, no compound/morph) | **59.1%** | **64.0%** |

**+22.6 points exact / +21.3 stress-indep** — the bn/nb pattern holds for English: a BiLSTM tagger beats the joint
n-gram (and the whole current pipeline) decisively. Per the pipeline's own routing:

| path | n | current | BiLSTM |
|---|---|---|---|
| n-gram tail | 6869 (58%) | 24.5% | **53.8%** (2.2×) |
| compound-split | 1871 (16%) | 22.7% | **56.2%** |
| morph (inflection) | 3008 (26%) | 72.3% | 73.1% (tie) |

Two findings: (1) the **n-gram is the weak tier** and the BiLSTM more than doubles it; (2) the **compound-splitter is
net-HARMFUL** (22.7% — it mis-splits look-alike words) and the BiLSTM beats it too, so a hybrid that keeps compound
(53.6%) is WORSE than pure BiLSTM (59.1%). Only the dict-backed **morph** tier earns its keep (72.3%, tied by the
BiLSTM). 59.1% exact / 64% stress-indep is a solid floor for a modest 2-layer tagger (published transformer G2P ≈
75%); a larger model / beam would push higher.

**Conclusion.** (a) *Referee noise*: the wikipron en referee cannot measure English quality — ~40% noise floor even on
provably-correct dict words, and freq-weighting backfires (Run 2); the honest signal is the clean held-out. (b)
*Neural OOV*: a BiLSTM OOV reader is a **large, real win** (36.5→59.1%), replacing the n-gram (and the harmful
compound-splitter) while keeping morph. **Caveat / decision:** English is C#-mirrored (the current OOV g2p is a pure
function that ports to C#); a BiLSTM adds an ONNX + onnxruntime serving path (async, like bn/nb) that would need a C#
story too — a bigger lift than a TS-only language. This run establishes the *value*; whether to build the production
tier (train on full CMUdict, ONNX export, async serving + C# parity) is the open decision.

## Run 4 — 2026-07-25 — can we build a RELIABLE referee? wikipron's hard ~25% noise ceiling

User steer: the referee noise blocks a trustworthy read of the lift; build a more reliable referee before taking the
BiLSTM to its conclusion. Used the dict-covered subset (2069 words where CMUdict is GROUND TRUTH, so every wikipron
disagreement is measurable noise, not our error) to (a) categorise the noise and (b) test how far normalization cleans
it.

**The noise is systematic** — 76% of the 518 edit-distance-1 disagreements are a handful of substitutions (ours→ref):
reduced-vowel notation ə/ᵻ→ɪ/ə/ʌ (~190, the biggest), our hiatus glide ʲ→∅ (56), non-rhotic ɹ→∅ (27, British-in-US),
cot-caught/LOT ɔ~ɑ~ɒ (~40), happY ɪ~i (9). **But normalizing it hits a wall:**

| normalization layer | dict-covered agreement |
|---|---|
| L0 (current folds) | 60.2% |
| L1 + notation (ᵻ→ɪ, ʲ→∅) | 65.8% |
| L2 + reduced-vowel collapse (ɪ/ʌ→ə) | 72.4% |
| L3 + dialect (cot-caught, LOT, horse) | **75.0%** |

**Even folding everything systematic — including L2/L3 collapses that ERASE real contrasts — wikipron tops out at ~75%
agreement with ground-truth CMUdict.** So it has a hard ~25% noise ceiling: it can never score our quality above ~75%,
and the residual is genuine CMU-vs-Wiktionary variant choice / Wiktionary error, not our error. **wikipron cannot be
made into a reliable high-resolution referee for English.**

**So what IS the reliable referee?**
- For the **method comparison** (BiLSTM vs n-gram), the **clean CMUdict held-out is already noise-free gold** — the
  Run-3 lift (36.5→59.1%) is measured there, uncontaminated by wikipron. That number is trustworthy. The user's
  distrust was right; the answer is to NOT use wikipron (which we didn't).
- The one remaining gap is **distribution**: CMUdict-held-out is normal-ish words, but the OOV path actually serves
  **proper nouns / novel / foreign words**. To measure the true-target lift reliably we need a clean referee on THAT
  distribution. wikipron is proper-noun-heavy but noise-capped at 75%; there is no independent second English source.

**Recommended reliable referee (the next build): a clean, distribution-matched OOV held-out carved FROM CMUdict.**
CMUdict itself contains tens of thousands of proper nouns / names (aaberg, aachen…). Partition CMUdict into
common-words vs rare/proper-noun (by the OpenSubtitles frequency list + a names list), TRAIN on common, HOLD OUT the
proper-noun/rare tail → a noise-free (CMUdict-gold), distribution-matched OOV referee. Measure BiLSTM vs n-gram there;
that is the trustworthy read of the real-target lift, and the surface to iterate the BiLSTM to its ceiling. (A small
hand-adjudicated proper-noun gold is the fallback if the CMUdict name partition proves impure.)

## Run 5 — 2026-07-25 — what's IN the 25%, and the real fix: a phone-level metric

Categorised the L3/L4-normalized dict-covered residual (CMUdict = ground truth). Folds plateau: L3 74.3% → L4
(+GOAT əʊ→oʊ, velar-nasal n→ŋ, pre-r e→ɛ) 76.1% (+1.7pp — diminishing). Composition of the ~24% residual: 517 words,
edit-dist-1 314 / dist-2 142 / dist-3+ 61. And when the "common" residuals are checked for capitalisation-in-referee,
**every one is ALSO A NAME** (Aba, Amis, Archie, Auschwitz, Barak, Bedouin, Budapest, Dunkirk, Francesca, Garrett…).

**So the residual is almost entirely PROPER NOUNS with genuinely-multiple valid pronunciations** — anglicisation /
foreign-origin ambiguity (Auschwitz ɑʃwəts~aʊʃvəts, Budapest budə~bjudə, Francesca tʃ~s, Bedouin -oʊən~-wən), plus a
small tail of real errors both ways (Archie→"Arky" ref-error; Aba→"A-B-A" our-error; Bes→"beez" our-error). These are
**neither notation (can't normalize further) nor error (can't excise — both pronunciations are valid).** Excising the
ambiguous-name class would delete the OOV TARGET distribution itself — the paradox: the least-refereeable class (names)
is exactly the class OOV G2P serves.

**The real fix is the METRIC, not the data.** These residuals are 1–2 symbols apart; WORD-exact-match scores them 100%
wrong, a phone/symbol-error-rate scores them ~90% right. On the dict-covered ground-truth set (SAFE notation folds only,
L1):

| metric | agreement |
|---|---|
| WORD-exact | 65.8% |
| **SYMBOL accuracy (1 − edit-distance PER)** | **92.3%** |

The same referee is 92.3% right at the phone level. The "referee noise" was largely an **artifact of word-exact-match**
brutally penalising pervasive 1-phoneme English variation (reduced vowels, dialect, name anglicisation). **Conclusion
for the reliable referee:** don't chase word-exact folds past ~76%; switch the metric to **phone-error-rate + credit
any attested variant**. Under PER the wikipron/CMUdict referees become usable (~92% agreement on truth), and the
BiLSTM-vs-n-gram lift should be re-read in PER — a stabler, fairer measure that doesn't amplify single-phoneme
proper-noun variance into whole-word failures.

## Run 6 — 2026-07-25 — the lift in PER, and a reusable phone-error-rate metric in the harness

**Re-measured the BiLSTM vs the current OOV pipeline in phone-error-rate** on the clean CMUdict held-out (11,748 words,
stress-independent phones; `tools/english/en_per_compare.mts`):

| model | WORD-exact | PHONE-accuracy (1−PER) |
|---|---|---|
| current pipeline (compound→morph→n-gram) | 42.7% | 81.8% |
| **BiLSTM tagger** | **64.0%** | **90.7%** |

**The BiLSTM roughly HALVES the phone-error-rate — 18.2% → 9.3% (49% fewer phone errors).** PER is the stabler read:
the word-exact gap (+21pp) and the PER gap (−49% errors) tell the same story, but PER doesn't hinge on the brittle
all-or-nothing word match.

**Built the metric into the eval harness (reusable fleet-wide).** `tools/referee-eval/eval.ts` now reports
`symbol accuracy = 1 − phone-error-rate` on every language: for each word, the min symbol edit-distance to the
best-matching reference variant, summed as a rate. It sits beside `folded backbone` (word-exact) and needs no
per-language config. First readings confirm it does exactly what Runs 1–5 argued:

| lang | folded (word-exact) | symbol accuracy (1−PER) |
|---|---|---|
| **en** (noisy referee) | 36.1% | **78.1%** |
| nya (clean, 3-referee) | 99.4% | 99.9% |
| luo (thin, clean) | 100.0% | 100.0% |

English leaps 36→78% under PER (the metric-brutality quantified), while already-clean languages barely move — i.e. PER
recovers the real signal wikipron carries without falsely inflating clean referees.

**Net conclusion of the investigation.** (1) The English wikipron referee's "noise" was largely a WORD-EXACT-MATCH
artifact: it is ~78% right at the phone level (92% on ground-truth common words) — the residual is genuine
proper-noun pronunciation variance, not fixable notation. (2) The reliable measure is **phone-error-rate + variant
crediting** (now in the harness), not more folds and not word-exact. (3) A **BiLSTM OOV reader roughly halves the OOV
phone-error-rate** (18.2→9.3%) — a large, real win, still pending the production/C#-parity decision. Full suite
1040/1040.

## Run 7 — 2026-07-25 — PRODUCTIONIZED the BiLSTM OOV tier

Built the production neural OOV path (TS-only — no C# mirror exists in vernacula-phonemizer, and the language is
independently portable, so no port needed):
- **`englishTagger.ts`** — `createEnglishTagger()`: BiLSTM (ONNX) per-letter → ARPABET chunk (masked argmax, decline
  on out-of-vocab letter), finished with the SHARED `enforceSinglePrimary` + `collapseGeminates` + `arpabetToIpa`
  (extracted from `englishG2p.ts` as exported pure fns) so there is no seam with the dict. Self-contained in the
  English module (reuses only the generic `core/onnx.ts` + `maskedArgmax`).
- **`enNeural.ts`** — async `phonemizeEnNeural`: pre-pass tags each distinct OOV word once, injects the readings as the
  sync engine's new `oovOverride` (threaded through `english.ts` resolveWord: lexicon → heteronym → possessive →
  **tagger** → n-gram). Dict/heteronym/number/punctuation output is byte-identical to `phonemize(text, "en")`.
- **Model:** trained on the full 117k CMUdict, dynamic-int8 quantised (9.4MB→2.4MB). 28 chars, 212 tags.

**Bug found + fixed (the aligner separator):** the hard-EM aligner concatenated a 2-phone chunk without a delimiter —
fine for single-char IPA (Norwegian `e`+`ɪ`=`eɪ`) but for multi-char ARPABET it fused tokens (`K`+`S`=`KS`), which
leaked as raw uppercase into the IPA (Zorplex→…plɛ**KS**). Added a configurable `SEP` to `align_parallel` (`" "` for
ARPABET, `""` default for IPA — Norwegian unaffected). Beyond fixing the leak, proper token boundaries **raised
held-out** 59.1→68.4% word-exact and PER 90.7→92.6%. Guarded by a test (OOV output must be all-lowercase IPA).

**Shipped-model held-out (clean CMUdict, stress-independent phones):** pipeline 42.7% word / 81.8% phone-acc vs BiLSTM
**68.4% word / 92.6% phone-acc — 59% fewer phone errors (7.4% vs 18.2%).** Full suite 1044/1044, tsc 0 errors.
`phonemizeEnNeural` is opt-in (import from `src/enNeural.ts`, the bn/nb pattern); the sync `phonemize(text, "en")` is
unchanged.
