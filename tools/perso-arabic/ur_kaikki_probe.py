#!/usr/bin/env python3
"""Probe: extract an independent Urdu short-vowel source from the kaikki Urdu (Wiktionary) dump and measure what it
could fix. kaikki-urd gives human Urdu IPA with the correct Arabic-template ɪ/ʊ (امام ɪmɑːm, اسلام ɪslɑːm) — the exact
short-vowel-layer errors our Hindi-derived readings make. It is INDEPENDENT of wikipron → validates non-circularly.
Measures: coverage of wikipron, standalone accuracy, and how many of our current covered-misses it fixes."""
import json, unicodedata
import os
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
DUMP="/tmp/ur_kaikki.jsonl"
WIKI=f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"
LEX=f"{HERE}/src/languages/urdu/lexicon-ipa.tsv"
HARAKAT_G=r"[ؐ-ًؚ-ٰٟۖ-ۭـ]"
import re
HRX=re.compile(HARAKAT_G)

U=["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i","b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"]
U=sorted(set(U),key=len,reverse=True)
def toks(s):
    o=[];i=0
    while i<len(s):
        for u in U:
            if s.startswith(u,i):o.append(u);i+=len(u);break
        else:o.append(s[i]);i+=1
    return o
def cfold(ipa):
    s=unicodedata.normalize("NFD",ipa.replace("ˈ","").replace("ˌ","")).replace("̃ː","ː̃")
    s=s.replace("n̪","n").replace("ɳ","n").replace("ɲ","n").replace("ʋ","v").replace("ɾ","r")
    out=[]
    for t in toks(s):
        if t=="ː":continue
        if out and out[-1]==t:continue
        out.append(t)
    return "".join(out)

wiki={}
for l in open(WIKI,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=2 and p[0]: wiki.setdefault(p[0],set()).add(cfold(p[1].replace(" ","")))
lex={}
for l in open(LEX,encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    k,v=l.rstrip("\n").split("\t"); lex[k]=v

# extract kaikki-urd: skeleton -> set of raw IPA (strip slashes, syllable dots, stress)
def clean(ipa):
    return ipa.strip("/[]").replace(".","").replace("ˈ","").replace("ˌ","").replace("ˑ","")
kaikki={}
for l in open(DUMP,encoding="utf8"):
    d=json.loads(l)
    w=d.get("word")
    if not w: continue
    skel=unicodedata.normalize("NFC",HRX.sub("",w))
    if len([c for c in skel])<2: continue
    for s in (d.get("sounds") or []):
        ip=s.get("ipa")
        if ip: kaikki.setdefault(skel,set()).add(clean(ip))

print(f"kaikki-urd: {len(kaikki)} skeletons with IPA")
# coverage + non-circular accuracy vs wikipron
cov=acc=0
for sk,ipas in kaikki.items():
    if sk not in wiki: continue
    cov+=1
    if any(cfold(i) in wiki[sk] for i in ipas): acc+=1
print(f"  covers {cov} wikipron types; accuracy (any variant matches, NON-CIRCULAR): {acc}/{cov} ({100*acc/max(cov,1):.1f}%)")

# how many of OUR current covered-MISSES does kaikki fix?
miss=fix=kaikki_has=0
for sk,ipa in lex.items():
    if sk not in wiki or cfold(ipa) in wiki[sk]: continue
    miss+=1
    if sk in kaikki:
        kaikki_has+=1
        if any(cfold(i) in wiki[sk] for i in kaikki[sk]): fix+=1
print(f"\nour covered-misses: {miss}")
print(f"  kaikki-urd HAS the word: {kaikki_has}  |  kaikki reading FIXES it (matches wikipron): {fix} ({100*fix//max(miss,1)}% of misses)")
# NEW coverage: kaikki words not in our lexicon at all
new=set(kaikki)-set(lex)
new_wiki=new & set(wiki)
print(f"\nkaikki skeletons NOT in our lexicon: {len(new)} ({len(new_wiki)} are in wikipron — pure coverage gain)")
