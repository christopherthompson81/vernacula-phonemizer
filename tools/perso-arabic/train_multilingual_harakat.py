#!/usr/bin/env python3
"""Fine-tune the Arabic harakat BiLSTM into a MULTILINGUAL Perso-Arabic restorer.

Warm-starts from the Arabic checkpoint (bilstm_pausal.pt — its char/label maps match src/languages/arabic/
diacritizer.meta.json, and multilingual_charvocab.json preserves those indices). The lstm+fc weights are
vocab-independent → copied directly; embedding rows are copied by CHAR IDENTITY (Arabic rows transfer, the new
rider letters init random). Language conditioning = a per-word language TOKEN prepended to the char sequence (no
architecture change, so the warm-start stays clean). Trains on the mined manifest (train.tsv/eval.tsv), riders
upsampled, and reports per-language DER on the held-out split.

  $ARDIAC_PY train_multilingual_harakat.py [--epochs 20 --upsample 4]
"""
import argparse, json, os, sys, copy, random
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--warm", default="$ARDIAC/bilstm_pausal.pt")
ap.add_argument("--vocab", default=os.path.join(HERE, "multilingual_charvocab.json"))
ap.add_argument("--train", default=os.path.join(HERE, "train.tsv"))
ap.add_argument("--eval", default=os.path.join(HERE, "eval.tsv"))
ap.add_argument("--ckpt", default="$ARDIAC/bilstm_multilingual.pt")
ap.add_argument("--epochs", type=int, default=25)
ap.add_argument("--upsample", type=int, default=4, help="(legacy uniform rider ×; superseded by --balance)")
ap.add_argument("--balance", type=int, default=4000, help="size-aware upsampling target: each rider → ~N examples")
ap.add_argument("--lr", type=float, default=7e-4)
ap.add_argument("--batch", type=int, default=128)
ap.add_argument("--patience", type=int, default=5)
ap.add_argument("--emb", type=int, default=128)
ap.add_argument("--hidden", type=int, default=512)
ap.add_argument("--layers", type=int, default=3)
# ⚠ RE-SCORE A SAVED CHECKPOINT WITHOUT RETRAINING. Added to compare two rider models on the SAME measurement:
# the 2026-08-19 packing change touched the DER pass as well as training, so each arm was otherwise scored under
# its own evaluator and the comparison was of their sum (the same confound that misread bn — Run 43).
# `--eval-unpacked` reproduces the pre-fix measurement deliberately, for exactly that decomposition.
ap.add_argument("--eval-ckpt", help="load this checkpoint, report DER, and exit (no training)")
ap.add_argument("--eval-unpacked", action="store_true", help="score with the OLD padded-unpacked eval pass")
ap.add_argument("--dropout", type=float, default=0.3)
args = ap.parse_args()
dev = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(1234); random.seed(1234)
print(f"# device={dev} torch={torch.__version__}", file=sys.stderr)

SHADDA = "ّ"
VOWELS = {"َ": "a", "ُ": "u", "ِ": "i", "ْ": "o", "ً": "F", "ٌ": "N", "ٍ": "K", "ٰ": "^"}
MARKS = set([SHADDA]) | set(VOWELS)
RIDERS = {"pa", "ur", "ps", "fa"}

# Char + label vocab from the committed multilingual map; append one language token per language (conditioning).
vocab = json.load(open(args.vocab, encoding="utf-8"))
chars = dict(vocab["chars"])
labels = dict(vocab["labels"])
LANGS = ["ar", "pa", "ur", "ps", "fa"]
LANG_TOK = {l: f"<lang:{l}>" for l in LANGS}
for l in LANGS:
    chars.setdefault(LANG_TOK[l], len(chars))
ilabels = {i: l for l, i in labels.items()}
print(f"# chars={len(chars)} labels={len(labels)}", file=sys.stderr)


def align(voc):
    """A vocalized word → (base chars, harakat labels). Script-agnostic: a base char is anything not a mark."""
    cs, ls = [], []
    i = 0
    s = list(voc)
    while i < len(s):
        c = s[i]
        if c in MARKS:
            return None
        cs.append(c); i += 1
        shadda = False; vowel = None
        while i < len(s) and s[i] in MARKS:
            m = s[i]
            if m == SHADDA: shadda = True
            else: vowel = VOWELS[m]
            i += 1
        v = vowel or "0"
        ls.append(("~" + v) if shadda else v)
    return (cs, ls) if cs else None


