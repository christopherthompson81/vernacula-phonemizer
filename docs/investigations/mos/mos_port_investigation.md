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

---

# Review (2026-08-31)

The port was reviewed on the rebased branch. Runs 8–14 are the review's own measurements; where they
contradict a claim above, the later run is the correct one.

## Run 8 — 2026-08-31 10:52 — the rebase ate a `[Fact]`, and the test would have passed by not running

`ManifestMappingTests.cs` conflicted on rebase: both sides had appended a mapping test to the end of
the file. The conflict is trivially additive and the resolution is "keep both" — but the `[Fact]`
attribute above the Mossi test belonged to the HEAD side's hunk, so keeping both left:

```csharp
    public void MossiManifestIsFullyMapped() =>          // ← no [Fact]
```

That compiles, reports nothing, and never runs. ⚠ A silently-skipped test is worse than a missing one,
because the suite's green count still goes up. Restored the attribute and audited the whole file rather
than just the hunk: **149 mapping tests, 0 missing `[Fact]`**.

The exemption list on the Mossi entry (`"language", "name", "script", "provenance", "convention"`) was
checked rather than accepted — `mossi.jsonc` has 8 top-level keys, the C# maps the 3 that carry data,
and `convention` is prose documentation exempted in 85 other places fleet-wide. Nothing is hidden by it.

## Run 9 — 2026-08-31 11:04 — the corpus differential the PR calls impossible

The PR body and Run 1 above both say:

> **No FLEURS for mos** … so the corpus-wide differential … is not possible

FLEURS mos is genuinely absent. But the evidence the TS header itself cites is in the repo:

```
tools/corpus/mined/mos.jsonc            169,882 bytes
tools/corpus/attest/mos.jsonc            23,712 bytes
tools/referee-eval/referees/mos.wiktionary-mos.tsv
```

Built the differential from those plus the golden — **861 unique texts, 0 differ on `norm`, 0 differ on
`word`, 0 differ on `text`**. This is the second port in a row (see `docs/investigations/cdo/cdo_port_investigation.md` Run 1)
where "no FLEURS" was generalised into "no corpus". The absent artifact is FLEURS; the differential is
a separate question and should be asked separately.

## Run 10 — 2026-08-31 11:10 — the walks, exhaustive where the space is finite

| walk | rows | differ |
|---|---|---|
| numbers — 0–200,000 exhaustive, ±1,100 around 10⁶/10⁹/10¹²/2³¹/2⁵³, 80k random to 10¹⁵, non-finite, astral and lone-surrogate operands | 291,122 | 0 |
| g2p — every grapheme in 6 positions, **every letter doubled** in 6 positions (the whole gemination domain), ⟨n⟩ before every letter and every letter before ⟨ng⟩/⟨nk⟩ (the whole assimilation domain), every grapheme **pair** (2,209 — where greedy longest-match fires or is defeated), and the `latinPhone` miss branch | 2,728 | 0 |
| normalizer adversarial + astral fuzz — every separator × head × group-count × 11 trailing contexts, the documented corpus instances and their neighbours, 30k random astral/lone-surrogate/invisible strings, 4 digit families × 8 operand frames — on `norm`, `word`, `text`, `num` | 25,477 ×4 | 0 |
| token/script boundary — every ordered pair of 12 scripts, 5 combining marks in 9 positions each, the ʼ/' variants | 989 | 0 |

The `(int)` casts in `Numbers.cs` were checked for overflow rather than assumed safe: the largest value
cast is `n % 1e9` ≤ 999,999,999, inside `int`. The 2³¹ seam rows confirm it.

## Run 11 — 2026-08-31 11:18 — an instrument that was silently lossy, and everything it had already blessed

The fuzz run reported a `norm` difference. It was **my harness, not the port**. The TS side encoded
output as:

```ts
[...got].flatMap((c) => [...c].map((x) => x.charCodeAt(0)))
```

`[...c]` on an astral character yields ONE element, so `charCodeAt(0)` returns only the HIGH surrogate
and the low half is dropped. The C# side encoded all UTF-16 units correctly, so every astral character
in the output read as a difference.

⚠ The real cost is not the false positive, which is loud. It is that this encoder had already been used
for the number, g2p and corpus walks, where it was silently **discarding half of every astral
character** — so a genuine astral divergence in those runs could not have been seen. Fixed
(`Array.from({length: got.length}, (_, i) => got.charCodeAt(i))`), verified round-tripping `𠀁`, and
**every earlier walk was re-run under the corrected encoder**: numbers 291,122 · g2p 2,728 · corpus
861×3, all still 0 differ. A clean result from a lossy instrument is not a clean result.

## Run 12 — 2026-08-31 11:24 — pattern diff, and the one the fleet instrument cannot see

