#!/usr/bin/env python3
"""Build the Hebrew (he) niqqud→IPA g2p referee from the cached en.wiktionary batches.

Hebrew Wiktionary headwords are UNVOCALIZED (bare consonantal) — the full vowel-restoration problem (Phase 2,
deferred). But each ==Hebrew== entry ALSO carries (a) the VOCALIZED citation form with niqqud in its headword
template's `wv=` param, and (b) the MODERN ISRAELI IPA in the `{{IPA|he|/…/|a=IL}}` tag. This tool pairs those two
into a `vocalized-form <TAB> Modern-IPA` referee that grades the Phase-1 segmental niqqud→IPA g2p (src/languages/
hebrew), independent of restoration.

Reads the batch cache populated by `npx tsx tools/corpus/build-referee.ts --lang he --wnl Hebrew` (the batched
MediaWiki generator + cache). Run that first, then:
  python tools/hebrew/build_g2p_referee.py   # → tools/referee-eval/referees/he.wiktionary-he.tsv
"""
import json, re, glob, os, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(REPO, "tools", "corpus", ".cache", "he")
OUT = os.path.join(REPO, "tools", "referee-eval", "referees", "he.wiktionary-he.tsv")
NIQQUD = re.compile(r"[ְ-ׇ]")  # any Hebrew point (vowel/dagesh/shin-sin dots)

batches = sorted(glob.glob(os.path.join(CACHE, "batch-*.json")))
if not batches:
    sys.exit(f"no cache at {CACHE} — run `npx tsx tools/corpus/build-referee.ts --lang he --wnl Hebrew` first")

rows, pages, il = [], 0, 0
for f in batches:
    for page in json.load(open(f, encoding="utf8")).get("query", {}).get("pages", []):
        c = page.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("content")
        if not c:
            continue
        m = re.search(r"\n==\s*Hebrew\s*==\n(.*?)(?=\n==[^=]|\Z)", c, re.S)
        sect = m.group(1) if m else c
        pages += 1
        # Modern Israeli IPA: prefer the {{IPA|he|…|a=IL}} tag; else the first {{IPA|he|…}}
        ipas = re.findall(r"\{\{IPA\|he\|([^}]*)\}\}", sect)
        il_tagged = [x for x in ipas if re.search(r"a\s*=\s*IL", x)]
        chosen = il_tagged[0] if il_tagged else (ipas[0] if ipas else None)
        if not chosen:
            continue
        if il_tagged:
            il += 1
        forms = re.findall(r"[/\[]([^/\]]+)[/\]]", chosen)
        ipa = forms[0].strip() if forms else None
        # Vocalized (niqqud) citation form: the headword `wv=`/`head=` param. Take the first that is a SINGLE
        # vocalized word — strip wiki [[…]] markup and reject anything with spaces/markup (multi-word phrase
        # entries carry [[…]] links, not a clean citation form).
        voc = None
        for pat in (r"\bwv\s*=\s*([^|}\n]+)", r"\bhead\s*=\s*([^|}\n]+)"):
            mm = re.search(pat, sect)
            if not mm:
                continue
            cand = re.sub(r"\[\[|\]\]", "", mm.group(1)).strip()
            if NIQQUD.search(cand) and re.fullmatch(r"[א-תְ-ׇ־']+", cand) and "־" not in cand:
                voc = cand
                break
        if ipa and voc and " " not in ipa.strip("ˈˌ"):  # single-word IPA too
            rows.append((voc, ipa))

# de-dup by vocalized form (keep first)
seen, uniq = set(), []
for v, i in rows:
    if v not in seen:
        seen.add(v)
        uniq.append((v, i))
uniq.sort()
header = (
    f"# Hebrew (he) — en.wiktionary VOCALIZED form (wv=) → MODERN ISRAELI IPA (a=IL tag). Phase-1 niqqud→IPA g2p\n"
    f"# referee (segmental core; unvocalized restoration is Phase 2, deferred). {pages} pages, {il} IL-tagged →\n"
    f"# {len(uniq)} (vocalized, IPA) pairs. Built by tools/hebrew/build_g2p_referee.py from the build-referee.ts cache.\n"
)
open(OUT, "w", encoding="utf8").write(header + "\n".join(f"{v}\t{i}" for v, i in uniq) + "\n")
print(f"wrote {len(uniq)} pairs → {OUT}  ({il}/{pages} IL-tagged)")
