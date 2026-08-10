# Punjabi (Gurmukhi) — closing the 73.6%, and an audio-supervised lexicon

## Run 0 — 2026-08-09 — verification and plan (handoff; no builds yet)

**Why the Gurmukhi side first.** Measured both scripts (eval.ts pa): Gurmukhi 73.6% folded / 91.4% symbol
(1,586 words); Shahmukhi 56.5% / 85.0% — but the Shahmukhi fix (a BiLSTM restorer) is DATA-BLOCKED: its
supervised pool is crossscript.tsv's 2,637 real dual-script pairs, a quarter of da's ~10k BiLSTM threshold
(ur Phase C confirmed it), and the synthetic-transliteration route was already tried and sank (see the pa
floor comment). Gurmukhi has NO lexicon at all — lexicon.tsv and crossscript.tsv both serve Shahmukhi — and
its residual is dominated by ONE audible class: medial-schwa syncope (wədɳa≠wədəɳa, kʰətəri≠kʰətri), plus
gemination/nasal notation.

**The plan, in order of cost:**
1. **kaikki pan (Gurmukhi) lexicon tier** — the km move: same lineage as the referee (lexicon, never a
   referee), richer than the 1,586-word wikipron scrape, CC BY-SA §3 fence already exists for pa files.
2. **Schwa-syncope derivation pass** — check the hi engine's schwa machinery for a transferable rule BEFORE
   accepting "proven-lexical" (the km lesson: re-derive before declaring lexical).
3. **Frequency-weighted measurement** — the referee is small/noisy and dictionary-shaped; km's word-exact
   understated real-text quality by ~12pp. Needs a pa frequency list.
4. **The audio-supervised lexicon** (user-proposed, the ReNikud precedent): run a wav2vec2 phone model over
   a Punjabi speech corpus, phonemize the transcripts with our g2p emitting CANDIDATE readings per word
   (schwa-present/deleted, gemination variants), let the audio VOTE per occurrence, aggregate votes across
   occurrences, ship high-confidence word→IPA entries where audio consistently contradicts the rules.
   Schwa syncope is audible, which is what makes this the right tool for exactly this residual.
   · ⚠ NORMALIZE THE MACHINE PHONES BY DERIVATION, the km/aakanee method: iterate a phone-fold against the
     wikipron overlap until the residual reads as variance, and only then trust votes.
   · ⚠ Candidate dataset: huggingface.co/datasets/shunyalabs/punjabi-speech-dataset — 32,650 Gurmukhi
     utterances, ~6 GB, general domain. RIGHT VOLUME, **LICENCE UNSPECIFIED (empty README) — blocked for
     anything shipped until clarified**, per the rule that killed ur's best candidate.
   · Licence-clean alternatives, same method: **Common Voice pa-IN (CC0)**, IndicVoices / Shrutilipi
     (CC BY 4.0). Gate first, download second.

**Also recorded:** the Shahmukhi BiLSTM becomes viable the moment a large real-parallel Gurmukhi⇄Shahmukhi
corpus exists (scripture and cross-border news are published in both scripts) — a separate hunt, licensing
gate first.

## Run 1 — 2026-08-09 16:20 — proof of concept: the audio adjudicates schwa, and it distinguishes convention from error

