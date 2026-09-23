# en — looking for a fourth independent English pronunciation source

Moby Pronunciator II was the last big arbiter win: a third opinion independent of both CMUdict (our
lexicon) and Wiktionary (our referee), which settled ~2,000 dictionary corrections. This asks whether a
FOURTH such source exists.

The bar an arbiter has to clear here is two-part, and both halves are hard:

1. **Independent** of CMUdict and of Wiktionary — a source derived from either is a mirror, and will
   confirm our own errors. `data/LICENSES/PROVENANCE.md` already records epitran as circular for exactly
   this reason ("itself CMU-derived").
2. **Licence-compatible with an MIT repo.** Moby clears it as public domain by explicit grant; espeak-ng
   does not and is consulted-only behind a GPL fence.

## Run 1 — 2026-09-22 — candidates screened

| candidate | size | independent of CMU + Wiktionary? | licence | verdict |
|---|---|---|---|---|
| **ISLEdict** (Illinois) | ~300k | ⚠ **No** — "culled from open-source dictionaries including CMUdict and Moby" | MIT | circular with BOTH existing arbiters |
| **MFA** `english_us_mfa` | 61k | ⚠ **No** — v3 dictionaries "largely sourced from WikiPron" | CC BY 4.0 | circular with the primary referee |
| **Britfone** | 16k | ⚠ **No** — "from cmudict, supplemented by Wiktionary, Collins, Oxford…" | unstated | circular, and British |
| **VoiceGarden** lexicons | 124k | ⚠ **No** — English bundle is **gruut**, itself CMUdict-derived; the alternate bundle IS CMUdict | Apache-2.0 / MIT | circular |
| **NETtalk** (Sejnowski & Rosenberg) | 20,008 | ✅ **Yes** — Webster's Pocket Dictionary, 1974 | ⚠ **non-commercial only** — see below | **blocked on licence** |
| **Webster's 1913** via Project Gutenberg | ~100k | ✅ **Yes** | **public domain** | viable, with two large caveats |
| **GCIDE** (same text, GNU edition) | ~100k | Yes | **GPL-3.0** | same fence as espeak-ng |

### ⚠ THE UCI DATASET PAGE AND THE DATA FILE DISAGREE ABOUT NETtalk'S LICENCE

UCI's page states: *"This dataset is licensed under a Creative Commons Attribution 4.0 International
(CC BY 4.0) license."* The header of `nettalk.data` itself says:

```
                Copyright (C) 1988 by Terrence J. Sejnowski

Permission is hereby given to use the included data for non-commercial
research purposes.  Contact The Johns Hopkins University, Cognitive Science
Center, Baltimore MD, USA for information on commercial use.
```

**UCI applied a blanket archive licence over a file whose own copyright notice contradicts it.** This
repo is MIT, so a non-commercial restriction is disqualifying — not merely for shipping bytes, but for
deriving corrections from it, since the corrections would be a derived work.

⚠ **AND THE DATASET PAGE IS WHAT A SEARCH RETURNS.** Had the licence been taken from the landing page
the incompatibility would have surfaced after the conversion work, not before. Reading the file's own
header was the cheap check; it is the same shape as this repo's standing rule that a comment claiming a
property is a claim to verify.

That is a real loss: NETtalk is a genuinely independent human transcription with **stress AND syllable
structure**, from a lexicographic tradition (Merriam-Webster) that touches neither of our sources.

## What is left, and whether it is worth it

**Webster's 1913 via Project Gutenberg is the only remaining source that is both independent and
open.** Two caveats, and neither is small:

- ⚠ **The pronunciation is diacritical RESPELLING, not IPA** (`ā ĕ ĭ ō`), so it needs a conversion layer
  built and validated before it can arbitrate anything — the work Moby did not require.
- ⚠ **Its answers are 110 years old.** It predates the cot–caught merger's spread and records stress and
  vowel qualities that have since moved. On a disagreement we could not separate "we are wrong" from
  "1913 is old", which is precisely the property an arbiter must have.

## ⚠ AND THE AXIS ITSELF IS AT DIMINISHING RETURNS

