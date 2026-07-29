#!/usr/bin/env python3
"""fa short-vowel restoration — a char-level BiLSTM that targets IPA DIRECTLY (not harakat).

This is where we DIVERGE from the tools/perso-arabic/ pipeline (skeleton→harakat→g2p→IPA): the harakat
intermediate is lossy — it can't express ezafe / final ه / و, and the g2p-inversion labeler DROPPED 59% of our
Tajik-derived data (only 981/2400 words could be expressed as harakat that reproduces the IPA). Targeting the IPA
vowel directly keeps ALL of it.

Model: input = fa's g2p output (the consonant + long-vowel skeleton with a default [a] per short slot); a 2-layer
BiLSTM per-position tagger predicts the correct IPA vowel at each short slot (copies elsewhere). Trained on the
GPU (/mnt/data/ar-diac-venv, torch+cuda).

Inputs (regenerate the fa-engine alignment with tsx — see train_shortvowel notes / the investigation doc):
  <fa_gold_aligned.tsv>  word<TAB>fa-engine-ipa<TAB>gold-ipa(|-variants)   (from tools/persian/fa-abjad-ipa-gold.tsv)
  [tg_silver_aligned.tsv]  same shape, from fa-tg-silver.tsv (the Tajik-derived silver)
  /mnt/data/ar-diac-venv/bin/python train_ipa_bilstm.py fa_gold_aligned.tsv [tg_silver_aligned.tsv]

RESULT (2026-07-20, seed 1234, held-out UNSEEN words):
  baseline (fa [a] default):            16.0%
  BiLSTM IPA-target (gold only):        30.7%  (+14.7pp — nearly DOUBLES the OOV baseline)
  BiLSTM IPA-target (gold + Tajik):     32.2%  (+16.2pp — Tajik silver adds +1.5pp; the harakat path lost 59% of it)
The lexicon handles SEEN/frequent words separately (~exact); this is the OOV generalization tail. A larger model +
the full 40k-narrow wikipron + the aligned parallel corpus are the next scaling levers.
See docs/investigations/fa_shortvowel_restoration_investigation.md.
"""
import sys, re, random
import torch, torch.nn as nn
random.seed(1234); torch.manual_seed(1234)
dev = "cuda" if torch.cuda.is_available() else "cpu"
def toks(s):
    s=re.sub(r"[ˈˌ]","",s); out=[]; i=0
    while i<len(s):
        c=s[i]
        if c in "aeiouɒæ":
            v=c
            if i+1<len(s) and s[i+1]=="ː": v+="ː";i+=1
            out.append(v)
        elif c=="͡":
            if out and i+1<len(s): out[-1]+="͡"+s[i+1]; i+=1
        elif c=="ː":
            if out: out[-1]+="ː"
        else: out.append(c)
        i+=1
    return out
isV=lambda t: t and t[0] in "aeiouɒæ"; isShort=lambda t: len(t)==1 and isV(t)
def align(a,b):
    n,m=len(a),len(b); dp=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1): dp[i][0]=i
    for j in range(m+1): dp[0][j]=j
    for i in range(1,n+1):
        for j in range(1,m+1):
            c=0 if a[i-1]==b[j-1] else 1
            dp[i][j]=min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+c)
    i,j=n,m; out=[]
    while i>0 and j>0:
        c=0 if a[i-1]==b[j-1] else 1
        if dp[i][j]==dp[i-1][j-1]+c: out.append((a[i-1],b[j-1])); i-=1;j-=1
        elif dp[i][j]==dp[i-1][j]+1: out.append((a[i-1],None)); i-=1
        else: out.append((None,b[j-1])); j-=1
    while i>0: out.append((a[i-1],None)); i-=1
    while j>0: out.append((None,b[j-1])); j-=1
    return out[::-1]
def load(path):
    R=[]
    for l in open(path,encoding="utf8"):
        if not l.strip() or l.startswith("#"): continue
        p=l.rstrip("\n").split("\t")
        if len(p)>=3: R.append((p[0],p[1],p[2].split("|")[0]))
    return R
