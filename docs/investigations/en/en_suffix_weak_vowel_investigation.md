# The unstressed-vowel classes, and which of them are defects

Run 18 of the kokoro comparison re-censused after #1325. `replace ə → ɪ` was the largest single edit
operation left, at 6,079 — gold writes a schwa where we write `ɪ`. The obvious reading is that we
fail to reduce.

## Run 1 — 2026-09-16 21:40 — asking a second referee, in both directions

misaki's gold is what Kokoro heard, not a phonetic authority, and the repo already ships an
independent one: wikipron (human transcriptions, en-US broad 4,558 rows and en-GB 76,284). The test
is what IT says at exactly the sites where we and gold disagree.

| class | sites | UK referee | US referee | |
|---|---|---|---|---|
| gold `ə` / ours `ɪ` | 6,079 | 82.3% **us** | 72.3% **us** | not a defect |
| gold `ə` / ours `ᵻ` | 3,186 | 78.7% **us** | 68.9% **us** | not a defect |
| gold `ɪ` / ours `ə` | 1,462 | **87.0% gold** | **82.4% gold** | **defect** |

⚠ **THE TWO LARGEST CLASSES ARE NOT DEFECTS.** Together they are 9,265 of the census's edit
operations — more than a fifth of everything left — and both referees say our reading is the better
transcription. misaki writes the weak vowel as `ə`; that is a notation, the same kind of thing Run 15
found for `ᵊ` (`-tion` as `ʃn̩` versus `ʃən`). Chasing them would make the canonical IPA worse to match
a convention.

⚠ **AND THE CLASS THAT REVERSES WAS SITTING AT #11 IN THE CENSUS.** Testing only the direction that
looks like under-reduction would have found nothing to do; testing both found the real one.

If matching misaki here ever turns out to matter for Kokoro's sake, it belongs in `KokoroFormat` as a
rendering fold — the way the word-final flap does — and it would need audio evidence, not a count.

## Run 2 — 2026-09-16 21:55 — the defect is three suffixes, and the obvious fourth is a trap

All 297 in-dictionary sites are `AH0`, and the words cluster:

    -ness  375    -ist  ~230    -sis/-osis/-esis/-ysis  ~230    -age  61    -less  34

`activist` is `AE1 K T AH0 V AH0 S T` — both unstressed slots are `AH0`, and the second is not a
schwa. The dictionary contradicts itself about it: **`abolitionist` read `…ʃənəst` and `abortionist`
`…ʃənɪst`**, the same suffix spelled two ways one row apart.

### Referee evidence, per family — and it splits them

    -ist    ɪ 131 / 135  (97.0%)     ə   4 ( 3.0%)
    -age    ɪ  85 /  95  (89.5%)     ə   4 ( 4.2%)
    -sis    ɪ  17 /  21  (81.0%)     ə   2 ( 9.5%)
    -ness   ɪ  14 / 100  (14.0%)     ə  81 (81.0%)   ← we are already right
    -less   ɪ  10 /  43  (23.3%)     ə  32 (74.4%)   ← we are already right

⚠ **`-ness` IS THE LARGEST FAMILY IN THE CLASS AND ADDING IT WOULD HAVE BEEN A REGRESSION.** Gold
writes `ɪ` in 375 `-ness` words and 34 `-less` words, which is what put them on the list; the referee
says `ə` decisively. And the en-GB referee leans TOWARD `ɪ` by construction — the weak-vowel merger is
less advanced in RP — so an 81% `ə` reading there is stronger, not weaker. 409 words.

### Two designs measured and rejected before the third worked

