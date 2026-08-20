#!/usr/bin/env python3
"""
Decode a held-out SENTENCE set with a trained sentence-level model (with full
cross-word context) and emit per-word `undiac<TAB>predicted-diac<TAB>gold-diac`,
so a TS script can score CLEAN phoneme recovery (both sides through the identical
phonemization path → the hamzat-al-wasl convention cancels). Answers "high-90s
phoneme recovery?" fairly, unlike the word-isolated / artifact-laden WikiNews set.

Usage: python decode_sent.py --ckpt model.pt --test test.txt --out preds.tsv
"""
import argparse, sys
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", required=True)
ap.add_argument("--test", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--maxlen", type=int, default=400)
args = ap.parse_args()
dev = "cuda" if torch.cuda.is_available() else "cpu"
ck = torch.load(args.ckpt, map_location=dev, weights_only=False)
chars, labels, cfg = ck["chars"], ck["labels"], ck["cfg"]
ilabels = {i: l for l, i in labels.items()}

SHADDA = "ّ"; VOWELS = {"َ":"a","ُ":"u","ِ":"i","ْ":"o","ً":"F","ٌ":"N","ٍ":"K","ٰ":"^"}
MARKS = set([SHADDA]) | set(VOWELS); SPACE = "<sp>"; SPACE_LABEL = "_"
VMARK = {v: k for k, v in VOWELS.items()}
def is_letter(c):
    o = ord(c); return (0x0620<=o<=0x064A) or (0x0671<=o<=0x06D3) or o in (0x0629,0x0649)
def marks(lb):
    if lb in ("0","_"): return ""
    o=""; v=lb
    if lb.startswith("~"): o+=SHADDA; v=lb[1:]
    if v and v!="0": o+=VMARK.get(v,"")
    return o
def align(line):
    chs, lbs, wb = [], [], []  # wb: index in chs where each word starts
    for w in line.split():
        cs=list(w); i=0; wc=[]; wl=[]
        while i<len(cs):
            c=cs[i]
            if c in MARKS: return None
            if not is_letter(c): i+=1; continue
            wc.append(c); i+=1; sh=False; vo=None
            while i<len(cs) and cs[i] in MARKS:
                m=cs[i]
                if m==SHADDA: sh=True
                else: vo=VOWELS[m]
                i+=1
            wl.append(("~"+(vo or "0")) if sh else (vo or "0"))
        if not wc: continue
        if chs: chs.append(SPACE); lbs.append(SPACE_LABEL)
        wb.append(len(chs)); chs+=wc; lbs+=wl
    if len([c for c in chs if c!=SPACE])<2: return None
    return chs, lbs, wb

class BiLSTM(nn.Module):
    def __init__(s,nc,nl,emb,h,ly):
        super().__init__(); s.emb=nn.Embedding(nc,emb,padding_idx=0)
        s.lstm=nn.LSTM(emb,h,num_layers=ly,batch_first=True,bidirectional=True,dropout=0.3 if ly>1 else 0.0)
        s.fc=nn.Linear(2*h,nl)
    def forward(s,x,lengths=None):
        """⚠ PASS `lengths` — this script PADS its batches (pad_sequence above) and an unpacked BiLSTM reads
        the padding on the backward pass, so an unpacked decode scores a different model than serving runs.
        Same defect as the trainer had (investigation Run 41); fixed here so predictions emitted for scoring
        match what the deployed graph produces."""
        h = s.emb(x)
        if lengths is None: return s.fc(s.lstm(h)[0])
        pk = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(s.lstm(pk)[0], batch_first=True, total_length=x.size(1))
        return s.fc(out)
model=BiLSTM(len(chars),len(labels),cfg["emb"],cfg["hidden"],cfg["layers"]).to(dev)
model.load_state_dict(ck["state"]); model.eval()

rows=[]
with open(args.test,encoding="utf-8",errors="ignore") as f:
    for line in f:
        line=line.strip()
        if not line: continue
        a=align(line)
        if a and len(a[0])<=args.maxlen: rows.append(a)

def enc(cs): return torch.tensor([chars.get(c,1) for c in cs],dtype=torch.long)
out=open(args.out,"w",encoding="utf-8"); nword=0
B=64
for i in range(0,len(rows),B):
    batch=rows[i:i+B]
    xs=[enc(cs) for cs,_,_ in batch]; lens=[len(x) for x in xs]
    X=pad_sequence(xs,batch_first=True,padding_value=0).to(dev)
    with torch.no_grad(): pred=model(X).argmax(-1).cpu()
    for (chs,lbs,wb),L,p in zip(batch,lens,[pred[j] for j in range(len(batch))]):
        # split into words at SPACE
        seg=[]; cur=[]
        for j in range(L):
            if chs[j]==SPACE: seg.append(cur); cur=[]
            else: cur.append(j)
        seg.append(cur)
        for w in seg:
            if len(w)<2: continue
            undiac="".join(chs[j] for j in w)
            predw="".join(chs[j]+marks(ilabels[int(p[j])]) for j in w)
            goldw="".join(chs[j]+marks(lbs[j]) for j in w)
            out.write(f"{undiac}\t{predw}\t{goldw}\n"); nword+=1
out.close()
print(f"# decoded {len(rows)} sentences → {nword} words → {args.out}",file=sys.stderr)
