#!/usr/bin/env python3
"""espeak-ng's Pashto dictionary → the miner's (word, lang, IPA) silver shape.

WHY THIS EXISTS. Pashto's short-vowel restoration was data-starved: the whole supervision was wikipron
(1,414) + kaikki (1,055), and `docs/investigations/ps_neural_restoration_investigation.md` concluded there
was no larger machine-readable Pashto IPA corpus. There is. espeak-ng ships `dictsource/ps_list` —
82,583 word→pronunciation entries contributed by Hanif Rahman — and it was missed because
`tools/normalization/sources.ts` gates its espeak tier on $ESPEAK_NG, which was unset, so it reported
"espeak does not ship this language at all".

⚠ THE CONVERSION IS EXACT, NOT GUESSED. `phsource/ph_pashto` declares an `ipa` string for every phoneme it
defines, so the mnemonic→IPA map is read out of the phoneme table rather than reconstructed from the
mnemonics' spelling. That matters: `Q` is ʁ and `S.` is ʂ, neither of which is recoverable by eye.

⚠ AND THIS IS SILVER, NOT GOLD. Measured against the wikipron referee on the 274 multi-character words the
two share, espeak has the same vowel count 68% of the time, FEWER 26% (it systematically drops the
epenthetic schwa our g2p models — اتل a:tl vs the referee's a t ə l) and more 6%. The downstream inverter
is what makes that safe: a word only yields a label if some vocalization of it REPRODUCES this IPA under
our own g2p, so espeak's errors and its dialect disagreements self-filter instead of being trusted.

  python3 build_espeak_silver.py [--espeak $ESPEAK_NG] > silver.espeak-ps.tsv
"""
import argparse, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument("--espeak", default=os.environ.get("ESPEAK_NG", "/home/chris/Programming/espeak-ng"))
ap.add_argument("--out", default="-")
a = ap.parse_args()

PH = os.path.join(a.espeak, "phsource", "ph_pashto")
LIST = os.path.join(a.espeak, "dictsource", "ps_list")

# ── the phoneme table's own ipa declarations ────────────────────────────────────────────────────────────
ipa = {}
name = None
for line in open(PH, encoding="utf8"):
    s = line.split("//")[0].strip()
    if s.startswith("phoneme "):
        name = s.split(None, 1)[1].strip()
    elif s.startswith("ipa ") and name:
        ipa[name] = s.split(None, 1)[1].strip()
    elif s == "endphoneme":
        name = None
# espeak writes the unstressed variants a#/i#/u# but the table gives them the same ipa as a/i/u.
missing = [m for m in ("a", "i", "u", "@") if m not in ipa]
if missing:
    sys.exit(f"phoneme table has no ipa for {missing} — refusing to guess")
print(f"# phoneme table: {len(ipa)} mnemonics with an explicit ipa", file=sys.stderr)

MNEMONICS = sorted(ipa, key=len, reverse=True)  # longest-match: `a:` before `a`, `S.` before `S`
STRIP = set("'`,%=|_")                          # stress, phoneme-table separators, compound joiner

def to_ipa(pron):
    """espeak mnemonic string → IPA, or None if any segment is unmappable (we never guess)."""
    out, i = [], 0
    while i < len(pron):
        c = pron[i]
        if c in STRIP or c.isspace():
            i += 1
            continue
        for m in MNEMONICS:
            if pron.startswith(m, i):
                out.append(ipa[m]); i += len(m); break
        else:
            return None
    return "".join(out)

# ── the dictionary ─────────────────────────────────────────────────────────────────────────────────────
ARAB = re.compile(r"[؀-ۿݐ-ݿ]")
rows, seen, unmappable, nonword = [], set(), 0, 0
for line in open(LIST, encoding="utf8"):
    s = line.rstrip("\n")
    if not s.strip() or s.lstrip().startswith("//") or s.lstrip().startswith("phonemetable"):
        continue
    if "\t" not in s:
        continue
    word, rest = s.split("\t", 1)
    word = word.strip()
    pron = rest.split("\t")[0].strip()
    # ⚠ SKIP THE LETTER NAMES AND ANY NON-PASHTO HEADWORD. A single Perso-Arabic character's entry is the
    # LETTER NAME (ا→alif), which is an orthographic fact about the alphabet and not a word's pronunciation;
    # training a vowel restorer on it would teach the model to read a bare letter as its name.
    if len(word) < 2 or not ARAB.search(word):
        nonword += 1
        continue
    if word in seen:
        continue
    got = to_ipa(pron)
    if got is None or not got:
        unmappable += 1
        continue
    seen.add(word)
    rows.append((word, "ps", got))

out = sys.stdout if a.out == "-" else open(a.out, "w", encoding="utf8")
for w, lang, p in rows:
    print(f"{w}\t{lang}\t{p}", file=out)
print(f"# emitted {len(rows)} rows · skipped {nonword} letter-names/non-Pashto · "
      f"{unmappable} unmappable pronunciations", file=sys.stderr)
