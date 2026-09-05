# Macedonian (mk) — C# port investigation

## Run 1 — 2026-08-31 13:00 — scope

    wc -l src/languages/macedonian/*.ts
        224 macedonian.ts · 364 normalize.ts · 93 numbers.ts   (681 total)

Three modules plus `data/languages/macedonian/macedonian.jsonc`. No lexicon, no neural tier. `Registry.cs:559`
already routed `case "mk"`; `Bootstrap.cs` was the only wiring missing. Golden 200 rows, mined artifact, and
FLEURS `mk_mk` all present.

The g2p is a left-to-right grapheme scan — Macedonian is fully phonemic with no vowel reduction — over four
post-rules: **dark-l** (⟨л⟩→[l] before the front set, [ɫ] elsewhere), **syllabic ⟨р⟩** (an [r] with no vowel
neighbour), the South-Slavic **phonotactics** (n→ŋ before a velar, word-final devoicing, regressive voicing,
sibilant assimilation), and **fixed ANTEPENULT stress**, which being predictable is emitted.

⚠ Two things distinguish it from the Bulgarian sibling and both are data, not code: the palatals are
DISTINCT LETTERS (ѓ ќ љ њ ѕ џ ј), so there is no ь/я/ю palatalization to compute; and `mk` is in the
registry's **`VULGAR_FOLD_OPT_OUT`** — its own layer reads ¾/½/¼ better than the shared fold can, with the
"и" that joins a mixed number.

⚠ **/v/ IS VOICING-TRANSPARENT.** In the regressive pass a following [v] neither triggers nor blocks — but
once that [v] has itself devoiced to [f] before a voiceless obstruent, the [f] does trigger the segment
before it. The pass is right-to-left for exactly that reason.

## Run 2 — 2026-08-31 13:30 — first build + parity

    dotnet run -c Release --project csharp/tools/parity -- mk
        1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run.

## Run 3 — 2026-08-31 13:45 — the differentials

Corpus: FLEURS `mk_mk` + the mined artifact + the golden = **1,907 unique texts**, through three entry
points — the normalizer, the initialism pass, and the full engine: **0 differ on all three.**

Exhaustive g2p walk — all 1–3-letter words over the 31-letter alphabet, all 4-letter over the 26 that carry
a rule, plus targeted bands for each post-rule: ⟨л⟩ with every letter before and after it (the dark/light
split), ⟨р⟩ with and without vowel neighbours in every slot (the syllabic rule), every voiced obstruent
before every voiceless one and word-finally (the voicing pass), and 1–5 nuclei (the stress rule):

    645,458 words   0 differ

    numbers, 0–20,000 exhaustive + every magnitude seam + non-finite   20,058 rows   0 differ
    ordinals, 0–10,001 exhaustive + the out-of-range boundary          10,007 rows   0 differ
    astral / lone-surrogate fuzz, norm + word + text                   36,479 rows   0 differ
    five digit families × 15 operand frames (\d vs \p{Nd})                155 rows   0 differ
    the initialism seam — every 2- and 3-letter Cyrillic and Latin
      caps run, 4-letter over 24, and 3,000 of them in sentence frames 389,104 rows   0 differ

**The interaction corpus** covers all fifteen ordered steps and their documented couplings — de-grouping
with its standalone-zero guard and its two-pass limit, the era markers, the year abbreviation, the dotted
abbreviations, the figure dot, ranges, the clock with and without `ч`, every one of the fifteen ordinal
suffixes against ten magnitudes, centuries, dates across every month, the regnal rule with each of its
corpus-derived guards, the rates, the degrees, every sign, the tech tokens, the fractions and the personal
initials: **1,847 rows, 0 differ on `norm` and `text`.**

## Run 4 — 2026-08-31 14:10 — the one divergence, and why it stands

