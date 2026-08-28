# #1150 stage 2 — normalizer provenance, the shape (English first)

Stage 1 shipped a `normalize` REWRITE EVENT: one `{before, after}` pair for the whole normalization. That is
the receipt. Provenance is the itemisation — *which input characters produced this normalized token*. This
investigation finds the shape by building a prototype against English, then testing whether the shape
generalises.

## Run 1 — 2026-08-28 — what English's normalizer actually is

    709 lines · 48 `.replace(` · 1 `.split(` · 5 `.slice(` · 0 `matchAll`

    pipeline replaces (`s = s.replace(...)`)   45
    replaces on LOCAL strings inside callbacks  3   (predicates like `int.replace(/,/g,"")`)
    split                                       1   (on a CONSTANT, `MONTH_ALT.split("|")`)
    slices                                      5   (all inside callbacks, READING context)

⚠ **So the whole normalizer is one string threaded through 45 sequential whole-string replaces.** Nothing
restructures the pipeline. That is what makes a mechanical answer possible, and it is the first real finding:
the shape of stage 2 is determined by the shape of the normalizers, and this one is uniform.

## Run 2 — the model, and the mechanical adoption path

Carry a **provenance array** beside the string: `prov[i]` is the `[start,end)` range of the ORIGINAL input
that character `i` derives from. Identity to begin with; each replace keeps the provenance of untouched
regions and stamps the WHOLE match's provenance across the replacement.

Adoption is then a textual substitution, exactly as stage 1 derived the trace at one seam rather than
threading it through 180 modules:

    s = s.replace(RE, REP)   ->   s = tr(s, RE, REP)

Applied mechanically to English: **45 of 45 rewritten**, `s` the only pipeline variable.

## Run 3 — measured, and the prototype was wrong in an instructive way

First run over `csharp/goldens/en.tsv`: **198/200 identical, 2 differ** — `Jr.` stayed `Jr.`.

⚠ **THE BUG WAS MINE AND IT NAMES A CONSTRAINT ON THE REAL DESIGN.** The prototype re-ran the regex against
the isolated match text to compute the replacement. A pattern with a LOOKAHEAD — English has many, e.g.
`\bca?\.\s*(?=\d{3,4}(?!\d))` — cannot match `m[0]` alone, so the replacement silently did not apply. The
helper must invoke the replacer with the SAME arguments `String.replace` passes, **including the offset and
the whole string**, which several English callbacks genuinely read (`all.slice(at + whole.length)` at
normalize.ts:583, `full.slice(off + whole.length)` at :657).

After fixing that: **200/200 identical, provenance length equals output length on every row (total
coverage).**

## Run 4 — ⚠ the reordering claim I made in #1150 and #1153 was WRONG

I wrote that mapping back "is not an offset problem — normalization REORDERS", citing Luganda's measure noun
moving ahead of its number. Measured:

    en   200/200 identical   NON-MONOTONIC 0
    lg   201/201 identical   NON-MONOTONIC 0

The reordering is real but it happens **inside a single match**, so a SPAN-level mapping absorbs it:

    "1 244.7 km²"  ->  "kiromita eza kyebiriga 1244 7"     one span to one span
    "$1,250"       ->  "1,250 dollars"                     the `$` moves, the span does not
    "15%"          ->  "15 ku kikumi"
    "1775–1783"    ->  "1775 okutuuka mu 1783"

Character-level provenance would indeed be non-monotonic here. **Span-level provenance is not**, because the
unit rule matches the number and its unit TOGETHER and replaces them together. The blocker I asserted does
not exist at the granularity stage 2 actually needs.

## Run 5 — does the shape generalise?

The same mechanical rewrite applied to the 17 largest normalizers in the tree, run over their own goldens:

    et lt mn ka rn ky sl rw bs fi sat nso bm sr ak    2,931 rows
    plus en (200) and lg (201)

    identical: ALL          non-monotonic: 0

Two declined for a reason worth recording: `ug` and `ps` export no `normalize<Lang>` under that name, so the
sweep skipped them rather than guessing — a reminder that the entry points are not uniform even where the
bodies are.

## The shape, stated

1. **A `tr()` helper replacing `s.replace()`** — same regex, same replacer, same order, plus an ambient
   provenance array. Adoption per normalizer is a mechanical substitution, ~15–48 sites each.
2. **Span granularity, not character.** It is what makes the mapping monotonic, and it is the granularity a
   consumer wants anyway ("this token came from those characters").
3. **The replacer contract must be honoured exactly** — offset and whole-string arguments included. This is
   the one place a naive wrapper breaks, silently, on lookahead patterns.
4. **It composes with stage 1 for free.** A trace token already carries a span into `normalized`; provenance
   maps that span to the input, so `token → input characters` is a lookup rather than a new mechanism.

### What is still unknown, and should be measured before committing

  * **180 normalizers × 2 engines.** This sweep covered 17 of them, chosen as the largest. Uniformity held,
    but "the largest" is a biased sample — the small ones may use shapes the rewrite does not cover.
  * **Non-`replace` transformations.** English has none in its pipeline; another engine may (a `split`/`join`
    round trip, a manual rebuild). Those need per-site work, and the sweep would show them as `differ`.
  * **The registry pre-passes** (markup stripping, digit folds, Roman numerals) run BEFORE the engine's own
    normalizer and are not covered by a per-normalizer rewrite.
  * **Cost in the hot path.** The prototype allocates a `[start,end)` pair per character per step. That is
    fine for a diagnostic and probably not fine for `phonemize()`, so provenance must be OFF unless a trace
    is running — the same discipline stage 1 uses.
