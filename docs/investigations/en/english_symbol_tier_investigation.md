# Does English benefit from its own copy of the symbol tier? (#1086)

`english/normalize.ts` states the separation as a fact and gives no reason:

> ⚠ English does NOT use the shared symbol tier (`core/normalizeSymbols.ts`), so anything that tier provides
> — `NOT_VERSION`, `magnitudes`, `bareExponent` — has a local equivalent here or it does not exist for
> English at all.

Every other header in this repo justifies its refusals. This one records a structural decision without the
argument, so nobody can tell whether it is load-bearing or historical.

---

## Run 1 — 2026-08-27

**Question.** Is the separation principled, and what does it cost?

### The reason was in the code all along, and it is HISTORICAL

`normalize.ts` step 6, on the units table:

> ⚠ SAME TWO STEPS, SAME HELPER as the shared symbol layer — **English keeps its own UNITS table (this
> normalizer predates that layer)**, and it carried the same `UNITS[u.toLowerCase()]!` that #763 fixed
> there: an uppercase key was unreachable and the assertion made the miss a THROW.

So the separation is an accident of order-of-writing, not a design decision. And that same comment records
the **first** documented instance of the duplication cost: #763 had to be fixed in both places.

⚠ Partial sharing already exists — English imports `resolveUnitSymbol` from the tier. The boundary is not a
wall; it is a line nobody has moved since the tier was written.

### The cost, twice documented

| | defect | had to be fixed in |
|---|---|---|
| #763 | an uppercase unit key unreachable, and the assertion made the miss a THROW | tier, then English |
| #1045 | the seconds prime and the nuclide | tier (both branches), then English |

⚠ #1045 was worse than a repeat: English needed a **third** change the core did not — its glued pass fired
first and inserted a space that hid the nuclide from a guard testing for a letter immediately after. The two
implementations have **diverged in ordering**, so a fix correct for one was incomplete for the other.

### The structural objection, measured rather than asserted

The tier runs as one block. English's tier-overlapping steps are **not contiguous**:

```
1) currency   2) percent   [3) times  4) dates  5) years]   6) units   6b) bare exponent
                                                            [7) romans]   8) ampersand
```

and the couplings are explicit — percent runs "before times/years so the bare number stays one token";
the exponent is "ordered AFTER the unit rule so a unit exponent is never stolen from it"; the ampersand is
"LAST, deliberately … inserting words between them first would break those adjacencies".

So a single tier invocation cannot reproduce English's ordering. **But the objection is theoretical here.**
Over 2,002 English corpus lines (FLEURS `en_us` + the mined artifact):

```
tier trigger only        48
English-only trigger    150
BOTH on one line          6   ← and in all six they are separate phrases, never the same token
```

`Arts & Sciences … in 1950`, `January 2017 … £X`, `2008 400 Richest … $2.3 billion`. **Zero attested
interactions.** The interleave is a real constraint with no measured consequence.

### The exponent arms are equivalent, and running the diff found a live defect

Configured from English's own readings, core and English agree on **16 of 18** probes:

```
Ω²        core="Ω squared"          en="Ω²"              ← core's base class is [\p{L}\p{M}], English's [A-Za-z]
E = mc²   core="E = mc squared"     en="E equals mc squared"  ← `=` is a different feature, not the exponent arm
```

⚠ **AND THE FIRST RUN FOUND A THIRD DIFFERENCE THAT WAS A BUG IN WORK I HAD JUST LANDED.**
`0,708 ¹⁸⁰Hf` still read as a power through core's DECLARED branch: #1085 guarded both branches, and core's
own glued pass defeated the guard in the declared one — exactly the interaction I had fixed in English and
not in core. It looked clean beforehand only because my probe declared the wrong field (`exponentWords`, the
unit modifier) and fell through to the FALLBACK, where the glued pass does not run first. Fixed here.

⚠ Recorded because the shape generalises: **a probe that exercises the wrong branch is not a weaker test,
it is a test of something else.** Three earlier attempts to hand-configure the tier produced configs that
dropped the base entirely — the values are TEMPLATES (`"{n} squared"`, `"{n} to the power of {e}"`), which
none of my bare-word configs supplied.

### What this implies

The separation is historical, the duplication has cost twice, and the ordering objection has no measured
consequence — so migration is **tractable**. It is not, however, free or obviously worth it:

- The tier covers only ~5 of English's ~18 steps. Era markers, dates, years, regnal romans, scientific
  notation and the fraction guard have no tier equivalent, so English keeps a large local pass regardless.
