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
# Orthographic unification: Arabic look-alikes → their Persian codepoint (the SAME letter). Without this the encoder
# gets DISTINCT tokens for ي/ی and ك/ک (~2.8k tokens train a rare, separate embedding instead of the common one).
ORTHO = str.maketrans({'ي': 'ی', 'ى': 'ی', 'ك': 'ک'})
def clean_g(g):
    # strip harakat; ZWNJ/ZWJ → CONCATENATE (not space): HomoRich writes می‌خوانم / کتاب‌ها as ONE phoneme word, so
    # joining keeps the word-count aligned (recovers ~96% of the 42% ZWNJ rows) AND matches the runtime, which
    # strips ZWNJ before feeding the model.
    g = HARAKAT.sub('', g).replace('‌', '').replace('‍', '').translate(ORTHO)
    g = re.sub(r'[^ء-يپچژکگی ]', ' ', g)
    return re.sub(r'\s+', ' ', g).strip()

# High-frequency function words with fixed SHORT pronunciations (≤4 IPA segments); if one is paired with a long
# IPA token the row's word alignment is broken (or corrupted) and is dropped.
FUNC_SHORT = {'از', 'به', 'که', 'در', 'با', 'و', 'را', 'تا', 'این', 'آن', 'هم', 'یا', 'من', 'تو', 'او', 'ما', 'شما'}

def hiatus_norm(gword, iword):
    """Normalize the word-final -i hiatus glide to OUR fa convention (verified vs getPhonemizer):
       after -e → [ʔ]  (our fa merges epenthesis + ع/ء to ʔ, and this restores the ع HomoRich dropped: واقعی);
       after -ā → [j]  ONLY when the -i rides on an -ā glide (grapheme stem ends alef), so a real word-final ع/ء
                       (اجتماعی → …ʔiː) is preserved — conditioned on the FINAL cluster, not any ع/ء in the word."""
    w = re.sub(r'e[j]?iː$', 'eʔiː', iword)
    s = gword.rstrip('ی')          # gword is ORTHO-normalized, so this catches جدايي→جدایی too
    if s and s[-1] in 'اآ':
        w = re.sub(r'aː[ʔ]?iː$', 'aːjiː', w)
    return w

def main(parquet_path, out_path):
    d = pq.read_table(parquet_path).to_pydict()
    hom_g = d.get('Homograph Grapheme', [None] * len(d['Grapheme']))
    seen = set(); out = []
    for graw, ph, hg in zip(d['Grapheme'], d['Phoneme'], hom_g):
        if not graw or not ph: continue
        g = clean_g(graw); gw = g.split(); pw = ph.split()
        if not g or len(gw) != len(pw) or len(g) > 120: continue
        ipw = []
        for a, b in zip(gw, pw):
            ib = to_ipa(b)
            if 'غ' in a and 'ق' not in a:            # gheyn-only word → q back to ɣ (our fa split)
                ib = ib.replace('q', 'ɣ')
            ib = hiatus_norm(a, ib)                  # word-final -i hiatus glide → our fa convention
            ipw.append(ib)
        # drop MISALIGNED rows: a short function word (fixed ≤4-segment pronunciation) paired with a ≥5-segment IPA
        # is broken alignment / corruption (در ↔ varzeʃ). Plus the specific "input" corruption signature
        # ʔiːnpuːt… (این/اگر/اینجا → ʔiːnpuːtʔaːjn) which no legit word produces (کاپوت→kaːpuːt has no ʔiːn prefix).
        if any(a in FUNC_SHORT and len(b.replace('ː', '').replace('͡', '')) >= 5 for a, b in zip(gw, ipw)):
            continue
        if any('ʔiːnpuːt' in b for b in ipw):
            continue
        ipa = " ".join(ipw).strip()
        if not ipa or g in seen: continue
        # 3rd column: index of the annotated HOMOGRAPH word in the sentence (or -1) — the supervision HomoRich
        # provides that a plain Grapheme→Phoneme model ignores. Used for loss-weighting the homograph token.
        hidx = -1
        if hg:
            chg = clean_g(hg)
            if chg in gw: hidx = gw.index(chg)
        seen.add(g); out.append((g, ipa, hidx))
    with open(out_path, "w", encoding="utf8") as f:
        for g, i, h in out: f.write(f"{g}\t{i}\t{h}\n")
    n_hom = sum(1 for _, _, h in out if h >= 0)
    print(f"wrote {len(out)} Grapheme→canonical-IPA pairs → {out_path} ({n_hom} with a homograph label)")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
