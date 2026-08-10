#!/usr/bin/env python3
"""Derive per-VARIETY Pashto referees from kaikki's own dialect tags — ground truth, not inference.

WHY THIS AND NOT split_referee_by_dialect.py. That tool infers a reading's variety from the ښ/ږ reflex,
which is all wikipron offers. kaikki is better: it TAGS each pronunciation (Kandahar / Peshawar / Wazirwola
/ …), so the assignment can be READ rather than guessed. This builder uses the tags; the inferring tool
remains for wikipron, and the two now corroborate each other.

    pbt  Southern / Kandahari   Kandahar · Southern · Southwestern · South
    pbu  Northern / Peshawar    Northern · Peshawar · Northeastern · Eastern · Jalalabad · Northwestern
    pst  Central / Waziri       Wazirwola · Central · Wardak · Southeastern

⚠ VALIDATION — the tags CONFIRM the ښ/ږ inference, which is what licenses using it on wikipron:

    ښ   pbt → ʂ 57/65 (88%)    pbu → x 65/69 (94%)    pst → ç 24/38 (63%, ʃ 8)
    ږ   pbt → ʐ 33/35 (94%)    pbu → ɡ 30/33 (91%)    pst → ʝ 8 / ʒ 10

⚠ AND THE ISOGLOSS IS THE ONLY AXIS THIS GRADER CAN SEE — a measurement, not an assumption. Mining all 318
same-word cross-variety pairs for systematic differences returns the ښ/ږ reflexes and then nothing but
notation (tie bars, brackets, slashes). Vowels DO differ — 79 of 318 pairs (25%), e.g. پښتو is pbt
/pəʂˈt̪o/, pbu /pʊxˈt̪o/, pst /paçˈt̪o/ — but the eval fold already collapses [əaiuɪʊ]→ə as unrecoverable
from an undiacritized abjad, so those differences are invisible to scoring either way. That is what lets a
word with no ښ/ږ sit in every variety's referee without making it an aggregate again.

⚠ TAGS ARE SPARSE. Of 1,644 IPA records only 305 carry a variety tag. The rest are UNTAGGED, not neutral,
and go to a fourth file rather than being distributed silently into the three — an unlabelled reading is
evidence about Pashto, not about a member, and pretending otherwise is the mistake this exercise exists to
stop.

  Regenerate (the 4.2 MB source is not vendored; CC-BY-SA):
    curl -sL -o kaikki-pashto.jsonl https://kaikki.org/dictionary/Pashto/kaikki.org-dictionary-Pashto.jsonl
    python3 tools/pashto/build_kaikki_dialect_referees.py kaikki-pashto.jsonl tools/referee-eval/referees/ps.kaikki
"""
import collections
import json
import re
import sys

VARIETIES = {
    "pbt": ("Southern / Kandahari", {"Kandahar", "Southern", "Southwestern", "South"}),
    "pbu": ("Northern / Peshawar", {"Northern", "Peshawar", "Northeastern", "Eastern", "Jalalabad",
                                    "Northwestern", "North"}),
    "pst": ("Central / Waziri", {"Wazirwola", "Central", "Wardak", "Southeastern"}),
}
# ⚠ A LETTER-NAME ENTRY IS NOT A WORD'S PRONUNCIATION. kaikki tags them, so unlike wikipron they can be
# dropped by LABEL instead of by the length heuristic the eval otherwise needs.
SKIP = {"letter", "name", "phoneme"}
STRIP = re.compile(r"[/\[\]ˈˌ.]")


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    counts = collections.Counter()
    for line in open(src, encoding="utf8"):
        d = json.loads(line)
        w = (d.get("word") or "").strip()
        if not w or len([*w]) < 2:
            continue
        for s in d.get("sounds", []) or []:
            ipa = (s.get("ipa") or "").strip()
            if not ipa:
                continue
            tags = set(s.get("tags", []) or [])
            if tags & SKIP:
                counts["skipped"] += 1
                continue
            hit = [k for k, (_, ts) in VARIETIES.items() if tags & ts]
            key = hit[0] if len(hit) == 1 else "untagged"
            clean = STRIP.sub("", ipa)   # kaikki writes /slashes/, [brackets], stress and syllable dots
            if clean and clean not in out[key][w]:
                out[key][w].append(clean)
                counts[key] += 1
    for key in [*VARIETIES, "untagged"]:
        words = out[key]
        name = VARIETIES.get(key, ("UNTAGGED — variety unknown, NOT neutral",))[0]
        path = f"{prefix}-{key}-tagged.tsv" if key != "untagged" else f"{prefix}-untagged.tsv"
        with open(path, "w", encoding="utf8") as f:
            print(f"# {path.rsplit('/', 1)[-1]} — kaikki Pashto, {name}. Assigned by kaikki's OWN dialect"
                  " tags, not inferred from reflexes.", file=f)
            print("# Built by tools/pashto/build_kaikki_dialect_referees.py from"
                  " kaikki.org-dictionary-Pashto.jsonl (CC-BY-SA). Letter-name/phoneme entries dropped by"
                  " TAG; single-character headwords dropped.", file=f)
            if key == "untagged":
                print("# ⚠ NOT A VARIETY REFEREE. These readings carry no dialect tag. They are evidence"
                      " about Pashto, not about any member, and are kept separate rather than distributed"
                      " into the three — which would rebuild the aggregate this split exists to undo.", file=f)
            print(f"# {len(words)} words, {sum(len(v) for v in words.values())} readings.", file=f)
            for w in sorted(words):
                print("\t".join([w, *words[w]]), file=f)
        print(f"  {path}: {len(words)} words, {sum(len(v) for v in words.values())} readings", file=sys.stderr)
    print(f"  (skipped {counts['skipped']} letter/name/phoneme records)", file=sys.stderr)


if __name__ == "__main__":
    main()
