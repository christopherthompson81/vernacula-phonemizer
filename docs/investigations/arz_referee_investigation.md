# arz referee investigation — is wikipron-arz a good target?

Question that opened this: the Egyptian referee sits at 50.7%, ~10pp below MSA, on 4× the training data.
Is the engine that much worse in Egyptian, or is the instrument mis-scoring it?

## Run 1 — 2026-08-20

**Command.** `npx tsx tools/referee-eval/eval.ts arz --examples 400`

**Question.** Do the misses cluster into a diagnosable class?

**Raw finding.** 299/590 folded (50.7%), symbol accuracy 84.1%. Every one of the 400 printed residual
classes has count 1 — the grouping key is the folded pair, so a per-word divergence never aggregates.
The printed residual is useless for finding a systematic defect.

**Implication.** Need a per-miss dump with edit-op tallies, not the built-in class histogram.

## Run 2 — 2026-08-20

**Command.** Scratch dump of all misses via `phonemizeArabic(w, "egyptian")`, then the same with
`{ lexicon: false }`.

**Question.** What does the miss set actually look like?

**Raw finding.** The shipped path scores **482/590 (81.7%)**. The harness scores 299/590 because
`eval.ts:263` runs arz with `lexicon: false` — the Egyptian short-vowel lexicon is mined from kaikki,
which shares the en.wiktionary upstream with the wikipron-arz referee, so scoring it would be circular.

**Implication.** 50.7% is the anti-circularity configuration, not the product. Both numbers are real and
they answer different questions; only one of them is what a user gets. Same shape as the ckb/af/km/en-GB
rule-only referees.

## Run 3 — 2026-08-20

**Command.** Levenshtein op tally over the 108 shipped-path misses.

**Question.** Are the residual divergences phonological or notational?

**Raw finding.** 74 of 108 misses differ by a **single symbol**. Top ops (ours → referee):

```
  31  a→ɑ        12  ∅→a (missing)     7  ˤ→∅        5  a→i
  16  i→∅ (extra) 9  ∅→ʔ (missing)     7  i→ɪ        4  u→a
  13  r→ɾ         9  ʔ→∅ (extra)       5  ∅→ɑ
```

**Implication.** `a→ɑ`, `r→ɾ`, `i→ɪ` are not contrasts in Egyptian. Suspect transcription convention.

## Run 4 — 2026-08-20

**Command.** Co-occurrence scan over the 590 referee rows.

**Question.** If `ɑ` were the emphatic allophone of /a/, words containing both a plain and an emphatic
context would show both symbols. Do they?

**Raw finding.**

```
a  425 rows (72.0%)     r  142 rows (24.1%)     ʔ  120 rows (20.3%)
ɑ   21 rows ( 3.6%)     ɾ   14 rows ( 2.4%)
æ   36 rows ( 6.1%)
rows containing BOTH a and ɑ:  0
rows containing BOTH r and ɾ:  0
```

Word-initial glottal stop, over the 95 orthographically vowel-initial words (alef/hamza carriers — the
environment where Egyptian supplies an automatic glottal onset): **47 written (49%), 48 omitted (51%)**.
`أنا → a n a` but `آسف → ʔ aː s i f`.

**Implication.** Zero co-occurrence in 590 rows is the signature of per-contributor notation, not
conditioned allophony: each transcriber picked one symbol and used it throughout their own entries. The
initial-ʔ split is a coin flip on an identical environment. wikipron-arz is a *pooled crowd corpus with
heterogeneous conventions*. The `æ→a` fold already in `arz.jsonc` is justified in exactly these terms —
`ɑ`, `ɾ`, `ɪ` are the same class and were simply missed.

This makes the referee a **good segmental target with a bad notational surface**. Not faulty: fallible in
a way that folds are the designed remedy for.

## Run 5 — 2026-08-20

**Command.** Cumulative fold ablation, both lexicon settings.

**Question.** How much of the gap is notation?

**Raw finding.**

| fold added | shipped | harness (no lex) |
|---|---|---|
| baseline | 482 (81.7%) | 299 (50.7%) |
| `ɑ→a` | 492 (83.4%) | 308 (52.2%) |
| `ɾ→r` | 501 (84.9%) | 311 (52.7%) |
| `ɪ→i` | 506 (85.8%) | 314 (53.2%) |
| `ˤ→∅` | 508 (86.1%) | 314 (53.2%) |
| `^ʔ→∅` | 524 (88.8%) | 317 (53.7%) |
| final short V | 550 (93.2%) | 366 (62.0%) |

Same folds on MSA move it +0.1pp (wikipron 64.9→65.0, kaikki 69.7→69.8) — this is arz-specific.

**Implication.** The final-short-vowel line is suspiciously large. Investigate before adopting it.

## Run 6 — 2026-08-20 — the ordering defect

**Command.** Classify the 22 shipped misses that the final-vowel fold repairs; print raw engine output.

**Question.** Is that fold repairing a notation artifact or masking real errors?

