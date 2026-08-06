# Khmer independent vowels — a whole letter class the syllabifier deleted (#670)

## Run 1 — 2026-08-05 20:35 · the issue understated the defect by an order of magnitude

#670 was filed for one letter — `ឬ` dropped before a consonant, "up to 13,686 sites" — found while sourcing the ±
reading. Probing all 17 independent vowels (U+17A3–U+17B3) instead:

    char  alone      +ក      +ដក      dropped?
     ឣ    ឣ          kɑː     ɗɑːk     ⚠ YES     … and the same for all seventeen

**Every independent vowel was deleted, and none was phonemized even alone** — `phonemizeWordRules("ឬ")` returned
the character itself. The standalone case looked fine only because `km-lexicon.tsv` covers 8 of the letters and
`phonemizeWord` is lexicon-first; the rule engine had nothing.

Root cause, and the code was honest about it — `khmer.ts` PASS 1:

    if (!(c in DEF.consonants)) { i += 1; continue; } // independent vowels / stray marks — skip (Phase 1)

A deliberate deferral that was never completed. Scope, measured with the new `count.ts` helper:

    all 17 letters: 176,282 corpus occurrences · 103,144 followed by a consonant
    6.0% of all Khmer-letter tokens (165,743 of 2,775,601) contain one

Not 13,686. The issue named the tip of it.

## Run 2 — 2026-08-05 20:40 · sourcing 17 readings from three independent sources

This is the dictionary-aware sourcing the previous session flagged as missing, and it was necessary: `ឬ` has ZERO
word-initial dictionary entries because it is itself a word.

**Method.** For each letter, take every dictionary word that BEGINS with it, read the first syllable, and strip a
trailing coda consonant — the coda belongs to the FOLLOWING letter, not the vowel. Cross-check against wikipron's
human transcriptions and our own `km-lexicon.tsv`.

⚠ **A first pass stripped `j` and `w` as codas** and turned `ឦ` (ʔəj) into ʔə and `ឪ` (ʔəw) into ʔə. They are
diphthong OFF-GLIDES, not codas. Caught because the derived value disagreed with two sources that agreed with each
other — which is the whole reason for cross-checking.

All three sources agree on every one of the eight letters they share. Coverage:

| basis | letters |
|---|---|
| dictionary word-initial, n=6..239 | ឣ ឤ ឥ ឦ ឧ ឩ ឪ ឫ ឮ ឯ ឰ ឱ ឳ |
| dictionary ×3 + wikipron ×2, in រឭក / រំឭក | ឭ (lɨ) |
| lexicon + wikipron + dictionary single-letter | ឬ (rɨː) |
| dictionary single-letter, allograph of ឱ | ឲ (ʔao) |
| ⚠ thin — single-letter entry only, 1 corpus occurrence | ឨ |

`ឭ` looked unattested at first and would have been filled from the series pattern (ឫ rɨ / ឬ rɨː / ឭ lɨ / ឮ lɨː).
Searching all three sources for the letter ANYWHERE rather than word-initially found `រឭក` and `រំឭក` in both the
dictionary and wikipron, agreeing on `lɨ` — the pattern was right, but it is now attested rather than inferred.

⚠ **THE STANDALONE AND IN-WORD READINGS DIFFER.** `ឧ` is ʔoʔ as a word (lexicon and wikipron agree) and ʔu inside
one (ឧត្តម ʔutɗɑm). The table carries the IN-WORD value because that is the context the rule engine is consulted
in; the lexicon already owns the standalone forms, so production gets both right. A future editor "correcting" the
table to ʔoʔ would break every word beginning in ឧ.

## Run 3 — 2026-08-05 20:45 · implementation, and why the coda matters

An independent vowel is a whole syllable with no onset LETTER, so it becomes a `Unit` carrying its literal IPA.

⚠ **It also has to be able to take a coda.** The dictionary transcribes ឥណ្ឌា as `ʔ ə n . ɗ i ə` — the ណ closes the
vowel's syllable. Coda assignment asks `prev.vs !== null` ("does the previous syllable have a WRITTEN vowel"), and
an independent vowel's vowel IS written — as the letter — so the unit carries a sentinel `vs`. With `vs: null` the
rule declined and ឥណ្ឌា came out *ʔə.ɗiə*, dropping the ណ. With it: **ʔənɗiə**, matching the dictionary exactly, as
do `រឭក` → rɔlɨk and `រំឭក` → rumlɨk.

