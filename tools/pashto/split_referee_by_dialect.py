#!/usr/bin/env python3
"""Split an aggregated Pashto (`pus`) referee into its VARIETY slices — pbt / pbu / pst.

WHY. ISO 639-3 `pus` is a macrolanguage and every machine-readable Pashto pronunciation source is aggregated
over it (wikipron pus, kaikki pus, espeak-ng's ps_list). An engine implements ONE variety, so grading it on
the umbrella is apples-to-oranges: the same headword carries readings from different varieties, sometimes in
the same entry — `اوږه` has TEN, and `زموږ` appears as both `zmuʝ` and `zəmunɡ`.

THE DIAGNOSTIC IS THE ښ/ږ ISOGLOSS, and only that. These are the two letters whose reflex separates the
varieties (MacKenzie's ṣ̌/ẓ̌, A Standard Pashto 1959), and they are the ONLY axis this tool reads:

    ښ →  ʂ  Southern/Kandahari (pbt)   ·  x  Northern/Peshawar (pbu)  ·  ç  Central/Waziri (pst)
    ږ →  ʐ  Southern (pbt)             ·  ɡ  Northern (pbu)           ·  ʝ  Central (pst)

⚠ IT DELIBERATELY DOES NOT KEY ON VOWELS, and that restraint is a correction rather than a simplification.
An earlier pass classified on FOLDED strings and read a large "Waziri back-vowel shift" class — 141 words
where we emit o and the reference had ə/e/i. Reading the RAW referee killed it: `املوک` is `a m l u k`,
`انګور` is `a ŋ ɡ u r`, `اهوړ` is `a h u ɽ`. The reference says /u/, our g2p says /o/, and the eval fold
collapses `u`→ə while leaving `o` alone — so an ENGINE/LEXICON question about which vowel ⟨و⟩ spells looked
like a dialect shift. ⟨و⟩ is /u/ or /o/ lexically and the abjad does not say which; that is the lexicon's
job, not a variety's. Keying a dialect splitter on vowels would re-import that mistake.

WHAT EACH SLICE CONTAINS. A word with NO ښ/ږ is variety-NEUTRAL on this axis and is kept in ALL THREE slices
with all its readings — it tests the engine equally whoever is speaking. A word with one is kept only in the
slices whose reflex it attests, carrying only the matching readings. So the slices overlap heavily (the
neutral majority) and differ exactly on the isogloss.

⚠ THIS IS A VARIETY FILTER, NOT A DIFFICULTY FILTER. It never consults the engine's output. The check that it
worked is that the engine's HIT COUNT is unchanged between the aggregate and its own variety's slice — every
line removed must be one it scored zero on. If the hit count moves, the filter is selecting for something
else and the number is not trustworthy.

  python3 split_referee_by_dialect.py <in.tsv> <out-prefix>
"""
import re
import sys

VARIETIES = {
    "pbt": {"name": "Southern / Kandahari", "sheen": "ʂ", "zheen": "ʐ"},
    "pbu": {"name": "Northern / Peshawar", "sheen": "x", "zheen": "ɡg"},
    "pst": {"name": "Central / Waziri", "sheen": "çc", "zheen": "ʝ"},
}
# ⚠ A BROAD ʃ/ʒ IS NOT A VARIETY, IT IS AN UNCOMMITTED TRANSCRIPTION — and treating it as "not Southern"
# cost 24 hits on the first run of this tool, which is exactly the failure the hit-count check exists to
# catch. wikipron's ښ entries include ʂ (Southern), x (Northern), ç (Central) AND a plain ʃ that names the
# class without choosing a member. Those belong in EVERY slice, like a word with no diagnostic at all;
# dropping them from a slice silently removes evidence rather than removing another variety's answer.
NEUTRAL_SHEEN = "ʃ"
NEUTRAL_ZHEEN = "ʒ"
DIAG = re.compile(r"[ښږ]")


def reflexes(word, reading, key):
    """Does this reading realize the word's diagnostic letters the way `key` does?"""
    v = VARIETIES[key]
    if "ښ" in word and not re.search(f"[{v['sheen']}{NEUTRAL_SHEEN}]", reading):
        return False
    if "ږ" in word and not re.search(f"[{v['zheen']}{NEUTRAL_ZHEEN}]", reading):
        return False
    return True


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    rows = []
    for line in open(src, encoding="utf8"):
        if line.startswith("#") or "\t" not in line:
            continue
        p = line.rstrip("\n").split("\t")
        w, vs = p[0].strip(), [x.strip() for x in p[1:] if x.strip()]
        if w and vs:
            rows.append((w, vs))

    diag_rows = [r for r in rows if DIAG.search(r[0])]
    print(f"{src}: {len(rows)} entries, {len(diag_rows)} carry ښ/ږ", file=sys.stderr)
    for key, v in VARIETIES.items():
        out, marked, dropped_here = [], 0, 0
        for w, vs in rows:
            if not DIAG.search(w):
                out.append((w, vs))          # variety-neutral on this axis — every slice keeps it
                continue
            keep = [x for x in vs if reflexes(w, x, key)]
            if keep:
                out.append((w, keep))
                marked += 1
            else:
                dropped_here += 1
        path = f"{prefix}-{key}.tsv"
        with open(path, "w", encoding="utf8") as f:
            print(f"# {path.rsplit('/', 1)[-1]} — the {key} ({v['name']}) slice of "
                  f"{src.rsplit('/', 1)[-1]}, an ISO 639-3 `pus` MACROLANGUAGE aggregate.", file=f)
            print(f"# Diagnostic: ښ→{v['sheen'][0]}, ږ→{v['zheen'][0]} (the MacKenzie ṣ̌/ẓ̌ isogloss). Words"
                  " WITHOUT ښ/ږ are variety-neutral and appear in all three slices with all readings; words"
                  " with one keep only the readings attesting this variety.", file=f)
            print("# Built by tools/pashto/split_referee_by_dialect.py. NOT a difficulty filter — the engine's"
                  " output is never consulted; validate by checking the hit count is unchanged.", file=f)
            print(f"# entries {len(out)} ({marked} of them carry the diagnostic).", file=f)
            for w, vs in out:
                print("\t".join([w, *vs]), file=f)
        print(f"  {path}: {len(out)} entries, {marked} diagnostic "
              f"({dropped_here} dropped as another variety)", file=sys.stderr)


if __name__ == "__main__":
    main()
