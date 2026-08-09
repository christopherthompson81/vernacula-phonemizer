#!/usr/bin/env python3
"""Build Urdu (skeleton → IPA) training labels from ROMANIZATION corpora.

THE IDEA. Roman Urdu writes the vowels the abjad omits — including the majhūl contrast (o/oo,
e/ee) that harakat cannot encode. So a romanization lexicon is a short-vowel source, which no
earlier run considered (Runs 1-11 searched only pronunciation sources).

METHOD. Our own lexicon-free `phonemizeWordCore` supplies the consonant + long-vowel backbone
with default [ə] in every unwritten slot (emitted by ur_emit_core.ts); the romanization then
overwrites the vowel QUALITY at aligned slots. Taking the backbone from our engine rather than
reconstructing it from the roman keeps the labels in our canonical convention by construction,
and confines the roman's influence to exactly the layer it is reliable for.

⚠ THESE ARE NOISY LABELS, NOT GOLD. Measured against CLE (independent of both Wiktionary and
Dakshina) the romanization carries the short vowel ~70% of the time — near the always-ə prior.
Cross-annotator voting is the denoiser: crowd romanizers disagree precisely where the
orthography is ambiguous (bare 'a' spells both ə and ɑː), so their disagreement is signal.
`--min-agree` trades pool size for label cleanliness.

Sources: Dakshina ur/lexicons (CC BY-SA 4.0, 30,000 types, 4.2 romanizations/word with
attestation counts) + Aksharantar's HUMAN subset (CC-BY/CC0, +7,013 new types). ⚠ Aksharantar's
620k IndicCorp bulk is MINED and scores 52.5% against CLE vs a 57.4% always-ə prior — below
guessing — so it is excluded here.

    python3 tools/perso-arabic/ur_build_dakshina_labels.py [--min-agree 0.0] [--with-majhul] [--out FILE]

INPUTS (not in-repo — none of them may be committed here; see .gitignore):
  UR_CORE             (default /tmp/ur_core.tsv)     — `npx tsx ur_emit_core.ts <words.txt>`
  UR_DAKSHINA_DIR     (default /tmp/dakshina/lex)    — ur.{train,dev,test}.tsv from dakshina_dataset_v1.0
  UR_AKSHARANTAR_DIR  (default /tmp/aksh)            — urd_{train,valid,test}.json from ai4bharat/Aksharantar
"""
import argparse
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

CORE = os.environ.get("UR_CORE") or "/tmp/ur_core.tsv"
DAK_DIR = os.environ.get("UR_DAKSHINA_DIR") or "/tmp/dakshina/lex"
DAK = [f"{DAK_DIR}/ur.{s}.tsv" for s in ("train", "dev", "test")]
AKSH_DIR = os.environ.get("UR_AKSHARANTAR_DIR") or "/tmp/aksh"
AKSH = [f"{AKSH_DIR}/urd_{s}.json" for s in ("train", "valid", "test")]

LONG_DIGRAPH = [("aa", "ɑː"), ("ee", "iː"), ("ii", "iː"), ("oo", "uː"), ("uu", "uː"),
                ("ai", "ɛː"), ("au", "ɔː"), ("ay", "eː"), ("ou", "oː")]
SHORT_LETTER = {"a": "ə", "i": "ɪ", "u": "ʊ", "e": "eː", "o": "oː"}

# our IPA vowel tokens, longest first
VOWEL_TOKENS = ["ɑː", "aː", "uː", "iː", "eː", "oː", "ɔː", "ɛː", "ə", "ɪ", "ʊ", "ɛ", "ɔ", "ɑ", "a", "e", "o", "u", "i"]
SHORTQ = {"ə", "ɪ", "ʊ", "ɛ", "ɔ"}
MAJHUL = {"oː", "uː", "eː", "iː", "ɛː", "ɔː"}


def roman_vowels(rom):
    out, i = [], 0
    while i < len(rom):
        hit = None
        for d, v in LONG_DIGRAPH:
            if rom.startswith(d, i):
                hit = (d, v)
                break
        if hit:
            out.append(hit[1])
            i += len(hit[0])
        elif rom[i] in SHORT_LETTER:
            out.append(SHORT_LETTER[rom[i]])
            i += 1
        else:
            i += 1
    return out


