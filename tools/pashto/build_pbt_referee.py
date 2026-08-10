#!/usr/bin/env python3
"""Filter an aggregated `pus` referee down to its SOUTHERN (pbt / Kandahari) slice.

WHY. ISO 639-3 `pus` is a MACROLANGUAGE — members pbt (Southern/Kandahari), pbu (Northern/Peshawar), pst
(Central/Waziri) — and every machine-readable Pashto pronunciation source is aggregated over it: wikipron
`pus`, kaikki `pus`, and espeak-ng's ps_list (measured: for the 2,605 words with exactly one ښ it writes ʃ
54.7% / ʂ 29.6% / x 21.7%). Our engine is a coherent SINGLE variety — `pashto.ts` declares "Dialect: ښ/ږ =
Kandahari retroflex ʂ/ʐ" — so grading it on the umbrella marks a correct Southern reading wrong wherever the
aggregate happens to carry only a Northern one. Measured on wikipron: of 242 words spelled with ښ/ږ, 129
(53%) list a non-Kandahari reflex and NO ʂ/ʐ at all.

⚠ THE FILTER LOOKS ONLY AT THE TWO DIALECT-DIAGNOSTIC LETTERS, AND THAT GUARD IS THE WHOLE POINT. It would be
trivial — and worthless — to "improve" a score by dropping the words the engine gets wrong. So:

  · a word with NO ښ and NO ږ is KEPT UNCONDITIONALLY, whatever the engine does with it;
  · a word WITH one is kept only if some listed variant realizes it as ʂ/ʐ, i.e. the entry contains a
    Southern answer at all. Nothing else about the word is consulted — not the vowels, not the other
    consonants, not our output.

So the filter cannot select for general engine agreement; it selects for VARIETY. What it removes is entries
that answer a question we did not ask. Same criterion the existing `ps.kaikki-kandahari.tsv` applies by hand,
mechanised and extended to the primary.

  python3 build_pbt_referee.py <in.tsv> <out.tsv>
"""
import re
import sys

# ⚠ THE TEST IS THE EVAL'S OWN FOLD, NOT A LITERAL ʂ/ʐ MATCH — and getting this wrong the first time dropped
# 166 entries the engine could already score. `tools/referee-eval/langs/ps.jsonc` folds [ʂç]→ʃ and ʐ→ʒ, so the
# Kandahari ʂ, the Central ç and a plain ʃ are ALREADY one class to the grader; the variation the fold cannot
# absorb is the NORTHERN x (ښ) and ɡ/ʝ (ږ), because folding those would merge خ and ګ — real phoneme contrasts.
# So "not Southern" means specifically "realizes the letter the Northern way", not "isn't spelled ʂ/ʐ".
NORTHERN_SHEEN = re.compile(r"x")          # ښ read as Northern x (خ stays distinct, hence unfoldable)
NORTHERN_ZHEEN = re.compile(r"[ɡgʝ]")      # ږ read as Northern ɡ / Central ʝ
SOUTHERN_SHEEN = re.compile(r"[ʂçʃ]")      # the fold's ʃ class
SOUTHERN_ZHEEN = re.compile(r"[ʐʒ]")       # the fold's ʒ class
DIAG = re.compile(r"[ښږ]")

src, dst = sys.argv[1], sys.argv[2]
kept, dropped_variety, rows_out = 0, 0, []
for line in open(src, encoding="utf8"):
    if line.startswith("#") or "\t" not in line:
        continue
    parts = line.rstrip("\n").split("\t")
    word, variants = parts[0].strip(), [p.strip() for p in parts[1:] if p.strip()]
    if not word or not variants:
        continue
    if not DIAG.search(word):
        kept += 1
        rows_out.append((word, variants))
        continue
    # a variant is variety-compatible when it realizes each diagnostic letter the word contains in the
    # fold-class our engine emits. A word may contain both letters; both must be compatible.
    def compatible(v):
        if "ښ" in word and not SOUTHERN_SHEEN.search(v):
            return False
        if "ږ" in word and not SOUTHERN_ZHEEN.search(v):
            return False
        return True
    southern = [v for v in variants if compatible(v)]
    if southern:
        kept += 1
        # keep ONLY the Southern variants, so a Northern reading cannot silently credit the engine either
        rows_out.append((word, southern))
    else:
        dropped_variety += 1

with open(dst, "w", encoding="utf8") as f:
    print(f"# {dst.rsplit('/', 1)[-1]} — the SOUTHERN (pbt / Kandahari) slice of {src.rsplit('/', 1)[-1]}.",
          file=f)
    print("# ISO 639-3 `pus` is a macrolanguage (pbt Southern / pbu Northern / pst Central) and every source we"
          " have is aggregated over it; this engine is single-variety (ښ/ږ = ʂ/ʐ).", file=f)
    print("# Built by tools/pashto/build_pbt_referee.py. Words WITHOUT ښ/ږ are kept unconditionally; words with"
          " one are kept only where a Southern variant exists, and only that variant is retained.", file=f)
    print(f"# kept {kept} · dropped {dropped_variety} entries that carry no Southern reading at all.", file=f)
    for w, vs in rows_out:
        print("\t".join([w, *vs]), file=f)
print(f"{dst}: kept {kept} · dropped {dropped_variety} (no Southern reading)", file=sys.stderr)
