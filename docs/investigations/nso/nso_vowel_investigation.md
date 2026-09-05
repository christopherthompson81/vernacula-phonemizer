# nso (Sepedi) — the fleet's worst audio median is three vowel symbols

Question that opened this: pick a language with high median disagreement in the ASR-alignment corpus and
see what its defects actually look like.

## Run 1 — 2026-08-20 — picking the language

**Command.** Median `dist` per language over `align.sqlite`.

**Raw finding.**

```
nso_za  1990  0.6647     <- worst in the fleet
vi_vn   2994  0.5714
ko_kr   2306  0.5532
ta_in   2366  0.5510
...
sn_zw   2463  0.2105     (best of the Bantu set)
```

`nso_za` is 0.09 clear of the next language and roughly double the fleet median.

**Implication.** An outlier that large is either a recognizer-inventory artefact (the `COARSEN` case, which
the README warns is the usual explanation) or something uniform in our output. Check which.

## Run 2 — 2026-08-20 — the status column

**Command.** `SELECT COUNT(*), SUM(status='verified') … WHERE lang='nso_za'`

**Raw finding.** **1,989 of 1,990 rows are `verified`. One row is `investigate`.**

**Implication.** The queue is scored against each language's *own* median at 3×MAD, so a language that is
uniformly wrong flags nothing — every row is equally far out, so no row is an outlier. This is the same
failure mode as arz's 98.4% "verified": **a self-relative screen cannot see a uniform deficit.** The worst
language in the fleet is also one of the cleanest-looking by status.

## Run 3 — 2026-08-20 — what diverges

**Command.** `confusion_pairs.py --lang nso_za --status all`

**Raw finding.**

```
  ɑ -> a  8524 38.1%      ɛ -> i  1518  6.8%
  ɛ -> e  5215 23.3%      ɔ -> u   942  4.2%
  ɔ -> o  4542 20.3%      ɑ -> e   331  1.5%
```

**92.7% of all substitutions are three vowel symbols.** The consonants — including the ejective series and
`ɬ`, the things that look exotic — are not the problem.

**Implication.** Either our vowels are wrong or the recognizer cannot write ours. Test which.

## Run 4 — 2026-08-20 — is it an instrument gap?

**Command.** Corpus-wide symbol inventory, ours vs the recognizer's, over 270k utterances.

**Raw finding.**

```
sym       ours    recognizer   langs it appears in
ɑ       489619       150957        100
ɛ       635659       405170        102
ɔ       577227       307990        102
ʼ        99606             0          0
```

**Implication.** `ɑ`, `ɛ` and `ɔ` are all things this recognizer writes freely, in ~100 languages. They are
NOT `COARSEN` candidates and the nso disagreement is not an inventory gap.

⚠ **A false lead, recorded so it is not re-run.** `ʼ` looks like a textbook COARSEN candidate — 99,606
emitted, 0 returned, 0 languages, a larger count than several symbols already in the table. It is already
handled: U+02BC is Unicode category **Lm**, and `fold()` strips every Lm/Sk character. Sepedi's ejectives
cost nothing. Check the category before proposing a fold.

## Run 5 — 2026-08-20 — the control

**Command.** Align our IPA to the recognizer's per utterance; for each language, what does the recognizer
return where we write `ɛ` / `ɔ`?

**Raw finding.**

```
lang       our ɛ→their ɛ   →their e  |  our ɔ→their ɔ   →their o
nso_za             0.2%      61.2%   |          0.3%      67.6%
fr_fr             78.6%      10.5%   |         66.5%      29.7%
de_de             84.2%       6.3%   |         80.2%       7.0%
pt_br             75.2%      10.4%   |         83.3%      10.0%
en_us             87.4%       2.0%   |          9.8%      28.1%
```

