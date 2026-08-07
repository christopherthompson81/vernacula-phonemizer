#!/usr/bin/env python3
"""Train + held-out-eval + export the MODERN Persian context model (HomoRich, canonical IPA). See
build_homorich_ipa.py for how homorich_ipa.tsv is produced (Grapheme<TAB>canonical-IPA<TAB>homograph-word-index,
ZWNJ-concatenated, gheyn-conditioned). Sentence-level char seq2seq (BiLSTM enc + attention dec) — arch IDENTICAL to
export_context_onnx.py so contextRestorer.ts runs it unchanged.

Two upgrades over the plain encoder: (1) HOMOGRAPH LOSS-WEIGHTING — HomoRich marks which word is the tricky homograph (3rd column); its
target chars get weight W so its gradient isn't diluted ~10× among the other words. (2) PATIENCE early-stopping on a
val split (loss was still dropping at a fixed 7 epochs). (3) UNCAPPED data. Reports overall held-out per-word AND a
HOMOGRAPH-SPECIFIC accuracy (on the annotated word) so that lever is visible. Exports enc/dec ONNX (fp32) + int8.

RESUMABLE: a per-epoch checkpoint (<input>.ckpt.pt, keyed to the dataset) is written after every epoch; re-running
picks up where it left off (RNG restored so batch shuffles continue identically). Delete the .ckpt.pt to start fresh.

  $ARDIAC_PY export_modern_context_onnx.py <scratchdir> [input.tsv=homorich_ipa.tsv] [warm.ckpt.pt]

argv[3] (optional) = a warm-start checkpoint (a prior run's .ckpt.pt): load its best_state and fine-tune from there
with scheduled sampling from epoch 1 (no teacher-forcing warmup) at a reduced LR — the efficient way to add SS to an
already-converged model instead of re-learning the base mapping from scratch.
"""
import sys, os, random, json, time, copy
import torch, torch.nn as nn, torch.nn.functional as F
random.seed(1234); torch.manual_seed(1234)
dev = "cuda" if torch.cuda.is_available() else "cpu"
SP = sys.argv[1]
# argv[2] = input tsv basename (default homorich_ipa.tsv). The RESUME checkpoint is keyed to it, so a clean-data run
# and a dirty-data run keep SEPARATE checkpoints and never resume from each other.
INPUT = sys.argv[2] if len(sys.argv) > 2 else "homorich_ipa.tsv"
WARM_START = sys.argv[3] if len(sys.argv) > 3 else None
# Scheduled-sampling MODE: "token" = per-step independent substitution (default); "rollout" = STICKY contiguous
# spans (mean length SS_SPAN) so multi-char loops actually FORM during training and the gt-anchored loss teaches
# breaking them — targeting the sustained mid-sequence/tail loops per-token SS is too fragmentary to reach.
SS_MODE = os.environ.get("FA_SS_MODE", "token"); SS_SPAN = int(os.environ.get("FA_SS_SPAN", 8))
HOM_OVERSAMPLE = int(os.environ.get("FA_HOM_OVERSAMPLE", 1))  # duplicate homograph-labelled train rows N× (target the homograph slice)
CKPT = f"{SP}/{os.path.splitext(INPUT)[0]}{'.warm' if WARM_START else ''}{'.'+SS_MODE if SS_MODE != 'token' else ''}{'.hx'+str(HOM_OVERSAMPLE) if HOM_OVERSAMPLE > 1 else ''}.ckpt.pt"
W_HOM = 4.0          # loss weight on the homograph word's target chars
MAX_EPOCHS = int(os.environ.get("FA_MAX_EPOCHS", 25)); PATIENCE = 3
# FA_NO_EARLYSTOP=1 runs to MAX_EPOCHS regardless of patience (and, on resume, clears a prior early-stop) — for
# continuing a plateaued run further to explore whether more epochs at ss=SS_MAX reach a higher score peak.
NO_EARLYSTOP = bool(os.environ.get("FA_NO_EARLYSTOP"))
# scheduled sampling: teacher-force WARMUP epochs then ramp own-prediction rate to SS_MAX. A warm start is ALREADY
# converged, so skip the warmup (SS from epoch 1) and fine-tune at a reduced LR.
WARMUP, SS_MAX = (0, 0.30) if WARM_START else (4, 0.30)
SS_MAX = float(os.environ.get("FA_SS_MAX", SS_MAX))   # override (e.g. 0.22 — full 0.30 rollout overshoots)
LR = 3e-4 if WARM_START else 1e-3

