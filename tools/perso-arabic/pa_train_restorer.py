#!/usr/bin/env python3
"""Punjabi (Shahmukhi) SHORT-VOWEL RESTORER — the ur/fa tagger ported to pa, trained on the cross-script
gold (crossscript.tsv: real Shahmukhi spelling -> IPA from the voweled Gurmukhi sister-spelling; 11,166
pairs after #788 — the data that crossed Run 0's ~10k threshold). BiLSTM labels each abjad char with its
IPA-chunk TAG (consonant copied + following short vowel + tone/nasal marks). Output length == input length.

Modes:
  python pa_train_restorer.py align   # aligner coverage report (iterate before training)
  python pa_train_restorer.py train   # train, save pa_restorer.pt, emit predictions for tsx scoring
Run under the project .venv (torch+cuda).

Eval discipline (the Run-3 lesson): this script never folds — it EMITS predictions
(/tmp/pa_restorer_preds.tsv: word<TAB>prediction<TAB>which) and the scoring runs in tsx with the eval's own
fold pipeline. Two prediction sets: the held-out 10% of crossscript (in-convention skill), and every
pan_arab referee word (the generalization test — scored ONLY on words crossscript does NOT cover, since
covered words are served by the lexicon, not the model).
"""
import sys, os, random
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CROSS = f"{HERE}/data/languages/punjabi/crossscript.tsv"
WIKI = f"{HERE}/tools/referee-eval/referees/pa.wikipron-pan-arab-broad.tsv"
MODE = sys.argv[1] if len(sys.argv) > 1 else "align"

# ---- tokenizer: pa inventory = the ur one + TONE letters (˥˩ ˨˩ ˦ ˨ …), ä, the breve schwa ə̆, n̪.
UNITS = ["t͡ʃ","d͡ʒ","t̪","d̪","n̪","ɑː","aː","uː","iː","eː","oː","ɔː","ɛː",
         "ə̆","ə","ɪ","ʊ","ɔ","ɛ","ɑ","æ","ä","a","e","o","u","i",
         "˥˩","˨˩","˦˨","˨","˦","˥",
         "b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n",
         "ʈ","ɖ","ɽ","ɳ","ɲ","ŋ","ɭ","j","w","v","ʋ","ɦ","ʰ","ʱ","ː","̃","̪","̆"]
UNITS = sorted(set(UNITS), key=len, reverse=True)
SHORT = {"ə","ɪ","ʊ","ɛ","ɔ","a","e","o","ä","ə̆"}
TONES = {"˥˩","˨˩","˦˨","˨","˦","˥"}
def toks(s):
    out=[]; i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i): out.append(u); i+=len(u); break
        else: out.append(s[i]); i+=1
    return out

# ---- Shahmukhi anchors: the ur table + Punjabi tone realities (the voiced aspirates بھ دھ گھ … surface as
# TONE on the vowel with a PLAIN or voiceless consonant: بھ -> p+tone). Anchor candidates are per-CHAR tries.
CONS={"ب":"b","پ":"p","ت":"t̪","ٹ":"ʈ","ث":"s","ج":"d͡ʒ","چ":"t͡ʃ","ح":"ɦ","خ":"x","د":"d̪","ڈ":"ɖ","ذ":"z",
      "ر":"ɾ","ڑ":"ɽ","ز":"z","ژ":"ʒ","س":"s","ش":"ʃ","ص":"s","ض":"z","ط":"t̪","ظ":"z","غ":"ɣ","ف":"f",
      "ق":"q","ک":"k","ك":"k","گ":"ɡ","ل":"l","م":"m","ن":"n","ݨ":"ɳ","ڻ":"ɳ"}
