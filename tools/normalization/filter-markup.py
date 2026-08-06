#!/usr/bin/env python3
"""
Apply the markup residue guard to ALREADY-EXTRACTED paragraph text.

WHY THIS EXISTS SEPARATELY FROM THE CONVERTER. Two contamination classes were found after a fleet of dumps
had already been converted and their .bz2 files deleted:

  · nested tables, whose rows survived a non-greedy `{|.*?|}` and reached the mined hard-sets — chr.jsonc
    selected `"| align=center colspan=2 | ᎵᎳ ᏙᏮᏍ, 2010."` as a normalization test case (0.0-4.1% of lines);
  · LOCALIZED media-namespace prefixes, which an English-only `File|Image|Category` list never matched, so
    `[[Fichier:Drall.jpg|droite|200px|vignette|…]]` survived whole. This is the larger of the two by an order
    of magnitude: bm 19.2% of lines, chr 18.5%, syl 11.1%, ltg 9.7%, haw 8.7%, hak 8.7%, wo 8.1%, gd 7.1%.

Both guards are LINE-LEVEL discards, so they do not need the original wikitext — which means a fleet of
extracted corpora can be repaired without re-downloading several gigabytes of dumps. The regexes are imported
from the converter rather than restated, so there is exactly one definition and the two cannot drift; that
drift is what `defects.ts` exists to prevent on the TypeScript side, and the same argument applies here.

⚠ A LINE IS DISCARDED, NEVER CLEANED. Attribute soup and image parameters are not speech, and a partial
clean leaves a fragment that reads like prose while being a caption or a table cell. Dropping the line costs
a few percent of the corpus and is the difference between a hard-set and a hard-set with unspeakable entries.

Usage:  python3 tools/normalization/filter-markup.py file.txt [more.txt ...]     # rewrites in place
        python3 tools/normalization/filter-markup.py --self-test                 # assert the guards
        python3 tools/normalization/filter-markup.py --dry-run file.txt          # counts only
"""
import sys
from pathlib import Path


# The converter's filename is not an importable module name (it contains hyphens), so the regexes are loaded
# by executing it in a namespace rather than by copying them. Executing is safe: the file guards its CLI
# behind `if __name__ == "__main__"`.
_ns: dict = {"__name__": "_wikidump_regexes"}
exec(compile((Path(__file__).resolve().parent / "wikidump-to-text.py").read_text(encoding="utf8"),
             "wikidump-to-text.py", "exec"), _ns)
RE_MARKUP_RESIDUE = _ns["RE_MARKUP_RESIDUE"]
RE_FILE = _ns["RE_FILE"]
RE_MEDIA = _ns["RE_MEDIA"]
RE_PERSONAL = _ns["RE_PERSONAL"]
decode_entities = _ns["decode_entities"]


def keep(line: str) -> bool:
    """A line survives only if no guard matches it. `RE_FILE`/`RE_MEDIA` are checked too: in already-extracted
    text a surviving media link is a whole-line artefact, so matching one condemns the line."""
    return not (RE_MARKUP_RESIDUE.search(line) or RE_FILE.search(line) or RE_MEDIA.search(line)
                or RE_PERSONAL.search(line))