⚠ **`NumberToText` DIVERGES ON A NON-INTEGER `n`, AND IT IS UNREACHABLE.** The numbers differential found
exactly one row in 20,058: `0.5`. JS indexes `units[0.5]` as a property lookup and gets `undefined` — the
TS's `!` is a lie there — while C# must truncate to `Units[0]` and says *нула*.

Matching JS would mean threading a nullable return through all fourteen call sites for a case none of them
can produce, so instead the reachability was **enumerated rather than assumed**: the clock's `Number(h)` and
`Number(min)`, the ordinal rule's `Number(digits)`, and `Text()`'s `Number(intPart)`/`Number(joined)`/
`Number(d)` are all `\d+` captures; the internal recursions are `Math.Floor`/`%` of integers; and the dead
`Number()` helper guards with a safe-integer test first. Documented at the function, not repaired.

## Run 5 — 2026-08-31 14:25 — pattern diff and the culture sweep

The dynamic dump (TS through a `RegExp`-constructor hook, C# by reflection over static fields *and* delegate
closure state, with `\uXXXX` escapes folded and the flag string compared as a SET, since JS normalises
`.flags` alphabetically): **TS 33 distinct, 0 TS-only.**

**Culture and ordering sweep: completely clean** — not one `ToLower`/`ToUpper`, culture compare, number
format or ordering call outside `StringComparer.Ordinal`. `Js.ToLowerCase` is the JS-faithful one and is
used for the scan and the letter-name lookups.

## Run 6 — 2026-08-31 14:40 — seam gates over a large reference

Golden-swap: a **709,362-row** reference from the corpus, the interaction corpus and the walks. Every gate on
both engines, golden restored afterwards (verified with `git status`).

    parity        709,362 rows byte-identical, 0 differ
    provenance    tokens 850,425/850,425 (100.0%)
    ipaspans      846,015/846,015 (100.0%), 0 spans that do not cover what was emitted
    poison        0 sites
    TS twins      850,425/850,425 and 846,015/846,015, 0 bad spans, 0 poison

⚠ The first attempt timed out **with the golden still swapped in**, as the lt run did. Finishing the
remaining gates and restoring was made the next command rather than the tail of the same chain.

**Output leak sweep over the 709,362 readings:** zero stringified `undefined`/`null`/`NaN`, zero double
spaces, zero digits and zero CYRILLIC surviving into a reading. Twenty-two inputs give an empty reading and
all twenty-two are mathematical bold digits, outside the token classes and TS-identical.

## Run 7 — 2026-08-31 14:55 — suite and mapping

`MacedonianTests.cs` ports the TS suite, every value the TypeScript engine's own. **96 tests.**

⚠ One expected value in the first draft was written from reasoning rather than measured and was wrong —
`MkOrdinal(9999)` is *девет илјади деветстотини деведесет и деветти*, with no "и" before the hundreds, which
is what the composer's `r < 100 || r % 100 === 0` test produces. Replaced with the engine's own output, and
two more measured rows added beside it. Recorded because it is the same slip as the Latgalian and Lule Sami
pins: an assertion nobody measured is a guess wearing a test's clothing.

