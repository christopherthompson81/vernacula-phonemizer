# Scottish Gaelic (gd) — C# port review

The port lands on `port-scottish-gaelic-csharp`. This is the review of it. The port's own evidence is in
the PR body; the TS bring-up evidence lives in `src/languages/scottishgaelic/` (the corpus counts and
the four refused classes are in the `normalize.ts` header).

gd is the one Goidelic port that needs no companion: Irish's engine is lexicon-bound and was ported
first, but this engine is self-contained (a rule scan over `scottishgaelic.jsonc`), so there is no
TS-first fix to chase and no `PAIRED-FIX PENDING` marker to leave behind.

## Run 1 — 2026-08-31 15:20 — the committed golden and the ported suite

```
$ dotnet test --filter FullyQualifiedName~ScottishGaelic
Passed!  77/77

$ dotnet run --project csharp/tools/parity -- gd
  gd       OK    200 rows
1 languages byte-identical, 0 differ (200 rows ok, 0 differ)
```

The 77-test suite is the portable half of `test/scottishgaelic.test.ts`: the pre-aspiration and
lenis-stop rows, the 25-row numeral table, the 0..20000 leak walk, and the normalization branches —
including the two the corpus alone cannot see, the glued-suffix guard (`3 s` stays `3 s`) and the
three-digit-on-both-marks case (`32.976.026`).

The 200-row golden was generated from the mined corpus (gd has no FLEURS split), so it pins the
normalization layer too. Full fleet after the port: 5,979 tests pass, and the whole parity gate is
181 languages / 34,895 rows / 0 differ.

## Run 2 — 2026-08-31 15:41 — the four seam gates over a 3,274-row TS-sourced reference

The golden is 200 rows; the differential is wider. The reference (a throwaway script, deleted after
the run) unions every gd text in the repo:

- the mined corpus `tools/corpus/mined/gd.jsonc`, `sample` + `hard`, with `gen_parity_goldens.mts`'
  own filters (length 20–400, residual markup rejected, duplicates dropped) — 339 rows;
- the committed 200-row golden;
- the TS suite's inputs, read straight out of `test/scottishgaelic.test.ts`;
- the numeral compositor walked across its seams: every power boundary (0, 10, 11, 12, 19, 20, 99,
  100, 199, 999, 1000, 1009, 999999, 1000000, 999999999, 1000000000, …) plus a stride of 7 through
  20,000, each as `N duine` so the number arm and the g2p both run.

3,274 unique rows. Written over `csharp/goldens/gd.tsv` for the run, the committed golden restored
afterwards (md5 checked), the script deleted.

| gate | result |
|---|---|
| parity | 3,274/3,274 rows byte-identical, 0 differ |
| `--provenance` | 16,035/16,035 tokens mapped (100%) |
| `--ipaspans` | 14,870/14,870 tokens with IpaSpan (100%), 0 wrong |
| `--poison` (Debug) | 0 distinct poison sites |

No defect surfaced in either run. The two sites a future editor could most easily "improve" into a
divergence are commented in the port itself: the `#1122` miss branch in the two dotted-abbreviation
callbacks (`Normalize.cs` — the pattern is built from the table's own keys under `i`+`u`, so an
indexer would throw where the TS returned the match unchanged), and the `segs.Count > 0` guard on
the word-final ⟨dh⟩/⟨gh⟩ drop (`ScottishGaelic.cs` — without it a bare word-initial digraph is
consumed before the lenition branch can resolve it).
