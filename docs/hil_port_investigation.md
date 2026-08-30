# Hiligaynon (hil) — C# port investigation

Chronological log of the runs behind the hil port.

## Run 1 — 2026-08-30 08:00 — scope

    wc -l src/languages/hiligaynon/*.ts
          110 hiligaynon.ts · 276 normalize.ts ·  66 numbers.ts   (452 total)

Three modules plus the data manifest `data/languages/hiligaynon/hiligaynon.jsonc` (no symbolTier
block — unlike Cebuano, the TS hard-codes the tier data in `normalize.ts`, so the C# does too).
The load-bearing half is the g2p: a shallow near-phonemic scan where the TRIGRAPHS ⟨gui gue qui
que⟩ are tried before the digraphs ⟨ng ch ny ts ll rr⟩, with a word-initial glottal before a
vowel, a HIATUS glottal between two vowels, an intra-word hyphen → [ʔ], and penultimate stress.
The deltas from Cebuano are the Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p], carried in the manifest,
plus the `mga`→`manga` special word. `numbers.ts` is the native Austronesian set: tens-first with
the `kag` connector and the `ka` ligature, covering 0 … <10⁹.

No shared-core change was needed. `Clauses`, `LoadManifest`, `NormalizeSymbols`, `JsRegex`,
`HostWord` (word run + nativiser) and `Rewriter` are all ported, and `Registry.cs` already routes
`case "hil"` (Registry.cs:479) — the factory registration in `Bootstrap.cs` was the only wiring
missing, the same state as the fo port found itself in. `csharp/goldens/hil.tsv` (112 rows) exists,
so the parity gate applied from the first run. The closest structural models read were **Cebuano**
(the shared Bisayan core — its C# port is line-for-line the shape of this one) and **Faroese**
(the most recent port: the probe-harness layout and the gates list).

⚠ **NO FLEURS.** `hil` is not among FLEURS's 102 languages — the TS `normalize.ts` header records
the measurement (meta's sitematrix lists Wikipedias for bcl, ceb, ilo, pag, pam, tl and war and
none for hil), and there is no `hil` transcript directory to check in this environment. The mined
tier is the WHOLE corpus: `tools/corpus/mined/hil.jsonc` (93 `hard` lines + 40 `sample` lines,
API-sourced from the Wikimedia Incubator's Wp/hil), and there is no `tools/corpus/attest/hil.jsonc`.
PORTING.md's widening (1) — the corpus-wide FLEURS differential — is unavailable, and the weight
falls on the 112-row golden, the mined corpus, the off-golden probes, and the exhaustive g2p walk.
Stated here because it changes what the gate can and cannot see, not to soften the verdict.

## Run 2 — 2026-08-30 08:05 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean (only the pre-existing Marathi CS0108)
    dotnet run --project csharp/tools/parity -- hil   hil  OK  112 rows

112/112 byte-identical on the first parity run. The one decision worth recording: `phonemizeWord`
lowercases with `Js.ToLowerCase`, not `ToLowerInvariant` — the current contract (PORTING.md, the
#1116 rule) even though the Cebuano sibling still carries `ToLowerInvariant`; for a Latin alphabet
of `a-z` plus `ñ` the two agree on every reachable character, but the port follows the contract
rather than the sibling.

## Run 3 — 2026-08-30 08:15 — the tests, pinned to the reference

`HiligaynonTests.cs` is the portable half of `test/hiligaynon.test.ts` — 49 cases: the glottal
stops and the nasal, the two Spanish-loan deltas, the native vocabulary, the registry wiring, the
11 number rows (the `ka-…-an` tens, the tens-first compounds, the `ka`-ligature magnitudes, the
≥10⁹ digit-by-digit fallback), the de-grouping/decimal rows (including the period-thousands
refusal), the `hasta` ranges with decimal operands, the symbol-tier rows (percent, ₱, the squared
word, the rate, the NOT_VERSION `802.11m` refusal), the `alas`-guarded clock with its `ISO
20715:2023` adversary, the dotted abbreviations (including the kept sentence-final dot), the
ordinal linker pair, the `sg` shorthand with all four of its collisions, and the ordinary-text
survival rows. `ManifestMappingTests` gained `HiligaynonManifestIsFullyMapped` — every key in
`hiligaynon.jsonc` (digraphs, consonants, vowels, specialWords, numbers, clausePunctuation) is
consumed by the C# type; all camelCase, so no `[JsonPropertyName]` was needed. `DEF` is `public`
for the test's access, as in Swahili/Indonesian.

    dotnet test --filter "FullyQualifiedName~Hiligaynon|FullyQualifiedName~ManifestMapping"
                                                        196 pass, 0 fail

## Run 4 — 2026-08-30 08:25 — the corpus differential, mined + probes

The mined corpus was extracted to **154 unique lines** (93 hard + 40 sample text lines plus the
artifact's own metadata strings, which the walker takes — the same shape the fo harness had) and
merged with **165 hand-built probes** (one per normalize arm plus its adversarial neighbour, the
g2p corners, the number corners) for **319 lines**, run through all relevant entry points:

    C# sync   vs TS sync:          0 of 319 differ
    C# async  vs TS sync:          0 of 319 differ   (hil has no neural path)
    C# norm   vs TS norm:          0 of 319 differ   (both after the pre-pass)

Coverage of the arms, measured over the 319 lines, not assumed: digit-run 186+ (the corpus's
`digit-run` cell alone is ×1,867 over the full Wp/hil dump) · decimal 335 (corpus) · grouped 1,841
(corpus) · clock 124 (corpus) · ranges 6 · decimals-as-operands 2 · percent 3 · currency 4 ·
units 10 · squared 3 · rate 3 · ampersand 3 · abbreviation 14 (incl. the `ſr.` #1122 miss branch
and the `Panay.`/`Asya.` sentence-end refusals) · ordinal-linker 4 · `sg` 8 (incl. all four
collisions) · trigraph 6 · hyphen 4 · **cubed 1** (`2 km³` — `cubed` is UNDECLARED in the tier,
and both engines leave it; probed so a later declaration cannot drift silently) · **currency+
magnitude 4** (`₱1 trilyon`, `₱5 libo`, `5 milyon`, `2 bilyon` — the corpus has ZERO currency
instances, so the magnitude hop is reached only by probes).

⚠ THE MINED ARTIFACT IS THE WHOLE HAYSTACK, and it is small: 133 text lines against the
112-row golden, and the two overlap heavily (the golden is generated from the same Wp/hil
paragraphs). A clean differential over it is strong for the NORMALIZER — the cells are selected
adversarily against the pattern shapes — but the two sources are not independent witnesses.
The g2p walk in Run 8 is what carries the independent weight for the word reader.

## Run 5 — 2026-08-30 08:27 — leak sweep

    C# outputs (sync + async, 319 lines):  0 carry a raw ASCII digit or a symbol (& % $ ₱ ° ± × ÷)
    TS outputs (same lines):               0

## Run 6 — 2026-08-30 08:30 — the provenance gates

    parity --poison hil        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    parity --provenance hil    tokens 3707/3707 (100.0%)
    parity --ipaspans hil      tokens with IpaSpan 3290/3290 (100.0%), wrong 0
    seam-parity.mts            hil: absent from the disagreement table — TS rewrite count == C#
                               Rewrite count (gap 0), as with fo

All seven `Rewrite` sites in `Normalize.cs` are legitimate pipeline-string seams — none named as
SUBSTRING, so nothing was reverted. The two engines carry one mismatch rule.

## Run 7 — 2026-08-30 08:14 — the full gates

    dotnet test (full suite)                 3,722 pass, 0 fail   (49 Hiligaynon + 1 manifest)
    parity (ALL goldens)                     153 languages, 30,017 rows, 0 differ, 0 BLOCKED
    npx vitest run test/hiligaynon.test.ts   15/15 (TS unchanged)

`hil` is gated; nothing moved in the other 152 languages (152 → 153, 29,905 → 30,017 rows, the
+112 being the hil golden). **TypeScript unchanged** — no defect found on the reading pass.

## Run 8 — 2026-08-30 08:40 — the g2p walked, not sampled

Hiligaynon's alphabet is 29 characters (`a-z` plus `ñ` and the two apostrophe glottals, the
`NATIVE_CLASS` inventory) and the g2p is a function of the scan position, so every 1-, 2- and
3-letter string over the alphabet is enumerated (**25,259** of them) and phonemized at the WORD
level in both engines:

    TS phonemizeWord vs C# PhonemizeWord:   0 of 25,259 differ

This covers every trigraph/digraph adjacency, the initial-glottal and hiatus-glottal contexts,
the hyphen arms (word-initial, word-final, doubled), the unknown-letter skip, and the
penultimate-stress selection exhaustively rather than by sample — the independent witness the
overlapping golden/mined pair did not provide.

## Run 9 — 2026-08-30 08:45 — the pattern sweep

Every pattern the port compiles, compared against the TS source:

    10 static C# patterns; every one byte-identical to its TS counterpart (flags included)
    2 dynamic: TOKEN (host-word run spliced, same `giu`) and ABBREV (built from the table's own
    keys, longest-first, stable — the TS `Object.keys().sort((a,b)=>b.length-a.length)` and the C#
    `OrderByDescending` yield the same `prof|mrs|dr|jr|sr|st|mr|fr`; verified, not assumed)
    NATIVE_CLASS + the nativiser flags (`iu`): identical
    the symbol tier: shared core (Core/NormalizeSymbols.cs), already differentially verified

## Read for correctness — notes, nothing filed

The three questions per file, against the TS docstrings:

- **hiligaynon.ts — the docstring's promises are what the code does.** Trigraphs before digraphs,
  both before the single letters; the initial and hiatus glottals; the hyphen → [ʔ] with its two
  refusals (word-initial, word-final); penultimate stress; `mga`→`manga`. Every manifest table is
  REACHED: all ten digraph keys (the four trigraphs plus six digraphs) in the scan, all
  sixteen-plus consonant rows, all five vowels, the special word, all six clause marks through
  the TOKEN's punctuation arm, and the whole `numbers` block through `numberToWords` (all ten
  units, all nine non-empty tens, the connector, the ligature, the three magnitudes). The shipped
  entry point, the golden and the parity tool all measure the same `Phonemize`/`PhonemizeAsync`
  path — and hil has no neural table, so the two coincide by construction.
- **normalize.ts — the eight steps run in the documented order**, and the order is what three of
  the probes exist to hold still: the tier ABOVE the decimal rule (so `NOT_VERSION` still sees the
  dot in `802.11m`), the range rule ABOVE the decimal rule (so `3.5–3.8` does not read `5 hasta
  3`), de-grouping FIRST (so `12,706 km²` is not seen as `706 km²`). The `sg` rule is lower-case-
  only (no `i` flag — the collisions are in upper case) and the clock's `a?las` lookbehind is
  required, both as the docstring argues from the corpus.
- **One faithful oddity, recorded rather than fixed.** In the TS `scan`, the trigraph lookup is
  tried with a STRING that is only two characters long when the word ends at `i+1` — and that two-
  character string CAN hit a two-character digraph key, after which the scan advances `i += 3`
  rather than `i += 2`. The C# reproduces it verbatim. It is observationally a no-op: the hit can
  only happen at the word's last two characters, where both advances land past the end. The g2p
  walk (Run 8) covers it — every length-2 word is in the enumeration.
