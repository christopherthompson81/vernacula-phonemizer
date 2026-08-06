#!/usr/bin/env python3
"""Build training data for the Khmer word-boundary tagger — character sequences with per-character labels.

WHY KHMER NEEDS THIS AT ALL. Khmer writes no space between words, so the engine tokenises a MAXIMAL run of Khmer
letters as one unit and the syllabifier then re-parses across the invisible word boundaries. Measured on 4,000
junctions where a Khmer writer actually typed U+200B, joining the two words CORRUPTS the reading 54.6% of the
time — `នៅ|សតវត្ស` reads *nɨwhtɑʋɑt* joined against *nɨw + sɑtɑʋoət* apart, the ស collapsing into a coda and a
whole syllable vanishing. The boundary is an input the reader needs and does not have.

⚠ THE SUPERVISION IS IN THE TEXT AND IT IS ONE-SIDED. Khmer writers type U+200B at word boundaries, but only
sometimes. A typed ZWSP is a POSITIVE a human placed; its ABSENCE is not a negative — it may mean "no boundary"
or "the writer did not bother". Training on raw lines therefore teaches the model that most real boundaries are
non-boundaries. This is not hypothetical: `ខែមករា` ("month January") occurs 505 times as ONE unsplit token, which
is exactly what defeated the unigram Viterbi segmenter that came before this model — no frequency weighting can
split a compound that is itself frequent.

╔══ THE CLEANING PIPELINE, IN THREE LAYERS, EACH CHOSEN BY MEASUREMENT ══════════════════════════════════════════╗

1. THE DENSITY FILTER — which lines' ZEROS can be believed. Mean characters-per-token across a line proxies how
   completely its writer marked boundaries, and the corpus is sharply bimodal on it: p10 = 4.9 against p50 = 17.4.
   Khmer words run ~4-5 characters, so a line averaging <= 6 has nearly every boundary marked while one averaging
   17 has almost none. 15,501 of 180,782 lines qualify — 8.6%.

   ⚠ This subset is the CALIBRATION SET, NOT THE TRAINING SET. Training only on it would throw away 91% of the
   corpus and bias toward whatever text habitually gets annotated.

2. THE PER-TYPE SPLIT RATE — measured on layer 1, applied everywhere. The same character sequence recurs
   thousands of times, split by some writers and not others, so redundancy can settle what any single instance
   cannot: for each sequence, split_rate = (times a human split it) / (times it appeared at all).

   ⚠ AND IT MUST BE MEASURED ON THE DENSE SUBSET, which is the whole reason layer 1 exists. Over the raw corpus
   the rate is confounded by DOCUMENT annotation habits and the signal collapses — month compounds score 13-19%,
   indistinguishable from noise, because dates live in lightly-annotated timeline text. Restricted to dense lines
   the same compounds score 67-82%, and the histogram splits into two clean modes with a valley at 40-50%:

                              all lines      dense lines only
       ខែ + 12 month names     13-19%            67-82%     → a real boundary, marked ~15% of the time
       នៅឆ្នាំ ("in year")        38%              93.5%     → two words
       ទីក្រុង ("city")          6.2%              11.3%     → lexicalised compound, genuinely unclear
       លើក (one real word)       0.9%               0.9%     → never a boundary

   ⚠ THE RATE IS KEYED BY THE SPLIT POINT, NOT BY THE TOKEN. The first version looked up
   `rate[token[:cut] + token[cut:]]`, which is just `rate[token]` — the same value for every cut — so every
   interior position of a frequently-split token was labelled a boundary and `ខែមិថុនា` came out as `||||||||`.
   Caught by printing label strings for known words rather than trusting the counters. The table is therefore
   keyed by the PAIR a human actually produced, `(left, right)`, and a cut is only a boundary if humans split
   that token AT THAT POSITION.

   Types are then sorted three ways, and the middle is the point:
       rate >= HIGH_SPLIT  → the boundary is REAL: relabel EVERY occurrence, including the ~85% no writer marked
       rate <= LOW_SPLIT   → no boundary: the zero is trustworthy
       otherwise           → ABSTAIN. The position is masked out of the loss entirely.

   Abstention is what makes this sound rather than merely bigger. `ទីក្រុង` at 11.3% is not a labelling failure,
   it is a real question about whether a lexicalised compound has an internal boundary, and the corpus does not
   answer it. Guessing would inject noise in the name of removing it.

3. THE LENGTH GUARD — for sequences too rare for layer 2. Below MIN_TYPE_OBS observations the rate is not
   estimable, so a long unsplit token is treated as a probable unmarked compound and masked rather than fed as a
   negative. The ceiling is the dense subset's own token-length p99, computed at build time rather than guessed.

4. THE DICTIONARY — an INDEPENDENT source, which is what layers 1-3 could not be. Everything above is derived from
   the same wiki text, so its blind spots are correlated: an error analysis of the first model found that 98.8% of
   its scored precision errors landed on positions layer 3 had merely DEFAULTED to zero, never verified. A word
   list breaks that circularity, because it answers a different question — not "did a writer mark a boundary here"
   but "is this string a word at all".

   `km-lexicon-words.txt`, 62,101 Khmer forms from google/language-resources under CC BY 4.0 (attribution in that
   file's header), of which 57,577 were absent from our ZWSP-harvested frequency table. Two rules, and the second
   needs the first as its guard:
       the token IS a listed word            → it needs no internal boundary: the zeros are CONFIRMED
       the token is NOT listed, but divides
       into two listed words at this cut     → the zeros hide a REAL boundary: relabel it

   ⚠ THE `not listed` GUARD IS WHAT MAKES THE SPLIT RULE SAFE, and its absence is what sank the earlier frequency
   heuristic. `លើក` divides into លើ + ក, both real words, and splitting it is wrong — but លើក is itself a listed
   word, so the first rule fires and the second never runs. Verified on the cases both earlier heuristics got
   wrong: លើក, ជាមួយ, ដឹកនាំ and ទីក្រុង are listed (so no boundary, and ទីក្រុង's layer-2 abstention at 11.3% is
   resolved), while ខែមករា, ព្រះអង្គ, បូកដក and មហាក្សត្រ are not listed and divide cleanly.

   Measured before adopting, over the 8,059,105 interior positions that previously sat inside all-zero tokens:
       token IS a dictionary word → zeros CONFIRMED     4,894,141   60.7%
       token divides into two listed words → BOUNDARY   1,239,472   15.4%
       still unresolved                                 1,925,492   23.9%

   ⚠ A TYPED BOUNDARY STILL WINS. Where a writer marked a split inside what the dictionary calls one word (ដឹកនាំ,
   ជាមួយ), the typed instance keeps its label. Two independent sources disagreeing is the signature of a contested
   lexicalisation rather than an error in either, and the corpus instance is evidence about THAT instance.

╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

RUNS MATCH WHAT INFERENCE SEES. A training example is the concatenation of ZWSP-separated tokens with the
separators removed: exactly the maximal Khmer run the engine's tokeniser hands over. Ordinary spaces BREAK a run
rather than being joined across, because the engine already treats a space as a token boundary and never asks for
a prediction there — so the 162,153 space-carried boundaries are deliberately not used as labels. Non-Khmer
characters (digits, punctuation, Latin) also break runs.

  .venv/bin/python tools/khmer/build_km_segmenter_data.py <km-paragraphs.txt> /tmp/km_seg.tsv
    where the input is tools/normalization/wikidump-to-text.py output for a kmwiki dump.

Output is TSV: <run> \t <labels>, one label character per input character —
  '1' a word STARTS here · '0' it does not · '?' abstain (masked from loss and from scoring).
Position 0 is always '1' and is excluded from both loss and scoring: it is not a decision.
"""
import re
import sys
from collections import Counter

