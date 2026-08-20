#!/usr/bin/env python3
"""The shared char→chunk BiLSTM tagger: vocab, encoding, training loop, and masked decode.

The invariant middle of the g2p-tagger pipeline (nb, en, da, fr). Each language script keeps its own ENDS —
`load()` (lexicon path, format, charset), `split()` (held-out policy), and the assembly of decoded chunks into a
final pronunciation — because those are where the languages genuinely differ. Everything here was byte-identical
(or differed only by hyperparameter) across the four before extraction.

HYPERPARAMETERS ARE PROVENANCE. The committed .onnx artifacts were trained at specific settings, so every caller
passes its own explicitly rather than relying on a default:
    nb  hid=128  batch=128  log_every=5
    en  hid=256  batch=256  log_every=5
    da  hid=256  batch=256  log_every=10
    fr  hid=256  batch=256  log_every=10
Changing a default here does not silently change what a retrain produces; changing a call site does.

⚠ AND ONE THING HERE DID CHANGE WHAT A RETRAIN PRODUCES, DELIBERATELY: `train()` now PACKS its padded batches
(2026-08-19). Unpacked, the BiLSTM's backward direction crossed the padding before reaching each word's last
real symbol, corrupting word-final predictions relative to batch=1 serving — worth 1.5pp word-exact on ckb,
the one tagger narrow enough to isolate it. Every committed .onnx except ckb's predates the fix. See
`Tagger.forward` and investigation Run 41.
"""
import random

import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

PAD = 0
DEV = "cuda" if torch.cuda.is_available() else "cpu"


class Tagger(nn.Module):
    def __init__(self, n_chars, n_tags, emb=64, hid=256):
        super().__init__()
        self.emb = nn.Embedding(n_chars, emb, padding_idx=PAD)
        self.lstm = nn.LSTM(emb, hid, num_layers=2, bidirectional=True, batch_first=True, dropout=0.3)
        self.head = nn.Linear(2 * hid, n_tags)

    def forward(self, x, lengths=None):
        """⚠ PASS `lengths` FOR ANY PADDED BATCH. Without packing, the BACKWARD direction of the BiLSTM runs
        over the pad steps BEFORE it reaches a word's last real symbol, so that symbol's representation is
        contaminated — by a varying amount, since it depends on the batch's longest word. Serving is batch=1
        and unpadded, where the backward pass starts cleanly at the true final symbol: a condition training
        barely presented. The damage lands precisely at the END OF THE WORD. Measured on ckb, whose tagger
        decides one thing (where an unwritten vowel goes) and so isolates the effect cleanly: it emitted a
        word-final vowel on 2.4% of referee vocabulary against 0.1% in its own training data, and packing took
        that to 0.1% and held-out word-exact from 95.1% to 96.6%. See
        docs/investigations/asr_align_qc_investigation.md Run 41.

        ⚠ THE AFFECTED SET IS EVERY BIDIRECTIONAL LSTM IN THE REPO THAT TRAINS ON PADDED BATCHES, which is
        wider than this module's four callers and wider than the first sweep found. Retrained 2026-08-19:
        ckb, en, sd, af, fr, bn, and the perso-arabic rider (+0.65pp DER, serves ur/pnb). STILL AFFECTED, all
        for want of a corpus rather than a decision: nb, da, he, fa-tagger, fa-vowel-restorer,
        fa-context-restorer, km-segmenter. `tools/CORPORA.md` now records how to fetch every one of those —
        the first sweep missed km/rider/fa-restorers because it searched for `*tagger*` trainers, so grep for
        `nn.LSTM(... bidirectional=True)` instead. The two Arabic diacritizers are AFFECTED TOO — their
        trainer lives in espeak-ng-portable and its collate already computes the lengths its forward never
        passes, which is very likely where this whole family inherited the bug. See tools/CORPORA.md."""
        h = self.emb(x)
        if lengths is None:
            return self.head(self.lstm(h)[0])
        packed = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(self.lstm(packed)[0], batch_first=True, total_length=x.size(1))
        return self.head(out)


