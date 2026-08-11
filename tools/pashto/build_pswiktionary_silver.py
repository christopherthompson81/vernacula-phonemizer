#!/usr/bin/env python3
"""ps.wiktionary's romanizations → the miner's (word, lang, IPA) silver shape.

WHY THIS EXISTS. Every Pashto pronunciation source in this repo is either the referee itself (wikipron,
kaikki — so mining from it and scoring against it is circular, investigation Run 11) or espeak-ng's ps_list
(82k rows, GPL, and ~3:1 Northern before the inversion filters it). ps.wiktionary is neither. Run 13 measured
it as the FIRST pbt-MAJORITY source found, and it is independent of all three:

    ښ → ṣ̌ / x̌ (pbt) 74/75 = 99%   ·  plain s 1  ·  NORTHERN x 0  ·  broad š 0
    ږ → ẓ̌ / ǧ (pbt) 32/32 = 100%
    605 single-word headwords, 547 of them in NEITHER wikipron, kaikki, NOR our lexicon

⚠ Those two lines were 68% and 81% when this file was written, and the correction matters more than the
numbers do. The first survey classified by an elif chain that tested for a bare `x` before recognising `x̌`,
and compared `š` across mismatched normalization forms — so it read MacKenzie's SOUTHERN x̌ and ǧ as Northern
x and g. The source is not pbt-majority, it is very nearly pbt-only. Third time in this investigation that a
diagnostic also matched something else (Runs 5, 7, 12); the fix is the same each time — classify on explicit
base+mark clusters, NFC-normalized, not on substring presence.

⚠ THE `{{IPA|…}}` TEMPLATE ON ps.wiktionary DOES NOT CONTAIN IPA. It holds an ad-hoc Latin transliteration in
the Pashto Academy / MacKenzie tradition — `bāĵ-pā́zay`, `astāz-lìk`, `halɘk`. That is not a defect for our
purposes, it is the whole point: the diacritics encode exactly what the abjad does not write.

    acute  ×938   STRESS       (87% of values)      dot   ×335  RETROFLEX  ḍ ṛ ṇ ṭ
    macron ×559   LENGTH       (49%)                caron ×138  POSTALV.   č ǰ š ž

⚠ WHAT THIS SCRIPT HAS TO GET RIGHT IS NARROWER THAN IT LOOKS, because the miner compares under
`PS_FULL_FOLD`, which strips stress and length. So the acute can be dropped outright and the macron matters
only where it changes vowel QUALITY (ā is /ɑ/, a different vowel from /a/ — not merely a longer one). What
must be right is the segment sequence and the short-vowel qualities a/ə/i/u/o, which is the axis the abjad
loses and the only axis the miner can actually learn from.

⚠ AND THE SOURCE IS VISIBLY CORRUPTED IN PLACES — a contiguous block of nine headwords (باز ارمخچه اگن باښه
برگېلۍ پينگوين تارو ترکاڼک ټکټکانه) all carry the single value `bāz`; ټاپول carries وگړپال's; `dictionnaire`
is French. Two independent guards, in this order:

  1. THE SKELETON CHECK here — the romanization's consonant sequence must match the headword's. This catches
     the copy-paste blocks cheaply and before the expensive search.
  2. THE INVERSION ITSELF downstream — a row yields a label only where some vocalization of the skeleton makes
     OUR g2p reproduce this IPA. That is the same filter that took espeak's 501 unambiguously-Northern
     entries to exactly 0 (Run 12), and it does not care why a row is wrong.

  python3 build_pswiktionary_silver.py --dump pswiktionary-latest-pages-articles.xml.bz2 \
      --out ../perso-arabic/silver.pswikt-ps.tsv
"""
import argparse
import bz2
import math
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ap = argparse.ArgumentParser()
ap.add_argument("--dump", required=True, help="pswiktionary-latest-pages-articles.xml.bz2")
ap.add_argument("--out", default="-")
# ⚠ THE STRESS REFEREE IS A SEPARATE OUTPUT, NOT AN EXTRA COLUMN. It has a different membership rule (exactly
# one accent, and it must land on a vowel) and a different consumer (tools/pashto/eval_ps_stress.ts, which
# compares POSITION, not segments). Mixing them would put rows in the silver that the miner cannot use.
ap.add_argument("--stress-out", help="also write the STRESS referee: word ⇥ IPA-with-ˈ")
a = ap.parse_args()

