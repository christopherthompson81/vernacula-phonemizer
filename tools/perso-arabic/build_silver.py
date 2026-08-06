#!/usr/bin/env python3
"""Build the silver training set for the shared Arabic-script short-vowel restorer.

Source: wikipron Arabic-script sections (CC-BY-SA) — the one uniform, permissively licensed, multilingual
IPA-aligned corpus for these languages. We fetch the `broad` transcription for every ABJAD-beneficiary language
(Indo-Aryan + Iranian + Arabic-family; NOT the fully-vocalized Uyghur alphabet), strip the orthographic
diacritics to recover the realistic undiacritized SKELETON (the model's runtime input), and pair it with the
IPA (which carries the vowels — the target).

Output: silver.tsv, one row per unique (skeleton, lang, ipa):

    skeleton <TAB> lang <TAB> ipa(space-separated phones)

Broad only (mixing broad+narrow under one lang tag would give the same skeleton two different-granularity targets).
Raw downloads are cached under cache/ (gitignored). Pure stdlib.
"""
import os
import re
import sys
import unicodedata
import urllib.request

BASE = "https://raw.githubusercontent.com/CUNY-CL/wikipron/master/data/scrape/tsv"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "silver.tsv")

# ABJAD beneficiaries only (role is for the stats report / later upsampling; the lang tag written is the ISO code).
# Uyghur (uig) is deliberately EXCLUDED — its orthography is a fully vocalized alphabet, nothing to restore.
LANGS = [
    # code   role
    ("ara", "anchor"), ("fas", "anchor"), ("urd", "anchor"),
    ("arz", "dialect"), ("apc", "dialect"), ("afb", "dialect"), ("acm", "dialect"),
    ("ary", "dialect"), ("acw", "dialect"), ("ajp", "dialect"), ("ayl", "dialect"),
    ("pus", "rider"), ("pan", "rider"), ("ckb", "rider"), ("kas", "rider"),
    ("snd", "rider"), ("skr", "rider"), ("gwc", "rider"), ("ota", "rider"),
]

# Arabic diacritics / signs to strip so the skeleton matches undiacritized running text: harakat + tanwin + shadda
# + sukun (U+064B-0652), extended vowel signs (U+0653-065F), superscript alef (U+0670), honorific/sign marks
# (U+0610-061A), the Quranic annotation marks (U+06D6-06ED), and tatweel/kashida elongation (U+0640). It touches NO
# consonant letters — the Arabic-Supplement (. U+0768) and Extended-A (. U+08C7) LETTERS the riders use are kept.
_STRIP_RANGES = [
    (0x0610, 0x061A), (0x064B, 0x065F), (0x0670, 0x0670),
    (0x06D6, 0x06DC), (0x06DF, 0x06E8), (0x06EA, 0x06ED), (0x0640, 0x0640),
]
DIACRITICS = re.compile(
    "[" + "".join(f"{chr(a)}-{chr(b)}" if a != b else chr(a) for a, b in _STRIP_RANGES) + "]"
)


def fetch(code: str) -> "list[str] | None":
    path = os.path.join(CACHE, f"{code}_arab_broad.tsv")
    if not os.path.exists(path):
        url = f"{BASE}/{code}_arab_broad.tsv"
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = r.read().decode("utf-8")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {code}: fetch failed ({e})", file=sys.stderr)
            return None
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(data)
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def skeleton(word: str) -> str:
    """Undiacritized consonantal skeleton: NFC, strip harakat/signs/tatweel, trim."""
    return DIACRITICS.sub("", unicodedata.normalize("NFC", word)).strip()


def main() -> None:
    seen: set[tuple[str, str, str]] = set()
    rows: list[tuple[str, str, str]] = []
    stats: list[tuple[str, str, int, int]] = []  # code, role, kept, dropped
    for code, role in LANGS:
        lines = fetch(code)
        if lines is None:
            stats.append((code, role, 0, 0))
            continue
        kept = dropped = 0
        for line in lines:
            if not line.strip() or "\t" not in line:
                continue
            word, ipa = line.split("\t", 1)
            ipa = ipa.strip()
            skel = skeleton(word)
            # Drop: empties, multi-word entries (a word-level restorer wants single tokens), and single-letter
            # skeletons — a lone letter has nothing to restore, and most such wikipron entries are letter-NAME
            # spellouts (آ → "alif madda"), which are noise.
            if not skel or not ipa or " " in skel or len(skel) < 2:
                dropped += 1
                continue
            key = (skel, code, ipa)
            if key in seen:
                dropped += 1
                continue
            seen.add(key)
            rows.append(key)
            kept += 1
        stats.append((code, role, kept, dropped))

    with open(OUT, "w", encoding="utf-8") as f:
        for skel, code, ipa in rows:
            f.write(f"{skel}\t{code}\t{ipa}\n")

    # Report.
    print(f"\nwrote {len(rows)} unique (skeleton, lang, ipa) rows -> {os.path.relpath(OUT, HERE)}\n")
    print(f"{'lang':>6} {'role':>8} {'kept':>7} {'dropped':>8}")
    print("-" * 33)
    by_role: dict[str, int] = {}
    for code, role, kept, dropped in stats:
        print(f"{code:>6} {role:>8} {kept:>7} {dropped:>8}")
        by_role[role] = by_role.get(role, 0) + kept
    print("-" * 33)
    for role in ("anchor", "dialect", "rider"):
        print(f"{role:>15}: {by_role.get(role, 0):>7}")
    print(f"{'TOTAL':>15}: {len(rows):>7}")


if __name__ == "__main__":
    main()
