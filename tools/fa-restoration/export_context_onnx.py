import sys, random, json
import torch, torch.nn as nn, torch.nn.functional as F
random.seed(1234); torch.manual_seed(1234)
dev="cuda" if torch.cuda.is_available() else "cpu"
SP=sys.argv[1]
# char-level sentence pairs (fa hemistich chars incl space → ipa chars incl space) — FULL corpus (production)
rows=[l.rstrip("\n").split("\t") for l in open(f"{SP}/ctx_sent.tsv",encoding="utf8") if l.strip() and "\t" in l]
srcs=[list(a) for a,_ in rows]; tgts=[list(b) for _,b in rows]
PAD,BOS,EOS,UNK=0,1,2,3; H=256
def mkv(seqs):
    v={"<pad>":0,"<bos>":1,"<eos>":2,"<unk>":3}
    for s in seqs:
        for t in s:
            if t not in v: v[t]=len(v)
    return v
sv=mkv(srcs); tv=mkv(tgts)
es=lambda s:[sv.get(c,UNK) for c in s]; et=lambda s:[BOS]+[tv.get(c,UNK) for c in s]+[EOS]
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
for e in range(20):
    m.train(); idx=list(range(len(S))); random.shuffle(idx)
    for k in range(0,len(idx),128):
        b=idx[k:k+128]; sm=max(len(S[i]) for i in b); tm=max(len(T[i]) for i in b)
        X=torch.zeros(len(b),sm,dtype=torch.long);Y=torch.zeros(len(b),tm,dtype=torch.long)
        for r,i in enumerate(b): X[r,:len(S[i])]=torch.tensor(S[i]);Y[r,:len(T[i])]=torch.tensor(T[i])
        X,Y=X.to(dev),Y.to(dev);mask=(X!=0);eo=m.encode(X);aeo=m.att(eo)
        h=torch.zeros(1,X.size(0),2*H,device=dev);c=torch.zeros(1,X.size(0),2*H,device=dev);lg=[]
        for t in range(Y.size(1)-1): o,h,c=m.step(Y[:,t:t+1],h,c,eo,aeo,mask); lg.append(o)
        L=torch.cat(lg,1); loss=crit(L.reshape(-1,len(tv)),Y[:,1:].reshape(-1))
        opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(m.parameters(),1.0);opt.step()
    print(f"# ep{e} loss {loss.item():.3f}",file=sys.stderr)
m.eval().cpu()
class Enc(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,x):return s.m.encode(x)
class Step(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,y,h,c,eo,m2):return s.m.step(y,h,c,eo,s.m.att(eo),m2)
base=f"{SP}/fa-ctx"
tok=torch.ones(1,6,dtype=torch.long)
torch.onnx.export(Enc(m),tok,base+".enc.onnx",input_names=["tokens"],output_names=["enc_o"],dynamic_axes={"tokens":{0:"B",1:"T"},"enc_o":{0:"B",1:"T"}},opset_version=17)
eo=m.encode(tok);h=torch.zeros(1,1,2*H);c=torch.zeros(1,1,2*H);mask=(tok!=0);y=torch.ones(1,1,dtype=torch.long)
torch.onnx.export(Step(m),(y,h,c,eo,mask),base+".dec.onnx",input_names=["y","h","c","enc_o","mask"],output_names=["logits","h_out","c_out"],
  dynamic_axes={"enc_o":{0:"B",1:"T"},"mask":{0:"B",1:"T"},"y":{0:"B"},"h":{1:"B"},"c":{1:"B"},"logits":{0:"B"},"h_out":{1:"B"},"c_out":{1:"B"}},opset_version=17)
json.dump({"src":sv,"tgt":tv,"H":H,"bos":BOS,"eos":EOS,"unk":UNK},open(base+".meta.json","w"),ensure_ascii=False)
print("exported ctx enc/dec | src",len(sv),"tgt",len(tv))
