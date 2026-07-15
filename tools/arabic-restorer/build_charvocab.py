#!/usr/bin/env python3
"""Build the multilingual character vocabulary for the shared harakat restorer.

The existing Arabic diacritizer (src/languages/arabic/diacritizer.meta.json) knows 39 chars — Arabic letters only.
The multilingual model must EMBED every letter the rider languages use (Persian گ چ پ ژ, Urdu ٹ ڈ ڑ ہ ھ ے ں,
Punjabi ݨ ࣇ, …). This scans every skeleton in silver.tsv, unions the letters with the existing Arabic char map
PRESERVING its indices (so the trained Arabic embedding rows stay valid — new letters just append), and writes the
expanded map + a per-language coverage report.

The 19 harakat LABELS are unchanged: the short-vowel diacritics (fatḥa/kasra/ḍamma/sukūn/shadda/tanwīn) are shared
across all Perso-Arabic orthographies, which is exactly why one label scheme serves every language.
"""
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SILVER = os.path.join(HERE, "silver.tsv")
META = os.path.join(HERE, "..", "..", "src", "languages", "arabic", "diacritizer.meta.json")
OUT = os.path.join(HERE, "multilingual_charvocab.json")


def main() -> None:
    meta = json.load(open(META, encoding="utf-8"))
    chars: dict[str, int] = dict(meta["chars"])  # preserve <pad>/<unk>/<sp> + Arabic letters + indices
    base_arabic = {c for c in chars if len(c) == 1}
    next_idx = max(chars.values()) + 1

    per_lang: dict[str, set[str]] = defaultdict(set)
    char_langs: dict[str, set[str]] = defaultdict(set)
    freq: Counter[str] = Counter()
    for line in open(SILVER, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) < 3:
            continue
        skel, lang = p[0], p[1]
        for ch in skel:
            per_lang[lang].add(ch)
            char_langs[ch].add(lang)
            freq[ch] += 1

    # Append every letter not already in the Arabic char map, most-frequent first (stable, meaningful order).
    all_chars = {c for s in per_lang.values() for c in s}
    new_chars = [c for c, _ in freq.most_common() if c not in chars]
    for c in new_chars:
        chars[c] = next_idx
        next_idx += 1

    json.dump({"chars": chars, "labels": meta["labels"]}, open(OUT, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    # Report.
    print(f"Arabic base chars: {len(base_arabic)}   multilingual union: {len(all_chars)} letters")
    print(f"total vocab (incl <pad>/<unk>/<sp>): {len(chars)}   labels: {len(meta['labels'])} (unchanged)\n")
    print("NEW letters not in the Arabic model (letter : languages that use it : count):")
    for c in new_chars:
        langs = ",".join(sorted(char_langs[c]))
        print(f"  {c}  U+{ord(c):04X}  [{langs}]  {freq[c]}")
    print(f"\n{'lang':>6} {'letters':>8} {'beyond-Arabic':>14}")
    print("-" * 32)
    for lang in sorted(per_lang, key=lambda L: -len(per_lang[L])):
        beyond = len(per_lang[lang] - base_arabic)
        print(f"{lang:>6} {len(per_lang[lang]):>8} {beyond:>14}")
    print(f"\nwrote -> {os.path.relpath(OUT, HERE)}")


if __name__ == "__main__":
    main()