rows = []
for l in open(f"{SP}/{INPUT}", encoding="utf8"):
    p = l.rstrip("\n").split("\t")
    if len(p) >= 2 and p[0] and p[1]:
        rows.append((p[0], p[1], int(p[2]) if len(p) > 2 else -1))
random.shuffle(rows)
n = len(rows); n_test = n // 10; n_val = n // 10
test_r = rows[:n_test]; val_r = rows[n_test:n_test+n_val]; train_r = rows[n_test+n_val:]
# NOTE: oversampling is applied AFTER the vocab is built (below) — the vocab is first-seen-order dependent, so
# reshuffling train_r here would remap char→id and misalign a warm-start's weights. See HOM_OVERSAMPLE block later.
PAD, BOS, EOS, UNK = 0, 1, 2, 3; H = 256
def mkv(seqs):
    v = {"<pad>": 0, "<bos>": 1, "<eos>": 2, "<unk>": 3}
    for s in seqs:
        for t in s:
            if t not in v: v[t] = len(v)
    return v
sv = mkv([list(a) for a, _, _ in train_r]); tv = mkv([list(b) for _, b, _ in train_r])
es = lambda s: [sv.get(c, UNK) for c in s]; et = lambda s: [BOS] + [tv.get(c, UNK) for c in s] + [EOS]
itv = {i: t for t, i in tv.items()}

def tgt_weights(ipa, hidx):
    """Per-target-char weight (len == len(et(ipa))): W_HOM on the homograph word's chars, 1.0 elsewhere."""
    w = [1.0] * (len(ipa) + 2)  # BOS + chars + EOS
    if hidx >= 0:
        words = ipa.split(" ")
        if hidx < len(words):
            start = len(" ".join(words[:hidx])) + (1 if hidx > 0 else 0)
            end = start + len(words[hidx])
            for p in range(start, end): w[p + 1] = W_HOM  # +1 for the leading BOS
    return w

class S2S(nn.Module):
    def __init__(s, ns, nt, emb=128, h=256):
        super().__init__(); s.es = nn.Embedding(ns, emb, 0); s.et = nn.Embedding(nt, emb, 0)
        s.enc = nn.LSTM(emb, h, 2, batch_first=True, bidirectional=True, dropout=0.2)
        s.dec = nn.LSTM(emb+2*h, 2*h, 1, batch_first=True); s.att = nn.Linear(2*h, 2*h); s.out = nn.Linear(4*h, nt); s.h = h
    def encode(s, x): return s.enc(s.es(x))[0]
    def step(s, y, h, c, eo, aeo, m):
        ye = s.et(y); dh = h[-1].unsqueeze(1); sc = (aeo*dh).sum(-1).masked_fill(~m, -1e9); a = F.softmax(sc, -1).unsqueeze(1)
        ctx = a@eo; do, (h2, c2) = s.dec(torch.cat([ye, ctx], -1), (h, c)); return s.out(torch.cat([do, ctx], -1)), h2, c2

def free_run_score(k=300):
    """FREE-RUNNING selection metric: greedy-decode k val sentences (as inference does) and score per-word +
    degeneration SEVERITY (total excess words). Teacher-forced val loss is blind to free-running degeneration —
    the whole point of scheduled sampling — so selection/stopping must use THIS, not the val loss."""
    m.eval(); W = ok = 0; excess = 0; hW = hOk = 0
    with torch.no_grad():
        for g, gold, hidx in val_r[:k]:
            X = torch.tensor([es(g)], device=dev); mask = (X != 0); eo = m.encode(X); aeo = m.att(eo)
            h = torch.zeros(1, 1, 2*H, device=dev); c = torch.zeros(1, 1, 2*H, device=dev); y = torch.tensor([[BOS]], device=dev); o = []
            for _ in range(len(g)*3+5):
                oo, h, c = m.step(y, h, c, eo, aeo, mask); nx = oo.argmax(-1).item()
                if nx == EOS: break
                o.append(itv.get(nx, "")); y = torch.tensor([[nx]], device=dev)
            p = "".join(o).split(); gw = gold.split()
            excess += max(0, len(p) - len(gw))
            for j, gg in enumerate(gw):
                W += 1
                if j < len(p) and p[j] == gg: ok += 1
            if 0 <= hidx < len(gw):   # homograph-word accuracy
                hW += 1
                if hidx < len(p) and p[hidx] == gw[hidx]: hOk += 1
    return 100*ok/max(W, 1), excess, 100*hOk/max(hW, 1)  # (per-word %, excess severity, homograph-word %)

