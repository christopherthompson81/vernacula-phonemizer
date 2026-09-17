# More than one primary stress in a single word

## Run 1 — 2026-09-16 20:05 — found by counting the direction Run 14 never counted

Run 14 of `kokoro_vphon_investigation.md` triaged the English/misaki divergence by aligning gold
against ours and counting edit operations. It found the spurious secondary stresses we ADD. It never
counted the ones we DROP, and that is where the largest remaining stress class was:

    edit operations, gold → ours, over the 44,727 differing words
      8,284   delete 'ˌ'      gold has a secondary we do not emit      ← largest single operation
      5,686   replace ə → ɪ   unreduced vowel
      5,148   replace ˌ → ˈ   stress LEVEL swapped
      3,150   replace ə → ᵻ   the known -ity class
      2,862   replace ᵊ → ə   the remaining reduced-slot gap
      1,828   delete 'ˈ'

Restricted to words where the PHONEMES agree exactly and only the stress marks differ — 8,053 words,
10% of the corpus — the split is:

    gold has MORE marks than us        6,337  (79%)
    same count, LEVEL swapped          1,270  (16%)
    we have MORE marks                   446  ( 6%)

⚠ **THE FIRST CUT OF THIS WAS 17,188 AND THE NUMBER WAS MEANINGLESS.** Counting every word where gold
has more `ˌ` than us includes words we read completely differently (`abaca` gold `ˈæbəkˌɑ` vs ours
`əbˈɑkə`, `aa` gold `ˈɑˌɑ` vs ours `ˈɑ`), where the stress difference is a symptom. Requiring the
phoneme strings to match first is what turns it into a stress question.

### The malformed subset: 372 words emit more than one PRIMARY

Inside the "we have more marks" direction sat something that is not a convention difference at all:

    words whose output has >1 primary mark inside one space-delimited group   372

A word has exactly one primary stress by definition, so this is malformed output rather than a
different opinion. Cause: **1,029 `g2p-dict.tsv` rows carry more than one stress-1 nucleus**, because
CMUdict declines to resolve prefixed forms, compounds and initialisms —

    ARCHBISHOP  AA1 R CH B IH1 SH AH0 P        NINETEEN  N AY1 N T IY1 N
    ABS         EY1 B IY1 EH1 S                ACTUARY   AE1 K CH UW0 EH1 R IY2

— and the flat lexicon rendered them verbatim. The OOV paths never showed it because
`enforceSinglePrimary` has always run over the n-gram's and the tagger's output. **The guard existed
on one path and not its twin**, which is the same shape as the flap guard in #1317.

⚠ A HYPHENATED COMPOUND IS NOT AN INSTANCE. `able-bodied` → `ˈAbᵊl bˈɑdid` is two spoken GROUPS, each
a word with its own primary. The invariant is per group, which is why the count splits on spaces;
measuring per word instead gives 3,431 and is mostly that.

## Run 2 — 2026-09-16 20:20 — which primary to keep, measured three ways

`enforceSinglePrimary` keeps the FIRST. Gold is not consistent about which it keeps, so the policy was
measured rather than assumed, over the 311 multi-primary rows gold covers:

| | exact | stress pattern |
|---|---|---|
| as shipped (both) | 0 | 0 |
| keep FIRST | 31 | 66 |
| keep LAST | 75 | 120 |

Split by word shape, the reason is ordinary English phonology rather than a preference:

| shape | n | gold picks FIRST | gold picks LAST |
|---|---|---|---|
| prefixed (`anti-`, `arch-`, `over-`) | 150 | 24 | **81** |
| genuine compounds (`boathouse`, `bitcoin`) | 137 | **37** | 31 |
| stress-attracting suffix (`-ee`, `-esque`) | 15 | 2 | 5 |

Prefix + stem keeps the primary on the stem; compounds are fore-stressed. The compound half is a coin
flip, so keeping the last wins overall on the strength of the prefixed rows.