gold=load(sys.argv[1]); random.shuffle(gold)
sp=int(len(gold)*0.9); train_g, test = gold[:sp], gold[sp:]
extra = load(sys.argv[2]) if len(sys.argv)>2 else []
testw=set(w for w,_,_ in test)
extra=[r for r in extra if r[0] not in testw]
# build examples: input=fa-output tokens, per-position label = gold vowel (slot) or COPY
COPY="<copy>"
def examples(rows):
    ex=[]
    for w,eng,gd in rows:
        fa=toks(eng); g=toks(gd); al=align(fa,g)
        # only pure-substitution frames (no indels) for clean per-position labels
        if any(x is None or y is None for x,y in al): continue
        inp=[x for x,_ in al]; lab=[]
        for x,y in al:
            lab.append(y if (isShort(x) and isV(y)) else COPY)
        if inp: ex.append((inp,lab))
    return ex
tr=examples(train_g)+examples(extra); te=examples(test)
# vocab
itoks=sorted({t for inp,_ in tr for t in inp}|{"<unk>"}); i2i={t:i+1 for i,t in enumerate(itoks)}  # 0=pad
labs=sorted({l for _,lab in tr for l in lab}); l2i={l:i for i,l in enumerate(labs)}
enc=lambda inp:[i2i.get(t,i2i["<unk>"]) for t in inp]
print(f"# dev={dev} train_ex={len(tr)} test_ex={len(te)} itoks={len(itoks)} labels={len(labs)}",file=sys.stderr)
class Tagger(nn.Module):
    def __init__(s,nv,nl,emb=64,h=128):
        super().__init__(); s.emb=nn.Embedding(nv+1,emb,padding_idx=0)
        s.lstm=nn.LSTM(emb,h,num_layers=2,batch_first=True,bidirectional=True,dropout=0.2)
        s.fc=nn.Linear(2*h,nl)
    def forward(s,x): return s.fc(s.lstm(s.emb(x))[0])
model=Tagger(len(itoks),len(labs)).to(dev)
opt=torch.optim.Adam(model.parameters(),lr=2e-3,weight_decay=1e-5)
crit=nn.CrossEntropyLoss(ignore_index=-100)
def batches(ex,bs=64,shuf=True):
    idx=list(range(len(ex)))
    if shuf: random.shuffle(idx)
    for k in range(0,len(idx),bs):
        b=[ex[i] for i in idx[k:k+bs]]; ml=max(len(i) for i,_ in b)
        X=torch.zeros(len(b),ml,dtype=torch.long); Y=torch.full((len(b),ml),-100,dtype=torch.long)
        for r,(inp,lab) in enumerate(b):
            X[r,:len(inp)]=torch.tensor(enc(inp)); Y[r,:len(lab)]=torch.tensor([l2i[l] for l in lab])
        yield X.to(dev),Y.to(dev)
for ep in range(20):
    model.train()
    for X,Y in batches(tr):
        opt.zero_grad(); loss=crit(model(X).reshape(-1,len(labs)),Y.reshape(-1)); loss.backward(); opt.step()
# eval: whole-word IPA exact match (short vowels), baseline vs model
def norm(s): return re.sub(r"[ˈˌ]","","".join(s))
model.eval(); base=mod=tot=0
with torch.no_grad():
    for w,eng,gd in test:
        fa=toks(eng); golds=[norm(toks(x)) for x in [gd]]
        X=torch.zeros(1,len(fa),dtype=torch.long); X[0,:]=torch.tensor(enc(fa)); 
        pred=model(X.to(dev))[0].argmax(-1).tolist()
        out=[]
        for k,t in enumerate(fa):
            lab=labs[pred[k]]
            out.append(lab if (isShort(t) and lab!=COPY) else t)
        tot+=1
        if norm(fa) in golds: base+=1
        if norm(out) in golds: mod+=1
print(f"held-out test: {tot} words | +tajik={'yes' if extra else 'no'}")
print(f"  baseline (fa [a] default): {base} ({100*base/tot:.1f}%)")
print(f"  BiLSTM IPA-target model:   {mod} ({100*mod/tot:.1f}%)  (+{100*(mod-base)/tot:.1f}pp)")
