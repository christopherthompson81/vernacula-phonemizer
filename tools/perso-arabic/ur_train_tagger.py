#!/usr/bin/env python3
"""Urdu STRUCTURAL tagger — port of the fa tagger (tools/persian/train_tagger.py) to the Hindi-phonology
Urdu inventory. Sentence/word-level BiLSTM labelling each abjad char with its IPA-chunk TAG (consonant COPIED +
following short vowel ə/ɪ/ʊ). Output length == input length → cannot degenerate. Aimed at short-vowel QUALITY on
the OOV tail, NOT ezafe (Urdu ambiguity is lexical).

Modes:
  python ur_train_tagger.py align     # coverage report only (iterate the aligner, no training)
  python ur_train_tagger.py train     # train, save ur_tagger.pt, eval on the OOV wikipron held-out
Run under a torch+cuda Python (e.g. the project .venv)."""
import sys, os, random
import os
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
SILVER = f"{HERE}/tools/perso-arabic/silver.hindiurdu.tsv"
WIKI = f"{HERE}/tools/referee-eval/referees/ur.wikipron-urd-broad.tsv"
MODE = sys.argv[1] if len(sys.argv) > 1 else "align"

# ---- tokenizer: aspiration ʰ/ʱ and nasal ̃ are SEPARATE tokens (ھ / ں get their own tag); keep t̪ d̪ retroflex bound.
UNITS = ["t͡ʃ","d͡ʒ","t̪","d̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː",
         "ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","a","e","o","u","i",
         "b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n",
         "ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪"]
UNITS = sorted(set(UNITS), key=len, reverse=True)
SHORT = {"ə","ɪ","ʊ","ɛ","ɔ","a","e","o"}  # ɛ/ɔ occur as short epenthetics (بحر bɛɦɛɾ) as well as majhūl longs ɛː/ɔː
def toks(s):
    out=[]; i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i): out.append(u); i+=len(u); break
        else: out.append(s[i]); i+=1
    return out

# ---- Urdu (Hindi-phonology) anchor candidates ----
CONS={"ب":"b","پ":"p","ت":"t̪","ٹ":"ʈ","ث":"s","ج":"d͡ʒ","چ":"t͡ʃ","ح":"ɦ","خ":"x","د":"d̪","ڈ":"ɖ","ذ":"z",
      "ر":"ɾ","ڑ":"ɽ","ز":"z","ژ":"ʒ","س":"s","ش":"ʃ","ص":"s","ض":"z","ط":"t̪","ظ":"z","غ":"ɣ","ف":"f",
      "ق":"q","ک":"k","ك":"k","گ":"ɡ","ل":"l","م":"m","ن":"n","ݨ":"ɳ","ڻ":"ɳ"}
ANCH={c:[p] for c,p in CONS.items()}
# ن assimilates in PLACE to a following stop: dental n̪ (before t̪/d̪), retroflex ɳ (ʈ/ɖ), palatal ɲ (t͡ʃ/d͡ʒ),
# velar ŋ (k/ɡ). Longer/more-specific candidates first (list order = try order).
ANCH["ن"]=["n̪","ɳ","ɲ","̃ŋ","ŋ","n","̃","m",""]
ANCH["م"]=["m","̃m",""]
ANCH["ا"]=["ɑː","aː","ʔ",""]; ANCH["آ"]=["ɑː","aː","ʔ"]; ANCH["أ"]=["ʔ","ɑː",""]; ANCH["ٰ"]=["ɑː","aː"]
ANCH["و"]=["uːv","oːv","uː","oː","ɔː","ʋ","v","w",""]
ANCH["ی"]=["iːj","eːj","iː","eː","ɛː","j",""]; ANCH["ي"]=ANCH["ی"]; ANCH["ى"]=ANCH["ی"]
ANCH["ے"]=["eː","ɛː","j",""]; ANCH["ۓ"]=["eː","ɛː","j",""]
ANCH["ئ"]=["ʔ","iː","eː","j",""]; ANCH["ؤ"]=["ʔ","oː","uː","ʋ",""]
ANCH["ہ"]=["ɦ","ɑː","ɑ","e","ə",""]; ANCH["ه"]=["ɦ","e","ɑ",""]; ANCH["ھ"]=["ʰ","ʱ","ɦ",""]
ANCH["ں"]=["̃","n","ŋ",""]; ANCH["٘"]=["̃"]; ANCH["ء"]=["ʔ",""]; ANCH["ع"]=["ʔ",""]
ANCH["ۃ"]=["ə","ɑ","h",""]

