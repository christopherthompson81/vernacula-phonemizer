#!/usr/bin/env python3
"""Derive the `normalization` column for catalogue.tsv from the repo, rather than hand-maintaining 213 values.

    python3 derive-normalization.py            # rewrite catalogue.tsv's normalization column in place
    python3 derive-normalization.py --check    # report what it WOULD write, change nothing

WHY DERIVED. A hand-kept column goes stale the moment a language is treated, and this one has to be trustworthy
to be worth planning from: the whole point is to pick the next target off it. So it is computed from the two
things that actually decide the answer — whether the language's engine directory has a `normalize.ts`, and
whether the engine CALLS it — and regenerated whenever the fleet moves.

⚠ A FILE ON DISK IS NOT A WIRED LAYER. `review.ts` checks those separately because they came apart in practice
(a normalizer can exist and never be called), so `partial` is a real state and is reported rather than rounded up
to `done`.

The values:
    done       the engine directory has a normalize.ts and the engine calls it
    partial    the file exists but the engine does not call it — a wired-up job left unfinished
    inherited  no layer of its own, but the engine DELEGATES to one that has it — either through the catalogue's
               `served_by`, or because the directory is a wrapper that calls another language's factory
    (empty)    no normalization layer — a candidate. This is what the planning query looks for.

⚠ DELEGATION HAD TO BE FOLLOWED OR THE LIST LIES AT THE TOP. 26 directories are wrappers with no normalize.ts of
their own: `spanish-419` calls `createSpanish`, six Hindi-belt languages (awadhi, bhojpuri, chhattisgarhi, magahi,
maithili, rangpuri) call the Hindi factory, four Sinitic lects call `sinitic`. Counting a missing file as a
missing layer put Latin-American Spanish — 420 million speakers — at the head of the planning query, when its
normalization has been running the whole time through the Spanish engine.
"""
import csv, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
TSV  = os.path.join(HERE, "catalogue.tsv")
SRC  = os.path.join(ROOT, "src", "languages")

def registry_dirs():
    """code → engine directory, read the way review.ts reads it: the factory call inside each `case` block."""
    reg = open(os.path.join(ROOT, "src", "registry.ts"), encoding="utf8").read()
    imports = dict(re.findall(r'import \{\s*(create\w+)[^}]*\} from "\./languages/([^/]+)/', reg))
    out = {}
    for m in re.finditer(r'case "([^"]+)":', reg):
        code, at = m.group(1), m.end()
        block = reg[at:at + 600]
        for f in re.findall(r"(create\w+)\s*\(", block):
            if f in imports:
                out[code] = imports[f]
                break
    return out

