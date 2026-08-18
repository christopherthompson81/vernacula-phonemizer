# asr-align — validating the phonemizer against AUDIO

`tools/referee-eval` asks whether our IPA agrees with **other people's IPA**. This asks whether it agrees
with **what a speaker actually said**, by running a multilingual phone recognizer over FLEURS audio and
comparing the recognized phones against our phonemization of the same utterance's transcript.

    input text  ->  our IPA                              what we would train on
    audio       ->  recognized phones (wav2vec2)         what was actually said

It is the fourth sourcing tier `tools/corpus/README.md` already names — the corpus's own audio — used for
validation rather than for sourcing.

## Why it lives here

It was written in a sibling corpus repo and moved because everything it finds is a **phonemizer** fix. In
one day it produced: the Afrikaans lexicon losing 198 entries, the sr/hr/bs stress and pitch-accent work,
the Ijekavian ⟨ije⟩ nucleus mismatch, and the recognizer-inventory fold below. Each became a PR here, and
a fix and its evidence should be able to land in one commit.

Living apart also cost something concrete. Two FLEURS downloaders drifted, and each ended up with half of
one fix: the committed `tools/corpus/fetch-fleurs-audio.py` verified against the REMOTE SIZE (so a short
file is re-fetched), while the sibling had a stall watchdog after an eleven-hour silent hang. Both halves
are now in the committed one.

## ⚠ This is a COARSE detector of SERIOUS disagreement

Not a mechanism for realigning vowels. The recognizer has its own error rate and its own espeak-flavoured
inventory, which is why every utterance is scored against **its own language's** median (3×MAD), never an
absolute threshold. A language the recognizer finds hard is absorbed by that, not flagged by it: `km_kh`
sits at median 0.480 and still flags 3.7% of its utterances — more than `gl_es` at 2.8%, whose median is
0.108. A high median is not a defect to engineer away.

What comes out is a *candidate* queue that splits three ways — our bugs, reader divergence, and recognizer
artefacts — and only the first is ours to fix.

## The recognizer cannot hear 3.67% of what we write

Measured over 221,469 aligned utterances: 30 phones we emit ≥2,000 times each are returned by
`wav2vec2-xlsr-53-espeak-cv-ft` less than 1% as often — 902,870 tokens.

    ʋ 158956/0   ɫ 90312/0   ɦ 76815/0   ʈ 66306/0   ʂ 46938/0   ɖ 41067/0
    ɳ 38765/0    ɓ 33146/0   ɗ 23654/0   ɽ 5120/0    ʄ 3962/0    clicks 11344/0

`COARSEN` in `asr_align_report.py` folds them onto what the recognizer does write, on BOTH sides. Median
across 84 languages 0.366 → 0.349, and **nothing got worse**.

Two folds were proposed and refused, both recorded at the fold site so they are not re-proposed:

- **`c → tʃ`** — Khmer made `c` look unhearable (ours 1731, recognizer 10 there). Corpus-wide the
  recognizer writes it 10,292 times against our 49,987. It is emitted, and `tʃ`/`dʒ` are contrastive.
- **dropping `ʔ`** — the recognizer hears it barely better (737 against 120,940), but the largest defect
  this corpus ever had was Kazakh ⟨ь⟩/⟨ъ⟩ emitting a spurious glottal stop in 408 rows. Folding it away
  deletes the evidence for that class. Measured 1.8:1 against 4.6:1 for keeping it.

## Layout

| file | what it answers |
|---|---|
| `phonemize-fleurs.mts` | run THIS repo's engine over FLEURS transcripts → `byid/<lang>.tsv` |
| `asr_align_corpus.py` | GPU pass: audio → recognized phones, into SQLite beside our IPA |
| `asr_align_report.py` | the scoring — `fold`, `coarsen`, `dist`, and the per-language 3×MAD queues |
| `asr_align_label.py` | the durable record: `status` on each row (verified / investigate / defective_audio) |
| `scan_silent_audio.py` | measures the WAVEFORM — the one defect the phone comparison cannot see |
| `consonant_skeleton.py` | consonant-only distance; `--validate` scores it against the full distance |
| `confusion_pairs.py` | which phone substitutions dominate, investigate vs verified |
| `judge_alignment.py` | optional LLM adjudication of the queue (local endpoint) |

## Running it

Needs a CUDA torch env (`soundfile`, `torch`, `transformers`) and the FLEURS audio tree. ⚠ A CPU-only venv
imports cleanly and runs the whole pass on the CPU with no error at all — check `cuda.is_available()`, not
just that the import worked.

```bash
export ASR_ALIGN_ROOT=/path/to/corpus         # default: /mnt/data/omnivoice_ipa
npx tsx phonemize-fleurs.mts <lang>...        # ⚠ never --limit: it slices then WRITES, truncating the file
python3 asr_align_corpus.py --langs <lang>... [--redo]
python3 scan_silent_audio.py <lang>...        # before label: it reads silent_audio.tsv AT IMPORT
python3 asr_align_label.py --apply
python3 asr_align_report.py --langs <lang>...
```

⚠ **Order is load-bearing and every stage fails silently if skipped.** No IPA → the aligner scores every
utterance 1.0. No label → rows sit at `status NULL`, invisible to any exclusion gate and indistinguishable
from "no defects found". Sweep before label, never after.

## What deliberately stayed in the corpus repo

`build_webdataset.py`, `sampling_budget.py`, `exclude_defective.py`, `corpus_filter.py`, `ingest_fleurs.py`,
`publish_hf*.py` — these answer *which pairs do we train on*, which is training-corpus policy, not
phonemizer correctness. They consume this tooling's output the same way they consume any other referee.