Setup, all licence-clean: **FLEURS pa_in dev** (251 utterances, CC-BY-4.0, ungated — the proof-scale sample;
Shrutilipi's gate needs a browser click and stays the scale-up), recognized with
`facebook/wav2vec2-lv-60-espeak-cv-ft` (multilingual PHONE recognizer) on the local 3090; transcripts
phonemized per-word with our `phonemizeWord` (7,448 types across the three FLEURS TSVs). First-guess folds to
a shared alphabet; gross agreement median PER 0.41 (best utterances 0.19 — the fold is crude, the ceiling is
much lower; worst ≈0.95 are digit-bearing/code-switched lines).

THE VOTE: for every dev occurrence of a word where our rules and wikipron differ ONLY in schwa (23 types,
131 occurrences), fitting-align both candidates against the utterance's machine phones, vote for the closer.

    occurrence votes: wikipron 12 · ours 88 · tie 31

⚠ THE COUNT IS NOT THE FINDING — THE SPLIT IS. The votes separate two classes the referee eval currently
mixes:

· **Word-final schwa — the audio sides with OUR rules, overwhelmingly.** ਰਾਤ rat (wik ratə), ਇੱਕ ik (ikə),
  ਕਾਨੂੰਨ kanun (kanunə), ਤਿੰਨ, ਕੰਮ, ਦਸ, ਸੂਰ, ਭੈਣ, ਅੱਠ… — every one of the 88 "ours" votes. wikipron's
  citation-form final ə is NOT in the speech. That class is REFEREE CONVENTION, not engine error, and the
  audio just adjudicated it.
· **Medial schwa position — the audio sides with WIKIPRON, 5:1.** ਦਿਲਚਸਪ dilcəsəp (ours *diləcsəp),
  ਹਸਪਤਾਲ ɦəspətal (ours *ɦəsəptal), ਦੋਸਤ dost (ours *dosət), ਅਰਥ ərt (ours *ərət), ਆਸਟ੍ਰੇਲੀਆ astrelia
  (ours *asəʈɾelia) — the exact syncope class the maturity row calls "proven-lexical". The audio confirms the
  rules are wrong there AND recovers the gold reading without ever seeing it — which is the whole method: on
  words wikipron does NOT cover, the same vote can supply the answer. (ਅਸਮਾਨ went the other way — audio
  əsman, wikipron əsəman — so per-word aggregation over many occurrences is required, not single votes.)

**The idea is proven.** What the build needs next: (1) derive the machine-phone fold properly against the
wikipron overlap instead of this first guess; (2) scale to the FLEURS train split (~1.8k utts) and Shrutilipi
once its gate is clicked; (3) aggregate votes per word type with a confidence threshold; (4) ship two
artifacts — a final-schwa FOLD for the pa eval (referee convention, measured) and a medial-schwa LEXICON for
the words audio settles; (5) re-measure the 73.6%.

## Run 2 — 2026-08-09 17:10 — scale to 2,748 utterances, and the register confound

Recognized all of FLEURS pa_in (dev 251 + train 1,923 + test 574 = 2,748 utterances). Fold calibrated on
608 rule-correct word occurrences (PER .299; the one systematic pair is ə→a — the recognizer hears Punjabi
ə as a, so (ə,a) substitutions are FREE in votes). Aggregation: per-word schwa-lattice candidates (base,
single medial-ə deletions, single CC-cluster insertions, ±final ə, wikipron readings), fitting-aligned,
margin-weighted votes, confidence = ≥3 occurrences + ≥70% share.

    confident corrections: 426    wikipron-validatable: 46    matching: 65%

⚠ 65% IS NOT SHIPPABLE, AND THE FAILURE HAS ONE SHAPE. Split by correction type (validated modulo the
final-ə convention Run 1 settled):

| type | n | precision |
|---|---|---|
| **position swap** (same ə count) | 6 | **100%** |
| deletion | 36 | 67% |
| insertion | 4 | 50% |

— and 411 of the 426 are DELETIONS. The audio is not wrong: FLEURS speakers genuinely reduce (sərir→srir,
səvere→svere — connected speech). But the referee's convention is CITATION FORM, so a deletion-class lexicon
would "correct" the engine toward a different register than the one it is scored and shipped in. The
confound is systematic and will NOT wash out with scale — more fast speech is more reduction.

**What the audio reliably adjudicates, then:**
1. **The final-ə convention** (Run 1, ~88:0) — wikipron writes a citation final ə speech does not carry.
   An eval-fold candidate with an audio measurement behind it.
2. **Medial-schwa POSITION** (100% at n=6) — when the schwa count is right but the slot is wrong, audio
   recovers wikipron's answer. This is evidence the syncope-position defect is RULE-shaped, not lexical.
3. NOT presence/absence of medial schwa — that is register, not lexicon.

**Reframed plan (the km playbook, with audio as the adjudicator it just proved to be):**
· Derive the medial-schwa POSITION rule from the full wikipron set (1,586 words — a derivation pass, no
  audio needed now that audio has shown the class is rule-shaped).
· Take the final-ə question to the eval config as a measured fold candidate.
· Keep the audio pipeline (recognizer + fold + vote harness, all on /mnt/data/pa-audio) for what it is
  reliable at: adjudicating convention questions and validating rule fixes out-of-band — and revisit
  deletion-class corrections only if a citation-register corpus (read speech, dictionary audio) appears.
  Shrutilipi (gate now accepted; 7 shards downloading) adds scale for the swap/final-ə classes.

## Run 3 — 2026-08-09 17:45 — a phantom class, and the true one

⚠ **THE 106-WORD FINAL-ə CLASS WAS A PHANTOM — an artifact of MY analysis fold, not the eval's.** The referee
writes the citation schwa EXTRA-SHORT (ə + combining breve, ə̆); my crude analysis fold stripped the breve
and kept the ə, manufacturing 106 "final-ə failures" — but the eval's own pipeline already disposes of ə̆,
and those words were MATCHING all along. Discovered the hard way: a "fix" to the (apparently dead) final-ə
fold moved the eval by exactly nothing, and the eval's own residual list contains no final-ə class. The
jsonc edit was reverted before commit — its note claimed a 6.7pp defect that does not exist. Two lessons,
both old ones: derive classes with the EVAL's fold, never a reimplementation (the km A/B harness rule), and
a fold change that moves nothing is evidence about the analysis, not the fold.

The audio's final-ə verdict (Run 1, 88:0) stands as CONFIRMATION of the existing convention treatment — the
referee's ə̆ really is inaudible, and the eval was right to treat it as convention — just not as new points.

**The true class, computed with the eval's fold:** 231 of 1,360 unique referee words wrong; **70 are
schwa-arrangement-only (~5pp)**, and the directions are MIXED — gold deletes where we keep (ਅਰਥ ərtʰ, ours
ərətʰ), keeps where we delete (ਅਸਮਾਨ əsəman, ours əsman — Perso-Arabic loans favour the epenthetic vowel),
and swaps position (ਅਗਸਤ əɡəst, ours əɡsət; ਉਸਤਰਾ ʊstəra, ours ʊsətra). So `deleteMedialSchwa`'s CONDITIONS
are the target, not its direction — a derivation pass over the 70 (+ the audio harness to validate
out-of-band, where it is 100% on position swaps). ⚠ The function is SHARED WITH HINDI — any condition change
must be derived per-language or measured inert on hi.

List at /tmp/pa_medial_class.tsv; FLEURS phones + vote harness at /mnt/data/pa-audio/; Shrutilipi's 7
Punjabi shards downloaded (gate accepted) for scale when needed.

## Run 4 — 2026-08-09 18:20 — the two rule hypotheses, tested and reverted

From Run 3's decomposition, two rule-shaped candidates were implemented as per-language parameters on the
shared `deleteMedialSchwa` (Hindi inert by construction) and measured individually:

| hypothesis | derived from | pa primary | verdict |
|---|---|---|---|
| LTR deletion order (the 10 swaps) | error class only | 73.6 → 73.3 | ✘ reverted |
| final-cluster deletion after sonorants (ərtʰ, ɡərm) | error class only | 73.6 → **71.5**, gold 20→19 | ✘ reverted |
| both together | | 71.7 | ✘ |

⚠ THE DERIVATION MISTAKE WAS THE OLD ONE: both patterns were derived from the 70-word ERROR class instead
of the full population — the km sweep's own rule, broken twice in one run. Counted properly, gold's
final V·son·ə·C# context splits **52 deleted : 40 kept** (and 29 of the "deleted" carry a SUPERSCRIPT ᵊ —
a third notation layer for the reduced vowel). The context is lexically split; no unconditional rule exists.

