#!/usr/bin/env python3
"""Mine the referee misses with the MULTI-REFEREE method: where CLE (independent human) AND wikipron AGREE with each
other but disagree with our SHIPPED lexicon reading → a strong real-error candidate (two sources, one independent).
Normalises notation (ɾ/r, ʋ/v, geminate, nasal order) but NOT vowel quality — the interesting layer. Categorises the
candidates by diff type so systematic fixes surface."""
import re, unicodedata
from collections import Counter, defaultdict
HERE="/home/chris/Programming/vernacula-phonemizer"

U=["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i","b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"]
U=sorted(set(U),key=len,reverse=True)
def toks(s):
    o=[];i=0
    while i<len(s):
        for u in U:
            if s.startswith(u,i):o.append(u);i+=len(u);break
        else:o.append(s[i]);i+=1
    return o
def norm(ipa):  # notation fold: ɾ→r, ʋ→v, dental→plain, geminate collapse+drop ː, nasal order, strip stress
    s=unicodedata.normalize("NFD",ipa.replace("ˈ","").replace("ˌ","")).replace("̃ː","ː̃")
    s=s.replace("n̪","n").replace("ɳ","n").replace("ɲ","n").replace("ʋ","v").replace("ɾ","r").replace("̪","")
    out=[]
    for t in toks(s):
        if t=="ː": continue
        if out and out[-1]==t: continue
        out.append(t)
    return "".join(out)

def load(fn,col=1,pref=None):
    d={}
    for l in open(fn,encoding="utf8"):
        if l.startswith("#") or "\t" not in l: continue
        p=l.rstrip("\n").split("\t")
        if pref and (len(p)<3 or p[1]!=pref): continue
        k=p[0]; v=p[col if not pref else 2]
        d.setdefault(k,set()).add(v) if fn.endswith("broad.tsv") else d.setdefault(k,v)
    return d
# wikipron MAJORITY reading (most frequent variant) — using any variant inflates agreement via free variation
# (final-ہ length, ain-ʔ), so the honest multi-referee signal needs the primary reading.
_wc=defaultdict(Counter)
for l in open(f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv",encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=2 and p[0]: _wc[p[0]][norm(p[1].replace(" ",""))]+=1
wiki={k:{c.most_common(1)[0][0]} for k,c in _wc.items()}  # singleton set of the majority reading
cle={}
for l in open(f"{HERE}/tools/referee-eval/referees/ur.cle-speech.tsv",encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    k,v=l.rstrip("\n").split("\t"); cle[k]=norm(v)
ours={}
for l in open(f"{HERE}/src/languages/urdu/lexicon-ipa.tsv",encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    k,v=l.rstrip("\n").split("\t"); ours[k]=norm(v)

# candidate = covered by all three, CLE agrees with SOME wikipron variant, but ours differs from that agreed reading
cand=[]
for sk in set(cle)&set(ours)&set(wiki):
    if cle[sk] in wiki[sk] and ours[sk]!=cle[sk]:
        cand.append(sk)
print(f"words in all three referees+ours: {len(set(cle)&set(ours)&set(wiki))}")
print(f"CANDIDATES (CLE==wikipron != ours): {len(cand)}\n")

# categorise the diff
def difftype(o,g):
    ot,gt=toks(o),toks(g)
    SH={"ə","ɪ","ʊ","ɛ","ɔ"}; LONG={"ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ɑ"}
    so=[t for t in ot if t in SH]; sg=[t for t in gt if t in SH]
    lo=[t for t in ot if t in LONG]; lg=[t for t in gt if t in LONG]
    co=[t for t in ot if t not in SH|LONG]; cg=[t for t in gt if t not in SH|LONG]
    if co!=cg:
        if "ʔ" in (set(co)^set(cg)): return "glottal ʔ (ain)"
        return "consonant/gemination"
    if lo!=lg: return "majhūl/long-vowel quality"
    if so!=sg: return "short-vowel quality/placement"
    return "other"
buckets=Counter(); ex=defaultdict(list)
for sk in cand:
    t=difftype(ours[sk],cle[sk]); buckets[t]+=1
    if len(ex[t])<8: ex[t].append(f"{sk}: ours={ours[sk]} ref={cle[sk]}")
for t,n in buckets.most_common():
    print(f"=== {n:4}  {t} ===")
    for e in ex[t][:6]: print(f"      {e}")