# ⚠ THE GUARDS HAVE NO VITEST TO LIVE IN — they are Python, and this repo's suite is TypeScript. So the cases
# that matter are asserted here and run with `--self-test`, which keeps a future edit from silently re-breaking
# any of them. Every fixture below is a case that was actually WRONG at some point in this work.
SELF_TEST: list = [
    # (text, should_be_dropped, why)
    # ⚠ EVERY FIXTURE HERE IS FABRICATED, and deliberately so: a guard against personal data must not carry
    # examples of it. Each entry states the SHAPE it stands for, which is the part with engineering value.
    ("Wien: Beispiel MUSTERNAME, Tel (+43-1) 000 00 00, nkandá: nobody@example.invalid", True,
     "FABRICATED. Shape: a name + dialling number + email contact record. Digit-dense, so a cell selector "
     "hunting digit runs reaches for it ahead of ordinary prose"),
    ("निर्मली, जिला- उदाहरण, बिहार- 000000, ई-पत्र : nobody@example.invalid", True,
     "FABRICATED. Shape: a street address, postcode and personal mailbox — a postcode is a digit run, which "
     "is exactly what the `digit-run` cell selects for"),
    ("https://m.facebook.com/EXAMPLE.PLACEHOLDER/photos/a.000000000000000", True,
     "FABRICATED. Shape: a personal photo-album link. A URL path is slash-dense, so the `fractions` cell "
     "selects it as though it were a fraction — a bad test case even before the privacy question"),
    ("Microsoft launched Windows Phone 8 three days later, to cope with demand.", False,
     "⚠ FALSE POSITIVE the first version produced: `phone` + digit is a product name, not a contact"),
    ("He wrote about the telephone as a social technology in 1910.", False,
     "prose about telephones is not a phone number"),
    ("Sernav a Pirtûkê, Wergêrê Nimûne (werg.), Weşanxane, 2010, 424 r. (ISBN 978-000-0000-00-0)", False,
     "FABRICATED. ⚠ An ISBN-13 is indistinguishable from a phone number to a naive pattern — both are "
     "hyphen-grouped digit runs, and real ones beginning 978- were the entire 'phone-like' column of the "
     "first scan. Bibliographic data is not personal data, but it is fabricated here for consistency"),
    ("| align=center colspan=2 | ᎵᎳ ᏙᏮᏍ, 2010.", True,
     "table row markup — a non-greedy `{\\|.*?\\|\\}` leaves the outer table's rows behind as loose text"),
    ("55x55px Ka Inoa O Ka Kii (Aupuni Mōʻī, 1881)", True,
     "MediaWiki two-dimensional sizing — `\\b\\d{2,4}px` cannot match inside `55x55px`, since \\b fails "
     "between the x and the 5"),
    ("Ordinary prose about a town with 12,450 inhabitants and an area of 88 km2.", False,
     "the symbols this corpus exists to test must survive"),
]


def self_test() -> int:
    bad = 0
    for text, want_drop, why in SELF_TEST:
        got_drop = not keep(text)
        if got_drop != want_drop:
            bad += 1
            print(f"  FAIL want={'drop' if want_drop else 'keep'} got={'drop' if got_drop else 'keep'}: {text[:70]}")
            print(f"       {why}")
    print(f"self-test: {len(SELF_TEST) - bad}/{len(SELF_TEST)} passed")
    return 1 if bad else 0


# ⚠ THIS TOOL BOTH DROPS AND TRANSFORMS, and the transform was added later for a reason worth recording. The
# guards above discard a line; entity decoding REWRITES one. Both need to reach corpora that were extracted
# before the fix and whose .bz2 files are long deleted — 94 of 154 artifacts carry HTML entities, 2,653
# occurrences — and re-downloading gigabytes to re-run the converter would be the expensive way to get there.
#
# Decoding runs BEFORE the guards, so an entity cannot hide a pattern they are meant to catch: `&#37;` is a
# percent sign, and a media link written with `&amp;` in its query string is still a media link.
def repair(line: str) -> str:
    return decode_entities(line)


def main() -> None:
    if "--self-test" in sys.argv:
        sys.exit(self_test())
    dry = "--dry-run" in sys.argv
    total_in = total_out = 0
    for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
        lines = Path(path).read_text(encoding="utf8").splitlines()
        kept = [r for r in (repair(l) for l in lines) if r.strip() and keep(r)]
        total_in += len(lines)
        total_out += len(kept)
        dropped = len(lines) - len(kept)
        pct = 100.0 * dropped / len(lines) if lines else 0.0
        print(f"{Path(path).name:24} {len(lines):7} -> {len(kept):7}  dropped {dropped:6} ({pct:.1f}%)")
        if not dry:
            Path(path).write_text("\n".join(kept) + "\n", encoding="utf8")
    d = total_in - total_out
    print(f"{'TOTAL':24} {total_in:7} -> {total_out:7}  dropped {d:6} "
          f"({100.0 * d / total_in if total_in else 0:.1f}%)" + ("   [dry run]" if dry else ""))


if __name__ == "__main__":
    main()
