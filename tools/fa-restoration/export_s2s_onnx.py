import sys, re, random, json
import torch, torch.nn as nn, torch.nn.functional as F
random.seed(1234); torch.manual_seed(1234)
dev="cuda" if torch.cuda.is_available() else "cpu"
def load(p):
    R=[]
    for l in open(p,encoding="utf8"):
        if not l.strip() or l.startswith("#"): continue
        a=l.rstrip("\n").split("\t")
        if len(a)>=3: R.append((a[0],a[2].split("|")[0]))
    return R
gold=load(sys.argv[1]); random.shuffle(gold)
sp=int(len(gold)*0.9); train,test=gold[:sp],gold[sp:]
testw=set(w for w,_ in test)
extra=[r for r in load(sys.argv[2]) if r[0] not in testw] if len(sys.argv)>3 else []
tr=train+extra
def itoks(s):
    s=re.sub(r"[ˈˌ]","",s);o=[];i=0
    while i<len(s):
        c=s[i]
        if c in "aeiouɒæ":
            v=c
            if i+1<len(s) and s[i+1]=="ː": v+="ː";i+=1
            o.append(v)
        elif c=="͡":
            if o and i+1<len(s): o[-1]+="͡"+s[i+1];i+=1
        elif c=="ː":
            if o: o[-1]+="ː"
        else: o.append(c)
        i+=1
    return o
PAD,BOS,EOS,UNK=0,1,2,3
def mkv(seqs):
    v={"<pad>":0,"<bos>":1,"<eos>":2,"<unk>":3}
    for s in seqs:
        for t in s:
            if t not in v: v[t]=len(v)
    return v
srcs=[list(w) for w,_ in tr]; tgts=[itoks(i) for _,i in tr]
sv=mkv(srcs); tv=mkv(tgts); H=256
es=lambda s:[sv.get(c,UNK) for c in s]; et=lambda s:[BOS]+[tv.get(c,UNK) for c in s]+[EOS]
class S2S(nn.Module):
    def __init__(s,ns,nt,emb=128,h=256):
        super().__init__();s.es=nn.Embedding(ns,emb,padding_idx=0);s.et=nn.Embedding(nt,emb,padding_idx=0)
        s.enc=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2)
        s.dec=nn.LSTM(emb+2*h,2*h,1,batch_first=True);s.att=nn.Linear(2*h,2*h);s.out=nn.Linear(4*h,nt);s.h=h
    def encode(s,x): return s.enc(s.es(x))[0]
    def step(s,y,h,c,enc_o,mask):
        ye=s.et(y);dh=h[-1].unsqueeze(1)
        sc=(s.att(enc_o)*dh).sum(-1).masked_fill(~mask,-1e9);a=F.softmax(sc,-1).unsqueeze(1)
        ctx=a@enc_o;do,(h2,c2)=s.dec(torch.cat([ye,ctx],-1),(h,c))
        return s.out(torch.cat([do,ctx],-1)),h2,c2
m=S2S(len(sv),len(tv),h=H).to(dev)
opt=torch.optim.Adam(m.parameters(),lr=1e-3);crit=nn.CrossEntropyLoss(ignore_index=PAD)
S=[es(x) for x in srcs];T=[et(x) for x in tgts]
def batches(bs=64):
    idx=list(range(len(S)));random.shuffle(idx)
    for k in range(0,len(idx),bs):
        b=idx[k:k+bs];sm=max(len(S[i]) for i in b);tm=max(len(T[i]) for i in b)
        X=torch.zeros(len(b),sm,dtype=torch.long);Y=torch.zeros(len(b),tm,dtype=torch.long)
        for r,i in enumerate(b): X[r,:len(S[i])]=torch.tensor(S[i]);Y[r,:len(T[i])]=torch.tensor(T[i])
        yield X.to(dev),Y.to(dev)
for e in range(30):
    m.train()
    for X,Y in batches():
        mask=(X!=0);enc_o=m.encode(X);h=torch.zeros(1,X.size(0),2*H,device=dev);c=torch.zeros(1,X.size(0),2*H,device=dev)
        logits=[]
        for t in range(Y.size(1)-1):
            lo,h,c=m.step(Y[:,t:t+1],h,c,enc_o,mask);logits.append(lo)
        L=torch.cat(logits,1);loss=crit(L.reshape(-1,len(tv)),Y[:,1:].reshape(-1))
        opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(m.parameters(),1.0);opt.step()
m.eval().cpu()
# export encoder + decoder-step
class Enc(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,x):return s.m.encode(x)
class Step(nn.Module):
    def __init__(s,m):super().__init__();s.m=m
    def forward(s,y,h,c,enc_o,mask):return s.m.step(y,h,c,enc_o,mask)
OUT=sys.argv[3] if len(sys.argv)<=3 else sys.argv[-1]
base=OUT
tok=torch.ones(1,6,dtype=torch.long)
torch.onnx.export(Enc(m),tok,base+".enc.onnx",input_names=["tokens"],output_names=["enc_o"],
    dynamic_axes={"tokens":{0:"B",1:"T"},"enc_o":{0:"B",1:"T"}},opset_version=17)
enc_o=m.encode(tok);h=torch.zeros(1,1,2*H);c=torch.zeros(1,1,2*H);mask=(tok!=0);y=torch.ones(1,1,dtype=torch.long)
torch.onnx.export(Step(m),(y,h,c,enc_o,mask),base+".dec.onnx",
    input_names=["y","h","c","enc_o","mask"],output_names=["logits","h_out","c_out"],
    dynamic_axes={"enc_o":{0:"B",1:"T"},"mask":{0:"B",1:"T"},"y":{0:"B"},"h":{1:"B"},"c":{1:"B"},"logits":{0:"B"},"h_out":{1:"B"},"c_out":{1:"B"}},opset_version=17)
json.dump({"src":sv,"tgt":tv,"H":H,"bos":BOS,"eos":EOS,"unk":UNK},open(base+".meta.json","w"),ensure_ascii=False)
print("exported",base+".{enc,dec}.onnx | src",len(sv),"tgt",len(tv))