def build_vocab(aligned):
    """aligned → (chars, tags, char_tags). char_tags maps char-id → the set of tag-ids that char ever emitted:
    the CONSONANT-CONSISTENCY MASK the serving decoders apply, so a letter can never emit a chunk unattested for it."""
    chars = {"<pad>": PAD, "<unk>": 1}
    tags = {"<pad>": PAD}
    char_tags = {}
    for _, a in aligned:
        for g, t in a:
            ci = chars.setdefault(g, len(chars))
            ti = tags.setdefault(t, len(tags))
            char_tags.setdefault(ci, set()).add(ti)
    return chars, tags, char_tags


def encode(aligned, chars, tags):
    X, Y = [], []
    for _, a in aligned:
        X.append(torch.tensor([chars.get(g, 1) for g, _ in a]))
        Y.append(torch.tensor([tags[t] for _, t in a]))
    return X, Y


def train(model, X, Y, epochs=40, batch=256, lr=2e-3, log_every=5, dev=None):
    """COSINE LR decay lr → ~0 over the run: a fixed lr overshoots the minimum in late epochs (training loss bottomed
    ~epoch 10 then climbed ~50%), so the last-epoch weights we export were PAST the minimum. Annealing lets the late
    epochs settle INTO it, so the final weights are the best — no best-checkpoint selection needed."""
    dev = dev or DEV
    model.to(dev).train()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.CrossEntropyLoss(ignore_index=PAD)
    idx = list(range(len(X)))
    for ep in range(epochs):
        random.shuffle(idx)
        tot = 0.0
        for b in range(0, len(idx), batch):
            bi = idx[b:b + batch]
            xb = pad_sequence([X[i] for i in bi], batch_first=True, padding_value=PAD).to(dev)
            yb = pad_sequence([Y[i] for i in bi], batch_first=True, padding_value=PAD).to(dev)
            lens = torch.tensor([len(X[i]) for i in bi])
            opt.zero_grad()
            out = model(xb, lens)  # packed — see Tagger.forward; unpacked padding corrupts word-final positions
            loss = loss_fn(out.reshape(-1, out.size(-1)), yb.reshape(-1))
            loss.backward(); opt.step(); tot += loss.item()
        sched.step()
        if ep % log_every == 0 or ep == epochs - 1:
            print(f"  epoch {ep}: loss {tot/max(1,len(idx)//batch):.3f}  lr {sched.get_last_lr()[0]:.2e}", flush=True)
    return model


@torch.no_grad()
def decode_chunks(model, chars, itag, char_tags, word, dev=None):
    """MASKED argmax over each letter's permitted chunk set → the list of emitted chunks, or None on an out-of-vocab
    grapheme (which is how serving declines rather than guessing). Callers assemble: "".join for single-char IPA,
    split(" ") per chunk for multi-token ARPABET, plus any language-specific post-pass (e.g. Norwegian one_stress).

    ⚠ ONE WORD PER CALL, AND THAT IS THE SLOW TAIL OF EVERY RETRAIN. nb decodes 62,838 held-out words this way:
    a single Python loop pinning one core at 100% while the GPU idles, because for a ~10-token input the
    kernel-launch overhead dwarfs the work. It is the reason nb overran a 5,400s budget that every other
    language fit inside.

    ⚠ BATCHING THIS IS NOW SAFE, AND IT WAS NOT BEFORE. A padded batch used to change the answer — the
    backward pass crossed the padding (see `Tagger.forward`) — so a batched held-out decode would have scored
    a different model than serving runs. With `lengths` the packed batch is bitwise the batch-1 result, which
    `smoke_test.py` check 8 asserts directly. So the speedup is unlocked BY the packing fix.
    NOT done during the 2026-08-19 rollout: changing the evaluator mid-campaign is the confound that already
    reversed two conclusions (bn, the rider). Do it as its own change, and verify the number is unmoved."""
    dev = dev or DEV
    model.eval()
    ids = [chars.get(c) for c in word]
    if any(i is None for i in ids):
        return None
    logits = model(torch.tensor([ids]).to(dev))[0]  # [T, nTags]
    out = []
    for k, cid in enumerate(ids):
        permitted = char_tags.get(cid)
        if not permitted:
            return None
        row = logits[k]
        out.append(itag[max(permitted, key=lambda t: row[t].item())])
    return out
