#!/usr/bin/env python3
"""Build src/languages/slovenian/stress.tsv — the Slovene lexical stress lexicon.

Slovene stress is free, lexical and UNWRITTEN in ordinary text, so the engine cannot derive it;
`slovenian.jsonc` recorded it as deferred pending a lexicon. Same shape as the sibling Serbo-Croatian
file (word<TAB>0-based stressed-nucleus ordinal) and the same source family.

⚠ STRESS ONLY, NO TONE — AND THE DUMP ITSELF SETTLES THAT. Slovene has two accepted standard norms, and
kaikki labels every pronunciation with which one it is: `"note": "phoneme, tonal variety"` against
`"phoneme, non-tonal variety"`. The non-tonal (stress + length) norm is the one used in broadcast and by
most speakers; the tonemic norm is a minority standard. So unlike sr/hr/bs — where the four-way pitch
accent IS the system and is emitted as Chao letters — Slovene gets a position mark and nothing else.

⚠ BUILT FROM THE ACCENTED ORTHOGRAPHY, NOT FROM THE IPA, for the reason the Serbo-Croatian builder gives:
the mark already sits on the letter the engine will pronounce, so the nucleus counts cannot drift apart.

⚠ AND A COMBINING MARK IS ONLY AN ACCENT ON A NUCLEUS. U+030C CARON appears 42,590 times in these forms
and is almost entirely ⟨š č ž⟩ — the letters, not a prosody mark. U+0323 DOT BELOW (ẹ ọ) is vowel QUALITY
and U+0304 MACRON is LENGTH; neither moves the accent. Reading any of the three as one would stress the
wrong syllable, and ⟨š⟩ is not even a syllable. Only U+0301 U+0300 U+0302 U+0311 U+030F on a vowel or a
syllabic ⟨r⟩ count.

Source: kaikki.org Slovene (Wiktionary extract, CC-BY-SA), the same licence as the 30+ committed referees.
The dump is 28 MB and is NOT committed; docs/investigations/south_slavic_stress_sources_investigation.md
has the URL.

  python3 tools/slovenian/build_sl_stress_lexicon.py [--dump PATH] [--stats]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "languages", "slovenian", "stress.tsv")
DUMP = "/mnt/data/kaikki-Slovene.jsonl"

# The five ORTHOGRAPHIC accent marks. ⚠ U+030C (caron) is NOT here — in Slovene it spells š/č/ž. U+0323
# (dot below) is close-vowel QUALITY and U+0304 (macron) is LENGTH; both ride along on accented vowels
# (ọ̑, ā) and neither marks the accented syllable.
ACCENT = {"́", "̀", "̂", "̑", "̏"}
VOWEL = set("aeiouAEIOU")


def is_nucleus(letters: list[str], i: int) -> bool:
    """A nucleus as THIS ENGINE counts one: a vowel, or a SYLLABIC ⟨r⟩.

    ⚠ ⟨r⟩ IS A NUCLEUS ONLY WITH NO VOWEL NEIGHBOUR, mirroring `g2p.ts`'s `syllabicR` (prst → pərst, where
    the inserted ə is the nucleus). Counting every ⟨r⟩ instead — which the first version of this file did,
    copying the Serbo-Croatian builder's one-line rule without checking — puts an extra nucleus in front of
    the real one in any word with an ordinary r: robót would index 2 where the engine has 1, and the mark
    would land a syllable late in a large fraction of the lexicon.
    """
    c = letters[i]
    if c in VOWEL:
        return True
    if c not in ("r", "R"):
        return False
    left = letters[i - 1] if i > 0 else ""
    right = letters[i + 1] if i + 1 < len(letters) else ""
    return left not in VOWEL and right not in VOWEL


# Marks to remove when recovering the plain spelling: the five accents, plus the two that ride along on an
# accented vowel — U+0323 close-vowel QUALITY (ẹ ọ) and U+0304 LENGTH (ā).
STRIPPABLE = ACCENT | {"̣", "̄"}


def strip_marks(s: str) -> str:
    """The plain spelling the corpus will contain: drop the PROSODIC marks and keep the letters.

    ⚠ NOT "drop every combining mark". ⟨š č ž⟩ decompose to s/c/z + U+030C, so a blanket strip turns
    *država* into the key `drzava`, which no corpus token can ever match — and ⟨ž⟩ is in a large share of
    Slovene vocabulary. Only the marks in STRIPPABLE come off.
    """
    return unicodedata.normalize("NFC", "".join(
        c for c in unicodedata.normalize("NFD", s) if c not in STRIPPABLE))


def accent_nucleus(form: str) -> int | None:
    """0-based ordinal of the accented NUCLEUS, or None if the form carries no accent on one.

    ⚠ The base letter is found by skipping other combining marks, because Slovene stacks them: ⟨ọ̑⟩ is
    o + dot-below + inverted-breve, so the accent's immediate predecessor is the DOT, not the vowel.
    """
    s = unicodedata.normalize("NFD", form)
    # the BASE letters, with their positions, so the nucleus test can see neighbours
    base = [(i, c) for i, c in enumerate(s) if not unicodedata.combining(c)]
    letters = [c for _, c in base]
    at: dict[int, int] = {}   # source index -> nucleus ordinal
    idx = -1
    for k, (i, _) in enumerate(base):
        if is_nucleus(letters, k):
            idx += 1
            at[i] = idx
    hit: list[int] = []
    for i, c in enumerate(s):
        if not unicodedata.combining(c) or c not in ACCENT:
            continue
        j = i - 1
        while j >= 0 and unicodedata.combining(s[j]):
            j -= 1
        if j in at:
            hit.append(at[j])
    if not hit:
        return None
    # ⚠ A PREFIXED SUPERLATIVE CARRIES TWO (nȁjrávnejši = naj- + the root accent). Slovene's naj- is a
    # secondary accent on a word whose main accent is the root's, so the LAST mark is the primary one.
    return hit[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", default=DUMP)
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()
    if not os.path.exists(a.dump):
        sys.exit(f"dump not found: {a.dump} — see the investigation doc for the URL")

    # plain spelling -> Counter of nucleus ordinals seen for it
    seen: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    forms_read = 0
    for line in open(a.dump, encoding="utf-8"):
        d = json.loads(line)
        if d.get("pos") in (None, "character"):
            continue
        for fm in d.get("forms") or []:
            form = fm.get("form") or ""
            if not form or " " in form or "-" in form:
                continue
            n = accent_nucleus(form)
            if n is None:
                continue
            plain = strip_marks(form).lower()
            if not plain.isalpha():
                continue
            forms_read += 1
            seen[plain][n] += 1

    rows: list[tuple[str, int]] = []
    conflict = 0
    for word, c in sorted(seen.items()):
        if len(c) > 1:
            top, second = c.most_common(2)
            # ⚠ A TIE IS A REAL HOMOGRAPH, not noise — Slovene has minimal pairs distinguished only by
            #   stress. Withhold rather than guess; the engine then emits no mark, its current behaviour.
            if top[1] == second[1]:
                conflict += 1
                continue
        rows.append((word, c.most_common(1)[0][0]))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("# Slovene lexical stress — word<TAB>stressed-nucleus ordinal (0-based).\n")
        f.write("# A nucleus is a vowel OR a syllabic ⟨r⟩; the ordinal is emitted as ˈ before that syllable.\n")
        f.write("# ⚠ STRESS ONLY, NO TONE. Slovene has a tonemic and a non-tonemic standard; kaikki labels\n")
        f.write("# every pronunciation with which variety it is, and the non-tonal (stress+length) norm is the\n")
        f.write("# broadcast one. Unlike the sibling sr/hr/bs file, no pitch contour is recorded here.\n")
        f.write("# Built from the ACCENTED ORTHOGRAPHY (robót, rávən), not the IPA, by\n")
        f.write("# tools/slovenian/build_sl_stress_lexicon.py. Source: kaikki.org Slovene (Wiktionary, CC-BY-SA).\n")
        f.write("# Homographs whose accent position is genuinely split are WITHHELD, not guessed.\n")
        for w, n in rows:
            f.write(f"{w}\t{n}\n")

    print(f"{forms_read} accented forms -> {len(rows)} words ({conflict} split homographs withheld)")
    if a.stats:
        by_n = collections.Counter(n for _, n in rows)
        print("  stressed-nucleus ordinal:", dict(sorted(by_n.items())[:8]))


if __name__ == "__main__":
    main()
