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

## Run 5 — the size/accuracy curve, and where the knee is

`cutoff` prunes the feature vocabulary by importance; it is the lever that takes PQ from 7× to ~180×.
Swept it against the FLEURS eval (`retrain=False` throughout — this is compression, not retraining):

    full .bin            1687.0 MB    96.96%     baseline
    PQ cutoff=0           224.6 MB    97.01%     ← 7.5×, marginally BETTER than full
    PQ cutoff=500k         71.1 MB    96.91%     ← 24×,  −0.05pp   ★ the knee
    PQ cutoff=200k         29.9 MB    96.14%        56×,  −0.82pp
    PQ cutoff=100k         16.2 MB    94.54%       104×,  −2.42pp
    PQ cutoff=50k           9.3 MB    92.40%       181×,  −4.56pp

9.3 MB is reachable and matches the OpenLID `.ftz` scale, but it costs 4.6pp. **The knee is at 500k**: 71 MB
for 0.05pp, which is free. Below 200k the curve turns over sharply.

⚠ **Quantization at cutoff=0 IMPROVED accuracy** (+0.05pp). PQ is lossy per-vector but argmax over 2102
labels is robust to it — the same reason "the top candidate reports equally well".

## Run 6 — single words must be lexical, and the reason is stronger than "the model is weak"

Run 4 showed single-word LID is unreliable. Measuring *what it gets wrong* changed the argument.

Sampling isolated single-word "non-host" detections in the queue returns, in frequency order:
`a`, `է`, `子`, `们`, `на`, `в`, `и`, `у`, `det`, `el`, `is`, `ir`, `आवेश`, `সাথে`, `አካባቢ`, `համար`.
**Those are host-language function words and single CJK characters, not foreign proper nouns.** The
genuinely foreign tokens (`metroplus`, `stearns`, `aol`, `ucla`) are a minority of the list.

So it is not that the model is merely weak on short input — it is that per-word LID manufactures foreign
spans out of ordinary host text. Measured on rows whose `status='verified'` (the audio agrees with our IPA,
so the text is monolingual host by construction, and every non-host call is a false positive):

    segment width    false-positive rate
    1 word                34.0%   (n=7415)
    2 words               20.6%
    3 words               16.5%
    4 words               14.9%
    6 words               13.4%
    8 words               12.4%

**A third of ordinary host words are called foreign.** Wiring per-word LID into the phonemizer would
corrupt monolingual text far more often than it would fix code-switching — the top false positives are
Arabic `في على ما مع خلال` and Amharic `ይህ ብዙ`, i.e. the commonest words in those languages.

⚠ Note the floor: even at 8 words the rate is 12.4%, so this is not a threshold to tune away. Some of that
residual is the known-hard pairs (bos/hrv, yue/cmn) rather than true error, but the shape is clear —
**segment width buys accuracy with sharply diminishing returns and never reaches zero.**

### The consequence for the design

Single-word foreign material is a **lexical** problem, not a classification one:

1. It is what the classifier is worst at, and wrong in the damaging direction (confident, not abstaining).
2. Single foreign words in this corpus are overwhelmingly proper nouns and brand names — `birmingham`,
   `whitehall`, `ucla`, `metrorail`, `aol` — which are lexical facts, exactly the kind of thing the
   per-language exception lexicons in this repo already carry.
3. A lexicon entry is auditable and reversible; a 0.88-confidence misclassification of `paris` as Kinyarwanda
   is neither.

So the routing design is: **LID on phrase-length segments only, never on words; single foreign tokens by
lexicon.** That also explains why the digit half of the queue needs no model — a digit run is the extreme
case of the same principle, where the span is exact and the reading is a per-language fact.

## Run 7 — the intruder task is much easier than 102-way LID, and that decides the size

The size/accuracy curve in Run 5 grades **102-way classification**. That is not the router's job. The job
is: *given a segment, is it the host language or an intruder (in practice English)?* Built a grounded
benchmark for exactly that — real English segments from `en_us` against real host segments from each
language's own `status='verified'` rows, 4 words each:

    model                recall   precision   false-English on host text
    full   1687 MB        96.3%     100.0%        0.0%
    PQ 500k  71 MB        93.7%     100.0%        0.0%
    PQ 100k  16 MB        94.8%     100.0%        0.0%
    PQ  50k  9.3 MB       94.0%     100.0%        0.0%

⚠ **PRECISION IS 100% AND FALSE-ENGLISH IS 0.0% AT EVERY SIZE.** The 4.6pp the 9.3 MB model loses on
102-way accuracy is spent almost entirely on the confusable pairs (bos/hrv, yue/cmn, srp) — distinctions
the router does not need to make. Recall varies 93.7–96.3% with no monotone relationship to size; the
71 MB model is *worse* than the 16 MB one here, which is noise at this sample size and the point stands:
**for this task the size choice is nearly free, so take the small one.**