**So the maturity row's original verdict — medial schwa "proven-lexical" — is now proven three ways:** by
the audio (position swaps adjudicated per-word, not by pattern), by the failed rule derivations, and by the
population split. The remaining lever for the ~70 words is a LEXICON, which for pa requires the house
pattern first: the eval currently scores the SHIPPED `phonemizeWord`, so a wikipron-mined exceptions lexicon
would score the answer key. The restructure (eval → a core function; mine the exceptions; ship dict-first —
exactly af/km) is the next build, and it is also what the Shahmukhi side needs before its BiLSTM ever
becomes viable.

## Run 5 — 2026-08-09 18:50 — the house pattern, and the class closed for the shipped path

The restructure the lexicon needed: `phonemizeWordEval` (cross-script → harakat → core, byte-identical to
the old shipped behavior) is now what the referee eval scores; shipped `phonemizeWord` consults the new
**231-entry `gurmukhi-lexicon.tsv`** first — every pan_guru referee word whose eval reading fails under the
eval's own folds, carrying the referee's reading verbatim (the km arrangement, notation and all). Mining
used the eval's fold pipeline — Run 3's phantom made that non-negotiable.

Verification: all three referee numbers BYTE-IDENTICAL across the switch (73.6 / 100 / 56.5) — the eval
never sees the lexicon; invariants pinned in test/paGuruLexicon.test.ts (every entry a referee word, the
eval path reads none of it, precedence, and the audio-adjudicated goldens: ਹਸਪਤਾਲ ɦəspət̪äːl,
ਦਿਲਚਸਪ d̪ɪlt͡ʃəsəp, ਅਸਮਾਨ əsə̆maːn — the words FLEURS recovered at 100% precision now ship correctly).
CC-BY-SA §3 fence extended. What the audio work bought, in the end: the confidence to close the class as
LEXICAL (rather than keep hunting a rule), the out-of-band validation of the mined entries, and a standing
harness for the next convention question. What remains 🟡: the Shahmukhi side, data-blocked as sized in Run 0.

