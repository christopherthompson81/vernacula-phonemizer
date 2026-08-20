#!/bin/bash
set -e
cd /mnt/data/ar-diac
source venv/bin/activate
echo "[split] silver → train/val/test"
shuf silver.txt > silver.shuf
head -5000 silver.shuf > val.txt
sed -n '5001,10000p' silver.shuf > test.txt
tail -n +10001 silver.shuf > train.txt
wc -l train.txt val.txt test.txt
echo "[train] BiLSTM silver-only, pausal (no Tashkeela warm-start)"
python ~/Programming/espeak-ng-portable/tools/diacritization/train_bilstm_sent.py \
  --train train.txt --val val.txt --test test.txt --pausal 1 \
  --ckpt /mnt/data/ar-diac/bilstm_silver_only.pt \
  --epochs 25 --hidden 512 --layers 3 --emb 128 --amp 1 2>&1
echo "[export] ONNX + meta"
python ~/Programming/espeak-ng-portable/tools/diacritization/export_onnx.py 2>&1
echo "TRAIN_EXPORT_DONE"
