#!/usr/bin/env python3
"""fa short-vowel restoration — char-level SEQ2SEQ over the ABJAD (encoder-decoder + attention).

The Run-7 scaling finding pointed at INPUT REPRESENTATION as the real lever: the per-position frame-tagger
(train_ipa_bilstm.py) reads fa's COLLAPSED g2p output (consonants + long vowels + default-[a] slots), which has
already thrown away the و/ی/ه and word structure. This model reads the ABJAD LETTERS directly and generates IPA —
a BiLSTM encoder + LSTM decoder with dot-product attention. It is no longer constrained to the g2p frame's slots,
so it also handles ezafe / insertions the tagger cannot.

Trained on the GPU (/mnt/data/ar-diac-venv). Inputs = the aligned TSVs (word<TAB>fa-ipa<TAB>gold-ipa); only the
word (abjad) and the gold IPA are used.
  /mnt/data/ar-diac-venv/bin/python train_ipa_seq2seq.py fa_gold_aligned.tsv [tg_silver_aligned.tsv]

RESULT (2026-07-20, seed 1234, held-out UNSEEN words):
  baseline (fa [a] default):                    16.0%
  frame-tagger BiLSTM (IPA-frame in), +Tajik:   32.2%
  seq2seq (ABJAD in), gold:                      41.4%
  seq2seq (ABJAD in), gold + Tajik:              45.8%   (Tajik +4.4pp — scales UP with the stronger model)
Nearly 3x the OOV baseline. The lexicon covers seen/frequent words separately. Next: ONNX export to ship, the
parallel-corpus context for homographs/ezafe, convention-harmonized narrow. See the fa restoration investigation doc.
"""
import torch, torch.nn as nn, torch.nn.functional as F
random.seed(1234); torch.manual_seed(1234)
dev="cuda" if torch.cuda.is_available() else "cpu"
def load(p):
    R=[]
    for l in open(p,encoding="utf8"):
        if not l.strip() or l.startswith("#"): continue
        a=l.rstrip("\n").split("\t")
        if len(a)>=3: R.append((a[0], a[2].split("|")[0]))  # (abjad word, gold ipa)
    return R
gold=load(sys.argv[1]); random.shuffle(gold)
sp=int(len(gold)*0.9); train,test=gold[:sp],gold[sp:]
testw=set(w for w,_ in test)
extra=[r for r in load(sys.argv[2]) if r[0] not in testw] if len(sys.argv)>2 else []
tr=train+extra
def ipa_toks(s):
    s=re.sub(r"[ˈˌ]","",s); out=[];i=0
    while i<len(s):
        c=s[i]
        if c in "aeiouɒæ":
            v=c
            if i+1<len(s) and s[i+1]=="ː": v+="ː";i+=1
            out.append(v)
        elif c=="͡":
            if out and i+1<len(s): out[-1]+="͡"+s[i+1];i+=1
        elif c=="ː":
            if out: out[-1]+="ː"
        else: out.append(c)
        i+=1
    return out
PAD,BOS,EOS,UNK=0,1,2,3
def mkvocab(seqs):
    v={"<pad>":0,"<bos>":1,"<eos>":2,"<unk>":3}
    for s in seqs:
        for t in s:
            if t not in v: v[t]=len(v)
    return v
src_seqs=[list(w) for w,_ in tr]; tgt_seqs=[ipa_toks(i) for _,i in tr]
sv=mkvocab(src_seqs); tv=mkvocab(tgt_seqs); itv={i:t for t,i in tv.items()}
enc_s=lambda s:[sv.get(c,UNK) for c in s]
enc_t=lambda s:[BOS]+[tv.get(c,UNK) for c in s]+[EOS]
print(f"# dev={dev} train={len(tr)} test={len(test)} src_vocab={len(sv)} tgt_vocab={len(tv)}",file=sys.stderr)
class S2S(nn.Module):
    def __init__(s,nv_s,nv_t,emb=128,h=256):
        super().__init__()
        s.es=nn.Embedding(nv_s,emb,padding_idx=0); s.et=nn.Embedding(nv_t,emb,padding_idx=0)
        s.enc=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2)
        s.dec=nn.LSTM(emb+2*h,2*h,1,batch_first=True)
        s.att=nn.Linear(2*h,2*h); s.out=nn.Linear(4*h,nv_t); s.h=h
    def encode(s,src,slen):
        e=s.es(src); o,_=s.enc(e); return o
    def step(s,y_emb,hid,enc_o,mask):
        # attention: dot(dec_h, att(enc_o))
        dh=hid[0][-1].unsqueeze(1)  # (B,1,2h)
        sc=(s.att(enc_o)*dh).sum(-1)  # (B,T)
        sc=sc.masked_fill(~mask,-1e9); a=F.softmax(sc,-1).unsqueeze(1)  # (B,1,T)
        ctx=(a@enc_o)  # (B,1,2h)
        di=torch.cat([y_emb,ctx],-1)
        do,hid=s.dec(di,hid)
        return s.out(torch.cat([do,ctx],-1)), hid
    def init_hid(s,B):
        return (torch.zeros(1,B,2*s.h,device=dev),torch.zeros(1,B,2*s.h,device=dev))
model=S2S(len(sv),len(tv)).to(dev)
opt=torch.optim.Adam(model.parameters(),lr=1e-3)
crit=nn.CrossEntropyLoss(ignore_index=PAD)
def batches(S,T,bs=64):
    idx=list(range(len(S))); random.shuffle(idx)
    for k in range(0,len(idx),bs):
        b=idx[k:k+bs]; sm=max(len(S[i]) for i in b); tm=max(len(T[i]) for i in b)
        X=torch.zeros(len(b),sm,dtype=torch.long); Y=torch.zeros(len(b),tm,dtype=torch.long); L=[]
        for r,i in enumerate(b):
            X[r,:len(S[i])]=torch.tensor(S[i]); Y[r,:len(T[i])]=torch.tensor(T[i]); L.append(len(S[i]))
        yield X.to(dev),Y.to(dev)
S=[enc_s(x) for x in src_seqs]; T=[enc_t(x) for x in tgt_seqs]
for ep in range(30):
    model.train()
    for X,Y in batches(S,T):
        mask=(X!=0); enc_o=model.encode(X,None); hid=model.init_hid(X.size(0))
        ye=model.et(Y[:,:-1]); loss=0; 
        logits=[]
        h=hid
        for t in range(Y.size(1)-1):
            lo,h=model.step(ye[:,t:t+1],h,enc_o,mask); logits.append(lo)
        L=torch.cat(logits,1)
        loss=crit(L.reshape(-1,len(tv)),Y[:,1:].reshape(-1))
        opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
# greedy decode eval
def decode(w):
    X=torch.tensor([enc_s(list(w))],device=dev); mask=(X!=0)
    enc_o=model.encode(X,None); h=model.init_hid(1); y=torch.tensor([[BOS]],device=dev); out=[]
    for _ in range(40):
        lo,h=model.step(model.et(y),h,enc_o,mask); nid=lo.argmax(-1).item()
        if nid==EOS: break
        out.append(itv.get(nid,"")); y=torch.tensor([[nid]],device=dev)
    return "".join(out)
model.eval()
def n(s): return re.sub(r"[ˈˌ]","",s)
ok=0
with torch.no_grad():
    for w,g in test:
        if n(decode(w))==n(g): ok+=1
print(f"held-out {len(test)} unseen words | +tajik={'yes' if extra else 'no'}")
print(f"  seq2seq abjad→IPA exact: {ok} ({100*ok/len(test):.1f}%)")
