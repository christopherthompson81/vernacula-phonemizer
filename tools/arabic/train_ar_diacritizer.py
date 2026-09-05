#!/usr/bin/env python3
"""
SENTENCE-level char BiLSTM Arabic diacritizer (issue #675, high-accuracy path) —
the SOTA architecture (Shakkala-style): process a whole sentence of characters so
the model sees cross-word context (definiteness after ال, case/agreement), which
is what lifts char accuracy from ~94% (word-level) toward ~97-98% (SOTA).

Trains on the Fadel-cleaned Tashkeela benchmark (train/val/test.txt — full
diacritized sentences, the standard split) and reports the STANDARD metrics:
DER (diacritic error rate, per base letter) and WER (word error rate), so we can
compare against SOTA and actually see high-90s. Diacritics kept in FULL form here
(not pausalized) — the standard benchmark scores case endings too.

Usage:
  python train_bilstm_sent.py --train train.txt --val val.txt --test test.txt \
      [--epochs 20 --hidden 512 --emb 128 --layers 3 --maxlen 400]
"""
import argparse, sys, random
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

ap = argparse.ArgumentParser()
ap.add_argument("--train", required=True)
ap.add_argument("--val", required=True)
ap.add_argument("--test", required=True)
ap.add_argument("--lr", type=float, default=1e-3)
ap.add_argument("--resume", default=None, help="resume from a .resume.pt checkpoint (or a plain weights .pt for a warm restart)")
ap.add_argument("--amp", type=int, default=1, help="mixed-precision (fp16 autocast) — ~2x faster; fp32 master weights so checkpoints are cross-compatible")
ap.add_argument("--dropout", type=float, default=0.3)
ap.add_argument("--eval-ckpt", help="load this checkpoint, report TEST DER/WER, exit (no training)")
ap.add_argument("--eval-onnx", help="score a SHIPPED .onnx on the test split — measures what actually serves, "
                                    "including the int8 quantization, through this file's own loader and DER")
ap.add_argument("--cosine", type=int, default=0,
                help="DETERMINISTIC CosineAnnealingLR over the remaining epochs instead of ReduceLROnPlateau. "
                     "Set this for any A/B: both arms then follow the identical LR trajectory by epoch index, "
                     "so neither can be cut mid-decay at a different lr (see the note at the scheduler).")
ap.add_argument("--cosine-lr", type=float, default=None,
                help="starting lr for --cosine (default: keep the optimizer's current lr). Pass the SAME value "
                     "in both arms of an A/B so they start level as well as decaying alike.")
ap.add_argument("--patience", type=int, default=6, help="early-stop after N epochs with no val-DER improvement")
ap.add_argument("--arch", default="bilstm", choices=["bilstm", "transformer"])
ap.add_argument("--warmup", type=int, default=0, help="linear LR warmup steps (transformers need ~500)")
ap.add_argument("--pausal", type=int, default=0, help="train on PAUSAL labels: strip each word's final case-ending (i'rab) vowel/tanwin — the syntactic prediction our pausal TTS discards; frees capacity for the internal vowels TTS needs")
ap.add_argument("--d_model", type=int, default=256)
ap.add_argument("--nhead", type=int, default=8)
ap.add_argument("--ff", type=int, default=1024)
ap.add_argument("--ckpt", default="/mnt/data/ar-diac/bilstm_sent.pt")
ap.add_argument("--epochs", type=int, default=20)
ap.add_argument("--hidden", type=int, default=512)
ap.add_argument("--emb", type=int, default=128)
ap.add_argument("--layers", type=int, default=3)
ap.add_argument("--maxlen", type=int, default=400)
ap.add_argument("--batch", type=int, default=64)
args = ap.parse_args()
dev = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(1234); random.seed(1234)
print(f"# device={dev} torch={torch.__version__}", file=sys.stderr)

SHADDA = "ّ"
VOWELS = {"َ": "a", "ُ": "u", "ِ": "i", "ْ": "o",
          "ً": "F", "ٌ": "N", "ٍ": "K", "ٰ": "^"}
