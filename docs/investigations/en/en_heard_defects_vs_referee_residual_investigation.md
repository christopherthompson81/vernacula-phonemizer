# en — what the referee residual indicates, and why it is not what the TTS reads surface

The defects reported over the last stretch came from **listening to TTS output**, not from any gate. That
raises a question worth measuring rather than assuming: does the referee eval's residual point at the
same thing the ear does?

## Run 1 — 2026-09-22 — the reported defects, by layer

Eleven issues were filed from heard defects (#1421–#1437). Classified by the layer that produced them:

| layer | issues | count |
|---|---|---|
| **normalization** (text → words) | #1421 postal codes, #1423 `(a)` list markers, #1424 `CoCr`, #1427 `µin`, #1430 `re-`, #1434 `40°26′46″N`, #1435 `0.015″`, #1437 `.5 kg` | **8** |
| **neural OOV prosody** | #1428 `profilometry`, #1431 `superalloy` | 2 |
| **lexicon routing** | #1422 `TSO` (`isRecorded` hands an all-caps token to the dictionary) | 1 |
| **word → IPA accuracy, which is what the referee eval measures** | — | **0** |

## Run 2 — the corpus cannot express eight of them, and does not contain the other three

The en primary referee is `en.wikipron-eng-latn-us-broad.tsv`, 4,558 headwords:

```
contain a DIGIT                    0   0.00%
contain whitespace (multi-word)    0   0.00%
non-letter beyond - and '          0   0.00%   (the 866 "uppercase" rows are capitalised proper nouns)
```

⚠ **EVERY NORMALIZATION DEFECT NEEDS A DIGIT, A SYMBOL, PUNCTUATION OR A SECOND TOKEN, AND THE CORPUS
HAS NONE OF THOSE.** The eval calls `phonemizeEnNeural(w)` on a bare citation word; `text()` does run the
normalizer, but on a single lowercase word the normalizer has nothing to do. The eval already says so on
every run, about a different hazard:

```
product delta: 0/289 compared rows read differently by phonemize() — identical here, which is NOT
evidence the product-only steps ran: normalize and makeNativiser are simply no-ops on most citation
forms, and that silence is where #1131 hid
```

And the three defects that *are* word-shaped are not in the corpus either:

```
tso  superalloy  superalloys  profilometry  profilometer  cocr  re-machined  →  referee rows: 0
```

**The referee eval could not have caught one of the eleven.** That is a statement about coverage, not
about the eval being wrong: it measures word→IPA accuracy faithfully and that is a real axis. It is
simply orthogonal to the axis the ear has been finding defects on.

## Run 3 — so what DOES the residual indicate?

⚠ **THE FIRST TWO ATTEMPTS AT THIS MEASUREMENT WERE BOTH WRONG, IN WAYS WORTH RECORDING.**

1. I scored the raw file — 4,558 rows — where the eval scores 4,037, because I had not applied the
   referee's `excludeRows`. Every rate computed that way was inflated by 521 rows the eval already knows
   do not belong to the variety.
2. Applying them naively excluded only **328**. The referee stores one SPACE-SEPARATED phoneme per
   position, so `əʊ` is written `ə ʊ` and an exclusion pattern spelled the way a reader writes IPA
   matches nothing. **`eval.ts` documents this exact trap in a comment** — "that under-excluded by 190
   rows while looking like it worked" — and I reproduced it, off by 193.
3. I then read the "sample" off the head of an alphabetically sorted list, which showed nothing but
   `ab-`/`ac-` words and would have made any class look alphabetically clustered.

With the join fixed the replication matches the eval exactly (**4,037 scored, 1,454 misses, 64.0%**), and
the composition is:

```
weak-vowel slot only (ə~ɪ~i~ᵻ)        267  18.4%
first-vowel full vs reduced           309  21.3%
syllabic consonant notation (ən~n)     54   3.7%
  ANY of those three NOTATION classes 363  25.0%

proper-noun headword                  359  24.7%
OOV (not in the lexicon at all)       931  64.0%

lowercase, in-dict, NOT notational    228  15.7%   <- the part that is squarely ours
```

⚠ **AND EVEN THAT 228 IS NOT CLEAN.** A random sample of it still carries referee noise: `theism tiɪzəm`
(no /θ/), `cambium keəmbiəm` and `here hiəɹ` (RP SQUARE/NEAR that the exclusion did not reach), `biscuit
bɪskeʈ` (a retroflex stop). The genuine content is cot–caught (`prong`, `naughty`), yod (`neume`,
`newness`), and stress/vowel-quality one-offs (`mimetic`, `vermiculate`, `confidant`).

**So the residual indicates: notation disagreements (25%), the rare/proper/foreign OOV tail (64%), and a
few hundred real single-segment lexicon disagreements.** It is the same "REFEREE-NOISE-LIMITED" character
`test/referee-eval-english.test.ts` already records for the headline.

## What follows

The two instruments answer different questions and neither substitutes for the other:

- the referee eval measures **word → IPA** on citation forms, and its residual is dominated by notation
  and by a tail the OOV tier exists for;
- the defects a listener finds are overwhelmingly **text → words**, which no wordlist referee can reach.

⚠ **THE GAP IS NOT A MISSING NUMBER, IT IS A MISSING CORPUS.** There is no gate anywhere that takes
REALISTIC TEXT — digits, units, symbols, initialisms, list markers, mixed case — and checks how it is
read. `test/english-reported-misreadings.test.ts` is the closest thing, and it is a regression pin
built from defects already found, so it can only ever hold ground; it cannot find any. Every one of the
eleven was found by a human listening.

That is the actionable conclusion: **a normalization corpus, not another lexicon sweep.**
