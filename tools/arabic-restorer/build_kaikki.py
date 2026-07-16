#!/usr/bin/env python3
"""Augment the inversion reference with kaikki (Wiktionary) pronunciations — a DATA-SCALING step.

wikipron (silver.tsv) is one Wiktionary extraction; kaikki is another, larger one (Persian: 20k entries vs
wikipron's 10k), with real human IPA that carries the short vowels. This pulls the NEW words (not already in
silver.tsv) into `silver.kaikki.tsv`, which invert_harakat.ts then labels alongside wikipron — MORE training pairs
for the neural model, so it generalizes better on the fixed wikipron held-out eval (which stays untouched: the
eval_set is derived from silver.tsv only, and build_training_manifest excludes those skeletons from training).

Input: a kaikki .jsonl dump per language (download once to cache/). Output rows: skeleton <TAB> lang <TAB> ipa.
Pure stdlib.
"""
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "silver.kaikki.tsv")
SILVER = os.path.join(HERE, "silver.tsv")
WIKI_CODE = {"fas": "/tmp/fa_kaikki.jsonl", "urd": "/tmp/ur_kaikki.jsonl"}  # lang(silver code) → kaikki dump

_STRIP = [(0x0610, 0x061A), (0x064B, 0x065F), (0x0670, 0x0670),
          (0x06D6, 0x06DC), (0x06DF, 0x06E8), (0x06EA, 0x06ED), (0x0640, 0x0640)]
DIACRITICS = re.compile("[" + "".join(f"{chr(a)}-{chr(b)}" if a != b else chr(a) for a, b in _STRIP) + "]")
PERSO_ARABIC = re.compile(r"^[؀-ۿݐ-ݿࢠ-ࣿ]+$")


def skeleton(w):
    return DIACRITICS.sub("", unicodedata.normalize("NFC", w)).strip()


def clean_ipa(s):
    return s.strip().strip("/[]").replace(".", " ").replace("ˈ", "").replace("ˌ", "").strip()


# Per-source IPA HARMONIZER: normalize the source's narrow transcription to OUR g2p's (broad) convention BEFORE
# inversion, so more of it inverts consistently and its labels don't teach off-convention patterns to the shared
# model. Without this, a second source's conventions REGRESS the wikipron eval (Run 17). Per language, since e.g.
# aspiration is phonemic in Urdu but not Persian.
def harmonize(ipa, code):
    if code == "fas":
        # Persian: strip combining marks except the tie bar (removes stress accents ́, dental ̪, voiceless ring ̥),
        # then map narrow base/modifier symbols — no phonemic aspiration/palatalization; ɒ→ɑ, æ→a (Tehran short-a),
        # ɹ→ɾ, ð→z, glide w→v. Labialization ʷ (خو) is KEPT.
        ipa = "".join(c for c in unicodedata.normalize("NFD", ipa)
                      if unicodedata.combining(c) == 0 or c == "͡")
        for a, b in [("ʰ", ""), ("ʲ", ""), ("ɒ", "ɑ"), ("æ", "a"), ("ɹ", "ɾ"), ("ð", "z"), ("w", "v")]:
            ipa = ipa.replace(a, b)
        ipa = unicodedata.normalize("NFC", ipa)
    elif code == "urd":
        # Urdu kaikki already matches our convention (dental t̪, aspiration ʰ/ʱ, ə/ɪ/ʊ, ʋ, ɦ). Just drop the
        # optional-segment parentheses + stress accents; KEEP dental ̪, nasalization ̃, tie ͡, aspiration.
        ipa = ipa.replace("(", "").replace(")", "")
        ipa = "".join(c for c in unicodedata.normalize("NFD", ipa)
                      if unicodedata.combining(c) == 0 or c in "̪̃͡")
        ipa = unicodedata.normalize("NFC", ipa)
    return ipa


def main():
    # Existing wikipron skeletons per lang — so we only ADD new words (dedup vs the eval reference).
    have = {c: set() for c in WIKI_CODE}
    for line in open(SILVER, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 3 and p[1] in have:
            have[p[1]].add(p[0])

    rows, added, missing = [], {c: 0 for c in WIKI_CODE}, []
    for code, path in WIKI_CODE.items():
        if not os.path.exists(path):
            missing.append(path); continue
        seen = set()
        for line in open(path, encoding="utf-8"):
            try:
                d = json.loads(line)
            except Exception:  # noqa: BLE001
                continue
            w = d.get("word", "")
            skel = skeleton(w)
            if (not skel or len(skel) < 2 or " " in skel or not PERSO_ARABIC.match(skel)
                    or skel in have[code] or skel in seen):
                continue  # drop single-letter entries (letter names) + multiword + dups
            ipa = next((clean_ipa(s["ipa"]) for s in d.get("sounds", []) if s.get("ipa")), "")
            if not ipa:
                continue
            ipa = harmonize(ipa, code)  # normalize to our g2p's convention before inversion
            seen.add(skel)
            rows.append(f"{skel}\t{code}\t{ipa}")
            added[code] += 1

    open(OUT, "w", encoding="utf-8").write("\n".join(rows) + ("\n" if rows else ""))
    for path in missing:
        print(f"  ! missing kaikki dump: {path}", file=sys.stderr)
    print(f"wrote {len(rows)} NEW kaikki pairs → {os.path.basename(OUT)}: "
          + ", ".join(f"{c} +{added[c]}" for c in WIKI_CODE))


if __name__ == "__main__":
    main()