**Implication.** This is the decisive measurement. The recognizer reproduces our `ɛ` three-quarters to
seven-eighths of the time in the languages that have it, so it discriminates the contrast reliably. In
Sepedi it does so **0.2%** of the time. That is not a recognizer prior toward `a e o`; it is the recognizer
saying the open-mid vowels are not there.

## Run 6 — 2026-08-20 — the full distribution

```
our ɑ (n=32820) → a 81.9%  e 3.8%  o 2.6%
our ɛ (n=26708) → e 60.0%  i 18.3%  a 3.8%   ɪ 1.1%
our ɔ (n=21886) → o 67.4%  u 12.8%  a 4.5%
our i (n=10809) → i 81.6%      (control: a vowel we get right)
our u (n= 2700) → u 74.2%      (control)
```

**Implication.** `ɑ→a` at 81.9% is the same agreement rate as the vowels we get right (i 81.6%, u 74.2%) —
so `a` is simply the correct symbol and `ɑ` is a notation error with no phonological content. `ɛ` and `ɔ`
never come back as themselves; they come back as the CLOSE value (e 60% / o 67%) with a higher variant
behind it (i 18% / u 13%).

## Run 7 — 2026-08-20 — the convention sweep

**Command.** Re-score all 1,990 utterances with our vowel symbols substituted, recognizer side untouched.

```
current (ɑ ɛ ɔ)              median 0.6647
ɑ→a                          median 0.4598   -0.205
ɛ→e, ɔ→o                     median 0.4394   -0.225
ɑ→a, ɛ→e, ɔ→o                median 0.2763   -0.389
ɑ→a, ɛ→ɪ, ɔ→ʊ  (Setswana)    median 0.4591   -0.206
ɛ→ɪ, ɔ→ʊ only                median 0.6710   +0.006   (worse)
ɑ→a, ɛ→e, ɔ→u                median 0.3482   -0.317
ɑ→a, ɛ→i, ɔ→o                median 0.3438   -0.321
```

**Implication.** `a e o` takes nso from **worst in the fleet (0.6647) to near the best (0.2763)** — better
than `ny_mw` (0.3258) and close to `sn_zw` (0.2105). The sibling Setswana convention (`ɪ ʊ`) is measurably
worse than `e o` here, by 0.18.

## Run 8 — 2026-08-20 — a second, non-acoustic source

epitran has **no** `nso` or `sot` map, but it has `tsn-Latn` (Setswana), the closest sibling. Run over 400
Sepedi FLEURS transcripts, its output symbols are:

```
⟨a⟩ →  a 100%                                  (never ɑ)
⟨e⟩ →  ɪ 56%   e 41%   ɛ  4%
⟨o⟩ →  ʊ 89%   o 11%   ɔ  0%                   (never ɔ)
```

**Implication.** Two independent sources of different kinds — an acoustic model and a rule set written for
the sibling language — agree on the two things that matter:

- **⟨a⟩ is `a`, not `ɑ`.** 100% in epitran, 81.9% in the audio. No dissent from either.
- **⟨e⟩/⟨o⟩ are not `ɛ`/`ɔ`.** epitran writes `ɛ` 4% and `ɔ` **never**; the recognizer returns them 0.2%
  and 0.3%. We emit them 100% of the time.

They **disagree on which close value**: epitran prefers `ɪ`/`ʊ`, the audio prefers `e`/`o` (and the sweep
scores `e o` 0.18 better than `ɪ ʊ`). Note epitran is context-sensitive here — `pele→pelɪ`, `dumela→dumɛla`,
`lefatshe→lɪfatsʰɪ` — so it is modelling a conditioned alternation that we do not model at all.

## What the defect is

Sepedi's grapheme table (`src/languages/sepedi/sepedi.jsonc`) maps `a→ɑ`, `e→ɛ`, `o→ɔ`. The module comment
says "Vowel height unwritten (default mid)". The default chosen was the **open-mid** value. Every source
available says the realisation is the **close-mid** one, and that `ɑ` is wrong outright.

