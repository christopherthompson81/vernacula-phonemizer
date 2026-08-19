# Span-level LID for code-switched routing

Opened because the ASR-alignment `all-flagged` queue turned out to be dominated by code-switching rather
than by phonemizer defects (see `asr_align_qc_investigation.md` runs 10–11). The planning document is
`docs/OpenLID-fastText.scratch.md`; that file is gitignored, so durable findings live here.

## Run 1 — 2026-08-19 — the licence gate, and the base model it forced

The plan's step 1 is an explicit gate. It failed for OpenLID, on **licensing rather than coverage**.

`HPLT/OpenLID-v3` states: *"Open use for non-commercial purposes is covered by all licences."* The
restriction is load-bearing across the sources that make the tail worth having — AfriQA (CC BY-NC 4.0),
BLTR (CC BY-NC-SA), HFWikipedia via glotlid-corpus (CC BY-NC-SA), Leipzig ("non-commercial personal and
scientific purposes"), Turkic Interlingua (CC BY-NC-SA), Masakhanews (AFL-3.0).

⚠ **v1 and v2 carry the same sentence**, so this is not a v3 regression to route around with an older
release. And the published OpenLID-v3 *model* is GPL-3.0, which is a different problem: the repo already
fences a GPL-3.0 artifact (the rime-wugniu Wu dictionary) so that is precedented, but **the repo ships zero
non-commercial artifacts**. Adding the first one is a licensing-posture decision, not an engineering one.

**GlotLID is the right base.** `cis-lmu/glotlid` ships "Apache License 2.0 plus notices"; the notices are
disclaimers (no warranty on training-data licensing, a good-faith takedown offer), not restrictions. One of
them makes precisely the argument `LICENSES/licencing_posture.md` §4 already makes for this project's own
weights — that a statistical model of n-gram frequencies does not encode expressive content. Apache-2.0 is
MIT-compatible with attribution, so this is a NOTICE entry and a `*.PROVENANCE.md` sidecar, not a fence.

## Run 2 — the in-domain baseline the plan assumed we lacked

The plan expected to grade on CommonLID and FLORES. We have something better: the alignment corpus is
**270,106 FLEURS utterances with a known language label each** — the actual input distribution a router
inside this phonemizer will see. Built a stratified 6,120-utterance sample (60 × 102 languages).

⚠ **THE FLEURS→`iso639-3_Script` MAPPING IS THE MEASUREMENT'S GROUND TRUTH AND MUST BE WRITTEN OUT, NOT
INFERRED.** The first run scored 94.12% and three languages at exactly 0%, which looked like model failure
and was mine: `pes`/`fas`, `est`/`ekk` and `arz`/`arb` are the same languages under different codes and I
had guessed the wrong side of each. Correcting the map moved the number to 96.96% without touching the
model. A 0% language is a mapping bug until proven otherwise.

    GlotLID v3, full          1687 MB    96.96% top-1 / macro-recall, 102 languages

Residual errors are exactly the pairs the plan predicted: `bos→hrv` 38, `srp→bos` 20, `yue→cmn` 59,
`zsm→ind` 7. ⚠ The `yue` case is arguably not an error — that FLEURS text is formal written Chinese in
traditional characters, which is genuinely indistinguishable from `cmn` in writing.

## Run 3 — compression: product quantization is the mechanism

The published ONNX export (`TigreGotico/glotlid-onnx`) reaches 419 MB, ~4×. The ~170× figure that motivated
this work is a different mechanism: fastText's own **product quantization**, the same path that takes
`laurievb/OpenLID` from 1234 MB to a 7.3 MB `.ftz`.

    GlotLID v3 full            1687.0 MB    96.96%
    GlotLID v3 PQ, cutoff=0     224.6 MB    97.01%     ← 7.5× smaller, marginally BETTER

⚠ Quantization did not cost accuracy; it gained 0.05pp. PQ is lossy per-vector but the argmax over 2102
labels is robust to it, which is the same observation behind "the top candidate reports equally well".

⚠ `retrain=False` throughout, deliberately: GlotLID's training corpus is a separate download under a
separate licence question, so this measures **compression alone** rather than compression-plus-retraining.
A `cutoff` sweep for the size knee is in progress.

## Run 4 — what it is actually for, and where it breaks

The capability the queue needs is detecting an embedded foreign span. On the real spans from the queue:

    crown court                    → eng 1.00        le procès s'est déroulé à la  → fra 1.00
    running tours barcelona        → eng 0.82        et s'est terminé le trois août → fra 1.00
    wonders of the african world   → eng 0.97        der fotograf wurde in das      → deu 1.00
    medical center                 → eng 0.96        ang lugar sa turkey apil…      → ceb 0.70
    college of arts sciences       → eng 0.89

9/9, high confidence on the English spans, no false English on native text.

⚠ **AND THE SHORT-SPAN CLIFF IS REAL AND SHARP**, exactly as the plan warned. Single words are unusable:

    birmingham → eng 0.77     whitehall → ekk 0.30      new york → wes 0.37
    buckingham → eng 0.79     metrorail → eng 0.47      paris    → kin 0.88  ← confidently WRONG
    green card → eng 0.98     fotograf  → fur 0.68      barcelona→ cat 0.20

Measured over full utterances, by normalized length:

    0-20 chars   n=    2   50.00%
    20-50        n=  170   88.24%
    50-100       n= 1771   95.54%
    100-200      n= 3781   97.94%
    200+         n=  396   98.74%

**This rules out per-word language switching and confirms the plan's option B** (segment first, classify
per segment) over option A (sliding window). A phrase-length span is fine; a proper noun is not, and
`paris → kin 0.88` shows the failure is confident rather than abstaining, so a confidence threshold does
not rescue it.

### Consequence for the queue

    all-flagged 747
      digit-run only    317 (42.4%)  → span is EXACT; a per-language numeral register, NO model needed
      prose / mixed     430 (57.6%)  → phrase-length spans, which is what this model is good at

The digit half never needed LID: 92% of digit-bearing rows have digits as their only foreign element,
across 56 languages, and a digit run normalizes to nothing under the preprocessor — it is the input this
model is worst at. That half is a config table sourced from the audio (measured: ceb→en, fil→en, sn→en,
ln→fr; 85/90 rows closer).
