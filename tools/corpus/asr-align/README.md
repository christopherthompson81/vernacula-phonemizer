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

## The sibling screen — 77% of the queue is not about our IPA

FLEURS records the same sentence more than once, with different readers, and our IPA for a sentence is a
pure function of its text: those recordings are scored against a **byte-identical string**. So when one of
them lands inside the bulk and another in the tail, the IPA cannot be the difference. That is a
construction, not a judgement, and it is the only thing here that can say "not ours" with certainty.

    8,367 flagged  ·  7,191 have a same-text sibling  ·  6,442 exonerated by one  =  77.0%

Two recordings of one sentence, one identical IPA string, differ by as much as **0.73** — larger than most
of the signal the unscreened queue carried. `asr_align_report.py` therefore drops exonerated rows from
`investigate.tsv` by default (`--with-exonerated` keeps them) and writes the verdict as a `sibling` column;
`asr_align_label.py` stores the same verdict on the row. Three values:

| `sibling` | meaning |
|---|---|
| `exonerated` | a same-text sibling scored inside the bulk — our IPA is demonstrably not the cause |
| `all-flagged` | **every** recording of this sentence is flagged — the strongest signal in the corpus |
| `no-sibling` | recorded once; the screen has nothing to say |

⚠ **Read `all-flagged` first.** Its 689 rows are where multiple independent readers all disagree with the
same IPA. Reading `de_de`'s produced both German defects found so far — the year reading, and the
uppercase-only `°C` rule.

⚠ **And this is why per-language totals mislead.** `bn_in` led the queue at 12.7% of its split; **379 of
its 382 flags are one gender**, against 0.33% for the other. Corpus-wide there is no gender effect at all
(3.46% female vs 2.66% male, 55 of 101 languages skewing female), and the skew runs both ways — `en_us`,
`kn_in`, `pt_br` are male-skewed. `hu_hu` settles it: its female median distance is *better* than its male
(0.303 vs 0.342) and female rows still supply 293 of its 313 flags. A phonemizer does not know who read
the sentence. Gender is standing in for speaker here; the sibling screen is the exact version of the
same argument.

## ⚠ The recognizer is not independent of espeak

`wav2vec2-xlsr-53-espeak-cv-ft` — note the **espeak** in the name — is fine-tuned to emit espeak phoneme labels. So when its output agrees
with espeak's convention for a language, **that is one source, not two**, and citing "espeak says X and the
recognizer says X" as corroboration double-counts. This is the same error as treating wikipron and kaikki
as two referees when both are en.wiktionary.

It is not simply replaying espeak per-language, though. espeak's Kyrgyz voice writes `ɑ`, Kyrgyz has a
voice and is a CommonVoice language, and the recognizer still returns `a` 86.2% / `ɑ` 2.1% there — so it
looks like one pooled acoustic mapping rather than a per-language convention. Both facts matter:

- Its evidence is **strongest where espeak has no voice at all** (`nso`, `st` — check with
  `espeak-ng --voices`), because then no convention could have been learned.
- Its evidence is **weakest against a written tradition espeak disagrees with**, because there the
  recognizer and espeak are the same witness.
- It has a **frequency prior**: it writes `a` 3.58M times against `ɑ` 151k corpus-wide. Treat a bare
  preference for the commoner symbol as weak, and look for the fr/de/pt-style control showing it resolves
  the contrast where one genuinely exists.

Worked through in `docs/investigations/low_vowel_notation_investigation.md`, which proposed three language
changes on recognizer evidence and then withdrew all three on this basis.

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
| `read_text.py` + `.mts` | the text the phonemizer ACTUALLY READ — `read_text`, `read_text_src` (auto/hand) |
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


## `read_text` — what was actually read

⚠ **`utt.text` IS THE FLEURS TRANSCRIPT, NOT THE PHONEMIZER'S INPUT**, and the schema comment used to say
otherwise. The corpus pass repairs the text before reading it — `restoreInitialismCasing` →
`restoreAbbreviationDots` → `restoreNguniConcordAcronyms`, then the numeral register — and that repaired
string was transient. So `ipa` was derived from a string the database did not hold. **19,511 of 270,106 rows
(7.2%)** differ, so this was not a corner case: for 7% of the corpus the `(text, ipa)` pair a trainer reads
was internally inconsistent.

`read_text` stores it. `read_text_src` is `auto` for the derived repair and `hand` for a human edit, and the
auto pass **skips `hand` rows entirely** — not merely declining to overwrite them, but never recomputing
them — so a correction survives every re-run. Same guarantee `apply_auto` gives a hand verdict in `status`.

⚠ **AND IT IS WHERE A READER'S JUDGEMENT LIVES.** A phonemizer reads the text it is given; it cannot make
the choices a reader makes. Maltese `8:46 ta' filgħodu` is read *fid-disgħa nieqes kwart* — quarter TO nine,
which needs rounding :46 to :45 *and* incrementing the hour. No rule should invent that, and
`maltese/normalize.ts` deliberately does not. The row now carries the reading as a hand-authored
`read_text`, which is the only place it can correctly live:

    text       preċiżament fit-8:46 ta' filgħodu …
    read_text  preċiżament fid-disgħa nieqes kwart ta' filgħodu …
    src        hand

### Code-switching — `{en:nineteen forty five}`

A reader who voices part of a sentence in ANOTHER language cannot be recorded as plain `read_text`: the
host re-reads the spelling with its own rules. `mi` passes `nineteen` through as raw LETTERS into the IPA;
`ceb` gives *ninetˈeʔen fˈoɾtj fˈibe*. IPA cannot go there either — see the espeak/IPA section above.

