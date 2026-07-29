# One-off per-language validation

Scripts that check ONE language against an external source or benchmark the systematic harness
(`../referee-eval/`) does not model — a programmatic G2P to call, a published benchmark, a prosody
gold, or a holdout experiment. The split is deliberate: `referee-eval/` is a uniform
config-driven harness with regression floors; this directory is where a language's *specific*
question gets its own measurement.

Two are **live test infrastructure**, imported by the suite rather than run by hand:

- `ja-pitch-eval.mts` → `test/japanese-pitch.test.ts`. Scores our pitch-accent nuclei against
  `ja_pitch_reference.tsv` (OpenJTalk accent positions over content words; modified BSD).
- `sv-accent-eval.mts` → `test/swedish-accent.test.ts`. Scores our tonal accent 1/2 against the
  wikipron ¹/² markers, excluding homographs.

Run by hand:

- `ja-openjtalk-validate.mts` — our Japanese reading vs pyopenjtalk over Tatoeba sentences.
- `ja-counter-validate.mts` — Japanese counter readings vs an OpenJTalk-derived gold.
- `cmn-cedict-validate.mts` — Mandarin char/phrase readings vs CC-CEDICT (independent of the
  pypinyin-derived shipped tables).
- `cmn-g2pm-context.mts` — polyphone disambiguation vs the g2pM CPP benchmark.
- `my-tone-eval.ts` — Burmese tone vs the wikipron/kaikki referees (the segmental folds hide tone).
- `de-morpheme-holdout.mts` — German compound experiment: morpheme-keyed vs whole-word lookup on
  referee words with a known answer.

Usage is `npx tsx tools/eval/<script>` from the repo root. Nothing here writes into `src/`.