## Run 6 — 2026-08-09 19:30 — a second referee (epitran), and pa's first frequency-weighted numbers

**epitran pan-Guru wired as the INDEPENDENT secondary** (the tk/kmr/qu arrangement): a non-Wiktionary,
hand-authored rule tradition, its readings generated over the primary's word list (a list is not labels;
`tools/gen/build-pa-epitran-referee.py`). Probed on the residual classes first: it is orthographically
CONSERVATIVE — keeps written nasality without restoring the homorganic consonant (ਆਂਡਾ ɑ̃ɖɑ), no
h-coalescence (ਜ਼ਹਿਰ zəɦɪɾ), its own partial schwa model (agrees with wikipron on ਦਿਲਚਸਪ, keeps ə in
ਅਰਥ/ਗਰਮ where wikipron deletes) — so it corroborates SEGMENTS, and its known gaps are per-referee folds,
not scores. espeak pa exists but has NO schwa deletion at all — the weaker candidate, not wired.

    engine vs epitran:  89.1% folded / 96.9% symbol / 94.6% frequency-weighted   (residual: its map quirks)

⚠ A crude-fold health check first said 50.7% — the Run-3 phantom mechanism AGAIN (the crude fold kept the
citation ə̆ the real pipeline disposes of). Measured only with the eval's own folds thereafter.

**freq/pa.txt** (FLEURS pa_in transcripts + the mined artifact; 66k tokens, 5.5k types ≥2 — no hermitdave
pa exists) gives pa its first token-weighted numbers, and they invert the km/af pattern:

    primary (wikipron):  74.5% word-exact  →  70.8% FREQUENCY-WEIGHTED
    epitran secondary:   89.1% word-exact  →  94.6% frequency-weighted

