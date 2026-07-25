# `nb-g2p-tagger.onnx` provenance

A word-level **STRUCTURAL TAGGER** (BiLSTM sequence-labeller) that maps a bare Norwegian Bokmål word to canonical IPA
— the neural **OOV** tier for Norwegian (`phonemizeNbNeural`; inference in `norwegianTagger.ts`). Instead of freely
generating an IPA string, it labels each **letter** with one IPA-chunk **tag** and concatenates the tags. Because
output length == input length, it **cannot degenerate** and **cannot break the consonant skeleton** — a single
forward pass, no beam, no autoregressive decode, no degeneration guard. A per-letter **consonant-consistency mask**
(`charTags` in the meta) restricts each letter to the tags it produced in training, so the model only ever decides the
vowel/stress decoration.

**Why a tagger, and why stress is IN the tags.** Norwegian is a deep orthography: the same spelling underdetermines
the stressed-syllable vowel quality (complementary length) and — for the Latinate loan vocabulary that dominates the
OOV tail — the *stress position* itself (absorbére, not ábsorbere). The sync rule engine can only default to
first-syllable stress, which is exactly wrong for those loans. So the tagger's tag alphabet **includes the stress mark
ˈ**: a letter's tag can be `ˈb`, `ˈbeː`, etc., and the BiLSTM's bidirectional pass predicts **stress position + the
stress-conditioned vowel quality directly from spelling**, in one pass. This is the OOV win the first-syllable
heuristic can't reach.

## Data — the NST pronunciation lexicon (CC0)

Source: **Nasjonalbibliotekets uttaleleksikon (NST)** — the Norwegian National Library's pronunciation lexicon,
released **CC0 / public domain** (`no.leksikon.tar.gz`, National Library of Norway / Språkbanken). This is INDEPENDENT
of the Wiktionary-derived referee (kaikki/wikipron), so it is non-circular both as the shipped tier-1 lexicon
(`nb-lexicon.tsv`, the frequency-filtered common forms) and as the tagger's training data (the full set).

Conversion: NST-SAMPA (field 11) → our canonical IPA via `tools/norwegian/` (retroflex letter+backtick n\`→ɳ t\`→ʈ
d\`→ɖ l\`→ɭ s\`→ʂ; the vowel tables incl. the `u0`→ʊ digraph; primary stress `"`→ˈ and tone-2 `""`→ˈ with the lexical
tone dropped; syllable/compound boundary markers dropped). For each word the **shortest** IPA variant is kept (NST's
first variant is often a spelling-letter reading for high-frequency function words: er→æːɾ, not eːər). Training set:
**631,021** alphabetic word→IPA-with-stress pairs.

## Model

Char-embedding (64) → 2-layer **BiLSTM** (hidden 128, dropout 0.3) → per-position linear tag head. Grapheme↔IPA-chunk
alignment by **hard-EM** (many-to-{0,1,2} monotonic Viterbi), parallelised across cores
(`tools/norwegian/nb_tagger_parallel.py::align_parallel`). Trained on the seed-0 90% split for the honest held-out
number, then on the FULL lexicon for the shipped model. Exported to the shared **structuralTagger** contract:
`nb-g2p-tagger.onnx` (fp32) + `nb-g2p-tagger.meta.json` (`src` letter→id, `tags` id→IPA-chunk, `charTags` id→permitted
tag-ids = the mask). 47 chars, 469 tags.

Reproduce (after downloading + extracting the NST tarball and an OpenSubtitles `no` frequency list):

```bash
# 1. NST (CC0) → tier-1 lexicon (nb-lexicon.tsv) + the full 631k IPA-with-stress training set
python3 tools/norwegian/build_nb_data.py \
  --pron "nor030224NST.pron" --freq no_50k.txt --train-out /tmp/nb_train_stress.tsv
# 2. train the BiLSTM (parallel hard-EM align + GPU) and export the ONNX + meta.json
NB_LEX=/tmp/nb_train_stress.tsv NB_KEEP_STRESS=1 NB_SUBSAMPLE=0 \
  .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
```

## Held-out (seed-0 OOV split), why the BiLSTM and not the perceptron

On the SAME 14,885-word held-out split, three OOV readers measured (segmental exact-match, for the architecture
comparison):

| model | held-out OOV | note |
|---|---|---|
| rule engine | 9.4% | first-syllable stress guess + rule vowel quality |
| averaged perceptron (IPM-parallel, ±4-grapheme window) | 56.6% | pure-JS, sync — but per-grapheme, no long-range state |
| **BiLSTM tagger (this model)** | **83.4%** | bidirectional whole-word context |

The perceptron loses ~27 points — the per-grapheme classifier can't model Norwegian's long-range stress-conditioned
vowel quality the way a BiLSTM's recurrent state can (mirrors the Danish precedent). So the sync-simplicity of a
pure-JS perceptron isn't worth 27 points on the names/novel-compounds the OOV tail is made of. The shipped model is the
**stress-included** BiLSTM — held-out **89.7%** full-word exact-match INCLUDING the stress mark (56376/62838; the
segmental table above drops stress for the perceptron comparison, so this is the harder complete-output number).
Trained with a **cosine LR decay** (2e-3→0): a fixed lr overshot the minimum in late epochs (loss climbed ~50% past
its epoch-10 bottom, held-out 75.1% on the last-epoch weights); annealing made the loss monotonic and lifted held-out
to 89.7%. `onnxruntime-node` is an optional dependency
imported lazily — absent it, `createNorwegianTagger()` resolves to `undefined` and the sync engine (lexicon → rules)
serves everything, so the tagger is a pure quality add-on with no hard dependency.

See `docs/investigations/nb_native_bringup_investigation.md` Run 4.
