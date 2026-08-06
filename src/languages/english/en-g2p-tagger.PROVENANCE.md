# `en-g2p-tagger.int8.onnx` provenance

A per-grapheme **BiLSTM** sequence-labeller that maps a bare OOV English word to canonical IPA — the neural **OOV** tier
for English (`phonemizeEnNeural`; inference in `englishTagger.ts`). It labels each **letter** with one **ARPABET-chunk**
tag in a SINGLE forward pass, then finishes the ARPABET the SAME way the sync n-gram path does — `enforceSinglePrimary`
+ `collapseGeminates` + `arpabetToIpa` (shared from `englishG2p.ts`), so a G2P word has no seam with the CMUdict
lexicon. Output length == input length → it cannot degenerate; a per-letter CONSONANT-consistency MASK (`charTags`)
keeps it from emitting an impossible tag; on an out-of-vocab letter it declines ("") and the word falls back to the
sync engine.

**Why a tagger, and why it replaces the n-gram.** English OOV is the classic hard G2P problem. The prior OOV path
(compound-split → morph → joint n-gram) is weak on the non-compositional tail (proper nouns, foreign/novel words), and
the noisy wikipron referee couldn't even measure it. On a CLEAN CMUdict 90/10 held-out
(11,748 words), the BiLSTM roughly HALVES the phone-error-rate:

| model (held-out, stress-independent phones) | WORD-exact | PHONE-accuracy (1−PER) |
|---|---|---|
| current pipeline (compound→morph→n-gram) | 42.7% | 81.8% |
| **BiLSTM tagger (this model)** | **68.4%** | **92.6%** (PER 7.4% vs 18.2% — 59% fewer phone errors) |

Concretely it reads proper nouns the n-gram mangles: Zelensky → zəlɛnski (n-gram: …aɪzɪlɛnski). Precedence is
lexicon → heteronym → possessive → **tagger** → n-gram (the tagger only fires on genuinely-OOV alpha words; dict text
is byte-identical to `phonemize(text, "en")`).

## Data + training

- **Corpus:** CMUdict (public domain) — `g2p-dict.tsv`, 117,479 ascii-alpha word→ARPABET entries (the same lexicon the
  sync engine ships).
- **Alignment:** hard-EM many-to-{0,1,2} monotonic (grapheme → 0/1/2 ARPABET phones), parallelised across cores
  (`tools/norwegian/nb_tagger_parallel.py::align_parallel`, with `SEP=" "` so a 2-phone chunk keeps its ARPABET token
  boundary — ⟨x⟩ → `K S`, not `KS`).
- **Model:** char-embedding (64) → 2-layer BiLSTM (hidden 256, dropout 0.3) → per-position ARPABET-chunk tag head;
  cosine-LR (2e-3→0). Trained on the FULL CMUdict for the shipped weights. 28 chars, 212 tags.
- **Export:** `en-g2p-tagger.int8.onnx` (dynamic-int8 quantised, 9.4MB fp32 → 2.4MB) + `en-g2p-tagger.meta.json`
  (`src` letter→id, `tags` id→ARPABET-chunk, `charTags` id→permitted tag-ids = the mask).

Reproduce:

```bash
EN_PRODUCTION=1 .venv/bin/python -u tools/english/en_g2p_bilstm.py   # held-out report + full-CMUdict train + export
# then dynamic-int8 quantise en-g2p-tagger.onnx → en-g2p-tagger.int8.onnx (onnxruntime.quantization.quantize_dynamic)
```

`onnxruntime-node` is an OPTIONAL dependency, imported lazily; absent it (or the model), `createEnglishTagger()`
resolves to `undefined` and `phonemizeEnNeural` returns exactly the sync path (CMUdict + n-gram, no throw). This is a
SEPARATE async path; the sync engine is untouched. See
 (Runs 3, 6-7).