`en_heard_defects_vs_referee_residual_investigation.md` measured the current residual: of 1,454 primary
misses, 25% are notation classes, 64% are the rare/proper/foreign OOV tail, and **228 (15.7%) are
lowercase, in-dict and not notational** — the part a new arbiter could act on, and even that sample
still carries referee noise (`theism tiɪzəm`, `here hiəɹ`, `biscuit bɪskeʈ`).

**More to the point: a fourth pronunciation dictionary would not have caught one of the eleven defects
reported from listening.** Eight were normalization (digits, symbols, punctuation, multi-token), two
were neural OOV prosody, one was lexicon routing. Zero were word→IPA accuracy. Moby's ~2,000 corrections
were a real win on an axis that was then far from exhausted; that axis is now noise-limited, and it is
not the axis the ear is finding.

**Recommendation:** do not build the Webster's 1913 converter to chase the lexicon residual. If a fourth
opinion is wanted later for a specific question — a stress class, a yod class — Webster's is there and
free, and the conversion can be scoped to just that class rather than to the whole dictionary.

## Run 2 — 2026-09-22 — the existing three are NOT exhausted; here is the measured headroom

The conclusion above ("no fourth source") is not the same as "nothing left to arbitrate". Measured against
what we already hold:

### Coverage — how often a second opinion exists at all

```
lexicon headwords                                    142,767
  BOTH Moby and us_gold have an opinion               25,659   18.0%   <- 2-of-3 arbitration possible
  only Moby                                            9,345    6.5%
  only us_gold                                        23,873   16.7%
  neither — no second opinion exists                  83,890   58.8%
```

### Track 1 — the selection rule that produced the last ~2,000, re-run today

`tools/english/en_source_compare.mts` already implements it and is current:

```
triple-sourced words (dict ∩ gold ∩ moby): 46,057
  all three agree:                37,658  81.8%
  gold AND Moby agree AGAINST us:    582   1.3%   <- the candidate set
  split / no majority:             7,817  17.0%
```

The 582, by frequency band: **top-1k 3 · 1k–5k 13 · 5k–20k 85 · 20k–40k 125 · off-list 356.** So
**226 sit inside the 40k frequency list** and 356 are rare vocabulary.

By disagreement shape:

```
2 slots differ                165      ONE slot: OW->AH   25      IH->IY  25
length differs (± a segment)   80      ONE slot: AY->AH   23      IY->AH  16
3 slots differ                 39      ONE slot: AA->AH   14      AA->AE  12
```

⚠ **EXPECT A LOWER HIT RATE THAN #1334–#1341.** Those ~2,000 were the easy majority; these 582 are what
survives 89 runs of Moby auditing. The multi-slot and length-differing rows (284 of 582, 49%) are mostly
whole-word disagreements — a different word, a different stress pattern — not single-segment fixes.

### Track 2 — the 7,817 splits, sliced by CLASS rather than by word

Where gold and Moby disagree there is no arbiter, so no word in this set can be settled by vote. But the
tool already names three classes inside it that are *never* a defect (source geminate 21, iə/jə
compression 9, NG G / N G 4). **Mining the split set for more such classes is the higher-ceiling track**:
each one found either removes noise from every future sweep or names a real systematic rule. It is also
the riskier one — it produces rules, and this repo's record is that the linguistically obvious rule
measures net negative.

### Track 3 — espeak-ng against REALISTIC TEXT, which is the axis the ear is on

`tools/normalization/sources.ts --lang en` reports the vocabulary classes as almost entirely sourced —
letter names, decimal point, scale names, percent, minus/times/plus/ampersand/exponent all `[ok]`. **That
is the wrong question for these defects.** Nothing there was missing vocabulary; the eleven were missing
PATTERNS — a unit after a symbol, a bracketed list marker, an all-caps token routed to the dictionary.

espeak-ng's binary is refused as evidence about a WORD (§5.1 — its letter-to-sound rules are a G2P guess).
⚠ **But its number/unit/symbol expansion is a different subsystem from its letter-to-sound rules**, and
the provenance already permits the binary as a **SEARCH step**. Using it as a DIFFERENTIAL DETECTOR over
realistic text — flag where our normalizer's word output differs, adjudicate every hit by hand — is
inside the existing rule and is how several of the eleven were actually found this session.