# ── the transliteration → IPA map ────────────────────────────────────────────────────────────────────
# Read off the DATA, not off a general romanization standard: each mapping below is anchored to a headword in
# this dump where the Arabic letter and its Latin counterpart can be lined up by eye. The confusable ones and
# their anchors:
#     c  = څ  t͡s   (اسمانڅك = asmān-cák)          j  = ځ  d͡z   (اخځليك = axaj-lík)
#     č  = چ  t͡ʃ   (اړپېچ  = aṛ-péč)              ǰ/ĵ = ج  d͡ʒ  (احتجاجليك = ehteǰāǰ-lík, باجپازی = baĵ-…)
#     ṣ/x̌ = ښ  ʂ   (ارزښت  = arz-áṣt, اوښسپور = ux̌-spór)
#     ẓ/ǧ = ږ  ʐ   (اروالېږد = arwā-léẓd, غږپوهه = …γaǧ-póha)
#     ɤ/γ = غ  ɣ   — a VOWEL-LOOKING glyph for a consonant; read as a vowel this would corrupt every غ word.
# Targets are this engine's inventory (src/languages/pashto/pashto.jsonc), including the dental t̪/d̪.
MAP = {
    # vowels — quality only; length is folded away downstream
    "ā": "ɑ", "â": "ɑ", "ɑ": "ɑ",
    "a": "a", "e": "e", "ē": "e", "i": "i", "ī": "i", "ɪ": "i",
    "o": "o", "ō": "o", "ɔ": "o", "u": "u", "ū": "u",
    "ǝ": "ə", "ə": "ə", "ɘ": "ə",
    # consonants
    "b": "b", "p": "p", "t": "t̪", "d": "d̪", "k": "k", "g": "ɡ", "q": "q", "f": "f",
    "ṭ": "ʈ", "ḍ": "ɖ", "ṇ": "ɳ", "ṛ": "ɻ", "ɻ": "ɻ", "ɺ": "ɻ",
    "s": "s", "z": "z", "š": "ʃ", "ž": "ʒ",
    "č": "t͡ʃ", "ǰ": "d͡ʒ", "ĵ": "d͡ʒ", "c": "t͡s", "j": "d͡z",
    "ṣ": "ʂ", "x̌": "ʂ", "ẓ": "ʐ", "ǧ": "ʐ", "ğ": "ʐ",
    "x": "x", "χ": "x", "ɤ": "ɣ", "γ": "ɣ", "h": "h",
    "m": "m", "n": "n", "ŋ": "n", "l": "l", "r": "r", "w": "w", "y": "j",
    "ʔ": "ʔ", "ʈ": "ʈ", "ɳ": "ɳ", "ɡ": "ɡ", "ʒ": "ʒ",
}
# Marks that carry information the map keys already encode (they are recomposed before lookup), vs marks that
# are pure prosody and are dropped. ⚠ The acute is DROPPED, not translated: stress is real information but
# PS_FULL_FOLD strips it, so carrying it here would only create spurious mismatches in the search.
COMBINING_KEEP = {"̄", "̣", "̌", "̇", "̂", "̆"}  # macron, dot below, caron, dot above, circumflex, BREVE
# ⚠ THE CIRCUMFLEX AND THE BREVE ARE KEPT, AND EACH IS A ONE-CHARACTER TRAP OF THE SAME SHAPE. Both occur
# exactly once in the dump and both are LETTER-FORMING there: `ĵ` (باجپازی = `baĵ-pā́zay`) is a variant of ǰ
# for ⟨ج⟩ d͡ʒ, and `ğ` (زېږندويي = `zeğǝndoyí`) is a variant of ǧ for ⟨ږ⟩ ʐ. Dropped as prosody, each left a
# BARE base letter that this map reads as a DIFFERENT PHONEME — `j` as ⟨ځ⟩ d͡z, `g` as ⟨ګ⟩ ɡ — silently, on a
# row that then passed every downstream check. The breve one also corrupted the dialect survey that motivated
# this whole tranche: it made a Southern ǧ read as a Northern bare g.
# ⚠ MAP HAS KEYS FOR BOTH (`ĵ`, `ğ`), WHICH IS EXACTLY WHY THIS IS EASY TO GET WRONG — the key looks handled
# while the mark that forms it is being stripped two lines earlier. Prosody marks are droppable; letter-forming
# marks are not, and the two are indistinguishable in a combining-character set.
COMBINING_DROP = {"́", "̀", "̪"}  # acute, grave, bridge — prosody/notation only

