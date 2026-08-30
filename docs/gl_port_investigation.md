# Galician (gl) — C# port investigation

Chronological log of the runs behind the gl port.

## Run 1 — 2026-08-29 (previous session, time approximate) — scope

    normalize.ts 366 · g2p.ts 239 · numbers.ts 61 · galician.ts 217 · manifest.ts 38

Five modules plus the data manifest `data/languages/galician/galician.jsonc`. The
load-bearing half is `normalize.ts`: fourteen order-dependent steps (digit de-grouping,
era markers, número, dotted capitals, single-dot abbreviations, ordinal indicators,
dot-decimal, currency codes, degrees, clock + three-field timestamp, signs, fractions,
ranges, ídem, initialisms). The g2p is a shallow left-to-right scan — the deltas from
the Spanish shape are ⟨x⟩/⟨j⟩→ʃ, ⟨g⟩ always the velar stop (no jota), ⟨nh⟩→ŋ,
⟨ll⟩→ʎ, plus the vowel-run nucleus/glide classification with accented-weak hiatus
promotion. `numbers.ts` is a long-scale compositor (millón 10⁶, billón 10¹²) over the
manifest's word tables.

**FLEURS exists**: the split is `gl_es`
(`/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/gl_es`, train 2175 + dev 395 +
test 927 = 3497 lines), so PORTING.md's widening (1) — the corpus-wide FLEURS
differential — is available. The 200-row golden `csharp/goldens/gl.tsv` is ledger-tier
(`read_text`), async mode.

No shared-core change was needed. `Registry.cs` already routes `case "gl"`; the factory
registration in `Bootstrap.cs` was the only wiring missing. The closest structural model
read was **Spanish** (the same Ibero-Romance engine shape, the same symbol tier, the
#1122 abbreviation fix this port would re-find).

## Run 2 — 2026-08-29 (previous session) — a live #1122 in the TS, fixed TS-first

The correctness reading of `normalize.ts` found a live defect in the step-4
single-dot-abbreviation callbacks: the pattern is built from `DOTTED_ABBREV`'s own keys
under `i`+`u`, and JS's fold widens `s` onto long s (U+017F — confirmed in
`csharp/fold-pairs.json`, where `s`/`ſ` form a pair; `sr`/`sra` are the only gl keys
containing s). So `ſr. Silva` matched, and the `DOTTED_ABBREV[ab.toLowerCase()]!`
non-null assertion stringified `undefined` into the text — the TS spoke the literal word
"undefined". The Spanish port's #1122 fix is the shape: the callback now declines the
whole match on a table miss. Two TS test assertions pin `ſr.`/`ſra.` (vitest 18→20).

The golden was regenerated after the fix: **byte-unchanged** — no long s occurs in the
`gl_es` corpus, so the defect was unreachable from the golden, which is exactly why the
reading pass exists.

## Run 3 — 2026-08-29 (previous session) — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet run --project csharp/tools/parity -- gl    gl  OK  200 rows

200/200 byte-identical on the first parity run. C#-side gotchas fixed during the port,
none observable in output: the second scale band's local scope collision in
`Numbers.cs` (`r0`/`head0`), `{{L}}` brace-doubling in the interpolated `\p{L}`
abbreviation patterns (single braces kept in the non-interpolated ordinal one), and the
multiple-declarator / expression-lambda rewrites of the TS callback shapes.

## Run 4 — 2026-08-29 (previous session) — the tests, pinned to the reference

