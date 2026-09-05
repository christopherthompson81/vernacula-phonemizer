# Latin (la) normalization — investigation log

Picked as the largest untreated corpus with a cell profile unlike anything treated: `ampersand` **30,613**
(more than any language in the fleet), `roman` 27,892, `ordinal-latin` 58,175. Also a deliberate change of
kind — a classical language has no living orthographic drift to chase, which is what the last two rounds
were about.

`tools/corpus/mined/la.jsonc` — la.wikipedia dump, 557,823 paragraph segments, 33/35 cells.

## Run 1 — 2026-08-16 — the biggest cell in the artifact is an HTML entity

`ampersand` is 30,613 corpus-wide. Printing the instances: essentially all of them are **`&nbsp;`**, which
this corpus uses as its THOUSANDS SEPARATOR — `1&nbsp;320&nbsp;000&nbsp;000 km³`, `25&nbsp;000&nbsp;000
km³`, `1&nbsp;582 relatis`. `core/markup.ts` folds it to a no-break space before any layer runs.

The **bare `&`** is ×22 in the retained text and **not one is Latin prose**: English book titles
(`Encyclopedia of Astronomy & Astrophysics`, `Harper & Row`), a French film title (`Astérix & Obélix`) —
all of which reach the engine through the Latin-run router and are read in their own language — and two
that ARE Latin: **`&c.`**, the ligature of *et* + *c(etera)*, in "Thesei, **&c.**" and "cum Praenestinis;
**&c.**". That is the one this layer claims, and the spelled form is in the same artifact ("73, 73.0,
73.00, **et caetera** omnes eundem…").

**Implication** A count is a lead, never a finding (trap 2), and this is the largest instance of it the
sweep has produced: a 30,613-instance cell that is markup.

## Run 2 — 2026-08-16 — what the engine does today

```
"liber II"          → ˈlɪbɛr ˈduɔ            the Roman numeral as a CARDINAL where the slot wants an ordinal
"saeculi II p.C.n." → … p . k . n .          the era letter-by-letter with three false pauses
"97%" · "0° C"      → the signs dropped
"3,3 °C"            → ˈtreːs , ˈtreːs k      the comma a pause, ⟨C⟩ a bare letter
"10.6° C"           → ˈdɛkẽː . ˈsɛks k       …and the DOT a full stop
"1 320 000 000 km³" → four numbers, the unit and the power raw
"1732-1735"         → the two years fused into one utterance
"Thesei, &c."       → ˈtʰɛseɪ , k .
"6/3 = 2"           → ˈsɛks ˈtreːs ˈduɔ      three numbers, no operation
```

## Run 3 — 2026-08-16 — the corpus glosses its own notation, three times

Every word this layer emits comes from one of these, not from a dictionary:

- **DEGREE and SCALE, in one paragraph**: "Mediocris temperatura est **10.6° C**. Mensis Iulius est
  calidissimus, quo **18.0 gradus Celsius**, frigidissimus Ianuarius, quo 3.4° C" — the same publication
  writing the sign and the words for it three sentences apart. And the ANGULAR sense beside it: "inter 36°
  et 43,5° **gradus latitudinis** septentrionalis".
- **PERCENT, in one clause**: "electus est cum **53,79%** suffragiorum contra **46,21 centesimae**
  suffragiorum Norberti Hofer". ⚠ And an older idiom is glossed against the sign directly: "in cellula
  **octogena per centena (80%)** eorum sunt in ribosomatibus".
- **THE ERA is its own expansion**: `a.C.n.` = *ante Christum natum*, `p.C.n.` = *post Christum natum*,
  written as "anno 31 **a.C.n.**", "anno 15 **a.C.n.**", "saeculi II **p.C.n.**".

## Run 4 — 2026-08-16 — ⚠ THE ARITHMETIC IS REAL, AND STILL UNREADABLE

la.wikipedia has **articles on arithmetic, written in Latin**: `6/3 = 2`, `73 = 5 × 14 + 3`,
`1/2 = 2/4 = 3/6 = 4/8 = 5/10`, `si summa > 11 sit`, `232.3² = 232.3 × 232.3`. This is the second round
running to overturn trap 62 — and the `>` here is the sweep's first genuine comparison, gd's having been
LaTeX and shn's a sound-change arrow.

**The blocker is AGREEMENT, not sense.** `aequat` ×25, `multiplicatum` ×4, `divisum` ×22, `maius` ×30 are
all attested, and all of them govern a case: *multiplicatum **per** + ablative*, *divisum **per** +
ablative*, *maius **quam** + nominative*. This layer emits bare numerals and cannot decline them. The
corpus's own arithmetic article writes its prose AROUND the signs rather than for them ("Debemus
fractionem facere: 73 = 5 × 14 + 3") and never spells one out. Two guesses stacked — an unsourced verb
plus an undeclinable operand — is worse than a visible gap.

