#!/usr/bin/env python3
"""
Wikipedia dump (pages-articles.xml.bz2) -> one plain-text line per PARAGRAPH, for normalization mining (#585).

WHY NOT THE API. The MediaWiki route caps search results per query, rate-limits, and needs one request per
article for full text. A local dump removes all three and — the reason that matters for the two-tier design
— restores TRUE FREQUENCY, which a search-ranked sample cannot give. Dumps for the candidate languages are
small: lo 8 MB, bo 18 MB, km 31 MB, my 70 MB, si 79 MB.

WHAT IS STRIPPED, AND WHY IT IS NOT A RENDERER. The goal is prose that a person would READ ALOUD, with its
symbols intact — not faithful wikitext rendering. So:
  · non-article namespaces and redirects are skipped outright;
  · templates {{...}} go, nested, because an infobox is tabular data rather than prose;
  · <ref>...</ref> goes: citation metadata is not spoken text. This is deliberate and has a measured
    consequence — the `dotted` and `abbrev` cells report thousands of insource: hits on my.wikipedia that
    are ALL inside citations, so they do not survive here. Search hits in wikitext are not prose
    occurrences, and conflating the two would put unspeakable text in the hard-set;
  · tables, files, categories, headings and markup punctuation go;
  · [[link|label]] keeps the LABEL, which is what a reader says.

Digits, %, currency, degrees and dashes are left exactly as written — they are the entire point.

Usage:  python3 tools/normalization/wikidump-to-text.py mywiki.xml.bz2 out.txt [--max-articles N]
"""
import bz2
import re
import sys
import xml.etree.ElementTree as ET

# ⚠ DOUBLE-ENCODED UTF-8 IS REPAIRED AT MINING TIME, not left for the engine to absorb. The engine does repair
# it (src/core/unicode.ts `repairDoubleEncoded`), but leaving it in the ARTIFACT means every measurement over
# the mined text sees PHANTOM SYMBOLS — `Las CaÃ±itas` contains a `±` because `Ã±` is the mis-decode of `ñ`,
# and that phantom was cited in #654 as the fleet's only `±`. Same class as `Ä°zmir` (a `°`) and `SÃ£o` (a `£`).
# THE ARITHMETIC IS EXACT, which is what separates this from the `<sup>` flattening: UTF-8 `C2..C5 XX` encodes a
# known code point, so the repair is a decode and not an inference. Nothing is guessed, so it is safe to apply
# to the stored text rather than only at read time.
CONT = range(0x80, 0xC0)
def repair_double_encoded(t: str) -> str:
    if not any(c in t for c in "\u00c2\u00c3\u00c4\u00c5"):
        return t
    out = []
    i = 0
    while i < len(t):
        a = t[i]
        if 0xC2 <= ord(a) <= 0xC5 and i + 1 < len(t) and ord(t[i + 1]) in CONT:
            out.append(chr(((ord(a) & 0x1F) << 6) | (ord(t[i + 1]) & 0x3F)))
            i += 2
        else:
            out.append(a)
            i += 1
    return "".join(out)

RE_COMMENT = re.compile(r"<!--.*?-->", re.S)
RE_REF = re.compile(r"<ref[^>]*?/>|<ref.*?</ref>", re.S | re.I)
RE_TAG = re.compile(r"<[^>]+>")
# ⚠ MEDIAWIKI ERROR MESSAGES ARE NOT PROSE, and three reached cmn's artifact and were READ ALOUD as English:
# `截至2023年 (2023-Missing required parameter 1=month!` → *… mˈɪsɪŋ ɹikwˈaᶦɚd pɚˈæmət̬ɚ …*. These are FIXED
# strings emitted by a broken template, so unlike ordinary garbage they can be matched exactly rather than
# guessed at — and a paragraph containing one is discarded whole, because the surrounding text is a template
# expansion too and there is no reliable prose to salvage from it.
RE_WIKI_ERROR = re.compile(
    r"Missing required parameter|Expression error|Template loop detected|Cite error|"
    r"Invalid time|Unknown archive|script error",
    re.I)
