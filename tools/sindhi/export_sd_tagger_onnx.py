#!/usr/bin/env python3
"""
Train the FINAL Sindhi structural tagger on all data and export int8 ONNX + the TaggerMeta sidecar.

Contract expected by src/core/structuralTagger.ts:
  input   char ids   int64 [1, L]
  output  logits   float32 [1, L, nTags]
  meta    {src, tags, charTags}   charTags = the consonant-consistency mask

Trained with the Devanagari INHERENT-vowel slots masked (-100): those labels are "unknown dressed as
ə" (Phase 9), and training on them teaches a systematic ə bias. Consequence, measured in Phase 10:
the model must NOT be used to fill inherent slots (11.4% vs 76.5% for just leaving ə) — its job is
the OOV path, where the alternative is blanket default-ə.

Epoch count is fixed at the CV-converged value; Phase 10 measured 200 epochs and found held-out
accuracy flat 75–78% from epoch 30 onward, so longer is pure overfit.

  python3 export_sd_tagger_onnx.py
Run under /mnt/data/omnivoice_ipa/train_venv/bin/python.
"""
import json, random, shutil
from collections import Counter
from pathlib import Path

import torch
import torch.nn as nn

HERE = Path(__file__).resolve().parent
DEST = HERE.parent.parent / "src/languages/sindhi"
DATA = HERE / "sd_tagger_data_marked.tsv"
META = HERE / "sd_tagger_meta_marked.json"

SEED, EPOCHS, BS, LR = 0, 40, 32, 1e-3
EMB, HID, LAYERS, DROP = 128, 256, 2, 0.3


class Tagger(nn.Module):
    def __init__(self, nsrc, ntag):
        super().__init__()
        self.e = nn.Embedding(nsrc, EMB, padding_idx=0)
        self.lstm = nn.LSTM(EMB, HID, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * HID, ntag)

    def forward(self, x):
        return self.o(self.lstm(self.e(x))[0])


