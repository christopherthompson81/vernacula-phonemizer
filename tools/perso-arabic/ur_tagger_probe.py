#!/usr/bin/env python3
"""Run 1 probe for the Urdu tagger: (a) size the aligned training pool from the Hindi-derived
IPA silver, (b) size the OPPORTUNITY — on wikipron gold, how often a short-vowel slot is
actually ɪ/ʊ (not the default ə) and a majhūl long vowel is uː/eː (not the default oː/iː).
That headroom is what the blanket-[ə] baseline forfeits and the tagger could win.

Reuses the fa aligner's tokenizer, extended to the Urdu (Hindi-phonology) inventory."""
import sys
from collections import Counter
import os
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
SILVER = f"{HERE}/tools/perso-arabic/silver.hindiurdu.tsv"
WIKI = f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"

# Urdu/Hindi IPA unit inventory (multi-char first). Retroflex, dental, breathy aspirates, ɦ, ɲ ŋ.
UNITS = ["t͡ʃ","d͡ʒ","t̪ʰ","ʈʰ","d̪ʱ","ɖʱ","t͡ʃʰ","d͡ʒʱ","ɡʱ","kʰ","pʰ","bʱ","ɽʱ","ɾʱ",
         "t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː",
         "kʰ","ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i",
         "b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","j","w","v","ʋ","ɦ",
         "ʰ","ʱ","ː","̃","̪"]
UNITS = sorted(set(UNITS), key=len, reverse=True)
SHORT = {"ə","ɪ","ʊ","a","e","o"}          # short-vowel slots
def toks(s):
    out=[]; i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i): out.append(u); i+=len(u); break
        else: out.append(s[i]); i+=1
    return out

# ---- (a) training pool from Hindi-derived IPA silver ----
pool=[]
for l in open(SILVER,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=3 and p[1]=="urd" and p[0] and p[2]:
        pool.append((p[0], p[2].replace("ˈ","").replace("ˌ","")))
print(f"(a) Hindi-derived IPA silver pool: {len(pool)} (skeleton, IPA) pairs")

# ---- (b) opportunity on wikipron gold ----
short_dist=Counter(); long_o=Counter(); long_i=Counter(); nwords=0; nshort_words=0
wiki_skel=set()
for l in open(WIKI,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)<2: continue
    skel=p[0]; ipa=p[1].replace(" ","")
    wiki_skel.add(skel); nwords+=1
    tl=toks(ipa)
    has_short=False
    for k,t in enumerate(tl):
        if t in ("ə","ɪ","ʊ"): short_dist[t]+=1; has_short=True
        # majhūl: long back/front vowel quality
        if t=="oː": long_o["oː"]+=1
        elif t=="uː": long_o["uː"]+=1
        elif t=="eː": long_i["eː"]+=1
        elif t=="iː": long_i["iː"]+=1
    if has_short: nshort_words+=1
tot_short=sum(short_dist.values())
print(f"\n(b) wikipron gold: {nwords} words")
print(f"  SHORT-vowel slots (ə/ɪ/ʊ): {tot_short} total across {nshort_words} words")
for v in ("ə","ɪ","ʊ"):
    n=short_dist[v]; print(f"    {v}: {n:5}  ({100*n//max(tot_short,1)}%)  {'← default baseline always guesses this' if v=='ə' else '← baseline MISSES (forfeit)'}")
to=sum(long_o.values()); ti=sum(long_i.values())
print(f"  MAJHŪL long-back و (oː default): oː {long_o['oː']} / uː {long_o['uː']}  → baseline misses uː = {100*long_o['uː']//max(to,1)}% of و-longs")
print(f"  MAJHŪL long-front ی (iː default): iː {long_i['iː']} / eː {long_i['eː']}  → baseline misses eː = {100*long_i['eː']//max(ti,1)}% of ی-longs")

# ---- overlap: how much of wikipron is covered by the training pool (leakage check for held-out) ----
pool_skel=set(s for s,_ in pool)
ov=len(wiki_skel & pool_skel)
print(f"\n(c) overlap: {ov}/{len(wiki_skel)} wikipron skeletons appear in the training pool "
      f"({100*ov//max(len(wiki_skel),1)}%) → the other {len(wiki_skel)-ov} are a clean OOV held-out")
