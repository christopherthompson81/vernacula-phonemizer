# en: the `-ing` rhotic after a PRICE diphthong — `aᶦɚɪŋ` or `aᶦɹɪŋ`?

Issue #1289, which I filed myself out of the #1286 review. CMUdict writes this rime two ways and only one
yields a consonantal `ɹ`:

```
AY … ER0 IH0 NG    7 rows   requiring, inquiring, desiring, backfiring, rewiring, transpiring, spiering
AY … R  IH0 NG   20 rows   acquiring, admiring, expiring, firing, hiring, wiring, …           → aᶦɹɪŋ
```

⚠ The issue set the rule for its own resolution: **check each row rather than sweeping**, because
#1276 and #1278 both turned up families where a variant reading genuinely accounted for a row that looked
wrong. The difference here is a SYLLABLE COUNT — `ɹᵻkwˈaᶦɚɪŋ` is four syllables, `ɹᵻkwˈaᶦɹɪŋ` three — and
both are real English, so "the other arm is three times the size" is a reason to look, not to edit.

⚠ **The census above is corrected from the first version of this doc**, which said 6 and 17. Reproducibly:
`grep -cP '\bAY[0-9] R IH0 NG\b'` on the pre-change dict is **20**, not 17 (`backfiring` is the lone `AY2`
member, and the first count missed the `AY2` rows of the other arm too). The `ER0` arm is **7**, not 6 —
`spiering` was in it and was never considered. Both errors ran in the same direction as the conclusion,
which is exactly why they needed a grep rather than a recollection.

## Run 1 — 2026-09-11 18:26 — espeak and the UK referee say BOTH sets are wrong

```
                ours          espeak-ng        en-GB referee
requiring    ɹᵻkwˈaᶦɚɪŋ    ɹᵻkwˈaɪɚɹɪŋ      ɹɪkwaɪəɹɪŋ
desiring     dᵻzˈaᶦɚɪŋ     dɪzˈaɪɚɹɪŋ       dɪzaɪəɹɪŋ · dɪzaɪɹɪŋ
firing       fˈaᶦɹɪŋ       fˈaɪɚɹɪŋ         faɪəɹɪŋ
hiring       hˈaᶦɹɪŋ       hˈaɪɚɹɪŋ         haɪəɹɪŋ
acquiring    əkwˈaᶦɹɪŋ     ɐkwˈaɪɚɹɪŋ       əkwaɪəɹɪŋ · əkwaɪɹɪŋ
```

Both instruments write **`aɪ` + `ɚ`/`ə` + `ɹ` + `ɪŋ`** — the `ɚ` AND a consonantal `ɹ` — for BOTH arms. On that evidence the target is neither of our shapes: the `ER0` arm is missing the `ɹ`, and the
`R` arm is missing the `ɚ`.

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
three-syllable form for both arms. The twenty are right as they stand; the six are not.

⚠ **THAT IS THE SECOND TIME TODAY THE CORPUS HAS OVERRIDDEN espeak**, after #1280's `research`. The rule
that keeps proving itself: espeak is a reference for ALIGNMENT, and where recordings exist they outrank it.
Its four-syllable reading is a real English pronunciation; it is just not the one speakers used here.

## Run 3 — 2026-09-11 18:55 — the review finds the rule is the ENVIRONMENT, not the suffix

The `/code-review high` pass on PR #1294 returned six findings, three of which changed the substance.

**The generalization was stated too narrowly.** CMUdict's `AY ER0` is not simply wrong — it is *correct*
word-finally and before a consonant suffix, where the `ɚ` is a genuine syllable nucleus:

```
desire     D IH0 Z AY1 ER0        dɪˈzaɪɚ      correct — word-final
desired    D IH0 Z AY1 ER0 D      dɪˈzaɪɚd     correct — /d/ is a consonant
desires    D IH0 Z AY1 ER0 Z      dɪˈzaɪɚz     correct — /z/ is a consonant
desiring   D IH0 Z AY1 ER0 IH0 NG                    WRONG — IH0 is a VOWEL; the ɹ is its onset
```

So the defect is `ER0` **before a vowel**, where the rhotic resyllabifies as the following onset. That is a
crisp, greppable rule, and it immediately implicates a row outside the `-ing` search:

```
inquiries   IH2 N K W AY1 ER0 IY0 Z    ɪŋkwˈaᶦɚiz    ER0 before IY0 — a vowel
inquiry     IH2 N K W AY1 R  IY2       ɪŋkwˈaᶦɹiː    its OWN singular, already on the R
```

An intra-lemma split in the same environment, one row from `inquiring`. And the corpus decides it directly:

```
sqlite3 align.sqlite "select text,phones from utt where lang like 'en%' and text like '%inquiry%'"

  an inquiry was established …   æ n ɪ n k w aɪ ɹ i  w ʌ z …     3-syl
  an inquiry was established …   æ n ɪ n k w ɪ  ɹ i  w ʌ z …     3-syl  (PRICE reduced)
```

×2, both three-syllable, neither with a schwa before the `ɹ`. `inquiries` joins the change.

