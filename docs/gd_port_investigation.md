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

## Run 3 — 2026-08-31 — the review's own differential, and the one gate that was missed

The port review re-ran the gates independently rather than trusting Run 2's deleted script, and pushed
the differential wider than the corpus-derived reference could reach.

```
$ dotnet test --filter FullyQualifiedName~ScottishGaelic     77/77
$ dotnet test                                                5,979/5,979
$ dotnet run --project csharp/tools/parity -- gd             200 rows, 0 differ
$ dotnet run --project csharp/tools/parity -- gd --provenance --ipaspans
    4,681/4,681 tokens with IpaSpan, 0 wrong
```

Then three generated references, each written over `csharp/goldens/gd.tsv` for the run and the committed
golden restored afterwards (md5 `90549a9f…` checked back):

| reference | rows | result |
|---|---|---|
| hand-picked adversaries (bare ⟨dh⟩/⟨gh⟩, doubled consonants, all-caps, every vowel cluster, every normalization branch, both separator marks) | 159 | 0 differ |
| xorshift fuzz over the Gaelic grapheme inventory + digraphs + punctuation + 50 numeric shapes, 1–6 words | 9,000 | 0 differ |
| the numeral compositor: every integer 0–2,200, a stride through 10^6, every power boundary, `9007199254740991`/`…92`, a 40-digit run, leading zeros, and `N duine` on a stride of 7 through 20,000 | 5,307 | 0 differ |

**14,466 generated rows, zero divergence.** Every expected value in `ScottishGaelicTests.cs` was also
re-derived from the TS engine directly (`phonemizeWord`, `numberToWords`, `normalizeScottishGaelic`,
`phonemize`) and all 77 matched. Nothing in the C# throws where the TS returns: the two documented
seams (`#1122`'s miss branch, the `segs.Count > 0` guard) both hold, and the `LENITABLE` regex
correctly carries `i` WITHOUT `u` so ECMAScript's legacy Canonicalize keeps a long ⟨ſ⟩ out of
`^[bcdfgmpst]` — the case `JsRegexDialectTests.LegacyIDoesNotFoldNonAsciiOntoAscii` names this module for.

**The one real gap: gd was not added to `ManifestMappingTests.cs`.** That gate exists because
System.Text.Json silently deserializes an unmatched JSON member to the type's default — the English
ARPABET failure, where a mangled key cost 42 golden rows and nothing threw. 123 ported languages carry a
`Manifest.cs`; 154 `AssertFullyMapped` facts guard them; gd had none, so a future rename of
`slenderVowels` or `teenWord` would have produced silent `""` rather than a failure. Added and it
passes on the first run — the record does claim every key today, so this was a latent gate gap, not a
live defect. ⚠ Four other codes are in the same state and are OUT OF SCOPE here: `CentralKurdish`,
`Kabuverdianu`, `Luo`, `Umbundu`.

Also applied: the vowel-cluster longest-match in `Scan` was `VOWEL_CLUSTERS.FirstOrDefault(k => …)`,
which allocates a closure capturing `w` and `i` at every vowel of every word. Replaced with the plain
loop the TS `.find()` already is. Parity re-checked byte-identical after the change.
