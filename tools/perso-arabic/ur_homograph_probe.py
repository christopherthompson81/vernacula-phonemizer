#!/usr/bin/env python3
"""Is Urdu's short-vowel ambiguity HOMOGRAPHIC (one skeleton → several context-dependent readings → context/
tagger can win) or LEXICAL-FIXED (one skeleton → one reading you must simply know → a lexicon is correct and a
word-level model's OOV ceiling is a hard floor)? Measure the homograph rate on wikipron (the only source with
multiple prons per skeleton) by the SHORT-VOWEL pattern, canonicalising notation so transcription variants don't
inflate it. Also: for OOV (unseen) words, is short quality even knowable? (upper-bounded by homograph rate)."""
from collections import Counter, defaultdict
import unicodedata
HERE="/home/chris/Programming/vernacula-phonemizer"
WIKI=f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"

def short_pattern(ipa):
    # sequence of short-vowel qualities (ə/ɪ/ʊ) in order — the thing a restorer must get right. Fold ɛ→ə, ɔ→ə
    # (epenthetic variants), strip everything else. NFD so precomposed nasals don't hide a vowel.
    s=unicodedata.normalize("NFD",ipa.replace("ˈ","").replace("ˌ",""))
    out=[]
    i=0
    for ch in s:
        if ch in "əɪʊ": out.append(ch)
        elif ch=="ɛ": out.append("ə")
        elif ch=="ɔ": out.append("ə")
    return "".join(out)

def maj_pattern(ipa):
    # majhūl long-vowel choices in order (o/u for و-longs, i/e for ی-longs)
    s=ipa.replace("ˈ","").replace("ˌ","")
    out=[]; i=0
    toks=["oː","uː","ɔː","iː","eː","ɛː"]
    while i<len(s):
        for t in toks:
            if s.startswith(t,i):
                out.append({"oː":"o","uː":"u","ɔː":"o","iː":"i","eː":"e","ɛː":"e"}[t]); i+=len(t); break
        else: i+=1
    return "".join(out)

sk=defaultdict(set); sk_maj=defaultdict(set); rows=defaultdict(int)
for l in open(WIKI,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)<2 or not p[0]: continue
    ipa=p[1].replace(" ","")
    sk[p[0]].add(short_pattern(ipa)); sk_maj[p[0]].add(maj_pattern(ipa)); rows[p[0]]+=1

multi=[k for k,v in rows.items() if v>1]                 # skeletons wikipron lists >once
homo_short=[k for k in multi if len(sk[k])>1]            # …and the SHORT pattern actually differs
homo_maj=[k for k in multi if len(sk_maj[k])>1]
print(f"wikipron skeletons: {len(rows)}  |  listed with >1 pron: {len(multi)} ({100*len(multi)//len(rows)}%)")
print(f"  TRUE short-vowel homographs (short pattern differs across prons): {len(homo_short)} "
      f"= {100*len(homo_short)/len(rows):.1f}% of all types, {100*len(homo_short)//max(len(multi),1)}% of the multi-pron ones")
print(f"  majhūl homographs (long-vowel choice differs):                   {len(homo_maj)} "
      f"= {100*len(homo_maj)/len(rows):.1f}% of all types")
print(f"\ninterpretation: a LEXICON forfeits exactly the true-homograph rate (it stores one reading). If that rate is")
print(f"low, short vowels are lexical-FIXED → lexicon is correct + the OOV tail is a hard floor (no context help).")
print(f"\n--- sample true short-vowel homographs (skeleton → distinct short patterns) ---")
for k in homo_short[:15]:
    print(f"  {k:14} {sorted(sk[k])}")
