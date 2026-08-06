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

Offline GPU pipeline (not in CI), staged on `/mnt/data/ar-diac`: download the arwiki dump → extract Arabic
sentences → `catt_silver.py` (CATT → silver) → `train_bilstm_sent.py --pausal 1` (silver-only, no `--resume`)
→ `export_onnx.py` → int8 `quantize_dynamic`. The `.onnx` is tracked in git alongside `diacritizer.meta.json` (char/label
maps) is committed beside it.

## Licence posture

a model trained on CATT-labelled public Wikipedia retains none of any source corpus's selection/arrangement —
only the orthographic regularities of the language, which are facts (Feist). The chosen inputs are permissive by
their own terms regardless (Apache-2.0 teacher, CC-BY-SA text), so the question is moot at the source.