MARKS = set([SHADDA]) | set(VOWELS)
SPACE = "<sp>"          # word-boundary char
SPACE_LABEL = "_"       # its (ignored) label

def is_letter(c):
    o = ord(c)
    return (0x0620 <= o <= 0x064A) or (0x0671 <= o <= 0x06D3) or o in (0x0629, 0x0649)

def align_sentence(line):
    """A diacritized sentence -> (chars incl. <sp>, labels). None if malformed."""
    chars, labels = [], []
    words = line.split()
    for wi, w in enumerate(words):
        cs = list(w)
        i = 0
        wchars, wlabels = [], []
        while i < len(cs):
            c = cs[i]
            if c in MARKS:  # mark with no base letter → skip the token (keep sentence)
                return None
            if not is_letter(c):
                i += 1; continue  # drop stray punct inside a token
            wchars.append(c); i += 1
            shadda = False; vowel = None
            while i < len(cs) and cs[i] in MARKS:
                m = cs[i]
                if m == SHADDA: shadda = True
                else: vowel = VOWELS[m]
                i += 1
            v = vowel or "0"
            wlabels.append(("~" + v) if shadda else v)
        if not wchars:
            continue
        if args.pausal and wlabels:  # drop the word-final case ending (i'rab): a/u/i/F/N/K → bare, keep any shadda
            last = wlabels[-1]; core = last[1:] if last.startswith("~") else last
            if core in ("a", "u", "i", "F", "N", "K"):
                wlabels[-1] = "~0" if last.startswith("~") else "0"
        if chars:  # word boundary
            chars.append(SPACE); labels.append(SPACE_LABEL)
        chars += wchars; labels += wlabels
    if len([c for c in chars if c != SPACE]) < 2:
        return None
    return chars, labels

def load(path):
    out = []
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            a = align_sentence(line)
            if a and len(a[0]) <= args.maxlen:
                out.append(a)
    return out

train = load(args.train); val = load(args.val); test = load(args.test)
print(f"# sentences train={len(train)} val={len(val)} test={len(test)}", file=sys.stderr)

# Resume checkpoint (loaded early so we reuse its vocab — vocab MUST match the
# architecture being restored).
resume_ck = torch.load(args.resume, map_location=dev, weights_only=False) if args.resume else None
if resume_ck is not None and "chars" in resume_ck:
    chars, labels = resume_ck["chars"], resume_ck["labels"]
    print(f"# resume: reusing vocab from {args.resume}", file=sys.stderr)
else:
    PAD = "<pad>"; UNK = "<unk>"
    chars = {PAD: 0, UNK: 1, SPACE: 2}
    for cs, _ in train:
        for c in cs: chars.setdefault(c, len(chars))
    # FIXED full label alphabet (not data-built) so every model shares it, rare
    # labels (e.g. ~o) never KeyError on val/test, and models stay warm-start
    # compatible. Base: 0/a/u/i/o/F/N/K/^ + their ~(shadda) variants + <sp>.
    BASE = ["0", "a", "u", "i", "o", "F", "N", "K", "^"]
    LAB = [SPACE_LABEL] + BASE + ["~" + b for b in BASE]
    labels = {l: i for i, l in enumerate(LAB)}
ilabels = {i: l for l, i in labels.items()}
print(f"# chars={len(chars)} labels={len(labels)}: {list(labels)}", file=sys.stderr)

def enc_c(cs): return torch.tensor([chars.get(c, 1) for c in cs], dtype=torch.long)
def enc_l(ls): return torch.tensor([labels.get(l, labels["0"]) for l in ls], dtype=torch.long)

class DS(torch.utils.data.Dataset):
    def __init__(self, rows): self.rows = rows
    def __len__(self): return len(self.rows)
    def __getitem__(self, i):
        cs, ls = self.rows[i]; return enc_c(cs), enc_l(ls)
def collate(b):
    xs, ys = zip(*b)
    return (pad_sequence(xs, batch_first=True, padding_value=0),
            pad_sequence(ys, batch_first=True, padding_value=-100),
            torch.tensor([len(x) for x in xs]))

