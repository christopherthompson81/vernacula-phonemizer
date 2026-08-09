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
