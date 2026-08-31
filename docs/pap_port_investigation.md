# Papiamentu / Papiamento (pap) — C# port investigation

Chronological log of the runs behind the pap port.

## Run 1 — 2026-08-31 13:30 — scope

    wc -l src/languages/papiamento/*.ts csharp/goldens/pap.tsv
         154 papiamento.ts · 108 normalize.ts ·  85 numbers.ts · 200 pap.tsv (rows)

The engine is a greedy longest-match scan with two creole hallmarks (the coda-⟨n⟩ → [ŋ] retention
with vowel nasalization, and the ⟨ou⟩ diphthong that counts as one stress nucleus), degemination
before the scan, and stress computed after it (acute pin / penult default / ultimate for
consonant-final and nasal-final). The normalizer is the weight: the same three-digit test run on
BOTH separator marks (each of `.` and `,` both groups and decimates, per orthography), the era
marker with its sentence-tail callback, degrees in both senses, and the range rules. The number
composer is bespoke (Pattern B): sub-1000 is ONE orthographic word via the ⟨-a⟩→⟨-i⟩ tens stem and
the fused ⟨-ti-⟩ hundred link.

    Registry.cs already routes `case "pap": return Create("papiamento")` — only the factory was missing.
    csharp/goldens/pap.tsv (200 rows) exists, so the gate applies from the first run.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each of these is a place where the C# spelling of a JS
idiom silently means something else:

  * the digraph scan destructures the KEY STRING: `DIGRAPHS.find(([k]) => chars[i] === k[0] &&
    chars[i+1] === k[1])` compares against the key's first/second code unit. The manifest's
    `IReadOnlyList<IReadOnlyList<string>>` row is `[key, value]`, so `p[0]` is the WHOLE key —
    `chars[i] == p[0]` can never match and every digraph silently degrades to two letters.
  * the coda-⟨n⟩ test reads `segs[last].slice(-1)` — the LAST UTF-16 CODE UNIT, so a precomposed nasal
    vowel (one unit) nasalizes and a decomposed one (base + U+0303, two units) does not. C#'s
    `prev[^1..]` is the same; a "cleanup" to code points would change behaviour.
  * the era-marker rewrite callback receives `(match, offset, FULL STRING)` in JS; the C#
    `MatchEvaluator` gets neither, so the pre-rewrite string must be captured for the
    `SENTENCE_TAIL` test (the Aragonese shape).
  * the decimal comma is SPANNED by the tokenizer's number arm (`\d+(?:,\d+)?`), or the tokenizer's
    own `,` claims `24,6` as a pause and the quantity reads as a phrase break.
  * `numberToWords`'s out-of-range arm is `ONES[digitIndex(d)] ?? d` — the `??` passes a non-digit
    through rather than indexing; C# must keep the `DigitWord(…) ?? c` shape (the gn `readDigits`
    defect class).
  * the word path lowercases a WORD, so `Js.ToLowerCase`, not `ToLowerInvariant` (the 28-point gap).

## Run 2 — 2026-08-31 13:44 — first build + tests: 8 failures, two causes

    dotnet build csharp/Vernacula.Phonemizer    clean (1 pre-existing Marathi warning)
    dotnet test --filter FullyQualifiedName~Papiamento
        25/33 pass, 8 fail

Both causes, from the failure text:

  1. **EVERY digraph failed.** `mashin` read *masˈhĩŋ*, `Kòrsou` *ˈkɔɾsɔu*→*ˈkɔɾsɔu* with sh-split
     words throughout — the hazard-list item 1: `chars[i] == p[0]` compared a code point against the
     whole two-letter key. Nothing matched, so ⟨sh⟩/⟨ch⟩/⟨dj⟩/⟨zj⟩ all degraded to letter pairs and the
     stress rule followed the wrong segments. Fixed by comparing against the key's code units:
     `chars[i] == p[0][..1] && chars[i+1] == p[0][1..]`, with the value still `dg[1]`.
  2. **ONE test literal was wrong in the port, not the engine.** `Kòrsou` expected `ˈkɔrsɔu` with a
     plain ⟨r⟩; the TS test file carries U+027E (ɾ) and the golden agrees (`kɔɾsɔu` ×198 in the
     ɾ census). The TS suite passed, so the engine was never in doubt — the hexdump settled it in
     one line. The ported literal was corrected to the byte the TS carries.

The first-draft digraph lookup had compiled and passed 25 tests — the ones whose words carry no
digraph — which is exactly the failure shape the hazard list named: a plausible C# spelling that
compiles and passes a naive test.

## Run 3 — 2026-08-31 13:48 — parity: 200/200

    dotnet test --filter FullyQualifiedName~Papiamento   33/33 pass
    dotnet run --project csharp/tools/parity -- pap      pap  OK  200 rows

    1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

No BLOCKED rows: the foreign runs in the golden (English names, `A Streetcar Named Desire`, `The
Godfather`) reach the English reader, which is ported.

## Run 4 — 2026-08-31 13:55 — the mined corpus + off-golden probes, 557 rows

⚠ **NO FLEURS EXISTS FOR pap** (it is not in the FLEURS code set), so the corpus-wide differential
takes the mined artifact as its haystack, as gn did: `tools/corpus/mined/pap.jsonc`, 248 `hard`
(adversarial against the pattern cells) + 200 `sample` (uniform stride) rows, plus 74 off-golden
probes (one line per normalize arm plus its adversarial neighbour — the three-digit test on both
marks, `0.572` and `1234.567` which neither rule takes, `1.2345`, `5 - 3` the subtraction the sign
rule must refuse, `ba.C.` the era letter inside a word, `32°Celsius` the scale the degree guard
refuses, `20: 169-180.` the page range pap has no four-digit cap for, the flag proportion `5:1:2`
that is not a clock, and the tier words in both orthographies' neighbourhoods) — and 21 word-level
and 14 number-level arms the text cannot reach (the degemination `annn`→`an`, the lone `n` the coda
rule refuses with no preceding segment, the `ou` offglide at word end, `1000000000000` at the
range boundary and `1e15` in the digit arm).

    npx tsx .probe/pap/emit-ts.mts     557 rows (522 texts, 21 words, 14 numbers)
    dotnet run --project .probe/pap/probe.csproj -- .probe/pap/ts.jsonl
        0 differ of 557 rows

The differential compares all four layers per row: `normalizePapiamento` (the NORM column), sync
`phonemize`, async `phonemizeAsync`, and the word/number compositors — so a 0 here covers the seam
and the tier, not just the final IPA.

**MEASURED HAYSTACK COVERAGE** — the 522 corpus texts exercise: digit runs 392, decimals 114,
grouped figures 68, units 65, signs 37, percent 36, hyphen ranges 35, the degree sign 22, currency
23, exponents 20, dash ranges 15, colons 15, fractions 9, era markers 5 (the thin arm; the probes
carry the dedicated era lines). Every normalizer arm is hit by real text, not only by probes.

## Run 5 — 2026-08-31 14:00 — the full gates

    dotnet test (full suite)      5,910 pass · 0 fail   (34 of them pap: 33 engine + 1 manifest-mapping)
    dotnet run --project csharp/tools/parity
        180 languages byte-identical · 34,827 rows · 0 differ · 0 BLOCKED
    dotnet run --project csharp/tools/parity -- --poison pap
        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    dotnet run --project csharp/tools/parity -- --provenance pap
        tokens 7,255/7,255 (100.0%) mapped, nothing lost
    dotnet run --project csharp/tools/parity -- --ipaspans pap
        tokens 6,495/6,495 (100.0%), 0 wrong spans
    npx tsx tools/seam-parity.mts --all
        papiamento   TS 13 · C# 13 · gap 0 · raw .replace 3 = 3
    npx vitest run test/papiamento.test.ts   10/10 (TS side untouched, still green)
    --unported        pap dropped from the list: 183/193 codes ported

The manifest-mapping guard (`PapiamentoManifestIsFullyMapped`) confirms every `papiamento.jsonc`
key a property claims: `digraphs`, `vowelLetters`, `letters`, `nasalized`, with `language`/`name`/
`script` declared as the metadata the TS interface does not carry.

The one defect the port found was its own (Run 2, item 1): a C# spelling of the digraph scan that
the TS destructuring does not license. Nothing was sent back to the TypeScript; the pair moved
together to the goldens without a TS change.