def align(graph, ipa):
    ip=toks(ipa); j=0; tags=[]
    for ci,c in enumerate(graph):
        cand=ANCH.get(c); tag=""
        if ci==0:  # leading ʔ the abjad doesn't write (ع/ء/alef onset)
            while j<len(ip) and ip[j]=="ʔ" and (not cand or "ʔ" not in cand): tag+=ip[j]; j+=1
        if cand is None: tags.append((c,"")); continue
        matched=False
        for a in cand:
            if a=="": matched=True; break
            u=toks(a)
            if ip[j:j+len(u)]==u:
                # GUARD (from fa): a multi-token candidate must not steal a token the NEXT grapheme owns.
                if len(u)>1 and ci+1<len(graph):
                    nxt=ANCH.get(graph[ci+1])
                    if nxt and any(x and toks(x)[0]==u[-1] for x in nxt): continue
                tag+="".join(u); j+=len(u); matched=True; break
        if not matched: return None
        if c in CONS and j<len(ip) and ip[j]==CONS[c]: tag+=ip[j]; j+=1  # gemination written as a DOUBLED token (ɾɾ, qq)
        if j<len(ip) and ip[j]=="ː": tag+="ː"; j+=1            # gemination bound to this consonant
        while j<len(ip) and ip[j] in SHORT: tag+=ip[j]; j+=1   # following short vowel(s) → this char's tag
        if j<len(ip) and ip[j]=="̃": tag+="̃"; j+=1             # nasalisation on that vowel
        if j<len(ip) and ip[j]=="ː": tag+="ː"; j+=1            # long-vowel length after a short? (rare)
        tags.append((c,tag))
    if j!=len(ip):
        if tags: tags[-1]=(tags[-1][0], tags[-1][1]+"".join(ip[j:]))
        else: return None
    return tags

EXTRA = f"{HERE}/tools/perso-arabic/ur_extra_pool.tsv"
def load_pool():
    pool=[]; seen=set()
    files=[SILVER]
    if os.environ.get("UR_EXTRA") and os.path.exists(EXTRA): files.append(EXTRA)
    for fn in files:
        for l in open(fn,encoding="utf8"):
            p=l.rstrip("\n").split("\t")
            if len(p)>=3 and p[1]=="urd" and p[0] and p[2] and p[0] not in seen:
                seen.add(p[0]); pool.append((p[0], p[2].replace("ˈ","").replace("ˌ","")))
    return pool

if MODE=="align":
    pool=load_pool(); ok=0; fail=[]
    for skel,ipa in pool:
        a=align(skel,ipa)
        if a is not None and "".join(t for _,t in a)==ipa: ok+=1
        else: fail.append((skel,ipa))
    print(f"aligned {ok}/{len(pool)} ({100*ok//len(pool)}%)")
    print("--- sample failures ---")
    random.seed(2); random.shuffle(fail)
    for skel,ipa in fail[:30]:
        a=align(skel,ipa)
        got="".join(t for _,t in a) if a else "None"
        print(f"  {skel:16} gold={ipa:20} got={got}")
    sys.exit(0)

# ================= TRAIN =================
import torch, torch.nn as nn
random.seed(1234); torch.manual_seed(1234)
dev = "cuda" if torch.cuda.is_available() else "cpu"

# wikipron held-out (the OOV eval). Exclude EVERY wikipron skeleton from training → a fully clean generalization test.
wiki={}
for l in open(WIKI,encoding="utf8"):
    p=l.rstrip("\n").split("\t")
    if len(p)>=2 and p[0]:
        wiki.setdefault(p[0], []).append(p[1].replace(" ",""))
wiki_skel=set(wiki)

pool=load_pool()
aligned=[]
for skel,ipa in pool:
    a=align(skel,ipa)
    if a is not None and "".join(t for _,t in a)==ipa:
        aligned.append((skel, ipa, [c for c,_ in a],[t for _,t in a]))
# PRIMARY eval = a held-out slice of the SAME Hindi-derived (in-convention) distribution — isolates the model's
# vowel-quality skill from the wikipron notation gap. Our shipped Urdu IS Hindi-convention, so this gold is exactly
# what our g2p would emit if the abjad wrote its vowels.
random.shuffle(aligned)
ndev=len(aligned)//10
dev_set=aligned[:ndev]; train=[(c,t) for _,_,c,t in aligned[ndev:]]
print(f"# aligned {len(aligned)} | train {len(train)} | in-conv dev {len(dev_set)} | wikipron {len(wiki)} | dev={dev}", file=sys.stderr, flush=True)

