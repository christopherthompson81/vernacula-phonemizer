#!/usr/bin/env python3
"""French OOV G2P — BiLSTM vs the rule engine, on a clean Lexique held-out. Is a neural OOV reader worth it for French
(a far more REGULAR orthography than English)? Trains a char→IPA-chunk BiLSTM on 90% of Lexique and reports held-out
word/symbol accuracy vs the rule g2p's 76.6%/94.3%. French IPA is single-codepoint (nasal ɔ̃ = ɔ + combining tilde),
so SEP="" (the Norwegian path). Reuses align_parallel."""
import os, sys, time, random, hashlib, json
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "norwegian"))
from nb_tagger_parallel import align_parallel  # SEP="" default → single-char IPA chunks (e+ɪ=eɪ, ɔ+̃=ɔ̃)
LEX = os.path.join(HERE, "..", "..", "src", "languages", "french", "lexicon.tsv")
DEV = "cuda" if torch.cuda.is_available() else "cpu"
PAD = 0
FR = "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ-"

def load():
    rows = []
    for line in open(LEX, encoding="utf-8"):
        if line.startswith("#") or "\t" not in line: continue
        w, ipa = line.rstrip("\n").split("\t", 1)
        w = w.lower()
        if w and ipa and all(c in FR for c in w):
            rows.append((w, list(ipa)))
    return rows

def split(rows):
    tr, te = [], []
    for w, p in rows:
        (te if int(hashlib.md5(("fr:" + w).encode()).hexdigest(), 16) % 10 == 0 else tr).append((w, p))
    return tr, te

class Tagger(nn.Module):
    def __init__(s, nc, nt, emb=64, hid=256):
        super().__init__(); s.emb=nn.Embedding(nc,emb,padding_idx=PAD)
        s.lstm=nn.LSTM(emb,hid,2,bidirectional=True,batch_first=True,dropout=0.3); s.head=nn.Linear(2*hid,nt)
    def forward(s,x): return s.head(s.lstm(s.emb(x))[0])

def build(al):
    chars={"<pad>":PAD,"<unk>":1}; tags={"<pad>":PAD}; ct={}
    for _,a in al:
        for g,t in a:
            ci=chars.setdefault(g,len(chars)); ti=tags.setdefault(t,len(tags)); ct.setdefault(ci,set()).add(ti)
    return chars,tags,ct
def encode(al,chars,tags):
    X,Y=[],[]
    for _,a in al: X.append(torch.tensor([chars.get(g,1) for g,_ in a])); Y.append(torch.tensor([tags[t] for _,t in a]))
    return X,Y
def train(m,X,Y,ep=40):
    m.to(DEV).train(); opt=torch.optim.Adam(m.parameters(),lr=2e-3); sch=torch.optim.lr_scheduler.CosineAnnealingLR(opt,T_max=ep)
    lf=nn.CrossEntropyLoss(ignore_index=PAD); idx=list(range(len(X)))
    for e in range(ep):
        random.shuffle(idx); tot=0.0
        for b in range(0,len(idx),256):
            bi=idx[b:b+256]; xb=pad_sequence([X[i] for i in bi],batch_first=True).to(DEV); yb=pad_sequence([Y[i] for i in bi],batch_first=True).to(DEV)
            opt.zero_grad(); out=m(xb); loss=lf(out.reshape(-1,out.size(-1)),yb.reshape(-1)); loss.backward(); opt.step(); tot+=loss.item()
        sch.step()
        if e%10==0 or e==ep-1: print(f"  epoch {e}: loss {tot/max(1,len(idx)//256):.3f}",flush=True)
    return m
@torch.no_grad()
def predict(m,chars,itag,ct,w):
    m.eval(); ids=[chars.get(c) for c in w]
    if any(i is None for i in ids): return None
    lo=m(torch.tensor([ids]).to(DEV))[0]; out=""
    for k,cid in enumerate(ids):
        pm=ct.get(cid)
        if not pm: return None
        best=max(pm,key=lambda t: lo[k][t].item()); out+=itag[best]
    return out

def lev(a,b):
    d=list(range(len(b)+1))
    for i in range(1,len(a)+1):
        p=d[0]; d[0]=i
        for j in range(1,len(b)+1):
            t=d[j]; d[j]=min(d[j]+1,d[j-1]+1,p+(0 if a[i-1]==b[j-1] else 1)); p=t
    return d[len(b)]

def main():
    random.seed(0); torch.manual_seed(0); t0=time.time()
    print("device:",DEV); rows=load(); tr,te=split(rows)
    print(f"Lexique {len(rows)} → train {len(tr)} / held-out {len(te)}",flush=True)
    al=align_parallel(tr); print(f"aligned {len(al)}/{len(tr)} ({time.time()-t0:.0f}s)",flush=True)
    chars,tags,ct=build(al); itag={v:k for k,v in tags.items()}; X,Y=encode(al,chars,tags)
    print(f"{len(chars)} chars, {len(tags)} tags",flush=True)
    m=train(Tagger(len(chars),len(tags)),X,Y)
    ex=n=err=tot=0
    for w,ph in te:
        pr=predict(m,chars,itag,ct,w); n+=1
        if pr is None: continue
        truth="".join(ph)
        if pr==truth: ex+=1
        err+=lev(list(pr),list(truth)); tot+=max(len(pr),len(truth))
    print(f"\nBiLSTM held-out ({n} words):  WORD-exact {ex}/{n} = {100*ex/n:.1f}%   symbol acc {100*(1-err/tot):.1f}%   (total {time.time()-t0:.0f}s)",flush=True)

    if os.environ.get("FR_PRODUCTION"):  # retrain on FULL Lexique + export the shipped ONNX + meta (structuralTagger)
        print("\n[production] aligning + training on the FULL Lexique…",flush=True)
        alf=align_parallel(rows); chars,tags,ct=build(alf); itag={v:k for k,v in tags.items()}
        Xf,Yf=encode(alf,chars,tags); full=train(Tagger(len(chars),len(tags)),Xf,Yf); full.eval().cpu()
        SRC=os.path.join(HERE,"..","..","src","languages","french")
        torch.onnx.export(full,torch.tensor([[1,2,3,4]]),os.path.join(SRC,"fr-g2p-tagger.onnx"),
                          input_names=["chars"],output_names=["logits"],
                          dynamic_axes={"chars":{0:"batch",1:"len"},"logits":{0:"batch",1:"len"}},opset_version=17)
        meta={"src":chars,"tags":{str(i):itag[i] for i in range(len(tags))},"charTags":{str(ci):sorted(ti) for ci,ti in ct.items()}}
        json.dump(meta,open(os.path.join(SRC,"fr-g2p-tagger.meta.json"),"w",encoding="utf-8"),ensure_ascii=False)
        print(f"[production] exported → {SRC}/fr-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)",flush=True)

if __name__=="__main__": main()
