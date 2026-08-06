# Khmer second-tier lexicon — an independent dictionary, and the estimate that was 7x too optimistic

## Run 1 — 2026-08-05 21:00 · the phone mapping, derived rather than guessed

google/language-resources' `km/data/lexicon.tsv` is 69,405 entries under CC BY 4.0, against our 2,822-entry
exceptions lexicon. Its phone inventory is 54 symbols and is not ours, so the first question is whether it can be
converted at all. A naive strip-the-spaces conversion reproduced our IPA on **179 of 2,250** overlapping words
(8.0%).

Iterating — apply a mapping, print the commonest remaining divergence at the first differing character, extend:

| round | exact | folded backbone |
|---|---|---|
| naive | 8.0% | — |
| + aspiration digraphs, vowel-length doubling, centering diphthongs | 23.4% | 57.7% |
| + positional `w` | 24.0% | 58.2% |

⚠ **`w` IS POSITIONAL** — ʋ as an onset, w as a coda (ʋit, but ʔəw). A flat `w→ʋ` mapping turned every coda into
ʋ and accounted for 8 of the top divergences.

⚠ **AND THE METRIC HAD TO CHANGE.** Chasing exact-string agreement with our own lexicon was chasing notation: the
`eək`/`eəʔ` and `a`/`ɑ` differences are things the project's own referee folds already treat as equivalent. Scored
on the folded backbone the same mapping reads 58.2% rather than 24.0%. Measuring against **our own file** was the
deeper mistake — it can only reveal drift between two of our artifacts. The metric that matters is agreement with
wikipron, the independent human source.

Ten further candidate mappings were tried against that metric and **nine made it worse** — ɓ→p −419, ie→ei −411,
ɗ→t −261 — which is the evidence that the residual is genuine disagreement between two independent sources about
Khmer vowel realisation, not a notation gap still to close. The mapping is 18 entries plus the positional rule.

## Run 2 — 2026-08-05 21:05 · the estimate was 7x too optimistic, and the reason matters

The first framing was: our lexicon covers 14.7% of running-text tokens, the dictionary would cover 60.4%, so a 4x
improvement. **That was wrong, and the error was conceptual rather than arithmetic.**

`km-lexicon.tsv` is an **EXCEPTIONS** lexicon — its own header says "for the RULE-UNPREDICTABLE residual". It was
mined by taking the words where the rules DISAGREE with wikipron. The consequence is easy to miss and decides the
whole design: **for any referee word absent from it, the rules already match wikipron by construction.**

Measured, and this is what a naive merge would have done:

    referee words in the dictionary but NOT in our exceptions lexicon: 3,486
      the rules today          3486/3486 = 100.0%
      converted dictionary     3071/3486 =  88.1%   ← a 12pp REGRESSION

The dictionary can only help where no human transcription exists at all. Decomposing running text by the evidence
actually available for each token:

    14.7%  in our exceptions lexicon (wikipron-verified)      → unchanged
    37.6%  a referee word not in it (wikipron says rules OK)  → unchanged, and must STAY that way
     8.7%  NO wikipron, but the dictionary has it             → the only reachable population
    38.9%  nothing anywhere                                   → rules, unverified

**8.7%, not 60.4%.** The 100%-vs-88.1% comparison is the whole argument for excluding referee words, and it only
appeared because the measurement was split by which evidence exists rather than run over the merged whole.

## Run 3 — 2026-08-05 21:15 · what it is worth, and what cannot be measured

On the population where a comparison is possible — the 5,734 referee words the dictionary covers:

    the rules            3629/5734 = 63.3%
    converted dictionary 4491/5734 = 78.3%   ← +15pp against the same human gold

⚠ **AND THE SHIPPED CHANGE IS THEREFORE UNMEASURABLE ON AVAILABLE GOLD, BY CONSTRUCTION.** Every word that could
be scored was excluded precisely because scoring showed the rules already right. What ships affects only words with
no human transcription, and the +15pp above is a transfer argument from the measurable population, not a measurement
of the shipped behaviour. That is the honest status: a reasoned bet, and the reasoning is checkable even though the
outcome is not.

The referee eval is unchanged at 48.0% / 56.0% / 81.9%, exactly as it must be — `phonemizeWordRules` reads neither
lexicon, which is what keeps the km referee non-circular. Lexicon coverage of running text goes **14.7% → 23.4%**,
the predicted +8.7pp.

56,356 entries ship (69,405 upstream, minus 5,737 already settled by wikipron or the exceptions lexicon and 7,091
non-Khmer rows — the upstream file is a TTS dictionary carrying Latin names and digits). 2.0 MB, in line with the
2.3 MB int8 segmenter already shipped.

**One concrete case, from a test that broke.** `អាមេរិក` ("America") is *a-me-rik*; the rule engine gave
`ʔaːmeːrək` with a schwa. Neither wikipron nor the exceptions lexicon covers the word — it is exactly the
population this file exists for — and the dictionary supplies `ʔaːmeːrik`. The failing assertion was the
intervention working.

**Left open:** the 38.9% of tokens with no evidence anywhere remain rule-read and unverified. Nothing here touches
them, and no available source would.
