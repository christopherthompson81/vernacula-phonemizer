#!/usr/bin/env python3
"""
Restore the CASE and PUNCTUATION that FLEURS' normalization destroyed, into `read_text`.

⚠ THE CORPUS IS 100% CASE-FOLDED — 271,798 rows, all 102 languages — and we ingested the wrong column.
The FLEURS TSV carries BOTH: col2 is the raw transcript with case and punctuation, col3 the normalized
one we read. col2 is populated for every row of every language. See issue #871.

  col2 (raw) : Ambas as dúas, Letonia e Eslovaquia, atrasaron o proceso de adhesión á ACTA.
  col3 (norm): ambas as dúas letonia e eslovaquia atrasaron o proceso de adhesión á acta

⚠ NEITHER COLUMN IS A SUPERSET OF THE OTHER, which is why this MERGES rather than swaps. Raw has the
case and the punctuation. But the normalized column is not merely raw-lowercased — for some languages
it is a CORRECTED column, and taking raw wholesale is a regression:

  yo_ng  norm adds tone marks and sub-dot vowels raw lacks (`n`->`ń` x263, `è`->`ẹ`) and expands
         abbreviations (`nn`->`nǹkan`). Tone is LEXICALLY CONTRASTIVE in Yoruba, so raw would lose
         meaning. 715 rows.
  ig/ff/lg/so  norm MERGED WORDS by deleting parentheses without a space — `(1040 km)mu` -> `1040 kmmu`,
         `mayo(Saravati)` -> `mayosaravati`. Here raw is the correct one. 186 rows.

So: the normalized column supplies the word FORMS, raw supplies CASE and PUNCTUATION, and the result is
a super-text strictly better than either. Validated on all 198,412 cased-language rows: the merge
preserves the normalized column's content — diacritics included — in 100.00% of them.

⚠ THE VALIDITY CHECK MUST PRESERVE DIACRITICS. An earlier version compared with a `canon()` that
replaced combining marks with spaces, so it scored 98.9% "clean" while silently emitting DOUBLED marks
(`ǹ̀`, `jẹ́́`) — the check could not see the very thing Yoruba needed. `content()` below folds case and
strips punctuation and nothing else.

⚠ WHAT THIS BUYS, AND WHAT IT DOES NOT. Measured on a 2,156-row sample across 98 cased languages:
88.2% of rows change PROSODICALLY only (punctuation -> pauses) and 7.7% change SEGMENTALLY (casing and
restored periods: `ɹˈɑːv` -> `ˈɑːɹ ˈoᶷ vˈiː`, `el sr kostˈeʝo` -> `el seɲˈoɾ kostˈeʝo`). Against the
recognizers it is a WASH — 67 closer, 56 further, mean delta -0.00014 — because `notate(units(...))`
strips exactly the pauses this restores. ⚠ PREDICT NO QC MOVEMENT. The justification is TTS prosody and
segmental correctness, not distance; a null result is the instrument's blindness, not a failure.

It also obsoletes two hand-curated repair lists: `restoreInitialismCasing` (29 entries reconstructing
capitals) and `restoreAbbreviationDots` (reconstructing periods) both approximate this column.

  python3 restore_raw_text.py                 # report, write nothing (default)
  python3 restore_raw_text.py --apply
  python3 restore_raw_text.py --apply --langs yo_ng sr_rs
"""
from __future__ import annotations

import argparse
import difflib
import os
import re
import sqlite3
import sys
import unicodedata

ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
DB = f"{ROOT}/work/asr_align/align.sqlite"
TSV = f"{ROOT}/corpus/fleurs_transcripts/data"
SRC_TAG = "fleurs_raw"

PUNCT = r'[,.;:!?"‘’“”«»()\[\]{}—–…/]'
LEAD = re.compile(rf'^({PUNCT}*)(.*?)({PUNCT}*)$', re.S)
ZW = re.compile('[​‌‍­﻿]')

# ⚠ THE ALIGNMENT KEY NEEDS PER-LANGUAGE HELP, or the two columns look like different sentences and
#   every token falls to the `replace` branch — which carries no punctuation. Measured before this was
#   added: sr_rs kept 20.9% of its punctuation and emitted 648% of its capitals (a whole sentence
#   Title-Cased). These are the only systematic non-case/punct/diacritic differences in the corpus:
#   sr_rs raw is Cyrillic against a Latin normalized column, uz_uz writes `ko'ra` against `koʻra`,
#   km_kh carries ZWSP word separators the normalized column strips.
SR_CYR = {'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Ђ':'Đ','Е':'E','Ж':'Ž','З':'Z','И':'I','Ј':'J',
          'К':'K','Л':'L','Љ':'Lj','М':'M','Н':'N','Њ':'Nj','О':'O','П':'P','Р':'R','С':'S','Т':'T',
          'Ћ':'Ć','У':'U','Ф':'F','Х':'H','Ц':'C','Ч':'Č','Џ':'Dž','Ш':'Š'}
SR_CYR.update({k.lower(): v.lower() for k, v in SR_CYR.items()})
APOS = dict.fromkeys(map(ord, "'’‘ʻʼ`´"), "'")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def strip_diac(w: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", w.lower())
                   if unicodedata.category(c) != "Mn")


def align_key(w: str, lang: str) -> str:
    """Only for MATCHING the two columns — never for output."""
    w = re.sub(PUNCT, "", w)
    if lang == "sr_rs":
        w = "".join(SR_CYR.get(c, c) for c in w)
    return strip_diac(ZW.sub("", w.translate(APOS)))


