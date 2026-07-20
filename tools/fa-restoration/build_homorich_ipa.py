#!/usr/bin/env python3
"""Build the MODERN fa context training data: HomoRich → Grapheme<TAB>canonical-IPA.

HomoRich (https://huggingface.co/datasets/MahtaFetrat/HomoRich-G2P-Persian, CC0) is ~528k modern homograph-rich
Persian sentences. We train on the clean `Phoneme` column (Grapheme→phoneme), which — unlike the `Mapped Phoneme` /
`IPA Homograph Phoneme` columns — keeps the glottal onset and encodes vowel length implicitly, the convention that
matches our fa (verified against getPhonemizer("fa")). We map that scheme to our canonical IPA deterministically,
and gheyn-condition ق/غ back to our fa's q/ɣ split (HomoRich merges them to `q`, the Iranian phonemic merge).

  # fetch the parquet once (CC0):
  #   huggingface-cli download MahtaFetrat/HomoRich-G2P-Persian --repo-type dataset --local-dir <dir>
  python build_homorich_ipa.py <homorich.parquet> <out homorich_ipa.tsv>
"""
import sys, re
import pyarrow.parquet as pq

# HomoRich clean-`Phoneme` scheme → our fa canonical IPA (verified vs getPhonemizer("fa")).
MAP = {
    'A': 'aː', 'i': 'iː', 'u': 'uː',                 # tense/long vowels (length implicit in the scheme)
    'a': 'a', 'e': 'e', 'o': 'o',                    # short vowels
    'S': 'ʃ', 'Z': 'ʒ', 'C': 't͡ʃ', 'j': 'd͡ʒ',        # sibilants / affricates
    'y': 'j', 'g': 'ɡ', 'r': 'ɾ', '?': 'ʔ',          # glide, script-g, tap, glottal onset (we keep it)
    'b': 'b', 'd': 'd', 'f': 'f', 'h': 'h', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n',
    'p': 'p', 's': 's', 't': 't', 'v': 'v', 'x': 'x', 'z': 'z',
    ' ': ' ', '-': '',                               # hyphen → concatenate
}
def to_ipa(ph): return "".join(MAP.get(c, c) for c in ph)

HARAKAT = re.compile(r'[ً-ْٰـ]')
def clean_g(g):
    # strip harakat; ZWNJ/ZWJ → CONCATENATE (not space): HomoRich writes می‌خوانم / کتاب‌ها as ONE phoneme word, so
    # joining keeps the word-count aligned (recovers ~96% of the 42% ZWNJ rows) AND matches the runtime, which
    # strips ZWNJ before feeding the model.
    g = HARAKAT.sub('', g).replace('‌', '').replace('‍', '')
    g = re.sub(r'[^ء-يپچژکگی ]', ' ', g)
    return re.sub(r'\s+', ' ', g).strip()

def main(parquet_path, out_path):
    d = pq.read_table(parquet_path).to_pydict()
    seen = set(); out = []
    for graw, ph in zip(d['Grapheme'], d['Phoneme']):
        if not graw or not ph: continue
        g = clean_g(graw); gw = g.split(); pw = ph.split()
        if not g or len(gw) != len(pw) or len(g) > 120: continue
        ipw = []
        for a, b in zip(gw, pw):
            ib = to_ipa(b)
            if 'غ' in a and 'ق' not in a:            # gheyn-only word → q back to ɣ (our fa split)
                ib = ib.replace('q', 'ɣ')
            ipw.append(ib)
        ipa = " ".join(ipw).strip()
        if not ipa or g in seen: continue
        seen.add(g); out.append((g, ipa))
    with open(out_path, "w", encoding="utf8") as f:
        for g, i in out: f.write(f"{g}\t{i}\n")
    print(f"wrote {len(out)} Grapheme→canonical-IPA pairs → {out_path}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
