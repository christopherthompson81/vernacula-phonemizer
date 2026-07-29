#!/usr/bin/env python3
"""Does the independent Hindi-derived source expand the shipped Urdu coverage lexicon, and are its restorations
ACCURATE (non-circular vs wikipron — the Hindi source never saw wikipron)? Measures wikipron TYPE coverage +
restoration accuracy for: (1) current shipped lexicon, (2) + Hindi-derived IPA pool, (3) + extra vowelized silver.
Accuracy = does our restored IPA match a wikipron pron under the same canonical folds used elsewhere."""
import unicodedata
HERE="/home/chris/Programming/vernacula-phonemizer"
WIKI=f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"
SILVER=f"{HERE}/tools/perso-arabic/silver.hindiurdu.tsv"
EXTRA=f"{HERE}/tools/perso-arabic/ur_extra_pool.tsv"
SHIP=f"{HERE}/src/languages/urdu/lexicon.tsv"

UNITS=["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i",
       "b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n",
       "ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"]
UNITS=sorted(set(UNITS),key=len,reverse=True)
def toks(s):
    o=[];i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i): o.append(u);i+=len(u);break
        else: o.append(s[i]);i+=1
    return o
def cfold(ipa):  # canonical notation fold to compare our IPA against wikipron (same as tagger eval)
    s=unicodedata.normalize("NFD", ipa.replace("ˈ","").replace("ˌ","")).replace("̃ː","ː̃")
    s=s.replace("n̪","n").replace("ɳ","n").replace("ɲ","n").replace("ʋ","v").replace("ɾ","r")
    out=[]
    for t in toks(s):
        if t=="ː": continue
        if out and out[-1]==t: continue
        out.append(t)
    return "".join(out)

# wikipron: skeleton -> set of folded prons
wiki={}
for l in open(WIKI,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=2 and p[0]: wiki.setdefault(p[0],set()).add(cfold(p[1].replace(" ","")))

# sources giving skeleton -> our restored IPA
hind={}
for l in open(SILVER,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=3 and p[1]=="urd": hind.setdefault(p[0], p[2])
extra={}
for l in open(EXTRA,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=3 and p[1]=="urd": extra.setdefault(p[0], p[2])
ship=set()
for l in open(SHIP,encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    ship.add(l.split("\t")[0])

WT=len(wiki)
def cov(skels): return len(set(skels) & set(wiki))
print(f"wikipron types: {WT}")
print(f"  shipped lexicon covers            : {cov(ship)} ({100*cov(ship)//WT}%)")
print(f"  Hindi-derived pool covers         : {cov(hind)} ({100*cov(hind)//WT}%)")
print(f"  shipped ∪ Hindi                   : {cov(set(ship)|set(hind))} ({100*cov(set(ship)|set(hind))//WT}%)")
print(f"  shipped ∪ Hindi ∪ extra           : {cov(set(ship)|set(hind)|set(extra))} ({100*cov(set(ship)|set(hind)|set(extra))//WT}%)")
new = (set(hind)|set(extra)) - ship
print(f"  NEW skeletons (Hindi∪extra, not in shipped) that are in wikipron: {len(new & set(wiki))}")

# ACCURACY (non-circular): for wikipron skeletons covered by the Hindi source, does our IPA match a wikipron pron?
acc_ok=acc_n=0
for sk,ipa in hind.items():
    if sk in wiki:
        acc_n+=1
        if cfold(ipa) in wiki[sk]: acc_ok+=1
print(f"\nHindi-source restoration ACCURACY vs wikipron (non-circular): {acc_ok}/{acc_n} ({100*acc_ok/max(acc_n,1):.1f}%)")
# and on the NEW-only (words the shipped lexicon lacks) — the actual expansion quality
nn=nk=0
for sk,ipa in hind.items():
    if sk in wiki and sk not in ship:
        nk+=1
        if cfold(ipa) in wiki[sk]: nn+=1
print(f"  …restricted to NEW skeletons (the expansion): {nn}/{nk} ({100*nn/max(nk,1):.1f}%)")
