#!/usr/bin/env python3
"""Probe: is Hindi/Urdu REGISTER divergence a true factor in the covered-word misses? A Perso-Arabic-origin
word (diagnostic letters ع ح ذ ض ظ ط ص ث, or ق) borrowed via Persian/Arabic often takes an Arabic vowel pattern
(short ɪ/ʊ, ع→ʔ) that the HINDI cognate we stored reads differently (Hindi ə/eː, ع dropped). Quantify:
  (1) of covered words that MISS wikipron, how many are register-suspect (Perso-Arabic letter) vs not;
  (2) among register-suspect misses, would adopting the wikipron reading fix them (upper-bound headroom);
  (3) is there an INDEPENDENT Urdu-native fix source — does the Persian (fa) lexicon cover these skeletons?"""
import unicodedata
import os
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
WIKI=f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"
LEX=f"{HERE}/data/languages/urdu/lexicon-ipa.tsv"
HIND=f"{HERE}/tools/perso-arabic/silver.hindiurdu.tsv"
FA=f"{HERE}/tools/perso-arabic/lexicon.fa.tsv"
PA_LETTERS=set("عحذضظطصثق")

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
hind_skel=set()
for l in open(HIND,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=3 and p[1]=="urd": hind_skel.add(p[0])
fa_skel=set()
for l in open(FA,encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    fa_skel.add(l.split("\t")[0].normalize("NFC") if hasattr(l.split("\t")[0],"normalize") else unicodedata.normalize("NFC",l.split("\t")[0]))

covered=miss=0
reg_miss=nonreg_miss=0
reg_hind=0; reg_fa_cover=0
ex=[]
for sk,ipa in lex.items():
    if sk not in wiki: continue
    covered+=1
    if cfold(ipa) in wiki[sk]: continue
    miss+=1
    is_reg=any(c in PA_LETTERS for c in sk)
    if is_reg:
        reg_miss+=1
        if sk in hind_skel: reg_hind+=1
        if unicodedata.normalize("NFC",sk) in fa_skel: reg_fa_cover+=1
        if len(ex)<20: ex.append((sk,cfold(ipa),list(wiki[sk])[:2],unicodedata.normalize("NFC",sk) in fa_skel))
    else:
        nonreg_miss+=1
print(f"covered words: {covered} | misses: {miss} ({100*miss//covered}%)")
print(f"  register-suspect misses (Perso-Arabic letter): {reg_miss} ({100*reg_miss//max(miss,1)}% of misses)")
print(f"  non-register misses                          : {nonreg_miss} ({100*nonreg_miss//max(miss,1)}%)")
print(f"  register misses whose stored reading is HINDI-sourced: {reg_hind}/{reg_miss}")
print(f"  register misses ALSO covered by the fa lexicon (independent fix source): {reg_fa_cover}/{reg_miss}")
print(f"\n--- sample register-suspect misses (skeleton, ours, wikipron, in-fa?) ---")
for sk,ours,wk,infa in ex:
    print(f"  {sk:14} ours={ours:18} wiki={wk}  fa={'Y' if infa else '-'}")
