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

RE_COMMENT = re.compile(r"<!--.*?-->", re.S)
RE_REF = re.compile(r"<ref[^>]*?/>|<ref.*?</ref>", re.S | re.I)
RE_TAG = re.compile(r"<[^>]+>")
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