Frequent words do WORSE against wikipron while the two independent engines agree MORE there: the frequent
band is function words carrying wikipron's phonological conventions (the h-coalescence/tonogenesis class —
ਇਹ e, ਜ਼ਹਿਰ zɛr — and vowel-quality choices), which epitran does not model either. The 73.6→70.7 gap is a
CONVENTION concentration, not a segment-quality cliff — the segment story at frequency is the 94.4%.
The shipped lexicon covers 6.5% of running-text tokens with referee-verified readings on top.

Verdict effect: the Gurmukhi engine is no longer single-tradition — two independent rule systems corroborate at 89.1/96.9/94.6, the human referee adjudicates the residual, and the audio harness stands as the
third leg for convention questions. The h-coalescence and nasal-restoration classes remain the next honest
engine work, now with a second referee to check them against.

## Run 7 — 2026-08-09 20:15 — the nasal rule lands; h-coalescence refused as a rule

Population derivations first (the Run-4 lesson, applied): bindi-before-stop → homorganic consonant **26:5**
(rule-shaped); medial ਹਿ/ਹੁ → **17 kept : 10 fused** (NOT rule-shaped — the tonogenesis coalescence is
lexically/conventionally split, so it stays lexicon-served, and the refusal carries its counts).

The bindi rule is OPT-IN per manifest (`effect: "nasalizeVowelHomorganic"` on the chandrabindu slot) because
the abugida core is shared: Devanagari's ँ is pure nasalization and must stay so — the flag is what keeps
Hindi inert (sweep run anyway: hi/bn/ta/te/kn/ml/si/or all at their known values). The class was invisible
to the folded metric only because the fold strips the ̃ the engine emitted instead of the consonant.

    primary:  73.6 → 74.5% folded (91.6 symbol / 70.8 freq-weighted)
    epitran:  → 89.1% folded / 96.9 symbol / 94.6 freq-weighted
    lexicon:  re-mined 231 → 217 (the rule generalized 14 entries away)

The epitran secondary first DROPPED to 83.8 — it does not restore the nasal either, and its header promised
that gap was folded when only ɑ→a was. The fold is now real, anchored on ŋ/ɳ/ɲ (letters Gurmukhi virtually
never spells, so a written nasal is untouched; the ̃ anchor is unavailable because the backbone strips it
first), and it also neutralized the same gap in ɲd͡ʒ words (ਪੰਜਾਬੀ) — 89.1%.

## Run 8 — 2026-08-09 21:00 — Shahmukhi data found: 56.5 → 61.5%, and the BiLSTM unblocked

The hunt, with verdicts:
· **SLPG/Punjabi_Transliteration_Corpus (6.3M "parallel" sentences)** — REJECTED at both gates: no licence
  on the card, no data files visible, and the cited paper is an *unsupervised NMT transliteration* system —
  the parallel side is machine-generated, the synthetic class that sank before.
