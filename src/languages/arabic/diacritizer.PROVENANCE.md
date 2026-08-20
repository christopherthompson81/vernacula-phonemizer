# Arabic diacritizer model — provenance

The neural Arabic diacritizer (`diacritizer.onnx`, tracked in git) restores short vowels on bare Arabic as an
async pre-pass before the g2p. It is a **permissively-sourced** model, built to avoid any non-commercial or
copyleft encumbrance at the source.

## What it is

A sentence-level BiLSTM (emb 128, hidden 512, 3 layers, ~15.3 M params), int8-quantized ONNX (~15 MB),
char-level, 19-label pausal alphabet. Deterministic argmax decode, one sentence per inference context.

## Provenance — fully permissive (no NC, no GPL)

- **Teacher:** CATT — Character-based Arabic Tashkeel Transformer (**Apache-2.0**; AbjadAI, arXiv:2407.03236,
  https://github.com/abjadai/catt). Used offline to silver-label training text.
- **Training text:** **Arabic Wikipedia** (`arwiki-latest-pages-articles`, **CC-BY-SA 4.0**) — 320 k clean
  sentences extracted from the dump, CATT-silver-labelled, trained **silver-only** (no warm-start).

We deliberately trained silver-only rather than warm-starting from a Tashkeela/Fadel init. A head-to-head
showed the silver-only model is **better on both domains** — modern (our target) **2.17% DER** vs 2.36% for
the warm-started variant, and even on the classical Fadel benchmark 4.21% vs 4.59%. With 320 k in-domain
Wikipedia sentences there is enough signal to learn from scratch; the classical init only added bias to
unlearn. So the maximally-clean model is also the best one — no provenance-vs-quality trade-off.

## Regenerate

Offline GPU pipeline (not in CI), staged on `$ARDIAC`: download the arwiki dump → extract Arabic
sentences → `catt_silver.py` (CATT → silver) → `train_bilstm_sent.py --pausal 1` (silver-only, no `--resume`)
→ `export_onnx.py` → int8 `quantize_dynamic`. The `.onnx` is tracked in git alongside `diacritizer.meta.json` (char/label
maps) is committed beside it.

## Licence posture

a model trained on CATT-labelled public Wikipedia retains none of any source corpus's selection/arrangement —
only the orthographic regularities of the language, which are facts (Feist). The chosen inputs are permissive by
their own terms regardless (Apache-2.0 teacher, CC-BY-SA text), so the question is moot at the source.

## 2026-08-20 — retrained: packed sequences + a cosine tail

Measured END-TO-END through the runtime against PAUSALIZED gold (`tools/arabic/eval_ar_runtime.mts`, 1,500
held-out sentences / 32,018 words) — both sides through the identical sync g2p, so a mismatch is a
diacritization error:

| | word-exact | sentence-exact |
|---|---|---|
| previous model | 85.10% (27,248/32,018) | 11.9% |
| **this model** | **85.53% (27,385/32,018)** | **12.3%** |

At checkpoint level on the pausal task, TEST DER 2.02% → **1.83%**, WER 7.81% → **7.20%**.

⚠ **ATTRIBUTION: ~0.17pp of the DER gain is the COSINE SCHEDULE, ~0.02pp (noise) is the packing.** Arabic is
the one language in the fleet-wide packing rollout where packing is not measurable, and the mechanism predicts
it: a sentence-level model with `maxlen 400` has almost no positions near the sequence end, whereas a
10-character word is nearly all "near the end" (da +5.6pp, nb +2.2pp). Do not read this row as a packing win.

⚠ The 25-epoch cap was truncating an ADAPTIVE `ReduceLROnPlateau` mid-decay — and asymmetrically, so an A/B
under it read 2.02 vs 2.10 and looked like packing had HURT. Resuming both arms from one epoch under an
identical cosine anneal (`--cosine`) removed the confound and found 0.2pp neither arm had reached.

**Quantization is free**: fp32 1.83% vs QUInt8 1.84% DER, scored one sentence at a time as the runtime serves.
⚠ A padded-batch scorer read 2.73% for the SAME fp32 graph and was briefly mistaken for a 0.9pp int8 loss —
an unpacked BiLSTM over padding, i.e. the very defect this retrain is about, reintroduced in the measuring
tool.

⚠ **THIS FILE'S "Provenance" SECTION IS UNRELIABLE ABOUT THE PREVIOUS MODEL'S SOURCE.** It names
`bilstm_silver_only.pt`, but that checkpoint is PAUSAL (2.02% DER at `--pausal 1`) while the artifact it
shipped predicted FULL diacritization (3.31% at `--pausal 0`, 16.89% at `--pausal 1`). They are different
models. Harmless in service — `diacritizer.ts::pausalize()` strips case endings downstream either way, which
is why the two agree on 98.04% of words — but it means the previously deployed artifact was not reproducible
from the checkpoint this document names. The model now shipped IS reproducible: `tools/arabic/train_ar.sh`.