**Raw finding.** Only 1 of 22 is a length artifact. The rest are real, in both directions:

```
 9  ours adds a final -i, referee ends in a consonant    ان: ini | in     جد: ɡidi | ɡid
 9  ours drops a final -a the referee has                انت: int | inta  سبعة: sabʕ | sabʕa
 3  ours adds a final -u                                 مايو: maju | maj
 1  length only                                          أوي: ʔawi | ʔaw
```

But the raw forms show the scoring itself is broken:

```
انت   ours = ˈenta       referee = e n t æ      ← the SAME pronunciation, scored a miss
سبعة  ours = sˈabʕ       referee = s æ b ʕ æ
مايو  ours = mˈaːjo      referee = m aː j u
جد    ours = ɡˈidːe      referee = ɡ i d d
```

The pausal strip `[aiu]$` is a **preFold**; the notation folds `æ→a`, `[eɛ]→i`, `[oɔ]→u` are **folds**,
which run after the backbone. So the pausal strip sees `æ` on the referee side and `e`/`o` on ours, and
matches neither. It fires on whichever side happens to use the plain symbol and not the other. `انت`
loses our `-a` while the referee keeps its `-æ`, and the instrument reports a miss on two identical
transcriptions.

**Implication.** Two separate defects: (1) fold ordering — positional folds must run after the notation
folds they depend on; (2) arz should probably not have a pausal fold at all. It was copied from
`ar.jsonc`, where it is justified by the iʕrab case ending. Egyptian dropped iʕrab. The final `-a` of
سبعة and the nisba `-i` are lexical, and stripping them scores their absence as free — the axis-deletion
failure mode.

## Run 7 — 2026-08-20 — corrected configurations

**Command.** Re-score under five fold orderings.

|  | shipped | harness |
|---|---|---|
| 1 current (notation after pausal preFold) | 506 (85.8%) | 314 (53.2%) |
| 2 notation first, pausal kept pre-backbone | 530 (89.8%) | 323 (54.7%) |
| 3 notation first, pausal removed | 515 (87.3%) | 359 (60.8%) |
| **4 = 3 + initial-ʔ fold** | **529 (89.7%)** | **364 (61.7%)** |
| 5 = 4 + pausal post-backbone (symmetric) | 546 (92.5%) | 369 (62.5%) |

(Config 1 already includes `ɑ ɾ ɪ`, hence 506 rather than the 482 baseline.)

**Raw finding.** Config 4 recovers nearly all of what config 5 does while keeping the final-vowel axis
scoreable. The 17-word gap between 4 and 5 is precisely the set config 5 would forgive — `sabʕ`/`sabʕa`,
`ini`/`in` — which are real engine errors and the most useful thing left in the residual.

**Implication.** Recommend **config 4**: fold `[æɑ]→a`, `[eɛ]→i`, `[oɔ]→u`, `ɾ→r`, `ɪ→i` as preFolds
(before the backbone, so positional folds see normalized symbols), drop the pausal preFold from
`arz.jsonc`, and add `^ʔ→∅`. Do not adopt the pausal strip for arz.

## Verdict

The referee is a **good target, mis-read by the instrument**. Of the 108 shipped-path misses:

- ~58 are notation the fold set does not cover (`ɑ`, `ɾ`, `ɪ`, `ˤ`) — the referee's own inconsistency,
  which is what folds exist for;
- ~18 are the initial glottal onset, which the referee writes on a 49/51 coin flip;
- ~24 are the fold-ordering defect, where identical transcriptions are scored as misses;
- the genuine residual is the **short-vowel quality tail** (`a→i`, `u→a`, `∅→a`) — the documented
  Egyptian vowel-restructuring gap, and the only part that a model change could move.

Corrected, arz reads **89.7% shipped / 61.7% lexicon-off**, against MSA's 64.9%. The "Egyptian is 10pp
behind MSA" reading was an artifact of comparing MSA's shipped-equivalent number to arz's anti-circular
one, on top of a fold set that mis-scored roughly one miss in four.

## Open

- The same ordering rule should be audited fleet-wide: any language with a **positional** preFold
  (`$`/`^`-anchored) plus a **symbol** fold is exposed to the same defect. arz is the one found so far;
  MSA is unaffected (+0.1pp).
- Unrelated and still open: the two MSA referees move in opposite directions under frequency weighting
  (kaikki 69.7→87.4, wikipron 64.9→50.1).

## Run 8 — 2026-08-20 — fleet audit of the ordering defect

**Command.** Scan every `tools/referee-eval/langs/*.jsonc` for a POSITIONAL preFold (`^`/`$`-anchored)
co-occurring with a symbol fold, then re-score each hit with the pausal fold removed and moved.

**Question.** Is the ordering defect arz-only?

**Raw finding.** Ten configs matched; `he` and `ki` are false positives (the `^` is inside the negated
class of `\([^)]*\)`). The eight real hits are the entire Arabic family, all carrying `[aiu]$` inherited
from `ar.jsonc`.

