# Guaraní (gn) — C# port investigation

Chronological log of the runs behind the gn port.

## Run 1 — 2026-08-29 21:20 — scope

    wc -l src/languages/guarani/*.ts csharp/goldens/gn.tsv
        176 guarani.ts · 11 manifest.ts · 395 normalize.ts · 113 numbers.ts · 200 gn.tsv (rows)

The smallest shape the port has met recently: the engine is a longest-match scan plus one
context rule (the ⟨g⟩/⟨gu⟩/⟨g̃⟩ branches), stress is computed, not scanned, and the number
composer is a transparent multiplicative system. The weight is the normalizer — eleven
ordered steps, a shared-tier call in the middle, and a refusal behind most of the words.

    Registry.cs already routes `case "gn": return Create("guarani")` — only the factory was missing.
    csharp/goldens/gn.tsv (200 rows) exists, so the gate applies from the first run.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each of these is a place where the C# spelling of a JS
idiom silently means something else:

  * `VOWEL` is a `Set` of SEGMENTS, not characters: `ɨ̃` is ⟨ɨ⟩+U+0303, two code points, and the class
    only works because the engine compares whole segments. A port that splits it into `IPA_VOWEL` +
    `TILDE` would stop recognising the nasal ⟨y⟩.
  * the ⟨g̃⟩ branch claims BEFORE the plain ⟨gu⟩ test and before the digraph loop — `hag̃ua` and
    `og̃uahẽ` mis-read as [ɰ̃u] if the order slips.
  * the scan indexes by UTF-16 code unit in the TS. The token class is Latin + `’` + U+0303, all BMP, so
    code-point iteration is equivalent here — but it is equivalent by the ALPHABET, not by accident: an
    astral letter reaching the scan would make the two differ.
  * `numberToWords(Number(m[2]), m[2])` only for ≤9 digits; longer tokens go to `readDigits(raw)` —
    the raw token, because above 2^53 the double has already lost its low digits.
  * the ordinal step converts its operand to WORDS inside the rule (trap 14): the callback, not a
    substitution string, is what the port needs.
  * `rewrite` in every step is the PROVENANCE seam on the pipeline string; the two callbacks that rewrite
    a MATCHED SUBSTRING (`m.replaceAll`, `m.replace(re)`) must stay off it on `JsRegex.Replace`.
  * eleven ordered steps with three explicit couplings: de-grouping (6) before the tier (8) and before
    everything numeric; the tier (8) above the decimal fold (9) so `NOT_VERSION` keeps its dot; the
    degree-for-ordinal fold (3) before the deletion (4) that eats the leftovers.

## Run 2 — 2026-08-29 21:35 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer.Tests      clean (1 pre-existing warning)
    dotnet test --filter FullyQualifiedName~Guarani     45/45 pass
    dotnet run --project csharp/tools/parity -- gn     gn  OK  200 rows

No correction needed between the port and the gate. The two seam-adjacent callbacks (the de-grouping
replacements) sat off the seam on `JsRegex.Replace` from the first draft, and the poison audit agrees:

    dotnet run --project csharp/tools/parity -- --poison   distinct poison sites: 0 (SUBSTRING 0, desync 0)

`tools/seam-parity.mts` reports the gn rewrite sites in agreement: TS 14, C# 14, gap 0.

## Run 3 — 2026-08-29 21:40 — the mined corpus, the 117 rows the golden does not carry

The gn golden is the MINED tier (no FLEURS exists for gn), so the corpus is the weight. The golden
keeps 200 of the artifact's rows; the full build (`sample` + `hard`, filtered and deduped exactly as
`tools/gen_parity_goldens.mts` builds them, one process, `clearForeignOov()` once, rows in order,
through `phonemizeAsync`) yields 317. The reference was generated with `.probe/gn/run-ts.mts`, the
golden swapped in place for the run and restored after:

    317 mined rows, 317 rendered
    gn  OK  317 rows   0 differ

So the differential is 517 comparisons (200 golden + 317 mined, the overlap counted twice) with
0 differ. No BLOCKED rows: the foreign runs in the mined text reach the English reader, which is
ported, and nothing reaches an unported engine.

## Run 4 — 2026-08-29 21:50 — the mechanical pattern and table audits

`patterns.mts` extracts every regex source from both sides, resolves the C# string escapes (verbatim,
ordinary and the one interpolated TOKEN), and compares:

    18 TS patterns · 18 verbatim · 0 equivalent · 0 mismatch

The TOKEN's spliced hole is `hostWordRun(["Latin"], "'’")` on both sides — the ported shared function
with the same arguments — and the static parts around it are byte-identical. `seam-parity.mts` agrees
(14/14 rewrite sites, gap 0). The hand-written tables were diffed the same way: the symbol-tier words
(`dólar`, `kilómetro`, `centímetro`, `milímetro`, `kilogramo`, `cuadrado`, `cúbico`, `por ciento`,
`sua`) and the number words (`UNITS` 0–10, `COMBINING` 1–9, the four scale consts) are identical in
content to the TS.

## Run 5 — 2026-08-29 21:55 — the full gates

    dotnet test (full suite)      3,717 pass · 0 fail   (45 of them gn: 38 engine, 6+7 cardinals, 1 manifest-mapping)
    dotnet run --project csharp/tools/parity            153 languages byte-identical · 30,105 rows · 0 differ
    --provenance gn   tokens 4520/4520 (100.0%) mapped, nothing lost
    --ipaspans gn     tokens 3758/3758 (100.0%), 0 wrong spans
    npx vitest run test/guarani.test.ts                 23/23 (TS side untouched, still green)

No correction was needed at any point in the port: the first build compiled, the first gate was
200/200, and the widened corpus stayed at 0 differ. The hazard list in run 1 is what kept it that way —
each of those seven items is a place where a plausible C# spelling would have compiled and passed a
naive test while diverging from the TS.
