#!/usr/bin/env python3
"""
Score our IPA against what the reader actually said, and split the corpus into "leave it alone" and
"investigate".

Reads the table `asr_align_corpus.py` wrote (text · our IPA · recognized phones) and labels every
utterance. The output is a worklist, not a verdict: a mismatch is one of at least three things, and the
report deliberately does not pretend to tell them apart —

  1. READER DIVERGENCE — the transcript is the script the reader was given, not what they said (Run 31).
  2. OUR BUG — the phonemization is wrong, which is what we are hunting.
  3. RECOGNIZER ARTEFACT — wav2vec2 has its own inventory and its own error rate.

⚠ CATEGORY 3 HAS A DEGENERATE MODE THAT MUST BE SPLIT OFF FIRST, or it owns the whole worklist. On some
utterances the recognizer returns almost nothing — a full Welsh sentence came back as the single phone
`k`. Those score a distance near 1.0 and would fill the investigate queue with cases that say nothing
about our IPA. They are classified `recognizer_short` by a length ratio and reported separately, since a
cluster of them in one language is itself a finding (bad audio, or a language the model cannot handle).

⚠ SCORING IS RELATIVE TO EACH LANGUAGE, NEVER ABSOLUTE. The recognizer is an espeak-flavoured multilingual
model: it is systematically closer to some languages than others, and its inventory does not match ours
(we write t̬, ᶦ-offglides, tone letters; it writes ɾ, eɪ, none). An absolute distance threshold would
therefore rank LANGUAGES by how well the recognizer knows them, not utterances by how wrong they are. So
every utterance is scored against its OWN language's median, and what gets flagged is the tail.

Comparison is on a FOLDED phone string — stress, tone, length and the diacritics neither side agrees on
are stripped — because those are exactly where two IPA conventions disagree without either being wrong.

Usage:
  python3 asr_align_report.py                    # all languages present in the db
  python3 asr_align_report.py --langs en_us
  python3 asr_align_report.py --top 40           # investigate-queue size per language
"""
from __future__ import annotations

import argparse
import os
import re
import sqlite3
import statistics
import sys
import unicodedata
from difflib import SequenceMatcher

# Corpus root. Defaults to the tree these tools were written against; override with ASR_ALIGN_ROOT
# so the tooling is not a statement about one machine.
ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
DB = f"{ROOT}/work/asr_align/align.sqlite"
OUT = f"{ROOT}/work/asr_align"

# Marks the two sides do not agree on, and which do not decide whether a word was READ correctly.
STRIP = set("ˈˌːˑ˥˦˧˨˩꜀꜁꜂꜃꜄꜅꜆꜇ꜛꜜ|‖")
# Punctuation is prosody in our stream (deliberate) but the recognizer never emits it, so it must not
# count as a difference.
PUNCT = set(",.!?;:()[]{}\"'«»„“”‘’—–")