class BiLSTM(nn.Module):
    def __init__(s, nc, nl, emb, h, ly):
        super().__init__()
        s.emb = nn.Embedding(nc, emb, padding_idx=0)
        s.lstm = nn.LSTM(emb, h, num_layers=ly, batch_first=True, bidirectional=True,
                         dropout=args.dropout if ly > 1 else 0.0)
        s.fc = nn.Linear(2*h, nl)
    def forward(s, x, lengths=None):
        """⚠ PASS `lengths` FOR A PADDED BATCH. Unpacked, the BiLSTM's BACKWARD direction crosses the pad steps
        before it reaches each sentence's last real character, so that character's representation depends on
        the batch's longest sentence — while serving is one sentence at a time, unpadded. The damage lands at
        the END of the sentence, and this is a SENTENCE-level model, so that is the final word or two of every
        input rather than one letter.

        ⚠ THIS FILE IS VERY LIKELY WHERE THE WHOLE FLEET INHERITED THE BUG. `collate` above has ALWAYS returned
        `torch.tensor([len(x) for x in xs])`, and all three call sites already unpack it as `lens` — the
        lengths were plumbed end to end and then never passed to the model. The perso-arabic rider is a direct
        descendant of this file and carried the same shape, as did every tagger derived from it.
        See docs/investigations/asr-align/asr_align_qc_investigation.md Runs 41-49."""
        h = s.emb(x)
        if lengths is None:
            return s.fc(s.lstm(h)[0])
        pk = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(s.lstm(pk)[0], batch_first=True, total_length=x.size(1))
        return s.fc(out)

class PositionalEncoding(nn.Module):
    def __init__(s, d, maxlen=1024):
        super().__init__()
        import math
        pe = torch.zeros(maxlen, d)
        pos = torch.arange(0, maxlen).unsqueeze(1).float()
        div = torch.exp(torch.arange(0, d, 2).float() * (-math.log(10000.0) / d))
        pe[:, 0::2] = torch.sin(pos * div); pe[:, 1::2] = torch.cos(pos * div)
        s.register_buffer("pe", pe.unsqueeze(0))
    def forward(s, x): return x + s.pe[:, :x.size(1)]

class CharTransformer(nn.Module):
    """SOTA-style char-level transformer encoder (CATT-ish). Builds the padding
    mask internally from x==0 so the call site stays model(x)."""
    def __init__(s, nc, nl, d, nhead, ff, ly, dropout):
        super().__init__()
        s.emb = nn.Embedding(nc, d, padding_idx=0)
        s.pos = PositionalEncoding(d)
        layer = nn.TransformerEncoderLayer(d, nhead, ff, dropout, batch_first=True, norm_first=True)
        s.enc = nn.TransformerEncoder(layer, ly)
        s.fc = nn.Linear(d, nl)
    def forward(s, x):
        pad = (x == 0)
        h = s.pos(s.emb(x))  # no √d scale — it drowned the positional signal → context-blind
        h = s.enc(h, src_key_padding_mask=pad)
        return s.fc(h)

if args.arch == "transformer":
    model = CharTransformer(len(chars), len(labels), args.d_model, args.nhead, args.ff, args.layers, args.dropout).to(dev)
else:
    model = BiLSTM(len(chars), len(labels), args.emb, args.hidden, args.layers).to(dev)