ANCH={c:[p] for c,p in CONS.items()}
ANCH["ل"]=["l","ɭ"]  # Gurmukhi ਲ਼ retroflex ɭ maps to plain ل in Shahmukhi (ویلا ʋeːɭaː)
# Punjabi tonogenesis at the anchor level: the historically-voiced-aspirate letters may surface DEVOICED
# (بھ pʰ~p, جھ t͡ʃ, دھ t̪, ڈھ ʈ, گھ k) — the tone lands on the vowel and rides the SHORT-vowel tag slot.
ANCH["ب"]=["b","p"]; ANCH["ج"]=["d͡ʒ","t͡ʃ"]; ANCH["د"]=["d̪","t̪"]; ANCH["ڈ"]=["ɖ","ʈ"]; ANCH["گ"]=["ɡ","k"]
ANCH["ن"]=["n̪","ɳ","ɲ","̃ŋ","ŋ","n","̃","m",""]
ANCH["م"]=["m","̃m",""]
ANCH["ا"]=["ɑː","aː","eː","ɛː","ʔ","ə","ɪ",""]  # loan names write initial eː/ɛː with bare alef (الیزر eːliːeːzəɾ)
ANCH["آ"]=["ɑː","aː","ʔ"]; ANCH["أ"]=["ʔ","ɑː",""]; ANCH["ٰ"]=["ɑː","aː"]
ANCH["و"]=["uːv","oːv","uː","oː","ɔː","ʋ","v","w",""]
ANCH["ی"]=["iːj","eːj","iː","eː","ɛː","j",""]; ANCH["ي"]=ANCH["ی"]; ANCH["ى"]=ANCH["ی"]
ANCH["ے"]=["eː","ɛː","j",""]; ANCH["ۓ"]=["eː","ɛː","j",""]
ANCH["ئ"]=["ʔ","iː","eː","j",""]; ANCH["ؤ"]=["ʔ","oː","uː","ʋ",""]
# ہ is the TONE letter medially/finally: it may surface as ɦ, a vowel, or NOTHING but a tone mark (which the
# vowel-tag slot absorbs) — the "" candidate carries those.
ANCH["ہ"]=["ɦ","ɑː","ɑ","e","ə",""]; ANCH["ه"]=["ɦ","e","ɑ",""]; ANCH["ھ"]=["ʰ","ʱ","ɦ",""]
ANCH["ں"]=["̃","n","ŋ",""]; ANCH["٘"]=["̃"]; ANCH["ء"]=["ʔ",""]; ANCH["ع"]=["ʔ",""]
ANCH["ۃ"]=["ə","ɑ","h",""]

def align(graph, ipa):
    ip=toks(ipa); j=0; tags=[]
    for ci,c in enumerate(graph):
        cand=ANCH.get(c); tag=""
        if ci==0:
            while j<len(ip) and ip[j]=="ʔ" and (not cand or "ʔ" not in cand): tag+=ip[j]; j+=1
        if cand is None: tags.append((c,"")); continue
        matched=False
        for a in cand:
            if a=="": matched=True; break
            u=toks(a)
            if ip[j:j+len(u)]==u:
                if len(u)>1 and ci+1<len(graph):
                    nxt=ANCH.get(graph[ci+1])
                    if nxt and any(x and toks(x)[0]==u[-1] for x in nxt): continue
                tag+="".join(u); j+=len(u); matched=True; break
        if not matched: return None
        if c in CONS and j<len(ip) and ip[j]==CONS[c]: tag+=ip[j]; j+=1
        if j<len(ip) and ip[j]=="ː": tag+="ː"; j+=1
        # following short vowel(s), each may carry TONE and/or nasalisation — all ride this char's tag
        while j<len(ip) and (ip[j] in SHORT or ip[j] in TONES or ip[j] in {"̃","̆"}):
            tag+=ip[j]; j+=1
        if j<len(ip) and ip[j]=="ː": tag+="ː"; j+=1
        # a tone mark directly after a LONG vowel the previous candidate consumed
        while j<len(ip) and ip[j] in TONES: tag+=ip[j]; j+=1
        tags.append((c,tag))
    if j!=len(ip):
        if tags: tags[-1]=(tags[-1][0], tags[-1][1]+"".join(ip[j:]))
        else: return None
    return tags