- The base-class difference is a real behavioural choice, not an accident to be normalised away.
- English is the fleet's **foreign reader**: a divergence there reaches ~50 other languages' embedded Latin
  runs, so this cannot ride along with anything else.

**Landed instead of a migration:** `test/english-tier-agreement.test.ts`, which asserts the two
implementations agree on the shapes they both claim, with the two known differences pinned as expected. That
converts "duplication with a demonstrated cost" into "duplication with a gate" — the third instance fails
before it ships, and the test is also the harness a future migration would need anyway.

---

## Run 2 — 2026-08-27 — is ONE COPY feasible?

Run 1 established the separation is historical and gated the divergence. It did not answer the question
that decides what to do next: **can this be got down to one copy?**

⚠ THE DIRECTION IS FORCED. English's version is richer in places, but migrating English's shape UP into the
tier is not an option: the tier's guards exist because ~100 languages have different word boundaries, and
its narrowness is deliberate. Whatever happens, English adopts the tier or nothing does.

### Feature-by-feature, for the overlapping steps

| capability | tier | English | one copy? |
|---|---|---|---|
| ampersand, incl. the `&amp;` entity | ✓ | ✓ | yes |
| `×` / ASCII `x`, two words with a discriminator | ✓ `multiply: {times, by}` | ✓ | yes |
| percent | ✓ | ✓ | yes |
| currency + SPELLED magnitude | ✓ | ✓ | yes |
| units + count + square/cubic measure | ✓ | ✓ | yes |
| bare exponent | ✓ | ✓ | yes — 16/18 verified in Run 1 |
| **currency + ABBREVIATED magnitude** (`$1.5m`) | ✗ **refuses on principle** | ✓ | needs a new field |
| **relational signs** `<` `>` `÷` | ✗ no feature at all | ✓ | needs new fields |

The tier's refusal is explicit and reasoned, not an omission:

> ⚠ SEPARATE, DO NOT REFUSE … Reading the magnitude is **a language's own job** (`magnitudes`), not
> something this tier can invent from one letter.

Which is right: `m` after a number is a metre in most of the fleet, and English's own step 1 says it consumes
`$1.5m` there precisely so the unit step cannot claim the `m` as a metre.

### The ordering contradiction — checked, and it is theoretical

The tier runs the ampersand **first** ("a `&` between two initialisms must become three tokens, and any
later rule that reads a token boundary needs the split to have happened already"). English runs it **last**
("deliberately … inserting words between them first would break those adjacencies"). Both are reasoned, and
they contradict.

⚠ **Measured, it does not bite.** Simulating an ampersand-first pass and then running English's normalizer
gives byte-identical output on every probe, including the adjacency cases English's comment names:

```
Arts & Sciences in 1950 · $5 & $6 · B&Bs · 6x6 cm & 4x4 · AT&T's $1.5m grant · 100m & 200m
R&D spending of $2.3 billion                                          → 7/7 identical
```

Recorded because it weakens the argument it was raised to support. English's "LAST, deliberately" is a
defensible precaution with no measured consequence here — the same shape as Run 1's interleave finding.

### Verdict: ONE COPY IS NOT ACHIEVABLE, and the near miss is not worth buying

Two readings of the question, and they answer differently:

- **One copy of the FILE — impossible.** ~13 of English's ~18 steps have no tier concept at all: dotted
  abbreviations, era markers, space digit-grouping, scientific notation, negatives, fractions, times, dates,
  years, two roman-numeral passes, relational signs. English keeps a large local normalizer either way, so
  the choice was never one file versus two.
- **One copy of the overlapping SYMBOL logic — possible, at a price.** It saves ~5 duplicated steps and
  costs at least two new tier fields **whose only consumer would be English** — one of which the tier
  currently refuses on a stated principle. That is the pattern `magnitudePrecedes` used, so it is a known
  shape and not novel risk; but it is trading duplication in a leaf for single-consumer configuration in
  the shared core, which the tier's own docstrings resist.

⚠ And the risk is concentrated where it is worst: English is the fleet's **foreign reader**, so any
divergence introduced by the migration reaches ~50 other languages' embedded Latin runs — a blast radius
out of all proportion to five deduplicated steps.

**Recommendation: move on.** Keep `test/english-tier-agreement.test.ts`, which is the actual protection
against the cost this issue was filed for. Revisit only if a THIRD duplicated defect appears, or if a second
language ever needs the abbreviated money magnitude — at which point the new field earns its place on
merit rather than on tidiness.
