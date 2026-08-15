# Clause-final RANGE (trap 58), batch D — cdo, lg, bm, ps, ak

The question: each of these five layers guards its RANGE rule with a right-hand lookahead that rejects a
following `.`. A sentence period is not part of a number, so the rule declines every span that ends a clause
and the reading falls back to two juxtaposed cardinals with no connective at all. Same one-character guard
already repaired in lt, mn, et, su and mos.

Evidence is `tools/corpus/mined/<lang>.jsonc` — the only corpus on disk; there is no FLEURS here.

## Run 1 — 2026-08-14 21:41 · the baseline, before any edit

```
npx tsx tools/normalization/corpus-diff.ts emit --lang <l> --corpus mined:<l> --out <scratch>/<l>.before
npx tsx tools/normalization/review.ts --lang <l>
```

Emitted 393 (cdo) / 445 (lg) / 343 (bm) / 448 (ps) / 237 (ak) utterances. `review.ts`'s `clause-final` check
reported the identical shape in all five — the connective token lost at BOTH marks:

```
cdo  range 1990-1995. note kɑu˨˩˧      lg  range 1990-1995. note okutuːka mu
bm   range 1990-1995. note fo          ps  range 1990-1995. note t̪ˈər
ak   range 1990-1995. note kosi        (and the same line again for `,` in every one)
```

## Run 2 — 2026-08-14 21:43 · what the corpora actually write, read instance by instance

Grepped each artifact for the reported spans rather than trusting the count. **Two of the five reported
instances are not defects at all, and two of the five languages end their spans on a COMMA, not a dot**:

| lang | instance | verdict |
|---|---|---|
| cdo | `200-300,` `300-800,` (one paragraph) | real, **comma**-final |
| cdo | `2,000-3,000.` (same paragraph) | real, dot-final |
| cdo | `5:6-21.` | NOT a defect — a Bible verse, already declined by the `:` lookbehind |
| lg | `wakati wa 0–1.` | real ("between 0 and 1", World Bank HCI) |
| lg | `1742-4690-3-72` | NOT a defect — a DOI, declined by the `/` and dash-chain guards |
| bm | `1954 -1981.` and `pp.&nbsp;86–99.` | both real, both reference page/date ranges |
| ps | `166-200.` | real, a page range |
| ak | `1964-1967, Belfast` | real, **comma**-final |

That reframes the comma decision, which is otherwise the risky half: cdo gains nothing from the dot alone,
and ak gains nothing from the dot at all.

## Run 3 — 2026-08-14 21:44 · the comma census, per language

`grep -o "[0-9],[0-9]\{1,2\}[^0-9]"` (a decimal comma) against `[0-9],[0-9]\{3\}` (a grouping comma), plus
each layer's own documented counts:

```
cdo   decimal-comma ×0    grouping ×34    decimals are the DOT (step 7), commas de-grouped at step 1
lg    decimal-comma ×2 (`7,2`, `5,3`)     the comma is also this rule's own grouping EVIDENCE
bm    decimal-comma ×42 (file's count: `7,62`, `0,3`, `15,3`)
ps    `،` ×1,122 and `,` decimals at step 12, and BOTH are grouping marks (×1,517 / ×1,959)
ak    comma decimal ×39 tw + 13 fat (the file's own count), comma also groups
```

**Decision: drop the comma in cdo only; keep it in lg, bm, ps, ak.** Estonian's lesson holds — the comma is
what declines a decimal right operand — but cdo has no decimal comma to decline, and two of its three
instances are comma-final.

The dot is safe everywhere, and the reason is the same in each layer: either the decimal rule has ALREADY
run (cdo step 7 < range step 8), or it runs AFTER the range rule and still sees the tail whole (lg step 7,
bm step 11, ps step 12, ak step 9), so `10-15.5` is claimed as `10 <conn> 15` and `15.5` reaches the decimal
rule intact. Measured, not assumed — see run 5.

## Run 4 — 2026-08-14 21:46 · after the edit, corpus diff, every changed line read

```
npx tsx tools/normalization/corpus-diff.ts emit  --lang <l> --corpus mined:<l> --out <scratch>/<l>.after
npx tsx tools/normalization/corpus-diff.ts compare --before … --after … --corpus mined:<l>
```

```
cdo  1/393 utterances   3 ranges repaired (all three in the one paragraph)
lg   1/445              1
bm   2/343              2
ps   1/448              1
ak   0/237              0 — its only instance is comma-final, so the branch is pinned as a test
```

Every changed line diffed word by word: **every difference is an INSERTION of the connective, and not one
token was deleted.** The sentence break survives in all of them (`… saŋ˥˥ pɑʔ˨˦ ,` / `… okutuːka ku emu .`).
The leak summary (DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / DROP / THROW) is byte-identical
before and after in all five.

## Run 5 — 2026-08-14 21:49 · the shapes that must NOT change, probed directly

Ran each layer's normalizer over the counter-examples its own comments name, against a copy of the
pre-edit file for the baseline (`git show HEAD:… > …scratch.ts`, never a stash — the tree is shared):

```
lg   0.1–0.4 ha        before "0 1–0 4 ha"    after "0 1–0 4 ha"     declined by the LOOKBEHIND, untouched
lg   5–13.7 ha         before "5–13 7 ha"     after "5 okutuuka ku 13 7 ha"
bm   10-15.5           before "10-15 5"       after "10 fo 15 5"     the tail still reaches step 11 whole
ps   ۹۰-۹۵.۵           after "۹۰ تر ۹۵ اعشاريه ۵"
ak   10-15.5           after "10 kosi 15 akyiri pɔ 5"
cdo  ISO 639-3.        no connective — the ALL-CAPS guard still holds at a sentence end
cdo  «…» 5:6-21.       no connective — the `:` lookbehind still holds
cdo  ISBN 3-88053-113-7. no connective — the chain guard still holds
```

So the decimal-range objection lg's comment used to raise is answered rather than waved away: the LEFT
guard is what declines a decimal LEFT operand, and it is unchanged.

## Run 6 — 2026-08-14 21:52 · the gates

`npx tsc --noEmit` clean. `npx vitest run` — 247 files, 4391 passed, 5 skipped. `review.ts --lang <l>` for
all five: every `[ ok ]` / `[ !! ]` line identical to the baseline, and cdo's `clause-final` block is now
EMPTY. The other four still print the `,` note, which is the branch this batch deliberately did not take.