# ⚠ THE SUPERSCRIPT OFFGLIDES ARE VOWELS, NOT MODIFIERS — where the recognizer hears them (#1261). `ᶦ ᶷ ⁱ ᵘ ᶤ`
# are category Lm like `ʲ ˠ ʰ`, but they are the engine's offglide of a closing diphthong (eᶦ aᶷ, Mandarin
# aⁱ, Welsh eᶤ), and the recognizer writes that segment — as `ɪ`/`ʊ`/`i` — so dropping them scored a deletion
# that was never there: every English closing diphthong, one phone short, a fixed 0.02 on en_us's median.
#
# ⚠ BUT NOT EVERYWHERE, and the table below is the measurement, not a linguistic judgement. Measured per
# (language, letter) over all 163,166 aligned rows that carry one, expanding ONLY that cell: the recognizer
# hears the segment where the diphthong is the LANGUAGE'S OWN (en 2363 rows closer / 75 further for ᶦ; cy,
# ta, cmn's aⁱ 2917/148, the Bantu ai/au of ny sn xh zu), and does NOT where our ᶦ/ᶷ sit in an English
# loan read by the English arm inside a non-Latin host — am, ar, bg, bn, fa, he, hi, ja, kk, km, ko, th,
# vi write `ebay` and `craigslist` as monophthongs (`eː`), so expanding adds a phone with no counterpart.
# Two letters mean different things in different engines: `ⁱ` is Mandarin's offglide (expand) and Irish's
# slender-consonant colouring (97/1869 — keep dropping); Czech ⟨ou⟩ comes back as ONE vowel (111/1346).
# And the back glide is absorbed more readily than the front one: cy, ta, gl, mi, xh expand ᶦ and not ᶷ.
#
# A cell is listed when n ≥ 20, the language's MEDIAN does not get worse with only that cell expanded, and
# more rows move closer than further — `ɀ`'s criterion, applied per language because the fact is per
# language. Everything else keeps today's behaviour. Targets are what the recognizer writes there, not the
# letter's nominal value: Welsh ᶤ comes back as ɪ (470 of 741; ɨ 22) and Hausa's ᵘ would be ʊ, not u.
# Full tables in docs/asr_align_offglide_fold_investigation.md, Runs 2–5.
#
# ⚠ OUR SIDE ONLY, by construction: the recognizer never emits these letters, so `fold(phones, lang)` is
# unchanged. Callers that do not know the language get the old fold, which is the drop — never a guess.
OFFGLIDE: dict[str, dict[str, str]] = {
    "en_us": {"ᶦ": "ɪ", "ᶷ": "ʊ"},       # 0.1795 → 0.1561
    "en_gb": {"ᶦ": "ɪ", "ᶷ": "ʊ"},       # 0.2048 → 0.1826   (#1252's notation, #1258's 0.026)
    "cy_gb": {"ᶦ": "ɪ", "ᶤ": "ɪ"},       # 0.2697 → 0.2578   ᶷ 634/1129 — not heard
    "cmn_hans_cn": {"ⁱ": "i"},           # 0.2886 → 0.2690   ᵘ 51/2981, ᶦ 1/146 — not heard
    "ta_in": {"ᶦ": "ɪ"},                 # 0.5510 → 0.5348   flags 48 → 68: the tail was hidden
    "es_419": {"ᶦ": "ɪ", "ᶷ": "ʊ"},
    "gl_es": {"ᶦ": "ɪ"},                 # ᶷ 211/1047 — not heard
    "mi_nz": {"ᶦ": "ɪ"},
    "ny_mw": {"ᶦ": "ɪ", "ᶷ": "ʊ"},
    "sn_zw": {"ᶦ": "ɪ", "ᶷ": "ʊ"},
    "xh_za": {"ᶦ": "ɪ"},
    "zu_za": {"ᶦ": "ɪ"},                 # ᶷ 105/89 but the median moves up — kept dropping
    "ru_ru": {"ᶦ": "ɪ"},                 # 41/39 — at the line, listed by the rule
    "mk_mk": {"ᶦ": "ɪ"},                 # 14/13 — same
}


def fold(ipa: str, lang: str | None = None) -> list[str]:
    """IPA string → comparable phone units: the segmental backbone both sides can be judged on.

    `lang` is the DB language key (`en_us`); with it, the offglides in `OFFGLIDE[lang]` are expanded to the
    vowel the recognizer writes for them BEFORE the modifier-letter strip below. Without it they are dropped.

    ⚠ MODIFIER LETTERS MUST GO TOO, and missing that silently broke two whole languages. `ˠ ʲ ʰ ʷ ᶦ` are
    Unicode category **Lm** with combining class 0, so a `unicodedata.combining()` test keeps them and each
    counts as its own phone. Irish marks velarisation/palatalisation on nearly every consonant (n̪ˠ, sˠ,
    ɾʲ), so its IPA carried about twice the recognizer's phone count and every Irish utterance scored ~0.4
    before correctness entered into it — ga_ie's minimum over 2,845 utterances was 0.371 and its
    "investigate" list came out EMPTY, because when everything is uniformly bad nothing looks like an
    outlier. English `ᶦ`-offglides had the same problem in miniature.

    The recognizer emits none of these marks, so they cannot inform the comparison in either direction —
    ⚠ except the offglide letters, which are vowels; see `OFFGLIDE` above for where that is measured true."""
    if lang is not None:
        for k, v in OFFGLIDE.get(lang, {}).items():
            ipa = ipa.replace(k, v)
    out: list[str] = []
    for ch in unicodedata.normalize("NFD", ipa):
        if ch in STRIP or ch in PUNCT or ch.isspace():
            continue
        if unicodedata.combining(ch) or unicodedata.category(ch) in ("Lm", "Sk"):
            continue
        # ⚠ AND THE RECOGNIZER'S TONE DIGITS. It writes tone as a trailing number (`siɛ5`, `ŋo5`, `konɡ5`)
        # where we write tone letters (˥˦˧˨˩), which STRIP already removes. Keeping the digits made the
        # comparison asymmetric — we dropped our tone, it kept its own — and every tonal utterance carried
        # a fixed penalty for it. vi_vn's median was 0.611 with an EMPTY investigate list, the same
        # everything-is-uniformly-bad degeneracy the modifier letters caused for Irish.
        if ch.isdigit():
            continue
        out.append(ch)
    return out