That reverses Run 5's recommendation. 71 MB was the knee for general LID; **9.3 MB is the pick for the
router**, and it is the size the OpenLID `.ftz` precedent set.

## Run 8 — the safety threshold, in words

Same benchmark, 9.3 MB model, varying segment width. The number that matters is not recall but
**false-English on host text**, because a false positive corrupts correct monolingual output:

    width    recall    FALSE-English on host
    1 word    45.9%          3.3%      ← unusable
    2 words   71.4%          1.6%
    3 words   85.0%          0.2%      ← safe
    4 words   92.6%          0.2%
    6 words   96.8%          0.0%
    8 words   98.4%          0.0%

**Route at 3+ words.** Below that the damage rate exceeds the benefit: at 1 word the model finds fewer than
half the real intruders while corrupting 3.3% of correct host text, and Run 6 showed the general per-word
false-positive rate against *any* label is 34%.

### The design, settled by measurement

    digit runs        → per-language numeral register     (exact span, no model)     42% of the queue
    1–2 word spans    → lexicon                           (proper nouns; LID unsafe)
    3+ word spans     → GlotLID PQ 9.3 MB, English arm    (0.2% false positive)

Each tier is chosen because the tier above it is *measurably wrong* at that input, not by preference.

## Run 9 — the intruders' real shape, and a correction that deflates the whole approach

Run 8 recommended routing at 3+ words. That was answering "where is the model safe?" without asking
"what do real intruders look like?". They are much shorter than that threshold.

**Ground truth by script** — in a non-Latin host, a Latin run is unambiguously foreign, so no classifier is
involved. 24,025 spans over 103,738 utterances:

    1 word  43.8%      2 words 18.5%  (cumulative 62.3%)      3 words 10.1%      6+ 16.1%

**Ground truth by lexicon** for French — a token in the English g2p dict but not the French lexicon.
1,357 spans over 3,190 utterances:

    1 word  77.5%      2 words 19.5%  (cumulative 96.9%)      3+ 3.1%

⚠ **A 3+ word threshold reaches 3.1% of French intruders.** The model is safe exactly where the intruders
are not.

### And then the correction: code-switching them makes things WORSE

Scored the actual readings against the audio — read the detected span as English, versus reading the whole
utterance as French:

    1-word spans   n=400   mean 0.1042 → 0.1187   closer  67, further 293
    2+-word spans  n=143   mean 0.1335 → 0.1415   closer  49, further  91

Both directions lose. That contradicts Run 10a of the alignment investigation, which found code-switching
better in 7 of 9 French rows — and the contradiction is the finding. **Those two measurements sample
different populations.** The earlier one used hand-marked genuine English phrases from `all-flagged` rows;
this one uses every lexicon-detected span, and 389 of 400 sit in rows already marked `verified` — text the
audio says we already read correctly.

What the lexicon actually flags in verified French rows:

    h, john, france, europe, the, charles, san, luxembourg, northern, pakistan, kenya, reid,
    washington, jr, whitehall, texas, disney, francisco, alonso, george, atlanta, costello, kyoto

**Those are place names and personal names French has its own pronunciations for.** *France*, *Europe*,
*Luxembourg*, *Washington*, *Pakistan*, *Kenya* are French words. Reading them as English is simply wrong,
and the audio says so 293 times to 67.

### What this means for the design

The rule is not about span length. It is:

- **A genuine run of English PROSE** → readers code-switch. Rare: ~9 rows in `fr_fr`, and 7 of 9 improved.
- **A proper NAME, of any length** → readers nativise. Common: ~400 rows in `fr_fr`, and switching them
  loses 293 to 67.

⚠ **NEITHER A LENGTH THRESHOLD NOR A LID DISTINGUISHES THESE.** `washington` and `whitehall` are equally
English to a classifier and to a lexicon; the difference is whether the host language has adopted the word,
which is a lexical fact about the HOST, not a property of the span. A detector that cannot tell them apart
does **net harm** at the observed base rates — roughly 40 rows helped against 400 hurt.

⚠ **The numeral case is unaffected and remains strong** (85/90 rows closer, Run 11 of the alignment
investigation). It is not the same phenomenon: a digit run has no host-language pronunciation to compete
with, so there is no nativisation alternative. That is why it needs a per-language register and not a model.

### Status

The LID is measured, compressed and characterised, and it does its stated job well (100% precision on
intruder detection at every size). But the **premise** — that detecting foreign spans lets us read them
better — holds only for genuine foreign prose, which is rare, and is actively false for the common case of
adopted names. Wiring it in on span detection alone would regress the corpus.

What would change this: a signal for *"has the host adopted this word?"* — i.e. a per-language exonym /
loanword lexicon. That is the same lexical tier the single-word analysis already pointed to, arrived at
from the opposite direction.