print(f"# arch={args.arch} params={sum(p.numel() for p in model.parameters())/1e6:.1f}M", file=sys.stderr)
opt = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-5)
# ⚠ AN ADAPTIVE SCHEDULE PLUS A FIXED EPOCH CAP IS A TRAP FOR ANY A/B. ReduceLROnPlateau reacts to THIS arm's
# val curve, so two arms of a comparison decay on different timetables; if the cap binds before early stopping
# they are cut at different LRs, and the gap gets read as model quality. Measured 2026-08-19: the packing A/B
# ran both arms to 25/25 with the baseline at lr 1.3e-04 and the packed at 2.5e-04 — a full step behind — and
# since this model's gains arrive AT lr drops, the packed arm read 0.08pp worse purely from being mid-decay.
# Fixed by resuming both to early-stop, i.e. comparing at convergence rather than at a cap.
# ⚠ The fleet's shared trainer uses CosineAnnealingLR precisely because it is DETERMINISTIC — the same
# trajectory per epoch index whatever the val curve does — and anneals to ~0 so the run ends AT the minimum
# (see tools/bilstm_training/tagger.py::train). Porting that here is the durable fix, but it changes what a
# retrain produces, so it belongs in its own change rather than folded into a measurement.
if args.cosine:
    # ⚠ Deterministic anneal to ~0 over the REMAINING epochs — the shared trainer's strategy
    # (tools/bilstm_training/tagger.py::train). Chosen for A/Bs: identical trajectory per epoch index in both
    # arms, and the run ends AT the minimum rather than wherever a plateau happened to leave it.
    if args.cosine_lr is not None:
        for gp in opt.param_groups: gp["lr"] = args.cosine_lr
    # ⚠ `start_epoch` is not assigned until the resume block far below, so derive the resumed epoch from
    # `resume_ck` (loaded at the top) — T_max must cover only the epochs this run will actually execute, or
    # the anneal ends partway down and reintroduces exactly the mid-decay state this flag exists to avoid.
    _from = resume_ck.get("epoch", 0) if resume_ck else 0
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs - _from))
else:
    sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, factor=0.5, patience=2)
crit = nn.CrossEntropyLoss(ignore_index=-100)
use_amp = bool(args.amp) and dev == "cuda"
# Transformers overflow in fp16 attention → use bf16 (same range as fp32, no
# overflow, no loss-scaling needed). BiLSTM keeps fp16 (validated, faster).
amp_dtype = torch.bfloat16 if args.arch == "transformer" else torch.float16
scaler = torch.amp.GradScaler("cuda", enabled=(use_amp and amp_dtype == torch.float16))
print(f"# mixed precision (amp): {use_amp}", file=sys.stderr)
SP = labels[SPACE_LABEL]

class BucketSampler(torch.utils.data.Sampler):
    """Yield batches of LENGTH-SIMILAR indices (sorted, then chunk, then shuffle the
    chunk order) so padding waste is minimal — the big epoch-time win on variable-
    length sentences (a random batch pads everything to the longest, up to maxlen)."""
    def __init__(self, rows, batch_size, shuffle=True):
        self.lengths = [len(cs) for cs, _ in rows]; self.bs = batch_size; self.shuffle = shuffle
        self._n = (len(rows) + batch_size - 1) // batch_size
    def __len__(self): return self._n
    def __iter__(self):
        order = sorted(range(len(self.lengths)), key=lambda i: self.lengths[i])
        batches = [order[i:i + self.bs] for i in range(0, len(order), self.bs)]
        if self.shuffle: random.shuffle(batches)
        for b in batches: yield b

def make_dl(rows, shuffle):
    return torch.utils.data.DataLoader(
        DS(rows), batch_sampler=BucketSampler(rows, args.batch, shuffle),
        collate_fn=collate, num_workers=6, pin_memory=True, persistent_workers=True)
tdl = make_dl(train, True)
val_dl = make_dl(val, False)

def der_eval(dl):
    """Vectorized DER over a prebuilt loader (GPU tensor ops, no Python char loop)."""
    model.eval(); derr = dtot = 0
    with torch.no_grad():
        for X, Y, lens in dl:
            X, Y = X.to(dev), Y.to(dev)
            pred = model(X, lens).argmax(-1)
            mask = (Y != -100) & (Y != SP)
            derr += ((pred != Y) & mask).sum().item(); dtot += mask.sum().item()
    return 100 * derr / max(dtot, 1)