### Full-corpus, and the reason it is a SPLIT policy

    configuration                                exact  malformed  gained  lost   net
    as shipped                                  38,925        372       —     —     —
    FIRST everywhere                            38,962          0      37     0   +37
    LAST everywhere                             39,111          0     292   106  +186
    LAST in the converter, FIRST in the predictor 39,017         0      92     0   +92
    …and demoted marks exempt from the clash rule 39,072         0     147     0  +147
    ONE policy everywhere + that exemption       39,160          0     341   106  +235   ← SHIPPED

⚠ **"LAST EVERYWHERE" IS THE BEST HEADLINE NUMBER AND WAS NOT TAKEN.** Its 106 regressions are
ordinary fore-stressed words gold has right — `Humean` `hjˈumiən` → *hjumˈiən, `Lockean`, `apishly`,
`Padang`, `Sauria`. Those all come from the OOV path, where several `1`s are a PREDICTION ARTIFACT of
a per-position classifier with no global constraint: there is no information in which came first, and
first is what that path has always used.

In the dictionary, several `1`s are a LEXICOGRAPHIC STATEMENT about a prefixed form or compound, and
gold resolves those to the later element.

⚠ **THAT REASONING WAS WRONG AND REVIEW CAUGHT IT — SEE RUN 4.** The split policy was implemented,
measured at +92/−0, opened as a PR, and then withdrawn.

### The referee decided it, and it is unanimous where it matters

The teen numerals are the frequent case in real text — dates, years, money — and gold has no spread:

    nineteen nˌIntˈin   thirteen θˌɜɹtˈin   fourteen fˌɔɹtˈin   fifteen fˌɪftˈin
    sixteen sˌɪkstˈin   eighteen ˌAtˈin     seventeen sˌɛvəntˈin

Seven of seven, secondary-then-primary, which is exactly what separates *nineTEEN* from *NINEty*.
Keeping the first gets all of them wrong.

## Run 3 — 2026-09-16 20:35 — the fix was being eaten, and the second half is the clash rule

With the demotion alone, `nineteen` came out **`naᶦntˈiːn`** — one primary, and NOTHING on `nine`.
`archbishop` → `ɑːɹt͡ʃbˈɪʃəp`. The demoted `2°` lands on the syllable adjacent to the primary, which is
exactly what the secondary-stress **clash rule** deletes.

That is arguably worse than the malformed form it replaced: the word loses its first beat entirely,
in the most common words in the corpus. A well-formedness fix that degrades `fourteen`, `PM` and `UV`
is not a fix.

**The exemption is principled, not a patch.** The clash rule exists to drop a `2°` **CMUdict wrote**
on an ordinary unstressed syllable next to the primary — `zorro` `Z AO1 R OW2`, `aalto`, `adolfo` —
where marking it over-articulates. A `2°` this engine just created from a `1°` is the opposite case:
the dictionary called that syllable strong. So the rule now skips marks the demotion produced, and
nothing else.

    nineteen    naᶦntˈiːn      → nˌaᶦntˈiːn      gold nˌIntˈin      ✓
    alongside   əlɔːŋsˈaᶦd     → əlˌɔːŋsˈaᶦd     gold əlˌɔŋsˈId     ✓
    archbishop  ɑːɹt͡ʃbˈɪʃəp    → ˌɑːɹt͡ʃbˈɪʃəp    gold ˌɑɹʧbˈɪʃəp    ✓

Worth **+55 exact on its own**, and it is what makes the numerals match. `zorro` → `zˈɔːɹoᶷ` is
unchanged and pinned as a test, because the exemption must stay narrow.

### Result

    exact vs gold      38,925 (43.53%) → 39,072 (43.74%)      +147, ZERO regressions
    malformed output          372 → 0

Seventeen test expectations changed across six TS files and three C# files, all one shape — `ˈX…ˈY` →
`ˌX…ˈY` — and all verified against gold before editing rather than re-recorded. 90 golden rows across
21 languages, every one an embedded English initialism reaching another language through foreign-run
delegation (`DNA` was `dˈiːʲɛnˈeᶦ`); each was machine-checked to have the fix's signature — identical
phonemes, no more primaries than before — before regenerating, 90 of 90.