# The engine's own run class (khmer.ts TOKEN, segment.ts KHMER_RUN): Khmer letters, marks and signs, deliberately
# EXCLUDING the iteration mark ៗ (U+17D7) and the digits ០-៩, both of which tokenise separately.
KHMER_CH = re.compile(r"[ក-៓ៜ-៝]")
ANY_KHMER = re.compile(r"[ក-៝]")
JOINER = "​‌"          # ZWSP, ZWNJ — a boundary a writer typed
TOKEN_SPLIT = re.compile(r"[​‌\s]+")

MAX_MEAN_TOKEN = 6.0             # layer 1: a line this dense had its boundaries marked
MIN_LINE_KHMER = 40
MIN_TYPE_OBS = 10                # layer 2: fewer observations than this and the rate is not estimable
HIGH_SPLIT = 0.60                # >= this → a real boundary, relabel everywhere
LOW_SPLIT = 0.10                 # <= this → a genuine non-boundary
MIN_RUN = 4
MAX_RUN = 200
LEXICON = "tools/khmer/km-lexicon-words.txt"


def tokens_of(chunk: str) -> list[str]:
    """The Khmer tokens of one whitespace-free chunk, as the writer delimited them."""
    out, cur = [], []
    for ch in chunk:
        if KHMER_CH.match(ch):
            cur.append(ch)
        else:
            if cur:
                out.append("".join(cur))
                cur = []
            if ch not in JOINER:      # a non-Khmer, non-joiner character ends the run
                out.append("")        # sentinel: run break
    if cur:
        out.append("".join(cur))
    return out


