#!/usr/bin/env python3
"""fa STRUCTURAL tagger — the DEFAULT modern fa restorer (ships as src/languages/persian/fa-tagger.int8.onnx).
Sentence-level BiLSTM that labels each abjad char with its IPA-chunk TAG (consonant/vowel + following short
vowel/ezafe, from the monotonic aligner). Consonants are COPIED inside the tags; output length == input length →
CANNOT degenerate, CANNOT break the skeleton. Context (ezafe/homographs) comes from the bidirectional pass.

Reproduce:  build_homorich_ipa.py <homorich.parquet> homorich_ipa_clean.tsv   # grapheme→canonical IPA (CC0)
            python train_tagger.py <dir-with homorich_ipa_clean.tsv + test_heldout.tsv>   # writes fa_tagger.pt
            python export_tagger_onnx.py <same-dir> src/languages/persian   # writes fa-tagger.int8.onnx + .meta.json
test_heldout.tsv is a 1500-sentence slice held out of training by the skeleton leakage guard below. FA_WARM=1
warm-starts from a saved fa_tagger.pt (4 epochs) for a single vocab-preserving change. See fa-tagger.PROVENANCE.md."""
import sys, os, random
import torch, torch.nn as nn
random.seed(1234); torch.manual_seed(1234)
dev = "cuda" if torch.cuda.is_available() else "cpu"
SP = sys.argv[1]
# ---- aligner (from ur_align.py) ----
UNITS = ["t͡ʃ","d͡ʒ","xʷ","aː","uː","iː","eː","oː","ɑː","a","e","o","u","i","ɑ","æ","ə",
         "b","p","t","s","h","x","d","z","ʒ","ʃ","ɾ","r","ʔ","ɣ","f","q","k","ɡ","g","l","m","n","j","w","v","ŋ","ʰ","ː","̃","ʲ"]
UNITS.sort(key=len, reverse=True); SHORT={"a","e","o"}
def toks(s):
    out=[]; i=0
    while i<len(s):
        for u in UNITS:
            if s.startswith(u,i): out.append(u); i+=len(u); break
        else: out.append(s[i]); i+=1
    return out
CONS={"ب":"b","پ":"p","ت":"t","ث":"s","ج":"d͡ʒ","چ":"t͡ʃ","ح":"h","خ":"x","د":"d","ذ":"z","ر":"ɾ","ز":"z","ژ":"ʒ","س":"s","ش":"ʃ","ص":"s","ض":"z","ط":"t","ظ":"z","ع":"ʔ","غ":"ɣ","ف":"f","ق":"q","ک":"k","ك":"k","گ":"ɡ","ل":"l","م":"m","ن":"n"}
ANCH={c:[p] for c,p in CONS.items()}
ANCH["ا"]=["aː","ʔ","ɑː",""]; ANCH["آ"]=["aː","ʔ","ɑː"]; ANCH["ٰ"]=["aː"]
# HIATUS: ی/و before a vowel are realized as vowel+GLIDE (نیاز niːjaːz, زیاد ziːjaːd, بسیار besiːjaːɾ) — one written
# char producing TWO IPA units (iːj/uːv). Without these candidates every hiatus word fails to align and is masked
# out of training (7185 words, 1.8%), so the tagger never learns the class and drops the glide (Run 28). Multi-token
# candidates are listed LONGEST-FIRST so the aligner prefers iːj over iː (greedy longest match).
ANCH["و"]=["uːv","oːv","uː","oː","v","w",""]; ANCH["ی"]=["iːj","eːj","iː","eː","j",""]; ANCH["ي"]=ANCH["ی"]
ANCH["ه"]=["h","e",""]; ANCH["ء"]=["ʔ",""]; ANCH["ئ"]=["ʔ","j",""]; ANCH["ۀ"]=["e","h"]
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
            u=toks(a)  # candidate may be MULTI-token (iːj = [iː, j]); match a slice of the IPA stream
            if ip[j:j+len(u)]==u: tag+="".join(u); j+=len(u); matched=True; break
        if not matched: return None
        while j<len(ip) and ip[j] in SHORT: tag+=ip[j]; j+=1
        tags.append((c,tag))
    if j!=len(ip):
        if tags: tags[-1]=(tags[-1][0], tags[-1][1]+"".join(ip[j:]))
        else: return None
    return tags