m = S2S(len(sv), len(tv), h=H).to(dev); opt = torch.optim.Adam(m.parameters(), LR)
crit = nn.CrossEntropyLoss(ignore_index=PAD, reduction="none")
def prep(rs):
    return [es(a) for a, _, _ in rs], [et(b) for _, b, _ in rs], [tgt_weights(b, h) for _, b, h in rs]
# Oversample homograph-labelled TRAIN rows NOW — AFTER the vocab (sv/tv) is fixed from the original order, so a
# warm-start's char→id mapping is preserved (test/val untouched). Duplicating rows can't add chars, so vocab is safe.
if HOM_OVERSAMPLE > 1:
    train_r = train_r + [r for r in train_r if r[2] >= 0] * (HOM_OVERSAMPLE - 1)
    random.shuffle(train_r)
Strn, Ttrn, Wtrn = prep(train_r); Sval, Tval, Wval = prep(val_r)
print(f"# dev={dev} train={len(train_r)} val={len(val_r)} test={len(test_r)} src={len(sv)} tgt={len(tv)}", file=sys.stderr, flush=True)

def batches(N, shuffle=True):
    idx = list(range(N))
    if shuffle: random.shuffle(idx)
    for k in range(0, N, 128):
        yield idx[k:k+128]
def run_batch(b, S, T, Wt, ss=0.0):
    sm = max(len(S[i]) for i in b); tm = max(len(T[i]) for i in b)
    X = torch.zeros(len(b), sm, dtype=torch.long); Y = torch.zeros(len(b), tm, dtype=torch.long); WM = torch.zeros(len(b), tm)
    for r, i in enumerate(b):
        X[r, :len(S[i])] = torch.tensor(S[i]); Y[r, :len(T[i])] = torch.tensor(T[i]); WM[r, :len(Wt[i])] = torch.tensor(Wt[i])
    X, Y, WM = X.to(dev), Y.to(dev), WM.to(dev); mask = (X != 0); eo = m.encode(X); aeo = m.att(eo)
    h = torch.zeros(1, X.size(0), 2*H, device=dev); c = torch.zeros(1, X.size(0), 2*H, device=dev); lg = []
    # SCHEDULED SAMPLING: at rate ss, feed the decoder its OWN argmax from the previous step instead of the gold
    # token. Teacher forcing (ss=0) leaves the model unable to recover from its own errors → free-running loops
    # (the EOS-failure degeneration). Sampling teaches recovery. Loss is still against the gold next-token.
    prev = Y[:, 0:1]  # BOS at t=0
    span = torch.zeros(X.size(0), 1, dtype=torch.long, device=dev)  # rollout-mode substitution-span countdown
    for t in range(Y.size(1)-1):
        o, h, c = m.step(prev, h, c, eo, aeo, mask); lg.append(o)
        gt_next = Y[:, t+1:t+2]
        if ss > 0.0:
            pred_next = o.argmax(-1).detach()  # non-differentiable sampled input (standard scheduled sampling)
            if SS_MODE == "rollout":
                # STICKY spans: start a length-SS_SPAN substitution span with prob ss/SS_SPAN (→ overall rate ≈ ss),
                # then feed own predictions CONTIGUOUSLY for that span so a loop can develop and be corrected.
                start = (span == 0) & (torch.rand(X.size(0), 1, device=dev) < ss / SS_SPAN)
                span = torch.where(start, torch.full_like(span, SS_SPAN), span)
                use_pred = (span > 0) & (gt_next != PAD)
                span = torch.clamp(span - 1, min=0)
            else:
                use_pred = (torch.rand(X.size(0), 1, device=dev) < ss) & (gt_next != PAD)  # per-token, independent
            prev = torch.where(use_pred, pred_next, gt_next)
        else:
            prev = gt_next
    L = torch.cat(lg, 1)
    per = crit(L.reshape(-1, len(tv)), Y[:, 1:].reshape(-1))  # [B*(tm-1)]
    wt = WM[:, 1:].reshape(-1); denom = ((Y[:, 1:].reshape(-1) != PAD).float() * wt).sum().clamp(min=1)
    return (per * wt).sum() / denom