# ⚠ EVERY COUNT IN THIS BLOCK IS ON `fold()` OUTPUT, NOT ON THE RAW COLUMN, and the difference has already
# cost one wrong conclusion. `fold()` NFD-normalises and strips combining marks, so the recognizer's `ç`
# (12,288 of them) arrives here as plain `c`. Counting `c` in the raw `phones` column returns ZERO and makes
# it look like a textbook candidate; it is not, which is what the `c` note below says. Count what `coarsen`
# actually sees, since that is the unit the fold operates on.
#
# ⚠ THE RECOGNIZER'S INVENTORY, FOLDED — applied to BOTH sides, and ONLY inside the distance. Measured over
# all 221,469 aligned utterances: 30 phones that we emit at least 2,000 times each are returned by the
# recognizer less than 1% as often, and they account for 902,870 tokens = 3.67% of everything we write.
# (`ɒ`, `ɜ` and `ɀ` were added later on the same criterion and are not in that 30 or that token count.) It is
# not noise and it is not our error — `facebook/wav2vec2-xlsr-53-espeak-cv-ft` simply has no symbol for them:
#
#     ʋ 158956/0    ɫ 90312/0    ɦ 76815/0    ʈ 66306/0    ʂ 46938/0    ɖ 41067/0
#     ɳ 38765/0     ɓ 33146/0    ɗ 23654/0    ʄ 3962/0     ɽ 5120/0     clicks 11344/0
#
# Left unfolded, a language dense in these carries a fixed penalty that carries no information in either
# direction — the comparison is simply blind there, so the distance measures our inventory rather than our
# correctness. Folding is worth it for that reason alone: measured across 84 languages the median went
# 0.366 -> 0.349 and NOT ONE got worse.
#
# ⚠ IT IS NOT ABOUT RESCUING A LANGUAGE FROM A HIGH MEDIAN, and reading it that way sent me down a wrong
# path. km_kh's 0.480 median looked like the ga_ie/vi_vn degeneracy; it is not. Its MAD is normal (0.056)
# and it flags 3.7% of its utterances, MORE than gl_es at 2.8% or ta_in at 2.0%. The score is relative to
# each language's own distribution by design, so a language this recognizer finds hard is already absorbed.
# This is a coarse detector of SERIOUS disagreement, not a way to realign vowels.
#
# ⚠ REUSED FROM consonant_skeleton.py RATHER THAN RESTATED. That map was validated empirically (5.4:1 against
# 3.5:1 for the unfolded distance), and two definitions of "phones this recognizer cannot distinguish" would
# drift apart.
#
# ⚠ ʔ IS DELIBERATELY NOT IN IT, though the recognizer hears it barely better (737 against our 120,940). The
# skeleton work already ran that experiment: dropping ʔ scored 1.8:1 against 4.6:1 for keeping it, because the
# single biggest defect this corpus ever had was Kazakh ⟨ь⟩/⟨ъ⟩ emitting a spurious glottal stop in 408 rows.
# Folding it away would delete the evidence for that class of fix. The fixed penalty is the lesser cost.
#
# ⚠ AND `c` IS NOT IN IT EITHER, though Khmer made it look unhearable (ours 1731, rec 10 there). Corpus-wide
# the recognizer writes `c` 10,292 times against our 49,987 — a fifth, not a hundredth. ⚠ THOSE ARE FOLDED
# COUNTS: the recognizer spells it `ç`, so a raw-column count says zero and re-opens this decision wrongly. It is emitted, `tʃ`/`dʒ`
# are contrastive in many of these languages, and folding c→tʃ globally would destroy a distinction the
# recognizer does make. Generalising from one language was the error; the DB-wide count is the check.
# ⚠ `ɒ` WAS MISSING AND MET THE CRITERION OUTRIGHT: we write it 52,582 times and the recognizer writes it
# ZERO times in all 270,106 utterances — not "under 1%", none. Only three languages emit it (hu_hu 31,974,
# uz_uz 17,749, da_dk 2,859) and for the first two it is the plain ⟨a⟩/⟨o⟩ vowel, so a third of every
# Hungarian utterance was scored against a symbol the recognizer cannot produce. It substitutes ɔ more
# often than anything else, and mapping there beats a, o and ɑ for ALL THREE languages:
#
#     median      hu_hu    uz_uz    da_dk
#     current    0.3117   0.3394   0.5258
#     ɒ -> ɔ     0.2810   0.3134   0.5167      <- best for each, none worse
#     ɒ -> a     0.2897   0.3369   0.5258
#     ɒ -> o     0.2984   0.3168   0.5243
#
# ⚠ NO OTHER LANGUAGE CAN BE AFFECTED, and that is provable rather than swept: coarsen applies to both
# sides, and the recognizer's ɒ count is 0, so the map is unreachable outside these three.
#
# ⚠ IT DOES COST DANISH ONE THING. da_dk emits both ɒ (2,859) and ɔ (2,897), so folding merges a contrast
# it makes: a Danish row writing ɒ where ɔ belongs currently scores as a miss and afterwards will not. That
# is the ʔ argument from below pointing the other way, and it is accepted here because the recognizer has
# no ɒ at all — the comparison was never able to judge the symbol, only to penalise it — and because da_dk
# still improves. Recorded so the loss is not discovered later as a surprise.
# ⚠ `ɜ` RUNS THE OTHER WAY: a phone WE have no symbol for, mapped onto what we write instead. The map's
# stated purpose is our-side-unhearable phones, but the penalty is symmetric — the recognizer writes `ɜ`
# 31,657 times and the fleet writes it ZERO times, so every one was an unavoidable miss. It lands mostly on
# our `ɐ` (5,345) and `ə` (2,801), and `ɐ` is the better target by measurement: swept over all 87 languages
# whose recognizer output contains `ɜ`, **4 improved, 83 unchanged, 0 worse** (de_de 0.1789 → 0.1660,
# da_dk 0.5167 → 0.5075). `ɜ → ə` was tried and makes da_dk worse; `ɜ → ɛ` makes da_dk and th_th worse.
#
# ⚠ AND IT MERGES NOTHING ON OUR SIDE, unlike `ɒ` below — no language in the fleet emits `ɜ`, so there is
# no contrast to lose and no language-specific cost to record.
COARSEN = {
    "ɜ": "ɐ",
    "ɒ": "ɔ",
    "ʋ": "v", "ɦ": "h", "ɫ": "l", "ʈ": "t", "ʂ": "s", "ɖ": "d", "ɳ": "n", "ɽ": "r",
    "ɓ": "b", "ɗ": "d", "ʄ": "j", "ɠ": "ɡ", "ᶑ": "d", "χ": "x", "ʑ": "ʒ", "ɸ": "f",
    "ʝ": "ʃ", "ɴ": "n", "ɻ": "r", "ɮ": "l",
    # ⚠ `ɀ` IS SHONA'S WHISTLED SIBILANT AND THE RECOGNIZER HAS NO SYMBOL FOR IT: we write it 4,394 times
    # (sn_zw ONLY — 1,643 rows) and it comes back ZERO times in all 270,106 utterances. Same criterion `ɒ`
    # met. Target chosen by measurement, not by shape:
    #
    #     ɀ -> ʒ    median 0.2157 -> 0.2000   1215 closer /    6 further   <- taken
    #     ɀ -> z              -> 0.2127        460 closer /   33 further
    #     ɀ -> s              -> 0.2143        291 closer /   46 further
    #     ɀ -> v              -> 0.2157         41 closer /   12 further
    #     ɀ -> zw             -> 0.2212        296 closer / 1345 further
    #
    # ⚠ NO OTHER LANGUAGE CAN BE AFFECTED, provably: only sn_zw emits it and the recognizer's count is 0.
    # ⚠ IT DOES MERGE A CONTRAST, the same cost `ɒ` records for Danish. Shona emits both `ɀ` (4,394) and
    # `ʒ` (821), so a row writing one where the other belongs now scores as a hit. Accepted on the same
    # grounds: with the recognizer's count at zero the comparison was never able to JUDGE the symbol, only
    # to penalise it. Recorded so the loss is not discovered later as a surprise.
    "ɀ": "ʒ",
    # clicks: our IPA writes them as k+click (kǀ, kǁ, kǃ), so the k already carries the position and
    # the click letter itself has no counterpart at all — it is removed rather than mapped.
    "ǀ": "", "ǁ": "", "ǃ": "", "ǂ": "",
}



