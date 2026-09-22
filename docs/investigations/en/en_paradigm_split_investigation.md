# en: paradigm-internal disagreement in g2p-dict.tsv (#1387)

`g2p-dict.tsv` gives one lemma two incompatible readings, split by which rows CMUdict happened to carry.
A sentence containing both then says the word two ways — the same shape as the `clerk`/`clerks` split
#1385 treated as a blocker for en-GB.

## Run 1 — 2026-09-22 — adjudicate `buoy` against every source before touching it

    CMUdict   buoy B UW1 IY0   buoys B UW1 IY0 Z   buoyed B UW1 IY0 D   buoying B OY1 IH0 NG  ←
                                                   buoyant B OY1 AH0 N T   buoyancy B OY1 AH0 N S IY0

    Moby      buoy 'b/u//i/   buoyage 'b/u//i//I//dZ/   buoy_boat   buoy-tender
              buoyant '/Oi//@/nt   buoyantly   buoyancy   buoyancy_force
    wikipron UK   buoy bɔɪ   buoyed bɔɪd   buoyant bɔɪənt   buoyancy bɔɪənsi
    espeak en-us  bˈɔɪ bˈɔɪz bˈɔɪd bˈɔɪɪŋ bˈɔɪənt bˈɔɪənsi

⚠ **THE DERIVATIONAL SPLIT IS REAL AND INDEPENDENTLY CORROBORATED, SO IT STAYS.** Moby has /buːi/ for
`buoy`, `buoyage`, `buoy_boat` and `buoy-tender`, and /bɔɪ/ for every `buoyant`/`buoyancy` compound —
the identical division CMUdict draws. English routinely shifts a vowel across a derivational suffix and
this is a textbook case, so a sweep that "fixed" `buoyant` would be reporting English, not a defect.

⚠ **AND THE ONE SOURCE THAT CONTRADICTS `buoying` CONTRADICTS THE WHOLE PARADIGM, SO IT CANNOT ADJUDICATE
AN INTERNAL SPLIT.** espeak reads *every* form with /bɔɪ/, including the lemma — it simply does not carry
the American noun reading that CMUdict and Moby agree on. Its disagreement is evidence about the lemma
(where we follow two sources against it), not about which inflection is the outlier.

So: `buoying` is the lone **inflectional** outlier against its own paradigm's majority, and the fix is one
row — `B OY1 IH0 NG → B UW1 IY0 IH0 NG`, via the curated layer, because `--emit` regenerates the dict.
`en_rebuild_lexicon.mts --diff` then reported **exactly 1 row would change**.

The result matches the engine's regular hiatus treatment, which is the check that it is not a special case:

    seeing sˈiːʲɪŋ   freeing fɹˈiːʲɪŋ   buoying bˈuːiʲɪŋ

### ⚠ AND FIXING IT SPLIT THE en-GB PARADIGM, BECAUSE THE OLD REFUSAL RESTED ON THE ACCIDENT

`en-gb-lexical.PROVENANCE.md` refused a `buoying` row with: *"the parent is self-inconsistent … It also
already produces the British reading."* Both halves were true, and **the second is why nobody looked
further: the word was WRONG in `en` and accidentally RIGHT in en-GB, so the British side had no symptom.**
Fixing the parent removed the accident, and en-GB immediately read `bˈuːiɪŋ` beside `bˈɔᶦ`. The row exists
now, entailed in the ordinary way, and the old note is kept struck through rather than deleted.

**A refusal justified by an accident elsewhere does not survive the accident being fixed, and nothing
would have told us.**

## Run 2 — 2026-09-22 — the sweep the issue asked for, and what it actually finds