| | current | pausal removed | pausal post-backbone |
|---|---|---|---|
| acm (108) | 25.0% | **24.1%** | 28.7% |
| acw (1891) | 42.1% | **46.8%** | 47.0% |
| afb (763) | 3.7% | **4.2%** | 4.2% |
| ajp (2513) | 39.2% | **45.3%** | 45.6% |
| apc (410) | 22.2% | **25.6%** | 25.6% |
| ary (2168) | 26.7% | **30.0%** | 30.4% |
| ayl (166) | 13.3% | **15.1%** | 15.1% |
| ar (4758) | 64.9% | — | 65.0% |

**Implication.** The pausal fold is warranted only in `ar.jsonc`: MSA's iʕrab case ending is genuinely
unpronounced in pause. **Every spoken dialect dropped iʕrab**, so a final short vowel in acm/acw/afb/ajp/
apc/ary/ayl/arz is lexical — the fold scored its absence as free and, running as a preFold, fired on
whichever side happened to use the plain vowel symbol. Removed from all seven siblings (arz done in
run 7). acm loses 0.9pp (one word of 108) — correct anyway, since the fold was buying that match
spuriously. `ar` keeps it.

Note the `post-backbone` column is uniformly the best number and is uniformly the wrong choice: it is the
axis-deletion premium, the words where the final-vowel difference is real.

## Corrected figures — 2026-08-20

| | before | after |
|---|---|---|
| arz folded (lexicon-off) | 50.7% | **61.7%** |
| arz symbol accuracy | 84.1% | **88.4%** |
| arz frequency-weighted | 61.7% | **80.4%** |
| arz SHIPPED path | 81.7% | **89.7%** |
| acw / ajp / ary / apc / ayl / afb / acm | see run 8 | +4.7 / +6.1 / +3.3 / +3.4 / +1.8 / +0.5 / −0.9 pp |

⚠ Correction to an earlier claim in `docs/language-maturity.md`: arz's outstanding short-vowel tail was
described as **"data-blocked"**. At 89.7% on the shipped path that word is wrong, and the 47.5% that
motivated it was substantially instrument error. What is actually closed is one scale path — Farasa's
dialect diacritizer is research-license-only. Widening the Egyptian vowel lexicon and improving the
silver teacher are both open and ordinary.

## Run 9 — 2026-08-20 — is arz ✅? (no; and the shipped figure is circular)

**Command.** Partition the 590 referee words by membership in `src/languages/arabic/egyptian-lexicon.tsv`
(714 headwords), score each partition shipped and lexicon-off, and weight by `freq/arz.txt`.

**Question.** The `✅` criterion rests on an *independent* referee. The shipped path reads 89.7% against
wikipron-arz — but the lexicon is kaikki-derived. How much of that 89.7% is circular?

**Raw finding.**

```
referee words also in the lexicon:  563/590 (95.4%)
  shipped, IN lexicon (circular):   511/563 (90.8%)
  shipped, NOT in lexicon (clean):   18/27  (66.7%)   <-- the only clean shipped figure
  lexicon-off, NOT in lexicon:       19/27  (70.4%)
  shipped, ALL:                     529/590 (89.7%)

frequency-weighted:  shipped ALL 93.6%   |   lexicon-off ALL 80.4%
```

**Implication.** **Almost the entire referee is inside the lexicon.** The lexicon was mined from kaikki
Egyptian-Arabic and, per its own build note, *validated ~88–92% against wikipron-arz at build* — so it was
tuned on the referee it is now being scored against. 89.7% is reading back the answer key and must not be
quoted as a quality figure. Removed from the maturity row and the floor comment.

On the 27 words outside the lexicon, shipped 18/27 vs lexicon-off 19/27 — at that sample size there is no
measurable shipped advantage on unseen words at all.

Compare the `af` precedent, which is the ✅ this was being argued toward: af bounded its circularity at
**0.1pp** by scoring against a primary referee that no lexicon tier derives from, and reported a genuine
own-error of ~0.2% of running-text tokens. arz has no second referee to do that with.

**Verdict on the status marker.** arz stays **🟡**, and comfortably so:

- **Not ✅** — ✅ requires that the low referee % be *only* referee noise or a fold ceiling. After run 7
  removed both of those, 226 of 590 misses remain lexicon-off, and their composition is a systematic
  segment class (short-vowel quality), which the doc's own discriminator calls "real, fixable work".
- **Not 🟢** — the information *is* in the input: Egyptian short vowels are recoverable from context, which
  is what the neural diacritizer does. A path exists, so it is a backlog item, not a cap.
- **🟡 exactly** — "a documented exception/lexicon layer would close a small, *specific* class." That is
  literally the open item.
- 🔷 is arguable (one referee), but 🔷 means *trustworthy on one tradition*, and the honest independent
  number here is 61.7% / 80.4% token-weighted, which is not yet a trust claim.

The honest summary of arz: **61.7% folded, 88.4% symbol, 80.4% frequency-weighted, all lexicon-off and
non-circular.** Everything above that is the answer key.