def main():
    check = "--check" in sys.argv
    dirs = registry_dirs()

    def engine_src(dp):
        """Every .ts in the directory except the normalizer and the tests — the net review.ts casts."""
        return "".join(open(os.path.join(dp, f), encoding="utf8").read()
                       for f in os.listdir(dp)
                       if f.endswith(".ts") and "normalize" not in f and ".test." not in f)

    # Which directories have a normalizer of their own, and does the engine there call it?
    has_file, is_wired = set(), set()
    for d in sorted(os.listdir(SRC)):
        dp = os.path.join(SRC, d)
        if not os.path.isdir(dp) or not os.path.exists(os.path.join(dp, "normalize.ts")):
            continue
        has_file.add(d)
        norm = open(os.path.join(dp, "normalize.ts"), encoding="utf8").read()
        names = [n for n in re.findall(r"export function ((?:normalize|make|create)\w+)", norm)
                 if n.startswith("normalize") or "Normalizer" in n]
        if any(re.search(rf"\b{re.escape(n)}\s*\(", engine_src(dp)) for n in names):
            is_wired.add(d)

    # ⚠ THEN FOLLOW DELEGATION. A wrapper directory has no normalize.ts and does not need one: it calls another
    # language's FACTORY, and that engine normalizes on its behalf.
    #
    # ⚠ "IMPORTS SOMETHING FROM ../Y AND CALLS IT" WAS THE TEST, AND IT WAS TOO WIDE — the comment here already
    # worried that "a wrapper may borrow only a vowel table", but the test it settled on could not tell borrowing
    # from delegation, and five rows were wrong because of it. `rn` (Kirundi) borrows ONE function from
    # Kinyarwanda — `composeRwandaRundi`, a number composer — and reported `inherited` the moment kinyarwanda
    # gained a normalize.ts, though no Kinyarwanda normalizer runs for it. Four rows were already committed on
    # the same premise: `bar`/`fo` borrow danish's `unitsFirstNumberToWords`, `ba` borrows russian's
    # `phonemizeWord`, `bs` borrows serbian's `phonemizeWord` + `composeSlavicNumber`. All five are ordinary
    # engines with no layer at all, and marking them `inherited` hid them from the planning query this column
    # EXISTS to answer — the worst failure available to it, since a language that needs work reads as done.
    #
    # THE NARROWED TEST: the imported-and-called symbol must be a FACTORY — `createX` / `makeX`. That is what a
    # wrapper actually does (spanish-419 calls `createSpanish`, the Hindi belt calls `makeNativeHindi`, four
    # Sinitic lects call `createHanDictPhonemizer`), and it is exactly what borrowing a word function or a
    # number composer does not do. test/languageCatalogue.test.ts pins BOTH directions — the five borrowers must
    # stay empty and the genuine wrappers must stay `inherited` — so this cannot silently widen back.
    FACTORY = re.compile(r"^(?:create|make)[A-Z]")
    delegates = {}
    for d in sorted(os.listdir(SRC)):
        dp = os.path.join(SRC, d)
        if not os.path.isdir(dp) or d in has_file:
            continue
        src = engine_src(dp)
        for names, other in re.findall(r'import \{([^}]*)\} from "\.\./([a-z0-9-]+)/', src):
            if other == "core":
                continue
            symbols = [sym.strip().split(" as ")[-1].strip() for sym in names.split(",") if sym.strip()]
            if any(FACTORY.match(sym) and re.search(rf"\b{re.escape(sym)}\s*\(", src) for sym in symbols):
                delegates[d] = other
                break

    def normalizes(d, seen=()):
        """Does a layer run for this directory, its own or a delegate's? Cycle-guarded."""
        if d in is_wired:
            return True
        if d in seen or d not in delegates:
            return False
        return normalizes(delegates[d], (*seen, d))

    rows = list(csv.DictReader(open(TSV, encoding="utf8"), delimiter="\t"))
    cols = list(rows[0].keys())
    if "normalization" not in cols:
        cols.append("normalization")

    counts, changed = {}, 0
    for r in rows:
        code, served = r["code"], (r.get("served_by") or "").strip()
        d = dirs.get(code)
        if r["decision"] != "implemented":
            v = ""                                   # not implemented: normalization is not yet a question
        elif d is None:
            v = ""                                   # implemented but the registry does not name a directory
        # ⚠ THE DIRECTORY'S OWN LAYER OUTRANKS `served_by`, and testing served_by first got two rows wrong. `af`
        # carries `served_by='native'` — a SENTINEL, not a language code — and Afrikaans has its own normalize.ts;
        # `zsm` points at `id` but resolves to the `malay` directory, which has its own. Both reported `inherited`
        # when a layer written for them was running. `served_by` says which ENGINE serves the row, and that engine
        # may be this row's own.
        elif d in is_wired:
            v = "done"
        elif d in has_file:
            v = "partial"
        elif normalizes(d) or (served and served != "native" and normalizes(dirs.get(served, ""))):
            v = "inherited"                          # a wrapper, or a row served by another engine that normalizes
        else:
            v = ""
        counts[v or "(none)"] = counts.get(v or "(none)", 0) + 1
        if r.get("normalization", "") != v:
            changed += 1
        r["normalization"] = v

    print(f"  {', '.join(f'{k}={v}' for k, v in sorted(counts.items()))}   ({changed} cell(s) differ from the file)")
    if check:
        return
    with open(TSV, "w", encoding="utf8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {TSV}")

if __name__ == "__main__":
    main()