# ⚠ <sup> IS RENDERED, NOT STRIPPED, and stripping it was OUR data loss rather than the source's.
# RE_TAG below deletes the brackets and leaves the digits INLINE, so `2.802×10<sup>10</sup>` mined as
# `2.802×1010` — the exponent merged into the mantissa and no later pass can tell where the boundary was.
# THE ARITHMETIC PROVES the loss is ours: hi's `2,603 वर्ग किलोमीटर (2.802×1010 वर्ग फुट)` only reconciles as
# 2.802×10¹⁰ sq ft, and `100 kमी2 (1.1×109 वर्ग फुट)` as 1.1×10⁹. It hid for so long because the UNIT case is
# survivable — `km<sup>2</sup>` flattens to `km2`, which the symbol tier accepts — so twelve corpora carry a
# harmless-looking `km2` and only a NUMBER base made the collision visible.
# Digits and signs only: `4<sup>th</sup>` keeps its letters, which the ordinal rule reads.
SUP_DIGITS = str.maketrans("0123456789-+", "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u207b\u207a")
RE_SUP = re.compile(r"<sup>([+-]?\d+)</sup>", re.I)
RE_TABLE = re.compile(r"\{\|.*?\|\}", re.S)
RE_FILE = re.compile(r"\[\[(?:File|Image|ဖိုင်|Category|Wikipedia)[^\]]*\]\]", re.I)
RE_LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]")
RE_EXTLINK = re.compile(r"\[https?://\S+\s+([^\]]*)\]|\[https?://\S+\]")
RE_HEADING = re.compile(r"^=+.*?=+$", re.M)
RE_QUOTES = re.compile(r"'{2,}")
RE_LISTMARK = re.compile(r"^[*#:;]+", re.M)
RE_WS = re.compile(r"[^\S\n]+")
RE_BLANK = re.compile(r"\n{2,}")


def strip_templates(s: str) -> str:
    """Remove {{...}} with nesting. A regex cannot count braces, so scan."""
    out, depth, i = [], 0, 0
    while i < len(s):
        if s.startswith("{{", i):
            depth += 1
            i += 2
        elif s.startswith("}}", i) and depth:
            depth -= 1
            i += 2
        else:
            if not depth:
                out.append(s[i])
            i += 1
    return "".join(out)


def clean(text: str) -> list:
    text = RE_COMMENT.sub(" ", text)
    text = RE_REF.sub(" ", text)
    text = RE_TABLE.sub(" ", text)
    text = strip_templates(text)
    text = RE_FILE.sub(" ", text)
    text = RE_LINK.sub(r"\1", text)
    text = RE_EXTLINK.sub(lambda m: m.group(1) or " ", text)
    text = RE_HEADING.sub(" ", text)
    text = repair_double_encoded(text)   # BEFORE anything reads a symbol out of it — see the note above
    if RE_WIKI_ERROR.search(text):
        return ""   # a template-error paragraph is discarded whole; see RE_WIKI_ERROR
    text = RE_SUP.sub(lambda m: m.group(1).translate(SUP_DIGITS), text)  # BEFORE RE_TAG, which would flatten it
    text = RE_TAG.sub(" ", text)
    text = RE_QUOTES.sub("", text)
    text = RE_LISTMARK.sub(" ", text)
    # PARAGRAPH BREAKS ARE PRESERVED, one paragraph per output line. A sentence splitter has to decide what
    # a period means, and when the mining target IS the period — the dotted / abbreviation / era-marker
    # cells — that decision is the thing under test. Paragraphs need no such decision, so the miner can
    # segment on them instead and leave every dot intact. Collapsing to a single line per article, which
    # this did first, threw the boundaries away before the miner could choose.
    text = RE_WS.sub(" ", text)
    return [p.strip() for p in RE_BLANK.split(text) if p.strip()]


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    cap = int(sys.argv[sys.argv.index("--max-articles") + 1]) if "--max-articles" in sys.argv else 0
    kept = seen = 0
    with bz2.open(src, "rb") as fh, open(dst, "w", encoding="utf8") as out:
        ns_url = None
        for event, elem in ET.iterparse(fh, events=("start", "end")):
            if event == "start" and ns_url is None:
                ns_url = elem.tag[1:elem.tag.index("}")] if elem.tag.startswith("{") else ""
                q = (lambda t: f"{{{ns_url}}}{t}") if ns_url else (lambda t: t)
                continue
            if event != "end" or elem.tag != q("page"):
                continue
            seen += 1
            ns = elem.findtext(q("ns"))
            rev = elem.find(q("revision"))
            body = rev.findtext(q("text")) if rev is not None else None
            elem.clear()
            if ns != "0" or not body or body.lstrip()[:9].upper().startswith("#REDIRECT"):
                continue
            for para in clean(body):
                # One PARAGRAPH per line. 80 chars keeps headings-turned-fragments and one-line stubs out
                # while retaining short but complete paragraphs, which often carry the densest symbol use
                # (dates, results, measurements).
                if len(para) > 80:
                    out.write(para + "\n")
                    kept += 1
            if cap and kept >= cap:
                break
    print(f"pages seen {seen}, paragraphs written {kept} -> {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
