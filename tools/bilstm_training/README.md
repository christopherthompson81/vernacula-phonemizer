# `bilstm_training` — the shared char→IPA-chunk tagger

The common core of the four **g2p tagger** trainers: Norwegian, English, Danish, French. Each of those
produces a shipped `<lang>-g2p-tagger.onnx` + `.meta.json` read at runtime by `src/core/structuralTagger.ts`.

| | |
|---|---|
| `align.py` | multiprocess hard-EM grapheme→phone-chunk alignment (`align_parallel`, `SEP`) |
| `tagger.py` | `Tagger` (2-layer BiLSTM), `build_vocab`, `encode`, `train`, `decode_chunks` |
| `smoke_test.py` | CPU-only, seconds; run by `test/bilstmTraining.test.ts` |

## The seam

Shared: alignment, vocab, encoding, the model, the training loop, and the masked argmax decode.

Per-language, and staying that way:

- **`load()`** — lexicon path, file format, charset filter. Every language has its own.
- **`split()`** — held-out policy. Three use an md5 10%; English uses `EN_FREQ` to train on the
  frequency-common words and hold out the rare/proper-noun tail, which is the actual OOV target.
- **assembly of the decoded chunks** — this is why `decode_chunks` stops at "list of chunk strings"
  rather than returning a pronunciation. Norwegian joins then applies `one_stress()`; English splits each
  chunk on `SEP` back into ARPABET tokens; Danish and French concatenate.
- **the eval metric** — exact-match, Levenshtein symbol accuracy, stress-independent word accuracy.

## `SEP` is a module global, and callers set it

`align.SEP` joins a two-phone chunk. It has to be a module global because the Pool workers inherit it
through `fork()`; there is no per-call override.

```python
from bilstm_training import align
align.SEP = " "   # multi-CHAR phone alphabet — English ARPABET: "K"+"S" → "K S"
align.SEP = ""    # single-codepoint phones (the default) — IPA: "e"+"ɪ" → "eɪ", "ɔ"+"̃" → "ɔ̃"
```

Set it *before* calling `align_parallel`, and reset it if you are aligning twice in one process.

## Hyperparameters are provenance

The committed `.onnx` files were trained at specific settings, so each trainer passes its own explicitly
instead of leaning on a default. Changing a default here does not silently change what a retrain produces;
changing a call site does. `smoke_test.py` asserts these, so a drift is a test failure rather than a
model that no longer reproduces.

| trainer | `hid` | `batch` | `log_every` |
|---|---|---|---|
| `norwegian/train_nb_bilstm.py` | 128 | 128 | 5 |
| `english/en_g2p_bilstm.py` | 256 | 256 | 5 |
| `danish/da_bilstm.py` | 256 | 256 | 10 |
| `french/fr_g2p_bilstm.py` | 256 | 256 | 10 |

## Importing it

These are scripts, not an installed package, so each trainer puts `tools/` on the path first:

```python
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))   # must precede the import below
from bilstm_training import align              # noqa: E402
from bilstm_training.tagger import DEV, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402
```

The ordering is load-bearing and the `noqa: E402` is deliberate. `fr_g2p_bilstm.py` previously had the
import *above* its `sys.path.insert` and could only run with the path already set — committed, and unable
to start. `test/bilstmTraining.test.ts` imports all four from the repo root to keep that from recurring.

## Not in scope

~24 other files under `tools/` define a BiLSTM — Khmer boundary segmentation, Hebrew niqqud, Persian
context/seq2seq, Sindhi, Bengali, perso-arabic harakat. Same architecture family, **different I/O
contracts**. Folding them in here would mean parameterising over five task shapes, which costs more
readability than the duplication does. They are deliberately left alone.

## Provenance

`align.py` was extracted from `tools/norwegian/nb_tagger_parallel.py`, where the generic aligner sat beside
a Norwegian-specific averaged-perceptron baseline — so en/da/fr were importing that whole module, and its
Norwegian loaders, to reach one function. The DP and smoothing constants are unchanged, so alignments are
identical to the pre-extraction ones (verified: French still aligns 112663/112673 to 43 chars / 80 tags).
`nb_tagger_parallel.py` keeps its perceptron baseline and now imports the aligner from here.
