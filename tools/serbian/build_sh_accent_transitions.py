#!/usr/bin/env python3
"""Build data/languages/serbian/accent-transitions.tsv — the OOV tier for sr/hr/bs accent.

The lexicon covers ~43% of polysyllabic corpus tokens. The rest is not random: the commonest misses (godine,
može, ima, bila, rekao) are INFLECTED FORMS of lemmas the lexicon already has, and over the 56899 lemmas
carrying two or more accented forms the accent sits on the same nucleus in 88.0% of them.

⚠ SO THE THING TO LEARN IS A TRANSITION, NOT A VALUE. Where the accent does move it moves systematically, and
the ending is what conditions it:

    abažur   1 SR  ->  abažura   2 LR      the genitive -a shifts right and lengthens
    abonman  1 SR  ->  abonmana  2 LR
    abesinac 2 LR  ->  abesinaca 1 SR      other endings shift left

So this table is keyed on (ending, stem's tone) and stores (shift, resulting tone) — apply it to a stem whose
accent IS known, rather than predicting an accent from nothing. Training pairs come out of the lexicon itself:
every key that has a shorter key as a proper prefix.

⚠ TONE IS RECORDED WITH ITS AGREEMENT AND SUPPORT so the engine can abstain. Position always beats its alternative (the
first-nucleus fallback, 66.8% on these same words), so a predicted shift is always worth taking. Tone has no
such floor — on the first nucleus the lexicon splits 53/47 rising/falling — so a low-confidence contour is
withheld exactly the way the lexicon withholds a homograph's, and for the same reason. The gate is set in
serbian.ts from the FREQUENCY-WEIGHTED sweep, not the type-level one: by type, tone at θ≥0.7 looks 82.6%
correct, but weighted by how often the words actually occur it is 73.6%, and a SUPPORT floor matters more than
the threshold (θ≥1.00 with no floor collapses to 62.8% — single-observation contexts, not signal).

  python3 tools/serbian/build_sh_accent_transitions.py [--eval] [--sweep]
"""
from __future__ import annotations

import argparse
import collections
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, "..", "..", "src", "languages", "serbian", "stress.tsv")
OUT = os.path.join(HERE, "..", "..", "src", "languages", "serbian", "accent-transitions.tsv")

# ⚠ MEASURED, NOT PICKED. Sweeping the maximum ending length trades accuracy against reach (--sweep prints it):
#   maxcut 2   pos 84.0%  tone 65.0%  +19.5pp corpus coverage
#   maxcut 3   pos 83.7%  tone 63.7%  +24.3pp
#   maxcut 4   pos 82.3%  tone 61.1%  +27.0pp
#   maxcut 6   pos 77.9%  tone 57.3%  +30.5pp
# Against the 66.8% first-nucleus baseline these are worth coverage×(acc−baseline) = 3.4 / 4.1 / 4.2 / 3.4 pp of
# total accuracy, so 3 and 4 are the joint optimum and within noise of each other. 3 is taken, for the higher
# per-prediction accuracy: a wrong transition asserts an accent, while a fallback error is a default already
# known to be unreliable.
MAX_CUT = 3
MIN_STEM = 3


def load_lexicon(path):
    rows = {}
    for line in open(path, encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        w, i, t = line.rstrip("\n").split("\t")
        rows[w] = (int(i), t)
    return rows


def stem_of(word, keys):
    """(stem, ending) for the LONGEST stem that is itself a lexicon key — the most specific analysis."""
    for c in range(1, MAX_CUT + 1):
        if len(word) - c >= MIN_STEM and word[:-c] in keys:
            return word[:-c], word[len(word) - c:]
    return None


def pairs_from(rows):
    keys = set(rows)
    out = []
    for w, (i, t) in rows.items():
        s = stem_of(w, keys)
        if s is not None:
            out.append((s[0], s[1], i, t))
    return out


def learn(pairs, rows):
    shift = collections.defaultdict(collections.Counter)
    tone = collections.defaultdict(collections.Counter)
    for stem, end, i, t in pairs:
        si, st = rows[stem]
        shift[(end, st)][i - si] += 1
        tone[(end, st)][t] += 1
    return shift, tone


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval", action="store_true", help="80/20 held-out score instead of writing the table")
    ap.add_argument("--sweep", action="store_true", help="tone-abstention threshold sweep")
    a = ap.parse_args()

    rows = load_lexicon(os.path.normpath(LEX))
    pairs = pairs_from(rows)
    print(f"lexicon {len(rows)} rows → {len(pairs)} stem/form pairs", file=sys.stderr)

    if a.eval or a.sweep:
        random.seed(7)
        shuffled = pairs[:]
        random.shuffle(shuffled)
        cut = int(len(shuffled) * 0.8)
        train, test = shuffled[:cut], shuffled[cut:]
        shift, tone = learn(train, rows)
        pos = base = 0
        # tone accuracy at each abstention threshold, with how much it still answers
        buckets = collections.defaultdict(lambda: [0, 0])
        for stem, end, i, t in test:
            si, st = rows[stem]
            d = shift[(end, st)].most_common(1)
            if si + (d[0][0] if d else 0) == i:
                pos += 1
            if i == 0:
                base += 1
            c = tone[(end, st)]
            if not c:
                continue
            top, n = c.most_common(1)[0]
            agree = n / sum(c.values())
            for th in (0.0, 0.5, 0.6, 0.7, 0.8, 0.9):
                if agree >= th:
                    buckets[th][1] += 1
                    if top == t:
                        buckets[th][0] += 1
        print(f"held-out {len(test)}: POSITION {100*pos/len(test):.1f}%  (first-nucleus baseline {100*base/len(test):.1f}%)",
              file=sys.stderr)
        for th in sorted(buckets):
            ok, n = buckets[th]
            print(f"  tone θ≥{th:.1f}: answers {100*n/len(test):5.1f}% of them, and is right {100*ok/max(1,n):.1f}%",
                  file=sys.stderr)
        return 0

    shift, tone = learn(pairs, rows)
    path = os.path.normpath(OUT)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("# Serbo-Croatian accent TRANSITIONS — the OOV tier. Key: <ending>|<stem tone>. Value:\n")
        fh.write("# <nucleus shift><TAB><resulting tone><TAB><tone agreement, 0-100><TAB><support>.\n")
        fh.write("# Applied to a stem whose accent is known, NOT used to predict an accent from nothing.\n")
        fh.write("# The shift is always taken (its alternative, first-nucleus, scores 66.8% on these words);\n")
        fh.write("# the tone is withheld below the engine's agreement threshold, as a homograph's is.\n")
        fh.write("# Learned from stress.tsv itself. See tools/serbian/build_sh_accent_transitions.py.\n")
        for key in sorted(shift, key=lambda k: (k[0], k[1])):
            end, st = key
            d, dn = shift[key].most_common(1)[0]
            support = sum(shift[key].values())
            tc = tone[key]
            tt, tn = tc.most_common(1)[0]
            agree = round(100 * tn / sum(tc.values()))
            fh.write(f"{end}|{st}\t{d}\t{tt}\t{agree}\t{support}\n")
    print(f"wrote {path}: {len(shift)} contexts", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
