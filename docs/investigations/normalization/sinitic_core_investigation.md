# A shared Han/Sinitic normalization core

Prompted by a question after the fifth Sinitic layer shipped: *"repeated issues across languages, shared
script — does Han need a core normalization component?"* This is the measurement that answered it, the live
bug the question exposed, and what was and was not extracted.

---

## Run 1 — 2026-08-09 23:20 — the duplication is byte-level, and it had already drifted

Five Han-orthography layers exist: cmn, yue, wuu, nan, cjy. Comparing their rule bodies rather than their
descriptions:

| rule | identical in |
|---|---|
| `/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/gu` — thousands | yue · wuu · nan · cjy — **byte-identical ×4** |
| `/(?<![\d.,:])(\d{4})(?![\d.,])(?=\s*年)/gu` — year | yue · wuu · cjy — **byte-identical ×3** |
| `a/b` → `b分之a` | yue · wuu · cjy (nan removed its own) |
| the °C / °F / bare-° trio | yue · wuu · nan — near-identical **and drifted** |

### ⚠ The drift had already shipped a bug

```
"20  °C"    yue: jiː˨ sɐp̚˨ sˈiː          ← the scale letter as an ENGLISH LETTER NAME
            wuu: əl˥ səʔ˧˩ səʔ˥ zɿ˧ du˧˩  ✓
```

Cantonese's degree rules used `\s?` — at most ONE space — where wu and nan, written later from the same
shape, used `\s*`. Two spaces is ordinary typography (the wuu corpus writes `15.5 °C`, `2.8 °C`), so
Cantonese lost the unit and nowhere else did. **One character, four near-copies, and no test could see it,
because each layer only ever tested itself.**

### ⚠ And the defect KNOWLEDGE was rediscovered, which is worse than the code duplication

Each of these was learned the hard way and then learned again in the next language:

| guard | rediscovered in |
|---|---|
| the year-RANGE arm must precede the single-year rule | yue · wuu · **cjy** |
| …and the both-endpoints arm must precede it too | wuu · **cjy** |
| a slashed year pair is not a fraction | jv · nan · **cjy** — and latent in **wuu and yue** |
| a superscript is a romanization tone number, not an exponent | wuu · nan · **cjy** |
| the 年 must be found across whitespace | cmn, then copied as a comment three times |

## Run 2 — the extraction, and the latent bug it fixed in two shipped languages

`src/core/sinitic.ts` exports the rules **separately**, not as a monolithic builder, so each language keeps
its own numbered, commented pipeline — which the playbook requires, because the orderings genuinely differ
(wuu claims coordinates before degrees, nan claims a tilde range before its temperature, cjy declines
degrees outright because ⟨度⟩ is SILENT in its dict).

⚠ **The words are parameters, never shared.** 點 vs 点, 到 vs 至, Celsius POSTposed in wuu (`17摄氏度`) but
PREposed in yue (`攝氏20度`) and nan (`Liap-sī 20 tō͘`), and above all the conjunction — wuu says **搭**
(×176 against 和's 40), nan says **佮**, yue and cjy say **和**. Those are the findings each corpus paid for,
and folding them into shared code would erase exactly the part that had to be measured. `readDegrees` takes
FUNCTIONS rather than words for precisely this reason.

### The extraction found a live bug in two more languages

Migrating the fraction rule revealed that **wuu and yue were both carrying the year-pair defect unnoticed**:

```
before   wuu 2020/2021 → 2021分之2020        yue 2020/2021 → 2021分之2020
after    both unchanged, and 1/5 still reads 五分之一
```

So the shape has now appeared in **five languages**: jv guarded it, nan's whole fraction rule was removed
when its only digit/digit slash turned out to be `Fahrenheit 9/11`, cjy caught it in review, and wuu and yue
were silently wrong until the extraction.

### The refactor gate: every corpus output byte-identical

```
cjy · wuu · yue · nan     corpus-diff output IDENTICAL to the pre-refactor baseline
```

That is the whole safety argument for a refactor of shipped layers — and it holds because the one behaviour
change (the year-pair guard) has no instance in any of those four corpora. It is covered by tests instead.

⚠ `review.ts --lang yue` still reports `DROPPED: plus-minus` — **pre-existing**, verified against a base
worktree during the wuu PR, and untouched here.

## What was NOT extracted, and why

- **cmn's `normalize.ts` has none of these rules** — its numbers are handled inside the engine, so it
  consumes nothing from the new module. A shared component that assumed all five would use it would have
  been wrong about the first one.
- **wuu's year rules stay local**: they carry a `NOT_QUANTITY` guard the others do not need (`1,400－1,500
  万元` de-groups into two 4-digit numbers and is a QUANTITY range, not years).
- **yue's year rules stay local**: its range arm also claims a *written* 至/到 connective, which the shared
  arm has no reason to carry.
- **wuu's decimal stays local**: its lookbehind excludes a colon, the sports-time guard (`13:15.10`).
- **Line count did not fall** — 1,127 → 1,258 across the five layers plus the core. The extraction removed
  duplicated LOGIC and centralised the guards; it did not remove text, because the guards are now documented
  once, at length, where they cannot be missed. Brevity was never the argument.

## Next

The recommendation made when this was proposed still stands: **build the next Sinitic layer (gan or hak) on
this module rather than refactoring further**, so it is validated against a language it was not extracted
from. A refactor that only reproduces its own sources proves nothing.

---

## Run 3 — 2026-08-09 23:26 — PR review (#793)

A refactor's likeliest defects are dead code and comments that outlived their code, so the review looked
there first. **One finding, and it was the same class of defect the PR exists to remove.**

### ⚠ Three identical digit tables, and the extraction had left all three standing

```
yue  零一二三四五六七八九      (exported; cantonese.ts imports it for cardinal composition)
wuu  零一二三四五六七八九      (exported; wu.ts likewise)
core 零一二三四五六七八九      (new)
```

The local tables were deliberate — each layer's header explains that the ENGINE imports the table from the
NORMALIZER "so the digit-string reading and the cardinal reading cannot drift apart". That reasoning was
right and is now better served by one table: both files re-export `HAN_DIGITS` under the name their engine
already imports, so the guarantee survives with **one** table in the repo instead of three. Their local
`spellDigits` now delegates to `spellHanDigits` for the same reason.

Adding a fourth copy while extracting the third would have been a poor advertisement for the argument.

### Checked and clean

- **No orphaned locals.** `minnan`'s `DIGITS` is fully removed; `jin`'s remaining "DIGITS" is prose inside a
  comment, not a binding; `cantonese`/`wu` still use `spellDigits` because their year rules stayed local by
  design, and it now delegates.
- **Step numbering and cross-references survive the removals** — jin renumbers 1–6 with its internal
  "step 5 replaces the `.` with 點" still correct, and minnan's "step 3 still sees `25°C`" likewise.

### Gates after the review fix

```
corpus output   cmn · yue · wuu · nan · cjy — ALL byte-identical to the pre-refactor baselines
suite           3,288 tests · tsc clean
review.ts       clean for cmn, wuu, nan, cjy
```

⚠ `review.ts --lang yue` reports `DROPPED: plus-minus`, which is **pre-existing** — verified against a base
worktree during the wuu PR and untouched by this change.