# Arabic letter → the IPA our engine emits, for the skeleton cross-check (guard 1).
SKEL = {
    "ب": "b", "پ": "p", "ت": "t̪", "ټ": "ʈ", "ث": "s", "ج": "d͡ʒ", "ځ": "d͡z", "چ": "t͡ʃ", "څ": "t͡s",
    "ح": "h", "خ": "x", "د": "d̪", "ډ": "ɖ", "ذ": "z", "ر": "r", "ړ": "ɻ", "ز": "z", "ژ": "ʒ", "ږ": "ʐ",
    "س": "s", "ش": "ʃ", "ښ": "ʂ", "ص": "s", "ض": "z", "ط": "t̪", "ظ": "z", "غ": "ɣ", "ف": "f", "ق": "q",
    "ک": "k", "ك": "k", "ګ": "ɡ", "گ": "ɡ", "ل": "l", "م": "m", "ن": "n", "ڼ": "ɳ", "ھ": "h",
}


ACUTE, GRAVE = "\u0301", "\u0300"


def clusters(s):
    """Split into (base, marks) CLUSTERS — a base character plus every combining mark that follows it.

    ⚠ CLUSTER-BASED, NOT A 1/2-CHARACTER LOOKAHEAD, and the difference is what makes stress recoverable. The
    marks on one base can stack: `ā́` is a + MACRON + ACUTE, i.e. a long vowel that is ALSO the stressed one.
    Scanning a fixed window cannot see that pair, so length and stress could not be read off the same vowel.
    Clustering also removes the normalization guesswork — the key is rebuilt from the base plus the marks that
    form a letter, and looked up once.
    """
    d = unicodedata.normalize("NFD", s)
    i = 0
    while i < len(d):
        j = i + 1
        while j < len(d) and unicodedata.combining(d[j]):
            j += 1
        yield d[i], d[i + 1:j]
        i = j


def to_ipa(rom, keep_stress=False):
    """One romanization → IPA, or None if a character is not in the map (an unmapped char means we do not
    understand the row, and a guessed reading is worse than a dropped one).

    `keep_stress` emits IPA ˈ before the vowel carrying the acute/grave, for the STRESS referee. The silver
    tranche does not use it: the miner compares under PS_FULL_FOLD, which strips stress, so carrying it there
    would only create spurious mismatches.
    """
    s = rom.strip()
    if not s or "=" in s or "<" in s:
        return None
    s = re.sub(r"^/|/$|^\[|\]$", "", s.strip())      # a minority are wrapped as true IPA
    s = s.replace("-", "").replace(".", "").replace("!", "").replace("`", "")
    s = s.replace("(", "").replace(")", "").replace("+", "").replace(",", "").replace(":", "")
    if not s or any(("\u0600" <= ch <= "\u06ff") for ch in s):
        return None                                   # untransliterated leftovers
    out = []
    for base, marks in clusters(s):
        # ⚠ AN UNRECOGNISED COMBINING MARK IS A LOUD DROP, NOT A SILENT PASS-THROUGH. The dump is a rolling
        # `latest`, so a future edit can introduce a mark neither set knows. Left to fall through it would fail
        # the lookup and drop the row as "unmapped" — indistinguishable from an ordinary unknown letter, which
        # is exactly how the circumflex bug hid. Counted separately so a new mark is visible.
        for mk in marks:
            if mk not in COMBINING_KEEP and mk not in COMBINING_DROP:
                return "?mark"
        if base.isspace():
            continue
        key = unicodedata.normalize("NFC", base + "".join(m for m in marks if m in COMBINING_KEEP))
        ipa = MAP.get(key) or MAP.get(key.lower())
        if ipa is None:
            return None
        if keep_stress and (ACUTE in marks or GRAVE in marks):
            out.append("\u02c8")
        out.append(ipa)
    return "".join(out) or None


