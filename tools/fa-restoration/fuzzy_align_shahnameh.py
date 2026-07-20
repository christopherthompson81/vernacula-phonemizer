from collections import defaultdict
fa=[l.rstrip("\n") for l in open("fa_skels.txt",encoding="utf8")]
tg=[l.rstrip("\n") for l in open("tg_skels.txt",encoding="utf8")]
def tri(s): return {s[i:i+3] for i in range(len(s)-2)}
idx=defaultdict(list)
for j,s in enumerate(tg):
    if len(s)>=8:
        for g in tri(s): idx[g].append(j)
def blev(a,b,K):
    la,lb=len(a),len(b)
    if abs(la-lb)>K: return K+1
    prev=list(range(lb+1))
    for i in range(1,la+1):
        cur=[i]+[K+2]*lb; lo=max(1,i-K); hi=min(lb,i+K); best=K+1
        for j in range(lo,hi+1):
            c=0 if a[i-1]==b[j-1] else 1
            cur[j]=min(prev[j]+1,cur[j-1]+1,prev[j-1]+c); best=min(best,cur[j])
        if best>K: return K+1
        prev=cur
    return prev[lb] if prev[lb]<=K else K+1
used=[False]*len(tg); out=[]
for i,s in enumerate(fa):
    if len(s)<8: continue
    tgm=tri(s); cand=defaultdict(int)
    for g in tgm:
        for j in idx.get(g,()):
            if not used[j]: cand[j]+=1
    best=None; bd=3
    for j,_ in sorted(cand.items(),key=lambda x:-x[1])[:20]:
        d=blev(s,tg[j],2)
        if d<bd: bd=d; best=j
        if bd==0: break
    if best is not None: used[best]=True; out.append((i,best,bd))
open("fuzzy_all.txt","w").write("\n".join(f"{i}\t{j}\t{d}" for i,j,d in out)+"\n")
open("fuzzy_done.flag","w").write(f"{len(out)}\n")
