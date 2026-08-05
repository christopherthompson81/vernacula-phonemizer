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

Usage:  python3 tools/normalization/wikidump-to-text.py mywiki.xml.bz2 out.txt [--max-articles N] [--jobs N]
"""
import bz2
import os
import re
import sys
from multiprocessing import Pool
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
# ⚠ `<math>` IS NOTATION, NOT SPEECH, AND RE_TAG LEAVES ITS BODY BEHIND. Deleting the tags and keeping the
# contents puts raw LaTeX into the mined text — `shi` selected
# `&=\int_1^a \frac 1 x \, dx + \int_a^{ab} \frac{1}{x} \, dx\\[5pt]` as a normalization test case. This is the
# SAME failure already documented for `<sup>` a few lines down, in the opposite direction: there the fix was to
# RENDER the body because it carried a real exponent; here the body is a formula that no reader speaks, so the
# block goes whole.
#
# Volume is low — 0.10-0.34% of lines per language (gl 8,628, hy 6,741, eu 5,797) — but the impact is
# disproportionate, because a hard-set selects ADVERSARIALLY and LaTeX is dense in exactly what it hunts:
# digits, `\frac`, and arithmetic signs. The same disproportion made one vandalized Awadhi page, 1 line in
# 18,117, land in that artifact.
RE_MATH = re.compile(r"<math[^>]*>.*?</math>|<chem[^>]*>.*?</chem>", re.S | re.I)
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
# ⚠ TABLES NEST, AND A NON-GREEDY MATCH CANNOT STRIP THEM. `{\|.*?\|\}` was the first version: on
# `{| outer ... {| inner |} ... |}` it matches from the OUTER `{|` to the FIRST `|}`, i.e. it eats the outer
# opener and the inner table and leaves the outer table's remaining ROWS behind as loose text. Those rows are
# what reached the mined hard-sets — `chr.jsonc` selected `"| align=center colspan=2 | ᎵᎳ ᏙᏮᏍ, 2010."` as a
# normalization test case, which is table syntax presented as prose. Measured across the first dump batch:
# 0.0-4.1% of output lines carried markup residue, worst in bm and chr (4.1%), ti (2.6%), ltg (2.3%).
#
# This file's own header calls that out as the thing to avoid — "conflating the two would put unspeakable text
# in the hard-set" — about citations, and the same principle was being violated by tables.
#
# So: match only an INNERMOST table (one containing no further `{|`) and repeat until nothing changes, which
# collapses nesting from the inside out.
RE_TABLE_INNER = re.compile(r"\{\|(?:(?!\{\|).)*?\|\}", re.S)

def strip_tables(text: str) -> str:
    for _ in range(20):   # bounded: malformed wikitext can leave an unclosed `{|` that never matches
        new = RE_TABLE_INNER.sub(" ", text)
        if new == text:
            return new
        text = new
    return text

# THE RESIDUE GUARD, because stripping is never complete on real wikitext: an unclosed `{|`, a stray `|}`, or
# a raw HTML table survives every rule above. A paragraph carrying any of these is DISCARDED rather than
# cleaned, since attribute soup is not speech and a partial clean would leave a fragment that reads like
# prose. It costs at most 4% of lines and it is the difference between a hard-set and a hard-set with
# unspeakable entries in it.
RE_MARKUP_RESIDUE = re.compile(
    r"(?:\{\||\|\}|\|\||!!)"                                    # table open/close, cell/header separators
    r"|(?:^|\s)[|!]\s*(?:align|style|colspan|rowspan|bgcolor|width|valign|scope|class)\s*="  # a row's attributes
    r"|<\s*/?\s*(?:table|tr|td|th|div|span|br)\b"                # raw HTML table/layout tags
    # A surviving media link or its parameters. The extension test needs no prefix list; the sizing and
    # placement keywords catch a caption whose link syntax was already partly eaten.
    r"|\.(?:jpe?g|png|svg|gif|webp|ogg|og[av]|mp3|mp4|webm|djvu|tiff?)\b"
    # ⚠ NO LEADING \b. The first version was `\b\d{2,4}\s*px\b`, and MediaWiki's two-dimensional sizing form
    # writes `55x55px` — where `\b` cannot match between the `x` and the `5`, both being word characters. Two
    # such lines survived into haw's hard-set (`55x55px Mikaela a me Keoki Kāna e Hoʻokanaka …`).
    r"|\d{2,4}\s*px\b"
    # LaTeX that arrived without its <math> wrapper, e.g. from a template expansion.
    r"|\\(?:frac|int_|sum_|sqrt|begin\{|end\{|displaystyle|mathrm|cdot|times|leq|geq)\b"
    r"|\|\s*(?:thumb|thumbnail|vignette|miniatur|miniatura|frame|frameless|border|upright|right|left|center|centre|droite|gauche)\s*\|",
    re.I | re.M,
)
# ⚠ THE NAMESPACE PREFIX IS LOCALIZED, AND AN ENGLISH-ONLY LIST LEAKS IMAGE MARKUP AS PROSE. Bambara's wiki
# writes `[[Fichier:Drall.jpg|droite|200px|vignette|Mali bagan fɛrɛ yɔrɔ]]`, which this pattern did not match,
# so the whole link survived into the mined text. It was found by the template-field detector rather than by
# inspection: `fichier`, `px`, `right` and `jpg` came back as the four most field-like words in Bambara —
# present in 16-24% of segments, exactly once each — which is the signature of a markup fragment, not a word.
#
# Measured across the converted dumps, this is the LARGEST contamination found so far: bm 19.2% of lines,
# chr 18.5%, syl 11.1%, ltg 9.7%, haw 8.7%, hak 8.7%, wo 8.1%, gd 7.1%. An order of magnitude worse than the
# nested-table residue (0-4.1%).
#
# Two defences, because a prefix list is inherently incomplete: the common localized prefixes, AND a
# language-agnostic rule keyed on the MEDIA EXTENSION, which no localization changes.
# ⚠ PERSONAL CONTACT DETAILS REACH THE HARD-SET, AND THE SELECTOR ACTIVELY HUNTS THEM. A wiki contact block,
# external-links section or organisation infobox routinely carries an email, a phone number or a home address —
# and every one of those is DIGIT-DENSE, which is precisely the shape the adversarial cell selector looks for.
# So they are not merely present, they are preferentially chosen. Measured on this fleet before the guard
# existed, in artifacts that were staged for a public PR:
#
#   mai  a private individual's full residential address, postal code and Gmail, picked for `digit-run`
#   ln   two `Name, Tel (+NN) NNN NN NN NN, email` records, picked for `ranges` and `signed-number`
#   shi  a family's Facebook photo-album URL, picked for `fractions` — the slashes in the path
#   skr  a named individual's Facebook profile URL, picked for `latin-in-native`
#
# None of it is speech, all of it is personal data, and the repository is public. A paragraph carrying any of
# these is discarded whole — there is no partial redaction that leaves trustworthy prose behind.
#
# The URL clause earns its place twice over: a bare link is not read aloud, and it was being selected as a
# FRACTION example because of the slashes, which is nonsense as a normalization test case either way.
RE_PERSONAL = re.compile(
    r"[\w.+-]+@[\w-]+\.[a-z]{2,}"                                     # any email address
    r"|(?:facebook|instagram|twitter|x|tiktok|whatsapp|t\.me|linkedin)\.com/[\w./-]+"  # a personal profile
    # ⚠ `phone` ALONE IS ORDINARY PROSE. The first version matched `\b(?:tel|phone|…)\b\s*[.:]?\s*\d` and fired
    # on "Windows Phone 8 was launched" in the pre-existing Burmese artifact — a false positive on a product
    # name. A contact record is the ABBREVIATION plus a separator plus a dialling-shaped number, so `tel`/`tél`
    # /`tlf` keep their looser form and `phone`/`telephone` require an explicit `:` or `no.`
    r"|\b(?:tel|t[eé]l|tlf|телефон|هاتف)\b\s*[.:]\s*\(?\+?\d"
    r"|\b(?:phone|telephone|mobile|मोबाइल|फोन)\b\s*(?:no\.?|number|:)\s*\(?\+?\d"
    r"|\(\+\d{1,3}[\s)-]\s?\d[\d\s-]{6,}"                              # a bare international dialling number
    r"|https?://\S{12,}",                                              # a bare URL: never spoken
    re.I)
RE_FILE = re.compile(
    r"\[\[(?:File|Image|Fichier|Datei|Archivo|Ficheiro|Imagem|Immagine|Bestand|Fil|Tiedosto|Plik|"
    r"Файл|Фаjл|Слика|Зураг|Совраӧ|ملف|תמונה|ファイル|파일|文件|檔案|图像|ဖိုင်|"
    r"Category|Categoria|Categorie|Kategorie|Catégorie|Categoría|Категория|Wikipedia)\s*:[^\]]*\]\]",
    re.I)
# The extension-keyed net: any wiki link whose target names a media file, whatever the namespace is called.
RE_MEDIA = re.compile(
    r"\[\[[^\[\]]{0,60}\.(?:jpe?g|png|svg|gif|webp|ogg|og[av]|wav|mp3|mp4|webm|pdf|djvu|tiff?)\b[^\]]*\]\]",
    re.I)
RE_LINK = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]")
RE_EXTLINK = re.compile(r"\[https?://\S+\s+([^\]]*)\]|\[https?://\S+\]")
RE_HEADING = re.compile(r"^=+.*?=+$", re.M)
RE_QUOTES = re.compile(r"'{2,}")
RE_LISTMARK = re.compile(r"^[*#:;]+", re.M)
RE_WS = re.compile(r"[^\S\n]+")
RE_BLANK = re.compile(r"\n{2,}")


RE_BRACES = re.compile(r"\{\{|\}\}")

def strip_templates(s: str) -> str:
    """Remove {{...}} with nesting. A regex cannot count braces — but it can find every brace PAIR, and the
    depth counting only has to happen at those positions.

    ⚠ THIS WAS 78% OF THE CONVERTER'S RUNTIME. The first version walked one character at a time in Python,
    appending kept characters individually, which is O(len) interpreted work over the whole dump: measured
    4.0 MB/s against 409 MB/s for the regex-based passes beside it, and 3.92s of clean()'s 5.03s on 15.5 MB of
    wikitext. Conversion of a 50 MB dump took 46s of which only 9.5s was bz2 plus XML, so the remaining 78% was
    almost entirely this function.

    Finding brace pairs with a regex and SLICING between them does identical work: a few thousand match
    positions instead of tens of millions of interpreted character steps.

    The edge cases are preserved deliberately, because output must stay byte-identical — the artifacts are
    committed and diffed:
      · a stray `}}` at depth 0 is KEPT (it falls inside the current kept run, as the old `else` branch did);
      · an UNCLOSED `{{` discards the remainder (the old loop never returned to depth 0, so appended nothing).
    """
    if "{{" not in s:
        return s
    out, depth, last = [], 0, 0
    for m in RE_BRACES.finditer(s):
        if m.group() == "{{":
            if depth == 0:
                out.append(s[last:m.start()])
            depth += 1
        elif depth:
            depth -= 1
            if depth == 0:
                last = m.end()
    if depth == 0:
        out.append(s[last:])
    return "".join(out)


def clean(text: str) -> list:
    text = RE_COMMENT.sub(" ", text)
    text = RE_MATH.sub(" ", text)
    text = RE_REF.sub(" ", text)
    text = strip_tables(text)
    text = strip_templates(text)
    text = RE_FILE.sub(" ", text)
    text = RE_MEDIA.sub(" ", text)
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
    # The residue guard is applied PER PARAGRAPH, not to the whole article: one leftover table in a long
    # article should cost that table's paragraphs, not the article's prose.
    return [q for q in (p.strip() for p in RE_BLANK.split(text)) if q and not RE_MARKUP_RESIDUE.search(q) and not RE_PERSONAL.search(q)]


# How many article bodies to hand to the pool at once. Large enough that per-task overhead is amortised, small
# enough that memory stays bounded on a multi-gigabyte dump.
BATCH = 400


def flush(batch: list, out, pool) -> int:
    """Clean a batch of article bodies and write the paragraphs that survive. Returns how many were written."""
    results = pool.imap(clean, batch, chunksize=25) if pool is not None else map(clean, batch)
    n = 0
    for paras in results:
        for para in paras:
            # One PARAGRAPH per line. 80 chars keeps headings-turned-fragments and one-line stubs out while
            # retaining short but complete paragraphs, which often carry the densest symbol use (dates,
            # results, measurements).
            if len(para) > 80:
                out.write(para + "\n")
                n += 1
    return n


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    cap = int(sys.argv[sys.argv.index("--max-articles") + 1]) if "--max-articles" in sys.argv else 0
    jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 1
    kept = seen = 0
    batch: list = []
    pool = Pool(jobs) if jobs > 1 else None
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
            batch.append(body)
            # ⚠ ORDERED, ALWAYS. `Pool.imap` preserves input order; `imap_unordered` would be faster and would
            # make the output depend on worker scheduling — and the artifact mined from this file is COMMITTED
            # and diffed, so a re-run must be byte-identical. Same reason `mine.ts` uses a deterministic stride
            # rather than a shuffle for its sample tier.
            if len(batch) >= BATCH:
                kept += flush(batch, out, pool)
                batch = []
            if cap and kept >= cap:
                break
        if batch and not (cap and kept >= cap):
            kept += flush(batch, out, pool)
    if pool is not None:
        pool.close()
        pool.join()
    print(f"pages seen {seen}, paragraphs written {kept} -> {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
