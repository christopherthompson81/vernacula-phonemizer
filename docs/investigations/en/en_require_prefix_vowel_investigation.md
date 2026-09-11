# en: the `require` family's prefix vowel

Issue #1279. Two questions were filed: (1) is the prefix vowel right at all, and (2) the four inflections
disagree with each other. The issue scoped the work to (2) — "clearly wrong either way" — and deferred (1)
as a per-word judgement inside a family that encodes a REAL distinction (productive `re-` "again" keeps
full /ri/; lexicalized `re-` reduces), warning that a blanket sweep would be wrong.

That caution is right about the family. It turns out not to bind for this lemma, because the referee has
the word.

## Run 1 — 2026-09-11 15:56 — the family is three-way split, and two members were missed

The issue lists four rows. There are six, and the two it does not mention already carry the answer:

```
require       R IY2 K W AY1 ER0          ɹiːkwˈaᶦɚ
required      R IY0 K W AY1 ER0 D        ɹikwˈaᶦɚd
requires      R IY0 K W AY1 ER0 Z        ɹikwˈaᶦɚz
requiring     R IY0 K W AY1 ER0 IH0 NG   ɹikwˈaᶦɚɪŋ
requirement   R IH0 K W AY1 R M AH0 N T  ɹᵻkwˈaᶦɹmənt     ← already the reduced prefix
requirements  R IH0 …                    ɹᵻkwˈaᶦɹmənts    ← already the reduced prefix
```

So the split is three ways (`IY2` / `IY0` / `IH0`), not two, and the lemma's own nominalisation is already
where the rule says the whole family belongs.

## Run 1b — the evidence, and why (1) does not need the deferred referee pass

**The en-GB referee carries every member** — the en-US set (4,558 rows) does not reach them, but the en-GB
set has 76,284 and does:

```
require      ɹɪkwaɪə          required    ɹɪkwaɪəd      requires   ɹɪkwaɪəz
requiring    ɹɪkwaɪəɹɪŋ       requirement ɹɪkwʌɪəmnt · ɹɪkwʌɪəmənt
```

Uniformly reduced, across all five, with no full-/ri/ variant attested anywhere in the lemma.

**espeak-ng agrees, also uniformly:**

```
require ɹᵻkwˈaɪɚ · required ɹᵻkwˈaɪɚd · requires ɹᵻkwˈaɪɚz · requiring ɹᵻkwˈaɪɚɹɪŋ · requirement ɹᵻkwˈaɪɚmənt
```

**And so does the engine's own rule.** `isBarredI`'s Latinate-prefix arm (`^(be|de|re|se|pre)[^aeiouy]`)
gives `ᵻ` for exactly this shape — it simply could not fire, because it tests `IH`/`AH` and the rows were
written `IY`.

Four independent witnesses — a human referee, espeak, the lemma's own `requirement`, and the engine's rule
— all say the same thing. ⚠ **That is why (1) is answered here without opening the family-wide question:
the deferral was about words the referee cannot adjudicate, and it adjudicates this one.** The productive
`re-` rows (`rebook`, `rebalance`, `rebid`) are untouched and still need their own pass.

## The change

```
require    R IY2 K W AY1 ER0        →  R IH0 K W AY1 ER0        ɹiːkwˈaᶦɚ  → ɹᵻkwˈaᶦɚ
required   R IY0 K W AY1 ER0 D      →  R IH0 K W AY1 ER0 D      ɹikwˈaᶦɚd  → ɹᵻkwˈaᶦɚd
requires   R IY0 K W AY1 ER0 Z      →  R IH0 K W AY1 ER0 Z      ɹikwˈaᶦɚz  → ɹᵻkwˈaᶦɚz
requiring  R IY0 K W AY1 ER0 IH0 NG →  R IH0 K W AY1 ER0 IH0 NG ɹikwˈaᶦɚɪŋ → ɹᵻkwˈaᶦɚɪŋ
```

`requirement`/`requirements` are already correct and are not touched. Edited in the ARPABET and regenerated
through `makeArpabetToIpa` per #1274/#1276, so the lexicon stays byte-exact from its source — gated since
#1275 by `test/en-lexicon-regenerable.test.ts` rather than checked by hand.

⚠ **A note for whoever takes the deferred family pass:** the method used here is the whole of it. The issue
assumed the productive/lexicalized split would have to be judged per word; the en-GB referee's 76k rows
adjudicate a large share of it directly, and are a cheaper instrument than judgement for that work.

## Run 2 — 2026-09-11 16:20 — the freshness gate's first real catch

`npm run check:goldens` (landed hours earlier for #1283) flagged this change before it could reach main:

```
en      200 rows   3 stale
en-GB   200 rows   3 stale
en-IN   200 rows   3 stale
```

⚠ **AND IT CAUGHT MY OWN SHORTCUT ON THE SECOND PASS.** I first decided the scope with a grep for the
affected IPA and concluded "only `en` carries the lemma" — but the grep was written against the `en`
spellings (`ɹikwˈaᶦɚd`), and the same words render differently in the other two varieties (`ɹikwˈaᶦəd`,
and different again for `en-IN`). The grep was variety-blind; the gate was not. Regenerated all three.

The lesson is general: **do not use a hand-written grep to decide the blast radius of a data change when
a gate will tell you authoritatively.** A grep over IPA encodes an assumption about how the output looks,
which is exactly the thing a variety layer is entitled to change.

⚠ Worth recording because the sequencing is the whole argument for #1283: **had this landed before that
gate existed, those three rows would have gone red on main and been found the way the previous two were —
by confusing somebody into a wrong diagnosis.** Instead it cost one regeneration and no thought. The class
of defect is now boring, which is the goal.

### Verification

```
npx vitest run                 295 files, 5812 tests
npm run check:goldens          189 languages, 36495 rows, 0 stale (after regenerating en, en-GB, en-IN)
npx tsx tools/english/en_rebuild_lexicon.mts   117,479 sourced rows, 100.00% round-trip
```
