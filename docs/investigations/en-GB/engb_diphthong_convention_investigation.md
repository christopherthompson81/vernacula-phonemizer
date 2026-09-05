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

## Run 6 — 2026-09-04 09:10 — the reporter corrected the corpus numbers, and they were wrong in a way worth recording

Two comments landed on #1252 after this branch was opened.

⚠ **The counts quoted in the issue (and in my first draft of the code comment) were from the wrong layer.**
They came from `align.sqlite`, the alignment/QC database — 271,798 rows over **102** languages — not from
what the downstream model trained on, which is a subset sampled over **28** languages (v6 fine-tune: 82,258
utterances). Restricted to the trained set:

| sequence | all 102 | 28 trained | trained sources |
|---|---|---|---|
| `oᶷ` | 10,766 | 6,897 | en_us 3,175, cs_cz 2,026, vi_vn 608 |
| `əʊ` | 917 | 434 | **sd_in 394**, ru_ru 39, hi_in 1 |
| `eᶦ` | 12,816 | 9,567 | en_us 4,146, cy_gb 3,535 |
| `eɪ` | 1,913 | **11** | ru_ru 11 |
| `aᶦ` | 18,202 | 15,341 | ta_in 7,653, en_us 3,398 |
| `aɪ` | 12,474 | 7,595 | **de_de 7,468** |
| `aᶷ` | 4,515 | 3,708 | cy_gb 1,327, en_us 1,217 |
| `aʊ` | 8,258 | 2,786 | **de_de 2,755** |
| `ᵊ` | 0 | 0 | — |

**The Burmese attribution was wrong** — Burmese is not in the trained set at all. `eɪ` has ELEVEN training
occurrences, all Russian. The conclusion gets sharper, not weaker, and `ᵊ` is still zero either way so the
centring-diphthong recommendation is unchanged. Every quotation of the old figures in this tree is corrected.

⚠ **AND THE SECOND COMMENT REFRAMED THE DECISION, WHICH CHANGED WHAT THE CODE COMMENT SHOULD ARGUE.** The
reporter's own words: *"None of the corpus detail is a prerequisite for deciding this issue … That is a
consistency question between two variants of the same engine."* The downstream corpus is the REASON the
change was proposed, not the argument for it. So the comment in `english-gb.ts` now leads with an in-repo
measurement anyone can re-run, and cites the (corrected) downstream numbers as motivation.

The in-repo measurement, over the first 60 golden rows of every ported language:

```
eᶦ  28 languages (en 92, en-GB 77, nan 65, cy 51)   ·  eɪ  2 (my 56, la 6)
aᶦ  27 languages (ta 174, en 86, en-GB 76)          ·  aɪ  13 (de 139, my 117, en-IN 76)
aᶷ  14 languages (en 41, en-GB 27, cy 26)           ·  aʊ  8  (my 122, de 65)
oᶷ  46 languages                                     ·  əʊ  3  (mai 43, awa 13, mn 12)
```

Same story, measured on this side of the boundary: the superscript spellings are where the English family
already lives, the plain ones are mostly Burmese, German and Devanagari sequences.

## Run 7 — 2026-09-04 09:20 — the one question the reporter asked for judgement on

> *"whether `əᶷ` is the right spelling — i.e. that RP GOAT keeps its central unrounded onset and only the
> offglide changes notation … I would rather not guess at the boundary between 'notation' and 'realisation'
> in someone else's engine."*

It is the right spelling, and the boundary is exactly where they put it:

1. **The onset is realisation, the offglide is notation.** RP GOAT is a central unrounded onset, GenAm's is
   back rounded — a real phone contrast this engine already encodes elsewhere (it is why `en-GB.jsonc` folds
   `ɐ`/`ɜ` to `ə` for the referee but has never folded the GOAT onset). The superscript is a spelling for the
   glide, and spelling it does not touch the nucleus. Substituting `oᶷ` would change the phone.
2. **`ə` + superscript `ᶷ` is not novel to this engine.** Welsh already emits it — `dəᶷˈɛdɔð` (*dywedodd*),
   4 occurrences in cy's golden sample alone. So the pairing is already inside the fleet's IPA, independent
   of en-GB.
3. **The nucleus set for a superscript glide was never restricted to `o`/`a`.** `en` itself writes `eᶦ` and
   `ɔᶦ`, so "any vowel + superscript glide" is the established pattern and `ə` is not a special case.

⚠ Point 2 answers whether the SEQUENCE is well-formed for this engine. It does not answer whether a given
downstream MODEL has seen the pair — that is a fact about that model's corpus and stays the reporter's to
measure, exactly as their caveat says.

## Run 8 — 2026-09-04 10:05 — review pass

Four findings, all real, all fixed. The first is the interesting one because it is this branch quietly
invalidating an audit from two issues ago.

**1. `VOWEL` stopped covering the alphabet it claims to.** Its docblock says it is "the POST-transform
alphabet … what those rules LEAVE", and the #1250 audit concluded `ᵻ` was "the ONLY vowel that can follow an
`ɹ` here and is missing". Both were true *only because the generic offglide map rewrote `ᶦ`/`ᶷ` to full
`ɪ`/`ʊ` before the class was ever consulted*. This change deletes that map, so the two offglides now survive
into the post-transform string and are absent from the class.

Not a live bug — the parent never emits a glide without its nucleus in front of it, so `ɹᶦ` cannot occur —
but the file's own stated policy is a generous superset *because the error here is one-sided*, which is why
`ɐ` and `o` are kept though provably unreachable. Added `ᶦᶷ`, and verified the widening is a no-op:

```
dict en-GB rows changed: 0 / 117,479      referee-list rows changed: 0 / 76,284      pcm: 0
```

⚠ The same omission was in `test/onset-r.test.ts`'s `GENAM_VOWEL`, so the instrument could not have caught it
either — the identical shape as the `ɚ`-before-`ɚ` miss that the #1250 review found in that same constant.
Twice now, so the class is spelled out in full rather than trimmed to what looks reachable.

**2. The TS docblock still named a rule this change deletes** — "GOAT/**offglide**/NURSE/lettER remaps". The
C# twin was updated in the same diff and the TS original was missed, so the two ports' comments disagreed
about the same code.

**3. `test/referee-eval.test.ts`'s en-GB floor comment was stale**, and this one mattered: it is the file's
record of *why* the 0.38 floor holds, and it still listed the four-fold set that — per Run 5 — scores
26.8%/76.2% and would blow straight through that floor. `docs/language-maturity.md` had been updated and this
had not, so the two records contradicted each other. Now names all five folds and states that they are
load-bearing, with the measured no-fold number.

**4. `PRICE_R` was named for one lexical set but matches bare `ᶦɹ`**, so it also fires on FACE — `ˈeᶦɹ` (ayr)
→ `ˈeᶦə`, `æɫvˈeᶦɹ` (alvare). Renamed `IGLIDE_R`/`UGLIDE_R` and the comments name every set that ends in the
glide, because a name saying PRICE sends the next reader looking for a FACE rule that does not exist.