def evaluate(rows):
    """DER + WER (Python word-grouping — used only for the final TEST report)."""
    model.eval(); derr = dtot = werr = wtot = 0
    dl = torch.utils.data.DataLoader(DS(rows), batch_size=args.batch, shuffle=False, collate_fn=collate)
    with torch.no_grad():
        for X, Y, lens in dl:
            X, Y = X.to(dev), Y.to(dev)
            pred = model(X, lens).argmax(-1)
            for b in range(X.size(0)):
                L = lens[b].item(); wbad = False; started = False
                for j in range(L):
                    y = Y[b, j].item()
                    if y == SP:  # word boundary
                        if started: wtot += 1; werr += 1 if wbad else 0
                        wbad = False; started = False; continue
                    started = True
                    dtot += 1
                    if pred[b, j].item() != y: derr += 1; wbad = True
                if started: wtot += 1; werr += 1 if wbad else 0
    return 100*derr/max(dtot,1), 100*werr/max(wtot,1)

import copy
best_der = 1e9; best_state = None; start_epoch = 0
RESUME_PATH = args.ckpt + ".resume.pt"
if resume_ck is not None:
    model.load_state_dict(resume_ck["state"])
    if "opt" in resume_ck: opt.load_state_dict(resume_ck["opt"])
    if "sched" in resume_ck: sched.load_state_dict(resume_ck["sched"])
    if "scaler" in resume_ck and use_amp: scaler.load_state_dict(resume_ck["scaler"])
    start_epoch = resume_ck.get("epoch", 0)
    best_der = resume_ck.get("best_der", 1e9)
    best_state = resume_ck.get("best_state", None)
    print(f"# resumed at epoch {start_epoch}, best_der {best_der:.2f}%", file=sys.stderr)

gstep = 0
if args.eval_onnx:
    # ⚠ SCORE THE ARTIFACT THAT SHIPS. Reuses this file's load()/align_sentence()/evaluate() so preprocessing
    # and the DER definition cannot drift from the training-time numbers — the alternative is reimplementing
    # them in a second script and comparing two definitions by accident. The shim mimics the model's call
    # signature (X, lens) and ignores lens: serving is unpadded per sentence, and evaluate() feeds one batch.
    # ⚠ THE VOCAB MUST COME FROM THE ONNX'S OWN SIDECAR, NOT FROM --resume. Character IDs are assigned in
    # first-seen order, so two models trained on the same data have the SAME 39 characters under DIFFERENT
    # ids — measured: 30 of 39 differ between the committed diacritizer and this run's checkpoint. Encoding
    # with the wrong table feeds a graph ids it never saw: the committed model scored 66.20% DER that way and
    # looked catastrophically broken when it is fine. A vocab mismatch does not error, it just reads as a dead
    # model — the same shape as the Hebrew harness's 0.0% (he_native_bringup Run 13).
    import json as _json, onnxruntime as _ort
    _meta_path = args.eval_onnx.rsplit(".onnx", 1)[0] + ".meta.json"
    _meta = _json.load(open(_meta_path, encoding="utf8"))
    if _meta["chars"] != chars or _meta["labels"] != labels:
        print(f"# ⚠ vocab differs from --resume; using {_meta_path.split('/')[-1]} (the artifact's own)",
              file=sys.stderr)
        chars, labels = _meta["chars"], _meta["labels"]
        SP = labels[SPACE_LABEL]
    _sess = _ort.InferenceSession(args.eval_onnx, providers=["CPUExecutionProvider"])
    _name = _sess.get_inputs()[0].name

    class _OnnxShim:
        """⚠ ONE SENTENCE PER CALL, UNPADDED — because that is what serving does, and because the exported
        graph has NO packing. Feeding it a padded batch runs an unpacked BiLSTM over the padding: the very
        defect this whole campaign is about, reintroduced inside the tool measuring the fix. Measured: the
        same model read 2.73% DER through a padded batch and 1.83% one sentence at a time — a 0.9pp artefact
        that was briefly mistaken for a quantization loss. Quantization actually costs 0.01pp
        (fp32 2.73 / QInt8 2.74 / QUInt8 2.73 under the padded harness; all three agree)."""

        def eval(self): return self

        def __call__(self, X, lens=None):
            if lens is None:
                return torch.from_numpy(_sess.run(None, {_name: X.cpu().numpy()})[0])
            xs = X.cpu().numpy()
            outs = []
            for r in range(xs.shape[0]):
                L = int(lens[r])
                o = _sess.run(None, {_name: xs[r:r + 1, :L]})[0][0]          # [L, nl], no padding present
                pad = torch.zeros(X.size(1) - L, o.shape[-1], dtype=torch.float32)
                outs.append(torch.cat([torch.from_numpy(o), pad], 0))
            return torch.stack(outs)

    model = _OnnxShim()
    _d, _w = evaluate(test)
    print(f"# {args.eval_onnx.split('/')[-1]} → TEST DER {_d:.2f}%  WER {_w:.2f}%", file=sys.stderr)
    sys.exit(0)

