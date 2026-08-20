# `da-g2p-tagger.int8.onnx` provenance

A per-grapheme **BiLSTM** sequence-labeller mapping a bare OOV Danish word → canonical IPA — the neural **OOV** tier for
Danish (`phonemizeDaNeural`; inference via the shared `createWordStructuralTagger` in `danishTagger.ts`). It labels each
letter with one IPA-chunk tag in a SINGLE forward pass, replacing the rule g2p (`phonemizeWordRules` in `danish.ts`) on
words the ~37k shipped lexicon (NST ∩ top-50k freq) misses. Danish emits IPA directly in the NST **narrow** convention,
so the tagger is a **thin wrapper over the shared factory**: a lowercase+NFC preprocess and the shared `oneStress`
postprocess (the stress mark is in the tag alphabet, and per-position argmax has no global stress constraint, so a raw
reading can carry zero / doubled / multiple primaries — normalise to exactly one ˈ, like nb; length ː / stød ˀ are not
stress marks and stay). A per-letter consonant mask (`charTags`) keeps every output plausible; an out-of-vocab letter
(e.g. Cyrillic) declines ("") and the word falls back to the sync rule engine.

**Why a tagger — and why it replaced the perceptron.** Danish is the deepest European orthography; vowel quality,
soft-d/g, reduction, length, and stød are barely recoverable by rule. The previous OOV tier was an averaged perceptron
trained on a 7.5k-word Wiktionary lexicon, where it merely *tied* the rule engine (a documented data-starvation: a
hand-featured perceptron is competitive with a BiLSTM below ~10k pairs). Swapping in the 199k NST lexicon
(Nasjonalbiblioteket / Språkbanken, sbr-26, CC0) un-starves a BiLSTM. On a CLEAN NST 90/10 md5 held-out (19,831 words):

| model (held-out) | WORD-exact | symbol accuracy (1−PER) |
|---|---|---|
| averaged perceptron (7.5k lexicon) | ~45.5% | 82.0% |
| **BiLSTM tagger (this model, full 199k NST)** | **78.7%** | **96.6%** |

## 2026-08-19 — retrained with PACKED sequences

Training ran the BiLSTM over padded batches without `pack_padded_sequence`, so the backward direction crossed
the padding before reaching each word's last symbol, while serving is batch=1 and unpadded — damage at the END
of the word. Same corpus, same split, same seed; see `tools/bilstm_training/tagger.py` and investigation Runs
41, 43, 47.

| | word-exact | symbol |
|---|---|---|
| unpacked training | 73.1% | 95.7% |
| **packed training (this model)** | **78.7%** | **96.6%** |

**+5.6pp word-exact — the largest gain of the fleet-wide rollout.** ⚠ The pre-fix baseline reproduced the
historical 73.1%/95.7% EXACTLY from a re-fetched NST corpus (which also rebuilt `da-lexicon.tsv`
byte-identically), so the delta is the packing and nothing else.

⚠ **The `int8` is what ships and the trainer does not write it.** `da_bilstm.py` exports fp32; `danishTagger.ts`
loads `${basename}.int8.onnx`. A production run therefore prints a confident `exported →` line while leaving
the served model untouched — it was still dated 25 July after this retrain. Quantized separately, 398/400
argmax parity. Same trap as fr and en.


It reads the whole narrow convention from spelling — **r-vocalisation** (`snurretop → ˈsnuːɐˌtɐb`), **stop lenition**
(`-top → [tɐb]`, `kat → ˈkad`), **soft-d** `ð`, **length** `ː`, and **stød** `ˀ` — none of which the rule engine emits.

## Data + training

- **Corpus:** NST Danish pronunciation lexicon (`dan030224NST.pron`, ISO-8859-1, `;`-separated, field 0 = word,
  field 11 = X-SAMPA), Nasjonalbiblioteket / Språkbanken, **CC0 / public domain**. `tools/danish/build_da_nst.py`
  (X-SAMPA→IPA, narrow; for multi-variant words it picks the fewest-phonemic-segments form but breaks ties toward the
  richest stød+length, so the narrow marks the convention exists for are preserved) emits two artifacts: the tagger's **full ~199k training set** and the
  **shipped ~37k lexicon** (the training set ∩ the top-50k OpenSubtitles-da frequency list, hermitdave FrequencyWords,
  CC BY-SA). The tagger trains on the FULL set (a trimmed set would re-starve it).
- **Alignment:** hard-EM many-to-{0,1,2} monotonic, parallelised (`tools/norwegian/nb_tagger_parallel.py`, `SEP=""` —
  Danish IPA chunks are single-codepoint-ish, length ː / stød ˀ / soft-d ð combine into the preceding chunk).
- **Model:** char-embedding (64) → 2-layer BiLSTM (256, dropout 0.3) → per-position IPA-chunk tag head; cosine-LR
  (Adam, 40 epochs). Trained on the FULL 199k NST for the shipped weights. 31 chars, 479 tags.
- **Export:** `da-g2p-tagger.int8.onnx` (dynamic-int8, 9.9MB fp32 → 2.5MB) + `da-g2p-tagger.meta.json`
  (`src`/`tags`/`charTags`).

Reproduce: `python3 tools/danish/build_da_nst.py --pron <dan030224NST.pron> --freq <da_50k.txt>` (writes the shipped
lexicon + `/tmp/da_train.tsv`), then `DA_PRODUCTION=1 .venv/bin/python -u tools/danish/da_bilstm.py` and dynamic-int8 quantise.

`onnxruntime-node` is OPTIONAL/lazy → absent it (or the model), `createDanishTagger()` resolves to `undefined` and
`phonemizeDaNeural` returns exactly the sync path (NST lexicon + rule g2p, no throw). Opt-in (import from
`src/daNeural.ts`, the bn/nb/en/fr pattern); the sync engine is untouched. See
.