def pausalize(ls):
    """Strip the word-final case ending (iʿrāb: a/u/i/F/N/K → 0, keep shadda) — the syntactic vowel a pausal reader
    (and the g2p) discards. Matches the pausal warm-start; the riders are already pausal (no i'rab was mined)."""
    if not ls: return ls
    last = ls[-1]; core = last[1:] if last.startswith("~") else last
    if core in ("a", "u", "i", "F", "N", "K"):
        ls = ls[:-1] + ["~0" if last.startswith("~") else "0"]
    return ls


def load(path):
    rows = []
    for line in open(path, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) < 3: continue
        skel, lang, voc = p
        a = align(voc)
        if not a: continue
        cs, ls = a
        if lang == "ar": ls = pausalize(ls)  # match the pausal warm-start; riders are already pausal
        rows.append((lang, cs, ls))
    return rows


def enc(lang, cs, ls):
    xi = [chars[LANG_TOK[lang]]] + [chars.get(c, 1) for c in cs]  # prepend lang token
    yi = [-100] + [labels.get(l, labels["0"]) for l in ls]        # lang-token position ignored in loss
    return torch.tensor(xi), torch.tensor(yi), lang


train_rows = load(args.train)
eval_rows = load(args.eval)
# FIXED per-language replication so the small, structurally-different riders (pa/ps) aren't drowned by the data-rich
# ur/fa. Deliberately FROZEN (not derived from live counts): a count-derived `round(balance/count)` flips a rep on
# any small data change and swings the WHOLE shared eval ±2pts, making sub-point scaling steps unmeasurable. Adjust
# these consciously when a language's data scales a lot (e.g. drop ur→1 stays fine; if ur 10×'s, revisit).
from collections import Counter
REPS = {"ar": 1, "ur": 1, "fa": 1, "ps": 7, "pa": 9}
counts = Counter(lang for lang, _, _ in train_rows)
reps_of = {lang: REPS.get(lang, 1) for lang in set(counts)}
train_enc = []
for lang, cs, ls in train_rows:
    for _ in range(reps_of[lang]): train_enc.append(enc(lang, cs, ls))
eval_enc = [enc(lang, cs, ls) for lang, cs, ls in eval_rows]
print(f"# reps {reps_of}  train {len(train_rows)} → {len(train_enc)}  eval {len(eval_enc)}", file=sys.stderr)


def collate(b):
    xs, ys, lg = zip(*b)
    return (pad_sequence(xs, batch_first=True, padding_value=0),
            pad_sequence(ys, batch_first=True, padding_value=-100), lg,
            torch.tensor([len(x) for x in xs]))


class BiLSTM(nn.Module):
    def __init__(s, nc, nl, emb, h, ly):
        super().__init__()
        s.emb = nn.Embedding(nc, emb, padding_idx=0)
        s.lstm = nn.LSTM(emb, h, num_layers=ly, batch_first=True, bidirectional=True, dropout=args.dropout)
        s.fc = nn.Linear(2 * h, nl)
    def forward(s, x, lengths=None):
        """⚠ PASS `lengths` FOR A PADDED BATCH. Unpacked, the BACKWARD direction of the BiLSTM crosses the pad
        steps before it reaches each sentence's last real character, so that character's representation depends
        on the batch's longest sentence — while serving (riderNeural.ts) is one sentence at a time, unpadded.
        The damage lands at the END of the sentence. This is a SENTENCE-level model, so the affected span is
        the final word or two of every clause, not one letter. See investigation Run 45."""
        h = s.emb(x)
        if lengths is None:
            return s.fc(s.lstm(h)[0])
        pk = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(s.lstm(pk)[0], batch_first=True, total_length=x.size(1))
        return s.fc(out)


model = BiLSTM(len(chars), len(labels), args.emb, args.hidden, args.layers).to(dev)

# Warm-start: copy vocab-independent lstm+fc directly; copy embedding rows by CHAR IDENTITY.
ck = torch.load(args.warm, map_location=dev, weights_only=False)
ck_state, ck_chars = ck["state"], ck["chars"]
own = model.state_dict()
copied = 0
for k, v in ck_state.items():
    if k.startswith("emb."): continue
    if k in own and own[k].shape == v.shape:
        own[k] = v; copied += 1