`GalicianTests.cs` is the portable half of `test/galician.test.ts` — 117 test cases
(7 Facts + 25 Theories carrying 109 data rows): the ordinal series including the
feminine and the >100 indicator strip, the dot-decimal vs thousands-dot discriminator,
the era markers, the dotted-abbreviation mid/end branches with the kept sentence-final
dot (and the two #1122 `ſr.`/`ſra.` declines), the clock and the three-field timestamp,
the fraction noun/ordinal switch with the denominator bound, the ranges with the
clause-final dash, the number corners (0, 100, 275, 1200, 3e6, 2e9, 1e12, the >2^53
digit-by-digit fallback), the g2p corners (x before vowel vs consonant, j, ɡ, nh, ll,
ñ, ch, hiatus, offglides, the -ns plural velarization, function-word de-accenting), and
the registry wiring.

    dotnet test --filter "FullyQualifiedName~Galician"   117/117  (+1 manifest mapping)

`ManifestMappingTests` gained `GalicianManifestIsFullyMapped` — every key in
`galician.jsonc` is consumed by the C# type.

## Run 5 — 2026-08-29 20:05 — the corpus differential: FLEURS + mined + attest + probes

The differential set, **4413 lines**:

    FLEURS gl_es cols 3+4, deduped        3628   (real running text, casing + lowercase)
    mined hard[].text + sample[]          ~464   (adversarial normalization excerpts)
    attest findings[].examples            ~234   (word-level attestations)
    hand-built probes                        87   (one per normalize arm + neighbours)
    deduplicated total                    4413

First run: **9 of 4413 rows differ**, every one the same single divergence — the letter
W. The TS spells it *uve dobre* (RAG Galician; the committed `LETTER_NAME` table and its
comment both say `dobre`); the C# port carried *uve doble*, a transcription error from
the reading pass. The golden contains no W-initialism row, so the byte-identical golden
gate could not see it — the differential is what caught it. Fixed in
`Languages/Galician/Normalize.cs` (`["w"] = "uve dobre"`); while in the file, the
`ABBREV_ALT` join was made the verbatim TS insertion-order string (behaviourally
identical — the trailing `\.` anchors every alternative — but the contract is the
verbatim pattern).

    C# sync   vs TS sync:   0 of 4413 differ
    C# async  vs TS async:  0 of 4413 differ   (gl has no neural path; sync ≡ async in both)
    C# norm   vs TS norm:   0 of 4413 differ   (both after the pre-pass)

Coverage of the arms, measured over the 4413 lines, not assumed: digit-run 1194 ·
initialism 328 · signs 206 · roman 133 · clock 38 · abbrev 40 · ranges 68 · percent 66 ·
ampersand 50 · degrees 21 · dot-decimal 28 · era-marker 27 · grouping-space 26 ·
fractions 18 · dotted-caps 16 · ordinal-ind 15 · currency 11 · exponent 32 · ídem 3 ·
número 4 · long-s 2. **No arm is uncovered**; the thin ones (ídem, número, long-s) are
reached by both corpus and probes, and long-s is the #1122 pin.

⚠ THE MINED TIER IS TOKENS, NOT SENTENCES — the same caveat the fo port records:
stronger for the normalizer than a frequency-shaped transcript, weaker for sentence
rhythm. The FLEURS lines (3628 of the 4413) carry the other half.

## Run 6 — 2026-08-29 20:20 — leak sweep

    C# outputs (sync + async, 4413 lines):  0 carry a raw ASCII digit or a symbol
    TS outputs (same lines):               0

Scanned for `[0-9%$€£°ºª±−–—=<>÷/&〃℃⁻⁰¹²³⁴⁵⁶⁷⁸⁹]` in the phoneme stream (columns 1–2);
` .` and ` ,` are legitimate clause marks and are excluded. No un-phonemized digit or
sign leaks into either engine's phoneme stream over the combined set.

## Run 7 — 2026-08-29 20:30 — the provenance gates

    parity --poison gl        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    parity --provenance gl    tokens 5382/5382 (100.0%)
    parity --ipaspans gl      tokens with IpaSpan 4932/4932 (100.0%), wrong 0
    seam-parity.mts --all     galician  34  34  gap 0  rawTS 0  rawC# 0

All 34 `Rewrite` sites in `Normalize.cs` (including the inner callbacks — the era loop,
the dotted-abbreviation callbacks, the ordinal callback's inner dot-strip, the fraction
callback's number-to-words, `FeminineOrdinal`'s -o→-a) are legitimate pipeline-string
seams; none is named as SUBSTRING, so nothing was reverted. The two engines carry one
mismatch rule. Re-run after the Run-5 fix because `Normalize.cs` changed; the numbers
are unchanged (the golden carries no W-initialism row).

## Run 8 — 2026-08-29 20:40 — the full gates

    dotnet test (full suite)                 3,781 pass, 0 fail
    parity (ALL goldens)                     153 languages, 30,105 rows, 0 differ
    npx vitest run test/galician.test.ts     20/20

`gl` is gated; nothing moved in the other 152 languages (the fleet count grew from the
fo run's 151 by the mt/ps goldens that landed in later fix commits, not by this port).

## Read for correctness — one fix filed (Run 2), notes otherwise

- **THE LETTER W IS *dobre*, NOT *doble*.** RAG Galician spells double-u `uve dobre`;
  the committed table and its comment agree, and the g2p then reads it [ðˈoβɾe] — the
  ⟨r⟩ is what the C# transcription dropped (Run 5). The golden cannot see letter names
  for letters the corpus never initialisms; the differential can.
- **THE FRACTION DENOMINATOR BOUND (12) AND `num ≤ den` ARE THE SAME CALL TWICE.**
  Step 11's bound separates `1/3 2/3 3/4 8/9` (fractions) from `MARPOL 73/78` (treaty),
  `número 3/4` (issue), `7/8 anos` (age span); the two remaining misfires are recorded
  as such in the TS header, and the C# carries the same comment. Probed.
- **THE ORDINAL INDICATOR BOUND (100) IS HONEST LOSSINESS.** Above it the indicator is
  stripped and the cardinal stands (`o 101º` → *cento un*), because the corpus's large
  `º` instances are kiln temperatures and no source licenses inventing *graos*. The
  100/101 boundary and the grouped `1.000º`/`4.ª` shapes are probed.
- **`°` IS DELIBERATELY NOT AN ORDINAL INDICATOR** — step 7 claims it; the step-5
  comment says so and the probe `30°` vs `30º` pins both sides.
- **THE SPIRANTIZATION SEAM IS #1150-REPORTED** (`noteRewrite("spirantize-across-words", …)`
  on the assembled string), and the C# carries the same `NoteRewrite` at the same site
  — the token's emitted reading is not what ships, and the trace says why.
- **THE SYMBOL TIER DECLARES ONLY `squared`.** The asymmetry against `cubed` is the
  evidence, not an oversight (×13 *ao cadrado* vs ×0 *ao cubo*); an undeclared power
  leaves the superscript where the RAWMARK gate can see it. The `10⁻⁷`/`Pa⁻¹` probes
  exercise the drop identically on both sides.
- **`numbers.ts`'s header says "Covers 0 … <10⁹"** but the code carries the billóns band
  to <10¹⁸ — a stale docstring, not a behaviour; nothing filed. The >2^53
  digit-by-digit fallback (the `raw` argument) is what the `9007199254740993` probe pins.
- **THE TOKEN REGEX'S IBERIAN CONVENTION (dot = thousands, comma = decimal) IS WHY THE
  DOT-DECIMAL RULE EXISTED** — `48.26 km` was *catro mil oitocentos vinte e seis* before
  step 6; the fraction-LENGTH discriminator (1–2 digits = decimal, 3 = grouping) is the
  same call Catalan ships, and the `1.500`/`460.000`/`10.5.3`/`802.11n` probes pin both
  the rule and its recorded version-designation exposure.