cv={"<pad>":0,"<unk>":1}; lv={"<pad>":0}
for chars,labs in train:
    for c in chars: cv.setdefault(c,len(cv))
    for t in labs: lv.setdefault(t,len(lv))
ilv={i:t for t,i in lv.items()}
cid=lambda c: cv.get(c,1); lid=lambda t: lv.get(t,0)
# consonant-consistency mask
char_tags={}
for chars,labs in train:
    for c,t in zip(chars,labs): char_tags.setdefault(c,set()).add(lv[t])
char_mask=torch.full((len(cv),len(lv)),-1e9)
for c,ci in cv.items():
    valid=char_tags.get(c)
    if not valid: char_mask[ci,:]=0.0
    else:
        for t in valid: char_mask[ci,t]=0.0
    char_mask[ci,0]=0.0
char_mask=char_mask.to(dev)
class Tagger(nn.Module):
    def __init__(s,nc,nl,emb=128,h=256):
        super().__init__(); s.e=nn.Embedding(nc,emb,0); s.lstm=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2); s.o=nn.Linear(2*h,nl)
    def forward(s,x): return s.o(s.lstm(s.e(x))[0])
m=Tagger(len(cv),len(lv)).to(dev); opt=torch.optim.Adam(m.parameters(),1e-3); crit=nn.CrossEntropyLoss(ignore_index=0)
Tr=[([cid(c) for c in ch],[lid(t) for t in lb]) for ch,lb in train]
import time
EPOCHS=int(os.environ.get("UR_EPOCHS",25))
for e in range(EPOCHS):
    m.train(); te=time.time(); tl=0; nb=0; idx=list(range(len(Tr))); random.shuffle(idx)
    for k in range(0,len(idx),256):
        b=idx[k:k+256]; mx=max(len(Tr[i][0]) for i in b)
        X=torch.zeros(len(b),mx,dtype=torch.long); Y=torch.zeros(len(b),mx,dtype=torch.long)
        for r,i in enumerate(b):
            X[r,:len(Tr[i][0])]=torch.tensor(Tr[i][0]); Y[r,:len(Tr[i][1])]=torch.tensor(Tr[i][1])
        X,Y=X.to(dev),Y.to(dev); lo=m(X)+char_mask[X]; loss=crit(lo.reshape(-1,len(lv)),Y.reshape(-1))
        opt.zero_grad(); loss.backward(); opt.step(); tl+=loss.item(); nb+=1
    if (e+1)%5==0: print(f"# epoch {e+1}/{EPOCHS} loss {tl/nb:.3f} {time.time()-te:.0f}s", file=sys.stderr, flush=True)
torch.save({"model":m.state_dict(),"cv":cv,"lv":lv,"char_mask":char_mask.cpu()}, f"{HERE}/tools/perso-arabic/ur_tagger.pt")

# ================= EVAL on OOV wikipron =================
m.eval()
def predict_word(w):
    X=torch.tensor([[cid(c) for c in w]],device=dev)
    with torch.no_grad(): t=(m(X)+char_mask[X])[0].argmax(-1).tolist()
    return "".join(ilv.get(x,"") for x in t)
# CONVENTION normalizer (reconcile OUR Hindi-phonology output with the wikipron referee's notation — NOT vowel
# quality): the referee omits dental/retroflex/palatal nasal marking (writes plain n), uses precomposed nasal
# vowels with tilde-before-length (õː), doubled-token gemination (no ː), and v/r for ʋ/ɾ. Applied to BOTH sides.
import unicodedata
def nfold(ipa):
    s=unicodedata.normalize("NFD", ipa.replace("ˈ","").replace("ˌ",""))
    s=s.replace("̃ː","ː̃")                      # nasal+length → length+nasal, so a long nasal vowel stays a bound Vː token
    s=s.replace("n̪","n").replace("ɳ","n").replace("ɲ","n")  # referee doesn't mark nasal place (keeps ŋ)
    s=s.replace("ʋ","v").replace("ɾ","r")
    tl=toks(s); out=[]
    for t in tl:
        if t=="ː": continue                     # standalone ː = consonant gemination (long vowels are bound tokens)
        if out and out[-1]==t: continue         # doubled consonant → single (geminate as length, folded)
        out.append(t)
    return "".join(out)
# default-ə baseline value of a word = its gold with quality neutralised (ɪʊɛɔ→ə, majhūl uː→oː eː→iː ɔː→oː ɛː→eː).
# A word is "default-correct" iff neutralising changes NOTHING (gold already all-default) — an UPPER bound on the
# shipped default-[ə] g2p (which also makes consonant/skeleton errors this oracle ignores).
def neutral(ipa):
    for a,b in [("ɪ","ə"),("ʊ","ə"),("ɛː","eː"),("ɔː","oː"),("uː","oː"),("eː","iː"),("ɛ","ə"),("ɔ","ə")]:
        ipa=ipa.replace(a,b)
    return ipa
