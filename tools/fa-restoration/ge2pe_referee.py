#!/usr/bin/env python3
"""Build the INDEPENDENT fa referee tools/referee-eval/referees/fa.ge2pe-ezafe-homograph.tsv from the GE2PE
Kasre(ezafe) + Homograph test sets (github.com/Sharif-SLPL/GE2PE, MIT, (c) 2025 Elnaz Rahmati). Non-circular vs
HomoRich (different lineage). Fetches the two CSVs, maps the GE2PE ASCII phoneme scheme → our canonical IPA,
normalizes graphemes Arabic→Farsi, and emits grapheme<TAB>IPA<TAB>category. Run: python ge2pe_referee.py > <out.tsv>
(needs network). Eval the tagger against it with tools/fa-restoration/ge2pe-eval.ts."""
import sys, csv, io, urllib.request
BASE = "https://raw.githubusercontent.com/Sharif-SLPL/GE2PE/main/Data"
# GE2PE ASCII → our IPA. digits 1 (kasre/ezafe) and 2 (homograph target) are TAGS, stripped.
M = {"@":"ʔ","/":"a","a":"aː","i":"iː","u":"uː","e":"e","o":"o","A":"aː","$":"ʃ","c":"t͡ʃ","j":"d͡ʒ","y":"j","q":"q",
     "x":"x","g":"ɡ","r":"ɾ","'":"ʔ","Z":"ʒ","C":"t͡ʃ","G":"ɣ","p":"p","b":"b","t":"t","d":"d","k":"k","f":"f",
     "v":"v","s":"s","z":"z","h":"h","m":"m","n":"n","l":"l","w":"v"}
NORM = str.maketrans({"ي":"ی","ك":"ک","ى":"ی","ة":"ه"})
PUNC = set("،؛.؟!:|«»()-–—…\"'")
def conv(ph): return "".join(M.get(c, "") for c in ph.replace("1", "").replace("2", ""))
HDR = [
 "# fa INDEPENDENT referee — GE2PE Kasre(ezafe) + Homograph test sets, converted to our canonical IPA.",
 "# SOURCE: GE2PE (github.com/Sharif-SLPL/GE2PE), MIT License, (c) 2025 Elnaz Rahmati, Sharif Speech Lab.",
 "# NON-CIRCULAR: different lineage from HomoRich (our training data, by MahtaFetrat). Modern Iranian register",
 "# (0 majhul vowels). ADVERSARIAL: every sentence stresses ezafe (kasre) or a homograph — a hard slice, not a",
 "# representative corpus. Format: grapheme_sentence <TAB> our-IPA_sentence <TAB> category(ezafe|homograph).",
 "# Build/eval: tools/fa-restoration/ge2pe_referee.py + ge2pe-eval.ts. Graphemes normalized Arabic→Farsi.",
]
out = sys.stdout
for h in HDR: out.write(h + "\n")
for fn, cat in (("Kasre_test.csv", "ezafe"), ("Homograph_test.csv", "homograph")):
    data = urllib.request.urlopen(f"{BASE}/{fn}").read().decode("utf8")
    for row in csv.reader(io.StringIO(data)):
        if len(row) < 2 or row[0] == "Grapheme": continue
        gw = [w for w in row[0].translate(NORM).replace("‌", "").split() if w and not all(c in PUNC for c in w)]
        pw = [w for w in row[1].split() if w and w != ";" and not all(c in PUNC for c in w)]
        if len(gw) != len(pw) or not gw: continue
        out.write(f"{' '.join(gw)}\t{' '.join(conv(p) for p in pw)}\t{cat}\n")
