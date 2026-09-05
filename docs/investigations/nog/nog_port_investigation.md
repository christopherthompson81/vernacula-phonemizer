# Nogai (nog) — C# port review

The port landed on `port/nog-nogai` (PR #1233). This is the review of it. The port's own evidence is in
the PR body and in `docs/investigations/nog/nog_native_bringup_investigation.md` (the TS bring-up).

## Run 1 — 2026-08-31 13:02 — a golden collision, and a live instance of a defect predicted a day earlier

`csharp/goldens/nog.tsv` conflicted on rebase. Two sources now exist for it:

- **#1232** (merged minutes before this PR) added a 24-row golden by extending the shared generator's
  lexicon tier to `tools/referee-eval/referees/`, with `nog` on its `REFEREE_LEXICON_ONLY` list.
- **This PR** adds `tools/gen_nog_golden.mts`, a bespoke generator producing 68 rows: the 24 ASJP
  headwords, the one precise kaikki attestation, and 43 numerals reaching every composer arm including
  the above-2⁵³ digit fallback.

Theirs is a **strict superset** — 0 rows in the 24 that are not in the 68 — so it wins on content. But
the collision is worse than a merge conflict, and it was measured rather than argued:

```
$ wc -l csharp/goldens/nog.tsv            # 68, from gen_nog_golden.mts
$ npx tsx tools/gen_parity_goldens.mts nog
0 FLEURS + 0 mined + 1 lexicon-only goldens; 0 empty:
$ wc -l csharp/goldens/nog.tsv            # 24
```

⚠ The shared generator **silently downgrades 68 rows to 24**, discarding every numeral-composer arm and
the 2⁵³ fallback, while reporting "1 lexicon-only golden" as though it had done something useful. This is
exactly the "thin overwrites rich" failure #1232's own review identified and guarded against — here with
a live instance, because a language acquired a better source between the two PRs.

Fix: `nog` comes off `REFEREE_LEXICON_ONLY`. The rule, now written into that list's header: **a language
with its own golden generator must not be on it**, because a bespoke generator counts as a source. `quc`
has never been on it for the same reason (`gen_quc_golden.mts`). Verified after: `nog` appears in the
generator's "empty" list beside `quc`, the golden's md5 is unchanged, and a full regeneration touches 0
goldens. `gen_nog_golden.mts` itself is reproducible and idempotent (three runs, one md5).

## Run 2 — 2026-08-31 13:14 — a hard crash on every word beginning with ⟨в⟩

The coda-⟨в⟩ rule reads the previously emitted segment:

```ts
segs.push(isVowelSeg(segs[segs.length - 1]) && coda ? "w" : "v");   // undefined when empty → false → [v]
```
```csharp
segs.Add(IsVowelSeg(segs[^1]) && coda ? "w" : "v");                 // ArgumentOutOfRangeException when empty
```

⚠ JS `arr[-1]` is `undefined`; C# `list[^1]` **throws**. So every word starting with ⟨в⟩ crashed:

| input | TS | C# (before) |
|---|---|---|
| `вагон` | `vaˈɡon` | **ArgumentOutOfRangeException** |
| `восток` | `voˈstok` | **ArgumentOutOfRangeException** |
| `влак` | `ˈvlak` | **ArgumentOutOfRangeException** |
| `в` | `v` | **ArgumentOutOfRangeException** |

Not obscure — ⟨в⟩ is an ordinary word-initial letter in the Russian loans this orthography carries.

**Why every gate missed it.** The ⟨е⟩ branch four lines below already had the guard
(`segs.Count == 0 || …`); the ⟨в⟩ branch did not. And no word-initial ⟨в⟩ appears in the 68-row golden,
in the 22 C# tests, or in the 6 TS tests — so `parity -- nog` (68/68), provenance, ipaspans, poison and
5,840 passing tests were all clean over a crash. A gate is only as wide as its corpus, and a
lexicon-only golden of 24 headwords is narrow by construction.

Fixed by mirroring the TS read (`segs.Count > 0 && …`), and pinned in **both** suites — `вагон` and the
bare `в` — so the shape cannot come back.

Found by an exhaustive walk rather than by reading: every string of length 1 and 2 over the manifest's
full 40-letter alphabet, length 3 over the positional core, every digraph in eight contexts, and
word-initial ⟨в⟩ before every letter. **5,619 rows, 0 differ** after the fix.

## Run 3 — 2026-08-31 13:26 — a stack overflow that is faithful, and therefore not repaired here

Probing `NumberToWords` directly, C# dies:

```
Stack overflow.
Repeated 52343 times:
   at Vernacula.Phonemizer.Languages.Nogai.Numbers.NumberToWords(Double)
```

`NaN` and `Infinity` fail every `<` comparison and fall to the billion branch, where
`Math.Floor(NaN / 1e9)` is `NaN` and recurses forever. ⚠ `StackOverflowException` cannot be caught in
.NET — the process dies — where the TS raises a catchable `RangeError`.

**Not repaired, and the reasoning is the point.** Both engines are unguarded at `numberToWords`; both
put the guard in the CALLER (`number()` / `Number()`), so the C# is a faithful port of the TS shape. And
it is unreachable from the engine: `TOKEN` matches `\d+` only, and even a 400-digit run becomes
`Infinity`, which the caller's `isSafeInteger` check routes to the digit-by-digit path. Nahuatl, Mossi
and Nama guard at the top of `NumberToWords` — in both their engines, equally faithfully.

So this is a **TS-side finding**, not a port defect: `numberToWords` infinite-recurses on non-finite
input in both languages, and only the failure MODE differs. Recorded rather than changed, because
guarding it would be a behaviour change on an input the TS handles differently anyway, and the choice of
what a public composer should do with `NaN` is a design decision this review does not own.

Re-run over the reachable space — every digit run the tokenizer can actually deliver, 0…120,000
exhaustive plus every magnitude seam through 10¹⁶, 2³¹, 2⁵³ and 18–20 digit runs: **211,137 rows, 0
differ** on the composer and again on the full pipeline.

## Run 4 — 2026-08-31 13:30 — the rest

| walk | rows | differ |
|---|---|---|
| Cyrillic word walk (exhaustive len 1–2 over 40 letters, len 3 over the positional core, digraphs × 8 contexts, ⟨в⟩-initial × every letter) | 5,619 | 0 |
| numbers, reachable space | 211,137 | 0 |
| full pipeline over the same | 211,137 | 0 |
| corpus (ASJP referee, golden, TS test literals, bring-up doc, manifest keys) on `norm`/`word`/`text` | 237 ×3 | 0 |
| fuzz — separator-hygiene arms, Cyrillic runs, astral, lone surrogates, invisibles — on `norm`/`word`/`text` | 27,403 ×3 | 0 |

Pattern diff: one pattern per side (`TOKEN`), byte-identical including flags — this layer's normalizer is
`SeparatorHygiene` alone. Test pair diff **13 TS / 13 shared / 0 TS-only**, no duplicate `InlineData`, no
test method missing its attribute. Culture sweep: `Js.ToLowerCase` + `Js.Normalize` on input, one raw
`.Normalize` on the OUTPUT (the fleet idiom at 71 sites, and safe here because the scan drops any
character with no table entry). Leak sweep over the golden with a planted `ħ`: **0 strays**, probe fires.

## Gates

```
dotnet test        5,902 passed, 0 failed
parity -- nog      68/68 byte-identical
parity (full)      180 languages byte-identical, 0 differ (34,695 rows)
seam gates         provenance 68/68 · ipaspans 68/68, 0 wrong · poison 0
TS suite           290 files / 5,746 tests
```

## Standing

- **Fixed:** the word-initial ⟨в⟩ crash, and the `REFEREE_LEXICON_ONLY` collision that would have
  downgraded this PR's golden.
- **Recorded, not fixed:** `numberToWords` infinite-recurses on non-finite input in BOTH engines — a
  TS-side design question, unreachable from either engine.
- ⚠ **Worth knowing:** nog's gate is a 68-row lexicon-and-numerals golden. It pins the g2p over the
  engine's whole evidence base and every composer arm, but there is no Nogai running text in this repo,
  so nothing pins the normalization. The suites remain the instrument there.