def skeleton_ok(word, ipa):
    """Guard 1: every consonant the SPELLING demands must appear, in order, in the romanization's IPA.

    Deliberately one-directional and order-only — the romanization legitimately adds vowels the spelling
    lacks, and legitimately spells a doubled letter once. What it must not do is describe a different word,
    which is what the copy-paste blocks do (ټاپول carrying وگړپال's `wagar-pāl`)."""
    want = [SKEL[c] for c in word if c in SKEL]
    if len(want) < 2:
        return False                                   # too little signal to verify — drop rather than trust
    pos, hit = 0, 0
    for w in want:
        k = ipa.find(w, pos)
        if k >= 0:
            hit += 1
            pos = k + len(w)
    # ⚠ CEIL, NOT int(), AND NO max(2, …) FLOOR — that pair let the exact corruption this guard exists to catch
    # walk straight through. ټاپول (want ʈ p l) carrying وگړپال's `wagar-pāl` scored 2 of 3 consonants, and
    # int(0.75*3)=2 with a floor of 2 accepted it. A short word has to match ALL of its consonants; the 75%
    # tolerance is for long compounds, where the source legitimately writes a plain r for ⟨ړ⟩.
    return hit >= math.ceil(0.75 * len(want))


IPA_T = re.compile(r"\{\{\s*IPA\s*\|([^}|]*)")
rows, stress_rows, drops = [], [], {"no-value": 0, "unmapped": 0, "unknown-mark": 0, "skeleton": 0, "multiword": 0, "dup": 0}
seen = set()
for _, el in ET.iterparse(bz2.open(a.dump), events=("end",)):
    if not el.tag.endswith("}page"):
        continue
    title = (el.findtext("{*}title") or "").strip()
    text = el.findtext("{*}revision/{*}text") or ""
    el.clear()
    if ":" in title or not title:
        continue
    word = unicodedata.normalize("NFC", title)
    m = IPA_T.search(text)
    if not m:
        continue
    if " " in word:
        drops["multiword"] += 1
        continue                                       # phrasal entries: the miner keys on single words
    ipa = to_ipa(m.group(1))
    if ipa == "?mark":
        drops["unknown-mark"] += 1
        continue
    if ipa is None:
        drops["unmapped" if m.group(1).strip() else "no-value"] += 1
        continue
    if not skeleton_ok(word, ipa):
        drops["skeleton"] += 1
        continue
    if word in seen:
        drops["dup"] += 1
        continue
    seen.add(word)
    rows.append((word, "pus", ipa))
    # ── the STRESS referee, same guards plus two of its own ──────────────────────────────────────────
    # ⚠ EXACTLY ONE ACCENT. 17 values carry two — real compound stress (`arzán-báya`, `ánd-o-žwánd`) — and
    # which of the two is primary is a question this dump does not answer. Kept out rather than guessed at.
    # ⚠ AND IT MUST LAND ON A VOWEL. A handful sit on a consonant or a stray Greek iota, i.e. a typo.
    d = unicodedata.normalize("NFD", m.group(1))
    if d.count(ACUTE) + d.count(GRAVE) == 1:
        st = to_ipa(m.group(1), keep_stress=True)
        if st and st.count("\u02c8") == 1 and re.search(r"\u02c8[aeiouɑə]", st):
            stress_rows.append((word, st))

out = sys.stdout if a.out == "-" else open(a.out, "w", encoding="utf8")
for w, lang, ipa in rows:
    print(f"{w}\t{lang}\t{ipa}", file=out)
print(f"# ps.wiktionary → {len(rows)} silver rows  (dropped: "
      + ", ".join(f"{k} {v}" for k, v in drops.items() if v) + ")", file=sys.stderr)
if a.stress_out:
    with open(a.stress_out, "w", encoding="utf8") as f:
        print("# ps.wiktionary STRESS referee — undiacritized word ⇥ our IPA with ˈ before the stressed vowel.", file=f)
        print("# Source: the acute/grave in ps.wiktionary's {{IPA}} romanization. CC-BY-SA; see", file=f)
        print("# tools/perso-arabic/silver.pswikt-ps.PROVENANCE.md. Consumer: tools/pashto/eval_ps_stress.ts.", file=f)
        print("# ⚠ POSITION ONLY. The SEGMENTS here come from the same romanization map as the silver and are no", file=f)
        print("# better than it; what this file is evidence about is WHICH vowel carries the stress.", file=f)
        for w, st in stress_rows:
            print(f"{w}\t{st}", file=f)
    print(f"# stress referee → {len(stress_rows)} rows", file=sys.stderr)
