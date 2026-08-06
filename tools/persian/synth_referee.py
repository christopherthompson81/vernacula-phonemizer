#!/usr/bin/env python3
"""Synthesize a CLEAN non-circular referee by cross-source AGREEMENT: pool citation pronunciations from 3 INDEPENDENT
sources (wikipron-fas / GE2PE Kasre+Homograph / FarsDat), each normalized to our IPA, and keep a word's pronunciation
only where >=2 independent sources agree. Agreement filters each source's idiosyncratic convention noise (classical
register, speech-corpus hamza, ق/غ) — what survives is convention-neutral truth. Then eval the tagger on it.
PROVENANCE NOTE (2026-07-29): the FarsDat voter's acquisition path and license are unrecorded — the
derived fa.synth-agreement.tsv is EVAL-ONLY (validation gold for build_pin.py; not wired into
referee-eval; no shipped content derives from it). Do not promote it to a content source or referee
without resolving the FarsDat terms.
"""
import sys, csv
from collections import defaultdict, Counter
import onnxruntime as ort, numpy as np, json

import os
REFEREES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "referee-eval", "referees")
SP = sys.argv[1]
def norm_common(ipa):  # collapse the notation diffs that are NOT real distinctions, so sources can be compared
    return ipa.replace("ˈ","").replace("ˌ","").replace("ɣ","q").replace("r","ɾ")  # keep ː and ʔ (real)