## Run 4 — 2026-08-05 20:50 · measured against 7,108 human transcriptions

Clean A/B (the table emptied to reproduce the old skip exactly — removing the key crashes, since the code indexes
it directly):

| | before | after |
|---|---|---|
| raw exact | 3,347 / 7,108 (47.1%) | **3,411 (48.0%)** |
| folded backbone | 3,910 (55.0%) | **3,980 (56.0%)** |
| symbol accuracy | 80.8% | **81.9%** |

⚠ **The +1pp headline badly understates it.** Only 254 of the 7,108 referee words (3.6%) contain an independent
vowel. On that subset:

    before   0 / 254   =  0.0%
    after   70 / 254   = 27.6%

**Zero.** Not "poor accuracy on a hard class" — every single one wrong, because a character was missing from the
output. And of the 184 that still disagree, **133 (72%) now begin correctly**: the vowel is right and the residue is
ordinary Khmer difficulty in the rest of the word (Sanskrit/Pali clusters — `ʔahsʋarɨʔ` for `អស្វឫទ្ធិ`).

The referee under-represents the class relative to running text: 3.6% of its words against 6.0% of corpus tokens.

## Consequences elsewhere

`ឬដក` reads *rɨː ɗɑːk* again, so the ± rule's spaced emission and the segmenter's independent-vowel exception are
no longer propping up a g2p defect. Both notes are corrected: the exception stays because independent vowels ARE
words and splitting them is correct, not because a reading depends on it. That is the right relationship between a
segmenter and a g2p, and it was worth un-tangling.

**Still open:** the 184 residual disagreements are cluster/loanword problems in the rest of the word, unrelated to
this class. `ឨ`'s reading rests on one dictionary entry and one corpus occurrence.

## Run 5 — 2026-08-05 21:05 · review, and the shape the change nearly broke silently

Reviewing the change found two things worth recording and one worth pinning.

**⚠ 55,417 corpus sequences put a COENG directly after an independent vowel, and 98% of them are one word.**
`ឲ្យ`/`ឱ្យ` ("to give/let") is 54,491 occurrences. An independent vowel cannot carry a subscript, so the coeng
falls through PASS 1 as an unrecognised mark and the ⟨យ⟩ becomes the vowel-syllable's CODA by the
trailing-bare-unit rule — giving ʔaoj, which is correct. `ឲ្យ` and `ឲយ` read identically, which is how the
mechanism was confirmed.

It works, and it works **by omission rather than by an explicit branch**: nothing in the code says "a coeng after an
independent vowel is skipped", so the commonest word in the language depends on a fall-through. Now documented in
PASS 1 and pinned by a test. Had the review not looked at what those 55,417 sequences actually were, this would
have been correct-by-accident and one refactor from silently wrong.

**⚠ `ឣ្នក` is a typo, not a word — 462 corpus lines.** U+17A3 ឣ and U+17A2 អ are near-identical glyphs and writers
confuse them, writing ឣ្នក for អ្នក ("person"). Reading it as ʔɑn… is what the letters say. A g2p should not
silently repair a misspelling, and the reading is phonetically close anyway; noted so nobody "fixes" it.

**Crash-path audit.** The unit for an independent vowel has an EMPTY `ons` and a sentinel `vs`, either of which
would throw at `DEF.consonants[unit.ons[unit.ons.length - 1]!]` or `DEF.vowels[unit.vs]!`. Both are unreachable
only because PASS 3 emits `iv` units and `continue`s before the onset/series logic. Checked every `.vs` and `.ons`
consumer: all four PASS 2 rules exclude an `iv` unit as the coda PROVIDER (they require `vs === null` or
`ons.length >= 2`) while admitting it as the coda RECEIVER, which is exactly what is wanted. The
all-17-letters test exercises the path, so removing that `continue` fails the suite rather than throwing in
production.

**Left as known variability:** `ឥ` is genuinely ʔə / ʔi / ʔəj depending on the word (wikipron 30 / 18 / 7,
dictionary 107 / — / 15). A single-value rule table takes the majority and the lexicon carries the exceptions —
`ឥឡូវ` is ʔəjləw in both the lexicon and the dictionary while the rule path gives ʔəlouw. That is the correct
division of labour, not a defect in the table.
