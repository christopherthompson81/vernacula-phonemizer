# Latvian (lv) — C# port investigation

## Run 1 — 2026-08-30 20:05 — scope

    wc -l src/languages/latvian/*.ts
        94 g2p.ts · 61 latvian.ts · 31 manifest.ts · 524 normalize.ts · 63 numbers.ts · 168 ordinals.ts
        (941 total)

Six modules plus `data/languages/latvian/latvian.jsonc`. No lexicon, no neural tier. `Registry.cs:719`
already routed `case "lv"`; `Bootstrap.cs` was the only wiring missing.

Latvian is the sister of Lithuanian but a **separate engine**, and the reason is orthographic: Latvian
*writes* what Lithuanian leaves implicit. Palatalization is spelled (⟨ģ ķ ļ ņ⟩ → ɟ c ʎ ɲ, no contextual
rule at all), length is spelled (macrons → ː), and stress is fixed on the first syllable. So `g2p.ts` is a
mostly-direct grapheme→IPA scan, and its only real machinery is:

  · the native ⟨o⟩ → the falling diphthong **[uɔ̯]**, and ⟨ie⟩ → [iɛ];
  · **falling-diphthong offglides** — ⟨ai ei ui⟩ and ⟨au iu⟩ only; ⟨eu⟩ is hiatus and takes none;
  · ⟨v⟩ → [w] in the coda;
  · nasal assimilation before a velar, and **regressive devoicing only** — no reverse voicing, no
    word-final devoicing (which is where it parts company with Latgalian).

The weight is elsewhere. `normalize.ts` is 524 lines over nine ordered steps, and `ordinals.ts` is a module
with **no counterpart in any port so far**: a nine-slot definite-adjective paradigm crossed with a table of
78 head nouns, because the ORDINAL PERIOD — the language's largest normalization class — reads its case off
the noun the writer already inflected rather than guessing one.

⚠ The ninth slot is **`accPl`, not `genPl`**. Accusative singular and genitive plural are syncretic in `-o`,
so the table carries the accusative plural instead. This is stated in the TS's own comment and it is the
kind of detail a port invents a bug out of.

## Run 2 — 2026-08-30 20:20 — first build + parity

    dotnet run -c Release --project csharp/tools/parity -- lv
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run. That is the *floor*, not the finding — the golden is 200 rows over 132 distinct
texts and touches almost none of the ordinal paradigm.

## Run 3 — 2026-08-30 20:35 — mechanical pattern diff

Literal scan: TS 21 distinct, C# 22. Zero TS-only. The one C#-only literal is the regex-metacharacter
escaper used to build `ABBREVIATION_RE`, and it differs from the TS's only in escaping `[` inside a
character class — which JS does not require and .NET does not mind.

The literal scan is not sufficient here, because `ABBREVIATION_RE` and the whole shared symbol tier are
**built at run time**. Dumped both:

  · TS — a `Proxy` on the `RegExp` constructor. ⚠ **The hook must not clear its log after the dynamic
    import**: `ABBREVIATION_RE` is constructed at MODULE INIT, so clearing after the import throws away the
    single pattern the dump exists to check. The first cut did exactly that and reported it absent.
  · C# — reflection over the assembly's static `JsRe` fields.

`ABBREVIATION_RE` came out **byte-identical**, including the longest-first ordering with the `u.tml.` /
`u.t.t.` tie (both 6 characters) broken the same way — JS `sort` and LINQ `OrderByDescending` are both
stable and both start from the same insertion order.

The shared-tier patterns then read as 12 TS-only, which was **two more instrument bugs stacked**:

  1. The C# harvester read only static fields, but the shared symbol normalizer compiles its patterns into
     **closure state**. Extended it to walk delegate targets and their captured fields (with a visited set).
     12 → 10.
  2. The same character class is spelled `[    ]` in one dump and with the literal characters
     in the other. Folding `\uXXXX` and `\xXX` to the character on both sides: 10 → **1**.

The last one is 0.9969 similar to its C# counterpart and the entire difference is three `\/` vs `/` — a
JS regex-*literal* escaping requirement with no .NET equivalent. **The pattern sets match.**

⚠ And an instrument bug worth recording on its own: the C# dump was piped straight into `grep -E "^(RE|HN)"`,
so when the probe failed to compile it produced an EMPTY file and every diff below it read as "identical".
It only surfaced because the head-noun count printed as 0. Every dump in this file now carries an
explicit non-empty guard.

## Run 4 — 2026-08-30 20:55 — mechanical table diff

`HEAD_NOUN` dumped from both engines and diffed: **78 entries, identical**, keys and cases. That covers
`gads`/`gadsimts` across six slots each and all twelve months, including the ⟨aprīlis⟩ genitive `aprīļa`
whose palatalization the other eleven do not show.

## Run 5 — 2026-08-30 21:10 — the differentials

Corpus: FLEURS `lv_lv` (all three splits) + mined + attest + the golden = **2,703 unique lines**.

    mode=norm   0 of 2703 differ
    mode=text   0 of 2703 differ

Exhaustive g2p walk — all 1-, 2- and 3-letter words over the full alphabet plus ⟨q w x y⟩, all 4-letter
words over a 24-letter set chosen for the PASSES (both offglide series, ⟨ie⟩, ⟨o⟩, the palatals, the velars,
both voicing directions), and a 5-slot band placing a coda after each diphthong:

    339,950 words   0 differ

Numbers, exhaustive 0–20,000 plus every magnitude seam and every non-finite input: **20,088 rows, 0 differ**.

Ordinals, every reachable *n* × all **nine** cases: **19,926 rows, 0 differ** — 19,611 distinct real
readings and 315 refusals (round hundreds and thousands), the refusals matching too.

⚠ The first ordinals run reported **19,611 of 19,926 differ**, which is to say *every row that produced a
reading*. Both causes were mine: the TS cases are camelCase (`nomSg`, not `NomSg`, so `ENDING[c]` was
`undefined` and the TS emitted `pirmundefined`), and my case list said `genPl` where the paradigm has
`accPl`. The C# enum was correct throughout. **A differential that fails on every non-trivial row is a
statement about the harness, not the port.**

## Run 6 — 2026-08-30 21:25 — interaction, astral and fuzz

The two captured-`subject` sites — `Abbreviations` (its sentence-end test) and `Degrees` (its fuse test) —
are the shape that has produced real defects in earlier ports, so they got a built corpus rather than
samples: every abbreviation at a sentence end, mid-sentence, doubled, parenthesized and letter-adjacent;
every degree form against six unit spellings; every head noun × 22 figures × two sentence positions; the
sign, range, de-grouping and decimal rules in combination. **4,398 rows, 0 differ on both `norm` and `text`.**

Astral/surrogate walk — all 2-grams over a pool mixing Latvian letters, digits, punctuation, a combining
mark, ZWJ, BOM, soft hyphen, an astral emoji and an astral digit, plus 40k random strings that also draw
**lone surrogates**: **31,112 rows, 0 differ on `norm`, `text` and `word`.**

`ReadDigits` iterates **code units**, because the TS spells it `digits.split("")`. An astral pair is split
into its halves and each half spaced out on its own. This is the afrikaans/georgian/Latgalian control case —
iterating code *points* here would be a divergence, not a fix — and it is pinned in the suite.

## Run 7 — 2026-08-30 21:40 — seam gates over a large reference

Golden-swap: generated a **347,046-row** TS-sourced reference from the corpus + interaction + word walks,
ran every gate on both engines, restored the 200-row golden afterwards.

    parity        347,046 rows byte-identical, 0 differ
    provenance    tokens 425,626/425,626 (100.0%)
    ipaspans      tokens with IpaSpan 413,842/413,842 (100.0%), 0 spans that do not cover what was emitted
    poison        0 distinct sites (SUBSTRING 0, desync 0)

TS twins agree: `provenance-coverage --full` 425,626/425,626, `ipa-span-coverage --full` 0 bad spans,
`provenance-poison` no sites.

## Run 8 — 2026-08-30 21:55 — suite, mapping and sweep

`LatvianTests.cs` ports the TS suite's assertions, each value taken from the TS engine rather than reasoned,
plus the two pins that cannot be expressed as `InlineData` — a **lone surrogate does not survive xUnit
theory serialization** (it returns as U+FFFD and the row goes on reporting green), so the code-unit and
no-throw pins build their strings in the body.

`LatvianManifestIsFullyMapped` failed on first run with `provenance` and `convention` unconsumed. Both are
documentation metadata that the TS does not read either, declared metadata-only across the fleet; added to
the exemption list. **53 Latvian tests pass.**

Leak sweep: exactly four paths touched — the new `Languages/Latvian/`, the new test file, the `Bootstrap.cs`
registration and the mapping-test entry. Nothing Latvian-specific reached the shared tier.

## Decisions taken deliberately, and why

  · **`UnitPer = ""`** — Latvian's rate denominator is a LOCATIVE, not a preposition: `120 km/h` is
    *kilometri stundā*, so there is no "per" word to emit.
  · **`ExponentPosition.Compound`** — *kvadrātkilometri* is one word, not two.
  · **The ordinal bound is `within100 >= 10 && <= 19`**, not `>= 11`. At 11 the round-tens arm would index
    `TEN[1]` — the empty string — and the numeral would vanish, leaving the ending emitted alone.
  · **The abbreviation table is case-SENSITIVE.** Matching case-insensitively makes `T.I. Ivanovs` — an
    initial pair lv.wikipedia writes — introduce a surname with *tas ir*. Latvian writes abbreviations lower
    case; initials are upper.
  · **The half-measure on an untabulated follower is kept as-is**: with no head noun the case is underivable
    so the figure stays a cardinal (wrong), but the period is still removed, because a Latvian sentence does
    not continue in lower case and a spurious clause boundary corrupts the prosody of everything after it.

## Run 9 — 2026-08-30 22:30 — review of #1208

Two sweeps the differentials structurally cannot do.

**Culture and ordering hazards.** The only culture-sensitive call in the Latvian sources is
`scale.ToUpperInvariant()` in `Degrees`, and its capture is `([CF])` under the `i` flag — the only values
reachable are C/F/c/f, where invariant upper-casing and JS `toUpperCase` agree. `OrderByDescending` and JS
`sort` are both stable and both start from the same insertion order, which is why `ABBREVIATION_RE` came out
identical. Nothing else formats a number, compares a string culturally, or depends on dictionary order.

**⚠ `\d` matches Unicode digits in .NET and only ASCII in JS `u` mode** — a classic silent translation
hazard, and the astral fuzz only covered it by accident (the pool happened to contain U+1D7CE). Closed it
properly: six digit families (Arabic-Indic, fullwidth, Devanagari, Bengali, mathematical bold, ASCII) across
20 frames — de-grouping, decimal comma, range, ordinal period, unit, percent, degree, sign guards, and
mixed-family figures. **251 rows, 0 differ on `norm` and `text`.**

**Output leak sweep over the 347,046-row reference.** Zero stringified `undefined`/`null`/`NaN`, zero double
spaces (the slot-gap class), zero digits surviving into a reading. The emitted-character residue against the
manifest inventory is ⟨ŋ⟩ (produced by the nasal pass in code, not the manifest) and the foreign/host-word
tier handing back Russian, Bengali and Japanese phones — nothing Latvian-specific.

⚠ **15 inputs produce an EMPTY reading**, and three of them are a real defect: `‰`, `№` and `§` have no rule
in any position, so the tokenizer never emits them and they are deleted in silence. `likuma § nosaka` reads
*likuma nosaka*. For `=`, `<`, `+` the same silence is deliberate — an unflanked operator must not be read —
but these three can never be read at all. And `normalize.ts:96`, the SIGN table's own attestation header,
already records **`promiles` 5 tok / 2 arts**: the evidence was gathered and the wiring never happened.

Both engines are byte-identical here, so it is a reference-engine gap and not a port defect. Filed as
**#1209** rather than fixed: it changes what the engine says, which needs corpus evidence and a golden
regeneration, and `§` does not occur in the retained lv corpus at all — exactly the shape where a
linguistically obvious rule has measured net negative here before.

## Outstanding

Nothing found in this port remains unfixed. Two things are deliberately left standing, both identical in
both engines and neither a port defect:

  · the untabulated-follower half-measure (cardinal kept, period dropped) — the TS's own documented trade,
    pinned in the suite so a future change has to be deliberate;
  · **#1209**, the silent deletion of `‰`, `№` and `§`.
