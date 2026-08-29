# Cherokee (chr) — C# port investigation

Chronological log of the runs behind the chr port.

## Run 1 — 2026-08-30 ~02:10 — scope, and the one hazard worth auditing first

    wc -l src/languages/cherokee/*.ts data/languages/cherokee/cherokee.jsonc
        69 cherokee.ts · 252 normalize.ts · 80 numbers.ts · 47 cherokee.jsonc

A small port with one interesting property: **the char → IPA table is BUILT, not tabulated.**
`cherokee.ts` walks the 85 ordered syllable values from the jsonc and derives each character as
`String.fromCodePoint(0x13A0 + index)`, splitting the spelling into onset + vowel. So the syllabary's own
ordering is the only index, and the usual "a table transcribed with one member wrong" defect — the `ab`,
`rup` and `bal` finding — **cannot occur here by construction**. What replaces it is whether the C# builds
the *same* table, which is a different check and is run 3.

⚠ **THE HAZARD IS `word.toUpperCase()`**, and it is the Georgian Mtavruli question in reverse. The g2p
folds the Cherokee Supplement lowercase (U+AB70–ABBF, plus the small letters U+13F8–13FD) onto the main
block by uppercasing — and an unfolded character looks up to nothing and is **silently dropped**, exactly
the failure mode Georgian's comment warns about. Two things checked before a line was written:

  * `Core/Js.cs` has a `ToLowerCase` but **no `ToUpperCase`** — the helper exists only because .NET's
    *lowercasing* diverges from JS in 28 places (final sigma among them). The uppercase direction has no
    such helper, and the fleet's 26 existing `.toUpperCase()` mirrors all use `ToUpperInvariant` directly;
  * so `ToUpperInvariant` was swept against node across all 86 Cherokee lowercase codepoints:

        ToUpperInvariant MATCHES JS on all 86 Cherokee lowercase codepoints

`Registry.cs` already routed `case "chr": return Create("cherokee")`, and `csharp/goldens/chr.tsv` exists.

## Run 2 — 2026-08-30 ~02:30 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet run --project csharp/tools/parity -- chr   chr  OK  200 rows

## Run 3 — 2026-08-30 ~02:40 — the BUILT table, codepoint by codepoint

Since the table is derived rather than copied, the right check is not a table diff but a comparison of the
two derivations. Every codepoint the engine can be handed — the main block U+13A0–13F5, the small letters
U+13F8–13FD, and the Supplement U+AB70–ABBF — was run through both engines' `phonemizeWord`:

    THE BUILT TABLE MATCHES THE TS ON ALL 172 CODEPOINTS (main block + small letters + Supplement)

That covers the derivation, the two non-CV special cases (bare `Ꮝ` = /s/ and the obsolete `nah` → `na`),
the hand-added U+13F5 MV, and the case fold, in one sweep.

Then the ordinary mechanical passes:

    regexes      TS 9 / C# 8, all 8 real patterns byte-identical (the 9th is comment prose)
    UNITS        TS 11 / C# 11   MATCH   (ORDER MATTERS)
    TEENS        TS  9 / C#  9   MATCH   (ORDER MATTERS — a SUPPLETIVE series, not derivable)
    TENS         TS 10 / C# 10   MATCH   (ORDER MATTERS)
    HI · HUNDRED_SUFFIX · THOUSAND      MATCH

## Run 4 — 2026-08-30 ~02:55 — the tests, pinned to the reference

`CherokeeTests.cs` is the portable half of `test/cherokee.test.ts` — 31 cases: the syllabary readings and
the single-character corners of the built table (the aspirated split cell, the labialised velar, the
lateral affricate, bare `Ꮝ`, U+13F5 MV), the Supplement fold, the clipping tens and the hundred built from
the TENS word, the digit-by-digit fallback above 10⁶, and every one of the normalizer's five rules
together with the classes it refuses.

    dotnet test --filter "FullyQualifiedName~Cherokee"   31/31 on the first run
    all 30 hard-coded expectations re-run against the TypeScript engine directly:
        ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 5 — 2026-08-30 ~03:05 — the differentials

Both references built the way `gen_parity_goldens.mts` builds one — ONE process, `clearForeignOov()` once,
rows in order, async (the `bpy` lesson). ⚠ And the foreign runs are not optional here: **14.4% of this
corpus's characters are Latin**, 1,075 runs over 669 distinct forms, and 30 of its 315 retained segments
carry more Latin than Cherokee. A generator without them would gate almost nothing of what this engine
actually meets.

The haystack sweeps the whole syllabary in both cases (every codepoint of both blocks appears in generated
words), the numeral bands either side of every boundary, all five normalizer rules with their refusals,
the HTML dash entities, and the Latin runs.

    mined corpus  tools/corpus/mined/chr.jsonc → 272 texts     0 differ, 0 throws
    generated     10,000 rows                                  0 differ, 0 throws

## Run 6 — 2026-08-30 ~03:15 — the full gates

    dotnet test (full suite)     3,251 pass, 0 fail  (31 Cherokee + 1 manifest mapping)
    parity, fleet                146 languages byte-identical, 28,705 rows, 0 differ, 0 BLOCKED
    provenance chr               4,290/4,290 tokens mapped (100%)
    ipaspans chr                 0 spans wrong
    poison chr                   0 sites
    typescript                   unchanged

## Run 8 — 2026-08-30 ~04:20 — review of #1173: the compositor swept exhaustively

The port's generator sampled numerals; the compositor deserves better than sampling, because its two
interesting rules fire on narrow conditions — the tens CLIP only for 21–99 with a NONZERO unit, and the
hundreds are built by suffixing the TENS word rather than the unit word, so `TENS[1]` is reachable only
through the hundred path. Both are cheap to walk completely:

    0 … 2000 exhaustively, plus every band boundary — 9999/10000, 99999/100000, 999999/1000000
    (the 10⁶ digit-by-digit cliff), 10¹², and 2⁵³ either side

And the axes the port's generator did not have:

  * **ASTRAL INPUT.** `PhonemizeWord` iterates CODE POINTS (`Js.CodePoints` against the TS's `for…of`), so
    a surrogate pair is the test that tells a code-unit loop from a code-point one: 🙂, 𐍈, and both
    embedded mid-word.
  * **THE SMALL-LETTER BLOCK U+13F8–13FD**, which the TOKEN class `[Ꭰ-Ᏽꭰ-ꮿ]` does NOT cover — so `text()`
    sends it to the FOREIGN path while `PhonemizeWord` reads it happily. The two engines must agree on
    that split, not merely on the table.
  * **THE NORMALIZER'S BOUNDARIES**, one either side of each of the five rules: `1,23` against `1,234`
    against `1,2345`, a leading `0,123`, `1.2`/`1.2.3`/`.5`/`5.`, all four dash spellings spaced and
    unspaced, and the entity rule's neighbours (`&NDASH;`, `&amp;ndash;`, `&ndash` unterminated).
  * NFD input, a combining mark, ZWJ, and the whitespace edges.

    2,090 inputs, 0 differ, 0 throws

## Run 9 — 2026-08-30 ~04:30 — the read, and two things that did NOT need fixing

  * **The digit-by-digit fallback is the GUARDED form on both sides** — `filter(c => c >= "0" && c <= "9")`
    in the TS, an ASCII-digit test in the C# — so #1165's whitespace-reads-as-zero quirk does not apply to
    this language at all. Checked rather than assumed, because the fleet carries both conventions.
  * **The manifest test needs no exclusion list.** `cherokee.jsonc` has exactly six top-level keys and
    `CherokeeManifest` binds all six, so `AssertFullyMapped` covers the file with no `metadataOnly`
    carve-out — unlike Georgian's, which had to exclude `provenance` and `convention`.

No defect found; no code changed by the review.

## Read for correctness — filed, not fixed

- **`Core/Js.cs` has `ToLowerCase` but no `ToUpperCase`**, and that asymmetry is correct rather than an
  oversight: the lowercase helper exists because .NET diverges from JS in 28 places, and the fleet's 26
  uppercase mirrors use `ToUpperInvariant` directly. Verified for this language's ranges rather than
  assumed — but a future port whose uppercase touches Turkish ⟨i⟩, German ⟨ß⟩ or the Greek sigma should
  sweep its own ranges before trusting it, because no shared helper is guarding that direction.
- **`normalize.ts` exports a `CHEROKEE` character-range constant** that nothing imports today. Ported as a
  `const` for fidelity; if the script router ever needs it on the C# side it is already there.

## Run 7 — 2026-08-30 ~04:00 — rebase onto the `be` merge (#1172) and recount

Belarusian landed while this branch was open. Rebased onto it — **one conflict, in `Bootstrap.cs`**, where
both ports had inserted their registration on the line after Georgian's. Resolved by keeping both, which is
what the file wants; every other file in this port is new, so nothing else could collide.

    dotnet test (full suite)     3,343 pass, 0 fail   (3,312 on the be base + 31 Cherokee)
    parity, fleet                147 languages byte-identical, 28,905 rows, 0 differ, 0 BLOCKED
    provenance chr               4,290/4,290 tokens mapped (100%)
    poison chr                   0 sites

⚠ The arithmetic is spelled out because the `be` review found a doc whose suite line read "+92 Georgian"
where the 92 were Belarusian's own — the two ports happened to contribute the same number, so the
mislabel read as arithmetic that checked out. Here 3,312 is the total ON the be base and the 31 added are
Cherokee's; both figures were measured, not inferred.
