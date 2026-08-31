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

## Outstanding

Nothing found in this port remains unfixed, and nothing new was filed. The single `NumberToText` boundary
difference is documented at the function and unreachable from every one of its fourteen callers.
