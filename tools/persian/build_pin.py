#!/usr/bin/env python3
"""Build the first-syllable-vowel PIN lexicon (skeleton→first short vowel) from HomoRich's 98%-correct labels, for
FREQUENT + CONSISTENT (non-homograph) words, cross-validated against the clean agreement gold. Then measure a
first-vowel TRANSPLANT (replace the first short vowel of the tagger's output with the pinned value) on the agreement
gold + GE2PE — fix vs break — before any TS integration. Non-leaky: lexicon from training-source labels (a
memorization aid), tested on INDEPENDENT referees."""
import sys, csv
from collections import defaultdict, Counter
import onnxruntime as ort, numpy as np, json

import os
REFEREES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "referee-eval", "referees")
SP = sys.argv[1]
UNITS=["t͡ʃ","d͡ʒ","aː","uː","iː","eː","oː","a","e","o","u","i","b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","q","k","ɡ","l","m","n","j","v","f","w"]
UNITS.sort(key=len,reverse=True); SHORT={"a","e","o"}
def toks(s):
    o=[];i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i):o.append(u);i+=len(u);break
        else:o.append(s[i]);i+=1
    return o
norm=lambda s:s.replace("ˈ","").replace("ˌ","").replace("ɣ","q").replace("r","ɾ")
def first_sv_idx(tl):
    for k,t in enumerate(tl):
        if t in SHORT: return k
    return -1
def first_sv(pron):
    tl=toks(pron); i=first_sv_idx(tl); return tl[i] if i>=0 else None
# --- HomoRich first-vowel per word ---
hr=defaultdict(Counter)
for l in open(f"{SP}/homorich_ipa_clean.tsv",encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)<2: continue
    for g,i in zip(p[0].split(),p[1].split()):
        fv=first_sv(norm(i))
        if fv: hr[g][fv]+=1
