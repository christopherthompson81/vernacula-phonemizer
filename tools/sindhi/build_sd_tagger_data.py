#!/usr/bin/env python3
"""
Build per-grapheme TAGGER training data for Sindhi from the vocalized lexicon.

The Bengali/Norwegian structural-tagger contract: one tag per INPUT SYMBOL, output length == input
length. So each Perso-Arabic letter must be labelled with the IPA chunk it contributes — consonant
(copied verbatim) plus whatever short vowel follows it, or the empty chunk. Concatenating the tags
must reproduce the gold IPA exactly. That constraint is what makes the model unable to break the
consonant backbone the rule g2p already gets right.

Getting there needs an ALIGNMENT: the lexicon gives (word, gold IPA) but not which letter produced
which piece. We solve it as a DP over (letter index, gold IPA position), where each letter may emit
one of a small candidate set derived from sindhi.jsonc. A word is kept only if some path consumes
the whole word AND the whole gold IPA — i.e. the alignment is exact, never approximate.

Outputs (tools/sindhi/):
  sd_tagger_data.tsv   word \t letters(space-sep) \t tags(space-sep, '_' = empty chunk)
  sd_tagger_meta.json  {src, tags, charTags} — the TaggerMeta shape src/core/structuralTagger.ts loads

Run: python3 build_sd_tagger_data.py
"""
import json, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LEX = ROOT / "src/languages/sindhi/sindhi-lexicon.tsv"
DEF = ROOT / "src/languages/sindhi/sindhi.jsonc"
EMPTY = "_"


def load_jsonc(p: Path) -> dict:
    s = p.read_text(encoding="utf8")
    s = re.sub(r"^\s*//.*$", "", s, flags=re.M)          # line comments
    s = re.sub(r",(\s*[}\]])", r"\1", s)                   # trailing commas
    return json.loads(s)


D = load_jsonc(DEF)
CONS: dict[str, str] = D["consonants"]
ASP: dict[str, str] = D["aspirateWithHe"]
LONG: dict[str, str] = D["longVowels"]
GLIDE: dict[str, str] = D["glides"]
HARAKAT: dict[str, str] = D["harakat"]

HE = "ھ"
NOON_GHUNNA = "ں"
# The short vowels the abjad leaves unwritten. ə is the rule default; ʊ/ɪ are what the vocalized
# sources actually attest (ʊ dominates word-finally — the retained masculine nominative -u).
SHORT = ["ə", "ʊ", "ɪ", "a", "i", "u", "e", "o", "ɛ", "ɔ"]
LONGV = ["aː", "iː", "uː", "eː", "oː", "ɛː", "ɔː"]


# The vocalized sources are not notation-normalized against sindhi.jsonc: they write r for ɾ, plain d/t
# for the dental d̪/t̪, ɦ for h, v for ʋ. And ن surfaces as the homorganic nasal of whatever follows
# (آنڊو → aːɳɖoː). Allowing these as alternate realisations of the SAME letter is what lets the aligner
# consume real lexicon rows; the tag that wins is whatever the gold actually spells.
VARIANTS: dict[str, list[str]] = {
    "ɾ": ["r"], "r": ["ɾ"], "ʋ": ["v", "w"], "h": ["ɦ"], "ɦ": ["h"],
    "d̪": ["d"], "t̪": ["t"], "d̪ʰ": ["dʱ", "dʰ", "d̪ʱ"], "t̪ʰ": ["tʰ"],
    "bʰ": ["bʱ"], "ɡʰ": ["ɡʱ"], "d͡ʒʰ": ["d͡ʒʱ"], "ɖʰ": ["ɖʱ"], "ɽʰ": ["ɽʱ"],
    "n": ["m", "ŋ", "ɳ", "ɲ", "n̪"],  # homorganic assimilation
    "q": ["k"], "ʃ": ["ʂ"], "ɳ": ["n"], "ɽ": ["r", "ɾ"],
}


def bases(ipa: str) -> list[str]:
    """A consonant plus its accepted notation variants."""
    return [ipa] + VARIANTS.get(ipa, [])