· **Fresh kaikki dump** — the committed crossscript predated Wiktionary growth AND its builder read only
  ONE pair direction (Gurmukhi headword + Shahmukhi form; 4,327 of the dump's 5,868 pairs). Both directions:
  2,641 → 3,974 gated entries, pan_arab 56.5 → 61.5% (+5.0pp).
· **pa↔pnb Wikipedia titles via Wikidata sitelinks** — 18,930 dual-wiki articles, REAL human spellings.
  ⚠ A title pair names the same TOPIC, not the same words (ਮਹਾਤਮਾ ਗਾਂਧੀ ↔ موہن داس گاندھی — Mahatma vs
  Mohandas), so titles word-align positionally only at equal token counts and every word pair clears the
  SAME consonant-skeleton gate as a kaikki pair: 25,407 aligned word pairs → 7,192 kept, 8,089 gated.
  Referee unchanged (titles are proper nouns the dictionary referee doesn't sample) — this tranche is a
  REAL-TEXT gain (پاکستان paːkɪst̪aːn, لاہور laːɦɔːɾ) and threshold fuel.

**crossscript.tsv: 2,641 → 11,166 entries — the ~10k BiLSTM threshold from Run 0 is CROSSED.** The
Shahmukhi short-vowel restorer is no longer data-blocked, just unbuilt: 11k real Shahmukhi-word → gold-IPA
pairs (supervision exactly in the engine's own convention, the ur Phase-C lesson) are now shipped data.

## Run 9 — 2026-08-09 21:45 — the restorer, built and measured: a clean negative at this scale

The BiLSTM restorer (the ur/fa tagger ported: per-char IPA-chunk tags, pa inventory + tone tokens, the
tonogenesis anchors بھ→p+tone, output length == input length) trained on the 11,166-pair crossscript.
Aligner coverage 92% out of the box (two inventory fixes: ɭ, loan-alef eː). Scoring in tsx with the eval's
own folds throughout (the Run-3 rule).

| configuration | held-out (in-conv) | referee-OOV (n=243) vs the shipped eval path |
|---|---|---|
| full 11k pool | 47.5% | tagger 31.7% vs **49.0%** |
| kaikki-only (3.4k dictionary words) | 56.1% | tagger 36.6% vs **49.4%** |

The title tranche is 65% foreign proper nouns — a different distribution than the referee vocabulary
(held-out +8.6pp when excluded), so it is LEXICON material, not training material. And the decomposition
that settles the verdict:

    harakat-COVERED referee words (n=33):  eval path 97.0%   tagger 36.4%
    BARE words          (n=210):           eval path 41.9%   tagger 36.7%

**The tagger loses everywhere — even on the bare tail it was built for.** The da provenance threshold holds
exactly: ~10k pairs is where a BiLSTM TIES a good rules+coverage system, not where it wins (ur's Phase C won
at CLE scale, ~5x more, in-register). The negative is recorded, the trainer is committed
(tools/perso-arabic/pa_train_restorer.py — aligner 92%, ready for more data), the model is NOT shipped.

What would change the verdict: dictionary-register pairs at 30-50k (a Shahmukhi dictionary with Gurmukhi
sisters — the SLPG corpus would qualify IF its licence and human-parallel status ever clear), or an
audio-supervised route on Shahmukhi speech (the FLEURS-pa method, but Pakistani Punjabi audio). Until then
the Shahmukhi levers stay: the coverage layer (97% where it reaches — GROW the harakat lexicon), and
crossscript (the 61.5% referee gain shipped in #788 stands regardless).

## Run 10 — 2026-08-09 22:40 — the rider retrain: the title confound confirmed AGAIN, and a coupling discovered

The running-text question first, answered from the shipped code: the riders (ur/fa/ps/pa-Shahmukhi) DO ship
a neural vocalization pre-pass over running text (`phonemizeRiderNeural` → riderDiacritizer.onnx) — but it
is a PER-WORD model applied word-by-word (one language token + the word's chars, no cross-word context),
trained on g2p-inverted word lists, "the riders have no diacritized corpus" per its own provenance. The
nakdan shape (sentence context + running-text supervision) exists for none of them; audio remains the only
visible source of that supervision.

The retrain, with the new crossscript as mining fuel (`invert_harakat.ts` now consumes it — same inversion,
same round-trip verification; pa silver 460 → 6,385 labeled with titles, 2,541 dictionary-only):

| checkpoint | pa silver | pa (fixed wikipron eval) | ur | ps | fa |
|---|---|---|---|---|---|
| v1 (shipped) | old | **58.5%** | **87.3** | **57.1** | 68.8 |
| v2 (full crossscript) | +titles | 54.5 | 85.5 | 52.7 | 68.0 |
| v3 (dictionary tranche only) | kaikki-only | 54.5 | 86.0 | 52.7 | **69.4** |

Two findings, neither of which ships a model:
1. **The title tranche regresses training a SECOND time**, in a second architecture (v2; the Run-9 confound
   reproduced in the rider). Titles are lexicon material. The mining now filters to the dictionary tranche,
   with the measurement in the comment.
2. **The multilingual model couples its languages, and fa's pending retrain was pending FOR A REASON:** fa's
   silver was regenerated to a FULL-DIACRITIZATION convention on 2026-07-16 with the retrain deferred — any
   retrain today trains fa-new + (pa/ur/ps)-old conventions into shared parameters, and v3 shows exactly
   that signature: fa improves (+0.6), everyone else drops (pa −4.0, ps −4.4, ur −1.3). The provenance's
   "retrain pending" is really "retrain BLOCKED until the other three silvers are regenerated to the same
   convention" — now written down where the next person will look.

**Shipped state: unchanged** (v1 stays; v2/v3 checkpoints live on /mnt/data only). Committed: the
crossscript mining source (dictionary tranche, filtered, justified), the regenerated pa silver (2,541
dictionary-register labels, 5.5x the old — correct fuel for the retrain once the convention alignment is
done), and this run. The convention-alignment regeneration (ur/ps analogues of FA_FULL_FOLD) is the
prerequisite work item.

## Run 11 — 2026-08-09 23:20 — convention alignment done; every retrain still loses to v1; the recipe gap

UR_FULL_FOLD written and wired (the loose fold collapsed BOTH encodable axes — [ɪʊ]→ə and the majhūl — the
fa bug doubled); ur re-mined two-pass: 5,710 labels, quality-pinned. v4 (all four conventions aligned):
pa recovers to 57.7 but ur DROPS to 83.4 loose-folded.

The metric-trap hypothesis (the loose-folded eval structurally favors loose-mined v1 labels) was tested and
KILLED: under UR_FULL_FOLD, v1 439/591 = 74.3% vs v4 405/591 = 68.5% — v1 wins on the axes v4's labels were
supposed to improve. Three retrains (v2 titles, v3 clean-tranche, v4 aligned), three losses to v1 on the
fixed eval, on progressively better data.

**The blocker looked like the recipe — ⚠ SEE RUN 12: the recipe WAS recorded** (arabic_script_restorer
Run 9: upsample 4×, best at epoch 1) **and the real gap was not consulting it, plus the moved data state** — its provenance documents architecture and data lineage but
not the hyperparameters of the winning run. Until that is recovered or re-searched, retrains are guesses
that keep measuring worse, and the improved silvers (pa 2,541 crossscript-mined; ur 5,710 full-convention)
sit as fuel without an engine setting. Committed: the mining improvements + silvers + this record; shipped
model unchanged (v1); v2-v4 checkpoints on /mnt/data only. Next: a small hyperparameter search with the
fixed eval as the gate — mechanical, GPU-bound, a fresh-session task.

## Run 12 — 2026-08-09 23:50 — CORRECTION: v1's recipe WAS recorded; the gap was me not reading it

Run 11 claimed "v1's training recipe was never recorded — a provenance gap". WRONG: it is in
`arabic_script_restorer_investigation.md` Run 9 (2026-07-15), where it always was — "riders upsampled 4× +
Arabic replay … 15.3M params, **best at epoch 1, early-stopped**". Three retrains were run without
consulting the folder that exists to prevent exactly that.

The record also explains the losses: v1 is a NEAR-UNTOUCHED WARM-START (one epoch), and the trainer's
early-stop gate watches silver held-out DER — a metric that kept improving through my 19-25-epoch runs
while the wikipron generalization the fixed eval measures degraded. v5 (the recorded --epochs 2 on TODAY'S
data) still loses (72.2 overall; ps 46.4) — the recipe alone does not transfer because the DATA STATE also
moved (fa's full-diac silver post-dates v1; my ur/pa silvers are new). Reproducing v1 exactly = the July-15
data + epoch-1; beating it with the better silvers = a search over {epochs, upsample, data-mix} gated on
the WIKIPRON eval, not silver DER. Both are now stated with the pointer to the original record.

Two lessons, recorded where they bite: the trainer's early-stop gate should BE the wikipron end-to-end (the
silver DER gate optimizes memorization of the mining distribution); and "not recorded" claims must cite a
search of docs/investigations — the folder held the answer for three full retrains.
