#!/usr/bin/env python3
"""Train + held-out-eval + export the MODERN Persian context model (HomoRich, canonical IPA). See
build_homorich_ipa.py for how homorich_ipa.tsv is produced (Grapheme<TAB>canonical-IPA, ZWNJ-concatenated,
gheyn-conditioned). Sentence-level char seq2seq (BiLSTM enc + attention dec) — arch IDENTICAL to
export_context_onnx.py so contextRestorer.ts runs it unchanged. 90/10 split: reports held-out whole-sentence +
per-word accuracy, then exports the model to enc/dec ONNX (fp32) + int8 + meta.json.

  /mnt/data/ar-diac-venv/bin/python export_modern_context_onnx.py <dir-with-homorich_ipa.tsv>
"""
import sys, random, json, time
import torch, torch.nn as nn, torch.nn.functional as F
random.seed(1234); torch.manual_seed(1234)
dev="cuda" if torch.cuda.is_available() else "cpu"
SP=sys.argv[1]
rows=[l.rstrip("\n").split("\t") for l in open(f"{SP}/homorich_ipa.tsv",encoding="utf8") if l.strip() and "\t" in l]
random.shuffle(rows)
CAP=250000
if len(rows)>CAP: rows=rows[:CAP]  # tractable GPU time (~41 min)
cut=int(len(rows)*0.9); train_r, test_r = rows[:cut], rows[cut:]
PAD,BOS,EOS,UNK=0,1,2,3; H=256
def mkv(seqs):
    v={"<pad>":0,"<bos>":1,"<eos>":2,"<unk>":3}
    for s in seqs:
        for t in s:
            if t not in v: v[t]=len(v)
    return v
srcs=[list(a) for a,_ in train_r]; tgts=[list(b) for _,b in train_r]
sv=mkv(srcs); tv=mkv(tgts)
es=lambda s:[sv.get(c,UNK) for c in s]; et=lambda s:[BOS]+[tv.get(c,UNK) for c in s]+[EOS]
itv={i:t for t,i in tv.items()}
class S2S(nn.Module):
    def __init__(s,ns,nt,emb=128,h=256):
        super().__init__();s.es=nn.Embedding(ns,emb,0);s.et=nn.Embedding(nt,emb,0)
        s.enc=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2)
        s.dec=nn.LSTM(emb+2*h,2*h,1,batch_first=True);s.att=nn.Linear(2*h,2*h);s.out=nn.Linear(4*h,nt);s.h=h
    def encode(s,x): return s.enc(s.es(x))[0]
    def step(s,y,h,c,eo,aeo,m):
        ye=s.et(y);dh=h[-1].unsqueeze(1);sc=(aeo*dh).sum(-1).masked_fill(~m,-1e9);a=F.softmax(sc,-1).unsqueeze(1)
        ctx=a@eo;do,(h2,c2)=s.dec(torch.cat([ye,ctx],-1),(h,c));return s.out(torch.cat([do,ctx],-1)),h2,c2
m=S2S(len(sv),len(tv),h=H).to(dev); opt=torch.optim.Adam(m.parameters(),1e-3); crit=nn.CrossEntropyLoss(ignore_index=PAD)
S=[es(a) for a in srcs]; T=[et(b) for b in tgts]
print(f"# dev={dev} train={len(train_r)} test={len(test_r)} src={len(sv)} tgt={len(tv)}",file=sys.stderr,flush=True)
for e in range(7):
    m.train(); idx=list(range(len(S))); random.shuffle(idx); te=time.time(); el=0.0; nb=0
    for k in range(0,len(idx),128):
        b=idx[k:k+128]; sm=max(len(S[i]) for i in b); tm=max(len(T[i]) for i in b)
        X=torch.zeros(len(b),sm,dtype=torch.long);Y=torch.zeros(len(b),tm,dtype=torch.long)
        for r,i in enumerate(b): X[r,:len(S[i])]=torch.tensor(S[i]);Y[r,:len(T[i])]=torch.tensor(T[i])
        X,Y=X.to(dev),Y.to(dev);mask=(X!=0);eo=m.encode(X);aeo=m.att(eo)
        h=torch.zeros(1,X.size(0),2*H,device=dev);c=torch.zeros(1,X.size(0),2*H,device=dev);lg=[]
        for t in range(Y.size(1)-1): o,h,c=m.step(Y[:,t:t+1],h,c,eo,aeo,mask); lg.append(o)
        L=torch.cat(lg,1); loss=crit(L.reshape(-1,len(tv)),Y[:,1:].reshape(-1))
        opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(m.parameters(),1.0);opt.step()
        el+=loss.item(); nb+=1
    print(f"# epoch {e+1}/7 loss={el/max(nb,1):.3f} {time.time()-te:.0f}s",file=sys.stderr,flush=True)