def load_pool():
    # PA_KAIKKI_ONLY=1 restricts training to the kaikki (dictionary-word) tranche — the title tranche is
    # 65% foreign proper nouns, a different distribution than the referee vocabulary the model must serve.
    only=None
    if os.environ.get("PA_KAIKKI_ONLY"):
        only=set(open("/tmp/pa_kaikki_keys.txt",encoding="utf8").read().split("\n"))
    pool=[]
    for l in open(CROSS,encoding="utf8"):
        if l.startswith("#") or "\t" not in l: continue
        w,ipa=l.rstrip("\n").split("\t")
        if only is not None and w not in only: continue
        pool.append((w, ipa.replace("ˈ","").replace("ˌ","")))
    return pool

if MODE=="align":
    pool=load_pool(); ok=0; fail=[]
    for skel,ipa in pool:
        a=align(skel,ipa)
        if a is not None and "".join(t for _,t in a)==ipa: ok+=1
        else: fail.append((skel,ipa))
    print(f"aligned {ok}/{len(pool)} ({100*ok//len(pool)}%)")
    random.seed(2); random.shuffle(fail)
    for skel,ipa in fail[:20]:
        a=align(skel,ipa)
        got="".join(t for _,t in a) if a else "None"
        print(f"  {skel:16} gold={ipa:22} got={got}")
    sys.exit(0)

# ================= TRAIN =================
import torch, torch.nn as nn, hashlib, time
random.seed(1234); torch.manual_seed(1234)
dev = "cuda" if torch.cuda.is_available() else "cpu"

pool=load_pool()
aligned=[]
for skel,ipa in pool:
    a=align(skel,ipa)
    if a is not None and "".join(t for _,t in a)==ipa:
        aligned.append((skel, ipa, [c for c,_ in a],[t for _,t in a]))
# deterministic hash split (not shuffle) so the held-out set is stable across runs
dev_set=[x for x in aligned if int(hashlib.sha1(x[0].encode()).hexdigest()[:8],16)%10==0]
train=[(c,t) for s,_,c,t in aligned if int(hashlib.sha1(s.encode()).hexdigest()[:8],16)%10!=0]
print(f"# aligned {len(aligned)} | train {len(train)} | held-out {len(dev_set)} | dev={dev}", file=sys.stderr, flush=True)

cv={"<pad>":0,"<unk>":1}; lv={"<pad>":0}
for chars,labs in train:
    for c in chars: cv.setdefault(c,len(cv))
    for t in labs: lv.setdefault(t,len(lv))
cid=lambda c: cv.get(c,1); lid=lambda t: lv.get(t,0)
ilv={i:t for t,i in lv.items()}
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
EPOCHS=int(os.environ.get("PA_EPOCHS",30))
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
torch.save({"model":m.state_dict(),"cv":cv,"lv":lv,"char_mask":char_mask.cpu()}, f"{HERE}/tools/perso-arabic/pa_restorer.pt")

# ================= EMIT PREDICTIONS (scored in tsx with the eval folds — never here) =================
m.eval()
def predict_word(w):
    X=torch.tensor([[cid(c) for c in w]],device=dev)
    lo=m(X)+char_mask[X]
    ids=lo.argmax(-1)[0].tolist()
    return "".join(ilv[i] for i in ids)

cross_words={s for s,_,_,_ in aligned}
with open("/tmp/pa_restorer_preds.tsv","w",encoding="utf8") as f:
    for s,ipa,_,_ in dev_set:
        f.write(f"{s}\t{predict_word(s)}\theldout\t{ipa}\n")
    seen=set()
    for l in open(WIKI,encoding="utf8"):
        p=l.rstrip("\n").split("\t")
        if len(p)>=2 and p[0] and p[0] not in seen:
            seen.add(p[0])
            which = "referee-covered" if p[0] in cross_words else "referee-oov"
            f.write(f"{p[0]}\t{predict_word(p[0])}\t{which}\t\n")
print("# predictions → /tmp/pa_restorer_preds.tsv", file=sys.stderr)