def align_sentence(graph, ipa):
    # MASKED: keep the whole sentence for context; align every word we can, and MASK (label None → ignored in loss)
    # the words that don't align, instead of dropping the sentence. Uses ~93% of words vs 56% of full sentences.
    gw, iw = graph.split(), ipa.split()
    if len(gw)!=len(iw): return None
    chars=[]; labs=[]; any_ok=False
    for wi,(g,i) in enumerate(zip(gw,iw)):
        if wi>0: chars.append(" "); labs.append(" ")   # word boundary
        a=align(g,i)
        if a is None or "".join(t for _,t in a)!=i:
            for c in g: chars.append(c); labs.append(None)   # masked (no gold tag)
        else:
            any_ok=True
            for c,t in a: chars.append(c); labs.append(t)
    return (chars, labs) if any_ok else None
# ---- data ----
# CLEAN eval: held-out = the seq2seq's exact test_heldout.tsv (grapheme, gold); EXCLUDE those from training.
heldrows=[l.rstrip("\n").split("\t") for l in open(f"{SP}/test_heldout.tsv",encoding="utf8") if "\t" in l]
heldskel=set(r[0] for r in heldrows if len(r)>=2)
rows=[l.rstrip("\n").split("\t") for l in open(f"{SP}/homorich_ipa_clean.tsv",encoding="utf8") if "\t" in l]
random.shuffle(rows)
train=[]
for p in rows:
    if len(p)<2 or p[0] in heldskel: continue   # leakage guard
    a=align_sentence(p[0],p[1])
    if a: train.append(a)
print(f"# train aligned {len(train)} | held-out {len(heldrows)} (excluded from train) dev={dev}", file=sys.stderr, flush=True)
PAD=0
cv={"<pad>":0,"<unk>":1}; lv={"<pad>":0}   # char vocab, label(tag) vocab (0 = pad/mask, ignored in loss)
for chars,labs in train:
    for c in chars: cv.setdefault(c,len(cv))
    for t in labs:
        if t is not None: lv.setdefault(t,len(lv))
ilv={i:t for t,i in lv.items()}
cid=lambda c: cv.get(c,1); lid=lambda t: 0 if t is None else lv.get(t,0)
# CONSONANT-CONSISTENCY MASK: each char may only emit tags it actually produced in training (so ص can't become ʃ,
# غ can't become ɡ) — the char fixes the consonant, the model only picks the vowel decoration. Fixes the 17%
# consonant-substitution errors by construction. Applied at train + inference.
char_tags={}
for chars,labs in train:
    for c,t in zip(chars,labs):
        if t is not None: char_tags.setdefault(c,set()).add(lv[t])
char_mask=torch.full((len(cv),len(lv)),-1e9)
for c,ci in cv.items():
    valid=char_tags.get(c)
    if not valid: char_mask[ci,:]=0.0                # unseen char → allow all (fallback)
    else:
        for t in valid: char_mask[ci,t]=0.0
    char_mask[ci,0]=0.0                              # always allow PAD
char_mask=char_mask.to(dev)
class Tagger(nn.Module):
    def __init__(s,nc,nl,emb=128,h=256):
        super().__init__(); s.e=nn.Embedding(nc,emb,0); s.lstm=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2); s.o=nn.Linear(2*h,nl)
    def forward(s,x): return s.o(s.lstm(s.e(x))[0])
m=Tagger(len(cv),len(lv)).to(dev); opt=torch.optim.Adam(m.parameters(),1e-3); crit=nn.CrossEntropyLoss(ignore_index=PAD)
Tr=[( [cid(c) for c in ch], [lid(t) for t in lb]) for ch,lb in train]
def batches(N):
    idx=list(range(N)); random.shuffle(idx)
    for k in range(0,N,256): yield idx[k:k+256]
import time
# WARM-START: FA_WARM=1 loads the saved model to fine-tune ONE vocab-preserving change (mask/hyperparam/data-filter)
# in a few epochs instead of 12 from scratch. Refuses if the tag vocab changed (an alignment/tag change needs fresh).
EPOCHS=int(os.environ.get("FA_EPOCHS", 12))
if os.environ.get("FA_WARM") and os.path.exists(f"{SP}/fa_tagger.pt"):
    ck=torch.load(f"{SP}/fa_tagger.pt",map_location=dev,weights_only=False)
    if ck["cv"]==cv and ck["lv"]==lv:
        m.load_state_dict(ck["model"]); EPOCHS=int(os.environ.get("FA_EPOCHS", 4))
        print(f"# WARM-STARTED from fa_tagger.pt → {EPOCHS} epochs", file=sys.stderr, flush=True)
    else:
        print("# FA_WARM set but vocab changed → from scratch (12 ep)", file=sys.stderr, flush=True)
