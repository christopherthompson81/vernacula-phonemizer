# Icelandic (is) — C# port investigation

Chronological log of the runs behind the is port.

## Run 1 — 2026-08-30 09:40 — scope

    wc -l src/languages/icelandic/*.ts csharp/goldens/is.tsv
        263 icelandic.ts · 11 manifest.ts · 218 normalize.ts · 95 numbers.ts · 200 is.tsv (rows)

North Germanic (insular), the one that keeps the Germanic consonant mutations out and keeps the
pre-aspiration in: Latin script plus ⟨þ ð æ ö⟩, ~330k speakers, and **no neural tier** — the whole
read is rule-based, so sync and async agree and only the sync engine registers. The weight is split
between a context-heavy scanner (the ⟨k g gj kj⟩→[c] front-vowel palatalisation, the intervocalic
⟨g⟩→[ɣ]/[j]/[x] branches, the epenthetic ⟨ll⟩/⟨rl⟩/⟨rn⟩ breaks and the context-dependent ⟨nn⟩,
pre-velar nasal diphthongisation, the ⟨í⟩ hiatus glide, ⟨f⟩ realisation, and first-syllable stress)
and a twelve-step normalizer with a currency tier and a gender-concordant numeral composer.

    csharp/goldens/is.tsv (200 rows) exists, so the gate applies from the first run.
    The registry already routes `case "is"` — only the factory and the self-registration were missing.

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each is a place where a plausible C# spelling compiles
and passes a naive test while diverging from the TS:

  * the currency sign is regex-escaped before the two placement patterns are composed. JS escapes with
    `sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")` — a literal backslash + the match. .NET's
    replacement parser treats a backslash before `$` as a literal backslash (only `$$` escapes the
    dollar), so the C# literal is the SAME three characters. The .NET-idiomatic "double the escape"
    (`"\\\\$&"`) is the trap: it yields `\\$`, the composed pattern anchors on a stray end marker, and
    `$5` drops its sign. See run 3.
  * the scanner's ⟨g⟩ branches and the front-vowel ⟨k g gj kj⟩→[c] palatalisation are ORDER-SENSITIVE
    against the plain consonant mapping; a reordering changes which symbol a word carries without
    changing its letter count, so a naive letter-count test would not catch it.
  * the epenthetic breaks are CONTEXT-DEPENDENT: ⟨ll⟩→[tl], ⟨rl⟩→[rtl], ⟨rn⟩→[rtn] fire, but ⟨nn⟩ fires
    only in a position the TS restricts — porting it as an unconditional break over-inserts.
  * the numerals are tens-FIRST with an "og" joiner and GENDER CONCORD for 1–4: `tvær`/`tveir`/`tvö`
    turn on the case the FOLLOWING noun selects, so the composer threads the agreement, it does not
    emit a fixed word.
  * ordinals agree in gender AND case, selected by the following noun — the manifest carries the full
    declension, not a single stem.
  * every normalizer step is the PROVENANCE seam on the pipeline string (`Rewrite`); the currency and
    signed-number callbacks that rewrite a matched span stay off the seam on `JsRegex.Replace`.
  * the period-grouping lookbehind is verbatim `(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))` — an extra
    capturing group here changes the group numbers the `$1`/`$2` substitutions index.

## Run 2 — 2026-08-30 10:05 — build + parity

    dotnet build csharp/Vernacula.Phonemizer.Tests      clean
    dotnet test --filter FullyQualifiedName~Icelandic   86/86 pass
    dotnet run --project csharp/tools/parity -- is     is  OK  200 rows

The 200 golden rows were byte-identical on the first green run, but the gate had NOT yet seen the
currency tier live — the is golden carries no currency row, so a dropped sign is invisible to it. The
widenings in runs 4–5 are what carry that step.

## Run 3 — 2026-08-30 10:15 — THE FINDING: the currency sign escaped to two backslashes

The normalizer's currency step composes `esc + "\s*(\d+)"` and `"\d+\s*" + esc` from a regex-escaped
sign. The first C# cut spelled the escape the .NET way, doubling the backslash:

    TS   sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")     "$" → "\$"      (2 chars)
    C# 1 Escaper.Replace(s, "\\\\$&")                      "$" → "\\$"     (3 chars)  ⚠

With `\\$` the composed pattern was `\\$\s*(\d+)` — a backslash, a backslash, a literal-dollar that
never matches, so the whole substitution no-opped and **`$5` read *fˈɪm* — the sign silently dropped**
instead of *fˈɪm tˈalɪr* (5 dalir). The € / £ / ¥ signs escaped to themselves (they are not regex
metacharacters), so only `$` — the one sign that IS a metacharacter — was affected, which is exactly
why a corpus that never places a `$` before a digit would not see it.

    fixed  Escaper.Replace(s, "\\$&")      "$" → "\$"      (2 chars, = the TS)

Targeted probe before/after:

    escaped $   [\\$]  →  [\$]
    match $5    (no match, sign dropped)  →  [5 dalir]
    match €5    [5 evrur]   (unchanged — € is not a metacharacter)

The C# literal is spelled identically to the TS because .NET's replacement parser already treats
`\$` as a literal backslash + dollar; "fixing" it to the .NET `$$` idiom would be the bug. Pinned by
the off-golden probes (run 4), not the gate.

## Run 4 — 2026-08-30 10:25 — the widenings: FLEURS corpus + off-golden probes

Two differentials beyond the 200-row golden, both rendered through `phonemizeAsync` on the TS side and
sync + async + normalize on the C# side:

    FLEURS is_is (train+dev+test, text col 3 + lowercased col 4, deduped)   1,692 unique lines
        C# sync      == TS   1,692/1,692   0 differ
        C# async     == TS   1,692/1,692   0 differ
        C# normalize == TS   1,692/1,692   0 differ
    off-golden probes (.probe/is/probes.txt: currency both placements, signed numbers, ranges,
        relational + arithmetic signs, the g/k/gj/kj palatal paradigm, the epenthetic breaks,
        pre-velar nasal, the í glide, ordinals in all genders/cases, the 1–4 concord)   130 lines
        C# sync/async/normalize == TS   130/130   0 differ

Leak sweep over both sets: 0 outputs carry a raw digit or an unread symbol. No BLOCKED rows — the
foreign runs in the FLEURS text reach the English reader, which is ported.

## Run 5 — 2026-08-30 10:45 — the full gates

    dotnet test (full suite)      4,031 pass · 0 fail   (86 of them is)
    dotnet run --project csharp/tools/parity            156 languages byte-identical · 30,705 rows · 0 differ
    --provenance is   tokens 4548/4548 (100.0%) mapped, nothing lost
    --ipaspans is     tokens 4164/4164 (100.0%), 0 wrong spans
    --poison is       distinct poison sites: 0 (SUBSTRING 0, desync 0)
    npx vitest run test/icelandic.test.ts               23/23 (TS side untouched, still green)

One defect found and fixed (run 3, the currency escape); it was the only divergence and it was caught
by the off-golden probe, not the gate, because the is golden carries no currency row. Everything else
compiled and passed first run: the scanner's order-sensitive branches, the context-dependent
epenthetic breaks, the pre-velar nasal diphthongisation, and the gender-concordant numeral/ordinal
composer all matched the TS on the first differential.

## Run 6 — 2026-08-30 16:50 — rebased onto hil+hmn, recounted

Two ports landed on `main` after this branch cut (hil #1190, hmn #1191). Rebased onto `origin/main`;
the only conflict was the `Bootstrap.cs` append (kept all three: Hiligaynon, Hmong, Icelandic). Aligned
with the recent convention (haw/hil/hmn made no `STATUS.md` change; that file is now retired) — the port is recorded here, not in
the resume log. Re-counted on the new base; the is-specific gates are unchanged, only the fleet-wide
totals moved:

    dotnet test (full suite)      4,160 pass · 0 fail   (was 4,031 — hil+hmn added the rest)
    dotnet run --project csharp/tools/parity            158 languages byte-identical · 30,870 rows · 0 differ
    is  OK  200 rows   ·   --provenance is 4548/4548   ·   --ipaspans is 4164/4164 0 wrong   ·   --poison is 0 sites

## Notes for the record

- is is RULE-BASED ONLY (no ONNX/neural tagger): sync and async produce identical output, and only the
  sync engine registers. No `NeuralRegistry` entry is needed.
- The `LanguageBootstrapTests` unported-language sample was `is`; with is ported it now uses `nci`
  (Classical Nahuatl, engine key `nahuatl` — zero L1 speakers, bottom of the queue).
- The C# project glob-includes `Languages/Icelandic/*.cs`; no csproj edit was needed to pick the new
  files up.
- The IDE's LSP diagnostics for sibling-language files (Aragonese, Basque, … "does not exist") are
  stale-index noise; `dotnet build` is clean and is the source of truth.