# --- source 1: wikipron (classical-leaning, independent) ---
WMAP={"r":"ɾ","ɒː":"aː","ɒ":"aː","ɑː":"aː","æ":"a","ɔ":"o","g":"ɡ","dʒ":"d͡ʒ","tʃ":"t͡ʃ"}
wik=defaultdict(set)
for l in open(f"{REFEREES}/fa.wikipron-fas-broad.tsv",encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    w,p=l.rstrip("\n").split("\t",1)
    if len(w)<2 or len(p.split())>len(w)+4: continue
    wik[w].add(norm_common("".join(WMAP.get(x,x) for x in p.split())))
# --- source 2: GE2PE Kasre+Homograph (modern, /=short-a scheme) ---
GK={"@":"ʔ","/":"a","a":"aː","i":"iː","u":"uː","e":"e","o":"o","A":"aː","$":"ʃ","c":"t͡ʃ","j":"d͡ʒ","y":"j","q":"q","x":"x","g":"ɡ","r":"ɾ","'":"ʔ","Z":"ʒ","C":"t͡ʃ","G":"ɣ","p":"p","b":"b","t":"t","d":"d","k":"k","f":"f","v":"v","s":"s","z":"z","h":"h","m":"m","n":"n","l":"l","w":"v"}
NORM=str.maketrans({"ي":"ی","ك":"ک","ى":"ی","ة":"ه"});HAR="".join(chr(c) for c in list(range(0x64B,0x653))+[0x670]);PUNC=set("،؛.؟!:|«»()-–—…\"'[]\\/")
cg=lambda w:"".join(c for c in w.translate(NORM).replace("‌","") if c not in HAR)
ge=defaultdict(Counter)
for fn in ("Kasre_test.csv","Homograph_test.csv"):
    for r in csv.reader(open(f"{SP}/ref/{fn}",encoding="utf8")):
        if len(r)<2 or r[0]=="Grapheme": continue
        gw=[cg(w) for w in r[0].split() if cg(w) and not all(c in PUNC for c in w)]
        pw=[w for w in r[1].split() if w and w!=";" and not all(c in PUNC for c in w)]
        if len(gw)!=len(pw): continue
        for g,p in zip(gw,pw):
            if "1" in p: continue  # skip ezafe-tagged → citation only
            ge[g][norm_common("".join(GK.get(c,"") for c in p.replace("2","")))]+=1
# --- source 3: FarsDat (modern speech corpus, /=long-a scheme, independent) ---
FD={"]":"ʔ","/":"aː","a":"a","e":"e","o":"o","i":"iː","u":"uː","y":"j","v":"v",".":"ʃ",",":"d͡ʒ","'":"t͡ʃ","q":"q","x":"x","b":"b","p":"p","t":"t","s":"s","d":"d","z":"z","r":"ɾ","n":"n","m":"m","h":"h","k":"k","g":"ɡ","l":"l","f":"f"}
fd=defaultdict(Counter)
for r in csv.reader(open(f"{SP}/ref/FarsDat.csv",encoding="utf8")):
    if len(r)<3 or r[1]=="Grapheme": continue
    gw=[cg(w) for w in r[1].split() if cg(w) and not all(c in PUNC for c in w)]
    pw=[w for w in r[2].split() if w and not all(c in PUNC for c in w)]
    if len(gw)!=len(pw): continue
    for g,p in zip(gw,pw):
            if "1" in p: continue  # skip ezafe-tagged → citation only
            fd[g][norm_common("".join(FD.get(c,"") for c in p.replace("2","")))]+=1
# --- AGREEMENT: a pronunciation corroborated by >=2 independent sources ---
gold={}
words=set(wik)|set(ge)|set(fd)
for w in words:
    s1=wik.get(w,set()); s2=set(ge.get(w,{})); s3=set(fd.get(w,{}))
    corrob={p for p in (s1|s2|s3) if (p in s1)+(p in s2)+(p in s3)>=2}
    if corrob: gold[w]=corrob
# --- eval the tagger on the agreement gold (citation, isolated word) ---
meta=json.load(open(f"{SP}/fa-tagger.meta.json"));cv={k:int(v) for k,v in meta["src"].items()};tags=meta["tags"];ctg=meta["charTags"]
sess=ort.InferenceSession(f"{SP}/fa-tagger.int8.onnx")
def tag(w):
    ids=np.array([[cv.get(c,1) for c in w]],dtype=np.int64);lo=sess.run(["logits"],{"chars":ids})[0][0]
    o=[]
    for k,c in enumerate(w):
        valid=ctg.get(str(cv.get(c,1))) or list(range(len(tags)))
        best=max(valid,key=lambda t:lo[k][t]);tg=tags[str(best)]
        if tg!=" ":o.append(tg)
    return norm_common("".join(o))
SHORTV=set("aeou"); 
def bbf(x):
    import re
    return "".join(ch for ch in x if ch not in SHORTV)
ok=bbok=N=0; miss=[]
for w,prons in gold.items():
    if len(w)<3: continue
    N+=1; p=tag(w)
    if p in prons: ok+=1
    if any(bbf(p)==bbf(g) for g in prons): bbok+=1
    if p not in prons and len(miss)<12: miss.append(f"{w}: tagger {p} / agreed {list(prons)[:2]}")
import io
with open(f"{REFEREES}/fa.synth-agreement.tsv","w",encoding="utf8") as f:
    f.write("# fa SYNTHESIZED referee — cross-source AGREEMENT gold (NON-CIRCULAR, convention-neutral).\n")
    f.write("# A word's pronunciation is kept ONLY where >=2 of 3 INDEPENDENT sources agree after normalizing to our\n")
    f.write("# IPA: wikipron-fas (Wiktionary) / GE2PE Kasre+Homograph (Sharif, Rahmati) / FarsDat (old speech corpus).\n")
    f.write("# Agreement filters each source's idiosyncratic convention noise (classical register, speech-corpus hamza,\n")
    f.write("# ق/غ merge) -> what survives is corroborated truth. CITATION forms (ezafe-tagged occurrences dropped).\n")
    f.write("# Normalization for cross-source compare: strip stress, ɣ->q, r->ɾ (ː and ʔ kept). Build/eval:\n")
    f.write("# tools/persian/synth_referee.py. Format: word <TAB> agreed-pron(s, |-sep) <TAB> n_sources.\n")
    for w in sorted(gold):
        if len(w)<3: continue
        s1=wik.get(w,set()); s2=set(ge.get(w,{})); s3=set(fd.get(w,{}))
        for p in sorted(gold[w]):
            n=(p in s1)+(p in s2)+(p in s3)
            f.write(f"{w}\t{p}\t{n}\n")
print(f"cross-source AGREEMENT gold (>=2 of 3 independent sources): {len(gold)} words total, {N} eval'd (>=3 char)")
print(f"sources: wikipron {len(wik)} | GE2PE {len(ge)} | FarsDat {len(fd)}")
print(f"TAGGER on the clean agreement gold: FULL {100*ok/N:.1f}%  |  BACKBONE (cons+long-V) {100*bbok/N:.1f}%")
print("sample misses:"); [print("  "+m) for m in miss]