def main():
    random.seed(SEED); torch.manual_seed(SEED)
    meta = json.loads(META.read_text(encoding="utf8"))
    src = meta["src"]; tags = {int(k): v for k, v in meta["tags"].items()}
    tag2id = {v: k for k, v in tags.items()}

    rows = []
    for line in DATA.read_text(encoding="utf8").splitlines():
        if not line.strip():
            continue
        w, letters, tg = line.split("\t")
        rows.append((w, letters.split(" "), tg.split(" ")))

    X = [[src.get(c, 1) for c in L] for _, L, _ in rows]
    Y = [[-100 if "ᵊ" in t else tag2id[t] for t in T] for _, _, T in rows]

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = Tagger(len(src), len(tags)).to(dev)
    opt = torch.optim.Adam(model.parameters(), LR)
    crit = nn.CrossEntropyLoss(ignore_index=-100)
    idx = list(range(len(X)))
    for ep in range(EPOCHS):
        model.train(); random.shuffle(idx); tot = nb = 0
        for i in range(0, len(idx), BS):
            ch = idx[i:i + BS]
            L = max(len(X[j]) for j in ch)
            xb = torch.zeros(len(ch), L, dtype=torch.long)
            yb = torch.full((len(ch), L), -100, dtype=torch.long)
            for r, j in enumerate(ch):
                xb[r, :len(X[j])] = torch.tensor(X[j])
                yb[r, :len(Y[j])] = torch.tensor(Y[j])
            xb, yb = xb.to(dev), yb.to(dev)
            opt.zero_grad()
            loss = crit(model(xb).reshape(-1, len(tags)), yb.reshape(-1))
            loss.backward(); opt.step()
            tot += loss.item(); nb += 1
        if (ep + 1) % 10 == 0:
            print(f"  ep {ep+1}/{EPOCHS} loss {tot/nb:.4f}", flush=True)

    model.eval().cpu()
    fp32 = HERE / "sd-g2p-tagger.onnx"
    dummy = torch.tensor([X[0]], dtype=torch.long)
    torch.onnx.export(
        model, (dummy,), str(fp32),
        input_names=["chars"], output_names=["logits"],
        dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}},
        opset_version=17,
    )

    # argmax parity fp32 ONNX vs torch — must be exact before quantizing
    import onnxruntime as ort
    sess = ort.InferenceSession(str(fp32), providers=["CPUExecutionProvider"])
    bad = 0
    for j in range(min(400, len(X))):
        t = torch.tensor([X[j]], dtype=torch.long)
        a = model(t).argmax(-1).numpy()
        b = sess.run(None, {"chars": t.numpy()})[0].argmax(-1)
        bad += int((a != b).any())
    print(f"fp32 ONNX argmax parity vs torch: {400-bad}/400 words exact")

    int8 = HERE / "sd-g2p-tagger.int8.onnx"
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8)

    s8 = ort.InferenceSession(str(int8), providers=["CPUExecutionProvider"])
    agree = 0
    for j in range(min(400, len(X))):
        t = torch.tensor([X[j]], dtype=torch.long).numpy()
        a = sess.run(None, {"chars": t})[0].argmax(-1)
        b = s8.run(None, {"chars": t})[0].argmax(-1)
        agree += int((a == b).all())
    print(f"int8 vs fp32 word-level argmax agreement: {agree}/400 = {agree/400:.1%}")

    # Shipping meta, in the exact shape src/core/structuralTagger.ts loads:
    #  - `tags` id → IPA chunk. The ᵊ marker is a TRAINING-time device; collapse it to ə. The EMPTY chunk is
    #    stored as "_" during alignment for readability — it must ship as "" or the decoder emits a literal
    #    underscore into the IPA.
    #  - `charTags` is keyed by SYMBOL ID (not by character), matching bn/nb. `<unk>` (id 1) permits every tag
    #    so an unseen letter cannot hard-decline; `<pad>` (id 0) permits none.
    ship_tags = {str(k): ("" if v == "_" else v.replace("ᵊ", "ə")) for k, v in tags.items()}

    # GLIDE-DELETION GUARD. The "cannot break the consonant skeleton" property holds for consonants (they never
    # take the empty tag) but NOT for the glide/vowel letters, where a handful of training alignments put "_" in
    # the mask — so the decoder was free to delete them (دنيا → d̪ʊnaː, the ي dropped). Measured empty-tag rates:
    # ھ 100% (always absorbed into the preceding aspirate digraph), ه 15.0% and ع 13.8% (genuinely silent
    # carriers), ا 7.7% — all legitimate. But و 1.2%, ي 2.5%, ئ 0.4%, آ 1.5% are noise. Drop the empty tag from
    # any letter that took it in <5% of ≥20 observations; leave sparse letters alone (too little evidence).
    empty_id = next(k for k, v in tags.items() if v == "_")
    tot_c, empt_c = Counter(), Counter()
    for _, L, T in rows:
        for c, t in zip(L, T):
            tot_c[c] += 1
            if t == "_":
                empt_c[c] += 1
    pruned = []
    char_tags = {c: list(v) for c, v in meta["charTags"].items()}
    for c, ids in char_tags.items():
        if empty_id in ids and tot_c[c] >= 20 and empt_c[c] / tot_c[c] < 0.05:
            ids.remove(empty_id)
            pruned.append(f"{c} ({empt_c[c]}/{tot_c[c]})")
    print("glide-deletion guard — empty tag pruned from: " + (", ".join(pruned) or "nothing"))
    meta["charTags"] = char_tags

    by_id = {str(src[c]): v for c, v in meta["charTags"].items() if c in src}
    by_id.setdefault("0", [])
    by_id["1"] = sorted(tags.keys())
    ship = {"src": src, "tags": ship_tags, "charTags": by_id}
    (HERE / "sd-g2p-tagger.meta.json").write_text(json.dumps(ship, ensure_ascii=False, indent=1), encoding="utf8")

    for f in ("sd-g2p-tagger.int8.onnx", "sd-g2p-tagger.meta.json"):
        shutil.copy(HERE / f, DEST / f)
    print(f"size int8: {int8.stat().st_size/1e6:.2f} MB  ->  {DEST}")


if __name__ == "__main__":
    main()
