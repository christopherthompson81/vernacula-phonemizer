"""Score any candidate Urdu word→IPA source on the SAME independent metric used for every other.

This is the Run 15 bake-off scorer — it produced the +15.1pp figure that reopened the tagger
question, so it is committed rather than left in /tmp.

⚠ THE METRIC HAS AN INSERTION BLIND SPOT (Run 17): it scores only slots where the GOLD has a
short vowel, so a spurious inserted vowel costs nothing. That is fine for comparing DICTIONARIES,
whose vowel counts are comparable (wikipron over-inserts 6.8%, the HF dict 11.6%, our backbone
9.8%), and WRONG for comparing schwa-PLACEMENT policies, where insertion rates differ ~3.5x. Use
phone-error-rate or word-exact for placement claims.

    UR_CORE=/tmp/ur_core.tsv python3 tools/perso-arabic/score_candidate.py <cand.json> [label]
    # cand.json: {"<urdu word>": "<IPA>", ...}; build ur_core.tsv with ur_emit_core.ts

The bar established by Runs 13-14: to be usable as TRAINING gold a source must beat the always-ə
prior by a wide margin (Dakshina's +3.7pp was far too thin). To be usable as a LEXICON tier it
need only beat the default-ə backbone (51.4%).
"""
import json
import os
import re
import sys

CLE = "/home/chris/Programming/vernacula-phonemizer/tools/referee-eval/referees/ur.cle-speech.tsv"
CORE = os.environ.get("UR_CORE") or "/tmp/ur_core.tsv"

VOWELS = re.compile(r"(ɑː|aː|uː|iː|eː|oː|ɔː|ɛː|ə|ɪ|ʊ|ɛ|ɔ|ɑ|a|e|o|u|i)")
SHORTSET = {"ə", "ɪ", "ʊ"}


def align(gold, pred):
    n, m = len(gold), len(pred)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = 0 if gold[i - 1] == pred[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
    i, j, out = n, m, []
    while i > 0 and j > 0:
        c = 0 if gold[i - 1] == pred[j - 1] else 1
        if d[i][j] == d[i - 1][j - 1] + c:
            out.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif d[i][j] == d[i - 1][j] + 1:
            out.append((i - 1, None))
            i -= 1
        else:
            j -= 1
    while i > 0:
        out.append((i - 1, None))
        i -= 1
    return out[::-1]


def norm(ipa):
    """Fold the candidate's notation to ours WITHOUT touching vowel quality."""
    s = ipa.replace("ˈ", "").replace("ˌ", "").replace(".", "").replace(" ", "")
    s = s.replace("ħ", "ɦ").replace("h", "ɦ").replace("æ", "ɛ").replace("ʌ", "ə")
    return s


def score(name, src):
    tot = hit = prior = words = 0
    for line in open(CLE, encoding="utf-8"):
        if line.startswith("#"):
            continue
        f = line.rstrip("\n").split("\t")
        if len(f) < 2 or f[0] not in src:
            continue
        gold = [v.replace("̃", "") for v in VOWELS.findall(f[1])]
        pred = VOWELS.findall(norm(src[f[0]]))
        if not gold or not pred:
            continue
        words += 1
        for gi, pj in align(gold, pred):
            g = gold[gi]
            if g not in SHORTSET:
                continue
            tot += 1
            if pj is not None and pred[pj] == g:
                hit += 1
            if g == "ə":
                prior += 1
    if not tot:
        print(f"{name}: no overlap")
        return
    print(f"{name:34} CLE-overlap={words:>5} slots={tot:>5}  "
          f"short-vowel acc {100 * hit / tot:5.1f}%   always-ə {100 * prior / tot:5.1f}%  "
          f"→ margin {100 * hit / tot - 100 * prior / tot:+.1f}pp")


if __name__ == "__main__":
    path = sys.argv[1]
    label = sys.argv[2] if len(sys.argv) > 2 else path
    d = json.load(open(path, encoding="utf-8"))
    single = {k: v for k, v in d.items() if " " not in k.strip()}
    print(f"{label}: {len(d)} entries, {len(single)} single-word")
    score(label, single)
    core = {}
    for line in open(CORE, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2:
            core[p[0]] = p[1]
    # same words only, so the comparison is like-for-like
    shared = {k: core[k] for k in single if k in core}
    score("  (our default-ə backbone, same words)", shared)
