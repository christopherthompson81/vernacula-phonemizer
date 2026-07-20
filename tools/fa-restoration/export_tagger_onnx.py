import sys, re, random, json
import torch, torch.nn as nn
random.seed(1234); torch.manual_seed(1234)
dev="cuda" if torch.cuda.is_available() else "cpu"
def toks(s):
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
isV=lambda t: t and t[0] in "aeiouɒæ"; isShort=lambda t: len(t)==1 and isV(t)
def align(a,b):
    n,m=len(a),len(b); dp=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1): dp[i][0]=i
    for j in range(m+1): dp[0][j]=j
    for i in range(1,n+1):
        for j in range(1,m+1):
            c=0 if a[i-1]==b[j-1] else 1
            dp[i][j]=min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+c)
    i,j=n,m;out=[]
    while i>0 and j>0:
        c=0 if a[i-1]==b[j-1] else 1
        if dp[i][j]==dp[i-1][j-1]+c: out.append((a[i-1],b[j-1]));i-=1;j-=1
        elif dp[i][j]==dp[i-1][j]+1: out.append((a[i-1],None));i-=1
        else: out.append((None,b[j-1]));j-=1
    while i>0: out.append((a[i-1],None));i-=1
    while j>0: out.append((None,b[j-1]));j-=1
    return out[::-1]
def load(p):
    R=[]
    for l in open(p,encoding="utf8"):
        if not l.strip() or l.startswith("#"): continue
        a=l.rstrip("\n").split("\t")
        if len(a)>=3: R.append((a[0],a[1],a[2].split("|")[0]))
    return R
rows=load(sys.argv[1])+ (load(sys.argv[2]) if len(sys.argv)>2 else [])
COPY="<copy>"
ex=[]
for w,eng,gd in rows:
    fa=toks(eng);g=toks(gd);al=align(fa,g)
    if any(x is None or y is None for x,y in al): continue
    inp=[x for x,_ in al];lab=[y if (isShort(x) and isV(y)) else COPY for x,y in al]
    if inp: ex.append((inp,lab))
itoks=sorted({t for inp,_ in ex for t in inp}|{"<unk>"}); i2i={t:i+1 for i,t in enumerate(itoks)}
labs=sorted({l for _,lab in ex for l in lab}); l2i={l:i for i,l in enumerate(labs)}
enc=lambda inp:[i2i.get(t,i2i["<unk>"]) for t in inp]
class Tagger(nn.Module):
    def __init__(s,nv,nl,emb=64,h=128):
        super().__init__();s.emb=nn.Embedding(nv+1,emb,padding_idx=0)
        s.lstm=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2);s.fc=nn.Linear(2*h,nl)
    def forward(s,x): return s.fc(s.lstm(s.emb(x))[0])
model=Tagger(len(itoks),len(labs)).to(dev)
opt=torch.optim.Adam(model.parameters(),lr=2e-3,weight_decay=1e-5);crit=nn.CrossEntropyLoss(ignore_index=-100)
def batches(bs=64):
    idx=list(range(len(ex)));random.shuffle(idx)
    for k in range(0,len(idx),bs):
        b=[ex[i] for i in idx[k:k+bs]];ml=max(len(i) for i,_ in b)
        X=torch.zeros(len(b),ml,dtype=torch.long);Y=torch.full((len(b),ml),-100,dtype=torch.long)
        for r,(inp,lab) in enumerate(b):
            X[r,:len(inp)]=torch.tensor(enc(inp));Y[r,:len(lab)]=torch.tensor([l2i[l] for l in lab])
        yield X.to(dev),Y.to(dev)
for e in range(20):
    model.train()
    for X,Y in batches(): opt.zero_grad();loss=crit(model(X).reshape(-1,len(labs)),Y.reshape(-1));loss.backward();opt.step()
model.eval().cpu()
OUT=sys.argv[3]
dummy=torch.ones(1,8,dtype=torch.long)
torch.onnx.export(model,dummy,OUT,input_names=["tokens"],output_names=["logits"],
    dynamic_axes={"tokens":{0:"B",1:"T"},"logits":{0:"B",1:"T"}},opset_version=17)
json.dump({"itoks":i2i,"labels":labs,"copy":COPY},open(OUT.replace(".onnx",".meta.json"),"w"),ensure_ascii=False)
print("exported",OUT,"| itoks",len(itoks),"labels",len(labs))
