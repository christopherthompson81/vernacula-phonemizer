#!/usr/bin/env python3
"""Production COVERAGE eval — the axis the held-out generalization eval can't see (docs Run 20).

The held-out eval measures neural GENERALIZATION to novel words (at its g2p-coverage ceiling). But production
accuracy is COVERAGE-dominated: most TOKENS in real text are common/seen words the LEXICON handles exactly. This
measures that — for a real token-frequency list (OpenSubtitles), the fraction of TOKENS whose (undiacritized)
skeleton is in each data layer — so the data-scaling that genuinely works (kaikki, Hindi→Urdu) becomes VISIBLE:
each source raises token-coverage.

Layers (cumulative): wikipron reference → +kaikki → +Hindi→Urdu · and the LABELED lexicon (what we can vocalize
today = harakat.<lang>.silver.tsv). Reports TOKEN coverage (freq-weighted, = production reality) and TYPE coverage.

  curl hermitdave FrequencyWords (OpenSubtitles token-frequency lists, CC-BY-SA) → /tmp/freq_{ur,fa}.txt ; python3 coverage_eval.py
"""
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
_STRIP = [(0x0610, 0x061A), (0x064B, 0x065F), (0x0670, 0x0670),
          (0x06D6, 0x06DC), (0x06DF, 0x06E8), (0x06EA, 0x06ED), (0x0640, 0x0640)]
DIA = re.compile("[" + "".join(f"{chr(a)}-{chr(b)}" if a != b else chr(a) for a, b in _STRIP) + "]")
PERSO = re.compile(r"^[؀-ۿݐ-ݿ]+$")
LANGS = {"ur": "urd", "fa": "fas"}  # freq-file code → silver code


def skel(w):
    return DIA.sub("", unicodedata.normalize("NFC", w)).strip()


def load_skels(fname, code):
    s = set()
    p = os.path.join(HERE, fname)
    if not os.path.exists(p):
        return s
    for line in open(p, encoding="utf-8"):
        c = line.split("\t")
        if len(c) >= 2 and (len(c) < 3 or c[1] == code):
            s.add(c[0])
    return s


def main():
    print(f"{'lang':<5}{'layer':<26}{'token-cov':>10}{'type-cov':>10}")
    print("-" * 51)
    for code, silver in LANGS.items():
        fp = f"/tmp/freq_{code}.txt"
        if not os.path.exists(fp):
            print(f"{code}: missing {fp}"); continue
        # freq list → skeleton → total frequency (a word's tokens attach to its undiacritized skeleton).
        freq = {}
        for line in open(fp, encoding="utf-8"):
            parts = line.split()
            if len(parts) != 2 or not parts[1].isdigit():
                continue
            w = skel(parts[0])
            if len(w) >= 2 and PERSO.match(w):
                freq[w] = freq.get(w, 0) + int(parts[1])
        total_tok = sum(freq.values())
        total_typ = len(freq)

        wiki = {s for s in load_skels("silver.tsv", silver)}
        kaikki = load_skels("silver.kaikki.tsv", silver)
        hindi = load_skels("silver.hindiurdu.tsv", silver)
        lexicon = load_skels(f"lexicon.{code}.tsv", code)  # the SHIPPABLE lexicon (all sources, vocalized)

        layers = [("wikipron reference", wiki),
                  ("  + kaikki", wiki | kaikki),
                  ("  + Hindi→Urdu", wiki | kaikki | hindi),
                  ("SHIPPABLE lexicon (vocalized)", lexicon)]
        for name, cov in layers:
            tok = sum(f for w, f in freq.items() if w in cov)
            typ = sum(1 for w in freq if w in cov)
            print(f"{code:<5}{name:<26}{100*tok/max(total_tok,1):>9.1f}%{100*typ/max(total_typ,1):>9.1f}%")
        print(f"{'':5}(corpus: {total_typ} types, {total_tok:,} tokens)")
        print("-" * 51)


if __name__ == "__main__":
    main()
