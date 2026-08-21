#!/usr/bin/env python3
"""
WORDIZE — cut the recognizer's flat phone stream into WORDS, so a divergence can be attributed.

`dist` is one edit distance over a whole utterance. It says a row disagrees; it never says WHERE, and every
finding in docs/investigations/asr_align_qc_investigation.md so far has been reached by a human reading the
two strings side by side and spotting the word. That does not scale past a queue of a few hundred.

The recognizer emits no word boundaries. **Ours does** — `ipa` is space-separated by construction — so a
global alignment of our units against theirs induces a cut of their stream at our boundaries. Each of our
words then has a "heard" span opposite it and a distance of its own.

    text   … kaniadtong 1945 ug …
    ipa    … kaniʔˈadtoŋ | ʔˈusa kˈa lˈibo … | ʔˈuɡ …
    heard  … kanatʊŋ     | naɪntiːn foɾti faɪb | uɡ  …
                           ^ 1.00 — attributable, and the word is the number

⚠ THE ALIGNMENT IS THE INSTRUMENT AND IT DEGRADES EXACTLY WHERE IT MATTERS. A word we got badly wrong has
no good anchor, so the optimal path can absorb a neighbour's phones into it or hand its own away. The
per-word figure is therefore reliable in the aggregate — the same word type diverging across many rows —
and only indicative on any single row. Read `--words` before `--rows`.

⚠ SHORT WORDS ARE NOISE HERE, AND THE DEFAULT EXCLUDES THEM. `dist` is normalised, so a two-phone word
scores 1.0 the moment the path shifts by one — and function words are both the shortest and the most
frequent. Ranking hr_hr unfiltered returns `je`, `u`, `i`, `od`, `se`, `su`: pure alignment noise. The
`--min-units` floor is what makes the aggregate readable.

⚠ AND IT CANNOT SEE A WORD WE DID NOT EMIT. If the reader said something absent from the transcript, there
is no word of ours to attach it to and the phones are absorbed by whichever neighbour the path prefers.
That is the `reader_divergence` class, and it will look like a defect in the neighbour.

⚠ IT REDISCOVERED A KNOWN FINDING, WHICH IS THE ONLY REASON TO TRUST IT. Run 58 established by reading
rows one at a time that Igbo speakers voice numerals in English. Ranking `ig_ng` word types blind, over the
whole language:

    abʊɔ    459  mean 0.659  +0.288 vs baseline     two
    puku    357       0.724  +0.353                 thousand
    naɾɪ    383       0.567  +0.196                 hundred
    itoolu  217       0.739  +0.368                 nine

Four of the top eight are number words, and the other four (`ŋʷeɾe`, `mɡ͡be`, `ɔtʊtʊ`, `ʊɡ͡bɔ`) are simply
the language's commonest content words in a corpus the recognizer finds hard. No row was read to get that.

⚠ `--limit` IS NOT A SAMPLE. The query is `ORDER BY dist DESC`, so `--limit 400` takes the four hundred
WORST rows — every figure from a limited run is inflated, baseline included. An earlier draft of this note
quoted `--limit 400` numbers (`puku` 0.818, six of eight) and read a stronger result than the corpus
supports. Use it to iterate, never to conclude.

    python3 wordize.py --lang hr_hr --words 25        # word types ranked by total divergence
    python3 wordize.py --lang hr_hr --rows 10         # worst rows, word by word
    python3 wordize.py --lang xx --selftest           # the alignment invariants
"""
from __future__ import annotations

import argparse
import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"
import sqlite3  # noqa: E402

from difflib import SequenceMatcher  # noqa: E402

from asr_align_report import coarsen, dist, fold  # noqa: E402


def units(s: str) -> list[str]:
    """The comparable units the distance already uses — fold, then the recognizer-inventory coarsening."""
    return coarsen(fold(s))