`tools/english/en_paradigm_audit.mts`, over all 135,314 dictionary words. It works backwards from the
inflection, like the en-GB audit, and shares its suffix list so the two cannot drift.

    ⚠ INFLECTIONS WHOSE PHONE SKELETON IS NOT THE LEMMA'S PLUS A SUFFIX: 1780
       PREFIX (unstressed vowels only — #1397's class, wider)  356
       LOT/THOUGHT (AA~AO only — the curated layer's class)     161
       VOICING (S~Z, F~V, TH~DH only — noun/verb pairs)         84
       SHORTER (the inflection is shorter than the lemma)      12
       ⚠ OTHER (a consonant or a STRESSED vowel differs)       1167

⚠ **THESE NUMBERS ARE OF THIS TREE AND MOVE WITH THE DICTIONARY.** An earlier draft of this log recorded
1777/993 and did not reproduce on the committed tree, because the `buoying` fix in the same commit removed
one row from the sweep. A logged count that disagrees with the command printed beside it is worse than no
count, so: measured after the fix, on the tree this file ships in.

### ⚠ THE RAW COUNT WAS 2,932 AND TWO OF MY OWN BUGS ACCOUNTED FOR MOST OF IT

- **Taking the first dictionary-backed candidate as the lemma** — which is what the en-GB audit does,
  because a set membership disambiguates there — reported `ach` as the lemma of `aching`, `abid` of
  `abided`, `abe` of `abed`, `adam` of `adames`. All are real dictionary words and none is the lemma.
  Here nothing disambiguates but the phonology, so the phonology has to: a word is flagged only when NO
  candidate's skeleton is a prefix of it.
- **`AH0` and `IH0` are one slot**, and CMUdict spells the same unstressed vowel both ways *within* a
  paradigm (`abdicate AH0 K` beside `abdicating IH0 K`). Unfolded it drowned the signal.

## Run 3 — 2026-09-22 — review round: the classifier broke its own stated rule

### ⚠ THERE WAS A `STRESS` CLASS AND IT WAS WRONG IN BOTH DIRECTIONS AT ONCE

It ended `return stressDiffers ? "STRESS" : "OTHER"` — a line only REACHED once a real segment difference
had been found. So it could never hold what it was named for, and it captured **182 rows that belong in
OTHER and hid them from the listing**: `antipode OW2` against `antipodes AH0`, `ambon AA0` against
`ambones OW1`. Meanwhile a row differing ONLY in stress never reaches the classifier at all, because the
skeleton strips the digits before the prefix test clears it — so the bucket was also empty by
construction.

⚠ **THAT IS THE "a defect gets filed under a heading and stops being looked at" FAILURE, COMMITTED IN THE
FUNCTION THAT STATES THE RULE**, four lines below the comment stating it. The class is gone; stress-only
splits are invisible to this instrument and finding them needs a comparison that keeps the digits, which
is a different sweep.

### And the slot fold had to become PAIRWISE, after I broke it twice

`AH` and `IH` are one slot only when BOTH are unstressed, and no canonical spelling expresses that:

- applied AFTER the digits come off (the original), it merges a STRESSED `IH1` with `AH1`;
- applied BEFORE (my first fix), it makes `IH0` and `IH1` different phones, which is worse — the count
  jumped 1776 → 1887 on rows where a vowel had merely changed stress.

Only the pair knows, so the comparison is pairwise now and the prefix test walks phones rather than
joining them with spaces — `N` is a string prefix of `NG`, `S` of `SH`, `T` of `TH`, so a joined
`startsWith` clears `S AH N` against `S AH NG …`. No such row exists today; it is a false NEGATIVE
waiting on a dict edit, which is the kind this sweep would never report on itself.

### Two smaller ones

- **`SHORTER` is now its own class** (12 rows). An inflection shorter than its lemma — `corp K AO1 R P`
  against `corps K AO1 R` — shows no difference inside the overlap, so it was landing in PREFIX, a class
  defined by unstressed vowels differing, with nothing unstressed differing.
- **The en-GB PROVENANCE still said "TWO INFLECTIONS ARE REFUSED"** while `buoying` beneath it was struck
  through and admitted. One, now — and `test/english-gb-lexical.test.ts` pins the `buoy`/`buoying`
  entailment, which was the one row this work added and the one the argument rests on.

### What the classes mean

Only OTHER is what #1387 is about, and even that is not a defect list: `abuse`/`abused` (S~Z) is a
correct noun/verb pair, `advocate AH0 T`/`advocated EY2 T` is a correct POS pair, and proper names the
suffix-stripper proposed (`abba`/`abbas`, `abe`/`abed`) are not paradigms at all. **A suffix-stripper
without a morphological lexicon cannot separate those**, and tuning the classifier further would be
fitting it to a sample rather than measuring.

⚠ **THE NAMED CLASSES ONLY CLAIM A ROW WHEN THEY EXPLAIN ALL OF IT** — a row with an AA/AO swap *and*
something else stays in OTHER.

### What is filed rather than fixed

- **356 PREFIX rows** are #1397's class, measured wider than that issue's 57 families / 210 words.
- **161 LOT/THOUGHT rows** — `accost AO1`/`accosted AA1`, `aerosol`/`aerosols`. The curated layer already
  carries ~40 hand fixes with the note "LOT/THOUGHT: align AA/AO to gold's consistent system"; this says
  how much is left.
- **1,167 OTHER** wants a morphological lexicon before it can be triaged, not a better regex.

One row is fixed here. The sweep is the deliverable the issue asked for, and it is a standing tool now
rather than an accident.
