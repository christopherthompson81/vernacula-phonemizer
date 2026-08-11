#!/usr/bin/env python3
"""Fetch a Wikimedia INCUBATOR project's prose — the corpus of last resort for a language with no wiki.

WHY THIS EXISTS SEPARATELY FROM `mine.ts fetch`. That command builds `https://<wiki>.wikipedia.org/w/api.php`,
which is right for every language that HAS a Wikipedia and useless for one that does not. Several do not:
Jin (cjy) and Xiang (hsn) are both Incubator-only, and `tools/corpus/mined/cjy.jsonc` records its source as
"Wikimedia Incubator Wp/cjy (the only Jin corpus that exists)" while the prose file it was mined from is not
in the repo — so that artifact cannot currently be regenerated (playbook trap 32). This closes that for both.

Incubator holds every incubating project in ONE wiki, namespaced by prefix: `Wp/<code>/<title>`. So the fetch
is an `allpages` walk over that prefix plus a plaintext extract per page, and the language is selected by
PREFIX rather than by hostname.

⚠ TALK, TEMPLATE AND PROJECT PAGES ARE EXCLUDED. `Wp/hsn/Wikipedia:…` is a contributors' style guide, not
running prose in the language, and mining it would put wiki-process boilerplate into a corpus meant to
measure how the language writes numbers and dates.

    python3 tools/normalization/fetch-incubator.py --code hsn --out hsn_prose.txt
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://incubator.wikimedia.org/w/api.php"
# A User-Agent is REQUIRED — without one the API answers with non-JSON and the fetch yields silence that
# looks like an empty wiki. Same failure `mine.ts` documents for the Wikipedia API.
UA = "vernacula-phonemizer/1.0 (corpus mining for phonemizer development)"


def api(**params):
    """One API call, with backoff on 429.

    ⚠ A RATE LIMIT IS A "WAIT", NEVER AN ANSWER ABOUT THE WIKI — `mine.ts` states the same rule for the
    Wikipedia API. The first version of this script ran 8 workers, took 429s on 145 of 153 pages, and wrote
    them out as EMPTY: a throttled fetch recorded as "this page has no prose". That is the worst shape a
    corpus bug can take, because the artifact then looks complete. Serial with a short delay is fast enough
    here (153 pages) and cannot manufacture a silent gap.
    """
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf8"))
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = 2 ** attempt
            print(f"# 429 — waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--code", required=True, help="ISO code of the incubating project, e.g. hsn")
    ap.add_argument("--out", required=True)
    ap.add_argument("--project", default="Wp", help="Wp (Wikipedia), Wt (Wiktionary), …")
    a = ap.parse_args()

    prefix = f"{a.project}/{a.code}"
    titles, cont = [], None
    while True:
        kw = dict(action="query", list="allpages", apprefix=prefix, aplimit=500)
        if cont:
            kw["apcontinue"] = cont
        d = api(**kw)
        titles += [p["title"] for p in d.get("query", {}).get("allpages", [])]
        cont = d.get("continue", {}).get("apcontinue")
        if not cont:
            break
    # ⚠ project/talk pages are ABOUT the wiki, not IN the language — see the module docstring.
    keep = [t for t in titles if not any(x in t for x in (":", "/Wp/", "/Wt/"))]
    print(f"# {prefix}: {len(titles)} pages, {len(keep)} after dropping project/talk pages", file=sys.stderr)

    # ⚠ ONE TITLE PER REQUEST, AND THAT IS NOT AN OVERSIGHT. `exlimit` is capped at 1 for a FULL extract, so
    # batching titles silently returns only the FIRST one's text — a 20-title batch yields 1 page and 19
    # silent losses. Measured here before the fix: 153 pages came back as 5 paragraphs. The playbook records
    # the same cap for `fetch --fill`. The requests are independent, so the cost is bought back with a small
    # pool rather than by batching, and results are placed by INDEX so the output does not depend on network
    # timing (a re-fetch must reproduce the same file, or the mined artifact is not reproducible either).
    texts, failed = [], []
    for n, title in enumerate(keep, 1):
        try:
            d = api(action="query", prop="extracts", explaintext=1, exsectionformat="plain", titles=title)
            pages = d.get("query", {}).get("pages", [])
            texts.append((pages[0].get("extract") or "").strip() if pages else "")
        except Exception as e:                                    # noqa: BLE001 — one bad page must not
            print(f"# ! {title}: {e}", file=sys.stderr)            # abandon the remaining titles
            texts.append("")
            failed.append(title)
        if n % 25 == 0:
            print(f"#   {n}/{len(keep)}", file=sys.stderr)
        time.sleep(0.35)
    # ⚠ A FAILED PAGE IS NOT AN EMPTY PAGE. Reported separately and non-zero, so a throttled run cannot be
    # mistaken for a small wiki.
    if failed:
        print(f"# ⚠ {len(failed)} pages FAILED to fetch (not empty — failed): {failed[:5]}", file=sys.stderr)

    written, empty = 0, 0
    with open(a.out, "w", encoding="utf8") as f:
        for text in texts:
            if not text:
                empty += 1
                continue
            for para in text.split("\n"):
                para = para.strip()
                if para:
                    f.write(para + "\n")
                    written += 1
    print(f"# wrote {written} paragraphs from {len(keep) - empty} pages ({empty} empty) → {a.out}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