So `read_text` accepts an inline span carrying **text and a language**, never phones, and each segment is
read by the engine that owns it:

    text       miapil siya sa team kaniadtong 1945 ug nagpabilin hangtod 1958
    read_text  miapil siya sa team kaniadtong {en:nineteen forty five} ug nagpabilin hangtod {en:nineteen fifty eight}
    ipa        … kaniʔˈadtoŋ nˈaᶦntˈiːn fˈɔːɹt̬i fˈaᶦv ʔˈuɡ naɡpabˈilin hˈaŋtod nˈaᶦntˈiːn fˈɪfti ˈeᶦt
    dist       0.6634 -> 0.2727   (sibling row: 0.6716 -> 0.3521)

⚠ **This is the PER-ROW form of `numeral_register.mts`, and that is the whole point.** The register table
answers for a whole language, which is why ceb/fil/mi/ig were measured at 62–85% and DECLINED — a third of
their rows read natively and would get worse. A span is a fact about one recording, so it costs those rows
nothing.

⚠ **It carries text, never phones, so the row still tests the phonemizer.** Hand-written IPA would make the
row permanently unfailable — worse than a wrong row, because it is a wrong row that looks right forever.
Every segment still reaches an engine.

⚠ **An unknown tag is an error, not literal text.** `{xx:…}` throws rather than sending braces through the
host g2p.

### The review ledger — the verdicts, in the repo

Everything else here can be rebuilt: `phonemize-fleurs.mts` re-derives the IPA, `asr_align_corpus.py`
re-runs the recognizer, `asr_align_label.py --apply` re-labels in bulk. **Two things cannot**, because they
are somebody's judgement rather than a computation — a hand `status` and a hand `read_text`.

And `asr_align_corpus.py` ingests with `INSERT OR REPLACE INTO utt(...)`, which replaces the **whole row**.
A re-ingest erases every verdict and every hand reading, and until now nothing outside the database
remembered them.

```bash
python3 review_ledger.py --export     # DB  -> review/hand_review.tsv   (commit the diff)
python3 review_ledger.py --import     # TSV -> DB                       (after a rebuild)
python3 review_ledger.py --check      # report drift, write nothing
```

⚠ **The ledger is the judgement, not the corpus.** `align.sqlite` is 337 MB over 270,106 rows and 102
languages (text 32 MB, ipa 42 MB, phones 53 MB; ~19 MB each compressed) — dataset-sized, not
repository-sized, and it belongs on Hugging Face beside the corpus tooling that already publishes there.
Of its bulk columns, `text` is re-fetchable from FLEURS, `ipa` is an hour of CPU, and **`phones` is the
only one whose recomputation needs a GPU and a ~30 GB audio download** — that is the artefact worth
publishing. What belongs in git is the part nobody can recompute.

`review/hand_review.tsv` holds 138 rows: 135 hand verdicts (`reader_divergence` 78, `examined_clean` 50,
`defect` 6, `convention` 1) and 40 hand readings, 37 of them carrying code-switch spans. The `text` column
is context so the diff is reviewable — `--import` verifies it and never writes it, so a ledger from a
different corpus version announces itself instead of applying quietly.

⚠ **`--import` does not touch `ipa`.** A restored `read_text` sits beside whatever IPA the rebuild derived,
which is the auto reading — re-derive afterwards with `--export-hand` / `rederive_read_text.mts` /
`--import-ipa --overwrite`.

⚠ **The cost of not having this is already on the record.** Run 42 found three of the all-flagged queue's
top five had been read and found clean with only a prose table as the mark, and run 54 then re-walked a
decision that had been measured, documented and declined. That is the failure with the database intact.

### Publishing the measurements — `export_hf_align.py`

The ledger keeps the judgement in git; this puts the measurements where they belong. Per-language JSONL
matching the sibling dataset's `data/manifest_<lang>.jsonl` naming, so the two share a layout without
colliding:

```bash
python3 export_hf_align.py --out /tmp/hf_align --gzip
# 270,106 rows across 102 languages -> 68 MB gzipped, ~17 s
```

Ranked by what it costs to lose:

| column | exported | why |
|---|---|---|
| `phones` | ✅ | **the one that matters** — a GPU pass over 270k utterances against a ~30 GB FLEURS audio tree |
| `ipa` | ✅ | ours, and re-derivable in ~1 h of CPU, but pinned so the published `phones` keeps the exact IPA it was scored against |
| `status`/`comment`/`read_text` | ✅ | so a dataset consumer sees the QC verdicts; `review/hand_review.tsv` stays the authority |
| `text` | ❌ | FLEURS', and the sibling card already declines to redistribute FLEURS-owned content. `sentence_id` joins back |

⚠ **The sibling dataset is the TRAINING corpus, not this.** `omnivoice-ipa-corpus` is 28 languages / ~77k
utterances of `(ipa → codec tokens)` pairs. This is 102 languages / 270k rows of QC measurement. Same
provenance and same owner, different scope and purpose — worth deciding deliberately whether it lands
there under an `align_` prefix or in a sibling dataset repo.

### Re-deriving `ipa` after a hand edit

`--set` clears `ipa`, which removes the row from scoring (every scorer filters `ipa IS NOT NULL`) until it
is re-derived — and until now **nothing re-derived it**, so hand corrections parked their rows permanently.
`phonemize-fleurs.mts` cannot do it: it reads the FLEURS TSV and never sees a hand `read_text`.

```bash
python3 read_text.py --export-pending /tmp/pending.tsv
npx tsx rederive_read_text.mts /tmp/pending.tsv /tmp/ipa.tsv
python3 read_text.py --import-ipa /tmp/ipa.tsv        # only fills rows whose ipa IS NULL
```

```bash
python3 read_text.py --apply [lang…]                 # derive and store the auto repair
python3 read_text.py --set mt_mt <wav> "<reading>"   # record what the reader actually said
python3 read_text.py --stats
```
