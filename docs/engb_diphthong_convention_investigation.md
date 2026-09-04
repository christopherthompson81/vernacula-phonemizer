# en-GB closing diphthongs: two full vowels → the parent's offglide notation (#1252)

Not a bug — `əʊ` is correct IPA for RP. A CONVENTION question: `en` writes closing diphthongs with a
superscript offglide (one unit), `en-GB` writes two full vowels that collide with every other language's
`ə`/`ɪ`/`ʊ` in a shared IPA corpus. The proposal is `əʊ → əᶷ`, `eɪ → eᶦ`, `aɪ → aᶦ`, `aʊ → aᶷ`.

## Run 1 — 2026-09-03 20:10 — the current state, and what the proposal's list misses

```
npx tsx dip.mts     # 10 probe words + a full-dict sequence inventory
```

```
goat  en ɡˈoᶷt   gb ɡˈəʊt        choice  en t͡ʃˈɔᶦs   gb t͡ʃˈɔɪs
face  en fˈeᶦs   gb fˈeɪs        near    en nˈɪɹ      gb nˈɪə
price en pɹˈaᶦs  gb pɹˈaɪs       square  en skwˈɛɹ    gb skwˈɛə
mouth en mˈaᶷθ   gb mˈaᶷθ→mˈaʊθ  cure    en kjˈʊɹ     gb kjˈʊə
```

en-GB dict counts: `əʊ` 16528 · `eɪ` 11696 · `aɪ` 9805 · `aʊ` 3007 · **`ɔɪ` 1125** · `ɪə` 658 · `ʊə` 303.

⚠ **CHOICE IS A FIFTH CASE AND THE ISSUE'S ENUMERATION MISSES IT.** `ɔɪ` is a closing diphthong, `en` already
writes `ɔᶦ`, and it is 1,125 dict occurrences. Three separate things say it belongs:

1. It is the issue's own argument verbatim — "identical to what `en` already emits, so they inherit its
   training directly" — and it is the *safest* of the five, since unlike `əᶷ` it introduces no novel
   combination at all.
2. `tools/referee-eval/langs/en.jsonc` already carries **five** offglide folds, not the four the issue
   describes; `ɔᶦ` is one of them. The sibling precedent the issue leans on already covers CHOICE.
3. All four offglides are handled by ONE rule (`.replace(/ᶦ/gu,"ɪ").replace(/ᶷ/gu,"ʊ")`, whose own comment
   names "FACE/PRICE/MOUTH/CHOICE"). Removing that rule covers CHOICE for free; *excluding* it would take a
   new special case. The natural implementation includes it and the exclusion would be the deliberate act.

I cannot check CHOICE's corpus counts — the OmniVoice corpus is not in this repo — so the case for it rests
on (1)–(3) rather than on a fourth column in the issue's table.

## Run 2 — 2026-09-03 20:20 — the parent's offglide inventory, and no orphans

```
npx tsx pairs.mts
oᶷ 17063 · eᶦ 11696 · aᶦ 9805 · aᶷ 3007 · ɔᶦ 1125      offglide with no nucleus before it: 0
```

Exactly five pairs and nothing stray, so "delete the generic offglide map" is well-defined.

## Run 3 — 2026-09-03 20:30 — ⚠ it is NOT mechanical: 238 words lose a schwa

The `oᶷ` count (17,063) and the `əʊ` count (16,528) do not match, which is the thread. Pulling it:

```
npx tsx glider.mts    # where an offglide is immediately followed by ɹ / ɚ / ɝ
ᶦɚ 550    ᶦɹ 465    ᶷɚ 285    ᶷɹ 94
```

The `ɚ` cases are safe — `ɚ` becomes `ə` on its own, so `əkwˈaᶦɚ` (acquire) gives `əkwˈaᶦə` either way.

**The `ɹ` cases are not.** Today the generic map turns the offglide into a full `ɪ`/`ʊ` FIRST, and then the
NEAR and CURE rules fire on it, converting *offglide + coda r* into the RP triphthong:

```
abshire    ˈæbʃaᶦɹ   →  aɪɹ  →  NEAR ɪɹ→ɪə  →  ˈæbʃaɪə     /ˈæbʃaɪə/, correct
auerback   ˈaᶷɹbæk   →  aʊɹ  →  CURE ʊɹ→ʊə  →  ˈaʊəbæk     /ˈaʊəbæk/, correct
```

Delete the generic map and NEAR/CURE stop matching (`ᶦ` is not `ɪ`), the coda-/ɹ/ drop takes the `ɹ` instead,
**and the schwa is never emitted** — `ˈæbʃaᶦ`, `ˈaᶷbæk`. That is a deleted phoneme — the class #1250 was
about — introduced by a change advertised as notation-only. Counted by building the change WITHOUT the two
rules below and diffing against a pure symbol substitution: **238 dict words** come out wrong.

So the change needs two rules the proposal does not mention: `ᶦɹ` → `ᶦə` and `ᶷɹ` → `ᶷə`, under the same
`CODA` guard the others use (so `əkwˈaᶦɹɪŋ`, where the `ɹ` is a linking onset before `ɪŋ`, keeps it).

## Run 4 — 2026-09-03 20:50 — the acceptance test for a convention change

A notation change has exactly one acceptance test: **map the new spelling back and get the old output, for
every word.** Rendered the whole dict before and after, then normalised the new side with `ᶦ→ɪ`, `ᶷ→ʊ`:

```
en-GB words re-spelled:                              38,567
NOT explained by the notation substitution:               0
pcm words changed (must be 0):                            0
```

⚠ AND THE DICT IS NOT ENOUGH, because dict words never exercise the OOV path. Repeated over the referee's own
76,284-word list (which is where the rare and OOV words are):

```
referee-list words NOT explained by the notation substitution:  0 of 76,284
```

Zero on both, and that is only true because of the two triphthong rules from Run 3 — without them it is 238.

## Run 5 — 2026-09-03 21:00 — the referee, and whether the folds are load-bearing

Five folds added to `tools/referee-eval/langs/en-GB.jsonc`, mirroring the five `en.jsonc` already carries.

| | before | after |
|---|---|---|
| folded backbone | 29,880/76,284 (39.2%) | **29,906/76,284 (39.2%)** |
| symbol accuracy | 80.1% | **80.1%** |

The issue predicted "the score is unaffected" and that is what happened; the +26 exact matches are 0.03% and
in the right direction, and symbol accuracy does not move at all.

⚠ AND THE FOLDS ARE NOT DECORATIVE, which was worth knowing before trusting that table. Dropping the five and
re-running:

```
folded backbone: 20,465/76,284 (26.8%)     symbol accuracy: 76.2%
```

So the eval does NOT strip modifier letters on its own — the folds carry 9,441 exact matches. Had they been
forgotten, this change would have looked like a 12-point regression against the referee rather than a
notation swap. (Which is the same shape as the C# goldens in #1250: a convention change is only invisible if
every consumer of the convention is updated with it.)

## Cost, as it actually landed

- `csharp/goldens/en-GB.tsv`: **197 of 200** rows re-rendered; `pcm.tsv` untouched. `csharp/tools/parity`
  reports 400 rows ok / 0 differ, so the C# port moves with it.
- `test/english-gb.test.ts`: 6 lines of the adjudicated gold table.
- `.probe/goldens.bak/` needs nothing — it is gitignored scratch, not tracked.

## What was NOT done, and why

- **The centring diphthongs `ɪə ɛə ʊə` are left alone**, as the issue argues: `ᵊ` occurs zero times in the
  target corpus, so `ɪᵊ ɛᵊ ʊᵊ` would trade a contaminated-but-trained symbol for an untrained one. That is a
  corpus argument and no notation fixes it.
- **`əᶷ` is a novel combination and stays untested here.** The corpus has `ə`, has `ᶷ`, and has `oᶷ`/`aᶷ` as
  units, but has never seen this pair. Substituting the parent's `oᶷ` would make en-GB sound American, which
  is not a fix; if `əᶷ` renders badly the honest answer is en-GB audio in the fine-tune. Recorded, not guessed.