Sotho-Tswana has a 7-vowel system written with 5 letters, so ⟨e⟩ covers /e/~/ɪ/ and ⟨o⟩ covers /o/~/ʊ/.
That height contrast is genuinely underdetermined by the orthography and is the residual after any fix
(the 18.3% `i` and 12.8% `u` in run 6) — a lexicon item, not a rule. But picking the *open* value for a
contrast between two *close* ones is not a defensible default; it is the one value neither source attests.

## The subfamily is inconsistent, and its one referee cannot see it

```
              ⟨a⟩   ⟨e⟩   ⟨o⟩
sepedi   nso    ɑ     ɛ     ɔ
sesotho  st     ɑ     ɛ     ɔ
setswana tn     a     ɪ     ʊ
```

Setswana is the only one with a referee — epitran tsn, floored at 0.98. That figure cannot adjudicate any
of this, because `tn.jsonc` folds `[ɛɪ]→e` and `[ɔʊ]→o`: the fold **collapses the entire vowel-height axis**
the disagreement lives on. 98% is measuring the consonants. Folds must not delete the axis under test, and
here one does, on the only language in the subfamily positioned to referee the others.

## And nso is marked ⛔ "cannot-verify"

`docs/language-maturity.md`: *"No referee of any kind (no wikipron/kaikki/epitran) → the weakest anchor of
the Sotho set."* True of dictionaries. There are **1,990 utterances of Sepedi audio** in this corpus, which
is a referee of a different kind, and it has been sitting on a specific, quantified, three-symbol defect.
⛔ described the absence of the sources we usually look for, and was read as an absence of evidence.

## Recommendation

1. `sepedi.jsonc`: `a→a`. Two sources, no dissent, no axis involved. Unambiguous.
2. `sepedi.jsonc`: `e→e`, `o→o`. Best-measured on the only nso-specific evidence that exists, with
   epitran-tsn's preference for `ɪ`/`ʊ` recorded as dissent. Expected median 0.6647 → 0.2763.
3. Do NOT propagate silently to `st`/`tn`. `st` shares the table and has no audio and no referee, so the
   change would be inference; `tn` has a referee whose fold hides the axis. Both need their own evidence.
4. Reopen `tn.jsonc`'s `[ɛɪ]→e` / `[ɔʊ]→o` folds — they make the subfamily's one referee blind to the one
   thing worth measuring.
5. The nso maturity row should stop saying "no referee of any kind".

## Open

- Italian shows the same shape in the run-5 control (`our ɛ → their ɛ` 21.2%, `→ e` 61.9%) against
  75–87% for fr/de/pt. Unlike nso this may be real — Italian neutralises /e/~/ɛ/ outside stress — but the
  ratio is far off its Romance siblings and nobody has looked.
- How many other languages carry a uniform deficit invisible to the 3×MAD screen? The screen ranks within a
  language; the median ranks across them. Nothing currently reads the medians as a queue.

## Run 9 — 2026-08-20 — is the height alternation implementable?

**Question.** Runs 6–8 all show a residual close variant behind the mid one (`ɛ`→i 18%, `ɔ`→u 13%), and
epitran-tsn models it context-sensitively. Sotho-Tswana has height harmony — the mid vowel raises before a
high vowel. Is that visible here, and is it worth implementing rather than picking a flat default?

**Raw finding.** It is visible, and it is in the right direction:

```
our ɛ, by the following vowel        our ɔ, by the following vowel
  next=ɑ   e 61.9%  i 16.9%   3.67     next=ɑ   o 72.1%  u  9.3%   7.72
  next=ɛ   e 60.7%  i 18.3%   3.31     next=ɛ   o 65.0%  u 13.0%   5.00
  next=i   e 58.4%  i 21.6%   2.70     next=i   o 61.3%  u 24.7%   2.48
  next=u   e 39.6%  i 35.0%   1.13     next=u   o 47.9%  u 29.0%   1.65
```