## The faithfulness decisions, and why

  · **`Scan` iterates CODE POINTS** (`[...word.toLowerCase()]`), and so does the decimal fraction loop
    (`for (const d of frac)`) and the above-milliard digit fallback (`[...(raw ?? String(n))]`).
  · **The dead `Number()` helper is ported AS DEAD** (#1095). Nothing calls it — `Text()` reaches
    `NumberToText` directly because it must split the decimal comma first — and its `return digits` would
    put a DIGIT STRING into the phoneme stream past 2^53. It is a live trap for whoever wires it up, so it
    is carried across with its warning rather than quietly dropped or quietly fixed.
  · **De-grouping is TWO PASSES, not a fixed point** — the TS's own `for (let i = 0; i < 2; i++)`.
  · **The clock's optional `ч` group** is read from the group's `Success` flag; the TS has to test the
    replacer argument's TYPE because its argument list shifts.
  · **`ExponentPosition.Before`** and a KEYED `UnitPer` (`h`/`ч` → "на", `s`/`с` → "во"), because the rate
    preposition differs by denominator.

## Run 8 — 2026-08-31 15:20 — review of #1222

**THE HOMOGLYPH SCAN, WHICH IS THIS LANGUAGE'S OWN HAZARD.** The TS suite warns about it in writing:
Фаренхајт must carry Cyrillic ⟨ј⟩ U+0458, not Latin ⟨j⟩ U+006A, because the two are indistinguishable on
screen but a Latin j falls outside the Cyrillic token class — the word splits in three and the j is handed
to the foreign reader as the ENGLISH LETTER NAME, *fˈarɛnxa d͡ʒˈeᶦ t*. Nothing is dropped and nothing raw
survives, so no leak gate can see it. A port that hand-types several hundred Cyrillic literals is exactly
where that typo would be introduced, and a differential only catches it on a REACHABLE string.

So every string literal in the port and its suite was scanned for a mixed Cyrillic/Latin script whose
minority characters are ENTIRELY homoglyphs — the signature of a typo rather than a deliberate mixed table
like the letter-name map or the dual-script unit keys:

    854 string literals scanned · mixed-script with an all-homoglyph minority: 0

⚠ The first pass reported five, and all five were the scanner's own fault: it was counting the `s` of `\s`
and the `o` of a `{o}` interpolation hole as letters. Stripping escapes and interpolation first, and then
verifying the scanner still detects a PLANTED Latin `j` in Фаренхајт, is what makes the zero mean anything.

**Structural read.** `VOICE` is built by inverting `DEVOICE`, which in C# throws on a duplicate key where
JS would silently keep the last — the nine values are distinct, and the build proves it. `Scan`'s
`chars[i + 1]` is guarded exactly as the TS's `?? ""`. The `[ \u00a0]` classes are written as ESCAPES with
the naming comment on the line, matching the fleet convention. The TypeScript side is untouched, so the
regex corpus is unaffected and its freshness test passes.

**`mk` is in the registry's `VULGAR_FOLD_OPT_OUT` in the C# too**, and the fraction rows are asserted
through `Phonemizer.Phonemize` — the registry path — so the opt-out is exercised end to end rather than
assumed.

## Outstanding

Nothing found in this port remains unfixed, and nothing new was filed. The single `NumberToText` boundary
difference is documented at the function and unreachable from every one of its fourteen callers.

## Run 9 — 2026-08-31 20:40 — repairing the two items Run 4 recorded but did not fix

Both were left as "documented, unreachable" and both are now closed properly.

**1. The non-integer boundary is refused explicitly, in BOTH engines.** `numberToText` guarded only `n < 0`,
so a fractional `n` fell through to `units[n]` — a property lookup yielding `undefined` in JS (the `!` on
that line was a lie) and a truncating index answering *нула* in C#. The guard is now
`n < 0 || !Number.isInteger(n)` / `n < 0 || !double.IsInteger(n)`, so the two engines agree **by
construction rather than by luck** and the four assertions below it become true. Verified: `numberToText(0.5)`
is `""` in both, the mk golden moves **0 of 200** rows, and a 3,019-row differential over 0–3000 plus every
fractional and non-finite shape is **0 differ** on the composer and end to end.

**2. The dead `Number()` helper is DELETED, in both engines.** It was carried across as dead with a warning
that its `return digits` would put a digit STRING into the phoneme stream past 2^53. That warning was the
right call while the code existed — but the file's own note already said the fix is to *use the arm in
`text()`*, which does exist and is what every caller uses. Dead code cannot be a trap once it is gone, so
the helper and its warning both go. Confirmed unreferenced in both engines before removal; the TS suite and
the 5,498-test C# suite are unchanged, and the mk corpus differential is still 0 of 1,907.
