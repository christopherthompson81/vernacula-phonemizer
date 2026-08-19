#!/usr/bin/env python3
"""
Structural defects in OUR OWN IPA — found without the recognizer, the referee, or the audio.

⚠ WHY THIS EXISTS, AND WHY IT IS NOT ANOTHER VIEW ON THE DISTANCE. The align queue is a comparison, so
every row it flags is ambiguous three ways: our bug, reader divergence, or recognizer artefact. Draining it
by hand costs a careful read per row and mostly re-derives "the reader said something else". Worse, its
yield is a SAMPLE: fixing Hebrew's ktiv-male digraph moved 1,107 corpus rows while only 13 of them were
ever in the queue. The queue points at classes; it is a poor worklist.

Every real defect found in the 2026-08-19 sweep was found by a STRUCTURAL signal, not by a distance:

    he_il  identical-consonant clusters   ->  ktiv male read as two consonants   (1,107 rows)
    mt_mt  a clause mark inside a number  ->  the decimal rule beaten by id-     (9 rows)
    sn/zu  a Latin letter in the IPA      ->  the numeral register mangling text

So: check the output against what IPA can BE. A word with no nucleus is unpronounceable; a full stop inside
a word is not a phone. These need no audio, carry no reader-variation ambiguity, and are language-agnostic.

⚠ AND THE OBVIOUS CHECKS ARE MOSTLY NOISE — the first draft flagged 76k "identical-consonant clusters" that
were Italian geminates (dˈella), 33k "punctuation in a word" that was Lao's syllable separator, and called
Mandarin's syllabic ʐ̩ vowel-less. Only checks whose violation is impossible IN EVERY LANGUAGE belong here.
`--all` runs the noisy ones too, clearly marked, for when a specific language is being worked.

  python3 output_anomalies.py [--lang X] [--top N] [--all]
"""
from __future__ import annotations

import argparse
import os
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict

DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"

# ⚠ THE NUCLEUS SET MUST INCLUDE THE SYLLABIC MARK AND THE NASALS, or the check reports its own gaps: the
# first draft called Mandarin's ʈ͡ʂʐ̩ and Portuguese's bˈẽj̃ vowel-less, which is the detector being wrong.
NUCLEUS = re.compile(r"[aeiouyæœøɑɐɒɔəɘɚɛɜɝɞɨɪɵʉʊʌɯɤʏɶ]|̩|̍")
# Suprasegmentals and our notation — not phones, so they cannot rescue a word from having no nucleus.
MARKS = re.compile(r"[ˈˌː˥˦˧˨˩ˑ'’\-.,;:!?̰̤̟̠̃́̀̈˞]")


def vowelless(db: sqlite3.Connection, langs: list[str] | None) -> None:
    """A word whose IPA has no nucleus cannot be said. Unambiguous in every language."""
    per: dict[str, Counter] = defaultdict(Counter)
    tot: Counter = Counter()
    for lang, ipa in db.execute("SELECT lang,ipa FROM utt WHERE ipa IS NOT NULL"):
        if langs and lang not in langs:
            continue
        for w in ipa.split():
            bare = MARKS.sub("", w)
            if len(bare) < 2:
                continue  # a lone clause mark, or a genuine one-phone word
            tot[lang] += 1
            if not NUCLEUS.search(unicodedata.normalize("NFD", bare)):
                per[lang][w] += 1
    print(f"{'lang':14} {'no-nucleus':>10} {'tokens':>9} {'rate':>7}   examples")
    for lang in sorted(per, key=lambda l: -sum(per[l].values())):
        c = sum(per[lang].values())
        ex = " ".join(w for w, _ in per[lang].most_common(5))
        print(f"{lang:14} {c:10} {tot[lang]:9} {100*c/tot[lang]:6.2f}%   {ex}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--lang", nargs="*")
    ap.add_argument("--all", action="store_true", help="include the checks with known false positives")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)
    print("=== words with NO nucleus (unpronounceable by construction) ===\n")
    vowelless(db, a.lang)
    if a.all:
        print("\n=== NOISY CHECKS — read with the caveats in the module docstring ===")
        print("  (identical-consonant clusters: legitimate geminates in it/mt/kk/ha/uz/ja)")
        print("  (punctuation in a word: legitimate syllable separator in lo/my)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
