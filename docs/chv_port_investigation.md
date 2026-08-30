# Chuvash (chv) — C# port investigation

Chronological log of the runs behind the chv port.

## Run 1 — 2026-08-29 ~16:40 — scope

    wc -l src/languages/chuvash/*.ts
        217 chuvash.ts · 314 normalize.ts · 91 numbers.ts · 54 romanOrdinals.ts   (676 total)

Four modules, the usual shape for a Kipchak Cyrillic Turkic. The load-bearing half is
`normalize.ts` (314 lines) — the pre-tokenizer pass that rewrites every non-word into a word the
pipeline speaks — with the two signature g2p rules in `chuvash.ts`: ALLOPHONIC VOICING (a voiceless
obstruent voices between vowels, after a nasal+glide, or after a liquid before a full vowel; a
geminate blocks voicing and collapses to a single long [Cː]) and REDUCED-VOWEL STRESS
(⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] are never stressed). `numbers.ts` carries the Oghur TWO NUMERAL SERIES —
FULL/substantival (пӗрре, иккӗ, виҫҫӗ, пиллӗк) for counting and SHORT/attributive (пӗр, ик, виҫ,
пилӗк) before the thing counted — and `numberToWords(n, attr)` takes the flag.

No shared-core change was needed. `Clauses`, `LoadManifest`, `NormalizeSymbols` (the full symbol
tier), `Boundaries`, `JsRegex`, `Initialisms` and `Roman` are all ported, and `Registry.cs` already
routes `case "chv"`. `csharp/goldens/chv.tsv` (200 rows) exists, so the parity gate applies from the
first run. The closest structural model read was **Bashkir** (`Languages/Bashkir/`), the Oghur
sibling ported the same day.

⚠ **NO FLEURS.** Chuvash has roughly one million speakers and no FLEURS split, checked rather than
assumed (the mn/tn/ln/lt/lg/mt/ps/nso class, #1102 — the headers are the unreliable source). So
PORTING.md's widening (1) — the corpus-wide FLEURS differential — is unavailable in its usual form,
and the weight falls on the mined + attest corpora plus the off-golden probes. This is stated here
because it changes what the gate can and cannot see, not to soften the verdict.

⚠ **THE CYRILLIC-CONFUSABLE FOLD IS UPSTREAM AND ALREADY RAN.** cv.wikipedia writes Chuvash's four
special letters in the LATIN look-alike codepoints — ⟨ă ĕ ç ü⟩ U+0103/0115/00E7/00FC — 4,936 times
against 918 for the real Cyrillic ⟨ӑ ӗ ҫ ӳ⟩. Those rows live in `core/unicode.ts`'s
`foldCyrillicConfusables` (chv is in `Scripts.CYRILLIC_HOSTS`) and run in the registry pre-pass
BEFORE the engine, so `normalize.ts` sees already-folded text. Nothing in this port re-derives that
fold; it is inherited. The measurement that made the shared-table change safe is in
`docs/investigations/chv_normalization_investigation.md`.

## Run 2 — 2026-08-29 ~16:50 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean (0 warnings)
    dotnet run --project csharp/tools/parity -- chv   chv  OK  200 rows

200/200 byte-identical on the first parity run. Two build/test bugs were found and fixed before the
green run, both C#-only porting errors (not bidirectional):

- **`NormalizationForm` lives in `System.Text`, not `System.Globalization`, in this .NET 10 SDK.**
  Verified empirically: `using System.Globalization;` fails CS0103, `System.Text.NormalizationForm`
  resolves. Every language file uses `using System.Text;`; chv's `Chuvash.cs` did too.
- **Wrong capture-group indices in the ordinal callbacks** in `Normalize.cs`. In `ORD_SUFFIX` the
  suffix is **group 2** (had used `m.Groups[3]`); in `ORD_RANGE` it is **group 3** (had used
  `m.Groups[4]`). Both read an empty group, so `AttachOrdinal` returned the whole match and the
  ordinal-suffix / ordinal-range rules were silent no-ops. The gate did not catch it — the golden's
  ordinal rows are few and the wrong reading still parsed — but the off-golden probes in Run 5 do.

## Run 3 — 2026-08-29 ~16:52 — the tests, pinned to the reference

`ChuvashTests.cs` is the portable half of `test/chuvash.test.ts` — 73 cases across 22 attributes:
the allophonic voicing and the geminate block, the reduced-vowel stress, the two numeral series
(FULL vs attributive), the unit-times-ten 80/90, the postposed magnitudes, the invariant `-мӗш`
ordinal (no harmony), the ordinal suffix splice (`22-мĕшĕнче` → …иккӗмӗш**енче**), the ordinal RANGE
(`1-5-мӗш`), the clock (three-field and the leap-second `23:59:60`), the space de-grouping, the
magnitude abbreviations, the era marker, № , the signs (`−` U+2212, hyphen, `+`, `±`), the 3-way
degree scale letter (Latin C / Cyrillic С / lowercase с), the numeric ranges, the `пай` fraction,
the initialisms, and the attributive pass.

    dotnet test --filter "FullyQualifiedName~Chuvash"   73/73  (+1 manifest mapping, 74 total)

`ManifestMappingTests` gained `ChuvashManifestIsFullyMapped` — every key in `chuvash.jsonc`
(language, name, script, onset, voiced, vowels, iotated, voicingSonorants, liquids, vowelLetters) is
consumed by the C# type, so no `metadataOnly` exclusion was needed.

## Run 4 — 2026-08-29 ~17:00 — the corpus differential, mined + attest

The mined + attest corpora (`tools/corpus/mined/chv.jsonc`, `tools/corpus/attest/chv.jsonc`) were
extracted to **809 unique lines** (deduplicated, empty dropped) and run through all four entry
points: TS sync, TS async, C# sync, C# async.

    async (the golden's mode):   0 of 809 differ
    sync:                         4 of 809 differ

The 4 sync differences are all embedded **English/foreign** runs, read by the separately-ported
English engine, not Chuvash:

    line 233  "Zheltov, P. … Fomin, J. Luutonen; Lexica Societ…"   (English author names)
    line 266  "…Fratelli d'Italia…"                                (Italian)
    line 432  "…Mb 1."                                             (element initialism)
    line 579  "…258Lr…"                                            (radionuclide; Lr → ɛlɑːɹ vs lˈɝ)

Chuvash Cyrillic content is byte-identical on every line. The async path is byte-identical on all
809 because the async prewarm warms the English memo, so the foreign runs converge (the already-filed
"a Latin-script host never prewarms" class in STATUS.md — both engines keep the current behaviour).

## Run 5 — 2026-08-29 ~17:10 — off-golden probes, targeting the arm gaps

The corpus's own coverage of each `normalize.ts` arm was measured, not assumed, and the gaps were
probed directly. **0-instance in the corpus** (and therefore untested by the 809-line differential):
the fractional de-grouping (`0,000 001`), `±`, and the Fahrenheit degree arm. **Weakly covered:**
the four-group space de-grouping (2 lines). A 70-line probe file was built to hit those gaps plus the
adversarial neighbour each arm must decline (a bare `4/5` with no `пай`, `13/12`, a round-thousand
ordinal, `0-мӗш`, the clause-final `– С. 61-63.`, etc.):

    70 probes × {sync, async}   0 differ, 0 throws

These 70 lines are the ones that would have caught the group-index bug in Run 2 — the ordinal-suffix
and ordinal-range probes are all here.

## Run 6 — 2026-08-29 ~17:15 — leak sweep

    C# outputs (sync + async, 809 corpus + 70 probes):  0 carry a raw ASCII digit or a symbol
    TS outputs (same lines):                            0

No un-phonemized digit or sign leaks into either engine's phoneme stream over the combined set.

## Run 7 — 2026-08-29 ~17:20 — the full gates

    dotnet test (full suite)                 3,417 pass, 0 fail   (73 Chuvash + 1 manifest mapping)
    parity chv                               chv  OK  200 rows
    build                                    0 warnings, 0 errors

⚠ **RECOUNTED AFTER THE REBASE ONTO CURRENT `main`** (which had since taken the ee port; the additive
conflicts in `Bootstrap.cs` and `ManifestMappingTests.cs` were resolved to keep every language):

    dotnet test (full suite)                 3,616 pass, 0 fail   (74 Chuvash + 1 manifest mapping)
    parity, fleet                            151 languages byte-identical, 29,705 rows, 0 differ, 0 BLOCKED

`chv` is gated; nothing moved in the other languages. TypeScript unchanged (both Run-2 bugs were
C#-only porting errors, fixed in C# only per the bidirectional policy).

## Read for correctness — filed, not fixed

- **The four sync-mode foreign-run differences are the English engine, not Chuvash, and both engines
  agree on them in async.** No Chuvash defect. The Latin-script-host prewarm gap is already filed
  fleet-wide in STATUS.md; a Latin-script host (chv is Cyrillic, but the embedded run is Latin) that
  the tokenizer declines routes to English with an empty memo in sync and a warm memo in async.
- **`unitPer` is the EMPTY STRING** in the manifest — Chuvash says "A per B" with a
  possessive-locative DENOMINATOR, not a preposition, so the rate tier composes `A [B-loc]`. There is
  no `multiply` key (× is ×0 in the corpus). `ҫ`/`ç`/`s`/`h` are the rate denominators.
- **The degree scale letter is matched under `gui`** and carries all three spellings (Latin ⟨C⟩,
  Cyrillic ⟨С⟩, lowercase Cyrillic ⟨с⟩) because they render identically and only the codepoint tells
  them apart; a class carrying only the Latin one would leave two thirds of the 33 temperature signs
  to `core/foreign.ts` and the English letter name.
- **The ordinal is invariant `-мӗш` on the FULL numeral** — no vowel harmony, no rounding, one suffix
  on every stem (пӗрре → пӗрремӗш, тӑваттӑ → тӑваттӑмӗш). The corpus settles the FULL-vs-ATTRIBUTIVE
  stem with the fraction sentence "вĕсенчен виççĕ тăваттăмĕш пайĕ": built on тӑваттӑ, not тӑват.
  C# `OrdinalOf` mirrors this exactly.

## Run 8 — 2026-08-29 ~19:00 — review of #1178: the mechanical diffs

Reading is not the instrument. Both pattern sets were dumped and compared as data — every `JsRe` the port
compiles (by reflection over the four classes' static fields, `RomanPolicy` included) against every
RegExp the TypeScript uses (the dynamic ones by hooking the constructor around `normalizeChuvash`,
`spellAttributive` and a `text()` call, the literals by scanning the source):

    30 C# patterns; 0 not present verbatim in the TS pattern set
    53 TS patterns; every one with no C# counterpart is shared-tier, not this language's

⚠ TWO WERE FLAGGED AND BOTH WERE MY INSTRUMENT, NOT THE PORT. `FRACTION` differs by `\/` against `/` —
a JS regex-literal necessity that means the same thing in .NET — and `ATTRIBUTIVE` was absent from the TS
side only because `spellAttributive` builds its pattern inside the function body and my first hook never
called it. Both resolved by fixing the instrument rather than the code.

Then every hand-copied table, as a map rather than as a set of literals:

    LETTER_NAME     35 rows / 35 rows — identical key for key AND value for value
    legalOnsets     15 / 15 — identical in content and order
    legalCodas      15 / 15 — identical in content and order
    acronymLetters   9 / 9  — identical in content and order
    numbers.ts      every literal present on both sides

## Run 9 — 2026-08-29 ~19:10 — both numeral series, walked rather than sampled

Chuvash has TWO series and the attributive one is selected by a boolean that a golden cannot see failing
— a mis-bound `attr` still yields well-formed Chuvash, just the wrong series. So the whole reachable
space was enumerated instead of sampled:

    every n in 0…999,999 in FULL *and* in ATTRIBUTIVE, the million and milliard decade
    structure, and the invariant -мӗш ordinal for 1…2000
    BOTH SERIES AND THE ORDINAL MATCH THE TS ON ALL 2037964 ROWS

## Run 10 — 2026-08-29 ~19:20 — three differentials under the corrected harness

References built the way `tools/gen_parity_goldens.mts` builds a golden: one process, `clearForeignOov()`
once, rows in order, through `phonemizeAsync`.

    mined + attest                804 unique texts     0 differ
    generated haystack         18,785 rows             0 differ
    review probe                  561 rows             0 differ

The haystack covers **the voicing pass exhaustively** — every (previous letter, obstruent, following
vowel) triple the rule can see, which is the headline rule and the one a sample would under-test —
gemination at every position including in a voicing slot (where it must BLOCK), ⟨е⟩ after every letter
including the ⟨ъ⟩/⟨ь⟩ separating-sign arm, ⟨ь⟩ at every position and after ⟨й⟩ (where it must NOT apply),
reduced-only and vowel-less words for the stress rule, both numeral series through the text path, every
normalizer pattern with the shapes each guard must decline, the acronym list, the roman policy in BOTH
encodings of ⟨ĕ/ӗ⟩ across all fifteen case endings, and the whole symbol tier.

The review probe adds what the haystack could not reach: **NFD input** (220 real corpus lines decomposed
— see run 11), the JS/.NET lowercase divergence set through the public word entry point, the `[Ѐ-ӿ]`
token class's own block boundaries, non-canonical Roman spellings and the policy's 100 bound, the ordinal
suffix splice at every suffix length, and the clock/fraction shapes that must be refused.

## Run 11 — 2026-08-29 ~19:30 — the seam gates, and a finding that is NOT this port's

    --provenance chv (19,589 NFC rows)   70,996/70,996 (100.0%)
    --ipaspans chv                       63,249/63,249, 0 wrong
    --poison chv                         0 sites
    …with the 561-row review probe added: 71,832/80,681 (89.0%), one desync site

The desync is `input.Normalize(FormC)` in `Text()` — a raw normalization of the pipeline string, which
CHANGES THE LENGTH for ⟨ӑ ӗ ӳ⟩ and is invisible to the tracker. ⚠ **AND THE TYPESCRIPT DOES IT TOO, on
the same 245 rows** (`available 316, WITHHELD 245`), so this is a faithful port of a shared defect rather
than a port defect. A second class appeared beside it in the TS only — `s=" 000"`, `s=" 456"`, matched
SUBSTRINGS, from `rewrite()` called on a callback parameter in the fractional de-grouping arm. **The C#
port is already correct there**, using `SPACE_SEPS.Replace`.

⚠ **BOTH ARE FLEET-WIDE, WHICH IS WHY NEITHER IS FIXED HERE**: 195 `.normalize()` calls across 98
language directories, and 58 substring-seam sites across 37. Fixing one arbitrary site inside a port PR
would leave the fleet inconsistent and hide the class. Filed as #1179, with the ee fixes from #1177 as
the worked example. chv's own mined corpus is 100% NFC, so nothing is lost for this language today.

## Run 12 — 2026-08-29 ~19:40 — the expectations, re-run against the TypeScript

All 69 hard-coded values in `ChuvashTests.cs` were extracted mechanically and fed back through
`phonemizeWord` / `phonemizeAsync` / `normalizeChuvash` / `ordinalOf` / `foldCyrillicConfusables` in the
TypeScript engine, rather than trusted because the C# agreed with them.

    ALL 69 TEST EXPECTATIONS AGREE WITH THE TS ENGINE
    dotnet test --filter Chuvash    74/74