m.eval()
def dec(x):
    X=torch.tensor([es(x)],device=dev);mask=(X!=0);eo=m.encode(X);aeo=m.att(eo)
    h=torch.zeros(1,1,2*H,device=dev);c=torch.zeros(1,1,2*H,device=dev);y=torch.tensor([[BOS]],device=dev);out=[]
    for _ in range(len(x)*3+5):
        o,h,c=m.step(y,h,c,eo,aeo,mask);n=o.argmax(-1).item()
        if n==EOS:break
        out.append(itv.get(n,""));y=torch.tensor([[n]],device=dev)
    return "".join(out)
# held-out eval: whole-sentence exact + per-word
sent_ok=sent_tot=w_ok=w_tot=0
with torch.no_grad():
    for fa,gold in test_r:
        if sent_tot>=1000: break
        pred=dec(fa); sent_tot+=1; sent_ok+= (pred.strip()==gold.strip())
        pw=pred.split(); gw=gold.split()
        for k,g in enumerate(gw):
            w_tot+=1
            if k<len(pw) and pw[k]==g: w_ok+=1
print(f"HELD-OUT modern canonical-IPA eval ({sent_tot} sentences, {w_tot} words):")
print(f"  whole-sentence exact : {sent_ok}/{sent_tot} ({100*sent_ok/sent_tot:.1f}%)")
print(f"  per-word             : {w_ok}/{w_tot} ({100*w_ok/w_tot:.1f}%)")
# export enc/dec (fp32) + meta
m.cpu()
class Enc(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,x):return s.m.encode(x)
class Step(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,y,h,c,eo,m2):return s.m.step(y,h,c,eo,s.m.att(eo),m2)
base=f"{SP}/fa-context-modern"
tok=torch.ones(1,6,dtype=torch.long)
torch.onnx.export(Enc(m),tok,base+".enc.onnx",input_names=["tokens"],output_names=["enc_o"],
  dynamic_axes={"tokens":{0:"B",1:"T"},"enc_o":{0:"B",1:"T"}},opset_version=17)
eo=m.encode(tok);h=torch.zeros(1,1,2*H);c=torch.zeros(1,1,2*H);mask=(tok!=0);y=torch.ones(1,1,dtype=torch.long)
torch.onnx.export(Step(m),(y,h,c,eo,mask),base+".dec.onnx",input_names=["y","h","c","enc_o","mask"],
  output_names=["logits","h_out","c_out"],
  dynamic_axes={"enc_o":{0:"B",1:"T"},"mask":{0:"B",1:"T"},"y":{0:"B"},"h":{1:"B"},"c":{1:"B"},"logits":{0:"B"},"h_out":{1:"B"},"c_out":{1:"B"}},opset_version=17)
json.dump({"src":sv,"tgt":tv,"H":H,"bos":BOS,"eos":EOS,"unk":UNK},open(base+".meta.json","w"),ensure_ascii=False)
# int8 dynamic quantization
from onnxruntime.quantization import quantize_dynamic, QuantType
for g in ("enc","dec"):
    quantize_dynamic(f"{base}.{g}.onnx", f"{base}.{g}.int8.onnx", weight_type=QuantType.QInt8)
import os
print("exported:", {g: os.path.getsize(f"{base}.{g}.int8.onnx") for g in ("enc","dec")}, "src",len(sv),"tgt",len(tv))
