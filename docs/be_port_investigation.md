# Belarusian (be) — C# port investigation

Chronological log of the runs behind the be port. Branch `port/be-csharp`, based on `main` @ 2a99d056 (ka, #1171) after the Run 4 rebase.

## Run 1 — 2026-08-29 13:31 — what is there to port?

    wc -l src/languages/belarusian/*.ts
        266 belarusian.ts · 457 normalize.ts ·  83 romanOrdinals.ts = 806

Everything it imports is already ported — `Clauses`, `JsRegex`/`JsRe`, `Initialisms`, `NormalizeSymbols`
(the symbol tier), `Rewriter`, `LoadManifest`, and the shared East-Slavic compositor
(`Languages/Ukrainian/Numbers.cs`, which the TS likewise takes from `ukrainian/numbers.ts`), so **no
shared-core change is expected**. `Registry.cs` already routes `case "be": return Create("belarusian")`
(Registry.cs:661-662) — only `Bootstrap.cs` and `ManifestMappingTests.cs` need the registration lines.
The manifest (`data/languages/belarusian/belarusian.jsonc`) is read by both engines through the shared
`data/` tree — not ported, only loaded.

Porting notes, all of which the contract already covers:

  · **The manifest is THIN and the tables are in code, unlike `uk`.** `belarusian.jsonc` carries only the
    g2p tables (`vowels`, `iotated`, `palatalizers`, `vowelLetters`, `consonants`, `voicing`),
    `clausePunctuation` and `numbers` (the East-Slavic base + `magnitudeCounts` + `feminine` +
    `decimalConnector`). The ordinal paradigms, the genitive cardinals, the letter names, the phonotactics,
    the magnitude abbreviations and the dotted abbreviations are HARDCODED in `normalize.ts` and
    `romanOrdinals.ts` — so the C# `Manifest.cs` is a small typed load and the tables live in
    `Normalize.cs`/`RomanOrdinals.cs`, mirroring the TS module split.
  · **`voicing` is a manifest table the g2p consults per phoneme** (`TO_VOICELESS`/`TO_VOICED`), applied
    right-to-left in `applyVoicing`. It is not a regex, so no translator involvement.
  · **The geminate folds are four patterns applied in sequence** (affricate gemination, then
    CʲCʲ→Cʲː, CCʲ→Cʲː, CC→Cː) — the third class in the TS omits one of the two duplicate ⟨n⟩ members of the
    first two; a character class makes the duplicate inert, and the pattern strings are kept
    byte-identical regardless.
  · **`RomanPass` runs ABOVE the engine in both engines** (`Registry.GetPhonemizer` wraps `Text`), which is
    why `romanOrdinals.ts`'s context regex must match the RAW `ст.` abbreviation and not the `стагоддзя`
    that `normalize.ts` step 4 later expands it to. The C# `RegisterRomanPolicy("be", …)` reproduces the
    layering; the TS test pins it through `phonemize`, and the portable half does the same.
  · **The fraction rule's inner replaces stay off the seam.** `cardinal(num).replace(/адзін$/u, "адна")`
    operates on a MATCHED WORD, not the pipeline string, so those two are `JsRe.Replace`; every step's
    outer `rewrite` is `Rewrite`.
  · **The space separators are spelled as escapes** (`[ \u00a0\u202f\u2009]`), per the nso lesson (#1109):
    a literal NBSP typed through a shell path is the trap.
  · **be is NOT a neural language** — no entry in `neuralRegistry.ts` / `NeuralRegistry.cs` (checked), so
    the async path serves the same sync engine; the goldens are still async-mode output and the gate calls
    `PhonemizeAsync` either way.

## Run 2 — 2026-08-29 14:05 — rebase onto the updated main and recount

Four ports landed on `origin/main` while the be work was in flight (uncommitted): ba (#1167), eu (#1168),
bal (#1169), bpy (#1170) → tip `b068bafa`. Stashed the WIP (`-u`), fast-forwarded the branch, popped.
Two expected append-at-tail conflicts, both resolved by keeping upstream's entries and appending the be
lines after them:

  · `Bootstrap.cs` — the new `RegisterSelf` block now reads `…Aromanian, Bashkir, Basque, Bishnupriya, Belarusian`.
  · `ManifestMappingTests.cs` — `BasqueManifestIsFullyMapped` and `BashkirManifestIsFullyMapped` sit where
    upstream inserted them; `BelarusianManifestIsFullyMapped` follows.

Recount on the new base (all gates re-run, none trusted from before the rebase):

    dotnet build Vernacula.Phonemizer.csproj          → 0 errors (1 pre-existing Marathi CS0108 warning)
    dotnet test --filter FullyQualifiedName~Belarusian → 92/92 pass
    dotnet run --project csharp/tools/parity -- be     → be OK 200 rows, 0 differ
    dotnet run --project csharp/tools/parity           → 144 languages byte-identical, 28504 rows ok, 0 differ
                                                        (1 row in bal BLOCKED on the unported georgian
                                                         dependency — inherited from #1169, not be)
    dotnet test (full suite)                           → 3220/3220 pass

The fleet number moved from the 140-language / 27,627-row baseline to 144 languages / 28,504 rows: the four
new goldens (4×200) plus be's 200 rows, minus the bal blocked row. STATUS.md gets these numbers, not the
pre-rebase ones.

## Run 3 — 2026-08-29 15:31 — the widening battery: FLEURS differential, probes, poison/provenance/ipaspans

Probe project `.probe/be/` (own subdirectory; the shared `.probe/` root is not touched): `probe.csproj`
(RootNamespace `BeProbe`, references `../../csharp/Vernacula.Phonemizer/Vernacula.Phonemizer.csproj`),
`Program.cs` / `probe.mts` (both emit `sync\tasync` per line, lang `be`, modeled on `.probe/rup/`), and
`extract.mts` which builds `all.txt`:

  · mined `tools/corpus/mined/be.jsonc` — `hard` (259 `{cell,text}`) + `sample` (200), whitespace-collapsed
    per the rup convention;
  · attest `tools/corpus/attest/be.jsonc` — 64 findings, their `examples`;
  · FLEURS `be_by` train/dev/test (3808 lines) — cols 3+4 raw, trimmed only;
  · `csharp/goldens/be.tsv` — the 200 gate rows, so the differential re-covers the golden off-gate;
  · `probes.txt` — 250 hand lines: one per normalize arm plus the adversarial neighbour each arm must
    decline (`552 с.`, `БЭ ў 18 т.`, `28-гадовы`, `Запісы = Zapisy`, `673/674`, `COVID-19`, `24:00`,
    `123:45`, `2.5.5`, `100 °Celsius`, …), the four space separators as exact bytes
    (`1\u00a0234\u00a0567`, `1\u202f234\u202f567`, `1\u2009234\u2009567`, `2\u00a0млн`), the 2^53 boundaries
    (`9007199254740991` / `9007199254740993`), and every roman-context spelling including all three
    apostrophe characters in `з’езд`/`з'езд`/`` з`езд `` and the `век` exclusion.

    8867 raw → **4927 unique** lines.

Result (first run, no fixes needed):

    npx tsx .probe/be/probe.mts all.txt            → 4927 rows, 0 throws
    VERNACULA_DATA_DIR=$PWD/data dotnet run \
        --project .probe/be -- all.txt             → 4927 rows, 0 throws
    diff ts.sync  cs.sync                           → 0
    diff ts.async cs.async                          → 0
    leak sweep (no-letter input ⇒ no digit output)  → 0 leaks
    --poison be        → 0 seam violations, 0 desyncs
    --provenance be    → tokens 4863/4863 (100.0%), nothing lost
    --ipaspans be      → tokens 4193/4193 (100.0%), 0 wrong spans
    npx vitest run test/belarusian.test.ts         → 17/17 (TS side unchanged, no drift)

No defect surfaced, so there is no TS-first paired fix and no golden regeneration. The read-for-correctness
questions are covered by the pinned TS expectations (which the C# tests mirror 1:1) plus this battery.

## Run 4 — 2026-08-29 21:40 — second rebase: Georgian landed, the last BLOCKED row clears

`2a99d056` (ka, #1171) merged while the branch was unpushed. Ka touches only its own language files plus
the two registration files, so no shared code moved and the Run 3 differential stays valid (its input set
contains no Georgian run — a Georgian run would have differed pre-#1171, and it did not). Rebase hit the
same one-line append-at-tail conflict in `Bootstrap.cs` (Georgian upstream, Belarusian appended after);
`ManifestMappingTests.cs` auto-merged with both facts.

Recount on the ka base:

    build (Vernacula.Phonemizer)        → 0 errors, 1 pre-existing Marathi CS0108 warning
    C# suite (full)                     → 3312/3312 (3220 + 92 Georgian)
    C# suite (Belarusian filter)        → 92/92
    parity be                           → 200/200 byte-identical, 0 differ
    parity (fleet)                      → 146 languages byte-identical, 28705 rows ok, 0 differ, 0 BLOCKED
                                          — bal's one georgian row is now readable; the fleet's last
                                          BLOCKED row is gone (#1171)
    TS belarusian tests                 → 17/17 (unchanged, re-verified in Run 3)
    FLEURS + probes differential        → 4927 rows, sync 0 / async 0 / throws 0 / leaks 0 (Run 3,
                                          still valid: ka adds no shared code)
    poison / provenance / ipaspans      → 0 / 4863-4863 / 4193-4193 (Run 3, same reason)

## Gates — final recount (on the ka base 2a99d056)

    build (Vernacula.Phonemizer)        → 0 errors, 1 pre-existing Marathi CS0108 warning
    C# suite (full)                     → 3312/3312
    C# suite (Belarusian filter)        → 92/92
    parity be                           → 200/200 byte-identical, 0 differ
    parity (fleet)                      → 146 languages byte-identical, 28705 rows ok, 0 differ, 0 BLOCKED
    TS belarusian tests                 → 17/17
    FLEURS + probes differential        → 4927 rows, sync 0 / async 0 / throws 0 / leaks 0
    poison / provenance / ipaspans      → 0 / 4863-4863 / 4193-4193
