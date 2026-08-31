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
