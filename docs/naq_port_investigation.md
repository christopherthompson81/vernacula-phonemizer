# Nama / Khoekhoegowab (naq) — C# port investigation

Chronological log of the runs behind the naq port (branch `port/naq-nama`).

## Run 1 — 2026-08-31 ~10:40 — scope

    wc -l src/languages/nama/*.ts
        124 nama.ts · 33 normalize.ts · 145 numbers.ts

The three files, in dependency order: `numbers.ts` (the native Khoe decimal compositor, with the two
naturalised loan magnitudes `miljun`/`biljun`), `normalize.ts` (one line of substance — the shared
separator hygiene pass, no word emitted), and `nama.ts` (the greedy click scan: four click places ×
five accompaniments composed by a rule rather than a table, the ⟨kh⟩ digraph, doubled-vowel length,
word-final gender-⟨-b⟩ devoicing, and the nativiser whose class carries the macron/circumflex vowels
of #1140).

⚠ **NO GOLDEN AND NO CORPUS ARTIFACT for this language, in either engine.** `csharp/goldens/` has no
`na.tsv`, there is no FLEURS split and no mined corpus, so the corpus-wide differential (widening (1)
of the porting contract) does not exist and the off-golden probes have to carry the whole weight. The
TypeScript tests are the entire instrument — stated rather than implied, because a clean probe run for
a language with no corpus proves less than the same number for a language with one.

## Run 2 — 2026-08-31 ~10:55 — the port, and the two seams that caught

Ported 1:1 to `csharp/Vernacula.Phonemizer/Languages/Nama/` (`Nama.cs`, `Manifest.cs`, `Normalize.cs`,
`Numbers.cs`), registered from `Bootstrap.cs`, with the manifest-mapping guard added.

Two registration-shape findings, both caught by the first test run rather than by reading:

  * **The C# registry keys factories by MODULE NAME, not ISO code.** `case "naq": return Create("nama");`
    already existed in `Registry.cs`, so the factory had to be registered under `"nama"`, not `"naq"`.
    First run: 25 tests failed with `port pending: nama` — the C#-specific spelling of a key that is
    invisible in the TS, where `getPhonemizer("naq")` and `createNama` are one hop apart.
  * **The normalize layer claims only en/em-dash ranges, never the ASCII hyphen.** The shared separator
    pass's range rule is `[–—]`; `15-20` is untouched by design (the hyphen is one of the classes the
    layer's header leaves open). The first test asserted `15-20 → "15, 20"` and failed; the pinned pair
    is now `15–20 → "15, 20"` alongside the refusal `15-20 → "15-20"`.

    C# suite after the fix: 57/57 Nama tests pass, full suite 5,684 pass / 0 fail.

## Run 3 — 2026-08-31 ~11:10 — the off-golden probe differential

    .probe/na/  (gitignored; csproj → ../../csharp/Vernacula.Phonemizer, run from the repo root)
    probes.txt  144 lines: the four places × five accompaniments, citation case (ǀKh, ǀG, ǀKHOE),
                real words, the kh-digraph vs click-kh corner, word-final -b, doubled + macron +
                circumflex vowels (precomposed AND decomposed), tone marks (dropped), the attested
                New Era running-text shapes (N$47 miljunsa …), every separator-hygiene arm and its
                refusals (space/dot grouping, decimals, en/em vs ASCII hyphen, 0 000, 21 2001),
                the nativiser's Afrikaans-circumflex set (môre, brûe, sê), São Paulo fragmentation,
                punctuation, and two sentences

    C# probe: Phonemize AND PhonemizeAsync per line, asserting the two agree before printing
    diff out-cs.txt out-ts.txt → IDENTICAL: 144/144 lines byte-identical, 0 throws

## Run 4 — 2026-08-31 ~11:20 — the numeral sweep, since the compositor is bespoke

    numbers.txt  50,012 lines: 0…50000 exhaustively, plus the magnitude boundaries 999 999 /
                1 000 000 / 2 000 000 / 999 999 999 / 10⁹ / 2.5·10⁹ / 10¹²−2 / 10¹²−1 / 10¹² /
                1 234 567 890 123 (13 digits — the readDigits side of the length≤12 seam)
    C# vs TS → NUMERALS IDENTICAL: 50012/50012 lines byte-identical, 0 throws

    ⚠ FIRST RUN OF THIS SWEEP MEASURED THE WRONG BUILD. The probe was invoked with `--no-build` after
    editing Program.cs to take the file as an argument, so the stale binary re-ran the 144-line probe
    and the diff reported a 144-vs-50012 mismatch that looked like a 50k-row divergence. Rebuilt,
    re-ran, clean. The contaminated first run produced no conclusion that was carried forward — the
    number above is from the rebuilt run.

## Run 5 — 2026-08-31 ~11:30 — the fleet gate after the Bootstrap change

    dotnet run --project csharp/tools/parity
        174 languages byte-identical, 0 differ (33 939 rows ok, 0 differ)
        accent variants: 5/5 build

The registration is additive and nothing else moved.

## Read for correctness — nothing filed

- Every table the manifest declares is reached: `clicks` (the scan's branch set), `plainVowels` (the
  doubling rule), `letters` (the per-letter fallback). The manifest-mapping guard confirms the C# type
  consumes all three declared keys; `language`/`name`/`script` are the TS interface's own non-data keys.
- The zero stopgap `nul` is a flagged Afrikaans contact-loan, not a numeral — the C# comment carries the
  flag, and the sweep shows 0 reading it as anything but `nul`.
- The one deliberate non-port: the TS `numbers.ts` file has its `import` statement at the very END of
  the file (line 145, after the code that uses `digitIndex`). ES module hoisting makes that legal; the
  C# imports it normally. No behavioural content either way.

---

# Review (2026-08-31)

Reviewed on the rebased branch. Runs 6–12 are the review's own measurements.

## Run 6 — 2026-08-31 11:52 — the rebase conflict, third port running

`ManifestMappingTests.cs` conflicted again — the third consecutive port. This one is tighter than the
last two: both sides share the `[Fact]` ABOVE the marker *and* the trailing
`"language", "name", "script");` BELOW it, so the naive "keep both" resolution produces an unterminated
call and fails to compile rather than silently stranding a test. That is luck, not design: in the mos
and nci shapes the same resolution compiled fine and left a test that never ran.

Resolved with both attributes explicit, then audited: **151 mapping tests, 0 missing `[Fact]`**.

⚠ This is now three for three. Every port appends its mapping test to the end of the same file, so every
port conflicts there, and whether the mistake is caught depends on where the shared lines happen to fall.
Worth a structural fix (a trailing sentinel entry, or one file per language) rather than a fourth
repetition.

## Run 7 — 2026-08-31 11:58 — the "no golden, no corpus" claim, which this time is TRUE

The last two reviews found "no FLEURS" over-generalised into "no corpus". Checked the same way here, and
the PR is **correct**:

```
csharp/goldens/naq.tsv          MISSING
tools/corpus/mined/naq.jsonc    MISSING
tools/corpus/attest/naq.jsonc   MISSING
tools/referee-eval/referees/naq.wiktionary-khoekhoe.tsv   725 bytes  ← the only text artifact
```

And the reason is structural rather than an oversight: `tools/gen_parity_goldens.mts`'s third
("lexicon") tier scans `data/languages/<dir>/*.tsv` for headwords, but `data/languages/nama/` holds only
`nama.jsonc` — naq's one word list lives under `tools/referee-eval/referees/`, which that tier does not
look at. naq is one of **7 golden-less codes** (`bgc mto naq nog pbt smj zsm`) out of 192.

## Run 8 — 2026-08-31 12:04 — the four gates that had never run on this language

Because there is no golden, `parity`, `provenance`, `ipaspans` and `poison` all SKIP naq — so no seam
gate has ever seen this engine in either direction. Generated a 30,759-row TS-sourced reference from the
corpus + click walk + fuzz, swapped it in, ran all four, and removed it afterwards as its own command
(⚠ here "restore" means DELETE, since no golden was committed — a copy-back would have added one):

```
parity       30,759 rows ok, 0 differ
provenance   77,874/77,874 tokens (100.0%)
ipaspans     0 spans that do not cover what the token emitted
poison       0 SUBSTRING, 0 desync
```

All four pass on their first ever run for naq. ⚠ This is verification, not a fix: the gates are still
skipped on `main`, because committing a golden is a product decision about what text constitutes naq's
reference, and this review does not make it. Recorded as the recommendation instead.

## Run 9 — 2026-08-31 12:12 — the differentials

| walk | rows | differ |
|---|---|---|
| corpus — the wiktionary referee, the langs config, every string literal in `test/nama.test.ts` and both investigation docs, and the manifest keys, on `norm`/`word`/`text` | 210 ×3 | 0 |
| click walk — 4 places × 17 accompaniment candidates (including the `kh`/`k`/`gh`/`hn` near-misses and the citation-case `Kh`/`KH`/`kH`) × 5 preceding × 8 following contexts, plus every vowel doubling, the ⟨kh⟩-digraph corner, and word-final ⟨-b⟩ | 2,956 ×3 | 0 |
| numbers — 0…50,000 exhaustive, ±1,200 around 10²/10³/10⁶/10⁹/10¹²/2³¹/2⁵³, 70k random below the ceiling, 20k above it, non-finite, astral, lone surrogate | 152,145 | 0 |
| `readDigits` as its own entry point — 0…2,999, plus 6k random strings over digits/letters/clicks/astral/Arabic-Indic | 8,163 | 0 |
| fuzz — separator-hygiene arms × 11 trailing contexts, the ambiguous `1.234`, dash/hyphen ranges, 35k random click+astral+invisible strings, on `norm`/`word`/`text` | 27,593 ×3 | 0 |

Two divergences were looked for specifically and both are unreachable: the doubled-vowel branch is
`LETTER[cur]!` in TS (yielding the string `"undefined"` if a plain vowel were missing from the table)
against `LETTER[cur]` in C# (which THROWS) — all five plain vowels are present; and `LETTER[cur] ?? …`
is nullish in TS while C# uses `TryGetValue`, which agree on an empty-string value — there is none.

## Run 10 — 2026-08-31 12:20 — an entry-point scare that was mine, not the port's

The C# tests call `Phonemizer.Phonemize(s, "naq")` where the TS tests call
`getPhonemizer("naq").text(w)`, which reads like the raw-engine/pipeline mismatch the mos review had to
check. Measured the two paths before concluding: **7,503 of 30,759 rows differ** between the raw engine
and the dispatch path — `"ii"` reads `iː` raw and `ᵏǀam` (*ǀgam*, TWO) through dispatch, because the
shared Roman-numeral pre-pass claims it.

But that difference is not the test's. `getPhonemizer` SHADOWS `text` to run the shared pre-passes at
the dispatch point, and `phonemize(text, lang)` is literally `getPhonemizer(lang).text(text)`; the C#
`Phonemize(text, lang)` is literally `Registry.GetPhonemizer(lang).Text(text)`, with the pre-passes at
the same point. The entry points match. ⚠ Recorded because the wrong reading was one step away, and
because it shows how much the pre-passes do for this language: a quarter of the probe corpus.

Both routes are covered anyway — the probe's `text` mode compares `createNama().text` against
`CreateNama().Text` (engine alone) and the Run 8 golden was generated through `phonemize` (dispatch).

## Run 11 — 2026-08-31 12:26 — pattern diff and leak sweep

Literals scanned from source plus a `RegExp` constructor-hook dump (the mos lesson: a literal scan alone
cannot see `new RegExp`, and naq's `TOKEN` and nativiser are both built that way):

```
TS literals 0 + dynamic 8 = 8     C#: 2     ONLY IN C#: 0
```

Both C# patterns have byte-identical TS twins including flags. The 6 TS-only are shared-core patterns
(`LATIN_RUN` standalone, separator hygiene's space-group rule, the fold class, the grapheme splitter)
outside a Nama-namespace reflection scan.

Leak sweep over the 6,977 native-alphabet rows, inventory built from `letters` plus the click rule's own
output (`ᵏ ʰ ᵑ ̊ ˀ ː`) and the ⟨-b⟩ devoicing, planted `ħ` to prove it can fail: **16 strays, 3 distinct
— ⟨v f z⟩**, none of them from Nama text. They are letters absent from the letter table falling through
to `latinPhone`, which is the documented "⚠ NOT SILENTLY" branch, and their subjects are strings my own
harvester scraped from source filenames (`Manifest.cs`). Not a leak.

## Run 12 — 2026-08-31 12:31 — tests and culture

Mechanical `(input, expected)` pair diff: **29 TS pairs, 29 with a C# twin, 0 missing**; C# adds 12. No
duplicate `InlineData` (xUnit silently skips those), no test method missing its attribute.

Culture sweep over `Languages/Nama/*.cs`: the only two matches are `Js.Normalize` calls — casing goes
through `Js.ToLowerCase` per index, there is no `ToLowerInvariant`, no `Parse`, no ordering, and no raw
`.Normalize`. Cleanest of the four ports reviewed. `CLICK` and `PLAIN_VOWEL` use the default string
comparer, which is ordinal.

## Gates

```
dotnet test                     5,870 passed, 0 failed
parity -- naq                   SKIPPED on main (no golden); 30,759/30,759 on the Run 8 reference
parity (full fleet)             177 languages byte-identical, 0 differ (34,539 rows) — UNCHANGED by this port, because naq has no golden to be counted by
seam gates                      provenance 77,874 · ipaspans 0 · poison 0 — first run ever for naq
TS twin suite                   9/9
```

## Standing

Nothing outstanding against the port itself. Two things worth carrying forward:

1. **naq is ungated on `main`** — no golden means four gates skip it, and the test suite plus off-golden
   probes are the whole instrument, exactly as the PR says. A committed reference would close it; Run 8
   shows one can be produced and that it passes.
2. **The mapping-test conflict is now three for three** (Run 6) and is one resolution away from silently
   disabling a test.