def candidates(letters: list[str], i: int) -> list[str]:
    """IPA chunks letter i may emit. Generous by design — the DP picks the one that fits the gold,
    and the observed (letter → chunk) pairs become the consonant-consistency mask."""
    c = letters[i]
    out: list[str] = [""]
    # C + ھ digraph → the aspirated consonant, carried on the FIRST letter (ھ then emits empty)
    if i + 1 < len(letters) and letters[i + 1] == HE and c in ASP:
        for base in bases(ASP[c]):
            out += [base] + [base + v for v in SHORT]
    if c in CONS:
        for base in bases(CONS[c]):
            out += [base] + [base + v for v in SHORT]
            out += [base + v + "̃" for v in SHORT]
    if c in LONG:
        out += [LONG[c]] + LONGV + [v + "̃" for v in LONGV]
    if c in GLIDE:
        g = GLIDE[c]
        out += [g] + [g + v for v in SHORT]
    if c in HARAKAT:
        out += [HARAKAT[c]] + SHORT
    if c == NOON_GHUNNA:
        out += ["̃", "n", "m", "ŋ", "ɳ", "ɲ"]
    if c in ("ئ", "ؤ", "ع", "ء"):
        out += ["ʔ"] + SHORT + LONGV
    # word-initial bare alif is a short-vowel carrier
    if c in ("ا", "آ"):
        out += SHORT + [v + "̃" for v in SHORT]
    seen, uniq = set(), []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def align(word: str, gold: str) -> list[str] | None:
    """DP: assign each letter one candidate chunk so the concatenation equals gold exactly."""
    letters = list(word)
    g = unicodedata.normalize("NFC", gold)
    n, m = len(letters), len(g)
    # reach[i][j] = letter i can start at gold position j
    back: list[dict[int, tuple[int, str]]] = [dict() for _ in range(n + 1)]
    cur = {0}
    for i in range(n):
        nxt: set[int] = set()
        cands = candidates(letters, i)
        for j in cur:
            for ch in cands:
                cj = unicodedata.normalize("NFC", ch)
                if cj == "":
                    if j not in back[i + 1]:
                        back[i + 1][j] = (j, "")
                    nxt.add(j)
                elif g.startswith(cj, j):
                    k = j + len(cj)
                    if k not in back[i + 1]:
                        back[i + 1][k] = (j, ch)
                    nxt.add(k)
        cur = nxt
        if not cur:
            return None
    if m not in cur:
        return None
    # walk back
    tags: list[str] = []
    j = m
    for i in range(n, 0, -1):
        prev, ch = back[i][j]
        tags.append(ch if ch else EMPTY)
        j = prev
    return tags[::-1]


def main() -> None:
    rows = []
    for line in LEX.read_text(encoding="utf8").splitlines():
        if not line.strip():
            continue
        w, _, ipa = line.partition("\t")
        if ipa:
            rows.append((w, ipa))

    kept, failed = [], []
    for w, ipa in rows:
        t = align(w, ipa)
        (kept if t else failed).append((w, ipa, t))

    print(f"lexicon rows: {len(rows)}   aligned: {len(kept)} ({len(kept)/len(rows):.1%})   failed: {len(failed)}")
    if failed[:6]:
        print("sample alignment failures (word / gold):")
        for w, ipa, _ in failed[:6]:
            print(f"   {w}\t{ipa}")

    # meta: symbol vocab, tag vocab, and the per-symbol permitted-tag mask (observed pairs only)
    src = {"<pad>": 0, "<unk>": 1}
    tagv = {EMPTY: 0}
    char_tags: dict[str, set[int]] = defaultdict(set)
    lines = []
    tagfreq = Counter()
    for w, ipa, tags in kept:
        letters = list(w)
        for c in letters:
            if c not in src:
                src[c] = len(src)
        for t in tags:
            if t not in tagv:
                tagv[t] = len(tagv)
            tagfreq[t] += 1
        for c, t in zip(letters, tags):
            char_tags[c].add(tagv[t])
        lines.append(f"{w}\t{' '.join(letters)}\t{' '.join(tags)}")

    (HERE / "sd_tagger_data.tsv").write_text("\n".join(lines) + "\n", encoding="utf8")
    meta = {
        "src": src,
        "tags": {str(v): k for k, v in tagv.items()},
        "charTags": {c: sorted(v) for c, v in char_tags.items()},
    }
    (HERE / "sd_tagger_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"symbols: {len(src)}   tags: {len(tagv)}   words written: {len(lines)}")
    print("most common tags:", ", ".join(f"{t!r}×{n}" for t, n in tagfreq.most_common(12)))
    amb = [c for c, v in char_tags.items() if len(v) > 1]
    print(f"symbols with >1 permitted tag (the decisions the model makes): {len(amb)}/{len(char_tags)}")


if __name__ == "__main__":
    main()
