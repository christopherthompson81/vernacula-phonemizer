#!/usr/bin/env python3
"""Mine the HOT PATHS from the aligned Danish lexicon → suggest fast RULES (rules > neural for the common case).

The perceptron/BiLSTM distils regularities; the high-frequency, high-PURITY (grapheme, prev, next)→tag patterns are
implementable as scan rules, leaving only the low-purity (genuinely lexical) tail for the neural path. This reports
those hot contextual mappings, ranked by IMPACT (count in the words the current rule engine gets WRONG), so the
suggestions are the ones that would actually move the rule floor.

Workflow: (1) this writes the per-grapheme gold alignment to /tmp/da_aligned.tsv; (2) tools/danish/da_rule_probe.mts
marks which lexicon words the rule engine gets wrong (folded) → /tmp/da_wrong.txt; (3) re-run this to rank contexts.

    .venv/bin/python tools/danish/mine_da_rules.py            # align + mine
"""
import os
from collections import defaultdict, Counter
from da_tagger_prototype import load, align_all

HERE = os.path.dirname(os.path.abspath(__file__))
ALIGNED = "/tmp/da_aligned.tsv"
WRONG = "/tmp/da_wrong.txt"
MIN_COUNT, MIN_PURITY = 25, 0.80

def main():
    rows = load()
    aligned, _ = align_all(rows)
    # write the per-grapheme alignment (for the TS rule-probe to consume)
    with open(ALIGNED, "w", encoding="utf-8") as f:
        for w, a in aligned:
            f.write(w + "\t" + " ".join(f"{g}:{t}" for g, t in a) + "\n")
    aln = {w: a for w, a in aligned}
    wrong = set(open(WRONG, encoding="utf-8").read().split()) if os.path.exists(WRONG) else None
    if wrong is None:
        print(f"aligned {len(aligned)} words → {ALIGNED}. Now run tools/danish/da_rule_probe.mts, then re-run this.")
        return

    # per-grapheme DEFAULT tag (global most common) + contextual tallies
    g_all = defaultdict(Counter)
    ctx_all = defaultdict(Counter)
    ctx_wrong = defaultdict(Counter)
    for w, a in aligned:
        chars = [g for g, _ in a]
        for i, (g, t) in enumerate(a):
            g_all[g][t] += 1
            key = (chars[i - 1] if i > 0 else "^", g, chars[i + 1] if i + 1 < len(a) else "$")
            ctx_all[key][t] += 1
            if w in wrong:
                ctx_wrong[key][t] += 1
    default = {g: dist.most_common(1)[0][0] for g, dist in g_all.items()}

    # CONTEXTUAL rules: a (prev,g,next) whose dominant tag DIFFERS from g's default, high-purity + frequent, and
    # appears in words the rule engine currently gets WRONG (real, unaddressed rule gaps).
    rules = []
    for key, dist in ctx_all.items():
        total = sum(dist.values())
        tag, cnt = dist.most_common(1)[0]
        purity = cnt / total
        p, g, n = key
        if total >= MIN_COUNT and purity >= MIN_PURITY and tag != default.get(g):
            rules.append((ctx_wrong[key][tag], total, purity, key, tag, default.get(g)))
    rules.sort(reverse=True)
    print(f"{'wrong':>5} {'count':>5} {'pure':>5}  prev  g  next  → tag   (default)")
    for impact, total, purity, (p, g, n), tag, dflt in rules[:40]:
        print(f"{impact:>5} {total:>5} {purity:>5.0%}  {p!r:>4} {g!r} {n!r:<4} → {tag!r:5}  (dflt {dflt!r})")

if __name__ == "__main__":
    main()