## Still open, in order of size

| n | class | note |
|---|---|---|
| ~6,300 | gold marks a secondary we do not | the clash rule is only 2,102 of it; **3,466 are OOV**, where the lever is the BiLSTM's training data or the lexicon rather than a rule |
| 5,686 | `ə` → `ɪ`, unreduced vowel | mid-word, distinct from the known 683-word initial-vowel class |
| 1,270 | stress LEVEL swapped | ⚠ **gold is not automatically right here.** `abalone` gold `ˈæbəlˌOni`, ours `ˌæbəlˈOni`, and the standard reading is ours (/ˌæbəˈloʊni/); `academe` likewise. But `abattoir` gold is right. Needs a referee pass before any of it is treated as a defect |
| — | the clash rule proper | it drops a dictionary `2°` gold keeps on 2,383 of 4,162 gold-covered targets. Deliberately tuned without gold, so this is a re-open rather than a bug; the `EY`/`UW` gap found in #1323 (`airway`, `aircrew`) is part of it |


## Run 4 — 2026-09-16 20:50 — review: the split policy was a seam, and the seamless one is also better

Runs 2–3 shipped a SPLIT: the converter keeps the last primary, `enforceSinglePrimary` keeps the
first. The argument was that the two sites resolve different things — a per-position classifier's
extra `1` is noise, CMUdict's is a statement — and it had the attractive property of zero regressions.

**Review killed it in one probe.** The same ARPABET read two different ways depending on which path
delivered it:

    AA1 R CH B IH1 SH AH0 P   via the predictor    ˈɑːɹt͡ʃbɪʃəp
                              via the dictionary   ˌɑːɹt͡ʃbˈɪʃəp

That is the seam this repo keeps a curation gate for — "the engine answers one way for recorded words
and another for unrecorded ones in the same environment" — introduced deliberately, in a PR whose own
headline was that a guard had been missing from one of two paths.

### And the justification does not survive contact with the compound path

The claim was that the OOV side's multiple `1`s carry no information. That is true of a raw n-gram or
BiLSTM decode. It is **false of `decomposeInner`**, which joins two dictionary stems each carrying its
own real primary — exactly the situation a CMUdict compound row describes. So the two sides were never
different in kind; the distinction was drawn on where the phones arrived from rather than on what they
meant.

### Measured, and the seamless configuration is also the better one

    configuration                                exact  malformed  gained  lost   net
    as shipped                                  38,925        372       —     —     —
    keep FIRST everywhere                       38,962          0      37     0   +37
    split: LAST in converter, FIRST in predictor 39,072          0     147     0  +147
    ONE policy everywhere (LAST) + exemption    39,160          0     341   106  +235   ← shipped

So the cell that removes the seam had never been measured, and it is +235 against the split's +147. A
seam is a CORRECTNESS property and 106 stress placements are an ACCURACY one, so this would have been
the call even at a small loss; it is not at a loss.

### The 106 regressions are real, and they name the next refinement

    Afrobeat  ˈæfɹObˌit → ˌæfɹObˈit      Twitterverse  twˈɪTəɹvˌɜɹs → twˌɪTəɹvˈɜɹs
    Humean    hjˈumiən  → hjˌumˈiən      allemande     ˈæləmˌænd    → ˌæləmˈænd
    Attu      ˈætu      → ˌætˈu          Padang        pˈædæŋ       → pˌædˈæŋ

Fore-stressed COMPOUNDS, short proper nouns, and the `-ean` pair `Humean`/`Lockean`. Which says the
real discriminator was never predictor-versus-dictionary at all — it is **prefixed** (the stem keeps
the primary, 81:24) versus **compound** (fore-stressed, 37:31), and separating those needs a
morphological inventory this module does not have. These 106 words are that refinement's evidence set.

Pinned as a test: the predictor and the dictionary must render the same phones identically.
