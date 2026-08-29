# Estonian (et) — C# port investigation

Chronological log of the runs behind the et port. ⚠ This port also touches TypeScript — see run 2.

## Run 1 — 2026-08-30 ~07:10 — scope

    wc -l src/languages/estonian/*.ts data/languages/estonian/estonian.jsonc
        201 estonian.ts · 1017 normalize.ts · 43 estonian.jsonc

The largest normalizer in the batch. The g2p is small — Estonian is nearly as phonemic as Finnish at the
segment level, so it is a greedy grapheme scan + gemination + fixed first-syllable stress — and everything
else is `normalize.ts`.

⚠ **THE DEFINING CLASS IS THE ORDINAL, and Estonian makes it hard twice over.** The ordinal is written as a
bare `N.` — a digit and a period, which is also a sentence end — and it must AGREE IN CASE with the noun
that follows. So the rule reads the head word, derives its case from a noun-stem table, and composes the
ordinal in that case: nominative, or stem + the noun's own ending. `1924. aastal` → *tuhande üheksasaja
kahekümne neljandal aastal*, but `1. tundmatu` is left alone, because an unknown head noun means no case
and a bare `N.` is otherwise a full stop.

## Run 2 — 2026-08-30 ~07:20 — ⚠ THE FILE WAS NOT TEXT

The first thing I did was map the file with `grep`. It returned **nothing** — no matches, no error.

    $ file src/languages/estonian/normalize.ts
    src/languages/estonian/normalize.ts: data

A **raw NUL byte** at line 329:

    export const NOMINATIVE = "<U+0000>nom"; // a sentinel that can never be a case ending

The sentinel itself is right and deliberate — a value that can never collide with a real case ending is
exactly what that rule needs. What is wrong is that it is written as a **literal NUL** rather than the
escape `"\0nom"`. The two are the same string; the difference is that one makes the file binary to
`file(1)` and **silently unsearchable to `grep`**.

⚠ **AND THAT IS A REVIEW HAZARD, NOT A COSMETIC ONE.** Every mechanical pass this batch relies on — the
regex-by-codepoint diff, the table-membership diff, the "which constants did the port miss" sweep — is a
`grep` or a read over the source. On this file all of them would have returned **zero findings, silently**,
and I would have reported the file clean.

Fixed in the TypeScript, which is the porting contract's direction:

    export const NOMINATIVE = "\0nom";
    $ file src/languages/estonian/normalize.ts
    src/languages/estonian/normalize.ts: Unicode text, UTF-8 text

Behaviour-neutral, and proved twice: `test/estonian.test.ts` 33/33 after the change, and the `et` parity
gate is byte-identical against goldens generated from the PRE-change TS.

## Run 3 — 2026-08-30 ~07:40 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer      clean
    dotnet run --project csharp/tools/parity -- et    et  OK  200 rows

One API gap found on the way, recorded because the next port will meet it: **`JsRe` has no `Search`**, so
the TS's `String.prototype.search(re)` — used twice by `clauseWindow` — has no direct mirror. It is "the
index of the first match, or −1", written as a four-line local helper over `Match`.

## Run 4 — 2026-08-30 ~07:55 — the tests, pinned to the reference

`EstonianTests.cs` is the portable half of `test/estonian.test.ts` — 93 cases: the grapheme scan with its
three doubling outcomes (long vowel, geminate consonant, and the compound-boundary CLUSTER `keskkool` that
is NOT a geminate), the ordinal in the nominative and in six oblique cases, the ordinal agreeing with its
head noun across the case system, all four of its refusals, the de-grouping, ranges, the decimal comma read
digit by digit, the degree rule's "not said twice" guard, the signs, the era markers, the dotted
abbreviations, the clock's context requirement, and the initialism pass with its hyphen-inflection arm.

    dotnet test --filter "FullyQualifiedName~Estonian"   93/93 on the first run
    all 91 hard-coded expectations re-run against the TypeScript engine directly:
        ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 5 — 2026-08-30 ~08:10 — the differentials

Both references built the way `gen_parity_goldens.mts` builds one — one process, `clearForeignOov()` once,
rows in order, async — with foreign Latin runs in the haystack. The generated set walks the **ordinal ×
head-noun case matrix**, which is what this language is: all 19 noun stems crossed with 15 endings
(including the ones the table must REFUSE), the nominative nouns, the conjunction and dash pair arms, the
`-le`/`-ni` genitive suffix, gemination, the clock with and without its `kell` context, and the numeral
boundaries.

    mined corpus  tools/corpus/mined/et.jsonc → 422 texts     0 differ, 0 throws
    generated     10,000 rows                                 0 differ, 0 throws

## Run 6 — 2026-08-30 ~08:20 — the full gates, both sides

    dotnet test (full suite)     3,478 pass, 0 fail  (93 Estonian + 1 manifest mapping)
    parity, fleet                149 languages byte-identical, 29,305 rows, 0 differ, 0 BLOCKED
    provenance et                3,935/3,935 tokens mapped (100%)
    poison et                    0 sites
    typescript typecheck         clean
    test/estonian.test.ts        33/33

## Read for correctness — filed, not fixed

- **`JsRe` has no `Search`.** See run 3. A four-line helper here; a shared one would be better if a second
  port needs it.
- **THE RAW-INVISIBLE-CHARACTER SWEEP.** Having found one, the whole fleet was swept for the same shape —
  see `docs/raw_invisibles_investigation.md`. Three more code files are broken the same way, and a family
  of PUA sentinels are written as characters that render as *nothing at all*.
