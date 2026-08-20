#!/bin/bash
# Reproduce the shipped MSA Arabic diacritizer. See tools/CORPORA.md for the data and licences.
#
# ⚠ THE SPLIT RESHUFFLE IS OPT-IN NOW. The original recipe began by re-shuffling silver.txt into fresh
#   train/val/test on every run, which silently changes the held-out set and makes a retrain incomparable to
#   the shipped model — the same failure that makes km's numbers non-continuous. Pass RESPLIT=1 only when you
#   intend a new split.
# ⚠ USE --cosine FOR ANY A/B. The default ReduceLROnPlateau is adaptive, so two arms decay on different
#   timetables and a fixed epoch cap cuts them at different LRs (measured: 2.02 vs 2.10 purely from that).
set -e
cd "${ARDIAC:-/mnt/data/ar-diac}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PY="${PY:-$REPO/.venv/bin/python}"

if [ "${RESPLIT:-0}" = 1 ]; then
  echo "[split] silver → train/val/test (NEW SPLIT — not comparable to the shipped model)"
  shuf silver.txt > silver.shuf
  head -5000 silver.shuf > val.txt
  sed -n '5001,10000p' silver.shuf > test.txt
  tail -n +10001 silver.shuf > train.txt
fi
wc -l train.txt val.txt test.txt

echo "[train] BiLSTM silver-only, pausal (no Tashkeela warm-start)"
$PY -u "$REPO/tools/arabic/train_ar_diacritizer.py" \
  --train train.txt --val val.txt --test test.txt --pausal 1 \
  --ckpt "${CKPT:-/mnt/data/ar-diac/bilstm_silver_only.pt}" \
  --epochs "${EPOCHS:-25}" --hidden 512 --layers 3 --emb 128 --amp 1

echo "[export] int8 ONNX + meta → src/languages/arabic/"
$PY "$REPO/tools/arabic/export_ar_diacritizer_onnx.py" --ckpt "${CKPT:-/mnt/data/ar-diac/bilstm_silver_only.pt}"
echo TRAIN_EXPORT_DONE