The blocker is the corpus, not the instrument: the real text is day-job documents that cannot come near
this repo. It has to be a SYNTHETIC corpus covering the SHAPES (measurement + unit + symbol, ranges,
enumerated lists, initialisms, alphanumeric codes, coordinates) with no real content.

### Recommendation

Track 3 is the only one that addresses what is being heard; Track 1 is the cheapest and most certain;
Track 2 has the highest ceiling and the highest risk. Track 1 and Track 3 are independent and can be
done in either order.

## Run 3 — 2026-09-22 — Track 3 built, and the espeak design was replaced before it was written

Track 3 was chosen. The plan was espeak-ng as a differential oracle over a synthetic shape corpus. **The
first measurement killed that design**, which is why it is recorded rather than quietly dropped:

```
                        ours                             espeak-ng en-us
(a) first item          ˈeᶦ , fˈɝst ˈaᶦt̬əm              ɐ fˈɜːst ˈaɪɾəm      ← the ARTICLE (#1423's defect)
Tolerance is 5 µin.     … mˈaᶦkɹoᶷˌɪnt͡ʃəz               … mˈaɪkɹoʊ ˈaɪ ˈɛn   ← "micro I N"
The CoCr implant.       kʰˈoᶷbˌɔːɫt kɹˈoᶷmiʲəm          kˈoʊ sˌiːˈɑːɹ        ← "co C R"
```

⚠ **espeak IS WRONG ON MOST OF THE SHAPES THIS CLASS IS ABOUT**, including three defects we have already
fixed. As an oracle it would have flagged our CORRECT behaviour as the divergence, and the hand
adjudication would have been mostly "espeak is wrong again". A detector whose disagreements are usually
the detector's fault is not worth the licence question it costs.

### What replaced it: two checks that need no second system

- **EQUIVALENCE** — two spellings of the same thing must normalize identically. `0.015"` and `0.015″` are
  the same measurement. Nothing external is needed to know that.
- **SURVIVAL** — a symbol the normalizer claims to handle must not still be in the output.

⚠ **AND THE ASCII MEMBER OF EACH PAIR IS WHERE THE DEFECT LIVES, WHICH IS THE GENERALISABLE PART.** A
defect gets reported when a person hears it, and the person who reports `0.015″` has pasted from a
typeset document. The ASCII spelling is what keyboards produce, is far more common, and produces the same
wrong reading — so fixing the reported spelling leaves the larger half untouched. #1434, #1435 and #1427
were each fixed on the typographic spelling only.

`tools/normalization/en-shape-equivalence.mts` + `en-shape-corpus.tsv`: **24 rows, 12 failing on the
first run.** Three issues filed:

| # | defect | why it is bad |
|---|---|---|
| **#1448** | Greek letters read as MODERN GREEK — 24 letters, **7 emit `ɣ`/`ɾ`/`ç`, phones `english.jsonc` does not declare** | a foreign-phoneme leak; a Kokoro backend REFUSES a stream with an unknown symbol, so one `ɣ` kills the utterance |
| **#1449** | ASCII `"`/`'` prime units — `0.015"` **silently drops the unit**, `6' 2"` reads "six two" | the drop produces a fluent, complete, wrong sentence |
| **#1450** | ASCII micro prefix — `5 um` reads as the filler **"um"**, `5 us` as the pronoun **"us"** | ⚠ sounds like DISFLUENCY, not like an error, so a listener never reports it |

### ⚠ THE COMMON SHAPE ACROSS ALL THREE, AND THE REASON THIS AXIS STAYED INVISIBLE

Every one of them **produces a plausible English utterance**. `0.015"` reads as a bare number; `5 um`
reads as a hesitation; `TSO` read as a word. None of them sounds like a bug — they sound like the TTS
being a bit odd. That is why eleven of these needed a human listening to find, and why a *referee* over
citation words was never going to: the failure is not a wrong phoneme, it is a **right-sounding wrong
sentence**.

The probe exits 0 even when failing. It is a queue to read, not a gate to go green; a class graduates
into `test/english-reported-misreadings.test.ts`, which IS a gate, once it is settled.