def coarsen(units: list[str]) -> list[str]:
    """Map the phones this recognizer has no symbol for onto the ones it writes instead. Both sides."""
    out: list[str] = []
    for u in units:
        v = COARSEN.get(u, u)
        if v:
            out.append(v)
    return out


def dist(a: list[str], b: list[str]) -> float:
    a, b = coarsen(a), coarsen(b)
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    return 1.0 - SequenceMatcher(None, a, b, autojunk=False).ratio()


def selftest() -> int:
    """The `OFFGLIDE` invariants, with no DB — the same convention as `asr_align_allo.py --selftest`."""
    bad: list[str] = []
    LM = {"ᶦ", "ᶷ", "ⁱ", "ᵘ", "ᶤ"}
    for lang, m in OFFGLIDE.items():
        for k, v in m.items():
            if k not in LM:
                bad.append(f"{lang}: {k!r} is not an offglide letter")
            if unicodedata.category(k) != "Lm":
                bad.append(f"{lang}: {k!r} is not Lm — the strip below would not have dropped it")
            if len(v) != 1 or unicodedata.category(v) != "Ll":
                bad.append(f"{lang}: target {v!r} must be one plain vowel letter")
    # Our side expands; the recognizer's side never carried the letter, so it must be untouched.
    if fold("eᶦ", "en_us") != ["e", "ɪ"] or fold("eᶦ") != ["e"] or fold("eᶦ", "am_et") != ["e"]:
        bad.append("fold(): expansion must be per language, and the drop must stay the default")
    if fold("eɪ", "en_us") != fold("eɪ"):
        bad.append("fold(): a recognizer string must fold the same with and without lang")
    for b in bad:
        print(b, file=sys.stderr)
    print(f"selftest: {len(OFFGLIDE)} languages, {sum(len(m) for m in OFFGLIDE.values())} cells, "
          f"{'FAIL' if bad else 'ok'}", file=sys.stderr)
    return 1 if bad else 0


