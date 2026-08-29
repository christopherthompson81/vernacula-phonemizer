# Bishnupriya Manipuri (bpy) — C# port investigation

Chronological log of the runs behind the bpy port. The port itself is the smallest in the batch; the
verification is where the work was, and run 5 is the part worth reading.

## Run 1 — 2026-08-29 ~21:00 — scope

    wc -l src/languages/bishnupriya/*.ts data/languages/bishnupriya/bishnupriya.jsonc
        33 bishnupriya.ts · 126 bishnupriya.jsonc

⚠ **THIRTY-THREE LINES, BECAUSE THE ENGINE IS NOT HERE.** `bishnupriya.ts` calls `makeNativeBengali` with
its own manifest and nothing else: the abugida scan, the inherent-vowel deletion and the geminate→length
pass are all the shared Bengali engine's, already ported and already gated. The language lives in the
jsonc — Bengali phoneme values throughout (the ʃ sibilants, the retroflex/dental split, the affricates,
because the referee is Bengali-like and not Assamese-like) with exactly two divergence flags.

So the port is one small file, and the usual risk profile inverts. There are **no hand-copied regexes or
tables in the C# at all**, which removes the class of defect that produced the `ab`, `rup` and `bal`
findings. What replaces it is manifest BINDING: a flag that fails to bind is silent, and it changes
readings.

⚠ **AND NO WRAPPER PASS, WHICH IS AN ASYMMETRY WORTH KEEPING.** Assamese reuses the same engine and has
to wrap every arm to collapse its deaffricated t/d/s/z/x geminates. Bishnupriya's inventory is exactly
Bengali's, so the engine's own geminate→length pass already covers it. The TS says so in its header; the
port keeps the asymmetry rather than inventing a wrapper for symmetry's sake.

    Registry.cs already routes `case "bpy": return Create("bishnupriya")` — only the factory was missing.
    csharp/goldens/bpy.tsv (200 rows) exists, so the gate applies from the first run.

## Run 2 — 2026-08-29 ~21:15 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet run --project csharp/tools/parity -- bpy   bpy  OK  200 rows

## Run 3 — 2026-08-29 ~21:25 — the two divergence flags, which a golden cannot be trusted to see

The manifest carries `heightHarmony: false` and `skipLexicon: true`. Both are booleans consumed deep in
the shared engine (`def.HeightHarmony != false`, `def.SkipLexicon != true`), and **a failure to bind is
indistinguishable from Bengali** — the reading stays well-formed, it is simply the wrong language's.

So rather than trust the golden, the discriminating words were found first: run every candidate through
BOTH `phonemizeWord` (bpy) and Bengali's, and keep the ones that differ.

    সমুদ্র   bpy ʃɔmud̪ɾo   bn ʃomud̪ɾo    heightHarmony — Bengali raises the initial ɔ, bpy does not
    বই       bpy bɔi        bn boi         heightHarmony, again
    ভালবাসা  bpy bʱalbaʃa   bn bʱalɔbaʃa   skipLexicon — bn serves a LEXICON form with the medial ɔ kept
    খরগোশ    bpy kʰɔɾɡoʃ    bn kʰɔɾɡoʃ     the control: unraised in both

⚠ `ভালবাসা` IS THE ONE NOTHING IN THE TS SUITE COVERS. The two languages share a script and an engine, so
a `skipLexicon` that failed to bind would silently serve Bengali's *recorded* pronunciations for
Bishnupriya words — and the TS test file has no case that could tell. Added on the C# side, asserting both
readings so the difference is legible rather than asserted.

    dotnet test --filter "FullyQualifiedName~Bishnupriya"   16/16
    all 19 hard-coded expectations re-run against the TypeScript engine directly:
        ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 4 — 2026-08-29 ~21:40 — the mined corpus

    tools/corpus/mined/bpy.jsonc → 377 unique texts
    bpy  OK  377 rows      0 differ, 0 throws

## Run 5 — 2026-08-29 ~21:55 — 4 rows differed, and the defect was in MY HARNESS

A 10,000-row generated haystack (the abugida scan's corners, conjuncts and the four signs, inherent-vowel
deletion, the shared symbol tier and numerals in both digit systems, and — the `ba` lesson — foreign Latin
runs in **9,969 of the 10,000 rows**) came back:

    bpy   DIFF   4/10000 rows differ
      "847.36 km Tripura"
         want …kilomiʈaɾ tɹˈaᶦpʰʊɹə        got …kilomiʈaɾ tɹipʰˈʊɹə

The C# was reading the embedded English `Tripura` by rule where the reference had it from the dictionary.
Three checks before believing it:

  * `Phonemizer.Phonemize("Tripura", "bpy")` in C# returns `tɹˈaᶦpʰʊɹə` — **the reference's own value**.
    So the engine is right and something about the comparison is not;
  * the same input through `as` and `bn`, in both engines, agrees everywhere;
  * ⚠ and the decisive one: **the TS reference file disagrees with ITSELF.** Row 265 has
    `tɹˈaᶦpʰʊɹə` and row 242 has `tɹipʰˈʊɹə` — the same word, two readings, in one artifact.

That is not a port defect, it is state. `core/foreign.ts` keeps a module-level OOV memo, and
`tools/gen_parity_goldens.mts` calls `clearForeignOov()` **once per language** before phonemizing that
language's rows in order — with a comment saying exactly why (a prewarm otherwise leaks BiLSTM readings
into a later language's golden). The memo is therefore *deliberately shared across a language's rows*, and
a reference is only comparable if it is built the same way.

My harness was 16 parallel shards, each memoizing from a different subset of rows. Fixing it the obvious
way — clearing per row — made it **worse** (44 differ), which is the confirmation: per-row clearing is a
third artifact, not the right one.

    16 shards, no clear        4 rows differ
    16 shards, clear per row  44 rows differ
    ONE process, clear ONCE, rows in order   →  bpy  OK  10000 rows, 0 differ

⚠ **AND THE CORRECT METHOD IS ALSO THE CHEAPER ONE**: 5s single-process against 14s for sixteen shards,
because the shard version paid the module-load cost sixteen times over.

## Run 6 — 2026-08-29 ~22:10 — re-verifying the two ports I had already reported clean

The `ba` and `eu` differentials in this batch used the sharded harness, so their "0 differ" was not
evidence of what I said it was. Both were re-run under the corrected method:

    ba   12,000 rows   0 differ
    eu   12,000 rows   0 differ

Both hold. The sharded harness happened not to produce false positives there — `bpy` exposed it because
almost every generated row carries a foreign run — but the earlier results were luckier than they were
rigorous, and this is the note that says so.

## Run 7 — 2026-08-29 ~22:20 — the full gates

    dotnet test (full suite)                 3,124 pass, 0 fail  (16 Bishnupriya + 1 manifest mapping)
    parity, fleet                            143 languages byte-identical, 28,304 rows, 0 differ
                                             (+ bal's 1 row still BLOCKED on the unported `georgian`)
    provenance bpy                           5,876/5,876 tokens mapped (100%)
    ipaspans bpy                             0 spans wrong
    poison bpy                               0 sites
    typescript                               unchanged

`bpy` is the 143rd byte-identical language. `ManifestMappingTests` gained
`BishnupriyaManifestIsFullyMapped`, which reuses `BengaliDef` — the same shape Assamese's entry uses,
since both languages bind the Bengali engine's def type.

## Read for correctness — filed, not fixed

- **The differential harness is the reusable finding, not anything about Bishnupriya.** Any language whose
  text embeds foreign words needs its reference built the way `gen_parity_goldens.mts` builds one: one
  process, `clearForeignOov()` once for the language, rows in order. Sharding is invalid there, and so is
  clearing per row.
- **`phonemizeWord` is built without a phonology or a foreign handler**, exactly as the TS is —
  `MakeNativeBengali` supplies the shared phonology itself when none is passed. The `text()` path gets
  `Registry.ReadAsEnglish`; the bare word path does not, and that asymmetry is the TS's.
