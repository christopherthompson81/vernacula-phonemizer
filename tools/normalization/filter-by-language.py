#!/usr/bin/env python3
"""Drop paragraphs that are not in the target language, before mining.

⚠ WHY THIS EXISTS. A small Wikipedia is not all in its own language. su.wikipedia carries whole English
articles — 12.9% of its paragraphs by the test below — and they are not spread evenly: they are
PATTERN-RICH, so they dominate exactly the cells a normalizer is written from. On the su dump, before
filtering:

    ordinal-latin    27.2% Sundanese     (`\\d+th` is English; Sundanese writes ke-N / ka-N)
    ampersand        33.3%
    ranges           53.6%
    decimals         95.1%   ← most cells are fine, which is what makes the bad ones easy to miss

`mine.ts` selects adversarially, so those cells came through 6-8 out of 8 English in the artifact's
hard-set. A rule written from that evidence is a rule about English text that happens to sit in su.wikipedia,
attributed to Sundanese. This is playbook trap 34 (a small-wiki hit may be another language) applied to a
whole corpus rather than one probe.

⚠ THE TEST IS FUNCTION WORDS, NOT A LANGUAGE MODEL, and its limits are the reason it is conservative. It
counts how many of the target's high-frequency function words appear against a set of English ones, and keeps
a paragraph only when the target STRICTLY wins. Paragraphs with neither (short lists, tables, bare name
strings) are dropped as undecidable — on su that is 11.3%, and losing them is the right trade when 143k
paragraphs remain. ⚠ Do not use this to make a claim about the SIZE of a wiki; use it to make the text you
mine from be the language you are mining.

⚠ AND THE WORD LISTS MUST NOT BE SHARED WITH A CLOSE RELATIVE. Sundanese, Indonesian and Malay overlap
heavily; the su list below leans on words that are diagnostic against Indonesian (nyaéta, téh, jeung, ogé,
mangrupa) rather than the common core (yang, dan, di), so it does not silently accept Indonesian text.

  python3 filter-by-language.py --lang su --in su_paras.txt --out su_paras.su.txt
"""
import argparse
import collections
import re
import sys

# Target-language function words. Add a language by adding a row; keep the words HIGH-FREQUENCY and, where a
# close relative exists, DIAGNOSTIC against it.
MARKERS = {
    "su": "jeung anu nyaéta dina éta ogé kalawan sarta minangka téh mangrupa taun basa urang lian ieu "
          "kacamatan désa kabupatén nu ka ti geus baé hiji dua tilu opat lima kota wewengkon aya",
    "jv": "lan sing ing saka kanthi yaiku uga déning kang menyang iku dadi taun basa wong kutha",
    "id": "yang dan di dari dengan untuk pada adalah ini itu tidak akan sebagai oleh dalam tahun kota",
    # so: Cushitic, so no relative in this table to be diagnostic against; these are simply the highest-
    # frequency function words (iyo "and", ee/oo linkers, waxaa/waxay focus markers, ku/ka/la prepositions).
    "so": "iyo ee ah ka ku la oo waa in uu ay si ugu kala ayaa waxaa waxay lagu loo soo dhexe "
          "magaalada dalka sanadkii badan mid oo dhan ka mid",
    # ak (Akan): Twi and Fante are two varieties of ONE language, so this row is deliberately NOT
    # diagnostic between them — it is diagnostic against ENGLISH, which is what tw.wikipedia and
    # fat.wikipedia actually carry (4.5% / 8.1% English-dominant paragraphs). The words are the copula
    # yɛ, the locative/possessive wɔ, the linkers na/ne/nso, the postposed article no, the postpositions
    # mu/ho/so, the complementiser sɛ, and the pronoun set — all shared by both varieties.
    "ak": "yɛ wɔ na ne no mu sɛ nso nyinaa de ma ho so wɔn yɛn me nti bio saa anaa firi kɔ ase "
          "deɛ ɔno afe da mmom bɛ aa ɔyɛ",
}
ENGLISH = set(
    "the of and in to was were is are that with for by as from this which been has his its it on at "
    "an be or not they their he she we you have had also".split()
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=sorted(MARKERS))
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-chars", type=int, default=40)
    a = ap.parse_args()

    target = set(MARKERS[a.lang].split())
    word_rx = re.compile(r"[^\W\d_]+", re.UNICODE)
    tally = collections.Counter()

    with open(a.inp, encoding="utf8") as fin, open(a.out, "w", encoding="utf8") as fout:
        for line in fin:
            s = line.strip()
            if len(s) < a.min_chars:
                tally["short"] += 1
                continue
            w = set(m.lower() for m in word_rx.findall(s))
            t, e = len(w & target), len(w & ENGLISH)
            if t > e:
                tally["kept"] += 1
                fout.write(s + "\n")
            elif e > t:
                tally["dropped: english"] += 1
            else:
                tally["dropped: undecidable"] += 1

    n = sum(tally.values())
    for k, v in tally.most_common():
        print(f"  {k:22} {v:7}  ({100*v/n:.1f}%)", file=sys.stderr)
    print(f"→ {a.out}: {tally['kept']} paragraphs", file=sys.stderr)


if __name__ == "__main__":
    main()