**`spiering` does not.** It was in the `ER0` arm and the first pass never saw it — an omission, not a
decision. Making it one: it is a surname, not `-ire` + `-ing`, so the morphological argument above does
not reach it; it has no corpus row and no referee row; and CMUdict's PRICE vowel for a Dutch-origin name
(`/ˈspiːrɪŋ/`) is itself doubtful, which would be a different defect from this one. Left on
`spˈaᶦɚɪŋ` deliberately, and pinned by a test so the decision survives the next sweep.

**The `-ary`/`-y` nouns stay.** `diary D AY1 ER0 IY0`, `fiery`, `priory`, `friary`, `diarrhea` all match the
`ER0`-before-vowel grep, but their `ɚ` is a real nucleus and the words are three syllables with it
(`dˈaᶦɚi` = daɪ-ɚ-i). Removing it would make them two. Out of scope and correct as they stand.

## The change, and the per-row check the issue asked for

```
requiring    R IH0 K W AY1 ER0 IH0 NG  →  R IH0 K W AY1 R IH0 NG    corpus ×4, direct
inquiring    IH2 N K W AY1 ER0 IH0 NG  →  IH2 N K W AY1 R IH0 NG    no corpus row; UK referee 4-syl only
desiring     D IH0 Z AY1 ER0 IH0 NG    →  D IH0 Z AY1 R IH0 NG      no corpus row; UK referee attests BOTH
backfiring   B AE1 K F AY2 ER0 IH0 NG  →  B AE1 K F AY2 R IH0 NG    no corpus row, no referee row
rewiring     R IY0 W AY1 ER0 IH0 NG    →  R IY0 W AY1 R IH0 NG      no corpus row, no referee row
transpiring  T R AE0 N S P AY1 ER0 …   →  T R AE0 N S P AY1 R IH0 NG no corpus row, no referee row
inquiries    IH2 N K W AY1 ER0 IY0 Z   →  IH2 N K W AY1 R IY0 Z     corpus ×2 on `inquiry`, direct (Run 3)
spiering     S P AY1 ER0 IH0 NG        →  (unchanged)               deliberate non-member (Run 3)
```

⚠ **Only `requiring` is decided directly.** The other five are decided by ANALOGY — to `requiring`, to
`inquiry` (Run 3), and to the twenty rows that already carry the three-syllable form and that the corpus confirms. That is a
weaker warrant than #1280's and is stated as such. `rewiring` keeps its `IY0` prefix: it is productive
`re-` (wire again), unlike the lexicalized `re-` of `require` corrected in #1279.

## ⚠ Known limit: this is a GenAm decision applied to en-GB too — measured at one row

The first version of this section argued that because the twenty had ALREADY diverged from the UK
referee, moving the six "makes them consistent rather than introducing the divergence." **That argument is
backwards**, and the review said so: en-GB's accent transform inserts a linking `ɹ` across `ɚ` + vowel, so
the old `aᶦɚɪŋ` rows rendered as `aᶦəɹɪŋ` — *exactly* the referee's form. The six were the only members of
the family whose en-GB output AGREED with the referee. That the other twenty disagree is a reason those
twenty deserve a look, not a licence to join them.

Still visible on the rows that kept the old shape:

```
phonemize("spiering","en-GB")   →  spˈaᶦəɹɪŋ       referee-shaped, via the linking ɹ
phonemize("misfiring","en-GB")  →  mɪsfˈaᶦəɹɪŋ      (OOV — see #1295)
```

So: what does it actually cost? The headline eval cannot resolve six words in a 76,284-row referee, so the
two runs were compared directly, parent commit against branch:

```
npx tsx tools/referee-eval/eval.ts en-GB     35382/76284  →  35381/76284     −1 row
npx tsx tools/referee-eval/eval.ts en         1903/4558   →   1903/4558       unchanged
```

**One row.** Not six — because the UK referee itself lists the three-syllable form as a variant for two of
them (`desiring dɪzaɪəɹɪŋ · dɪzaɪɹɪŋ`, `acquiring əkwaɪəɹɪŋ · əkwaɪɹɪŋ`) and the eval credits any
variant, and three more (`backfiring`, `rewiring`, `transpiring`) have no UK row at all. Adding `inquiries`
cost nothing further (it never matched: we write `ɪŋ`, the referee `ɪn`).

That is the honest trade: **one en-GB referee row against 7-of-7 GenAm recordings plus `inquiry` ×2.** Taken,
but recorded as a debt, not a win. If en_gb recordings ever cover this rime, this is the first thing to
re-open — and the right fix would then be an en-GB-specific rule restoring the schwa for the whole family
of twenty-six, not a per-row revert.

## Left open

- **#1295 — the OOV path still emits the old shape.** `g2p-model.json` is trained on upstream CMUdict, and
  `--emit` regenerates `g2p-dict.tsv` from CMUdict too, so re-emitting would REVERT this change and the six
  other curated commits rather than propagate them. `phonemize("misfiring","en")` → `mɪsfˈaᶦɚɪŋ`, the shape
  this doc rejects, purely because the word is unlisted. Knowingly left; filed rather than patched.
