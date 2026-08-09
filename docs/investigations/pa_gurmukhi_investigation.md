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

    engine vs epitran:  84.0% folded / 95.1% symbol / 94.4% frequency-weighted   (residual: its map quirks)

⚠ A crude-fold health check first said 50.7% — the Run-3 phantom mechanism AGAIN (the crude fold kept the
citation ə̆ the real pipeline disposes of). Measured only with the eval's own folds thereafter.

**freq/pa.txt** (FLEURS pa_in transcripts + the mined artifact; 66k tokens, 5.5k types ≥2 — no hermitdave
pa exists) gives pa its first token-weighted numbers, and they invert the km/af pattern:

    primary (wikipron):  73.6% word-exact  →  70.7% FREQUENCY-WEIGHTED
    epitran secondary:   84.0% word-exact  →  94.4% frequency-weighted

Frequent words do WORSE against wikipron while the two independent engines agree MORE there: the frequent
band is function words carrying wikipron's phonological conventions (the h-coalescence/tonogenesis class —
ਇਹ e, ਜ਼ਹਿਰ zɛr — and vowel-quality choices), which epitran does not model either. The 73.6→70.7 gap is a
CONVENTION concentration, not a segment-quality cliff — the segment story at frequency is the 94.4%.
The shipped lexicon covers 6.5% of running-text tokens with referee-verified readings on top.

Verdict effect: the Gurmukhi engine is no longer single-tradition — two independent rule systems
corroborate at 84/95/94.4, the human referee adjudicates the residual, and the audio harness stands as the
third leg for convention questions. The h-coalescence and nasal-restoration classes remain the next honest
engine work, now with a second referee to check them against.
