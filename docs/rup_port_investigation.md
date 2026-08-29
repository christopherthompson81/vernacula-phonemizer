# Aromanian (rup) — C# port investigation

Chronological log of the runs behind the rup port. Branch `port/rup-aromanian`.

## Run 1 — 2026-08-29 09:20 — what is there to port?

    wc -l src/languages/aromanian/*.ts
        122 aromanian.ts · 176 normalize.ts · 100 numbers.ts = 398

Everything it imports is already ported — `Clauses`, `JsRegex`/`JsRe`, `HostWord`, `NormalizeSymbols`,
`Rewriter`, `LoadManifest` — so **no shared-core change was needed**, and `Registry.cs` already routed
`case "rup": return Create("aromanian")` (Registry.cs:617). The manifest (`data/languages/aromanian/
aromanian.jsonc`) is read by both engines through the shared `data/` tree — not ported, only loaded.

Porting notes, all of which the contract already covers:

  · **The manifest's `digraphs` is a pair array** (`[["ts","t͡s"], …]`, the TS types it
    `[string, string][]`), not an object. `IReadOnlyList<string[]>` binds natively; `Manifest.DIGRAPHS`
    turns it into a lookup keyed by the whole grapheme. The TS scan tests `c === k[0] && nx === k[1]`,
    which for two-letter keys is whole-key equality — the lookup is exactly that.
  · **`renormalize(input, "NFC")` sits in `text()`, not in normalize.ts** — the Abkhaz shape, not the
    Akan one. Ported as `Rewriter.Renormalize` inside `Engine.Text`, so the seam sees the same order.
  · **The era and abbreviation callbacks read the match's following text** (`full.slice(offset + m0.length)`
    in TS). Ported as a closure over the string `Rewrite` is operating on — the reassignment happens only
    after `Rewrite` returns, so the captured value is the one being replaced.
  · **The inner separator replaces stay off the seam.** `rest.replace(/\./gu, " ")` and the space-group
    `rewrite(rest, …)` in the TS operate on a MATCHED SUBSTRING; the C# seam asserts the pipeline string,
    so those are `JsRe.Replace` (the Albanian precedent). The outer step rewrites are `Rewrite`.
  · **The final whitespace collapse is `String.replace`, not the TS `rewrite` seam** — ported as
    `WS_RUN.Replace(s, " ")`, off the seam on purpose.
  · **The space separators are spelled as escapes** (`[ \u00a0\u202f\u2009]`), per the nso lesson (#1109):
    a literal NBSP typed through a shell path is the trap.
  · **The digit-by-digit fallback KEEPS non-digit code points** (`ONES[Number(d)] ?? d`) — unlike the
    Albanian port's `Where`, which drops them. A `1e+21`-shaped input would keep its `e`.

## Run 2 — 2026-08-29 09:35 — does rup have a FLEURS corpus? (checked, not assumed — the #1102 lesson)

    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/ | grep -i rup   →  (empty)

**rup genuinely has no FLEURS split.** PORTING.md's widening (1) is therefore unavailable, and the weight
falls on the two corpus artifacts plus hand probes — the tn/la situation, not the mn one. The artifacts
exist: `tools/corpus/mined/rup.jsonc` (1,492 segments, 27/36 cells) and `tools/corpus/attest/rup.jsonc`.

## Run 3 — 2026-08-29 09:55 — first build + test run: 13 failures, two transcription bugs

`dotnet test --filter AromanianTests` → **13 failed / 26 passed** out of 39. Two root causes, both my
transcription, both caught by the portable half of `test/aromanian.test.ts` on the FIRST run (which is the
job that half exists to do):

  1. **A lookbehind transcribed as a lookahead.** The TS grouping patterns open `(?<!\d)(?<![\d][.,])…`;
     I wrote `(?!\d)` in both `GROUP_SEPARATED` and `GROUP_SPACE`. `(?!\d)` at the match position rejects
     every position where a digit follows — i.e. every position where the pattern could start — so the
     rules matched nothing and every group/decimal figure passed through intact.
  2. **The digraph table was built from key+value.** `ToDictionary(p => string.Concat(p[0], p[1]), …)`
     concatenated the pair's KEY and its IPA (`"ts" + "t͡s" = "tst͡s"`), so no lookup ever hit and every
     digraph fell through to its two single letters.

Fixed both (lookbehind restored; the key is `p[0]` itself). Re-run: **39/39 pass**.

⚠ The two bugs are the standing warning in PORTING.md made concrete: the pattern strings must be
byte-identical to the TS, and "never hand-translate a pattern" means exactly this class — a one-character
slip in a lookaround that no golden row exercises is invisible to the gate and only the per-arm test
catches it. Both slips happened on the first write and both were caught before the first gate run.

## Run 4 — 2026-08-29 10:00 — the parity gate

    dotnet run --project csharp/tools/parity -- rup
        rup      OK    200 rows
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

**200/200 byte-identical on the first run** (async goldens, per the gate's contract).

## Run 5 — 2026-08-29 10:05 — the differential, since there is no FLEURS

Harness in `.probe/rup/` (its own subdirectory, per the four-times-wrong rule): `extract.mts` pulls the
mined `hard`+`sample` segments and the attest `findings[].examples`; `probes.txt` is one line per arm of
`normalize.ts` plus its adversarial neighbour and the g2p corners the corpus lacks (the ⟨ndz⟩ reflex with
both vowel classes, silent-softener ⟨ci gio⟩+V, hiatus `educatsie`, the glide exclusions, `î/â→ɨ`, the
out-of-inventory letters through the nativiser, the numeral boundaries `99999999999` / `1000000000000` /
`9007199254740993`, the NBSP and thin/hair-space group separators spelled as escapes).

    .probe/rup/all.txt = 718 unique lines
        582  tools/corpus/mined/rup.jsonc (hard+sample) + tools/corpus/attest/rup.jsonc (examples)
        200  the golden's own text
        ~116 hand probes (after de-dup against the other two)
    × sync AND async = 1,436 comparisons
        npx tsx .probe/rup/probe.mts .probe/rup/all.txt            → ts.tsv (718)
        VERNACULA_DATA_DIR=$PWD/data dotnet run --project .probe/rup -- all.txt → cs.tsv (718)
        diff ts.tsv cs.tsv  →  identical

**Result: 1,436 comparisons, 0 differ, 0 throws on either side.** The leak sweep over every output for a
raw digit or symbol (`[0-9%$£°º²³×=&/]`) returns **0 lines of 1,436**.

What the haystack actually contains: the mined artifact carries the digit run (528 corpus-wide), the
dotted date, the era marker (×2), the colon apposition (×28 corpus-wide), the four separator conventions
and the `di`-particle unit — the corpus's own headline sentence (`206,235 … 111,2 km2`) is in `hard`. The
degree sign and `=` are the declared losses (no degree word exists; `=` is a definitional gloss) and are
DROPPED by the tokenizer, not leaked — the sweep confirms neither reaches the IPA.

## Run 6 — 2026-08-29 10:08 — the seam adoption, measured

    dotnet run --project csharp/tools/parity -- --poison rup
        distinct poison sites: 0  (SUBSTRING 0, desync 0)
    dotnet run --project csharp/tools/parity -- --provenance rup
        1 languages · tokens 5550/5550 (100.0%)
    dotnet run --project csharp/tools/parity -- --ipaspans rup
        1 languages · tokens with IpaSpan 4735/4735 (100.0%), spans not covering: 0

No site to revert: every `Rewrite` in the port is on the pipeline string, every substring operation is on
`JsRe.Replace`, and the mapping is complete both ends.

## Run 7 — 2026-08-29 10:12 — reading for correctness, not only fidelity

All 14 patterns in `normalize.ts` plus the engine `TOKEN` and the `feminine` regex in `numbers.ts` were
checked against the TS source: byte-identical or semantically identical (the `–—` class and the
sentence-end quotes spelled as `\u` escapes in C#, as the Albanian port does). The clause-mark class in
`TOKEN` is `[.?!,;:…]` with `…` verified to be U+2026, not three dots.

The three questions:

  1. **WHAT DOES EACH FILE'S DOCSTRING PROMISE?** The g2p owns exactly the five context rules it names
     (⟨dz⟩/⟨ndz⟩ reflex, c/g softening with the silent i, rising diphthongs, glides, final-⟨-u⟩
     desyllabification); the normalizer's steps are all present in the documented order (dotted date first;
     separators before the tier; the tier before the range; the dash span before the era while the dot is
     still in place); the composer covers 0 … <10¹² with the digit-by-digit tail. Nothing promised is
     missing.
  2. **IS EVERY TABLE REACHED?** All three manifest tables are consulted by the scan (`digraphs` →
     `DIGRAPHS`, `vowelLetters` → `VOWEL_L`, `letters` → `LETTER`); `ManifestMappingTests` now pins the
     key set structurally (new `AromanianManifestIsFullyMapped`).
  3. **WHICH PATH DOES THE INSTRUMENT MEASURE?** The gate calls `PhonemizeAsync`; rup is not a neural
     language (checked `neuralRegistry.ts` and `NeuralRegistry.cs` — no entry), so async and sync are the
     same engine, and the differential measured BOTH anyway.

**No defect found in the TypeScript by the read** — the two findings of the port were the transcription
errors of Run 3, both C#-only, both fixed on this side. Nothing to file.

## Recount

`csharp/STATUS.md` said 136 of 193 at its 2026-08-28 snapshot; the branch it was written against has since
gained `sq`, `ab` and `an`. Rebased onto `origin/main` (through `an`, #1164) and re-gated: the fleet gate
before this port is **139 languages / 27,427 rows**; after, **140 languages / 27,627 rows, 0 differ,
0 BLOCKED**. The rebase touched no shared code (the `an` commit is Aragonese-only plus its two
registration lines), so the differential was re-run rather than re-derived: unchanged at 0 differ.

## Gates (post-rebase, re-measured)

    csharp tests            2,921 pass (39 in AromanianTests.cs + 1 manifest mapping; 53 more from an), 0 fail
    TS tests                test/aromanian.test.ts 14/14 (unchanged)
    parity, rup             200/200 byte-identical, 0 differ, 0 BLOCKED
    parity, fleet           140 languages, 27,627 rows, 0 differ, 0 BLOCKED
    differential            1,436 comparisons (718 lines × sync + async), 0 differ, 0 throws — re-run post-rebase
    leak sweep              0 of 1,436 outputs carry a raw digit or symbol
    poison                  0 sites (SUBSTRING 0, desync 0)
    provenance              5,550/5,550 tokens mapped (100%)
    ipaspans                4,735/4,735 (100%), 0 wrong
    typescript              unchanged