# --- agreement gold first-vowel (cross-validation) ---
agree_fv={}
for l in open(f"{REFEREES}/fa.synth-agreement.tsv",encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    w,pr,n=l.rstrip("\n").split("\t"); fv=first_sv(pr)
    if fv: agree_fv.setdefault(w,set()).add(fv)
# --- build PIN lexicon: frequent + consistent (non-homograph); drop where agreement conflicts ---
FREQ=30; CONS=0.90
pin={}
for w,c in hr.items():
    if len(w)<3 or w[:1]=="آ": continue
    tot=sum(c.values()); dom,dn=c.most_common(1)[0]
    if tot<FREQ or dn/tot<CONS: continue           # rare or homograph/inconsistent → skip
    a=agree_fv.get(w)
    if a is not None and (len(a)>1 or dom not in a): continue   # agreement disputes it → skip
    pin[w]=dom
byv=Counter(pin.values())
print(f"PIN lexicon: {len(pin)} words (freq≥{FREQ}, consistency≥{CONS}, agreement-validated). first-V mix: {dict(byv)}")
# --- WRITE the shipped lexicon (this IS the canonical builder; path derived from the script location) ---
import os
_OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data/languages/persian/fa-pin-vowels.tsv")
_HDR=["# fa first-syllable-vowel PIN — skeleton <TAB> correct first SHORT vowel (a/e/o). Corrects the tagger's",
      "# /a/-prior default on lexically-fixed first vowels: the vowel is in the clean training data but",
      "# the lightweight BiLSTM can't memorise every lexical exception. FREQUENT (HomoRich freq≥30) + CONSISTENT",
      "# (≥90% one vowel, non-homograph) + agreement-validated. آ-initial words excluded (the deterministic",
      "# word-initial آ→long aː rule in faTagger.ts owns them). Applied as a first-vowel transplant. Build: tools/persian/build_pin.py"]
with open(_OUT, "w", encoding="utf8") as _f:
    _f.write("\n".join(_HDR)+"\n")
    for w in sorted(pin): _f.write(f"{w}\t{pin[w]}\n")
print(f"wrote {len(pin)} entries → {_OUT}")
# --- transplant + measure ---
meta=json.load(open(f"{SP}/fa-tagger.meta.json"));cv={k:int(v) for k,v in meta["src"].items()};tags=meta["tags"];ctg=meta["charTags"]
sess=ort.InferenceSession(f"{SP}/fa-tagger.int8.onnx")
def tag_sentence(words):
    sent=" ".join(words);ids=np.array([[cv.get(c,1) for c in sent]],dtype=np.int64);lo=sess.run(["logits"],{"chars":ids})[0][0]
    out=[[]]
    for k,c in enumerate(sent):
        if c==" ":out.append([]);continue
        valid=ctg.get(str(cv.get(c,1))) or list(range(len(tags)))
        best=max(valid,key=lambda t:lo[k][t]);tg=tags[str(best)]
        if tg!=" ":out[-1].append(tg)
    return ["".join(x) for x in out]
def transplant(word,ipa):
    tl=toks(ipa)
    # RULE: word-initial آ (alef madda) is ALWAYS long aː — fix a short first vowel to long (deterministic)
    if word[:1]=="آ":
        for k,t in enumerate(tl):
            if t in SHORT: tl[k]="aː"; break
            if t in {"aː","uː","iː","eː","oː"}: break
    # PIN: transplant the correct first SHORT vowel for consistent frequent words
    if word in pin:
        i=first_sv_idx(tl)
        if i>=0: tl[i]=pin[word]
    return "".join(tl)
fold=lambda s:s.replace("ˈ","").replace("ˌ","").replace("ɣ","q")
# GE2PE
REF=f"{REFEREES}/fa.ge2pe-ezafe-homograph.tsv"
b_ok=t_ok=fixed=broke=N=cov=0
for line in open(REF,encoding="utf8"):
    if line.startswith("#") or "\t" not in line: continue
    p=line.rstrip("\n").split("\t")
    if len(p)<3: continue
    gw=p[0].split(); gold=[fold(x) for x in p[1].split()]; pred=tag_sentence(gw)
    if len(pred)!=len(gw): continue
    for k in range(len(gw)):
        pr=fold(pred[k]); tp=fold(transplant(gw[k],pred[k])); g=gold[k]; N+=1
        if gw[k] in pin: cov+=1
        b_ok+=(pr==g); t_ok+=(tp==g)
        if pr!=g and tp==g: fixed+=1
        if pr==g and tp!=g: broke+=1
print(f"\nGE2PE (N={N}, {cov} words pin-covered):")
print(f"  tagger:      {100*b_ok/N:.1f}%")
print(f"  + PIN transplant: {100*t_ok/N:.1f}%   (fixed {fixed}, broke {broke}, net {'+' if fixed>=broke else ''}{fixed-broke})")

# --- also measure on the AGREEMENT gold (where the first-vowel signal was found) ---
gold=defaultdict(set)
for l in open(f"{REFEREES}/fa.synth-agreement.tsv",encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    w,pr,n=l.rstrip("\n").split("\t"); gold[w].add(pr)
def tagw(w):
    ids=np.array([[cv.get(c,1) for c in w]],dtype=np.int64);lo=sess.run(["logits"],{"chars":ids})[0][0]
    o=[]
    for k,c in enumerate(w):
        valid=ctg.get(str(cv.get(c,1))) or list(range(len(tags)))
        best=max(valid,key=lambda t:lo[k][t]);tg=tags[str(best)]
        if tg!=" ":o.append(tg)
    return fold("".join(o))
b=t=fx=bk=n=0; miss_notpinned=[]
for w,prons in gold.items():
    if len(w)<3 or w[:1]=="آ": continue
    n+=1; pr=tagw(w); tp=fold(transplant(w,pr))
    b+=(pr in prons); t+=(tp in prons)
    if pr not in prons and tp in prons: fx+=1
    if pr in prons and tp not in prons: bk+=1
    if pr not in prons and w not in pin and len(miss_notpinned)<10:
        import statistics
        miss_notpinned.append(f"{w} (freq {sum(hr[w].values())}): tagger {pr} / gold {list(prons)[:1]}")
print(f"\nAGREEMENT gold (N={n}):")
print(f"  tagger:           {100*b/n:.1f}%")
print(f"  + PIN transplant: {100*t/n:.1f}%   (fixed {fx}, broke {bk}, net {'+' if fx>=bk else ''}{fx-bk})")
print(f"\n  first-vowel MISSES on words NOT in pin (why they escape):")
for m in miss_notpinned: print("    "+m)

# --- regression gate: HomoRich CANONICAL held-out ---
SH={"a","e","o"}
CONMAP={"ب":"b","پ":"p","ت":"t","ث":"s","ج":"d͡ʒ","چ":"t͡ʃ","ح":"h","خ":"x","د":"d","ذ":"z","ر":"ɾ","ز":"z","ژ":"ʒ","س":"s","ش":"ʃ","ص":"s","ض":"z","ط":"t","ظ":"z","ع":"ʔ","غ":"ɣ","ف":"f","ق":"q","ک":"k","ك":"k","گ":"ɡ","ل":"l","م":"m","ن":"n"}
A={c:[p] for c,p in CONMAP.items()};A["ا"]=["aː","ʔ","ɑː",""];A["آ"]=["aː","ʔ","ɑː"];A["ٰ"]=["aː"];A["و"]=["uːv","oːv","uː","oː","v","w",""];A["ی"]=["iːj","eːj","iː","eː","j",""];A["ي"]=A["ی"];A["ه"]=["h","e",""];A["ء"]=["ʔ",""];A["ئ"]=["ʔ","j",""];A["ۀ"]=["e","h"]
def canon(g,ipa):
    ip=toks(ipa);j=0
    for ci,c in enumerate(g):
        cand=A.get(c)
        if ci==0:
            while j<len(ip) and ip[j]=="ʔ" and (not cand or "ʔ" not in cand):j+=1
        if cand is None:continue
        ok=False
        for a in cand:
            if a=="":ok=True;break
            u=toks(a)
            if ip[j:j+len(u)]==u:j+=len(u);ok=True;break
        if not ok:return False
        while j<len(ip) and ip[j] in SH:j+=1
    return j==len(ip)
bc=tc=W=0
for l in open(f"{SP}/test_heldout.tsv",encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)<2:continue
    gw=p[1].split(); grw=p[0].split(); pred=tag_sentence(grw)
    if len(pred)!=len(grw):continue
    for k in range(len(gw)):
        if not canon(grw[k],gw[k]):continue
        W+=1; pr=pred[k]; tp=transplant(grw[k],pr)
        bc+=(pr==gw[k]); tc+=(tp==gw[k])
print(f"\nHomoRich CANONICAL (regression gate, N={W}): tagger {100*bc/W:.1f}% → +correction {100*tc/W:.1f}%")