# Selection SCORE = free-running per-word − SEV_PEN·(degeneration severity). frr alone is noisy/flat and lenient to
# degeneration (prefix-aligned); severity (excess words) carries the signal scheduled sampling actually improves.
# The combined score rewards accuracy AND penalises severe/loopy output, so it selects the model we'd ship.
SEV_PEN = 0.03; HOM_W = float(os.environ.get("FA_HOM_W", 0.0))   # score = per-word − SEV_PEN·excess + HOM_W·homograph%
# HOM_W defaults 0 (the PROVEN selection that produced the shipped model): a homograph-in-selection experiment
# (FA_HOM_W=0.1 + FA_HOM_OVERSAMPLE) over-rewarded the homograph slice and selected a model with WORSE pipeline
# degeneration (+1pp homograph but 1.4%→2.6% degeneration, pipeline 90.5%→90.3%) — Tier-1 tuning did not beat ep3.
best_score = -1e9; best_state = None; bad = 0; start_epoch = 0; stopped = False
sig = (len(sv), len(tv), len(train_r), W_HOM, WARMUP, SS_MAX, bool(WARM_START), SS_MODE, SS_SPAN)  # data + CONFIG fp —
# refuse to resume across a different dataset OR a different training config (W_HOM / scheduled-sampling schedule),
# so an A/B run never silently continues from another config's checkpoint.
# RESUME: load the per-epoch checkpoint if one exists and matches this dataset. RNG state is restored so the batch
# shuffles continue the same stream (the deterministic-seed split above re-derives an identical train/val/test).
if os.path.exists(CKPT):
    ck = torch.load(CKPT, map_location=dev, weights_only=False)
    if ck.get("sig") == sig:
        m.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"])
        # tolerate a selection-metric change across the checkpoint (old runs stored best_frr/best_val): if best_score
        # is absent, reset it (−∞) so selection re-derives from here on the CURRENT metric — the model/opt/RNG still
        # resume, so no recompute is lost. This is what would have let us resume Run E instead of restarting.
        best_score = ck.get("best_score", -1e9); best_state = ck["best_state"]; bad = ck["bad"]; start_epoch = ck["epoch"] + 1
        stopped = ck.get("stopped", False)
        random.setstate(ck["py_rng"]); torch.set_rng_state(ck["torch_rng"].cpu())
        if torch.cuda.is_available() and ck.get("cuda_rng") is not None:
            torch.cuda.set_rng_state_all([s.cpu() for s in ck["cuda_rng"]])
        if NO_EARLYSTOP and stopped:   # continue a previously early-stopped run: clear the stop + patience
            stopped = False; bad = 0
        print(f"# RESUMED from {CKPT}: epoch {start_epoch}/{MAX_EPOCHS}, best score {best_score:.2f}, bad {bad}, no_earlystop={NO_EARLYSTOP}", file=sys.stderr, flush=True)
    else:
        print(f"# checkpoint {CKPT} sig {ck.get('sig')} != {sig} — ignoring, starting fresh", file=sys.stderr, flush=True)
# WARM START: only when beginning fresh (not resuming this run's own checkpoint) — load the prior run's best weights
# so scheduled-sampling fine-tuning starts from a converged model, not from scratch. Optimizer stays fresh (new LR).
if WARM_START and start_epoch == 0:
    wck = torch.load(WARM_START, map_location=dev, weights_only=False)
    m.load_state_dict(wck["best_state"])
    _bv = wck.get('best_val', wck.get('best_frr', 0.0))
    print(f"# WARM-STARTED from {WARM_START} (its best {_bv:.3f}); SS from epoch 1, LR {LR}", file=sys.stderr, flush=True)
for e in range(start_epoch, MAX_EPOCHS):
    if stopped: break
    # scheduled-sampling rate: teacher-force the first WARMUP epochs (learn the mapping), then ramp to SS_MAX so the
    # model learns to recover from its own predictions (kills free-running EOS-failure loops).
    ss = 0.0 if e < WARMUP else min(SS_MAX, SS_MAX * (e - WARMUP + 1) / 4)
    m.train(); te = time.time(); tl = 0.0; nb = 0
    for b in batches(len(Strn)):
        loss = run_batch(b, Strn, Ttrn, Wtrn, ss=ss)
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step()
        tl += loss.item(); nb += 1
    m.eval(); vl = 0.0; vnb = 0
    with torch.no_grad():
        for b in batches(len(Sval), shuffle=False):
            vl += run_batch(b, Sval, Tval, Wval).item(); vnb += 1  # val teacher-forced (ss=0) for a comparable signal
    vloss = vl/max(vnb, 1)
    frr, excess, hom = free_run_score()  # FREE-RUNNING per-word %, degeneration severity, homograph-word %
    score = frr - SEV_PEN * excess + HOM_W * hom  # combined selection metric (accuracy − severity + homograph)
    print(f"# epoch {e+1}/{MAX_EPOCHS} ss={ss:.2f} train={tl/max(nb,1):.3f} val={vloss:.3f} frr={frr:.1f}% excess={excess} hom={hom:.1f}% score={score:.2f} {time.time()-te:.0f}s", file=sys.stderr, flush=True)
    if score > best_score + 0.02:   # select on accuracy − severity (what inference ships), not teacher-forced val
        best_score = score; best_state = copy.deepcopy(m.state_dict()); bad = 0
    else:
        bad += 1
        if bad >= PATIENCE and not NO_EARLYSTOP:
            print(f"# early stop at epoch {e+1} (best score {best_score:.2f})", file=sys.stderr, flush=True); stopped = True
    # per-epoch checkpoint (atomic write): resume continues from here on a crash/kill.
    torch.save({"epoch": e, "model": m.state_dict(), "opt": opt.state_dict(), "best_score": best_score,
                "best_state": best_state, "bad": bad, "stopped": stopped, "sig": sig,
                "py_rng": random.getstate(), "torch_rng": torch.get_rng_state(),
                "cuda_rng": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None}, CKPT + ".tmp")
    os.replace(CKPT + ".tmp", CKPT)
    if stopped: break