if args.eval_ckpt:
    # ⚠ Re-score a saved checkpoint on the SAME test path without retraining, so two models are compared on one
    # measurement rather than each under its own run. Added 2026-08-19 for the packing A/B (cf. the rider's
    # --eval-ckpt); the alternative is trusting numbers printed by two different processes.
    _ck = torch.load(args.eval_ckpt, map_location=dev, weights_only=False)
    model.load_state_dict(_ck["state"] if "state" in _ck else _ck)
    _d, _w = evaluate(test)          # the loaded test split (line 115), not a name of my invention
    print(f"# {args.eval_ckpt.split('/')[-1]} → TEST DER {_d:.2f}%  WER {_w:.2f}%", file=sys.stderr)
    sys.exit(0)

for ep in range(start_epoch, args.epochs):
    model.train(); tot = 0.0
    for X, Y, lens in tdl:
        X, Y = X.to(dev, non_blocking=True), Y.to(dev, non_blocking=True)
        opt.zero_grad()
        gstep += 1
        if args.warmup and gstep <= args.warmup:  # linear LR warmup (transformers need it)
            for g in opt.param_groups: g["lr"] = args.lr * gstep / args.warmup
        with torch.autocast("cuda", dtype=amp_dtype, enabled=use_amp):
            loss = crit(model(X, lens).reshape(-1, len(labels)), Y.reshape(-1))
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); tot += loss.item()
    der = der_eval(val_dl)  # fast vectorized DER per-epoch (WER only at final test)
    sched.step() if args.cosine else sched.step(der)   # cosine steps by epoch; plateau steps on the metric
    if der < best_der - 1e-4:
        best_der = der; best_state = copy.deepcopy(model.state_dict()); since_best = 0
    else:
        since_best = locals().get("since_best", 0) + 1
    print(f"  epoch {ep+1}/{args.epochs} loss {tot/len(tdl):.4f}  VAL DER {der:.2f}%  best {best_der:.2f}%  lr {opt.param_groups[0]['lr']:.1e}", file=sys.stderr)
    # RESUMABLE checkpoint every epoch — model + optimizer + scheduler + progress,
    # so a run that ends still-dropping can be continued with `--resume`.
    torch.save({"state": model.state_dict(), "opt": opt.state_dict(), "sched": sched.state_dict(),
                "scaler": scaler.state_dict(), "epoch": ep + 1, "best_der": best_der,
                "best_state": best_state, "chars": chars, "labels": labels, "cfg": vars(args)}, RESUME_PATH)
    if since_best >= args.patience:
        print(f"# early stop: no val-DER improvement in {args.patience} epochs (best {best_der:.2f}%)", file=sys.stderr)
        break

if best_state is not None: model.load_state_dict(best_state)
der, wer = evaluate(test)
print(f"# BEST-VAL model → TEST DER {der:.2f}%  WER {wer:.2f}%  (SOTA ~1-2% DER / ~3-6% WER)", file=sys.stderr)
torch.save({"state": model.state_dict(), "chars": chars, "labels": labels, "cfg": vars(args)}, args.ckpt)
print(f"# saved {args.ckpt} (best-val); resumable state at {RESUME_PATH}", file=sys.stderr)