with torch.no_grad():
    model.load_state_dict(own)
    src_emb = ck_state["emb.weight"]
    n_emb = 0
    for c, old_i in ck_chars.items():
        if c in chars:
            model.emb.weight[chars[c]] = src_emb[old_i]; n_emb += 1
print(f"# warm-start: copied {copied} lstm/fc tensors + {n_emb} embedding rows from {os.path.basename(args.warm)}",
      file=sys.stderr)
print(f"# params {sum(p.numel() for p in model.parameters())/1e6:.1f}M", file=sys.stderr)


opt = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-5)
sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, factor=0.5, patience=2)
crit = nn.CrossEntropyLoss(ignore_index=-100)
use_amp = dev == "cuda"
scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
tdl = torch.utils.data.DataLoader(train_enc, batch_size=args.batch, shuffle=True, collate_fn=collate)


def der_per_lang(rows):
    model.eval()
    err = {l: 0 for l in LANGS}; tot = {l: 0 for l in LANGS}
    dl = torch.utils.data.DataLoader(rows, batch_size=256, shuffle=False, collate_fn=collate)
    with torch.no_grad():
        for X, Y, lg, ln in dl:
            X, Y = X.to(dev), Y.to(dev)
            # ⚠ the DER pass is padded too — unpacked it scored the model under a condition serving never
            # presents, so the reported DER did not describe the served model either.
            pred = model(X, None if args.eval_unpacked else ln).argmax(-1)
            mask = Y != -100
            wrong = (pred != Y) & mask
            for b, lang in enumerate(lg):
                err[lang] += wrong[b].sum().item(); tot[lang] += mask[b].sum().item()
    return {l: (100 * err[l] / max(tot[l], 1), tot[l]) for l in LANGS}


best = 1e9; best_state = None; since = 0
if args.eval_ckpt:
    _ck = torch.load(args.eval_ckpt, map_location=dev, weights_only=False)
    model.load_state_dict(_ck["state"])
    _d = der_per_lang(eval_enc)
    _rd = sum(_d[l][0] * _d[l][1] for l in RIDERS) / max(sum(_d[l][1] for l in RIDERS), 1)
    print(f"# {os.path.basename(args.eval_ckpt)}  eval={'unpacked' if args.eval_unpacked else 'packed'}  "
          f"RIDER-DER {_rd:.2f}%  " + " ".join(f"{l} {_d[l][0]:.2f}%" for l in LANGS), file=sys.stderr)
    sys.exit(0)

for ep in range(args.epochs):
    model.train(); tl = 0.0
    for X, Y, lg, ln in tdl:
        X, Y = X.to(dev), Y.to(dev)
        opt.zero_grad()
        with torch.autocast("cuda", dtype=torch.float16, enabled=use_amp):
            loss = crit(model(X, ln).reshape(-1, len(labels)), Y.reshape(-1))
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); tl += loss.item()
    d = der_per_lang(eval_enc)
    rider_der = sum(d[l][0] * d[l][1] for l in RIDERS) / max(sum(d[l][1] for l in RIDERS), 1)
    sched.step(rider_der)
    tag = " ".join(f"{l} {d[l][0]:.1f}%" for l in LANGS)
    print(f"  ep {ep+1}/{args.epochs} loss {tl/len(tdl):.3f} | RIDER-DER {rider_der:.2f}% | {tag}", file=sys.stderr)
    if rider_der < best - 1e-4:
        best = rider_der; best_state = copy.deepcopy(model.state_dict()); since = 0
    else:
        since += 1
    if since >= args.patience:
        print(f"# early stop (best rider-DER {best:.2f}%)", file=sys.stderr); break

if best_state: model.load_state_dict(best_state)
final = der_per_lang(eval_enc)
print("# FINAL per-language DER (held-out): " + " ".join(f"{l} {final[l][0]:.2f}% (n={final[l][1]})" for l in LANGS),
      file=sys.stderr)
torch.save({"state": model.state_dict(), "chars": chars, "labels": labels,
            "lang_tokens": LANG_TOK, "cfg": vars(args)}, args.ckpt)
json.dump({"chars": chars, "labels": labels, "lang_tokens": LANG_TOK},
          open(os.path.join(HERE, "multilingual_diacritizer.meta.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print(f"# saved {args.ckpt} + multilingual_diacritizer.meta.json (best rider-DER {best:.2f}%)", file=sys.stderr)