def main() -> None:
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--top", type=int, default=30, help="investigate rows kept per language")
    ap.add_argument("--with-exonerated", action="store_true",
                    help="keep rows a same-text sibling exonerates (they are dropped from the queue "
                         "by default; see the sibling screen below)")
    a = ap.parse_args()

    db = sqlite3.connect(f"file:{a.db}?mode=ro", uri=True)
    langs = a.langs or [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]
    os.makedirs(a.out, exist_ok=True)

    summary = []
    queue_path = f"{a.out}/investigate.tsv"
    short_path = f"{a.out}/recognizer_short.tsv"
    with open(queue_path, "w", encoding="utf8") as q, open(short_path, "w", encoding="utf8") as sh:
        q.write("lang\tsentence_id\twav\tz\tdist\tmedian\tsibling\ttext\tipa\tphones\n")
        sh.write("lang\tsentence_id\twav\tn_ipa\tn_heard\ttext\tphones\n")
        for lang in langs:
            rows = list(db.execute(
                "SELECT sentence_id,wav,text,ipa,phones FROM utt "
                "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL AND phones!=''", (lang,)))
            if len(rows) < 20:
                print(f"{lang}: {len(rows)} usable rows, skipped", file=sys.stderr)
                continue
            scored, short = [], []
            for sid, wav, txt, ipa, ph in rows:
                fi, fp = fold(ipa, lang), fold(ph, lang)
                # The recognizer produced far too little to be compared with. 0.35 is well below any
                # convention difference: two IPA transcriptions of the same utterance do not differ
                # threefold in phone count.
                if len(fi) >= 12 and len(fp) < 0.35 * len(fi):
                    short.append((sid, wav, txt, ipa, ph, len(fi), len(fp)))
                    continue
                scored.append((dist(fi, fp), sid, wav, txt, ipa, ph))
            if len(scored) < 20:
                print(f"{lang}: only {len(scored)} comparable rows, skipped", file=sys.stderr)
                continue
            ds = [s[0] for s in scored]
            med = statistics.median(ds)
            # MAD, not stdev: the tail we are hunting is exactly what would inflate stdev and hide itself.
            mad = statistics.median([abs(d - med) for d in ds]) or 1e-9
            # ⚠ THE SIBLING SCREEN, AND IT REMOVES 77% OF THIS QUEUE. FLEURS records the same sentence
            # more than once with different readers, and our IPA for a sentence is a pure function of its
            # text — those recordings are scored against a BYTE-IDENTICAL string. So when one of them
            # lands inside the bulk and another in the tail, the difference cannot be the IPA. It is the
            # reader, the audio, or the recognizer. That is a construction, not a judgement call, and it
            # is the only thing in this harness that can say "not ours" with certainty.
            #
            # Corpus-wide: 6,442 of 8,367 flagged rows have a same-text sibling inside the bulk. Two
            # recordings of one sentence, one identical IPA string, differ by as much as 0.73 — bigger
            # than most of the signal the unscreened queue was carrying.
            #
            # ⚠ AND IT IS WHY THE PER-LANGUAGE TOTALS MISLED. bn_in led at 12.7% of its split, and 379 of
            # its 382 flags are one gender against 0.33% for the other. hu_hu settles it: its female
            # median distance is BETTER than its male (0.303 vs 0.342) and female rows still supply 293 of
            # its 313 flags. A phonemizer does not know who read the sentence.
            #
            # ⚠ The identical-IPA check is not ceremonial. The whole argument rests on it, and a
            # re-phonemization landing mid-round would break it without changing any count.
            by_sentence: dict[str, list[tuple[float, str]]] = {}
            for d, sid, wav, _t, ipa, _p in scored:
                by_sentence.setdefault(sid, []).append((d, ipa or ""))
            def screen(d: float, sid: str) -> str:
                sibs = by_sentence.get(sid, ())
                if len(sibs) < 2 or len({i for _, i in sibs}) != 1:
                    return "no-sibling"
                if any(0.6745 * (sd - med) / mad <= 3.0 for sd, _ in sibs):
                    return "exonerated"
                return "all-flagged"

            scored.sort(key=lambda s: -s[0])
            # ⚠ SCREEN THE TAIL ONLY. A row inside the bulk is its own exonerating sibling, so screening
            # everything would drop bulk rows from the queue for a reason that says nothing — and the
            # top-N cut reaches into the bulk in the quiet languages.
            marked = [(d, sid, wav, txt, ipa, ph,
                       screen(d, sid) if 0.6745 * (d - med) / mad > 3.0 else "")
                      for d, sid, wav, txt, ipa, ph in scored]
            keep = marked if a.with_exonerated else [r for r in marked if r[6] != "exonerated"]
            worst = keep[: a.top]
            for d, sid, wav, txt, ipa, ph, sib in worst:
                z = 0.6745 * (d - med) / mad
                q.write(f"{lang}\t{sid}\t{wav}\t{z:.2f}\t{d:.3f}\t{med:.3f}\t{sib}\t"
                        f"{(txt or '')[:160]}\t{(ipa or '')[:160]}\t{(ph or '')[:160]}\n")
            dropped = sum(1 for r in marked if r[6] == "exonerated")
            # "Good" = within the bulk of this language's own distribution.
            good = sum(1 for d in ds if 0.6745 * (d - med) / mad <= 3.0)
            summary.append((lang, len(rows), len(short), med, statistics.mean(ds), good,
                            len(scored) - good))
            for sid, wav, txt, ipa, ph, ni, np in short:
                sh.write(f"{lang}\t{sid}\t{wav}\t{ni}\t{np}\t{(txt or '')[:120]}\t{(ph or '')[:80]}\n")
            print(f"{lang:<14} n={len(rows):<5} short={len(short):<4} median={med:.3f} "
                  f"within-3MAD={good} ({100*good/len(scored):.1f}%)  investigate={len(scored)-good}"
                  f"  sibling-exonerated={dropped}", file=sys.stderr)

    with open(f"{a.out}/summary.tsv", "w", encoding="utf8") as f:
        f.write("lang\tn\trecognizer_short\tmedian_dist\tmean_dist\twithin_3mad\tinvestigate\n")
        for lang, n, nsh, med, mean, good, tail in sorted(summary, key=lambda r: r[3]):
            f.write(f"{lang}\t{n}\t{nsh}\t{med:.4f}\t{mean:.4f}\t{good}\t{tail}\n")

    tot = sum(r[1] for r in summary)
    good = sum(r[5] for r in summary)
    print(f"\n{tot} utterances scored; {good} ({100*good/max(tot,1):.1f}%) inside their language's bulk, "
          f"{tot-good} in the tail", file=sys.stderr)
    print(f"wrote {a.out}/summary.tsv, {queue_path}, {short_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