**As an `isBarredI` arm, yielding `ᵻ` — −486 exact, 0 gained.** That was the natural place: the
function exists to mark the weak vowel, and the referee writing `ɪ` is how the repo already reads
"not a schwa" (the `-es` arm's comment rests on exactly that). It is wrong here, and gold says why:
**gold HAS `ᵻ` and uses it** — 2,154 entries, `Christmases` `kɹˈɪsməsᵻz` — for the INFLECTIONAL
`-es`/`-ed`, and deliberately writes a full `ɪ` for `-ist`. The two families are different and the
reference keeps them apart. Words that already read `ɪ` were being pulled to `ᵻ`, which is where the
486 went.

**Re-basing every `AH0` before an `S` — +297 / −58.** The rule fired on the PREFIX: `assist`
(`AH0 S IH1 S T`) became *`ɪsˈɪst`, `aphesis` (`AE1 F AH0 S AH0 S`) marked both slots as *`ˈæfɪsɪs`
where gold has `ˈæfəsɪs`, and `Protestantism` re-based `-testant-`. All 58 regressions were that
shape.

**Re-basing the SUFFIX's own vowel — the last one — to `IH0`: +357 / −3.**

    exact vs gold   41,767 (46.71%) → 42,121 (47.11%)

The three remaining losses are `Carthage`, `Portage` and `parentage`, `-age` names where gold has a
schwa. A 725-word swing between the first design and the third, on what is nominally the same fix.

⚠ `-ism` IS NOT IN THE SET though it looks like it belongs: its vowel is `IH2 Z AH0 M`, so the S is
voiced to Z and the schwa before the M is a real schwa. Including it in the spelling test produced
only false fires.

### The survey agrees

`tools/english/en_weak_vowel_survey.mts`, which buckets the referee's vowel by the symbol we wrote:
the `ᵻ` bucket still sits between `ɪ` and `ə` (74.5% referee-`ɪ`, the shape that file exists to
protect), and the `ə` bucket's schwa rate rose 81.5% → 82.0% — schwas removed that were not schwas.

## Run 3 — 2026-09-17 — review: the rule split a singular from its own plural

The shipped rule took **the last vowel**, which is the suffix's own vowel in `package`
(`P AE1 K AH0 JH`) but NOT in `packages` (`P AE1 K AH0 JH AH0 Z`), where the inflection has moved
past it:

    package    pʰˈækɪd͡ʒ        ← re-based
    packages   pʰˈækəd͡ʒᵻz      ← not reached

Before this change both were `ə` and agreed. After it they disagreed — the
two-spellings-per-morpheme defect `en_rebuild_lexicon.mts` exists to warn about, introduced by the
fix for another one.

⚠ **AND THE REFERENCE CANNOT SEE IT.** Gold has no entry for `packages`, `messages`, `cottages` or
`villages`, so the score is **identical either way — +357 / −3 both times**. A metric-driven review
would have passed this. The invariant is the only thing that catches it, and it is now a test.

Fixed by locating the suffix consonant from the END rather than requiring the vowel to be last:
`… AH0 S T` / `… AH0 S T S` for `-ist`, `… AH0 S` for `-sis`, `… AH0 JH` / `… AH0 JH <V0> Z` for
`-age`. The over-firing guard is unchanged and re-verified: `assist`, `exist`, `fist`, `garage`,
`stage`, `teenage`, `sabotage` are all still refused by the stress test.

### Two process notes

⚠ **A DEAD BRANCH SHIPPED IN BOTH LANGUAGES.** The first plural arm read
`at(n - 2) === "JH" && at(n - 1) === "Z" && unstressedVowel(n - 2 + 1)` — and `n - 2 + 1` is the `Z`
itself, a consonant, so the condition was never true. It was never reached because the third arm
already handled the case. Removed from TS and C#; behaviour identical before and after, which is what
says it was dead.

⚠ **`tail -1` ON `check:goldens` REPORTS THE WRONG THING.** The stale warning's last line is prose
("re-recording a row is how a real defect survived weeks of green gates"), so a STALE run tailed to
one line looks like it passed. That is how 18 stale rows got through a gate sweep in this session and
surfaced instead as a parity DIFF, which read like a port divergence and was not one — TS and C#
agreed throughout. Grep for `fresh|STALE`, not `tail`.

## Run 4 — 2026-09-17 — `-is`, not `-sis`: the rule was split from itself

Found while asking whether TAXONOMIC LATIN is rule-handleable. Taxonomic-shaped endings are 5.7% of
the en referee and 48.8% wrong against its 38.6% baseline — and two endings were **entirely** wrong:
`-itis` 6/6 and `-aceous` 3/3. The `-itis` rows turned out not to be a Latin problem at all:

    mastitis     ours mæstaɪtəs      referee mæstaɪtɪs
    encephalitis ours ɛnsɛfəlaɪtəs   referee ɛnkɛfəlaɪtɪs

That is Run 2's defect, in a spelling Run 2's rule did not cover. `/sis$/` matched `analysis` and not
`arthritis` — **the same ending, split from itself, one dictionary row apart.**

### The half `/sis$/` missed is the stronger half

    -sis  (shipped)   referee ɪ  9 / 12  (75.0%)   ə 2
    -is, NOT -sis     referee ɪ 35 / 36  (97.2%)   ə 0

### ⚠ And the two references disagree, so the choice had to be argued

Against gold this LOSES: **+7 / −55, net −48** (47.11% → 47.06%). Gold writes `ə` for `Iris`, `Davis`,
`Tigris`, `arthritis`, `acropolis`.

It is still right, because **gold cannot arbitrate this ending — it is a coin flip on itself.** Over
the 88 dictionary words the rule targets:

    gold writes ɪ   48 (55%)    analysis, axis, antithesis, asbestosis, apotheosis
    gold writes ə   40 (45%)    arthritis, aegis, acropolis, amaryllis, cannabis

The same ending both ways with no discriminator, while the referee is 97.2% one way with zero
counterexamples. Following a source that contradicts itself is not following a convention, it is
copying noise; and Run 1 of this document already established that where misaki writes `ə` for the
weak vowel and the referee writes `ɪ`, the referee is the better guide.

⚠ **THE STRONGEST ARGUMENT IS SELF-CONSISTENCY, NOT EITHER REFERENCE.** #1326 created the split itself:
before it, `analysis` and `arthritis` both read `ə` and agreed. After it they disagreed. This closes
that, which is the same two-spellings-per-morpheme invariant `en_rebuild_lexicon.mts` exists for — and
the invariant is why the gold loss is acceptable rather than a reason to revert.

### The phone guard does the discriminating, not the spelling

Widening to `/is$/` sweeps in every common word ending in those letters; the stressed-vowel and
final-S tests refuse them. `this` (DH IH1 S) is stressed, `his` ends in Z. `axis`, `tennis`, `Paris`,
`polis` are correctly caught — `polis` (P OW1 L AH0 S, the Greek city-state) is not `police`
(P AH0 L IY1 S, stressed), which the goldens made look alarming until it was checked.

### What is left of the taxonomic question

`-itis` was the weak vowel wearing a Latin coat. The genuinely Latin residue is smaller and less
tractable: `-ae` where the referee says `-i` (`cannulae` kænjəli, `coronae` kəɹoʊni) against our
`-eɪ` — but `alumnae` is `əlˈʌmnaɪ` in gold, so **both /iː/ and /aɪ/ are attested traditions** and a
single rule cannot serve them. `-ata` and `-aceous` are OOV guessing, not a convention gap. Taxonomic
Latin is NOT the rule-shaped seam it looked like; one slice of it was an ordinary English suffix.
