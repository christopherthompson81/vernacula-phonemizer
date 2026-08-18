#!/usr/bin/env python3
"""Build src/languages/serbian/stress.tsv — the Serbo-Croatian lexical accent lexicon.

Serbo-Croatian stress is lexical and unwritten in ordinary text, so the engine cannot derive it. Same shape as
Russian's stress.tsv (word<TAB>0-based stressed-nucleus ordinal, built from kaikki), and it feeds the SAME g2p
that Serbian, Croatian and Bosnian all share — hr/bs import phonemizeWord from serbian.ts, so one file lights up
three engines.

⚠ BUILT FROM THE ACCENTED ORTHOGRAPHY, NOT FROM THE IPA, and that is the whole trick. kaikki carries both: the
IPA (/rjěːka/) and the accented spelling (rijéka). Indexing the IPA looks natural and is WRONG here, because the
two do not have the same number of nuclei:

    rijeka   IPA /rjěːka/    2 nuclei      accented spelling  rijéka   3 nuclei
    brijeg   IPA /brjêːɡ/    1 nucleus     accented spelling  brijȇg   2 nuclei

That is the Ijekavian ⟨ije⟩ reflex — the source writes its ⟨i⟩ as the glide /j/. Our g2p is a strict
one-grapheme-one-phoneme scan, so it emits /i/ there and counts the ORTHOGRAPHIC nuclei. Measured over the dump:
indexing the IPA disagrees with the orthography on 960 of 51162 accented entries (1.9%) — Ijekavian ⟨ije⟩ plus
the source's inconsistent marking of syllabic ⟨r⟩ (trgovati is /trɡǒʋati/, r unmarked). Indexing the spelling has
neither problem: the mark already sits on the letter the engine will pronounce.

⚠ ⟨ć⟩ IS ⟨c⟩ + COMBINING ACUTE, the same U+0301 that spells the long-rising accent, and ⟨č š ž⟩ are letters +
combining caron. A mark is therefore only read as an accent when it sits on a NUCLEUS (vowel or syllabic r);
on a consonant it is part of the letter. Without that test, ćelav would "stress" its ⟨c⟩.

Source: kaikki.org Serbo-Croatian (Wiktionary extract, CC-BY-SA), the unified sh dump — Wiktionary does not
split sr/hr/bs, and 404s on their separate names.

  python3 tools/serbian/build_sh_stress_lexicon.py [--dump PATH] [--stats]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "languages", "serbian", "stress.tsv")
DUMP = "/mnt/data/kaikki-SerboCroatian.jsonl"

# The four ORTHOGRAPHIC accent marks. ⚠ The macron U+0304 is deliberately absent: it writes post-accentual
# LENGTH (àbdāl), not the accent, and treating it as one would move the mark off the accented syllable.
ACCENT = {0x300: "short-rising", 0x301: "long-rising", 0x30F: "short-falling", 0x311: "long-falling"}
LENGTH = 0x304
VOWELS = set("aeiouаеиоу")
RHOTIC = set("rр")  # a syllabic ⟨r⟩ is a nucleus (kȓv, pȑst, sȑce, dr̀žava)


def nuclei(word: str) -> list[int]:
    """Indices (into the NFD string) of this word's syllable nuclei: every vowel, plus a ⟨r⟩ that has no vowel
    on either side. Both scripts, one rule — the Latin/Cyrillic mapping is a bijection that preserves vowels."""
    d = unicodedata.normalize("NFD", word.lower())
    base = [(i, c) for i, c in enumerate(d) if not unicodedata.combining(c)]
    out = []
    for k, (i, c) in enumerate(base):
        if c in VOWELS:
            out.append(i)
        elif c in RHOTIC:
            prev = base[k - 1][1] if k else ""
            nxt = base[k + 1][1] if k + 1 < len(base) else ""
            if prev not in VOWELS and nxt not in VOWELS:
                out.append(i)
    return out


def read_accent(form: str):
    """(plain word, nucleus ordinal, tone) for an accented spelling, or None if it carries no accent."""
    d = unicodedata.normalize("NFD", form)
    nuc = set(nuclei(form))
    ordinal = {i: k for k, i in enumerate(nuclei(form))}
    mark = None
    keep = []
    for i, c in enumerate(d):
        cp = ord(c)
        if unicodedata.combining(c) and (cp in ACCENT or cp == LENGTH):
            # find the base character this mark sits on
            j = i - 1
            while j >= 0 and unicodedata.combining(d[j]):
                j -= 1
            if j in nuc:  # ⚠ on a CONSONANT this is part of the letter (ć = c + U+0301), not an accent
                if cp in ACCENT and mark is None:
                    mark = (ordinal[j], ACCENT[cp])
                continue  # drop accent + length from the key either way
        keep.append(c)
    if mark is None:
        return None
    return unicodedata.normalize("NFC", "".join(keep)), mark[0], mark[1]


# Gaj's Latin → Serbian Cyrillic. A bijection at the letter level, so the NUCLEUS ORDINAL is unchanged by it —
# the digraphs ⟨lj nj dž⟩ are consonants. ⚠ THE DIGRAPHS ARE THE ONE AMBIGUITY: across a prefix boundary
# ⟨nadživeti⟩ is над+живети, not на+џивети, and this table cannot tell. The failure is benign — it produces a key
# that spells no Serbian word, so it is never looked up — and it only ever ADDS keys (an existing Cyrillic key
# from the dump always wins). Needed because the dump ships 52190 accented Latin forms but only 27530 Cyrillic
# ones, and FLEURS sr_rs is written in Cyrillic.
LAT2CYR = [("lj", "љ"), ("nj", "њ"), ("dž", "џ"),
           ("a", "а"), ("b", "б"), ("c", "ц"), ("č", "ч"), ("ć", "ћ"), ("d", "д"), ("đ", "ђ"), ("e", "е"),
           ("f", "ф"), ("g", "г"), ("h", "х"), ("i", "и"), ("j", "ј"), ("k", "к"), ("l", "л"), ("m", "м"),
           ("n", "н"), ("o", "о"), ("p", "п"), ("r", "р"), ("s", "с"), ("š", "ш"), ("t", "т"), ("u", "у"),
           ("v", "в"), ("z", "з"), ("ž", "ж")]


def to_cyrillic(word: str) -> str | None:
    """Transliterate a Gaj's-Latin word, or None if it carries a letter outside the alphabet (dialect ⟨ă⟩,
    foreign ⟨q w x y⟩) — those are not Serbian spellings and must not be invented."""
    out = []
    i = 0
    while i < len(word):
        for lat, cyr in LAT2CYR:
            if word.startswith(lat, i):
                out.append(cyr)
                i += len(lat)
                break
        else:
            return None
    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", default=DUMP)
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()

    best: dict[str, int] = {}
    conflict: dict[str, set] = collections.defaultdict(set)
    tones = collections.Counter()
    stat = collections.Counter()
    for line in open(a.dump, encoding="utf-8"):
        e = json.loads(line)
        stat["entries"] += 1
        forms = [f.get("form", "") for f in e.get("forms", []) if f.get("form")]
        got = False
        for f in forms + [e["word"]]:
            r = read_accent(f)
            if r is None:
                continue
            key, ordinal, tone = r
            if not key or any(ch.isdigit() or ch.isspace() for ch in key):
                continue
            got = True
            tones[tone] += 1
            conflict[key.lower()].add(ordinal)
            best.setdefault(key.lower(), ordinal)
        stat["with an accented form" if got else "no accented form"] += 1

    # A word with two recorded placements is a genuine homograph (or a dialect split). Keep the first and
    # count them rather than inventing a tie-break — the engine has no way to disambiguate anyway.
    ambiguous = {k for k, v in conflict.items() if len(v) > 1}
    rows = {k: v for k, v in best.items() if k not in ambiguous}

    # Transliterate the Latin keys into Cyrillic, without overwriting a Cyrillic key the dump gave directly.
    added = 0
    for k in list(rows):
        c = to_cyrillic(k)
        if c is not None and c != k and c not in rows:
            rows[c] = rows[k]
            added += 1

    if a.stats:
        for k, v in stat.most_common():
            print(f"  {k:<26} {v}", file=sys.stderr)
        print(f"  {'distinct keys':<26} {len(best)}", file=sys.stderr)
        print(f"  {'dropped, ambiguous':<26} {len(ambiguous)}", file=sys.stderr)
        print(f"  tones {tones.most_common()}", file=sys.stderr)
        print(f"  {'Cyrillic keys added':<26} {added}", file=sys.stderr)
        by_n = collections.Counter()
        for k, v in rows.items():
            by_n[(len(nuclei(k)), v)] += 1
        for n in (1, 2, 3, 4):
            tot = sum(c for (nn, _), c in by_n.items() if nn == n)
            first = by_n.get((n, 0), 0)
            if tot:
                print(f"  {n}-nucleus words: {tot:>6}   accent on the FIRST: {first:>6} ({100*first/tot:.1f}%)",
                      file=sys.stderr)

    path = os.path.normpath(OUT)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("# Serbo-Croatian stress lexicon — word<TAB>stressed-nucleus ordinal (0-based). Shared by the\n")
        fh.write("# sr / hr / bs engines, which all run serbian.ts's g2p. A nucleus is a vowel OR a syllabic ⟨r⟩.\n")
        fh.write("# From kaikki.org Serbo-Croatian (Wiktionary extract, CC-BY-SA) — built from the ACCENTED\n")
        fh.write("# ORTHOGRAPHY (rijéka), not the IPA (/rjěːka/), which has a different nucleus count under the\n")
        fh.write("# Ijekavian ⟨ije⟩ reflex. Both scripts. See tools/serbian/build_sh_stress_lexicon.py.\n")
        for k in sorted(rows):
            fh.write(f"{k}\t{rows[k]}\n")
    print(f"wrote {path}: {len(rows)} rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
