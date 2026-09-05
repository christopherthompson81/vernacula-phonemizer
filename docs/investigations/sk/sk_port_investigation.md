# Slovak (sk) TS → C# port — review log

⚠ **SCOPE.** This document records the REVIEW of the Slovak port (PR #1240) and the measurements taken
during it — not the port itself, which was written in a separate session that left no log. Where a run
below says "the golden did not catch it", that is a statement about the artifacts as they arrived.

## Run 1 — 2026-08-31 — the era-marker boundary

**Question.** Do the 15 normalizer steps and the g2p match the TypeScript regex for regex?

**Finding — one defect, and it is the kind a golden cannot see.** The five `MULTI_DOT` era/abbreviation
patterns were ported as `(?!\p{L}\p{M})` where the TS has `(?![\p{L}\p{M}])`. Without the brackets the
lookahead is a two-element **sequence** — a letter *followed by* a combining mark — which almost never
matches, so the negative lookahead almost always succeeds and the right boundary is effectively gone:

    "Bol n. lekárom"  → "Bol nášho letopočtuekárom"
    "t. jazyk"        → "to jestazyk"
    "p. n. letopis"   → "pred naším letopočtometopis"

⚠ **NEITHER GATE COULD SEE IT.** Every instance of these markers in the 200-row golden AND in the ported
test file happens to be followed by a non-letter, so the parity gate and the suite both passed with the
boundary removed. That is the shape PORTING.md's "read for correctness, not only for fidelity" section
describes: a defect that only a reading of the pattern finds.

Fixed by restoring `(?![\p{L}\p{M}])` — which is also `Boundaries.NOT_LETTER_AFTER` verbatim — and pinned
with two regression rows in `SlovakTests.cs`.

**Verified against the TypeScript, not just asserted.** 16 boundary probes (`Bol n. lekárom`, `n. l.`,
`n. l`, `n. more`, `xn. l.`, `n. l.a`, `Bol n.lekárom`, …) through `normalizeSlovak` on both engines:
**identical on all 16**, and the behaviour is now right in both — `Bol n. lekárom` untouched, `n. l.`
expanded.

**Swept the rest of the C# tree for the same defect shape** (`(?!\p{L}\p{M})` / `(?<!\p{L}\p{M})` without
brackets). Three hits, all pre-existing and all clean: Croatian's `AMP_INITIALS` is byte-identical to its
own TS (a faithful port of a TS quirk, so the two engines agree), and the Latvian/Albanian hits are
`[\d\p{L}\p{M})²³]` — bracketed, with `)` as a class member. **Slovak was the only instance.**

## Run 2 — 2026-08-31 — the seam gap, which is the CORRECT state

`seam-parity` reports Slovak as disagreeing:

    slovak   TS 35   C# 34   gap -1   rawTS 2   rawC# 3

One TS `rewrite` site is a raw replace in C#. Located: `normalize.ts:132`

    const feminine = (words) => rewrite(words.replace(/jeden$/u, "jedna"), /dva$/u, "dve");

The `jeden$` half is a raw `.replace` in both engines; the `dva$` half is `rewrite` in the TS and
`JsRegex.Replace` in the C#, whose author left the reason in a comment: *"⚠ NOT ON THE SEAM: `words` is a
freshly composed word, not the pipeline string."*

**That comment is right, and it was checked rather than taken on trust.** Every call site —
`normalize.ts:325`, `:326`, `:536` — passes `numberToWords(...)`, a freshly composed numeral string.
PORTING.md is unambiguous: *"Calling it ASSERTS that `s` is the pipeline string … A replace on anything
else — a matched word, one character, a lookup key built in a static constructor — stays on
`JsRegex.Replace`."*

⚠ **AND THE POISON GATE CANNOT ARBITRATE THIS ONE, which is worth writing down.** Flipping the site onto
the seam and re-running gives `distinct poison sites: 0 (SUBSTRING 0, desync 0)` and provenance
`4441/4441 (100.0%)` — *identical to the off-seam spelling*. The golden's three clock rows (11:20, 07:19,
21:19) do not distinguish them. So "poison says 0" is NOT evidence here, the same way `mto`'s `NaN%` was
not evidence; the decision rests on the contract and the call sites, both of which say off-seam. The C#
was left as the author wrote it, and Slovak joins the 23 other languages seam-parity already lists as
disagreeing.

**FILED AGAINST THE TYPESCRIPT (not fixed here):** `src/languages/slovak/normalize.ts:132` calls
`rewrite` on a per-word helper argument. That is a substring call on the provenance seam — the exact
hazard PORTING.md's seam section names — and it is on the TS side, so it needs the TS-first treatment
rather than a C# edit.

## Run 3 — 2026-08-31 — the gates, after a rebase onto current main

The branch was cut before the Shan/Tatar/Totontepec Mixe/Turkmen ports landed, so it was rebased onto
`main` (one conflict, `Bootstrap.cs`'s registration list; all five registrations kept).

    $ dotnet run --project csharp/tools/parity -- sk              → sk OK 200 rows · 0 differ
    $ … -- sk --provenance   → tokens 4441/4441 (100.0%)
    $ … -- sk --ipaspans     → 3940/3940 (100.0%) · 0 wrong
    $ … -- sk --poison       → 0 sites
    $ dotnet run --project csharp/tools/parity                    → 187 languages, 36,095 rows, 0 differ
    $ dotnet test                                                 → 6,361/6,361

Two languages remain unported: `cy`, `hyw`.