Before a high vowel the close variant roughly doubles (`i` 16.9% → 35.0%). But **it never becomes the
majority in any environment**, so a categorical raising rule flips contexts the recognizer still calls `e`.
Measured directly:

```
current                      median 0.6647
flat  a e o                  median 0.2763     <- best
harmony (raise before i/u)   median 0.2840     worse by 0.008
```

**Implication.** The alternation is real and detectable but **implementing it as a rule measures net
negative** against the flat default. Take `a e o` flat; leave harmony as a candidate that needs a source
with better resolution than a phone recognizer. Another entry for "the linguistically obvious rule measured
worse".

## ⚠ What applying this costs the instrument

Adopting `a e o` **spends nso's audio evidence on the mid vowels**. Once the symbols are chosen to minimise
recognizer distance, that distance is no longer an independent check on them — it is a fitted quantity, and
a future nso median near 0.27 confirms nothing about vowel quality. Recorded so it is not later re-quoted
as corroboration.

Two things are NOT spent: `⟨a⟩→a`, which epitran corroborates independently at 100%, and every consonant in
the language, which no part of this touched.

## Run 10 — 2026-08-20 — applied, and verified end-to-end

**Change.** `sepedi.jsonc`: `a→a`, `e→e`, `o→o`. `ê→ɛ` and `ô→ɔ` were already correct and are now the only
source of the open-mid vowels — which is what the circumflex is FOR in Northern Sotho orthography. The old
table gave the unmarked letter the marked value and left ⟨ê⟩/⟨ô⟩ with nothing to distinguish.

**Command.** Re-phonemize all 1,990 utterances through the real engine (`phonemize(text,"nso")`, using
`read_text` where present) and score against the stored recognizer output.

**Raw finding.**

```
                    median    mean
before              0.6647   0.6700
substitution proxy  0.2763   0.2893     (run 7's prediction)
END-TO-END          0.2763   0.2893     exact match
p10 0.1835   p90 0.4118
```

**nso goes from 102nd of 102 scored languages to 30th.**

**Implication.** The proxy was faithful — no normalisation path or grapheme interaction changed the result,
so run 7's sweep can be trusted for the other variants it scored.

### What the residual is now

```
 4913  10.3%  e -> i          <- the unmodelled height alternation
 2786   5.8%  o -> u          <-   "
 2518   5.3%  t -> d
 1924   4.0%  x -> r
 1820   3.8%  ʃ -> ʒ
 1805   3.8%  b -> v
 1737   3.6%  k -> ɡ
 1473   3.1%  ʃ -> s
```

Before the fix, three vowel symbols were 92.7% of all substitutions and nothing else was visible. The
height alternation is now the largest item at 16.1% combined, and behind it sits a legible consonant queue
— intervocalic voicing (t→d, k→ɡ, p→b), ⟨b⟩ realised [β]~[v], ⟨g⟩ [x] vs something rhotic, and the ⟨š⟩
sibilant. None of these were investigable before; all are now.

### Not done, deliberately

- **`st` (Sesotho)** shares the old table (`ɑ ɛ ɔ`) and has no audio and no referee. Its ⟨a⟩→[ɑ] is wrong on
  the same family-wide grounds, but changing it here would be inference dressed as measurement. It needs
  its own evidence and its own commit.
- **`tn` (Setswana)** keeps `a ɪ ʊ`. Its epitran referee is floored at 0.98 only because `tn.jsonc` folds
  `[ɛɪ]→e` and `[ɔʊ]→o` — the fold collapses the axis in dispute, so that 0.98 says nothing about vowels.
  Reopening it is the prerequisite for measuring Setswana at all.
- **The corpus DB was not rewritten.** `align.sqlite` still holds the old nso `ipa` and `dist`. Refreshing
  it is `phonemize-fleurs.mts nso_za` → `asr_align_report.py`, and the README is explicit that the label
  step is order-sensitive ("sweep before label, never after"), so it is left to the corpus owner.