def align_path(a: list[str], b: list[str]) -> list[tuple[int, int]]:
    """Needleman-Wunsch backtrace as (i, j) pairs: our unit index against theirs, -1 for a gap."""
    n, m = len(a), len(b)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        row, prev = d[i], d[i - 1]
        ai = a[i - 1]
        for j in range(1, m + 1):
            row[j] = min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ai != b[j - 1]))
    i, j, out = n, m, []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (a[i - 1] != b[j - 1]):
            out.append((i - 1, j - 1)); i -= 1; j -= 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            out.append((i - 1, -1)); i -= 1
        else:
            out.append((-1, j - 1)); j -= 1
    return out[::-1]


def wordize(ipa: str, phones: str, unit_fn=None) -> list[tuple[str, str, float]]:
    """(our word, the phones opposite it, that word's distance) — one tuple per word of `ipa`.

    ⚠ `unit_fn` EXISTS SO THIS IS NOT WELDED TO ONE RECOGNIZER. The default `units` is
    `coarsen(fold(s))`, and `coarsen` is wav2vec2's inventory — the phones THAT model has no symbol
    for. Running allosaurus's output through it would push a second, independent tradition into its
    rival's conventions and destroy the independence that is the whole point of having it. Callers
    comparing against `phones_allo` pass their own fold (see allo_compare.NOTATION)."""
    uf = unit_fn or units
    words = [w for w in ipa.split() if uf(w)]
    if not words:
        return []
    ours, owner = [], []                       # flat our-units, and which word each came from
    for k, w in enumerate(words):
        for u in uf(w):
            ours.append(u); owner.append(k)
    theirs = uf(phones)
    got: list[list[str]] = [[] for _ in words]
    last = 0
    for i, j in align_path(ours, theirs):
        if i >= 0:
            last = owner[i]
        if j >= 0:
            got[last].append(theirs[j])        # an insertion attaches to the word in progress
    if unit_fn is None:
        return [(w, " ".join(g), dist(units(w), g)) for w, g in zip(words, got)]
    # ⚠ `dist` coarsens internally, for the same reason as above; a custom fold scores plainly.
    return [(w, " ".join(g), _plain_dist(uf(w), g)) for w, g in zip(words, got)]


def _plain_dist(a: list[str], b: list[str]) -> float:
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    return 1.0 - SequenceMatcher(None, a, b, autojunk=False).ratio()


