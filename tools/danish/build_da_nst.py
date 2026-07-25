#!/usr/bin/env python3
"""Build the Danish data artifacts from the NST pronunciation lexicon (CC0) — the nb pattern (build_nb_data.py).

Inputs (both public):
  - NST — Danish pronunciation lexicon, Nasjonalbiblioteket / Språkbanken (sbr-26), CC0 / public domain.
      https://www.nb.no/sbfil/leksikalske_databaser/leksikon/da_leksikon.tar.gz  →  dan030224NST.pron
      (ISO-8859-1, ';'-separated, 51 fields; field 0 = word, field 11 = X-SAMPA transcription.)
  - a frequency wordlist — OpenSubtitles Danish (hermitdave FrequencyWords, CC BY-SA), one "word count" per line.
      The shipped src/languages/danish/da-lexicon.tsv is the NST ∩ (top ~50k of this list).

Outputs:
  - src/languages/danish/da-lexicon.tsv — tier-1 SHIPPING lexicon: the freq-list words that NST covers, each mapped to
    its SHORTEST NST variant → canonical IPA (NARROW: r-vocalisation ɐ, stop lenition, soft-d ð, length ː, stød ˀ).
    ~37k forms. The frequency head (~98.2% of real-text tokens) — the full 199k differs only on the rank>50k tail,
    which the BiLSTM (trained on the FULL set) recovers, so trimming keeps the bundle ~7× smaller at no head cost.
  - <train-out> (default /tmp/da_train.tsv) — the FULL NST (every alphabetic word → shortest IPA), the OOV BiLSTM
    tagger's training set (da_bilstm.py, DA_LEX). NOT shipped (~199k) — a trimmed set would re-starve the tagger.

    python3 tools/danish/build_da_nst.py --pron <dan030224NST.pron> --freq <da_50k.txt>

Danish X-SAMPA → IPA. Stress " → ˈ, secondary % → ˌ; syllable $ dropped; length : → ː; STØD ? → ˀ; the palatalised
s' (‑tion) → ʃ. Multi-word entries (containing _ / ¤ / space) are skipped.
"""
import argparse, io, os, re

VOWEL = {"A": "ɑ", "E": "ɛ", "O": "ɔ", "Q": "ɒ", "2": "ø", "9": "œ", "6": "ɐ", "@": "ə",
         "a": "a", "e": "e", "i": "i", "o": "o", "u": "u", "y": "y"}
CONS = {"b": "b", "d": "d", "f": "f", "g": "ɡ", "h": "h", "j": "j", "k": "k", "l": "l", "m": "m", "n": "n",
        "p": "p", "r": "r", "s": "s", "t": "t", "v": "v", "w": "w", "D": "ð", "N": "ŋ", "R": "ʁ"}


def convert(s: str) -> str:
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == "s" and i + 1 < len(s) and s[i + 1] == "'":  # s' → ʃ (the -tion/-sion palatalisation)
            out.append("ʃ"); i += 2; continue
        if c == '"': out.append("ˈ"); i += 1; continue
        if c == "%": out.append("ˌ"); i += 1; continue
        if c == "'": i += 1; continue
        if c == ":": out.append("ː"); i += 1; continue
        if c == "?": out.append("ˀ"); i += 1; continue  # STØD
        if c in "$_¤ ": i += 1; continue  # syllable / compound / word boundaries dropped
        if c in VOWEL: out.append(VOWEL[c]); i += 1; continue
        if c in CONS: out.append(CONS[c]); i += 1; continue
        i += 1  # unknown → skip
    return "".join(out)


def read_nst(pron: str) -> dict:
    """word(lower) → list of distinct IPA variants (order preserved), alphabetic single words only."""
    var: dict[str, list[str]] = {}
    for line in io.open(pron, encoding="latin-1"):
        f = line.rstrip("\r\n").split(";")
        if len(f) <= 11 or not f[0] or not f[11]:
            continue
        w = f[0].lower()
        if " " in w or "_" in f[0] or not w.isalpha():  # single alphabetic words only (skip multi-word/abbrev)
            continue
        ipa = convert(f[11])
        if ipa:
            var.setdefault(w, []).append(ipa)
    return {w: list(dict.fromkeys(vs)) for w, vs in var.items()}


_DIACRITIC = re.compile(r"[ˈˌːˀ]")  # stress / length / stød — NOT phonemic segments


def shortest(vs: list[str]) -> str:
    """Pick the running-speech variant that best preserves the NARROW convention. NST lists, for common short words,
    both the word's reading AND spelled-letter / abbreviation expansions (af → aːˀɛf = "A-F"), plus careful-vs-reduced
    forms. Primary key: fewest phonemic SEGMENTS (diacritics stripped) — this drops the letter-expansion artifacts
    (which add segments) and keeps the running-speech form, the nb rationale. Tie-break: MOST stød+length marks — so
    between two same-segment variants (adler ˈaðˀlɐ vs ˈaðlɐ) we keep the one carrying the phonemic stød/length the
    lexicon exists to preserve, rather than the char-shortest (which would strip it). Final tie: NST order. Danish NST
    is ~98.8% single-variant, so this only bites on the multi-variant head — but there it recovers stød on ~650 shipped
    words a plain char-length `min` silently dropped."""
    def key(s: str) -> tuple:
        return (len(_DIACRITIC.sub("", s)), -(s.count("ˀ") + s.count("ː")), vs.index(s))
    return min(vs, key=key)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pron", required=True, help="dan030224NST.pron")
    ap.add_argument("--freq", required=True, help="frequency wordlist (OpenSubtitles da, \"word count\" per line)")
    ap.add_argument("--top", type=int, default=50000, help="keep the top-N freq words in the shipping lexicon")
    ap.add_argument("--train-out", default="/tmp/da_train.tsv")
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    lex_out = os.path.join(here, "..", "..", "src", "languages", "danish", "da-lexicon.tsv")

    var = read_nst(args.pron)
    print(f"NST: {len(var):,} alphabetic word forms")

    # FULL training set (every NST word → shortest IPA) for the OOV tagger (da_bilstm.py). A trimmed set re-starves it.
    with io.open(args.train_out, "w", encoding="utf-8", newline="\n") as fo:
        for w in sorted(var):
            fo.write(f"{w}\t{shortest(var[w])}\n")
    print(f"train set: {len(var):,} words → {args.train_out}")

    # SHIPPING lexicon: the top-N frequency words that NST covers, shortest variant, frequency order.
    freq = []
    for line in io.open(args.freq, encoding="utf-8"):
        p = line.split()
        if p and not line.startswith("#"):
            freq.append(p[0].lower())
    keep = [w for w in freq[:args.top] if w in var]
    with io.open(lex_out, "w", encoding="utf-8", newline="\n") as fo:
        fo.write("# Danish pronunciation lexicon — word<TAB>IPA. From the NST Danish lexicon (Nasjonalbiblioteket /\n")
        fo.write("# Sprakbanken, sbr-26), CC0 / public domain, ∩ the top-50k OpenSubtitles da frequency list (hermitdave\n")
        fo.write("# FrequencyWords, CC BY-SA). Narrow convention: r-vocalisation ɐ, stop lenition, soft-d ð, length ː,\n")
        fo.write("# stød ˀ. Shortest NST variant. Built by tools/danish/build_da_nst.py. The BiLSTM/rule handle OOV.\n")
        for w in keep:  # frequency order (most common first)
            fo.write(f"{w}\t{shortest(var[w])}\n")
    print(f"lexicon: {len(keep):,}/{min(args.top, len(freq)):,} freq words covered by NST → {lex_out}")


if __name__ == "__main__":
    main()
