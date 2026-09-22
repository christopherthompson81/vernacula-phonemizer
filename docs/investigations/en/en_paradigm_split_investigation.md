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

    ⚠ INFLECTIONS WHOSE PHONE SKELETON IS NOT THE LEMMA'S PLUS A SUFFIX: 1777
       PREFIX (unstressed vowels only — #1397's class, wider)     357
       STRESS (a different stress PATTERN — usually a POS pair)   182
       LOT/THOUGHT (AA~AO only — the curated layer's own class)   161
       VOICING (S~Z, F~V, TH~DH only — noun/verb pairs)            84
       ⚠ OTHER (a consonant or a STRESSED vowel differs)          993

### ⚠ THE RAW COUNT WAS 2,932 AND TWO OF MY OWN BUGS ACCOUNTED FOR 1,155 OF IT

- **Taking the first dictionary-backed candidate as the lemma** — which is what the en-GB audit does,
  because a set membership disambiguates there — reported `ach` as the lemma of `aching`, `abid` of
  `abided`, `abe` of `abed`, `adam` of `adames`. All are real dictionary words and none is the lemma.
  Here nothing disambiguates but the phonology, so the phonology has to: a word is flagged only when NO
  candidate's skeleton is a prefix of it.
- **`AH0` and `IH0` are one slot**, and CMUdict spells the same unstressed vowel both ways *within* a
  paradigm (`abdicate AH0 K` beside `abdicating IH0 K`). Unfolded it drowned the signal.

### What the classes mean

Only OTHER is what #1387 is about, and even that is not a defect list: `abuse`/`abused` (S~Z) is a
correct noun/verb pair, `advocate AH0 T`/`advocated EY2 T` is a correct POS pair the stress test misses,
and proper names the suffix-stripper proposed (`abba`/`abbas`, `abe`/`abed`) are not paradigms at all.
**A suffix-stripper without a morphological lexicon cannot separate those**, and tuning the classifier
further would be fitting it to a sample rather than measuring.

⚠ **THE NAMED CLASSES ONLY CLAIM A ROW WHEN THEY EXPLAIN ALL OF IT** — a row with an AA/AO swap *and*
something else stays in OTHER. A partial explanation is how a defect gets filed under a heading and stops
being looked at.

### What is filed rather than fixed

- **357 PREFIX rows** are #1397's class, measured wider than that issue's 57 families / 210 words.
- **161 LOT/THOUGHT rows** — `accost AO1`/`accosted AA1`, `aerosol`/`aerosols`,
  `afterthought`/`afterthoughts`. The curated layer already carries ~40 hand fixes with the note
  "LOT/THOUGHT: align AA/AO to gold's consistent system"; this says how much is left.
- **993 OTHER** wants a morphological lexicon before it can be triaged, not a better regex.

One row is fixed here. The sweep is the deliverable the issue asked for, and it is now a standing tool
rather than an accident.