def vote(roms):
    """Per-slot plurality over attested romanizations; returns (sequence, mean_agreement)."""
    seqs = [(s, n) for s, n in ((roman_vowels(r), n) for r, n in roms) if s]
    if not seqs:
        return [], 0.0
    lens = collections.Counter()
    for s, n in seqs:
        lens[len(s)] += n
    L = lens.most_common(1)[0][0]
    keep = [(s, n) for s, n in seqs if len(s) == L]
    seq, ags = [], []
    for i in range(L):
        c = collections.Counter()
        for s, n in keep:
            c[s[i]] += n
        top, cnt = c.most_common(1)[0]
        seq.append(top)
        ags.append(cnt / sum(c.values()))
    return seq, (sum(ags) / len(ags) if ags else 0.0)


def split_ipa(ipa):
    """Split into (pieces, vowel_indices) where pieces[i] is a token."""
    out, i = [], 0
    while i < len(ipa):
        for v in VOWEL_TOKENS:
            if ipa.startswith(v, i):
                out.append(v)
                i += len(v)
                break
        else:
            out.append(ipa[i])
            i += 1
    vidx = [k for k, t in enumerate(out) if t in VOWEL_TOKENS]
    return out, vidx


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-agree", type=float, default=0.0)
    # ⚠ MAJHŪL OVERWRITE IS NET-NEGATIVE — see ur_label_diagnostics.py / Run 14. Roman spelling does
    # not determine the ی=iː~eː and و=oː~uː contrast: bare "e" writes both iː and eː, "o" both oː and
    # ɔː, and "ai" collides with a-i hiatus. Those four confusions (iː→eː, ɛː→eː, oː→ɔː, oː→uː) are
    # ~320 of the ~590 bad changes, against only ~143 from the short-vowel branch. Short-only is the
    # default; --with-majhul restores the Run 13 behaviour for comparison.
    ap.add_argument("--with-majhul", action="store_true")
    ap.add_argument("--out", default=os.path.join(HERE, "silver.dakshina.tsv"))
    args = ap.parse_args()

    core = {}
    for line in open(CORE, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0] and p[1]:
            core[p[0]] = p[1].replace("ˈ", "").replace("ˌ", "")

    roms = collections.defaultdict(list)
    for path in DAK:
        for line in open(path, encoding="utf-8"):
            f = line.rstrip("\n").split("\t")
            if len(f) < 3:
                continue
            r = f[1].lower()
            if r.isascii() and r.isalpha():
                roms[f[0]].append((r, int(f[2])))
    for fn in AKSH:
        for line in open(fn, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            if d.get("source") == "IndicCorp":
                continue
            r = (d.get("english word") or "").lower()
            if r.isascii() and r.isalpha():
                roms[d["native word"]].append((r, 1))

    out = []
    stats = collections.Counter()
    for w, rs in roms.items():
        ipa = core.get(w)
        if not ipa:
            stats["no-backbone"] += 1
            continue
        seq, agree = vote(rs)
        if not seq:
            stats["no-roman-vowels"] += 1
            continue
        if agree < args.min_agree:
            stats["below-min-agree"] += 1
            continue
        pieces, vidx = split_ipa(ipa)
        if not vidx:
            stats["no-backbone-vowels"] += 1
            continue
        gv = [pieces[k] for k in vidx]
        # a large vowel-count mismatch means the roman is a different word shape — skip rather than guess
        if abs(len(gv) - len(seq)) > max(1, len(gv) // 2):
            stats["shape-mismatch"] += 1
            continue
        changed = 0
        for gi, pj in align(gv, seq):
            if pj is None:
                continue
            g, p = gv[gi], seq[pj]
            if g == p:
                continue
            # the roman may correct a SHORT quality, or a majhūl LONG quality — never length itself
            if g in SHORTQ and p in SHORTQ:
                pieces[vidx[gi]] = p
                changed += 1
            elif args.with_majhul and g in MAJHUL and p in MAJHUL:
                pieces[vidx[gi]] = p
                changed += 1
        stats["kept"] += 1
        stats["slots-changed"] += changed
        out.append((w, "".join(pieces)))

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("# skeleton\tlang\tIPA — romanization-derived Urdu labels (NOISY ~70%, see module docstring).\n")
        fh.write("# Built by tools/perso-arabic/ur_build_dakshina_labels.py from Dakshina (CC BY-SA 4.0)\n")
        fh.write("# + Aksharantar human subset (CC-BY/CC0). Aksharantar's mined IndicCorp bulk is EXCLUDED.\n")
        for w, ipa in sorted(out):
            fh.write(f"{w}\turd\t{ipa}\n")
    print(f"wrote {len(out)} labelled pairs → {args.out}")
    for k, v in stats.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