def content(s: str) -> str:
    """Case-folded, punctuation-free, DIACRITICS PRESERVED — what the merge must not alter."""
    return re.sub(r"\s+", " ", re.sub(PUNCT, " ", nfc(s).lower())).strip()


def merge(raw: str, norm: str, lang: str) -> str:
    rtok, ntok = raw.split(), norm.split()
    sm = difflib.SequenceMatcher(None, [align_key(t, lang) for t in rtok],
                                 [align_key(t, lang) for t in ntok], autojunk=False)
    out: list[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for i, j in zip(range(i1, i2), range(j1, j2)):
                m = LEAD.match(rtok[i])
                lead, mid, trail = m.group(1), m.group(2), m.group(3)
                # ⚠ RAW SUPPLIES THE PUNCTUATION, so norm's own must come off or it doubles. The
                #   normalized column is NOT uniformly punctuation-free — where it kept a final period,
                #   `cunami.` merged to `cunami..`, and bs_ba/hr_hr/oc_fr came out with 110-113% of raw's
                #   punctuation, i.e. spurious pauses in the very thing this restores.
                nt = LEAD.match(nfc(ntok[j])).group(2) or nfc(ntok[j])
                # ⚠ TAKE RAW'S WHOLE TOKEN WHEN THE TWO DIFFER ONLY IN CASE, or INTERNAL capitals are
                #   lost. Restoring just the first letter destroyed the Nguni concord acronyms this is
                #   supposed to recover: zu_za `iHK` (class prefix + initialism) merged to `ihk`, which
                #   the engine then reads as a word (`ˈiːhkʼ`) instead of spelling it (`iɛjˈiːt͡ʃʼi kʰˈɛːji`)
                #   — the exact repair `restoreNguniConcordAcronyms` exists for, undone by the restorer.
                #   Only when the tokens differ by MORE than case does norm win, which is the yo_ng case
                #   (raw `n` vs norm `ń`): there raw has no case to lose.
                if mid.lower() == nt.lower():
                    w = mid
                else:
                    w = nt
                    if mid[:1].isupper():
                        w = w[:1].upper() + w[1:]
                out.append(lead + w + trail)
        elif tag in ("replace", "insert"):
            # ⚠ CAPITALISE ONLY THE FIRST TOKEN OF A REPLACED RUN. Applying the run's leading capital to
            #   every token Title-Cased whole sentences (sr_rs emitted 648% of raw's capitals).
            for k, j in enumerate(range(j1, j2)):
                w = nfc(ntok[j])
                if k == 0 and tag == "replace" and i1 < i2 and LEAD.match(rtok[i1]).group(2)[:1].isupper():
                    w = w[:1].upper() + w[1:]
                out.append(w)
        # `delete`: raw has a token the normalized column dropped. Norm is the corrected column, so the
        # drop is deliberate (an expanded abbreviation, a removed artifact) and we follow it.
    return " ".join(out)


def rows_for(lang: str) -> dict[str, tuple[str, str]]:
    path = f"{TSV}/{lang}/train.tsv"
    out: dict[str, tuple[str, str]] = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) >= 4 and c[2].strip() and c[3].strip():
                out.setdefault(c[1], (c[2], c[3]))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--apply", action="store_true", help="write; otherwise report only")
    a = ap.parse_args()

    db = sqlite3.connect(a.db)
    langs = a.langs or [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]
    tot = wrote = hand = same = rejected = nofile = 0
    for lang in langs:
        src = rows_for(lang)
        if not src:
            nofile += 1
            continue
        upd = []
        for wav, cur, rsrc in db.execute(
                "SELECT wav, COALESCE(read_text,''), COALESCE(read_text_src,'') FROM utt WHERE lang=?",
                (lang,)):
            tot += 1
            # ⚠ A HAND ROW IS THE READER'S OWN WORDS AND OUTRANKS THE TRANSCRIPT ENTIRELY.
            if rsrc == "hand":
                hand += 1
                continue
            if wav not in src:
                continue
            raw, norm = src[wav]
            m = merge(raw, norm, lang)
            if content(m) != content(norm):
                rejected += 1          # ⚠ never write a merge that altered the corrected content
                continue
            if m == cur:
                same += 1
                continue
            upd.append((m, SRC_TAG, lang, wav))
        if a.apply and upd:
            db.executemany("UPDATE utt SET read_text=?, read_text_src=?, ipa=NULL "
                           "WHERE lang=? AND wav=?", upd)
            db.commit()
        wrote += len(upd)
        if upd:
            print(f"  {lang:14} {len(upd):5} rows")
    print(f"\n{'wrote' if a.apply else 'would write'} {wrote} rows "
          f"({tot} seen, {hand} hand left alone, {same} already current, {rejected} rejected"
          + (f", {nofile} languages with no TSV" if nofile else "") + ")")
    if a.apply:
        print("\n⚠ `ipa` was CLEARED on every row written — they are excluded from scoring until\n"
              "   re-derived. Finish with:\n"
              "     python3 read_text.py --export-pending /tmp/p.tsv\n"
              "     npx tsx rederive_read_text.mts /tmp/p.tsv /tmp/d.tsv\n"
              "     python3 read_text.py --import-ipa /tmp/d.tsv --overwrite")
    else:
        print("   (report-only is the default; pass --apply to write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