def selftest() -> int:
    """The invariants that make the per-word split meaningful, on cases whose answer is known by hand."""
    ok = True

    def check(name: str, got: object, want: object) -> None:
        nonlocal ok
        if got != want:
            ok = False
            print(f"  FAIL {name}: {got!r} != {want!r}", file=sys.stderr)

    # 1. Every recognizer unit is attributed to exactly one word — nothing is dropped or double-counted.
    ipa, ph = "abc def ɡhi", "a b c d e f ɡ h i"
    got = wordize(ipa, ph)
    check("one tuple per word", len(got), 3)
    check("no unit lost", sum(len(g.split()) for _w, g, _d in got), len(units(ph)))

    # 2. An identical stream is distance 0 everywhere.
    same = wordize("abc def", "a b c d e f")
    check("identity is 0", [round(d, 6) for _w, _g, d in same], [0.0, 0.0])

    # 3. A word the recognizer missed entirely is 1.0 and its neighbours stay clean.
    miss = wordize("abc def ɡhi", "a b c ɡ h i")
    check("dropped word scores 1.0", round(miss[1][2], 6), 1.0)
    check("neighbours unaffected", [round(miss[0][2], 6), round(miss[2][2], 6)], [0.0, 0.0])

    # 4. An empty recognizer stream is 1.0 for every word rather than a crash.
    check("empty phones", [round(d, 6) for _w, _g, d in wordize("abc def", "")], [1.0, 1.0])

    print("selftest: OK" if ok else "selftest: FAILED", file=sys.stderr)
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--lang", required=True)
    ap.add_argument("--words", type=int, default=0, help="rank WORD TYPES by total divergence")
    ap.add_argument("--rows", type=int, default=0, help="show the worst rows, word by word")
    ap.add_argument("--limit", type=int, default=0,
                    help="cap rows scanned — ⚠ takes the WORST N (the query is ORDER BY dist DESC), "
                         "not a sample; every figure from a limited run is inflated")
    ap.add_argument("--min-units", type=int, default=4,
                    help="ignore words shorter than this many units in --words (default 4)")
    ap.add_argument("--min-n", type=int, default=3, help="ignore word types seen fewer times (default 3)")
    ap.add_argument("--selftest", action="store_true", help="check the alignment invariants and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not (a.words or a.rows):
        ap.error("one of --words / --rows")
    db = sqlite3.connect(a.db)
    q = ("SELECT COALESCE(NULLIF(read_text,''),text), ipa, phones, dist FROM utt "
         "WHERE lang=? AND dist IS NOT NULL AND ipa != '' AND phones != '' ORDER BY dist DESC")
    if a.limit:
        q += f" LIMIT {a.limit}"
    rows = db.execute(q, (a.lang,)).fetchall()

    if a.words:
        tot: collections.Counter[str] = collections.Counter()
        seen: collections.Counter[str] = collections.Counter()
        # ⚠ ONE PASS. The alignment is the expensive part — O(our units x theirs) per row — and the first
        #   version walked every row twice, once for the totals and once for the baseline. Same numbers,
        #   half the time (hr_hr 18s -> 9s; the whole fleet is 102 languages of that).
        base: list[float] = []
        for _text, ipa, ph, _d in rows:
            for w, _g, wd in wordize(ipa, ph):
                if len(units(w)) < a.min_units:
                    continue
                tot[w] += wd; seen[w] += 1
                base.append(wd)   # ⚠ the baseline is EVERY qualifying word, before the --min-n filter
        tot = collections.Counter({w: t for w, t in tot.items() if seen[w] >= a.min_n})
        # ⚠ A BASELINE, OR THE MEANS ARE UNREADABLE. Word-level distances sit well above the utterance
        #   median because a word has no neighbouring context to absorb alignment slop. Without knowing
        #   what an ORDINARY word scores here, "mean 0.46" invites reading noise as a defect.
        if not base:
            base = [0.0]
        base.sort()
        med = base[len(base) // 2]
        mean = sum(base) / len(base)
        print(f"# {a.lang}: {len(rows)} rows, {len(tot)} word types "
              f"(>={a.min_units} units, seen >={a.min_n}). Ranked by TOTAL divergence.")
        print(f"#   a type high here is either a defect or a word the recognizer cannot hear — check both.")
        print(f"#   ⚠ SHORT WORDS ARE EXCLUDED BY DEFAULT. A one- or two-phone word takes distance 1.0 from a")
        print(f"#     single misalignment, so an unfiltered ranking is just frequency x shortness: hr_hr's top")
        print(f"#     six were `je`, `u`, `i`, `od`, `se`, `su`. Lower --min-units only to inspect, not to rank.\n")
        print(f"# BASELINE for this language: an ordinary word of >={a.min_units} units scores "
              f"mean {mean:.3f}, median {med:.3f} ({len(base)} words).")
        print(f"#   A type is only interesting if its mean clears that, and `total` alone ranks frequency.\n")
        print(f"{'our word':22}{'n':>5}{'total':>9}{'mean':>8}{'vs base':>9}")
        for w, t in tot.most_common(a.words):
            m = t / seen[w]
            print(f"  {w:22}{seen[w]:4}{t:9.2f}{m:8.3f}{m - mean:+9.3f}")
    if a.rows:
        for text, ipa, ph, d in rows[: a.rows]:
            print(f"\n=== dist {d:.3f}  {text[:80]}")
            for w, g, wd in sorted(wordize(ipa, ph), key=lambda r: -r[2])[:6]:
                print(f"  {wd:5.2f}  {w:24} heard: {g[:46]}")
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