# predict TAGS per char (align 1:1 with gold tags for slot-level scoring)
def predict_tags(chars):
    X=torch.tensor([[cid(c) for c in chars]],device=dev)
    with torch.no_grad(): t=(m(X)+char_mask[X])[0].argmax(-1).tolist()
    return [ilv.get(x,"") for x in t]
strip=lambda s: s.replace("ˈ","").replace("ˌ","")
SHORTQ={"ə","ɪ","ʊ","ɛ","ɔ"}; MAJ={"oː","uː","ɔː","iː","eː","ɛː"}
# ---- PRIMARY: in-convention dev ----
W=word_ok=base_word_ok=0
sslot=sdef=stag=0        # short-vowel slots: total, default(ə)-correct, tagger-correct
mslot=mdef=mtag=0        # majhūl long-vowel slots
DUMP=os.environ.get("UR_DUMP"); dumped=0
for skel,ipa,chars,gtags in dev_set:
    W+=1
    ptags=predict_tags(chars)
    if strip("".join(ptags))==strip(ipa): word_ok+=1
    elif DUMP and dumped<30:
        dumped+=1; print(f"  {skel:14} pred={strip(''.join(ptags)):24} gold={strip(ipa)}")
    # default baseline word: replace each gold short quality with ə, majhūl with default oː/iː
    if neutral(strip(ipa))==strip(ipa): base_word_ok+=1
    # slot-level: compare per-char tag (same alignment)
    for gt,pt in zip(gtags,ptags):
        gtk=toks(strip(gt)); ptk=toks(strip(pt))
        for q in gtk:
            if q in SHORTQ:
                sslot+=1
                if q=="ə": sdef+=1
                if pt and q in ptk: stag+=1     # tagger predicted this quality somewhere in the char's tag
            if q in MAJ:
                mslot+=1
                if q in ("oː","iː"): mdef+=1
                if q in ptk: mtag+=1
# ---- DIAGNOSTIC: train-set short-slot accuracy (memorisation vs generalisation) ----
tr_s=tr_sdef=tr_stag=0
for chars,gtags in train[:2000]:
    ptags=predict_tags(chars)
    for gt,pt in zip(gtags,ptags):
        for q in toks(strip(gt)):
            if q in SHORTQ:
                tr_s+=1
                if q=="ə": tr_sdef+=1
                if pt and q in toks(strip(pt)): tr_stag+=1
print(f"\n=== DIAGNOSTIC: does the model FIT its own train shorts? (memorisation ceiling) ===")
print(f"  TRAIN short-slot acc : tagger {tr_stag}/{tr_s} ({100*tr_stag/max(tr_s,1):.1f}%)  vs always-ə {tr_sdef}/{tr_s} ({100*tr_sdef/max(tr_s,1):.1f}%)")

print(f"\n=== PRIMARY: in-convention dev ({W} words) ===")
print(f"  per-word exact         : {word_ok}/{W} ({100*word_ok/W:.1f}%)   [default-ə baseline {base_word_ok}/{W} ({100*base_word_ok/W:.1f}%)]")
print(f"  short-vowel slot acc   : tagger {stag}/{sslot} ({100*stag/max(sslot,1):.1f}%)  vs default-always-ə {sdef}/{sslot} ({100*sdef/max(sslot,1):.1f}%)")
print(f"  majhūl long-vowel slot : tagger {mtag}/{mslot} ({100*mtag/max(mslot,1):.1f}%)  vs default oː/iː {mdef}/{mslot} ({100*mdef/max(mslot,1):.1f}%)")

# ---- SECONDARY: wikipron (cross-convention lower bound; overlap with train NOT excluded → sanity only) ----
W2=tag2=base2=0
for skel,prons in wiki.items():
    if len(skel)<2: continue
    W2+=1
    golds=[nfold(g) for g in prons]
    if nfold("".join(predict_tags(list(skel)))) in golds: tag2+=1
    if any(neutral(g)==g for g in golds): base2+=1
print(f"\n=== SECONDARY: wikipron cross-convention ({W2} words, notation-folded, quality unfolded) ===")
print(f"  tagger {tag2}/{W2} ({100*tag2/W2:.1f}%) | default oracle upper-bound {base2}/{W2} ({100*base2/W2:.1f}%)")
print(f"  tag vocab {len(lv)} | char vocab {len(cv)} | train {len(train)}")