for e in range(EPOCHS):
    m.train(); te=time.time(); tl=0; nb=0
    for b in batches(len(Tr)):
        mx=max(len(Tr[i][0]) for i in b)
        X=torch.zeros(len(b),mx,dtype=torch.long); Y=torch.zeros(len(b),mx,dtype=torch.long)
        for r,i in enumerate(b):
            X[r,:len(Tr[i][0])]=torch.tensor(Tr[i][0]); Y[r,:len(Tr[i][1])]=torch.tensor(Tr[i][1])
        X,Y=X.to(dev),Y.to(dev); lo=m(X)+char_mask[X]; loss=crit(lo.reshape(-1,len(lv)),Y.reshape(-1))
        opt.zero_grad(); loss.backward(); opt.step(); tl+=loss.item(); nb+=1
    print(f"# epoch {e+1}/{EPOCHS} loss {tl/nb:.3f} {time.time()-te:.0f}s", file=sys.stderr, flush=True)
# SAVE the trained model + vocabs so all downstream analysis (miss dumps, taxonomy, aligner tweaks that only touch
# inference) runs WITHOUT retraining. See fa_infer.py.
torch.save({"model": m.state_dict(), "cv": cv, "lv": lv, "char_mask": char_mask.cpu()}, f"{SP}/fa_tagger.pt")
print(f"# saved model → fa_tagger.pt", file=sys.stderr, flush=True)
# ---- eval (per-word, assembled) ----
m.eval()
def predict(chars):
    X=torch.tensor([[cid(c) for c in chars]],device=dev)
    with torch.no_grad(): tags=(m(X)+char_mask[X])[0].argmax(-1).tolist()
    return [ilv.get(t,"") for t in tags]
def assemble(chars):  # run tagger on raw chars, concat predicted tags, split into words by spaces
    pt=predict(chars); w=[[]]
    for c,t in zip(chars,pt):
        if c==" ": w.append([])
        else: w[-1].append("" if t==" " else t)
    return ["".join(x) for x in w]
VOW=set("aeiouɑæəː")
skel=lambda w: "".join(c for c in w if c not in VOW)   # consonant skeleton (drop vowels+length)
W=ok=degen=sent=0; graceful=cons_err=catastrophic=0
_miss=open(f"{SP}/fa_tagger_misses.tsv","w",encoding="utf8")
for r in heldrows:
    if sent>=1500: break
    if len(r)<2: continue
    sent+=1
    pw=assemble(list(r[0])); gw=r[1].split(); grw=r[0].split()
    if len(pw)!=len(gw): degen+=1
    for k in range(len(gw)):
        W+=1
        p=pw[k] if k<len(pw) else ""; g=gw[k]
        if p==g: ok+=1
        else:
            _miss.write(f"{grw[k] if k<len(grw) else ''}\t{p}\t{g}\n")
            # severity: repetition? (a char-token repeated 3x = catastrophic); consonant skeleton same = graceful vowel
            import re as _re
            if _re.search(r'(..)\1\1', p): catastrophic+=1
            elif skel(p)==skel(g): graceful+=1
            else: cons_err+=1
_miss.close()
miss=graceful+cons_err+catastrophic
print(f"STRUCTURAL TAGGER — CLEAN held-out ({sent} sentences, {W} words, no leakage, ALL words):")
print(f"  per-word           : {ok}/{W} ({100*ok/max(W,1):.1f}%)   [seq2seq rollout-ep3 was 90.5-90.9%]")
print(f"  word-count mismatch: {degen}/{sent} ({100*degen/max(sent,1):.1f}%)")
print(f"  ERROR SEVERITY of the {miss} misses:")
print(f"    graceful (wrong vowel, consonants right): {graceful} ({100*graceful//max(miss,1)}%)")
print(f"    consonant/structural error             : {cons_err} ({100*cons_err//max(miss,1)}%)")
print(f"    catastrophic (repetition)              : {catastrophic} ({100*catastrophic//max(miss,1)}%)")
print(f"  tag vocab {len(lv)} | char vocab {len(cv)}")
