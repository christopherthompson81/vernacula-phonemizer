# Mossi / Mooré (mos) — C# port investigation

## Run 1 — 2026-08-31 08:30 — scope

    wc -l src/languages/mossi/*.ts
        102 mossi.ts · 23 manifest.ts · 319 normalize.ts · 133 numbers.ts   (577 total)

Four modules plus `data/languages/mossi/mossi.jsonc`. No lexicon, no neural tier. `Registry.cs:710`
already routed `case "mos": return Create("mossi")`; `Bootstrap.cs` was the only wiring missing.
Golden 200 rows present (`csharp/goldens/mos.tsv`). **No FLEURS for mos** — stated in
`normalize.ts`'s own header — so the corpus-wide differential of PORTING.md's first widening is
not possible; the ported test suite (every `normalize.ts` arm plus its adversarial neighbour)
carries that weight instead.

The g2p is a greedy longest-match scan over the grapheme table with two code rules: **consonant
gemination** (a doubled consonant → [Cː]; the manifest's `vowelLetters` list keeps the rule from
firing on a doubled vowel) and **nasal place assimilation** (⟨n⟩→[ŋ] before g/k). The numbers are
decimal with two stem series (full + short combining), the particle `a`, and plural-form
magnitudes; 10⁶/10⁹ are corpus-attested French loans that also supply the compound syntax.

## Run 2 — 2026-08-31 08:55 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer.Tests/…    (1 error: StartsWith overload)
    dotnet run --project csharp/tools/parity -- mos
        mos      OK    200 rows
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first parity run. The one build error was a compile-time slip, caught by the
build and reaching no test: `String.StartsWith(string, int, StringComparison)` does not resolve
the way the first draft assumed; the port now uses the fleet's `StartsWithAt` helper
(`string.CompareOrdinal`), the same idiom the Malagasy, Occitan, Umbundu and Aragonese ports carry.

## Run 3 — 2026-08-31 08:58 — test suites

    dotnet test --filter "FullyQualifiedName~Mossi|FullyQualifiedName~ManifestMapping"
        Passed! 226
    dotnet test (full)
        Passed! 5558
    npx vitest run test/mossi.test.ts
        Tests  21 passed (21)

60 C# cases ported from the 21 TS tests (each `test`'s `expect` fan-out becomes `InlineData`).
One fidelity fix in the port itself: the TS normalization describe's `say` is
`createMossi().text` — the RAW engine, no registry pre-passes — while only the TRAP-58 describe
uses `phonemize()`. The first draft mapped both onto the full pipeline; corrected so the raw-
engine assertions test the raw engine (the pre-passes are no-ops on these inputs, so the numbers
did not move, but the pin now says what it actually checks).

## Run 4 — 2026-08-31 09:02 — seam gates over the golden

    dotnet run --project csharp/tools/parity -- --provenance mos
        1 languages · tokens 8588/8588 (100.0%)
    dotnet run --project csharp/tools/parity -- --ipaspans mos
        1 languages · tokens with IpaSpan 7624/7624 (100.0%)   ⚠ bad: 0
    dotnet run --project csharp/tools/parity -- --poison mos
        distinct poison sites: 0
    npx tsx tools/seam-parity.mts
        153 ported languages compared · 22 disagree   — mos not among them

## Run 5 — 2026-08-31 09:05 — fleet gate

    dotnet run --project csharp/tools/parity
        174 languages byte-identical, 0 differ (33939 rows ok, 0 differ)

## Run 6 — 2026-08-31 09:08 — the currency-escape probe

The one site where a mechanical transliteration was not obviously safe: TS builds the currency
pattern with `sign.replace(/[$]/gu, "\\$&")`. JS and .NET substitution syntax differ — JS
`GetSubstitution` reads `$&` as the matched substring, and .NET has no such token — so the C#
`DOLLAR_ESC.Replace(sign, "\\$&")` was not trusted on reading. Probed both engines
(`.probe/mos/`):

    sign=[€] escape=[€] pattern=[€\s?(\d)]        (both engines)
    sign=[$] escape=[\$] pattern=[\$\s?(\d)]      (both engines)
    norm[$5]      = [doolaar 5]
    norm[€10,000] = [Ero 10000]

Identical patterns, identical behaviour — .NET's `Match.Result` happens to return `\$` for the
three-character replacement, the same bytes JS produces. No code change; the transliteration
stands, and the probe is what says so.

## Run 7 — 2026-08-31 09:10 — pattern diff

All 13 pattern sources compared between the two trees: 12 verbatim-identical; the zero-width
class is the one written differently — the TS spells the five marks invisibly, the C# escapes
them (`[\u200b\u200c\u200d\u2060\ufeff]`), the same convention the Ewe port established, and
semantically identical. The dynamic currency template (Run 6) is the 13th. **0 TS-only.**