if best_state is not None: m.load_state_dict(best_state)
m.eval()
def dec(x):
    X = torch.tensor([es(x)], device=dev); mask = (X != 0); eo = m.encode(X); aeo = m.att(eo)
    h = torch.zeros(1, 1, 2*H, device=dev); c = torch.zeros(1, 1, 2*H, device=dev); y = torch.tensor([[BOS]], device=dev); out = []
    for _ in range(len(x)*3+5):
        o, h, c = m.step(y, h, c, eo, aeo, mask); nx = o.argmax(-1).item()
        if nx == EOS: break
        out.append(itv.get(nx, "")); y = torch.tensor([[nx]], device=dev)
    return "".join(out)
w_ok = w_tot = h_ok = h_tot = 0; sent = 0
with torch.no_grad():
    for g, gold, hidx in test_r:
        if sent >= 1500: break
        sent += 1; pred = dec(g).split(); gw = gold.split()
        for k, gg in enumerate(gw):
            w_tot += 1
            if k < len(pred) and pred[k] == gg: w_ok += 1
        if 0 <= hidx < len(gw):
            h_tot += 1
            if hidx < len(pred) and pred[hidx] == gw[hidx]: h_ok += 1
print(f"HELD-OUT ({sent} sentences):")
print(f"  per-word          : {w_ok}/{w_tot} ({100*w_ok/max(w_tot,1):.1f}%)")
print(f"  HOMOGRAPH word    : {h_ok}/{h_tot} ({100*h_ok/max(h_tot,1):.1f}%)")
# export
m.cpu()
class Enc(nn.Module):
    def __init__(s, mm): super().__init__(); s.m = mm
    def forward(s, x): return s.m.encode(x)
class Step(nn.Module):
    def __init__(s, mm): super().__init__(); s.m = mm
    def forward(s, y, h, c, eo, m2): return s.m.step(y, h, c, eo, s.m.att(eo), m2)
base = f"{SP}/fa-context-modern"
tok = torch.ones(1, 6, dtype=torch.long)
torch.onnx.export(Enc(m), tok, base+".enc.onnx", input_names=["tokens"], output_names=["enc_o"],
  dynamic_axes={"tokens": {0: "B", 1: "T"}, "enc_o": {0: "B", 1: "T"}}, opset_version=17)
eo = m.encode(tok); h = torch.zeros(1, 1, 2*H); c = torch.zeros(1, 1, 2*H); mask = (tok != 0); y = torch.ones(1, 1, dtype=torch.long)
torch.onnx.export(Step(m), (y, h, c, eo, mask), base+".dec.onnx", input_names=["y", "h", "c", "enc_o", "mask"],
  output_names=["logits", "h_out", "c_out"],
  dynamic_axes={"enc_o": {0: "B", 1: "T"}, "mask": {0: "B", 1: "T"}, "y": {0: "B"}, "h": {1: "B"}, "c": {1: "B"}, "logits": {0: "B"}, "h_out": {1: "B"}, "c_out": {1: "B"}}, opset_version=17)
json.dump({"src": sv, "tgt": tv, "H": H, "bos": BOS, "eos": EOS, "unk": UNK}, open(base+".meta.json", "w"), ensure_ascii=False)
from onnxruntime.quantization import quantize_dynamic, QuantType
import os
for g in ("enc", "dec"): quantize_dynamic(f"{base}.{g}.onnx", f"{base}.{g}.int8.onnx", weight_type=QuantType.QInt8)
print("exported:", {g: os.path.getsize(f"{base}.{g}.int8.onnx") for g in ("enc", "dec")}, "src", len(sv), "tgt", len(tv))
