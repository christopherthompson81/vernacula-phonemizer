# Lithuanian (lt) — C# port investigation

## Run 1 — 2026-08-30 23:10 — scope

    wc -l src/languages/lithuanian/*.ts
        147 g2p.ts · 63 lithuanian.ts · 74 manifest.ts · 914 normalize.ts · 101 numbers.ts   (1,299 total)

The largest port in this series so far — Latvian was 941 lines, and this normalizer alone is 914. Five
modules plus `data/languages/lithuanian/lithuanian.jsonc`. No lexicon, no neural tier. `Registry.cs:717`
already routed `case "lt"`; `Bootstrap.cs` was the only wiring missing.

The g2p is the sibling of Latvian's and the inverse of it. Latvian **writes** what Lithuanian leaves
implicit, so Latvian's scan is nearly direct and Lithuanian's is where the work is:

  · **PALATALIZATION** — a consonant is soft before a single front vowel, the softening ⟨i⟩, ⟨j⟩, or the
    rising diphthong ⟨ie⟩ (which opens on a front [i]); ⟨uo⟩ does **not** trigger, because it opens on the
    back [u]. Softness then spreads REGRESSIVELY through the cluster — except onto ⟨k ɡ⟩, which soften only
    directly before a front vowel (`knyga` → knʲiːɡɐ, the ⟨k⟩ hard before a soft ⟨nʲ⟩).
  · **THE SILENT SOFTENING ⟨i⟩** — an ⟨i⟩ between a consonant and a back vowel marks the consonant soft and
    is then dropped, and the following ⟨a ą⟩ FRONTS to [ɛ]/[ɛː] (`čia` → t͡ʃʲɛ).
  · **VOICING** assimilation, regressive within obstruent clusters, preserving the ʲ (bʲ→pʲ).
  · **n → ŋ** before a velar.
  · **NO STRESS IS EMITTED** — Lithuanian stress is lexical and pitch-accented, unpredictable from spelling.

`numbers.ts` is the Baltic THREE-WAY counted-noun concord (…1 → nom sg, …2–9 → nom pl, …0 / 11–19 → gen pl),
and the reason the shared symbol tier is not wired at all: `core/normalizeSymbols.ts` holds one invariant
string per unit and cannot say any of the three. Every rule in `normalize.ts` therefore words-ifies its own
operand and calls `agree()` itself.

⚠ This is also the first port in this series to wire **`core/initialisms.ts`** — the shared seam that decides
what to do with an all-caps letter run before the tokenizer.

## Run 2 — 2026-08-30 23:40 — first build + parity

    dotnet run -c Release --project csharp/tools/parity -- lt
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run — the floor, not the finding.

## Run 3 — 2026-08-31 00:05 — mechanical pattern diff

This file is the wrong shape for a literal scan: most of its patterns are built at RUN TIME, one per unit
key, per currency and per magnitude. So both sides were dumped instead — TS through a `Proxy` on the
`RegExp` constructor (⚠ **not cleared after the dynamic import**, or every module-init pattern is thrown
away), C# by reflection over static `JsRe` fields *and delegate closure state*, with an explicit non-empty
guard so a probe that fails to compile cannot read as "identical".

    TS 94 distinct patterns · C# 232 · TS-only after folding \uXXXX escapes and JS's `\/`: **2**

Both are `°C`/`°F`, and the entire difference is the FLAG STRING: TS reports `giu`, C# reports `gui`. JS
normalizes `RegExp.prototype.flags` to alphabetical order; the TS source itself writes `"gui"`. Identical
sets. **The pattern sets match.**

## Run 4 — 2026-08-31 00:30 — the differentials

Corpus: FLEURS `lt_lt` (all three splits) + mined + attest + the golden = **2,712 unique lines**, run through
four entry points — the normalizer alone, the initialism pass alone, the two composed, and the full engine.

    norm 0/2712 · init 0/2712 · full 0/2712 · text 0/2712

Exhaustive g2p walk — all 1-, 2- and 3-letter words over the full alphabet plus ⟨q w x⟩, all 4-letter words
over a 28-letter set chosen for the PASSES, every digraph (⟨ch dz dž ie uo⟩) in every slot with a following
coda, and the softening-⟨i⟩ frame C-i-BACKVOWEL exhaustive over consonants × back vowels × a following
consonant:

    671,379 words   0 differ

Numbers, exhaustive 0–20,000 plus every magnitude seam through 10^13 (the fallback threshold here is 10^12,
not Latvian's 10^9) and every non-finite input: **20,106 rows, 0 differ**. Digit-by-digit fallback including
astral digits and lone surrogates: 12 rows, 0 differ.

**The interaction corpus is the one that matters** — thirteen ORDERED steps whose couplings the TS header
documents at length, so each was given cases rather than sampled: the marked clock and every counter-example
the refusal names; the multi-dot era phrases and the coordinate suffixes; de-grouping to a fixed point with
both earned guards; the dimension cross; ranges with the score refusal, the preposition suppression, the
temporal branch, the feminine left operand and the ISBN chains; the signs; percent in both spellings;
degrees; every unit key with and without an intervening magnitude, squared and not, with both slash guards;
the one-letter `m`/`t`/`g` keys and their discriminators; all four currencies on both sides with abbreviated
and spelled magnitudes and the say-it-twice guard; the magnitude abbreviations with the governs-a-noun
lookahead and its era exclusion; the date abbreviations across all twelve months; the single-dot
abbreviations in both cases; the decimal comma; the ampersand.

    1,540 rows · norm 0 · full 0 · text 0

## Run 5 — 2026-08-31 01:00 — the initialism seam, fuzz, and the case-folding probe

The initialism pass is shared infrastructure configured by this language, so it was walked exhaustively
rather than sampled: every 2- and 3-letter upper-case run over the full Lithuanian alphabet, every 4-letter
run over a 21-letter subset, and 4,000 of them again inside four sentence frames (the pass is
context-sensitive — personal initials and the lone initial are separate rules).

    244,273 rows · through the pass 0 differ · through the full engine 0 differ

Astral/surrogate fuzz over a pool mixing Lithuanian letters, digits, the punctuation these rules read, a
combining mark, ZWJ, BOM, soft hyphen, an astral emoji, an astral digit and **lone surrogates**:

    36,962 rows · norm 0 · full 0 · text 0 · word 0

⚠ **`\d` matches Unicode digits in .NET and only ASCII in JS `u` mode.** Six digit families (Arabic-Indic,
fullwidth, Devanagari, Bengali, mathematical bold, ASCII) across 21 frames — every rule that reads an
operand: **263 rows, 0 differ**.

⚠ **AND THE SHARED INITIALISM TIER LOWERCASES WITH `ToLowerInvariant` WHERE THE TS USES `toLowerCase`.**
That is pre-existing shared infrastructure, but the two disagree on a handful of characters, and the
exhaustive walk above used only Lithuanian's own alphabet — so it could not have seen it. Probed directly on
İ, I, ı, ẞ, ß, Σ, ς, Ω, Å, K (Kelvin sign), the ǅ/Ǆ title-case trio, ﬁ, Ⅷ, ᾼ and ΐ, in pairs and in sentence
frames: **969 rows, 0 differ** through both the pass and the engine.

## Run 6 — 2026-08-31 01:35 — seam gates over a large reference

Golden-swap: a **735,869-row** TS-sourced reference built from the corpus + interaction + word walks + digit
families + 60,000 initialism rows. Every gate on both engines, golden restored afterwards.

    parity        735,869 rows byte-identical, 0 differ
    provenance    tokens 894,019/894,019 (100.0%)
    ipaspans      tokens with IpaSpan 883,783/883,783 (100.0%), 0 spans that do not cover what was emitted
    poison        0 distinct sites (SUBSTRING 0, desync 0)

TS twins agree exactly: 894,019/894,019, 883,783/883,783, 0 bad spans, 0 poison sites.

⚠ The first attempt at this run **timed out with the golden still swapped in**. The restore is now the last
statement of its own command rather than the tail of a long chain, and the run afterwards confirms
`git diff --stat csharp/goldens/lt.tsv` is empty.

## Run 7 — 2026-08-31 01:50 — culture sweep and the output leak sweep

**Culture and ordering.** There is no `ToLower`/`ToUpper`, no culture-sensitive compare, no number
formatting and no order-dependent dictionary in the Lithuanian sources at all. The remaining hits are
`char.ToString()` (culture-independent), `string.Contains(char)` (ordinal by definition) and `HashSet`
lookups built with `StringComparer.Ordinal`. ⚠ `MAGS` is spelled without the `g` flag on purpose — the TS
calls `.test` on those three literals, which is stateless; a `g` there would make every other call fail
through `lastIndex`.

**Output leak sweep over the 735,869 readings.** Zero stringified `undefined`/`null`/`NaN`, zero double
spaces, zero digits surviving into a reading. Sixteen inputs produce an empty reading and **all sixteen are
mathematical bold digits** (U+1D7CE…), which fall outside both the Latin token run and `\d` — TS-identical,
and not a class that occurs in text. Unlike Latvian's `‰`/`№`/`§`, there is nothing here to file.

## Run 8 — 2026-08-31 02:05 — suite, mapping and sweep

`LithuanianTests.cs` ports the TS suite's 176 assertions, each value taken from the TS engine rather than
reasoned, plus the two pins that cannot be expressed as `InlineData` — a lone surrogate does not survive
xUnit theory serialization, so the code-unit and no-throw pins build their strings in the body. **176 tests
pass.** `LithuanianManifestIsFullyMapped` passes with `provenance` declared metadata-only (this manifest has
no `convention` key).

Leak sweep: exactly four paths touched — the new `Languages/Lithuanian/`, the new test file, the
`Bootstrap.cs` registration and the mapping-test entry. Nothing Lithuanian-specific reached the shared tier.

## The faithfulness decisions, and why

  · **The g2p tokenizer indexes CODE UNITS.** The TS uses `w[i]` and `w.slice(i, i + 2)`, so an astral
    character arrives as its two surrogate halves and each is offered to the tables separately. Same for
    `readDigits`'s `split("")`, `bare()`'s fraction split and step 12's. Iterating code POINTS anywhere here
    would be a divergence, not a fix — the afrikaans/georgian control case, not the #1193 correction.
  · **The fallback threshold is 10^12**, not Latvian's 10^9, and the entry point has NO operand-length guard
    — `numberToWords(Number(tok), tok)` runs on every digit run.
  · **`MAGS` carries no `g` flag** (see above).
  · **The `°C`/`°F` flag string is `gui`**, matching the TS source's own spelling.
  · **The `m.`/`m` residuals are pinned as they read, not as they ought to read** — one metre read as a year
    and one year read as metres, both in the retained corpus, neither separable from the string. An unpinned
    known defect is indistinguishable from a regression the next reader introduces.

## Run 9 — 2026-08-31 03:00 — review of #1210

**One structural fix in the port.** Steps 9 and 9b built their patterns from a hand-written parallel array
`MAG_SOURCES = ["mlrd", "mln", "tūkst"]` mirroring the three entries already in `MAGS`. The TS reads
`re.source` off the table itself precisely so there is nothing to drift; the C# now does the same and the
parallel array is gone. Behaviour-neutral, re-verified: corpus norm/text, interaction norm/full and the
36,962-row astral fuzz all still 0 differ.

**A leak measurement rather than an invented instrument.** The TS header cites `mine.ts scan`, which is not
in this repository, so the thing it measures was measured directly instead: normalize the 2,712-line corpus
and ask which unit, abbreviation and sign keys SURVIVE into the text the g2p will read. That is exactly what
this layer exists to prevent, and both engines produce identical normalized text, so anything found is
inherited rather than a port defect.

Most survivors are the header's own documented refusals, and the measurement confirms them rather than
finding anything: all eleven surviving `km` are RATES (`km/h`, `km/val.`, `km/s`), the `d.` is the version
string `1.13d.`, and `kcal`, `Mbit`, `MB/s`, `kV`, the bare `°`, `×`, `±` and `a.m.` are each declined on the
record.

⚠ **Two are not documented, and they are the same defect twice.** The layer twice decides in writing that
*refusing to read the NUMBER is not a reason to hand the abbreviation back to the g2p* — once for `val.`,
once for the magnitude — and two members of that same class never got the line:

  · **`min.` has no mop-up.** `2:11.60 min.` → `… mʲɪn .` — a vowel-less cluster read as a word plus a
    spurious sentence break, which is verbatim the defect the header records as the reason `min.` was
    declared at all. `val.` in the identical position is mopped up. The noun is already in the manifest.
  · **A currency sign whose figure was refused is DELETED.** `55.89 mlrd €` → the magnitude IS mopped up
    (*milijardų*) and the `€` is not — and since `€` is not a Latin letter the tokenizer never emits it, so
    it does not leak, it vanishes. `importas 55.89 milijardų €` reads as an amount with no currency. Nothing
    is left over, so no leak class, DROP, poison site or provenance gap can see it.

One instance each in the retained corpus (`min.` 1 of 3; a currency sign 1 of 18). The counts are not the
argument — the structural one is. Filed as **#1211**; not fixed here, because it changes what the engine says
and needs a golden regeneration rather than a port PR.

## Outstanding

Nothing found in this port remains unfixed. Two things are left standing, both identical in both engines and
neither a port defect:

  · the `m.`/`m` residuals and the layer's documented refusals, pinned in the suite as they read so a future
    change has to be deliberate;
  · **#1211**, the missing `min.` and currency mop-ups.