⚠ **AND THE SAME WALL BLOCKS THE ROMAN ORDINAL, which is this round's real finding.** Every other language
in this sweep got a roman-ordinal policy — ba, tt, chv, tk each read `XIX century` as an ordinal — and each
works because the ordinal is INVARIANT (Turkic) or agrees only in gender with one fixed noun. **Latin
ordinals decline for five cases × three genders**, and the 26 retained Roman numerals span the paradigm:

| instance | wants | why |
|---|---|---|
| `liber II` | *secundus* | nominative masculine |
| `Capitulum VII` | *septimum* | nominative neuter |
| `saeculi II p.C.n.` | *secundi* | GENITIVE |
| `XIV Februario` | *quarto decimo* | ABLATIVE — a date |
| `libri III` | *tres* | …a CARDINAL outright, "three books" |
| `MMXIX` · `Num. XV, 37` · `Matth. IX,20.21` | cardinal | a year and two Bible references |
| `Ludovicus II` · `Napoleonis III` | regnal | and the second is itself genitive |

`libri III` is the one that settles it: the trigger noun does not even decide ORDINAL vs CARDINAL. The
shared cardinal pass already reads every one of them as a number, which is right for six of the seven
shapes; the ordinal is left unclaimed rather than authored wrong in a majority of slots (trap 14, at full
strength).

## Run 5 — 2026-08-16 — two defects the gates found, both of them mine

⚠ **THE SWEEP'S DE-GROUPING IDIOM IS SILENTLY WRONG AT FOUR GROUPS.** Every layer in this sweep de-groups
with `(\d)[ ](\d{3})(?!\d)` repeated two or three times. On `1 320 000 000` the first pass consumes
`1 320`, **the scan then resumes inside the remainder and anchors on the LAST digit of the next group**,
and the result is `1320 000000` — which reads as *mille trecenti viginti* followed by *nihil*: a
well-formed Latin numeral for a completely different quantity, and invisible to DIGIT, RAWMARK and DROP
alike. Matching the whole number at once fixes it.

Measured across the seven artifacts this sweep has touched, four-or-more-group numbers occur **twice here
and once in ba**, and nowhere else — which is why the idiom held everywhere it was used before now. The ba
instance is recorded as backlog rather than fixed blind.

⚠ **AND MY FIRST GUARD FOR IT LOST EVERY CLAUSE-FINAL FIGURE — trap 58, caught by `review.ts`'s own
probe.** Written `(?![\d.,])`, the rule declined `1 320 000,` outright. What the guard has to exclude is a
separator CONTINUING the number, which is `(?!\d)(?![.,]\d)`, not a bare dot.

⚠ **And the ISBN guard was defeated by backtracking — trap 59's family.** `(\d+)(?!\s?-\s?\d)` fails the
lookahead with `333`, retries with `33`, finds a plain `3` after it and emits `0, 333-75088-8`. Pinning
the operand's end with `(?!\d)` first removes the give-back. Both defects were introduced and caught
within this round; the gates earned their keep twice.

## Run 6 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 24→0 · `degree` 12→2 · `currency` 16→3 · `minus` 15→3 · `ampersand` 15→13
  (the English titles) · LEAK `km` 13→2 · `math-sign` 65→65 (the measured refusal). Residual, all read:
  the arithmetic above, six `pp.` in a French citation, two `www`, and a Khmer paragraph the dump left in.
- **corpus diff** (baseline emitted from a pristine worktree at `4596679`): **132/460 utterances changed
  (28.7%), DROP 139 → 91**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang la`**: green on every checklist item including `sourcing`, `sign classes` and
  `clause-final` — seven refused classes registered in `ACCEPTED_SIGN_SILENCE` with their counts and their
  real senses.
- **`referee-eval la`**: **0.0% raw / 92.2% folded / 98.9% symbol, before and after** — measured on both
  sides from the pristine worktree.
- **`vitest`** 4,547 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The de-grouping idiom in ba/tt/chv/tk/shn/hyw** repeats a two-digit join. Correct to three groups; ba
  has one four-group instance. Run 5.
- **The Roman ordinal** — the largest unclaimed class in the language, blocked on case agreement. Run 4.
- **The arithmetic signs**, blocked on the same wall. Run 4.
- **The decimal separator** is both `.` and `,` here and neither is read; Latin has no attested reading for
  the point, and the corpus names the concept ("post separatorem decimalem") without ever voicing it.
