# Faroese (fo) — C# port investigation

Chronological log of the runs behind the fo port.

## Run 1 — 2026-08-29 15:35 — scope

    wc -l src/languages/faroese/*.ts
         246 faroese.ts · 131 normalize.ts ·  58 numbers.ts   (435 total)

Three modules plus the data manifest `data/languages/faroese/faroese.jsonc` (54 lines). The
load-bearing half is the g2p: a greedy grapheme scan in which the CORE rule is that vowel LENGTH
conditions vowel QUALITY (open syllable → long/diphthongal, closed → short/monophthong), with
fixed initial stress, the SKERPING vowel remaps before ⟨gv⟩/⟨ggj⟩, and the context consonant
passes (ð/g deletion with a two-class glide choice, g/k affrication before front vowels,
retroflex r-clusters, ⟨ll⟩→[tl], v-vocalization, hv/hj, the pre-nasal shift). `numbers.ts`
delegates to the shared units-first Germanic composer (`danish/unitsFirstNumbers.ts`, already
ported as `Languages/Danish/UnitsFirstNumbers.cs`) — Faroese only supplies the lexical def:
units-first with "og" fused (einogtjúgu = 21), the modern DECIMAL tens, and the neuter counting
series.

No shared-core change was needed. `Clauses`, `LoadManifest`, `NormalizeSymbols`, `Boundaries`,
`JsRegex`, `HostWord` (word run + nativiser) and `Rewriter` are all ported, and `Registry.cs`
already routes `case "fo"` (Registry.cs:567) — the factory registration in `Bootstrap.cs` was the
only wiring missing. `csharp/goldens/fo.tsv` (200 rows) exists, so the parity gate applied from
the first run. The closest structural models read were **Chuvash** (the same day's port: Seg-class
scan + manifest + normalize + numbers) and **Estonian** (the Latin nativiser shape).

⚠ **NO FLEURS.** Faroese is not among FLEURS's 102 languages — checked in
`/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data` (102 splits, no `fo_fo`), not assumed.
PORTING.md's widening (1) — the corpus-wide FLEURS differential — is unavailable, and the weight
falls on the 200-row golden, the mined + attest corpora, and the off-golden probes. Stated here
because it changes what the gate can and cannot see, not to soften the verdict.

## Run 2 — 2026-08-29 16:10 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean (1 new warning, fixed)
    dotnet run --project csharp/tools/parity -- fo    fo  OK  200 rows

200/200 byte-identical on the first parity run. One build warning was found and fixed before the
green run, C#-only: CS8602 in `ConsonantPasses` — the TS affrication arm guards `next &&`
twice (once computing `fv`, once at the write site), and the first C# draft dropped the second
guard; .NET does not carry the `next is not null` flow through the `fv` boolean. Restored the
explicit guard (faithful, not a "cleanup").

## Run 3 — 2026-08-29 16:25 — the tests, pinned to the reference

`FaroeseTests.cs` is the portable half of `test/faroese.test.ts` — 48 cases across 13 attributes:
the length-conditioned quality with b/d/g→p/t/k, the intervocalic glide by neighbour
(front→j, round→v, front-wins) and the front-vowel affrication (including the ⟨ø⟩ refusal),
the skerping + ng-palatalization hallmarks, the registry wiring, the 11 number-word rows
(units-first og-compounds, the decimal tens, the neuter citation forms, the `ein-` compound one),
the wired numerals, the FIVE JOBS of the full stop (time / thousands / decimal / ordinal /
sentence-end, with the sentence-end survival row), the refused ordinal word, the nine
corpus-sourced abbreviation expansions (with the kept sentence-final dot), the NON-clock colon
(`9:59.91` → `9:59,91`), degrees + the decimal comma + the percent, the range pause (with the
clause-final `s. 96-100.`), and the two #1080 big-numeral rows (2^53+1 keeps its …993; 10²¹
reads 22 digits).

    dotnet test --filter "FullyQualifiedName~Faroese"   48/48  (+1 manifest mapping)

`ManifestMappingTests` gained `FaroeseManifestIsFullyMapped` — every key in `faroese.jsonc`
(language, name, script, vowels, consonants, affricatingVowels, frontGlideVowels,
roundGlideVowels, skerping, skerpingGgj, prenasal) is consumed by the C# type; all camelCase, so
no `[JsonPropertyName]` was needed.

## Run 4 — 2026-08-29 18:30 — the corpus differential, mined + attest

The mined + attest corpora (`tools/corpus/mined/fo.jsonc`, `tools/corpus/attest/fo.jsonc`) were
extracted to **743 unique lines** and merged with **120 hand-built probes** (one per normalize arm
plus its adversarial neighbour, the g2p corners, the number corners) for **863 lines**, run
through all relevant entry points:

    C# sync   vs TS sync:          0 of 863 differ
    C# async  vs TS sync:          0 of 863 differ   (fo has no neural path)
    C# norm   vs TS norm:          0 of 863 differ   (both after the pre-pass)

Coverage of the arms, measured over the 743 corpus lines, not assumed: digit-run 536 ·
ordinal-period 130 · minus 65 · abbreviations ~586 · range 55 · decimal-comma 54 · ampersand 55 ·
decimal-dot 32 · units 42 · percent 37 · exponent 28 · magnitude 28 · degrees 17 · thousands-space
16 · currency 24 · thousands-dot 19 · colon 9 · time 3 · **ordinal-NBSP 0** — the one arm with no
corpus instance, reached by the hand-built `31.<NBSP>desember` probe.

⚠ THE CORPUS IS TOKENS, NOT SENTENCES. The mined artifact is excerpts selected adversarially
against the pattern cells (its header says so), so a "clean" differential over it is stronger for
the NORMALIZER than a frequency-shaped read-aloud transcript would be — and weaker for sentence
rhythm. The 200-row golden (full sentences, generated from the TS engine in async mode) carries
the other half.

## Run 5 — 2026-08-29 18:40 — leak sweep

    C# outputs (sync + async, 863 lines):  0 carry a raw ASCII digit or a symbol
    TS outputs (same lines):               0

No un-phonemized digit or sign leaks into either engine's phoneme stream over the combined set.

## Run 6 — 2026-08-29 18:45 — the provenance gates

    parity --poison fo        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    parity --provenance fo    tokens 5252/5252 (100.0%)
    parity --ipaspans fo      tokens with IpaSpan 4390/4390 (100.0%), wrong 0
    seam-parity.mts           faroese: TS rewrite count == C# Rewrite count (no row)

All 16 `Rewrite` sites in `Normalize.cs` are legitimate pipeline-string seams — none named as
SUBSTRING, so nothing was reverted. The two engines carry one mismatch rule.

## Run 7 — 2026-08-29 18:55 — the full gates

    dotnet test (full suite)                 3,600 pass, 0 fail   (48 Faroese + 1 manifest)
    parity (ALL goldens)                     151 languages, 29,705 rows, 0 differ
    npx vitest run test/faroese.test.ts      13/13 (TS unchanged)

`fo` is gated; nothing moved in the other 150 languages. **TypeScript unchanged** — no defect
found on the reading pass (the three questions per file: the docstring's five-jobs contract is
what the code does; every manifest table is reached — vowels in the scan and the quality
assignment, consonants in the scan and the geminate collapse, the two glide classes and the
affricating set in the passes, both skerping remaps and the prenasal shift in their named sites;
the shipped entry point, the golden and the parity tool all measure `Phonemize`, the same path).

## Read for correctness — notes, nothing filed

- **THE CURRENCY KEY `kr` IS A WORD, NOT A SIGN.** The corpus's postposed abbreviated currency
  `kr.` is NOT expanded by the normalizer — the symbol tier's own key reads it, and the TS header
  records why expanding it first would leave the tier a word it does not match. The C# carries
  the same one-line comment at the tier; the tier is what makes `100 kr.` read *krónur*.
- **`intPart`, NOT the whole match, is the `raw` (#1080).** The number arm's match carries the
  decimal comma and is split, so the token text for the integer is the piece BEFORE the comma —
  the same trap Croatian's call site set, and the reason the C# site carries the comment. The
  two #1080 test rows pin it (…993, not …992; 22 digits above 1e21).
- **THE GEMINATES ARE KEPT THROUGH THE LENGTH COUNT.** A doubled consonant closes the syllable for
  the long/short decision and is only collapsed in the consonant pass — the C# keeps both
  segments in `segs` and empties the second's `Ph`/`G` at the collapse site, exactly as the TS.
  Collapsing earlier would lengthen the stressed vowel of every geminate word.
- **⟨ð⟩ DOES NOT CLOSE THE SYLLABLE.** The length count skips it (`Urð` → long [uːɹ]); the word
  `aðal` reads [ɛaːal] with the silent intervocalic ð. Both are probed.
- **THE SCAN IS UTF-16, DELIBERATELY.** `w[i]` in the TS is a code unit; the C# uses
  `w[i].ToString()` (one unit) rather than a code-point spread, matching PORTING.md's
  "indexing and .Length semantics match JS exactly". Every Faroese letter is BMP, and the
  nativiser folds anything outside the class before the g2p, so the difference is unobservable —
  but it is the faithful reading.
