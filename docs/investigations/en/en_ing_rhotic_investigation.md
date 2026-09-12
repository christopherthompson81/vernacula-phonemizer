# en: the `-ing` rhotic after a PRICE diphthong — `aᶦɚɪŋ` or `aᶦɹɪŋ`?

Issue #1289, which I filed myself out of the #1286 review. CMUdict writes this rime two ways and only one
yields a consonantal `ɹ`:

```
AY … ER0 IH0 NG    6 rows   requiring, inquiring, desiring, backfiring, rewiring, transpiring  → aᶦɚɪŋ
AY1 R IH0 NG      17 rows   acquiring, admiring, expiring, firing, hiring, wiring, …           → aᶦɹɪŋ
```

⚠ The issue set the rule for its own resolution: **check each of the six rather than sweeping**, because
#1276 and #1278 both turned up families where a variant reading genuinely accounted for a row that looked
wrong. The difference here is a SYLLABLE COUNT — `ɹᵻkwˈaᶦɚɪŋ` is four syllables, `ɹᵻkwˈaᶦɹɪŋ` three — and
both are real English, so "17 rows do it the other way" is a reason to look, not to edit.

## Run 1 — 2026-09-11 18:26 — espeak and the UK referee say BOTH sets are wrong

```
                ours          espeak-ng        en-GB referee
requiring    ɹᵻkwˈaᶦɚɪŋ    ɹᵻkwˈaɪɚɹɪŋ      ɹɪkwaɪəɹɪŋ
desiring     dᵻzˈaᶦɚɪŋ     dɪzˈaɪɚɹɪŋ       dɪzaɪəɹɪŋ · dɪzaɪɹɪŋ
firing       fˈaᶦɹɪŋ       fˈaɪɚɹɪŋ         faɪəɹɪŋ
hiring       hˈaᶦɹɪŋ       hˈaɪɚɹɪŋ         haɪəɹɪŋ
acquiring    əkwˈaᶦɹɪŋ     ɐkwˈaɪɚɹɪŋ       əkwaɪəɹɪŋ · əkwaɪɹɪŋ
```

Both instruments write **`aɪ` + `ɚ`/`ə` + `ɹ` + `ɪŋ`** — the `ɚ` AND a consonantal `ɹ` — for the six *and*
the seventeen. On that evidence the target is neither of our shapes: the six are missing the `ɹ`, and the
seventeen are missing the `ɚ`.

⚠ **I acted on that reading mid-investigation and it was wrong.** It reframed the issue as "keep the `ɚ`,
add the `ɹ`" — the opposite of what the issue proposed — on the strength of espeak plus a BrE referee.

## Run 2 — 2026-09-11 18:29 — the recordings say otherwise, again

The asr-align corpus holds what wav2vec2 heard on the FLEURS recordings. Every en/en-GB utterance
containing any member of the family:

```
requiring   ɹ ɪ k w aɪ ɹ ɪ ŋ      3-syl   ×4
firing      aɪ ɹ ɪ ŋ              3-syl   ×2
hiring      aɪ r ɪ ŋ              3-syl   ×1

3-syllable (aɪ ɹ ɪ ŋ): 7        4-syllable (aɪ ɚ … ɪ ŋ): 0
```

**7 of 7, zero counterexamples** — and `requiring`, one of the six, is four of them. Readers use the
three-syllable form for both sets. The seventeen are right as they stand; the six are not.

⚠ **THAT IS THE SECOND TIME TODAY THE CORPUS HAS OVERRIDDEN espeak**, after #1280's `research`. The rule
that keeps proving itself: espeak is a reference for ALIGNMENT, and where recordings exist they outrank it.
Its four-syllable reading is a real English pronunciation; it is just not the one speakers used here.

## The change, and the per-row check the issue asked for

```
requiring    R IH0 K W AY1 ER0 IH0 NG  →  R IH0 K W AY1 R IH0 NG    corpus ×4, direct
inquiring    IH2 N K W AY1 ER0 IH0 NG  →  IH2 N K W AY1 R IH0 NG    no corpus row; UK referee 4-syl only
desiring     D IH0 Z AY1 ER0 IH0 NG    →  D IH0 Z AY1 R IH0 NG      no corpus row; UK referee attests BOTH
backfiring   B AE1 K F AY2 ER0 IH0 NG  →  B AE1 K F AY2 R IH0 NG    no corpus row, no referee row
rewiring     R IY0 W AY1 ER0 IH0 NG    →  R IY0 W AY1 R IH0 NG      no corpus row, no referee row
transpiring  T R AE0 N S P AY1 ER0 …   →  T R AE0 N S P AY1 R IH0 NG no corpus row, no referee row
```

⚠ **Only `requiring` is decided directly.** The other five are decided by ANALOGY — to `requiring`, and to
the seventeen rows that already carry the three-syllable form and that the corpus confirms. That is a
weaker warrant than #1280's and is stated as such. `rewiring` keeps its `IY0` prefix: it is productive
`re-` (wire again), unlike the lexicalized `re-` of `require` corrected in #1279.

## ⚠ Known limit: this is a GenAm decision applied to en-GB too

The UK referee prefers the four-syllable form for the whole family (`faɪəɹɪŋ`, `haɪəɹɪŋ`, `ɹɪkwaɪəɹɪŋ`),
and en-GB inherits this lexicon. But the seventeen were ALREADY three-syllable, so en-GB already diverged
from its referee on this rime for most of the family — this change makes the six consistent with that,
rather than introducing the divergence. Worth a separate look if en_gb recordings ever cover the rime;
the corpus currently has none.