Static diff by codepoint and flags, TS regex literals scanned from source against C# `JsRe` reflected
through static fields and delegate closure state: **12 TS patterns, 12 matched, 0 TS-only.** The one
C#-only entry is the shared-tier `BARE_UNITS` pattern from `MakeBareUnitNormalizer`, which lives in
`core/normalizeSymbols.ts` and is outside a mossi-only source scan — scope, not divergence. The
zero-width class folds to identical once `\uXXXX` is unescaped; it was also compared codepoint by
codepoint (U+200B U+200C U+200D U+2060 U+FEFF, five characters, the last the BOM).

⚠ The C# reflection returned NOTHING for `MossiPhonemizer` at first, and the reason matters: the
manifest loader resolves `data/` by walking up from `AppContext.BaseDirectory`, so a probe built
outside the repo tree throws its type initializer and every field reads as `null`. `VERNACULA_DATA_DIR`
is the supported way out. An instrument whose subject failed to initialise reports an empty set, which
looks exactly like agreement.

`regex-diff` (the fleet's source-based instrument): **141,068 probe results identical, 0 DIFFER, 0
threw**, corpus fresh, 6 mos patterns present. ⚠ But the corpus entry for `TOKEN` is
`([ʼ'']*)|(\d+)|([.!?…,;:])` — the extractor dropped the `\p{Script=Latin}` parts, so **the tokenizer is
not actually covered by regex-diff**. That is why Run 10's token/script walk exists; the header's claims
about foreign scripts becoming unclaimed are load-bearing and needed their own evidence.

## Run 13 — 2026-08-31 11:36 — seam gates widened, and the leak sweep's second version

Golden-swap widening, 29,064 TS-sourced rows (corpus + fuzz + g2p walk), restored afterwards as its own
command and verified byte-identical to the committed golden:

```
parity       29,064 rows ok, 0 differ
provenance   117,945/117,945 tokens (100.0%)
ipaspans     0 spans that do not cover what the token emitted
poison       0 SUBSTRING, 0 desync
```

The first leak sweep over those 29,064 rows reported 20,487 strays — tone bars, affricate ties, ɕ, ʰ.
Meaningless: my own fuzz had injected Han, Thai, Greek and Devanagari, and those are the shared script
router doing its job. Restricted to Latin-subject rows (7,888), with a planted `ħ` proving the
instrument can fail: **30 strays, 4 distinct** — `ø y ͡ ɔ`, every one from `latinPhone` reading a
foreign letter in a loanword (`Ötzi`, `Hüseyin`). That is the documented "⚠ NOT SILENTLY" miss branch,
identical in both engines.

## Run 14 — 2026-08-31 11:44 — the rest

Test-case diff, mechanical rather than argued: **48 TS `(input, expected)` pairs, 48 with a C# twin, 0
missing**; C# adds 6. No duplicate `InlineData` rows (which xUnit silently skips). Entry points mirror
the TS — `say = createMossi().text` → `Text`, and TRAP 58's registry call → `Say` — so the raw-engine
and full-pipeline tests test what they claim to.

Culture sweep over `Languages/Mossi/*.cs`: casing and normalization through `Js.*`, `VOWEL_LETTERS` on
`StringComparer.Ordinal`, grapheme lookups on the default (ordinal) string comparer, and
`OrderByDescending(k => k.Length)` a stable integer-keyed sort matching JS's stable
`b.length - a.length`. Checked the JS `Object.keys` integer-key trap that would reorder the greedy
scan: no integer-like grapheme keys, and only lengths 1 and 2 exist, so both engines partition
identically.

⚠ One divergence found and shown unreachable. The gemination guard is JS truthiness against C#
`ContainsKey`:

```ts
if (!VOWEL_LETTERS.has(c) && w[i + 1] === c && G[c]) {        // "" is falsy → falls through
```
```csharp
if (!VOWEL_LETTERS.Contains(...) && ... && G.ContainsKey(...)) // "" is found → fires
```

An empty-string grapheme value would split the engines. There is none (0 empty values across
`graphemes`, `vowelLetters`, `clausePunctuation`), so it is unreachable by construction — worth a note
if the table ever becomes data-driven from a source that can emit `""`. This is the same shape as the
`rimes`/`rimesLoose` finding in `docs/investigations/cdo/cdo_port_investigation.md` Run 3.

## Gates

```
dotnet test                     5,728 passed, 0 failed
parity -- mos                   200/200 byte-identical
parity (full fleet)             176 languages byte-identical, 0 differ (34,339 rows)
golden-swap widening            29,064 rows · provenance 117,945 · ipaspans 0 · poison 0
regex-diff                      141,068 identical, 0 differ
TS twin suite                   21/21
seam parity                     mos absent from the disagree list (23 disagree, all pre-existing)
```

## Standing

Nothing outstanding against the port. The claim that should not be carried forward is "the corpus-wide
differential is not possible" — see Run 9.