def runs_of(line: str):
    """Yield the maximal Khmer runs of a line as lists of writer-delimited tokens."""
    for chunk in re.split(r"\s+", line):
        run: list[str] = []
        for tok in tokens_of(chunk):
            if tok == "":
                if run:
                    yield run
                run = []
            else:
                run.append(tok)
        if run:
            yield run


def is_dense(line: str) -> bool:
    if len(ANY_KHMER.findall(line)) < MIN_LINE_KHMER:
        return False
    toks = [t for t in TOKEN_SPLIT.split(line) if ANY_KHMER.search(t)]
    return bool(toks) and sum(len(t) for t in toks) / len(toks) <= MAX_MEAN_TOKEN


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: build_km_segmenter_data.py <km-paragraphs.txt> <out.tsv>", file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]

    # ---- layers 1+2: the per-type split rate, measured ONLY on densely-annotated lines ----
    single: Counter = Counter()
    split_pair: Counter = Counter()      # (left, right) → times a human split exactly there
    split_total: Counter = Counter()     # token → times a human split it anywhere
    tok_len: Counter = Counter()
    dense_lines = 0
    with open(src, encoding="utf8") as fh:
        for line in fh:
            if not is_dense(line):
                continue
            dense_lines += 1
            for run in runs_of(line):
                for t in run:
                    single[t] += 1
                    tok_len[len(t)] += 1
                for a, b in zip(run, run[1:]):
                    split_pair[(a, b)] += 1           # a human split THIS sequence AT THIS POINT
                    split_total[a + b] += 1

    # rate[(left, right)] = P(a human puts a boundary exactly here | the joined sequence was observed).
    # The denominator is every observation of the joined form: split anywhere, or written whole.
    rate: dict[tuple[str, str], float] = {}
    for (a, b), s in split_pair.items():
        obs = single.get(a + b, 0) + split_total.get(a + b, 0)
        if obs >= MIN_TYPE_OBS:
            rate[(a, b)] = s / obs
    # A token seen often and NEVER split is decisive negative evidence for all of its interior positions.
    never_split = {t for t, g in single.items() if g >= MIN_TYPE_OBS and split_total.get(t, 0) == 0}

    # ---- layer 4: the independent dictionary ----
    lex: set[str] = set()
    try:
        with open(LEXICON, encoding="utf8") as fh:
            for line in fh:
                if not line.startswith("#"):
                    w = line.strip()
                    if w:
                        lex.add(w)
    except OSError:
        print(f"  ⚠ {LEXICON} missing — layer 4 disabled, labels will be weaker", file=sys.stderr)
    print(f"  dictionary {len(lex):,} forms")

    def lex_cut(tok: str, cut: int) -> str | None:
        """The dictionary's verdict for one cut: '0' confirmed non-boundary, '1' recovered boundary, None if silent."""
        if not lex:
            return None
        if tok in lex:
            return "0"                                  # a listed word needs no internal boundary
        # NOT listed: does it divide into two listed words HERE? (the `tok in lex` guard above is what makes
        # this safe — see the header on លើក)
        if tok[:cut] in lex and tok[cut:] in lex:
            return "1"
        return None

    # ---- layer 3: the plausible-single-word ceiling, from the dense subset's own distribution ----
    total = sum(tok_len.values())
    acc, p99 = 0, max(tok_len) if tok_len else 12
    for L in sorted(tok_len):
        acc += tok_len[L]
        if acc >= 0.99 * total:
            p99 = L
            break

    decided_hi = sum(1 for r in rate.values() if r >= HIGH_SPLIT)
    decided_lo = sum(1 for r in rate.values() if r <= LOW_SPLIT)
    print(f"  dense lines {dense_lines:,} · never-split types {len(never_split):,}")
    print(f"  split points with >= {MIN_TYPE_OBS} obs {len(rate):,} "
          f"(boundary {decided_hi:,} · non-boundary {decided_lo:,} · abstain {len(rate)-decided_hi-decided_lo:,})")
    print(f"  plausible single-word ceiling (dense p99) = {p99} characters")

    # ---- emit: every line of the corpus, labels cleaned by the table above ----
    stats: Counter = Counter()
    with open(src, encoding="utf8") as fh, open(dst, "w", encoding="utf8") as out:
        for line in fh:
            for run in runs_of(line):
                text = "".join(run)
                if not (MIN_RUN <= len(text) <= MAX_RUN):
                    continue
                labels = ["0"] * len(text)
                labels[0] = "1"
                # a junction is where the writer ended a token; interior positions are non-boundaries by default
                pos = 0
                for tok in run[:-1]:
                    pos += len(tok)
                    labels[pos] = "1"                # a typed boundary is always believed
                    stats["typed boundary"] += 1

                # rewrite the UNMARKED interior of each token using the split-rate table
                pos = 0
                for tok in run:
                    for cut in range(1, len(tok)):
                        a, b = tok[:cut], tok[cut:]
                        r = rate.get((a, b))
                        if r is None and tok in never_split:
                            r = 0.0
                        i = pos + cut
                        lv = lex_cut(tok, cut)
                        if r is not None and r >= HIGH_SPLIT:
                            labels[i] = "1"
                            stats["RECOVERED boundary (corpus rate)"] += 1
                        elif r is not None and r <= LOW_SPLIT:
                            stats["kept 0 (measured non-boundary)"] += 1
                        elif lv == "1":
                            # the dictionary resolves it, whether layer 2 abstained or had no opinion at all
                            labels[i] = "1"
                            stats["RECOVERED boundary (dictionary)"] += 1
                        elif lv == "0":
                            stats["kept 0 (dictionary CONFIRMED)"] += 1
                        elif r is not None:
                            labels[i] = "?"
                            stats["masked (undecidable, no dictionary help)"] += 1
                        elif len(tok) > p99:
                            # layer 3: too rare to estimate and too long to be one word.
                            labels[i] = "?"
                            stats["masked (rare, long token)"] += 1
                        else:
                            stats["kept 0 (rare, plausible word)"] += 1
                    pos += len(tok)

                out.write(f"{text}\t{''.join(labels)}\n")
                stats["runs"] += 1
                stats["chars"] += len(text)

    print(f"  runs {stats['runs']:,} · chars {stats['chars']:,}")
    for k in ("typed boundary", "RECOVERED boundary (corpus rate)", "RECOVERED boundary (dictionary)",
              "kept 0 (measured non-boundary)", "kept 0 (dictionary CONFIRMED)", "kept 0 (rare, plausible word)",
              "masked (undecidable, no dictionary help)", "masked (rare, long token)"):
        print(f"    {k:42} {stats[k]:10,}")
    pos_total = (stats["typed boundary"] + stats["RECOVERED boundary (corpus rate)"]
                 + stats["RECOVERED boundary (dictionary)"])
    if stats["chars"]:
        print(f"  positives {pos_total:,} ({100*pos_total/stats['chars']:.1f}% of positions) · "
              f"masked {100*(stats['masked (undecidable)']+stats['masked (rare, long token)'])/stats['chars']:.1f}%")
        if stats["typed boundary"]:
            rec = stats["RECOVERED boundary (corpus rate)"] + stats["RECOVERED boundary (dictionary)"]
            print(f"  ⚠ label recovery: {rec:,} boundaries no writer marked, "
                  f"{rec/stats['typed boundary']:.2f}x the typed ones")
    print(f"  → {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
